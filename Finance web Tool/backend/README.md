# FastAPI Backend

This backend is a separate FastAPI service for the Deal Master collaboration demo.

Document retrieval and extractor JSON imports are described in
[Document knowledge and finance copilot](../docs/document-knowledge.md).

## What it does

- exposes user-scoped Deal Master CRUD APIs
- stores live users, auth, preferences, deals, and copilot sessions in `backend/data/deal_master.sqlite3` by default
- keeps `backend/data/deals.json`, `backend/data/users.json`, and `backend/data/auth.json` only as legacy import sources
- can import legacy deal rows from `backend/data/deals.db` when the SQLite store is empty
- serves the React frontend through `/api` integration during local development
- tracks shared deal ownership, tower assignments, collaborator visibility, and per-user current-deal memory

## Local setup with uv

1. Install `uv` on your machine if it is not already available.
2. Change directory to `backend`.
3. Run `uv sync`.
4. Run `uv run uvicorn app.main:app --reload --port 8000`.
5. Run `uv run python ../scripts/migrate_live_store_to_sqlite.py` to force a one-time migration/import into SQLite if needed.

## Default URLs

- API base: `http://127.0.0.1:8000/api`
- Swagger docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

## Main endpoints

- `POST /api/auth/login`
- `GET /api/users`
- `GET /api/me`
- `GET /api/deals`
- `POST /api/deals`
- `GET /api/deals/{deal_id}`
- `PUT /api/deals/{deal_id}`
- `POST /api/deals/{deal_id}/duplicate`
- `POST /api/deals/current/{deal_id}`
- `DELETE /api/deals/{deal_id}`

## Notes

- Login is email-based for now through `POST /api/auth/login`.
- Use the returned user `id` in the `X-User-Id` header for deal-scoped requests.
- The seeded demo users include a bid owner, one lead per tower, and a reviewer.
- Collaborator emails saved on a deal are auto-added into the SQLite user store so they can sign in later.
- The Deal Master remains owner-editable in this phase; assigned tower users and collaborators have read-only visibility.
- CORS is enabled for the default Vite frontend origin `http://localhost:5173`.
- Dependencies are managed through `backend/pyproject.toml`.
