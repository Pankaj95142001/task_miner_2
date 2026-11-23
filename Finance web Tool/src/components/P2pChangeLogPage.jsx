import { useMemo } from "react";

import {
  buildP2pChangeLogWorkbookView,
} from "../config/p2pChangeLog";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "../config/p2pWorkspace";

const CHANGE_LOG_FIELD_DEFS = [
  { label: "Last Reviewer", name: "lastReviewer", type: "text", placeholder: "Reviewer name" },
  { label: "Last Decision", name: "lastDecision", type: "text", placeholder: "Working draft / Approved / Hold" },
  { label: "Latest Change Summary", name: "latestChangeSummary", type: "textarea", placeholder: "Summarize what changed in this save." },
  { label: "Version Note", name: "versionNote", type: "textarea", placeholder: "Capture the baseline or release note carried into this deal." },
];

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, note, tone = "neutral" }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className={`metric-note is-${tone}`}>{note}</span>
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

function trimValue(value) {
  return String(value ?? "").trim();
}

function actionTone(value) {
  const token = trimValue(value).toUpperCase();
  if (["CONFIRMED", "LOCKED"].includes(token)) {
    return "success";
  }
  if (token === "EVIDENCE ATTACHED") {
    return "info";
  }
  if (token === "OPEN") {
    return "warning";
  }
  return "neutral";
}

function decisionTone(value) {
  const token = trimValue(value).toLowerCase();
  if (!token) {
    return "neutral";
  }
  if (["approved", "complete", "completed", "signed off", "sign-off", "ready"].some((word) => token.includes(word))) {
    return "success";
  }
  if (["blocked", "hold", "rejected", "issue"].some((word) => token.includes(word))) {
    return "danger";
  }
  if (["working", "draft", "review", "pending"].some((word) => token.includes(word))) {
    return "warning";
  }
  return "info";
}

function ChangeLogField({ field, value, disabled, onChange }) {
  if (field.type === "textarea") {
    return (
      <label className="field-block field-block-full fpa-change-log-textarea-field">
        <span>{field.label}</span>
        <textarea
          value={value}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      </label>
    );
  }

  return (
    <label className="field-block">
      <span>{field.label}</span>
      <input
        type={field.type}
        value={value}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(event) => onChange(field.name, event.target.value)}
      />
    </label>
  );
}

export default function P2pChangeLogPage({
  currentDeal,
  p2pWorkspace,
  currentUserName = "",
  canEditP2p,
  isBusy,
  onUpdateWorkspace,
}) {
  const workspace = normalizeP2pWorkspace(p2pWorkspace || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());

  const workbookView = useMemo(
    () => buildP2pChangeLogWorkbookView({ currentDeal, workspace }),
    [currentDeal, workspace],
  );

  function updateChangeLogField(name, value) {
    if (!canEditP2p || typeof onUpdateWorkspace !== "function") {
      return;
    }

    const nextWorkspace = normalizeP2pWorkspace(workspace);
    nextWorkspace.changeLog[name] = value;

    if (name === "lastReviewer" && !trimValue(value) && trimValue(currentUserName)) {
      nextWorkspace.changeLog[name] = currentUserName;
    }

    onUpdateWorkspace(nextWorkspace);
  }

  return (
    <div className="fpa-form-stack">
      <div className="metric-grid fpa-change-log-metric-grid">
        <MetricCard
          label="Framework Version"
          value={workbookView.latestWorkbookVersion}
          note="Workbook row 8 | latest framework release"
          tone="info"
        />
        <MetricCard
          label="Open Actions"
          value={`${workbookView.openActionOpenCount}/${workbookView.openActionRows.length}`}
          note={`${workbookView.openActionEvidenceCount} evidence-attached | ${workbookView.openActionConfirmedCount} confirmed`}
          tone={workbookView.openActionOpenCount > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Linked Register"
          value={workbookView.linkedRegisterMode}
          note="Actions mirror calibration register 26 D"
          tone="info"
        />
        <MetricCard
          label="Latest Decision"
          value={workbookView.latestSavedDecision}
          note={workbookView.lastUpdatedText}
          tone={decisionTone(workbookView.latestSavedDecision)}
        />
      </div>

      <SectionCard
        badge="Workbook A"
        title="Framework release history"
        note="Rows 5-8 stay fixed as the tower-framework release trail. This section is intentionally static so reviewers can distinguish product evolution from deal-specific changes."
        meta={<StatusPill tone="info">{`${workbookView.versionHistoryRows.length} releases`}</StatusPill>}
      >
        <div className="review-grid">
          <article className="review-panel">
            <h4>Latest framework release</h4>
            <SummaryList
              rows={[
                { label: "Version", value: workbookView.latestWorkbookVersion },
                { label: "Area", value: workbookView.versionHistoryRows.at(-1)?.area || "P2P" },
                { label: "Owner", value: workbookView.versionHistoryRows.at(-1)?.owner || "SA" },
              ]}
            />
          </article>
          <article className="review-panel review-panel-wide">
            <h4>Why this matters</h4>
            <p className="section-note">
              This section preserves the workbook-level product history. It should not be edited per deal; deal-specific commentary belongs in the save layer below.
            </p>
          </article>
        </div>

        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-change-log-table">
            <colgroup>
              <col style={{ width: "72px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "38%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "90px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Version</th>
                <th>Date</th>
                <th>Area</th>
                <th>Change</th>
                <th>Impact</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.versionHistoryRows.map((row) => (
                <tr key={row.rowNumber} className={row.rowNumber === 8 ? "fpa-change-log-current-framework-row" : ""}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td><strong>{row.version}</strong></td>
                  <td>{row.date}</td>
                  <td>{row.area}</td>
                  <td className="fpa-change-log-wrap-cell">{row.change}</td>
                  <td className="fpa-change-log-wrap-cell">{row.impact}</td>
                  <td>{row.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <SectionCard
        badge="Workbook B"
        title="Open calibration actions"
        note="Rows 12-17 are implemented as a live mirror of the calibration closure register so this page reflects the current open-action posture instead of a stale snapshot."
        meta={(
          <div className="overview-pills">
            <StatusPill tone="info">{workbookView.linkedRegisterMode}</StatusPill>
            <StatusPill tone={workbookView.openActionOpenCount > 0 ? "warning" : "success"}>{`${workbookView.openActionOpenCount} open`}</StatusPill>
          </div>
        )}
      >
        <div className="review-grid fpa-change-log-review-grid">
          <article className="review-panel">
            <h4>Action status summary</h4>
            <SummaryList
              rows={[
                { label: "Open", value: String(workbookView.openActionOpenCount) },
                { label: "Evidence attached", value: String(workbookView.openActionEvidenceCount) },
                { label: "Confirmed / locked", value: String(workbookView.openActionConfirmedCount) },
              ]}
            />
          </article>
          <article className="review-panel review-panel-wide">
            <h4>Why this is mirrored</h4>
            <p className="section-note">
              The workbook labels rows 12-17 as a mirror of calibration actions. The portal therefore resolves these rows from tab 26 current register entries so status, owner, and due date stay aligned.
            </p>
          </article>
        </div>

        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-change-log-table">
            <colgroup>
              <col style={{ width: "72px" }} />
              <col style={{ width: "42%" }} />
              <col style={{ width: "80px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "130px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Action</th>
                <th>Tab</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.openActionRows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td className="fpa-change-log-wrap-cell">
                    <strong>{row.action}</strong>
                    <div className="field-hint">{row.linkedRowText}</div>
                  </td>
                  <td>{row.tab}</td>
                  <td className="fpa-change-log-status-cell">
                    <StatusPill tone={actionTone(row.status)}>{row.status}</StatusPill>
                  </td>
                  <td className="fpa-change-log-wrap-cell">{row.owner}</td>
                  <td>{row.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Portal Save Layer"
        title="Latest portal decision trail"
        note="These fields are saved into the deal workspace JSON so the latest review note and decision remain visible even though workbook rows 5-8 are fixed framework history."
        meta={<StatusPill tone={decisionTone(workbookView.latestSavedDecision)}>{workbookView.latestSavedDecision}</StatusPill>}
      >
        <div className="review-grid">
          <article className="review-panel">
            <h4>Current save context</h4>
            <SummaryList
              rows={[
                { label: "Deal version", value: String(workbookView.workspaceVersion) },
                { label: "Last updated", value: workbookView.lastUpdatedText },
                { label: "Default reviewer", value: workbookView.latestReviewer },
              ]}
            />
          </article>
          <article className="review-panel">
            <h4>Guidance</h4>
            <p className="section-note">Use this block for the deal-specific review note, latest decision, and save summary. It complements the workbook release history rather than replacing it.</p>
          </article>
        </div>

        <div className="field-grid field-grid-4 fpa-change-log-form-grid">
          {CHANGE_LOG_FIELD_DEFS.map((field) => (
            <ChangeLogField
              key={field.name}
              field={field}
              value={workspace.changeLog[field.name]}
              disabled={!canEditP2p || isBusy}
              onChange={updateChangeLogField}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        badge="Saved History"
        title="Current workspace traceability"
        note="This lightweight history keeps the latest saved workspace state and its baseline visible for reviewers."
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-change-log-table">
            <colgroup>
              <col style={{ width: "150px" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "42%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Summary</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.savedHistoryRows.map((row, index) => (
                <tr key={row.key} className={index === 0 ? "fpa-change-log-current-framework-row" : ""}>
                  <td>{row.whenText}</td>
                  <td>{row.actor}</td>
                  <td className="fpa-change-log-wrap-cell">{row.summary}</td>
                  <td>{row.decision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
