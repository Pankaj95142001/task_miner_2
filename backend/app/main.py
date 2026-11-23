import base64
import binascii
import json
import logging
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query, Request
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

from . import cleaner, narration, workflow_vision
from .workflow_vision_routes import register_workflow_vision_routes
from .narration_routes import register_narration_routes
from .vision_routes import register_vision_routes
from .workflow_delete import register_delete_route
from . import step_merge
from .config import PROJECT, Settings
from .db import Database
from .exporter import export_disposition, generate_docx, generate_pdf
from .schemas import CleanRequest, RecorderStart, Reorder, Revision, StepCreate, StepEdit, WorkflowCreate, WorkflowEdit
from .recorder import RecorderService


def now():
    return datetime.now(timezone.utc).isoformat()


def safe_url(url):
    try:
        parts = urlsplit(url)
        if parts.scheme not in ("http", "https") or not parts.hostname:
            return ""
        # Query strings, fragments and embedded credentials can carry secrets.
        host = parts.netloc.rsplit("@", 1)[-1]
        return urlunsplit((parts.scheme, host, parts.path, "", ""))
    except ValueError:
        return ""


def get_workflow(db, workflow_id):
    row = db.execute("SELECT * FROM workflows WHERE id=?", (workflow_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Workflow not found")
    return dict(row)


def get_steps(db, workflow_id):
    rows = db.execute("SELECT * FROM steps WHERE workflow_id=? ORDER BY sequence", (workflow_id,)).fetchall()
    steps = [{**json.loads(row["payload"]), "id": row["id"], "sequence": row["sequence"],
             "description": row["description"], "reviewed": bool(row["reviewed"]),
             "edited": bool(row["edited"])} for row in rows]
    return narration.attach_context(steps, narration.load_narration(db, workflow_id))


def detail(db, workflow_id):
    return {**get_workflow(db, workflow_id), "steps": get_steps(db, workflow_id),
            "narration": narration.load_narration(db, workflow_id), "vision_review": workflow_vision.load_review(db, workflow_id)}


def check_version(workflow, version):
    if workflow["version"] != version:
        raise HTTPException(409, "This workflow changed. Refresh it before saving again.")


def require_stopped(workflow):
    if workflow["status"] == "recording":
        raise HTTPException(409, "Stop the recording and finish syncing before editing or exporting.")


def touch(db, workflow_id):
    db.execute("UPDATE workflows SET version=version+1, updated_at=? WHERE id=?", (now(), workflow_id))


def save_snapshot(directory, step_id, phase, snapshot):
    data = snapshot.model_dump(mode="json", exclude={"data_url"})
    data["url"] = safe_url(data["url"])
    data["filename"] = None
    if not snapshot.data_url:
        data["note"] = data["note"] or "No screenshot was captured for this moment."
        return data
    try:
        header, encoded = snapshot.data_url.split(",", 1)
        if header not in ("data:image/jpeg;base64", "data:image/png;base64"):
            raise ValueError("Unsupported screenshot format")
        raw = base64.b64decode(encoded, validate=True)
        with Image.open(BytesIO(raw)) as image:
            if image.width * image.height > 20_000_000:
                raise ValueError("Screenshot dimensions are too large")
            image.load()
            filename = f"{step_id}-{phase}.jpg"
            image.convert("RGB").save(directory / "screenshots" / filename, "JPEG", quality=88)
        data["filename"] = filename
        return data
    except (ValueError, binascii.Error, OSError, UnidentifiedImageError, Image.DecompressionBombError):
        raise HTTPException(422, "Screenshot must be a valid JPEG or PNG under 20 megapixels")


def create_app(settings=None):
    settings = settings or Settings.from_env()
    database = Database(settings.data_dir)
    (settings.data_dir / "screenshots").mkdir(exist_ok=True)
    with database.connect(write=True) as db:
        for row in db.execute('SELECT workflow_id,payload FROM narrations').fetchall():
            value = json.loads(row['payload'])
            if value.get('status') == 'processing':
                value.update(status='error', error='Processing was interrupted. Retry transcription and comparison.')
                narration.save_narration(db, row['workflow_id'], value)
        for row in db.execute('SELECT workflow_id,payload FROM workflow_vision').fetchall():
            value = json.loads(row['payload'])
            if value.get('status') == 'processing':
                value.update(status='error', error='Visual review was interrupted. Retry to continue from the last completed batch.')
                workflow_vision.save_review(db, row['workflow_id'], value)
    recorder = RecorderService(settings)

    @asynccontextmanager
    async def lifespan(_app):
        yield
        await run_in_threadpool(recorder.shutdown)

    app = FastAPI(title="SOP Studio", version="0.3.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.database = database
    app.state.recorder = recorder
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("SOP_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000").split(","),
        allow_origin_regex=r"chrome-extension://[a-p]{32}",
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    def authorize(authorization: str = Header(default="")):
        if not secrets.compare_digest(authorization.encode(), f"Bearer {settings.token}".encode()):
            raise HTTPException(401, "Enter the local session token to connect.")

    api = APIRouter(prefix="/api", dependencies=[Depends(authorize)])

    @app.get("/health")
    def health():
        return {"status": "ok", "app": "SOP Studio"}

    @api.get("/settings")
    def info():
        return {"openai_configured": bool(settings.api_key), "model": settings.model, "remote_agent_capture": True}

    @api.get('/remote-recorder/download')
    def remote_recorder_download():
        from fastapi.responses import Response
        from .remote_bundle import recorder_bundle
        return Response(recorder_bundle(), media_type='application/zip', headers={
            'Content-Disposition': 'attachment; filename="sop-remote-recorder.zip"', 'Cache-Control': 'no-store'})

    def local_origin(request):
        # Use the listening socket, never the caller-controlled Host header.
        server = request.scope.get("server")
        if not server or server[0] not in ("127.0.0.1", "localhost", "::1"):
            raise HTTPException(400, "The Chromium recorder requires the backend to listen on localhost.")
        hostname = "[::1]" if server[0] == "::1" else server[0]
        return f"http://{hostname}:{server[1]}"

    @api.get("/recorder/status")
    def recorder_status():
        return recorder.status()

    @api.post("/recorder/start")
    def recorder_start(body: RecorderStart, request: Request):
        with recorder.lock:
            if body.mode == 'desktop':
                return recorder.start(local_origin(request), title=body.title, mode='desktop', recording_context=body.recording_context)
            return recorder.start(local_origin(request), title=body.title, url=body.url, recording_context=body.recording_context)

    @api.post("/recorder/recover")
    def recorder_recover(request: Request):
        with recorder.lock:
            return recorder.start(local_origin(request), recover=True)

    @api.post("/recorder/{action}")
    def recorder_command(action: str):
        if action not in ("pause", "resume", "stop", "retry"):
            raise HTTPException(404)
        return recorder.command(action)

    @api.post("/workflows", status_code=201)
    def create_workflow(body: WorkflowCreate):
        with recorder.lock:
            workflow_id = str(uuid4())
            with database.connect(write=True) as db:
                timestamp = now()
                db.execute("INSERT INTO workflows(id,title,recording_context,created_at,updated_at) VALUES(?,?,?,?,?)",
                           (workflow_id, body.title, body.recording_context, timestamp, timestamp))
                return detail(db, workflow_id)

    @api.get("/workflows")
    def workflows():
        with database.connect() as db:
            rows = db.execute("""SELECT w.*, COUNT(s.id) AS step_count,
                COALESCE(SUM(s.reviewed),0) AS reviewed_count
                FROM workflows w LEFT JOIN steps s ON s.workflow_id=w.id
                GROUP BY w.id ORDER BY w.updated_at DESC""").fetchall()
            results = []
            for row in rows:
                item = dict(row)
                cover = db.execute("""SELECT id,payload FROM steps WHERE workflow_id=?
                    AND COALESCE(json_extract(payload,'$.sensitive'),0)=0
                    AND (json_extract(payload,'$.after.filename') IS NOT NULL
                         OR json_extract(payload,'$.before.filename') IS NOT NULL)
                    ORDER BY sequence LIMIT 1""", (row['id'],)).fetchone()
                item['preview'] = None
                if cover:
                    payload = json.loads(cover['payload'])
                    phase = 'after' if payload.get('after', {}).get('filename') else 'before'
                    item['preview'] = {'step_id': cover['id'], 'phase': phase}
                results.append(item)
            return results

    @api.get("/workflows/{workflow_id}")
    def workflow(workflow_id: str):
        with database.connect() as db:
            return detail(db, workflow_id)

    @api.patch("/workflows/{workflow_id}")
    def edit_workflow(workflow_id: str, body: WorkflowEdit):
        with database.connect(write=True) as db:
            current = get_workflow(db, workflow_id)
            require_stopped(current)
            check_version(current, body.version)
            purpose = body.purpose if 'purpose' in body.model_fields_set else current['purpose']
            scope = body.scope if 'scope' in body.model_fields_set else current['scope']
            prerequisites = body.prerequisites if 'prerequisites' in body.model_fields_set else current['prerequisites']
            recording_context = body.recording_context if "recording_context" in body.model_fields_set else current["recording_context"]
            db.execute("UPDATE workflows SET title=?,description=?,purpose=?,scope=?,prerequisites=?,recording_context=? WHERE id=?",
                       (body.title, body.description, purpose, scope, prerequisites, recording_context, workflow_id))
            touch(db, workflow_id)
            return detail(db, workflow_id)

    @api.post("/workflows/{workflow_id}/stop")
    def stop(workflow_id: str):
        with step_merge.created_images() as created, database.connect(write=True) as db:
            current = get_workflow(db, workflow_id)
            if current["status"] == "recording":
                # Input batches and messages from different tabs may arrive out of order.
                ordered = sorted(get_steps(db, workflow_id), key=lambda s: (datetime.fromisoformat(s["occurred_at"]).timestamp(), s["sequence"]))
                db.execute("UPDATE steps SET sequence=-sequence WHERE workflow_id=?", (workflow_id,))
                for index, step in enumerate(ordered, 1):
                    db.execute("UPDATE steps SET sequence=? WHERE id=?", (index, step["id"]))
                step_merge.auto_merge(db, settings, workflow_id, created)
                db.execute("UPDATE workflows SET status='draft' WHERE id=?", (workflow_id,))
                touch(db, workflow_id)
            return detail(db, workflow_id)

    @api.post("/workflows/{workflow_id}/steps", status_code=201)
    def add_step(workflow_id: str, body: StepCreate):
        step_id = str(body.id)
        with database.connect(write=True) as db:
            current = get_workflow(db, workflow_id)
            existing = db.execute("SELECT workflow_id FROM steps WHERE id=?", (step_id,)).fetchone()
            if not existing:
                existing = db.execute("SELECT workflow_id FROM step_merge_originals WHERE id=?", (step_id,)).fetchone()
            if existing:
                if existing["workflow_id"] != workflow_id:
                    raise HTTPException(409, "Step ID belongs to a different workflow")
                return {"id": step_id, "duplicate": True}
            if current["status"] != "recording":
                raise HTTPException(409, "This recording has already stopped")
            if db.execute("SELECT id FROM steps WHERE workflow_id=? AND sequence=?", (workflow_id, body.sequence)).fetchone():
                raise HTTPException(409, "Another step already uses this sequence number")
            payload = body.model_dump(mode="json", exclude={"before", "after"})
            payload["url"] = safe_url(body.url)
            if payload.get("text_capture") in ("protected", "unavailable"):
                payload["sensitive"] = True
            if payload["sensitive"]:
                payload["value"] = ""
                payload["desktop_target"] = None
                payload["desktop_field_id"] = None
                payload["input_group_id"] = None
                payload["browser_target"] = None
                payload["selector"] = "[private]"
                payload["label"] = "the private field"
            # Validate both before committing a DB row. Clean any partial images on failure.
            try:
                for phase in ("before", "after"):
                    payload[phase] = save_snapshot(settings.data_dir, step_id, phase, getattr(body, phase))
                db.execute("INSERT INTO steps(id,workflow_id,sequence,description,payload) VALUES(?,?,?,?,?)",
                           (step_id, workflow_id, body.sequence, cleaner.fallback_text(payload), json.dumps(payload)))
                touch(db, workflow_id)
            except Exception:
                for phase in ("before", "after"):
                    (settings.data_dir / "screenshots" / f"{step_id}-{phase}.jpg").unlink(missing_ok=True)
                raise
            return {"id": step_id, "duplicate": False}

    @api.patch("/workflows/{workflow_id}/steps/{step_id}")
    def edit_step(workflow_id: str, step_id: str, body: StepEdit):
        with database.connect(write=True) as db:
            current = get_workflow(db, workflow_id)
            require_stopped(current)
            check_version(current, body.version)
            row = db.execute("SELECT * FROM steps WHERE id=? AND workflow_id=?", (step_id, workflow_id)).fetchone()
            if not row:
                raise HTTPException(404, "Step not found")
            edited = bool(row["edited"]) or body.description != row["description"]
            db.execute("UPDATE steps SET description=?,reviewed=?,edited=? WHERE id=?",
                       (body.description, body.reviewed, edited, step_id))
            touch(db, workflow_id)
            return detail(db, workflow_id)

    @api.delete("/workflows/{workflow_id}/steps/{step_id}")
    def delete_step(workflow_id: str, step_id: str, version: int = Query()):
        with database.connect(write=True) as db:
            current = get_workflow(db, workflow_id)
            require_stopped(current)
            check_version(current, version)
            row = db.execute("SELECT payload FROM steps WHERE id=? AND workflow_id=?", (step_id, workflow_id)).fetchone()
            if not row:
                raise HTTPException(404, "Step not found")
            originals = [r['id'] for r in db.execute('SELECT id FROM step_merge_originals WHERE workflow_id=? AND merged_step_id=?', (workflow_id, step_id))]
            paths = step_merge.image_paths(settings, [step_id, *originals])
            for path in paths:
                path.unlink(missing_ok=True)
            db.execute("DELETE FROM steps WHERE id=?", (step_id,))
            touch(db, workflow_id)
            result = detail(db, workflow_id)
        return result

    @api.post("/workflows/{workflow_id}/reorder")
    def reorder(workflow_id: str, body: Reorder):
        with database.connect(write=True) as db:
            current = get_workflow(db, workflow_id)
            require_stopped(current)
            check_version(current, body.version)
            ids = [s["id"] for s in get_steps(db, workflow_id)]
            if len(body.step_ids) != len(ids) or set(body.step_ids) != set(ids):
                raise HTTPException(422, "Include each step exactly once")
            db.execute("UPDATE steps SET sequence=-sequence,reviewed=0 WHERE workflow_id=?", (workflow_id,))
            for index, step_id in enumerate(body.step_ids, 1):
                db.execute("UPDATE steps SET sequence=? WHERE id=?", (index, step_id))
            touch(db, workflow_id)
            return detail(db, workflow_id)

    def improve_instructions(workflow_id, body, step_id=None, include_edited_and_verified=False):
        with database.connect() as db:
            current = detail(db, workflow_id)
        require_stopped(current)
        check_version(current, body.version)
        if step_id is not None:
            candidates = [s for s in current['steps'] if s['id'] == step_id]
            if not candidates:
                raise HTTPException(404, 'Step not found.')
        else:
            candidates = [s for s in current['steps']
                          if include_edited_and_verified or (not s['reviewed'] and not s['edited'])]
        if not candidates:
            return {"mode": "unchanged", "message": "No untouched steps need cleanup.", "workflow": current}
        if not settings.api_key:
            return {"mode": "fallback", "message": "OpenAI is not configured. Your recorded instructions are ready to edit manually.", "workflow": current}
        try:
            cleaned = []
            for offset in range(0, len(candidates), 40):
                cleaned.extend(cleaner.clean_steps(settings, candidates[offset:offset + 40], current["recording_context"]))
        except Exception as error:
            failure = cleaner.cleanup_failure(error)
            # Log only our fixed category, never exception bodies, prompts or keys.
            logging.getLogger(__name__).warning('OpenAI cleanup failed: %s', failure['reason'])
            return {"mode": "fallback", **failure, "workflow": current}
        with database.connect(write=True) as db:
            latest = get_workflow(db, workflow_id)
            require_stopped(latest)
            check_version(latest, current["version"])
            for step in cleaned:
                db.execute("UPDATE steps SET description=?,reviewed=0 WHERE id=? AND workflow_id=?",
                           (step.description.strip(), step.id, workflow_id))
            touch(db, workflow_id)
            count = len(cleaned)
            message = f"{count} {'step' if count == 1 else 'steps'} improved. Review and verify before exporting."
            return {"mode": "openai", "message": message, "workflow": detail(db, workflow_id)}

    @api.post('/workflows/{workflow_id}/clean')
    def clean(workflow_id: str, body: CleanRequest):
        return improve_instructions(workflow_id, body, include_edited_and_verified=body.include_edited_and_verified)

    @api.post('/workflows/{workflow_id}/steps/{step_id}/clean')
    def clean_one(workflow_id: str, step_id: str, body: Revision):
        return improve_instructions(workflow_id, body, step_id=step_id)

    @api.get("/workflows/{workflow_id}/steps/{step_id}/screenshots/{phase}")
    def screenshot(workflow_id: str, step_id: str, phase: str, annotated: bool = False):
        if phase not in ("before", "after"):
            raise HTTPException(404)
        with database.connect() as db:
            row = db.execute("SELECT payload FROM steps WHERE id=? AND workflow_id=?", (step_id, workflow_id)).fetchone()
        if not row:
            raise HTTPException(404)
        filename = json.loads(row["payload"])[phase].get("filename")
        if not filename or not (settings.data_dir / "screenshots" / filename).is_file():
            raise HTTPException(404, "Screenshot unavailable")
        if annotated:
            from .annotations import annotated_screenshot
            from fastapi.responses import Response
            rendered = annotated_screenshot(settings.data_dir / 'screenshots' / filename, json.loads(row['payload']), phase)
            if rendered:
                return Response(rendered.getvalue(), media_type='image/png', headers={'Cache-Control': 'no-store'})
        return FileResponse(settings.data_dir / "screenshots" / filename, media_type="image/jpeg", headers={"Cache-Control": "no-store"})

    @api.get("/workflows/{workflow_id}/export/{kind}")
    def export(workflow_id: str, kind: str):
        if kind not in ("pdf", "docx"):
            raise HTTPException(404)
        with database.connect() as db:
            current = detail(db, workflow_id)
        require_stopped(current)
        if not current["steps"] or not all(s["reviewed"] for s in current["steps"]):
            raise HTTPException(409, "Review every step before exporting your SOP.")
        data = generate_pdf(current, settings.data_dir) if kind == "pdf" else generate_docx(current, settings.data_dir)
        media = "application/pdf" if kind == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return Response(data, media_type=media, headers={"Content-Disposition": export_disposition(current["title"], kind), "Cache-Control": "no-store"})

    step_merge.register_merge_routes(api, settings, database, detail, require_stopped, check_version, touch)
    register_narration_routes(api, settings, database, detail, require_stopped, check_version, touch)
    register_vision_routes(api, settings, database, detail, require_stopped, check_version, touch)
    register_workflow_vision_routes(api, settings, database, detail, require_stopped, check_version, touch)
    register_delete_route(api, settings, database, recorder, get_workflow, require_stopped, check_version)
    app.include_router(api)
    frontend = PROJECT / "frontend" / "dist"
    if frontend.exists():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="dashboard")
    return app
