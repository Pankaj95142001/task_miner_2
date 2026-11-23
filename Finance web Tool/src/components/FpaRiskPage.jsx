import { useMemo } from "react";

import {
  buildFpaRiskWorkbookView,
  FPA_RISK_SNAPSHOT,
  formatRiskValue,
} from "../config/fpaRisk";

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

function riskTone(value) {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "RED") {
    return "danger";
  }
  if (normalized === "AMBER") {
    return "warning";
  }
  if (normalized === "GREEN" || normalized === "OK") {
    return "success";
  }
  if (normalized === "CHECK") {
    return "info";
  }
  return "neutral";
}

function severityTone(value) {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "RED") {
    return "danger";
  }
  if (normalized === "AMBER") {
    return "warning";
  }
  if (normalized.includes("RED") && normalized.includes("AMBER")) {
    return "info";
  }
  return "neutral";
}

export default function FpaRiskPage({ currentDeal }) {
  const workbookView = useMemo(
    () => buildFpaRiskWorkbookView({ currentDeal }),
    [currentDeal],
  );

  return (
    <div className="fpa-form-stack fpa-cost-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Risk</span>
            <h4>{FPA_RISK_SNAPSHOT.title}</h4>
            <p className="section-note">{FPA_RISK_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone={riskTone(workbookView.recommendedPersona?.verdict)}>
              Auto persona {workbookView.recommendedPersona?.label || "Standard"}: {workbookView.recommendedPersona?.verdict || "GREEN"}
            </StatusPill>
            <span className="section-chip">{FPA_RISK_SNAPSHOT.ruleCount} checks</span>
            <span className="section-chip">{FPA_RISK_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Commercial GM Floor"
            value={formatRiskValue(workbookView.commercialGmFloorPct, "percent1")}
            note="Used by R1 and R17"
          />
          <MetricCard
            label="Complexity Band"
            value={workbookView.complexityBand}
            note="Used by R10"
          />
          <MetricCard
            label="Discovery Coverage"
            value={workbookView.discoveryCoverageLabel}
            note="Used by R11"
          />
          <MetricCard
            label="Weighted Completeness"
            value={workbookView.weightedCompletenessLabel}
            note="Used by R13"
          />
          <MetricCard
            label="Open Override Gaps"
            value={formatRiskValue(workbookView.governanceOverrideIssueCount, "whole")}
            note="R19 = workload + complexity rationale gaps"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 28-30"
        title="Persona validation verdicts"
        note="These cards surface the same RED count, AMBER count, and final verdict that the workbook rolls up at the bottom of the validation matrix."
      >
        <div className="fpa-cost-persona-grid">
          {workbookView.personaVerdicts.map((persona) => (
            <article
              key={`risk-verdict-${persona.key}`}
              className={[
                "fpa-cost-persona-card",
                "fpa-risk-verdict-card",
                workbookView.recommendedPersona?.key === persona.key ? "is-recommended" : "",
              ].filter(Boolean).join(" ")}
            >
              <div className="fpa-cost-persona-card-top">
                <strong>{persona.label}</strong>
                <StatusPill tone={riskTone(persona.verdict)}>{persona.verdict}</StatusPill>
              </div>
              <div className="fpa-cost-persona-card-value">{persona.openCheckCount} open checks</div>
              <div className="fpa-risk-card-meta">
                <span className="section-chip">{persona.redCount} RED</span>
                <span className="section-chip">{persona.amberCount} AMBER</span>
                {workbookView.recommendedPersona?.key === persona.key ? <span className="section-chip">Auto persona</span> : null}
              </div>
              <span className="fpa-cost-persona-card-note">Workbook rows 28-30</span>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 6-30"
        title="20 hard-stop and sign-off checks"
        note="The portal mirrors the workbook matrix: each check is evaluated for all five personas, then the workbook-style RED, AMBER, and VERDICT rows are rolled up underneath."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Language coverage {workbookView.languageCoverage}</span>
            <span className="section-chip">Workload gaps {formatRiskValue(workbookView.workloadOverridesWithoutRationale, "whole")}</span>
            <span className="section-chip">Complexity gaps {formatRiskValue(workbookView.complexityOverridesWithoutRationale, "whole")}</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-risk-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Check</th>
                <th>Severity</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th key={`risk-head-${persona.key}`}>{persona.label}</th>
                ))}
                <th>Basis</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.ruleRows.map((row) => (
                <tr key={row.id}>
                  <td className="fpa-risk-id-cell">
                    {row.id}
                    <span>Workbook row {row.rowNumber}</span>
                  </td>
                  <td className="fpa-risk-check-cell">
                    <strong>{row.label}</strong>
                  </td>
                  <td className="fpa-risk-severity-cell">
                    <StatusPill tone={severityTone(row.severity)}>{row.severity}</StatusPill>
                  </td>
                  {row.values.map((cell) => (
                    <td key={`risk-cell-${row.id}-${cell.key}`} className="fpa-risk-status-cell">
                      <StatusPill tone={riskTone(cell.text)}>{cell.text}</StatusPill>
                    </td>
                  ))}
                  <td className="fpa-risk-basis-cell">{row.basis}</td>
                </tr>
              ))}

              {workbookView.summaryRows.map((row) => (
                <tr key={`risk-summary-${row.key}`} className="fpa-cost-total-row">
                  <td className="fpa-risk-id-cell"> </td>
                  <td className="fpa-risk-summary-label">
                    <strong>{row.label}</strong>
                    <span className="fpa-risk-summary-note">Workbook row {row.rowNumber}</span>
                  </td>
                  <td className="fpa-risk-severity-cell">—</td>
                  {row.values.map((cell) => (
                    <td key={`risk-summary-cell-${row.key}-${cell.key}`} className="fpa-risk-status-cell">
                      {row.format === "status"
                        ? <StatusPill tone={riskTone(cell.text)}>{cell.text}</StatusPill>
                        : cell.text}
                    </td>
                  ))}
                  <td className="fpa-risk-basis-cell">Summary</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
