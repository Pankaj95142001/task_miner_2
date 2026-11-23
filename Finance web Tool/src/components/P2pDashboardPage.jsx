import { useMemo } from "react";

import {
  buildP2pDashboardWorkbookView,
  P2P_DASHBOARD_SNAPSHOT,
} from "../config/p2pDashboard";

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, note }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {note ? <span className="metric-note">{note}</span> : null}
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

function RowLabel({ primary, secondary = "" }) {
  return (
    <div className="fpa-cost-row-label">
      <strong>{primary}</strong>
      {secondary ? <span>{secondary}</span> : null}
    </div>
  );
}

function statusTone(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized.startsWith("RED") || normalized.startsWith("NOT READY")) {
    return "danger";
  }
  if (normalized.startsWith("AMBER") || normalized.startsWith("REVIEW") || normalized.includes("READY WITH")) {
    return "warning";
  }
  if (normalized.startsWith("GREEN") || normalized.startsWith("OK") || normalized === "READY" || normalized === "YES" || normalized === "ALIGNED") {
    return "success";
  }
  if (normalized.startsWith("NO") || normalized.startsWith("BLIND") || normalized.startsWith("HYBRID")) {
    return "info";
  }
  return "neutral";
}

function renderValue(text, format = "text") {
  if (format === "status") {
    return <StatusPill tone={statusTone(text)}>{text}</StatusPill>;
  }

  return text;
}

function PersonaMatrixTable({ rows, personaHeaders, highlightPersonaKey, className = "" }) {
  return (
    <div className="fpa-table-wrap fpa-cost-table-wrap">
      <table className={["fpa-table", "fpa-cost-table", "fpa-cost-summary-table", className].filter(Boolean).join(" ")}>
        <thead>
          <tr>
            <th>Metric</th>
            {personaHeaders.map((persona) => (
              <th
                key={`p2p-dashboard-head-${persona.key}`}
                className={persona.key === highlightPersonaKey ? "is-highlight" : ""}
              >
                {persona.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`p2p-dashboard-row-${row.key}`}>
              <td className="fpa-cost-label-cell">
                <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
              </td>
              {row.values.map((cell) => (
                <td
                  key={`p2p-dashboard-cell-${row.key}-${cell.key}`}
                  className={[
                    "fpa-cost-value-cell",
                    row.format === "status" ? "fpa-dashboard-status-cell" : "",
                    cell.key === highlightPersonaKey ? "is-highlight" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {row.key === "rank"
                    ? `#${cell.text}`
                    : renderValue(cell.text, row.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactTable({ rows, className = "" }) {
  return (
    <div className="fpa-table-wrap fpa-cost-table-wrap">
      <table className={["fpa-table", "fpa-cost-table", "fpa-dashboard-fact-table", className].filter(Boolean).join(" ")}>
        <tbody>
          {rows.map((row) => (
            <tr key={`p2p-dashboard-fact-${row.rowNumber}-${row.label}`}>
              <td className="fpa-cost-label-cell">
                <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
              </td>
              <td className={["fpa-cost-value-cell", row.format === "status" ? "fpa-dashboard-status-cell" : ""].join(" ")}>
                {renderValue(row.text, row.format)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogicCheckTable({ rows }) {
  return (
    <div className="fpa-table-wrap fpa-cost-table-wrap">
      <table className="fpa-table fpa-cost-table fpa-dashboard-logic-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Check</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`p2p-dashboard-logic-${row.id}`}>
              <td className="fpa-dashboard-logic-id">{row.id}</td>
              <td className="fpa-cost-label-cell">
                <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
              </td>
              <td className="fpa-dashboard-status-cell">
                <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function P2pDashboardPage({ currentDeal }) {
  const workbookView = useMemo(
    () => buildP2pDashboardWorkbookView({ currentDeal }),
    [currentDeal],
  );

  const readinessMidpoint = Math.ceil(workbookView.readinessRows.length / 2);
  const readinessColumns = [
    workbookView.readinessRows.slice(0, readinessMidpoint),
    workbookView.readinessRows.slice(readinessMidpoint),
  ];

  return (
    <div className="fpa-form-stack fpa-cost-layout fpa-dashboard-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local Dashboard</span>
            <h4>{P2P_DASHBOARD_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_DASHBOARD_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone={statusTone(workbookView.uploadReadiness.text)}>{workbookView.uploadReadiness.text}</StatusPill>
            <span className="section-chip">{workbookView.personaHeaders.length} personas</span>
            <span className="section-chip">{P2P_DASHBOARD_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard label="Recommended" value={workbookView.recommendedPersona?.label || "-"} note="Workbook row 8" />
          <MetricCard label="Runner-up" value={workbookView.runnerUpPersona?.label || "-"} note="Workbook row 9" />
          <MetricCard label="Persona risk" value={workbookView.recommendation.riskVerdict} note="Workbook row 10" />
          <MetricCard label="Deal-risk verdict" value={workbookView.recommendation.dealRiskVerdict} note="Workbook row 11" />
          <MetricCard label="Review items" value={String(workbookView.uploadReadiness.reviewCount)} note="Workbook row 39" />
          <MetricCard label="RED blocks" value={String(workbookView.uploadReadiness.redCount)} note="Workbook row 39" />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 6-13"
        title="Tower context"
        note="Deal, discovery, and demand context rolled up for the P2P cockpit."
      >
        <div className="fpa-dashboard-context-grid">
          {workbookView.overviewFacts.map((fact) => (
            <article key={`p2p-dashboard-overview-${fact.label}`} className="fpa-dashboard-context-item">
              <span>{fact.label}</span>
              <strong>{renderValue(fact.text, fact.format)}</strong>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 12-21"
        title="Persona comparison"
        note="Compares recommendation score, risk posture, commercials, and business-case outcomes across all five P2P personas."
      >
        <PersonaMatrixTable
          rows={workbookView.personaComparisonRows}
          personaHeaders={workbookView.personaHeaders}
          highlightPersonaKey={workbookView.recommendedPersona?.key}
          className="fpa-dashboard-matrix-table"
        />
      </SectionCard>

      <div className="fpa-dashboard-split-grid">
        <SectionCard
          badge="Workbook Rows 26-35"
          title="Key assumptions - recommended persona"
          note="These assumptions explain what is driving the selected P2P answer right now."
        >
          <FactTable rows={workbookView.assumptionRows} />

          <div className="fpa-deal-risk-rationale fpa-dashboard-rationale">
            <span className="section-kicker">Client baseline note</span>
            <strong>{workbookView.notes.clientBaseline}</strong>
          </div>
        </SectionCard>

        <SectionCard
          badge="Workbook Rows 36-45"
          title="Commercial tiles and client value"
          note="Recommended-persona commercials, value, and business-case headline numbers."
        >
          <div className="fpa-cost-kpi-grid fpa-dashboard-tile-grid">
            {workbookView.commercialTiles.map((tile) => (
              <MetricCard
                key={`p2p-dashboard-tile-${tile.label}`}
                label={tile.label}
                value={tile.text}
                note={`Workbook row ${tile.rowNumber}`}
              />
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="fpa-dashboard-split-grid">
        <SectionCard
          badge="Workbook Rows 26-39"
          title="Upload readiness gates"
          note="These gates keep the cockpit honest before the deal is shared downstream."
          meta={
            <div className="fpa-tab-meta">
              <StatusPill tone={statusTone(workbookView.uploadReadiness.text)}>{workbookView.uploadReadiness.text}</StatusPill>
              <span className="section-chip">{workbookView.logicChecks.length} checks</span>
            </div>
          }
        >
          <LogicCheckTable rows={workbookView.logicChecks} />
        </SectionCard>

        <SectionCard
          badge="Workbook Rows 48-59"
          title="Operational and reconciliation strip"
          note="Final operational signals, outcome reconciliation, and baseline posture for the P2P tower."
        >
          <div className="fpa-dashboard-readiness-grid">
            {readinessColumns.map((columnRows, index) => (
              <FactTable key={`p2p-dashboard-readiness-col-${index + 1}`} rows={columnRows} />
            ))}
          </div>

          <div className="fpa-deal-risk-rationale fpa-dashboard-rationale">
            <span className="section-kicker">Outcome guardrail</span>
            <strong>{workbookView.notes.guardrail}</strong>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
