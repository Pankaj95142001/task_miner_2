"""Consolidate adjacent desktop input snapshots, preserving every original for undo."""
from contextlib import contextmanager
from copy import deepcopy
import json
import shutil
from uuid import UUID, uuid4

from fastapi import HTTPException
from pydantic import Field

from . import cleaner, narration
from .schemas import Revision
from .workflow_delete import owned_path, uuid_name


class MergeSteps(Revision):
    step_ids: list[UUID] = Field(min_length=2, max_length=200)
    confirm_same_field: bool = False


def eligible(step):
    return (step.get('source') == 'desktop' and step.get('action') == 'input'
            and not step.get('sensitive') and step.get('text_capture') == 'captured'
            and not step.get('merge'))


def same_context(a, b):
    return all(a.get(k) == b.get(k) for k in ('tab_id', 'app_name', 'page_title', 'capture_host'))


def same_session(a, b):
    return (eligible(a) and eligible(b) and same_context(a, b)
            and bool(a.get('input_group_id')) and a['input_group_id'] == b.get('input_group_id')
            and bool(a.get('desktop_field_id')) and a['desktop_field_id'] == b.get('desktop_field_id'))


def rows(db, workflow_id):
    return [dict(r) for r in db.execute('SELECT * FROM steps WHERE workflow_id=? ORDER BY sequence', (workflow_id,))]


def unpack(row):
    return {**json.loads(row['payload']), 'id': row['id'], 'sequence': row['sequence']}


def renumber(db, workflow_id, ids):
    db.execute('UPDATE steps SET sequence=-sequence WHERE workflow_id=?', (workflow_id,))
    for index, step_id in enumerate(ids, 1):
        db.execute('UPDATE steps SET sequence=? WHERE id=? AND workflow_id=?', (index, step_id, workflow_id))


@contextmanager
def created_images():
    paths = []
    try:
        yield paths
    except Exception:
        for path in paths:
            path.unlink(missing_ok=True)
        raise


def image_paths(settings, ids):
    return [owned_path(settings.data_dir, 'screenshots', f'{uuid_name(step_id)}-{phase}.jpg')
            for step_id in ids for phase in ('before', 'after')]


def copy_snapshot(settings, candidates, merged_id, phase, created):
    # Prefer the first before-image and the last after-image. Missing files do not
    # erase originals; any fallback carries its original timestamp and a warning.
    for offset, item in enumerate(candidates):
        snapshot = item.get(phase) or {}
        name = snapshot.get('filename')
        if not name:
            continue
        expected = f"{uuid_name(item['id'])}-{phase}.jpg"
        if name != expected:
            raise HTTPException(409, 'Unexpected screenshot reference. No steps were merged.')
        source = owned_path(settings.data_dir, 'screenshots', expected)
        if not source.is_file():
            continue
        target = owned_path(settings.data_dir, 'screenshots', f'{merged_id}-{phase}.jpg')
        created.append(target)
        shutil.copyfile(source, target)
        result = {**snapshot, 'filename': target.name, 'source_step_id': item['id']}
        if offset:
            result['note'] = 'Screenshot from another typing update; it may not show the initial or final text. Verify it.'
        return result
    return {'filename': None, 'note': 'No saved screenshot is available for this merged typing step.'}


def narration_segments(db, workflow_id, ids):
    voice = narration.load_narration(db, workflow_id)
    return voice, [s for s in (voice or {}).get('segments', []) if set(s['step_ids']) & set(ids)]


def remap_narration(db, workflow_id, old_ids, new_ids):
    voice, segments = narration_segments(db, workflow_id, old_ids)
    for segment in segments:
        replaced = []
        for step_id in segment['step_ids']:
            for replacement in (new_ids if step_id in old_ids else [step_id]):
                if replacement not in replaced:
                    replaced.append(replacement)
        segment.update(step_ids=replaced, comparison=None, confirmed=False)
    if segments:
        narration.save_narration(db, workflow_id, voice)


def merge_rows(db, settings, workflow_id, selected, automatic, created):
    original_ids = [r['id'] for r in selected]
    _, segments = narration_segments(db, workflow_id, original_ids)
    if len(segments) > 1:
        raise HTTPException(422, 'These inputs belong to different narrated steps. Keep them separate.')
    all_ids = [r['id'] for r in rows(db, workflow_id)]
    evidence = [unpack(r) for r in selected]
    merged_id = str(uuid4())
    payload = deepcopy(evidence[-1])
    for key in ('vision', 'value_recovery', 'sop_details', 'narration_details', 'narration_context'):
        payload.pop(key, None)
    payload.update(id=merged_id, sequence=selected[0]['sequence'], occurred_at=evidence[0]['occurred_at'],
                   merge={'count': len(selected), 'automatic': automatic})
    payload['before'] = copy_snapshot(settings, evidence, merged_id, 'before', created)
    before_source = next((s for s in evidence if s['id'] == payload['before'].get('source_step_id')), evidence[0])
    payload['desktop_target'] = deepcopy(before_source.get('desktop_target'))
    payload['after'] = copy_snapshot(settings, list(reversed(evidence)), merged_id, 'after', created)
    for step_id in original_ids:
        db.execute('DELETE FROM steps WHERE id=? AND workflow_id=?', (step_id, workflow_id))
    db.execute('INSERT INTO steps(id,workflow_id,sequence,description,reviewed,edited,payload) VALUES(?,?,?,?,0,?,?)',
               (merged_id, workflow_id, selected[0]['sequence'], cleaner.fallback_text(payload),
                int(not automatic), json.dumps(payload)))
    for index, row in enumerate(selected):
        db.execute('INSERT INTO step_merge_originals(id,workflow_id,merged_step_id,position,sequence,description,reviewed,edited,payload) '
                   'VALUES(?,?,?,?,?,?,?,?,?)', (row['id'], workflow_id, merged_id, index, row['sequence'],
                    row['description'], row['reviewed'], row['edited'], row['payload']))
    order = [merged_id if step_id == original_ids[0] else step_id for step_id in all_ids
             if step_id == original_ids[0] or step_id not in original_ids]
    renumber(db, workflow_id, order)
    remap_narration(db, workflow_id, original_ids, [merged_id])


def auto_merge(db, settings, workflow_id, created):
    current = rows(db, workflow_id)
    groups, group = [], []
    for row in current:
        if group and same_session(unpack(group[-1]), unpack(row)):
            group.append(row)
        else:
            if len(group) > 1:
                groups.append(group)
            group = [row]
    if len(group) > 1:
        groups.append(group)
    for group in groups:
        _, segments = narration_segments(db, workflow_id, [r['id'] for r in group])
        if len(segments) > 1:
            continue
        # Earlier merges renumber the active steps.
        fresh = {r['id']: r for r in rows(db, workflow_id)}
        merge_rows(db, settings, workflow_id, [fresh[r['id']] for r in group], True, created)


def require_idle(workflow):
    if any((workflow.get(key) or {}).get('status') == 'processing' for key in ('narration', 'vision_review')):
        raise HTTPException(409, 'Wait for narration or Vision processing to finish before merging or undoing.')


def register_merge_routes(api, settings, database, detail, require_stopped, check_version, touch):
    @api.post('/workflows/{workflow_id}/merge-inputs')
    def merge(workflow_id: str, body: MergeSteps):
        with created_images() as created, database.connect(write=True) as db:
            current = detail(db, workflow_id)
            require_stopped(current); check_version(current, body.version); require_idle(current)
            ids = [str(value) for value in body.step_ids]
            ordered = rows(db, workflow_id)
            selected = [r for r in ordered if r['id'] in ids]
            positions = [i for i, r in enumerate(ordered) if r['id'] in ids]
            if len(set(ids)) != len(ids) or len(selected) != len(ids):
                raise HTTPException(422, 'Select at least two different steps from this workflow.')
            if positions != list(range(positions[0], positions[0] + len(positions))):
                raise HTTPException(422, 'Select consecutive typing steps with no other action between them.')
            evidence = [unpack(r) for r in selected]
            if not all(eligible(s) for s in evidence):
                raise HTTPException(422, 'Only complete, non-private desktop typing steps can be merged. Undo an existing merge first.')
            first = evidence[0]
            for other in evidence[1:]:
                if not same_context(first, other):
                    raise HTTPException(422, 'These steps belong to different windows or applications.')
            for key in ('desktop_field_id', 'input_group_id'):
                known = {json.dumps(s[key]) for s in evidence if s.get(key)}
                if len(known) > 1:
                    raise HTTPException(422, 'These steps belong to different fields or typing sessions.')
            known_ids = {(s.get('desktop_target') or {}).get('auto_id') for s in evidence} - {'', None}
            if len(known_ids) > 1:
                raise HTTPException(422, 'These steps identify different input fields.')
            if not body.confirm_same_field:
                raise HTTPException(422, 'Confirm that the selected steps are updates to the same field in one typing action.')
            merge_rows(db, settings, workflow_id, selected, False, created)
            touch(db, workflow_id)
            return detail(db, workflow_id)

    @api.post('/workflows/{workflow_id}/steps/{step_id}/unmerge')
    def undo(workflow_id: str, step_id: str, body: Revision):
        with database.connect(write=True) as db:
            current = detail(db, workflow_id)
            require_stopped(current); check_version(current, body.version); require_idle(current)
            original = [dict(r) for r in db.execute('SELECT * FROM step_merge_originals '
                        'WHERE workflow_id=? AND merged_step_id=? ORDER BY position', (workflow_id, step_id))]
            if not original:
                raise HTTPException(404, 'This step has no merge to undo.')
            paths = image_paths(settings, [step_id])
            order = [s['id'] for s in current['steps']]
            order[order.index(step_id):order.index(step_id) + 1] = [r['id'] for r in original]
            temporary_base = max(s['sequence'] for s in current['steps'])
            # Free all sequence positions before restoring the original rows.
            db.execute('UPDATE steps SET sequence=-sequence WHERE workflow_id=?', (workflow_id,))
            db.execute('DELETE FROM steps WHERE id=? AND workflow_id=?', (step_id, workflow_id))
            for index, row in enumerate(original, 1):
                db.execute('INSERT INTO steps(id,workflow_id,sequence,description,reviewed,edited,payload) VALUES(?,?,?,?,0,?,?)',
                           (row['id'], workflow_id, -temporary_base-index, row['description'], row['edited'], row['payload']))
            for index, restored_id in enumerate(order, 1):
                db.execute('UPDATE steps SET sequence=? WHERE id=?', (index, restored_id))
            remap_narration(db, workflow_id, [step_id], [r['id'] for r in original])
            for path in paths:
                path.unlink(missing_ok=True)
            touch(db, workflow_id)
            return detail(db, workflow_id)
