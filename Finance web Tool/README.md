# E2E Finance Portal Starter

This repo now contains:

- a React frontend demo portal for Deal Master
- a separate FastAPI backend for shared deal persistence and simple email-based login

## Included

- `docs/workflow-diagrams.md` - complete user, extraction, tower, copilot, storage, and prototype workflows
- `docs/portal-roadmap.md` - planning roadmap from foundation through hardening
- `src/App.jsx` - Deal Master frontend workspace with login, deal grouping, and collaborator UX
- `src/api/deals.js` - frontend API client for auth and user-scoped backend requests
- `src/utils/dealMaster.js` - frontend deal helpers and starter draft scaffolding
- `src/styles.css` - portal, login, and collaboration styling
- `backend/pyproject.toml` - uv-managed backend dependencies
- `backend/app/main.py` - FastAPI app entrypoint
- `backend/app/api/auth.py` - login API route
- `backend/app/api/deals.py` - Deal Master API routes
- `backend/app/api/users.py` - user directory and workspace summary routes
- `backend/app/storage.py` - JSON-backed collaboration persistence layer
- `backend/data/deals.json` - live JSON deal store
- `backend/data/users.json` - live JSON user directory

## Frontend status

- login page with email-based sign-in
- all deals page grouped into `Assigned to You` and `Owned by You`
- Deal Master screen with create, save, duplicate, and export actions
- collaborator page with name, email, and tower capture
- role-aware read-only state for non-owner users
- logout flow and per-user deal visibility after login

## Backend status

- FastAPI scaffold in a separate backend folder
- JSON persistence in `backend/data/deals.json` and `backend/data/users.json`
- legacy import path from `backend/data/deals.db` when JSON is empty
- public login route at `POST /api/auth/login`
- user-scoped deal CRUD with `X-User-Id` context after login
- per-user current-deal memory and assigned-deal visibility
- CORS enabled for local Vite development

## Run frontend

1. Run `npm install`.
2. Run `npm run dev`.
3. Keep the backend running so `/api` requests can authenticate and save into the JSON store.

## Run backend with uv

1. Install `uv` on your machine if it is not already available.
2. Change directory to `backend`.
3. Run `uv sync`.
4. Run `uv run uvicorn app.main:app --reload --port 8000`.

## Main API routes

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

## Next recommended steps

1. Map collaborator records to tower-specific workspaces and editing rights.
2. Add row-level tower editing so assigned leads can work without editing the full Deal Master.
3. Add validation, readiness gates, and audit-friendly activity views.
4. Replace demo login with SSO or real identity once the flow stabilises.
