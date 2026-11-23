import { useEffect, useMemo, useState } from "react";

import { deriveP2pDiscoveryMetrics } from "../config/p2pDiscovery";
import { buildP2pTraceLogWorkbookView } from "../config/p2pTraceLog";
import {
  countCompletedP2pGovernanceChecks,
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
  P2P_APPROVAL_STAGE_OPTIONS,
} from "../config/p2pWorkspace";
import { MetricCard, SectionCard, StatusPill } from "./TowerWorkspacePrimitives";

const SHEET_NAME = "P2P_24 Governance";
const EDITABLE_CELL_ADDRESSES = ["F6", "G6", "G12", "G13", "G14", "G15"];

const WORKBOOK_DEFAULTS = {
  B6: "5.0",
  C6: "11-Sep-2026",
  D6: "Presales SA (AI-assisted)",
  E6: "E2E Finance Solution: P2P tower generated from the shared framework with tower-specific scope, workload, complexity, automation, ops model, and commercial outputs.",
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
    label: "2. Procure-to-Pay process SME — scope, drivers, and benchmark posture",
    statusAddress: "G13",
  },
  {
    rowNumber: 14,
    label: "3. Commercial / deal desk — rate card, floors, and pricing construct",
    statusAddress: "G14",
  },
  {
    rowNumber: 15,
    label: "4. Delivery head — personas, transition plan, and operating model",
    statusAddress: "G15",
  },
];

const LIMITATIONS = [
  { rowNumber: 18, text: "All benchmark-tagged and [PA] values are PLACEHOLDERS pending calibration (26 Calibration register)." },
  { rowNumber: 19, text: "No tax, treasury, or working-capital optimization benefit is included unless explicitly modeled with client evidence." },
  { rowNumber: 20, text: "Payment terms, discount capture, and DPO improvement are directional unless validated through client baselines." },
  { rowNumber: 21, text: "Outcome pricing assumes volumes remain within +/-10% of the modeled band; re-price outside that corridor." },
  { rowNumber: 22, text: "Transition is modeled at phase level rather than week-by-week migration planning." },
  { rowNumber: 23, text: "Fraud, leakage, and duplicate-payment recovery benefits are excluded unless separately scoped." },
  { rowNumber: 24, text: "Agent run-cost is a capacity proxy [PA]; replace with real platform-engineering costing when available." },
  { rowNumber: 25, text: "Supplier master-data quality assumptions may shift if the client baseline differs from discovery indications." },
  { rowNumber: 26, text: "Cross-tower dependencies stay sequenced at the E2E layer; P2P economics do not net shared platform costs." },
];

const REVIEW_POLICIES = [
  {
    rowNumber: 30,
    text: "Yellow/blue cells are the intended inputs; all other workbook content should remain controlled before circulation.",
  },
  {
    rowNumber: 31,
    text: "Rate card, benchmark, and operating-model assumptions should be refreshed before each external submission. Owner: SA practice lead.",
  },
];

const CONTROLS = [
  { rowNumber: 34, text: "Version control on scope, workload, and pricing assumptions" },
  { rowNumber: 35, text: "Supplier master-data and approval-matrix governance" },
  { rowNumber: 36, text: "PO policy, exception handling, and three-way-match control" },
  { rowNumber: 37, text: "Payment-run cadence and segregation-of-duty review" },
  { rowNumber: 38, text: "Access, workflow, and audit-trail control in P2P platforms" },
];

const PORTAL_GOVERNANCE_FIELDS = [
  { label: "Approval Stage", name: "approvalStage", type: "select", options: P2P_APPROVAL_STAGE_OPTIONS },
  { label: "Discovery Completeness %", name: "evidenceCoveragePct", type: "number", step: "1" },
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
    detail: "Tower economics and commercial posture have been reviewed by finance leadership.",
  },
  {
    name: "clientEvidenceValidated",
    label: "Client evidence validated",
    detail: "Discovery signals, proxy assumptions, and client facts have been reviewed for P2P use.",
  },
  {
    name: "benchmarkPackReady",
    label: "Benchmark pack ready",
    detail: "Benchmark references and commentary are ready for governance and deal review.",
  },
  {
    name: "calibrationComplete",
    label: "Calibration complete",
    detail: "Modeled workload, FTE, and economics have been calibrated against the current baseline.",
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

export default function P2pGovernancePage({
  currentDeal,
  p2pWorkspace,
  canEditP2p,
  isBusy,
  onUpdateCell,
  onUpdateWorkspace,
}) {
  const governanceInputs = currentDeal?.p2pWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.p2pWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.p2pWorkbookInputs[SHEET_NAME]
    : {};
  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(governanceInputs));
  const workspace = normalizeP2pWorkspace(p2pWorkspace || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());

  useEffect(() => {
    setDraftInputs(buildDraftInputs(governanceInputs));
  }, [currentDeal?.dealId, governanceInputs]);

  const mergedInputs = useMemo(
    () => ({ ...governanceInputs, ...draftInputs }),
    [draftInputs, governanceInputs],
  );

  const traceView = useMemo(
    () => buildP2pTraceLogWorkbookView({ currentDeal, workspace }),
    [currentDeal, workspace],
  );

  const discoveryMetrics = useMemo(() => deriveP2pDiscoveryMetrics(workspace), [workspace]);
  const approvedApprovalsCount = APPROVAL_ROWS.filter((row) => isApprovedStatus(readWorkbookCell(mergedInputs, row.statusAddress))).length;
  const statusCellValue = readWorkbookCell(mergedInputs, "G6");
  const statusCellTone = statusTone(statusCellValue);
  const discoverySignalsPct = Math.round((Number(discoveryMetrics.weightedCompleteness || 0)) * 100);
  const governanceChecksCompleted = countCompletedP2pGovernanceChecks(workspace);

  useEffect(() => {
    if (!canEditP2p || typeof onUpdateWorkspace !== "function") {
      return;
    }

    const nextOverrideCount = String(traceView.overridesPresentCount ?? 0);
    if (trimValue(workspace.governance.overrideCount) === nextOverrideCount) {
      return;
    }

    const nextWorkspace = normalizeP2pWorkspace(workspace);
    nextWorkspace.governance.overrideCount = nextOverrideCount;
    onUpdateWorkspace(nextWorkspace);
  }, [canEditP2p, onUpdateWorkspace, traceView.overridesPresentCount, workspace]);

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
    if (!canEditP2p || typeof onUpdateWorkspace !== "function") {
      return;
    }

    const nextWorkspace = normalizeP2pWorkspace(workspace);
    nextWorkspace.governance[name] = value;
    onUpdateWorkspace(nextWorkspace);
  }

  function updateGovernanceFlag(name, checked) {
    if (!canEditP2p || typeof onUpdateWorkspace !== "function") {
      return;
    }

    const nextWorkspace = normalizeP2pWorkspace(workspace);
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
          label="Discovery Signals"
          value={`${discoverySignalsPct}%`}
          note={`${discoveryMetrics.discoveryCount}/${discoveryMetrics.discoveryFieldCount} core inputs answered`}
        />
      </div>

      <SectionCard
        badge="Workbook A1"
        title="24. Model Governance — P2P tower"
        note="Workbook-style governance register: version control, approvals, limitations, and downstream review signals."
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
                    disabled={!canEditP2p || isBusy}
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
                    disabled={!canEditP2p || isBusy}
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
                          disabled={!canEditP2p || isBusy}
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
              <p className="section-kicker">P2P Controls Catalogue</p>
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
              The governance sheet is mostly narrative and manual. These saved portal fields feed later tabs like Confidence, Calibration, and Benchmark Pack.
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
                disabled={!canEditP2p || isBusy}
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
                  { label: "Discovery completeness", value: `${discoverySignalsPct}% weighted` },
                  { label: "Coverage answered", value: `${discoveryMetrics.coverageAnsweredCount}/${discoveryMetrics.coverageRows.length}` },
                  { label: "Detected overrides from 05/06", value: String(traceView.overridesPresentCount) },
                  { label: "Unlogged override gap", value: String(traceView.unloggedOverrideCount) },
                ]}
              />
            </article>

            <article className="review-panel review-panel-wide">
              <h4>Saved portal note</h4>
              <GovernanceField
                field={PORTAL_GOVERNANCE_FIELDS[3]}
                value={workspace.governance.changeNote}
                disabled={!canEditP2p || isBusy}
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
                disabled={!canEditP2p || isBusy}
                onChange={(checked) => updateGovernanceFlag(field.name, checked)}
              />
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
