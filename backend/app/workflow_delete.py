"""Permanent deletion of workflow-owned records and files only."""
import os
import shutil
from uuid import UUID
from pathlib import Path

from fastapi import HTTPException, Query
from .narration import load_narration
from .workflow_vision import load_review


def owned_path(root, *parts):
    root = root.resolve()
    target = root.joinpath(*parts)
    # Reject links/junctions before resolving, including intermediate directories.
    current = target
    while current != root:
        if current.is_symlink() or current.is_junction():
            raise HTTPException(409, 'Stored files contain a linked path. Resolve the storage link before deleting.')
        if current.parent == current:
            raise HTTPException(409, 'Invalid workflow storage path.')
        current = current.parent
    resolved = target.resolve()
    if not resolved.is_relative_to(root) or resolved == root:
        raise HTTPException(409, 'Invalid workflow storage path.')
    return resolved


def uuid_name(value):
    try:
        parsed = str(UUID(value))
        if parsed != value:
            raise ValueError()
        return parsed
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(409, 'Invalid stored identifier. No workflow files were deleted.') from None


def register_delete_route(api, settings, database, recorder, get_workflow, require_stopped, check_version):
    @api.delete('/workflows/{workflow_id}')
    def delete_workflow(workflow_id: str, version: int = Query()):
        with recorder.lock, database.connect(write=True) as db:
            current = get_workflow(db, workflow_id)
            require_stopped(current); check_version(current, version)
            state = recorder.status()
            if state.get('workflow_id') == workflow_id and (
                state.get('recoverable') or state.get('pending', 0) or state['phase'] not in ('idle', 'done', 'error')
            ):
                raise HTTPException(409, 'Stop and finish syncing or recovering this recording before deleting it.')
            voice = load_narration(db, workflow_id)
            if voice and voice.get('status') == 'processing':
                raise HTTPException(409, 'Wait for narration processing before deleting this workflow.')
            visual_review = load_review(db, workflow_id)
            if visual_review and visual_review.get('status') == 'processing':
                raise HTTPException(409, 'Wait for visual review before deleting this workflow.')
            steps = db.execute('SELECT id FROM steps WHERE workflow_id=?', (workflow_id,)).fetchall()
            steps += db.execute('SELECT id FROM step_merge_originals WHERE workflow_id=?', (workflow_id,)).fetchall()
            # Older installations can retain run files. Remove owned legacy data only when
            # the user deletes its workflow; new SOP-only databases do not create these tables.
            has_legacy_runs = db.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='automation_runs'").fetchone()
            runs = db.execute('SELECT id FROM automation_runs WHERE workflow_id=?', (workflow_id,)).fetchall() if has_legacy_runs else []
            # Derive filenames from owned UUIDs, never from payload-supplied paths.
            files = [owned_path(settings.data_dir, 'screenshots', f'{uuid_name(s["id"])}-{phase}.jpg')
                     for s in steps for phase in ('before', 'after')]
            files.append(owned_path(settings.data_dir, 'narration', uuid_name(workflow_id)+'.webm'))
            directories = [owned_path(settings.data_dir, 'runs', uuid_name(r['id'])) for r in runs]
            # Check every recursive deletion target before removing any files.
            def walk_error(error): raise error
            try:
                for directory in directories:
                    if directory.exists():
                        if not directory.is_dir(): raise OSError('Expected a run directory')
                        for parent, children, names in os.walk(directory, followlinks=False, onerror=walk_error):
                            for name in children + names:
                                owned_path(directory, *(Path(parent) / name).relative_to(directory).parts)
                for filename in files:
                    filename.unlink(missing_ok=True)
                for directory in directories:
                    if directory.exists(): shutil.rmtree(directory)
            except OSError:
                # Keep the records so failed/partially completed cleanup can be retried.
                raise HTTPException(503, 'Some stored files could not be deleted. The workflow is retained so you can retry. Close programs using its files and try again.') from None
            if has_legacy_runs:
                db.execute('DELETE FROM automation_runs WHERE workflow_id=?', (workflow_id,))
            db.execute('DELETE FROM workflows WHERE id=?', (workflow_id,))
            # Steps, narration, visual reviews and any legacy children cascade with the workflow.
        with recorder.lock:
            if recorder.state.get('workflow_id') == workflow_id:
                recorder.state.update(phase='idle', workflow_id=None, title='', count=0, pending=0, error='', download_error='')
        return {'deleted': True, 'id': workflow_id}
