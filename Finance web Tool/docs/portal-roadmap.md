# E2E Finance Portal Roadmap

## Step -1 - Foundation and portal contract

- Confirm the workbook remains the functional oracle until signed-off changes exist.
- Freeze the first UI slice around `Deal Master` and compact portal structure.
- Keep the layout dense: `xs` text, tight cards, aligned fields, and no dead whitespace.
- Build a configuration-first shell so later tower modules do not become hard-coded.

## Step 0 - Portal shell

- Create the overall workspace layout.
- Add sidebar roadmap, saved deals, and compact top summary.
- Define a reusable dense form system and status badges.

## Step 1 - Deal Master

- Build the BRD-aligned Deal Master in React.
- Capture identity, finance, currency, constructs, policies, towers, and notes.
- Add local draft creation, autosave, duplicate, and export.

## Step 1.5 - Collaboration foundation

- Replace single-user draft handling with shared persistence and user context.
- Add deal owner, tower lead assignments, role-aware saved-deal lists, and per-user current-deal memory.
- Keep the Deal Master owner-controlled while tower workspaces are still pending.
- Preserve legacy `deals.json` import while moving the live store to SQLite.

## Step 2 - Tower workspaces

- Add `FP&A`, `RTR`, `O2C`, and `P2P` workspaces.
- Add Discovery, tech stack, coverage, and L3 scope switchboards.

## Step 3 - Calculation engine

- Add a shared engine with tower configuration.
- Implement sizing, complexity, AI, FTE, cost, pricing, and business case logic.

## Step 4 - Governance

- Add override lifecycle, evidence register, calibration closure, and readiness gates.
- Add approval invalidation on scoped changes.

## Step 5 - Outputs and dashboards

- Add tower dashboards, Finance rollup, recommendation, and client-safe views.
- Preserve the output label contract used by the workbook and cockpit.

## Step 6 - Import, export, and parity

- Add workbook import, parity report, Excel export, PDF export, and PPT export.
- Add golden dataset and regression harness.

## Step 7 - Hardening

- Add SSO, backend persistence, reference-data versioning, logs, and performance checks.

## Current delivery

- `Step -1` roadmap is documented.
- `Step 0` compact portal shell is live.
- `Step 1` compact Deal Master frontend is live.
- `Step 1.5` collaboration foundation is live with shared SQLite persistence and role-aware workspaces.
