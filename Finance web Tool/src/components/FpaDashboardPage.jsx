import { useMemo } from "react";

import {
  buildFpaDashboardWorkbookView,
  FPA_DASHBOARD_SNAPSHOT,
} from "../config/fpaDashboard";

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
  if (normalized.startsWith("GREEN") || normalized.startsWith("OK") || normalized === "READY" || normalized === "YES" || normalized === "CONSTRUCTS OK") {
    return "success";
  }
  if (normalized.startsWith("NO") || normalized.startsWith("NOT APPLICABLE")) {
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
                key={`dashboard-head-${persona.key}`}
                className={persona.key === highlightPersonaKey ? "is-highlight" : ""}
              >
                {persona.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`dashboard-row-${row.key}`}>
              <td className="fpa-cost-label-cell">
                <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
              </td>
              {row.values.map((cell) => (
                <td
                  key={`dashboard-cell-${row.key}-${cell.key}`}
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
            <tr key={`dashboard-fact-${row.rowNumber}-${row.label}`}>
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

function WaterfallTable({ rows }) {
  return (
    <div className="fpa-table-wrap fpa-cost-table-wrap">
      <table className="fpa-table fpa-cost-table fpa-dashboard-waterfall-table">
        <thead>
          <tr>
            <th>Step</th>
            <th>Base</th>
            <th>Fall</th>
            <th>Rise</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`dashboard-waterfall-${row.key}`}>
              <td className="fpa-cost-label-cell">
                <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
              </td>
              <td className="fpa-cost-value-cell">{row.baseText}</td>
              <td className="fpa-cost-value-cell">{row.fallText}</td>
              <td className="fpa-cost-value-cell">{row.riseText}</td>
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
            <tr key={`dashboard-logic-${row.id}`}>
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

export default function FpaDashboardPage({ currentDeal }) {
  const workbookView = useMemo(
    () => buildFpaDashboardWorkbookView({ currentDeal }),
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
            <span className="step-badge">Workbook Dashboard</span>
            <h4>{FPA_DASHBOARD_SNAPSHOT.title}</h4>
            <p className="section-note">{FPA_DASHBOARD_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={statusTone(workbookView.uploadReadiness.text)}>{workbookView.uploadReadiness.text}</StatusPill>
            <StatusPill tone="info">Recommended {workbookView.recommendedPersona?.label || "Standard"}</StatusPill>
            <span className="section-chip">{FPA_DASHBOARD_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-deal-risk-rationale">
          <span className="section-kicker">Workbook row 3</span>
          <strong>{workbookView.contextLine}</strong>
        </div>

        <div className="fpa-dashboard-context-grid">
          {workbookView.overviewFacts.map((fact) => (
            <article key={`dashboard-overview-${fact.label}`} className="fpa-dashboard-context-item">
              <span>{fact.label}</span>
              <strong>{fact.text}</strong>
              <small>Workbook row {fact.rowNumber}</small>
            </article>
          ))}
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 8-10"
        title="Recommendation summary"
        note="The dashboard follows the recommended persona from tab 20, then rolls its commercial and risk posture into the cockpit surface."
      >
        <div className="fpa-cost-kpi-grid">
          <MetricCard label="Recommended" value={workbookView.recommendedPersona?.label || "-"} note="Workbook row 9" />
          <MetricCard label="Runner-up" value={workbookView.runnerUpPersona?.label || "-"} note="Workbook row 9" />
          <MetricCard label="Risk verdict" value={workbookView.recommendation.riskVerdict} note="Workbook row 9" />
          <MetricCard label="Review items" value={String(workbookView.uploadReadiness.reviewCount)} note="Logic row 40" />
          <MetricCard label="RED blocks" value={String(workbookView.uploadReadiness.redCount)} note="Logic row 40" />
        </div>

        <div className="fpa-deal-risk-rationale fpa-dashboard-rationale">
          <span className="section-kicker">Workbook row 10</span>
          <strong>{workbookView.recommendation.rationale}</strong>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 12-23"
        title="Persona comparison"
        note="This matrix compares all five persona outcomes exactly like the Excel dashboard before one recommendation is selected."
      >
        <PersonaMatrixTable
          rows={workbookView.personaComparisonRows}
          personaHeaders={workbookView.personaHeaders}
          highlightPersonaKey={workbookView.recommendedPersona?.key}
        />
      </SectionCard>

      <div className="fpa-dashboard-split-grid">
        <SectionCard
          badge="Workbook Rows 26-34"
          title="Key assumptions — recommended persona"
          note="These rows pull the live AI, persona, and business-case assumptions for the recommended delivery archetype."
        >
          <FactTable rows={workbookView.assumptionRows} />
        </SectionCard>

        <SectionCard
          badge="Workbook Rows 36-40"
          title="Commercial tiles and scenario GM"
          note="The commercial snapshot combines recommended-case economics with base, best, and downside gross-margin scenarios."
        >
          <div className="fpa-cost-kpi-grid fpa-dashboard-tile-grid">
            {workbookView.commercialTiles.map((tile) => (
              <MetricCard
                key={`dashboard-tile-${tile.label}`}
                label={tile.label}
                value={tile.text}
                note={`Workbook row ${tile.rowNumber}`}
              />
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        badge="Workbook Rows 43-49"
        title="Margin waterfall — recommended, Y1 run-rate"
        note="The same workbook bridge is shown here with Base/Fall/Rise columns so revenue, delivery labor, other CTS, and GM stay traceable."
      >
        <WaterfallTable rows={workbookView.waterfallRows} />
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 55-76"
        title="Commercial and calibration matrix"
        note="This section combines pricing, recommendation ranking, calibration closure, AI/FTE movement, transition charges, and term economics by persona."
      >
        <PersonaMatrixTable
          rows={workbookView.matrixRows}
          personaHeaders={workbookView.personaHeaders}
          highlightPersonaKey={workbookView.recommendedPersona?.key}
          className="fpa-dashboard-matrix-table"
        />
      </SectionCard>

      <div className="fpa-dashboard-split-grid">
        <SectionCard
          badge="Workbook Logic Rows 26-40"
          title="Upload readiness gates"
          note="These are the same gates the workbook uses to decide whether the tower model is ready for cockpit consumption."
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
          badge="Workbook Rows 79-100"
          title="Reconciliation, technology, and readiness strip"
          note="The strip rolls up the final operational and client-facing readiness signals that sit under the dashboard in Excel."
        >
          <div className="fpa-dashboard-readiness-grid">
            {readinessColumns.map((columnRows, index) => (
              <FactTable key={`dashboard-readiness-col-${index + 1}`} rows={columnRows} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
