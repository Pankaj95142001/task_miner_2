import { useEffect, useMemo, useState } from "react";

import { buildFpaTraceLogWorkbookView } from "../config/fpaTraceLog";
import {
  countCompletedFpaGovernanceChecks,
  createDefaultFpaWorkspace,
  FPA_APPROVAL_STAGE_OPTIONS,
  normalizeFpaWorkspace,
} from "../config/fpaWorkspace";

const SHEET_NAME = "FPA_24 Governance";
const EDITABLE_CELL_ADDRESSES = ["F6", "G6", "G12", "G13", "G14", "G15"];

const WORKBOOK_DEFAULTS = {
  B6: "5.0",
  C6: "11-Sep-2026",
  D6: "Presales SA (AI-assisted)",
  E6: "E2E Finance Solution: FP&A tower generated from the shared framework (v4 FP&A methodology) with tower-specific catalogue, drivers, addressability, tech stack and KPIs.",
  F6: "<pending>",
  G6: "DRAFT",
  G12: "<pending>",
  G13: "<pending>",
  G14: "<pending>",
  G15: "<pending>",
};

const APPROVAL_ROWS = [
  {
    rowNumber: 12,
    label: "1. Solution Architecture lead — engine logic",
    statusAddress: "G12",
  },
  {
    rowNumber: 13,
    label: "2. Financial Planning & Analysis process SME — L3 catalogue & driver norms",
    statusAddress: "G13",
  },
  {
    rowNumber: 14,
    label: "3. Commercial / deal desk — rate card, floors, constructs",
    statusAddress: "G14",
  },
  {
    rowNumber: 15,
    label: "4. Delivery head — personas, pyramids, transition template",
    statusAddress: "G15",
  },
];

const LIMITATIONS = [
  { rowNumber: 18, text: "All benchmark-tagged and [PA] values are PLACEHOLDERS pending calibration (26 Calibration register)." },
  { rowNumber: 19, text: "No tax, entity structuring, or FX hedging; engine is USD-first with display conversion only." },
  { rowNumber: 20, text: "GM excludes corporate SG&A unless the 01 overhead % is set." },
  { rowNumber: 21, text: "Outcome pricing assumes volumes within +/-10% deadband; re-price beyond." },
  { rowNumber: 22, text: "Transition modelled at phase level (not week-by-week Gantt)." },
  { rowNumber: 23, text: "SLA/service-credit exposure not modelled." },
  { rowNumber: 24, text: "Agent run-cost is a capacity proxy [PA]; replace with platform engineering costing." },
  { rowNumber: 25, text: "Client Value baseline is a proxy unless the customer shares actuals (watermark on 21)." },
  { rowNumber: 26, text: "Cross-tower dependencies are sequenced on the E2E layer; tower engines do not net shared platform costs." },
];

const REVIEW_POLICIES = [
  {
    rowNumber: 30,
    text: "Yellow/blue cells are the only intended inputs; all else formula. Apply sheet protection (no password) before circulation.",
  },
  {
    rowNumber: 31,
    text: "Rate card & wage tables: refresh quarterly. Benchmarks: refresh on licensed-data load. Owner: SA practice lead.",
  },
];

const CONTROLS = [
  { rowNumber: 34, text: "Version control on plans & forecasts" },
  { rowNumber: 35, text: "Driver & assumption governance (register, owners)" },
  { rowNumber: 36, text: "Board-pack review & sign-off" },
  { rowNumber: 37, text: "Hierarchy / master-data change control" },
  { rowNumber: 38, text: "Access & segregation in EPM" },
];

const PORTAL_GOVERNANCE_FIELDS = [
  { label: "Approval Stage", name: "approvalStage", type: "select", options: FPA_APPROVAL_STAGE_OPTIONS },
  { label: "Evidence Coverage %", name: "evidenceCoveragePct", type: "number", step: "1" },
  { label: "Benchmark Corroboration %", name: "benchmarkCorroborationPct", type: "number", step: "1" },
  { label: "Governance Notes", name: "changeNote", type: "textarea" },
];

const PORTAL_CHECK_FIELDS = [
  {
    name: "qaReviewComplete",
    label: "QA review complete",
    detail: "Sizing logic, assumptions, and workbook parity have been internally checked.",
  },
  {
    name: "financeLeadershipReview",
    label: "Finance leadership review",
    detail: "Tower economics and operating posture have been reviewed by finance leadership.",
  },
  {
    name: "clientEvidenceValidated",
    label: "Client evidence validated",
    detail: "Client data points, proxy assumptions, and discovery signals have been validated.",
  },
  {
    name: "benchmarkPackReady",
    label: "Benchmark pack ready",
    detail: "Peer benchmark references and commentary are ready for governance and client review.",
  },
  {
    name: "calibrationComplete",
    label: "Calibration complete",
    detail: "Modeled FTE and cost outputs have been calibrated against the current-state baseline.",
  },
];

function trimValue(value) {
  return String(value ?? "").trim();
}

function readWorkbookCell(inputs, address) {
  if (Object.prototype.hasOwnProperty.call(inputs, address)) {
    return String(inputs[address] ?? "");
  }

  return WORKBOOK_DEFAULTS[address] || "";
}

function buildDraftInputs(sheetInputs = {}) {
  return Object.fromEntries(EDITABLE_CELL_ADDRESSES.map((address) => [address, readWorkbookCell(sheetInputs, address)]));
}

function normalizeStatusToken(value) {
  return trimValue(value).toLowerCase().replace(/\s+/gu, " ");
}

function isApprovedStatus(value) {
  const token = normalizeStatusToken(value);

  if (!token) {
    return false;
  }

  return ["approved", "complete", "completed", "done", "sign-off", "signed off", "ready", "yes", "ok"].some((word) => token.includes(word));
}

function statusTone(value) {
  const token = normalizeStatusToken(value);

  if (!token) {
    return "neutral";
  }

  if (isApprovedStatus(token)) {
    return "success";
  }

  if (["blocked", "reject", "rejected", "hold", "issue"].some((word) => token.includes(word))) {
    return "danger";
  }

  if (["draft", "pending", "review", "working"].some((word) => token.includes(word))) {
    return "warning";
  }

  return "info";
}

function approvalTone(approvedCount, totalCount) {
  if (approvedCount >= totalCount) {
    return "success";
  }

  if (approvedCount > 0) {
    return "warning";
  }

  return "info";
}

function evidenceFilledCount(discoveryEvidence = {}) {
  return Object.values(discoveryEvidence || {}).filter((entry) => (
    [entry?.source, entry?.confidence, entry?.owner, entry?.date].some((value) => trimValue(value))
  )).length;
}

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, note }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

function SectionCard({ badge, title, note, meta = null, children, className = "" }) {
  return (
    <section className={["compact-card", "fpa-subpanel", className].filter(Boolean).join(" ")}>
      <div className="step-header">
        <div>
          <span className="step-badge">{badge}</span>
          <h4>{title}</h4>
          {note ? <p className="section-note">{note}</p> : null}
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}

function SummaryList({ rows }) {
  return (
    <div className="summary-list">
      {rows.map((row) => (
        <div key={row.label} className="summary-item">
          <span className="summary-label">{row.label}</span>
          <span className={`summary-value ${row.muted ? "is-muted" : ""}`}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function GovernanceField({ field, value, disabled, onChange }) {
  if (field.type === "select") {
    return (
      <label className="field-block">
        <span>{field.label}</span>
        <select value={value} disabled={disabled} onChange={(event) => onChange(field.name, event.target.value)}>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="field-block fpa-governance-textarea-field">
        <span>{field.label}</span>
        <textarea value={value} disabled={disabled} onChange={(event) => onChange(field.name, event.target.value)} />
      </label>
    );
  }

  return (
    <label className="field-block">
      <span>{field.label}</span>
      <input type={field.type} step={field.step} value={value} disabled={disabled} onChange={(event) => onChange(field.name, event.target.value)} />
    </label>
  );
}

function ToggleCardField({ label, detail, checked, onChange, disabled = false }) {
  return (
    <label className={`fpa-toggle-card ${checked ? "is-checked" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </label>
  );
}

export default function FpaGovernancePage({
  currentDeal,
  fpaWorkspace,
  canEditFpa,
  isBusy,
  onUpdateCell,
  onUpdateWorkspace,
}) {
  const governanceInputs = currentDeal?.fpaWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.fpaWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.fpaWorkbookInputs[SHEET_NAME]
    : {};
  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(governanceInputs));
  const workspace = normalizeFpaWorkspace(fpaWorkspace || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());

  useEffect(() => {
    setDraftInputs(buildDraftInputs(governanceInputs));
  }, [currentDeal?.dealId, governanceInputs]);

  const mergedInputs = useMemo(
    () => ({ ...governanceInputs, ...draftInputs }),
    [draftInputs, governanceInputs],
  );

  const traceView = useMemo(
    () => buildFpaTraceLogWorkbookView({ currentDeal, workspace }),
    [currentDeal, workspace],
  );

  const approvedApprovalsCount = APPROVAL_ROWS.filter((row) => isApprovedStatus(readWorkbookCell(mergedInputs, row.statusAddress))).length;
  const statusCellValue = readWorkbookCell(mergedInputs, "G6");
  const statusCellTone = statusTone(statusCellValue);
  const evidenceCount = evidenceFilledCount(workspace.discoveryEvidence);
  const evidenceTotal = Object.keys(workspace.discoveryEvidence || {}).length;
  const evidenceCoverageAutoPct = evidenceTotal ? Math.round((evidenceCount / evidenceTotal) * 100) : 0;
  const governanceChecksCompleted = countCompletedFpaGovernanceChecks(workspace);

  useEffect(() => {
    if (!canEditFpa || typeof onUpdateWorkspace !== "function") {
      return;
    }

    const nextOverrideCount = String(traceView.overridesPresentCount ?? 0);
    if (trimValue(workspace.governance.overrideCount) === nextOverrideCount) {
      return;
    }

    const nextWorkspace = normalizeFpaWorkspace(workspace);
    nextWorkspace.governance.overrideCount = nextOverrideCount;
    onUpdateWorkspace(nextWorkspace);
  }, [canEditFpa, onUpdateWorkspace, traceView.overridesPresentCount, workspace]);

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(address, value) {
    const nextValue = trimValue(value);

    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextValue,
    }));

    if (typeof onUpdateCell === "function") {
      onUpdateCell(SHEET_NAME, address, nextValue);
    }
  }

  function updateGovernanceField(name, value) {
    if (!canEditFpa || typeof onUpdateWorkspace !== "function") {
      return;
    }

    const nextWorkspace = normalizeFpaWorkspace(workspace);
    nextWorkspace.governance[name] = value;
    onUpdateWorkspace(nextWorkspace);
  }

  function updateGovernanceFlag(name, checked) {
    if (!canEditFpa || typeof onUpdateWorkspace !== "function") {
      return;
    }

    const nextWorkspace = normalizeFpaWorkspace(workspace);
    nextWorkspace.governance[name] = checked;
    onUpdateWorkspace(nextWorkspace);
  }

  return (
    <div className="fpa-form-stack">
      <div className="metric-grid fpa-governance-metric-grid">
        <MetricCard
          label="Workbook Status"
          value={statusCellValue}
          note="Cell G6 from the governance register"
        />
        <MetricCard
          label="Approvals Cleared"
          value={`${approvedApprovalsCount}/4`}
          note="Workbook rows 12-15"
        />
        <MetricCard
          label="Active Overrides"
          value={traceView.overridesPresentCount}
          note={`${traceView.rowsLoggedAbove} logged on 23 Trace Log`}
        />
        <MetricCard
          label="Evidence-backed Inputs"
          value={`${evidenceCoverageAutoPct}%`}
          note={`${evidenceCount}/${evidenceTotal || 0} discovery inputs carry evidence`}
        />
      </div>

      <SectionCard
        badge="Workbook A1"
        title="24. Model Governance — FP&A tower"
        note="Excel row-for-row governance register: version control, approvals, limitations, and review policy."
        meta={(
          <div className="overview-pills">
            <StatusPill tone={statusCellTone}>{statusCellValue}</StatusPill>
            <StatusPill tone={approvalTone(approvedApprovalsCount, APPROVAL_ROWS.length)}>{approvedApprovalsCount} of 4 approvals</StatusPill>
            <StatusPill tone="info">0 formulas on source sheet</StatusPill>
          </div>
        )}
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-governance-table">
            <colgroup>
              <col style={{ width: "11%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "37%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Version</th>
                <th>Date</th>
                <th>Author</th>
                <th>Change summary</th>
                <th>Approved by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{readWorkbookCell(mergedInputs, "B6")}</strong></td>
                <td>{readWorkbookCell(mergedInputs, "C6")}</td>
                <td>{readWorkbookCell(mergedInputs, "D6")}</td>
                <td className="fpa-governance-wrap-cell">{readWorkbookCell(mergedInputs, "E6")}</td>
                <td>
                  <input
                    className="fpa-governance-input"
                    type="text"
                    value={readWorkbookCell(mergedInputs, "F6")}
                    disabled={!canEditFpa || isBusy}
                    onChange={(event) => handleDraftChange("F6", event.target.value)}
                    onBlur={(event) => handleDraftCommit("F6", event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </td>
                <td>
                  <input
                    className={`fpa-governance-input is-${statusCellTone}`}
                    type="text"
                    value={statusCellValue}
                    disabled={!canEditFpa || isBusy}
                    onChange={(event) => handleDraftChange("G6", event.target.value)}
                    onBlur={(event) => handleDraftCommit("G6", event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook B"
        title="Approvals Required Before Client Use"
        note="Workbook rows 12-15 stay manual in Excel; the portal keeps the same four approval lines with editable status cells."
        meta={<StatusPill tone={approvalTone(approvedApprovalsCount, APPROVAL_ROWS.length)}>{approvedApprovalsCount}/4 cleared</StatusPill>}
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-governance-table fpa-governance-approval-table">
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "61%" }} />
              <col style={{ width: "30%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Approval gate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {APPROVAL_ROWS.map((row) => {
                const value = readWorkbookCell(mergedInputs, row.statusAddress);
                const tone = statusTone(value);

                return (
                  <tr key={row.rowNumber}>
                    <td>
                      <span className="section-chip">{row.rowNumber}</span>
                    </td>
                    <td className="fpa-governance-wrap-cell">{row.label}</td>
                    <td>
                      <div className="fpa-governance-status-cell">
                        <input
                          className={`fpa-governance-input is-${tone}`}
                          type="text"
                          value={value}
                          disabled={!canEditFpa || isBusy}
                          onChange={(event) => handleDraftChange(row.statusAddress, event.target.value)}
                          onBlur={(event) => handleDraftCommit(row.statusAddress, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                        />
                        <StatusPill tone={tone}>{value || "Blank"}</StatusPill>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="review-grid fpa-governance-static-grid">
        <SectionCard
          badge="Workbook C"
          title="Known Limitations"
          note="Static workbook notes preserved from rows 18-26."
        >
          <ul className="fpa-governance-note-list">
            {LIMITATIONS.map((item) => (
              <li key={item.rowNumber} className="fpa-governance-note-item">
                <span className="section-chip">{item.rowNumber}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          badge="Workbook D-E"
          title="Protection, review policy, and controls catalogue"
          note="Rows 30-38 are descriptive workbook controls rather than formulas or engines."
        >
          <div className="fpa-governance-policy-stack">
            <div>
              <p className="section-kicker">Protection & Review Policy</p>
              <ul className="fpa-governance-note-list is-tight">
                {REVIEW_POLICIES.map((item) => (
                  <li key={item.rowNumber} className="fpa-governance-note-item">
                    <span className="section-chip">{item.rowNumber}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="section-kicker">FP&A Controls Catalogue</p>
              <ol className="fpa-governance-control-list">
                {CONTROLS.map((item) => (
                  <li key={item.rowNumber} className="fpa-governance-control-item">
                    <span>{item.text}</span>
                    <span className="section-chip">{item.rowNumber}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </SectionCard>
      </div>

      <details className="compact-card fpa-subpanel fpa-governance-sync-shell">
        <summary>
          <div>
            <span className="step-badge">Portal Sync</span>
            <h4>Downstream review signals for tabs 25-27</h4>
            <p className="section-note">
              The Excel governance sheet is mostly narrative and manual. These saved portal fields feed later tabs like Confidence, Calibration, and Benchmark Pack.
            </p>
          </div>
          <div className="overview-pills">
            <StatusPill tone={governanceChecksCompleted >= 3 ? "success" : "info"}>{governanceChecksCompleted}/5 gates</StatusPill>
            <StatusPill tone="info">Override count auto-syncs</StatusPill>
          </div>
        </summary>

        <div className="fpa-governance-sync-body">
          <div className="field-grid field-grid-4">
            {PORTAL_GOVERNANCE_FIELDS.slice(0, 3).map((field) => (
              <GovernanceField
                key={field.name}
                field={field}
                value={workspace.governance[field.name]}
                disabled={!canEditFpa || isBusy}
                onChange={updateGovernanceField}
              />
            ))}

            <label className="field-block">
              <span>Override Count</span>
              <input type="number" value={traceView.overridesPresentCount} disabled />
            </label>
          </div>

          <div className="review-grid">
            <article className="review-panel">
              <h4>Auto signals</h4>
              <SummaryList
                rows={[
                  { label: "Evidence-backed discovery inputs", value: `${evidenceCount}/${evidenceTotal || 0} (${evidenceCoverageAutoPct}%)` },
                  { label: "Detected overrides from 05/06", value: String(traceView.overridesPresentCount) },
                  { label: "Logged overrides on 23", value: String(traceView.rowsLoggedAbove) },
                  { label: "Unlogged override gap", value: String(traceView.unloggedOverrideCount) },
                ]}
              />
            </article>

            <article className="review-panel review-panel-wide">
              <h4>Saved portal note</h4>
              <GovernanceField
                field={PORTAL_GOVERNANCE_FIELDS[3]}
                value={workspace.governance.changeNote}
                disabled={!canEditFpa || isBusy}
                onChange={updateGovernanceField}
              />
            </article>
          </div>

          <div className="fpa-toggle-grid">
            {PORTAL_CHECK_FIELDS.map((field) => (
              <ToggleCardField
                key={field.name}
                label={field.label}
                detail={field.detail}
                checked={Boolean(workspace.governance[field.name])}
                disabled={!canEditFpa || isBusy}
                onChange={(checked) => updateGovernanceFlag(field.name, checked)}
              />
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

