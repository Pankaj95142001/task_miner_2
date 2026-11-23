import { useMemo } from "react";

import {
  buildP2pDealRisksWorkbookView,
  formatP2pDealRiskValue,
  P2P_DEAL_RISKS_SNAPSHOT,
} from "../config/p2pDealRisks";

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
  if (normalized === "GREEN") {
    return "success";
  }
  return "neutral";
}

export default function P2pDealRisksPage({ currentDeal }) {
  const workbookView = useMemo(
    () => buildP2pDealRisksWorkbookView({ currentDeal }),
    [currentDeal],
  );

  return (
    <div className="fpa-form-stack fpa-cost-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local Deal Risks</span>
            <h4>{P2P_DEAL_RISKS_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_DEAL_RISKS_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone={riskTone(workbookView.dealRiskVerdict)}>{workbookView.dealRiskVerdict} verdict</StatusPill>
            <span className="section-chip">{P2P_DEAL_RISKS_SNAPSHOT.ruleCount} contextual checks</span>
            <span className="section-chip">{P2P_DEAL_RISKS_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Persona Under Review"
            value={workbookView.selectedPersona?.label || "-"}
            note="Workbook row 5"
          />
          <MetricCard
            label="Persona Index"
            value={formatP2pDealRiskValue(workbookView.selectedPersonaIndex, "whole")}
            note="Workbook row 6"
          />
          <MetricCard
            label="Deal-Risk Verdict"
            value={workbookView.dealRiskVerdict}
            note="Workbook row 23"
          />
          <MetricCard
            label="AMBER Cautions"
            value={formatP2pDealRiskValue(workbookView.amberCount, "whole")}
            note="Workbook row 24"
          />
          <MetricCard
            label="Runner-Up Persona"
            value={workbookView.runnerUpPersona?.label || "-"}
            note="From local recommend scoring"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 5-11"
        title="Chosen persona context"
        note="The portal reviews the auto-selected persona, then frames the caution checks using discovery coverage, competition, digital maturity, and revenue band."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Adjusted score {formatP2pDealRiskValue(workbookView.selectedPersona?.adjustedScore, "score1")}</span>
            <span className="section-chip">Weighted fit {formatP2pDealRiskValue(workbookView.selectedPersona?.weightedFit / 100, "percent1")}</span>
            <span className="section-chip">Rank {formatP2pDealRiskValue(workbookView.selectedPersona?.rank, "whole")}</span>
          </div>
        }
      >
        <div className="fpa-cost-kpi-grid fpa-deal-risk-context-grid">
          {workbookView.contextRows.map((row) => (
            <MetricCard
              key={`deal-risk-context-${row.rowNumber}`}
              label={row.label}
              value={formatP2pDealRiskValue(row.value, row.format)}
              note={`Workbook row ${row.rowNumber}`}
            />
          ))}
        </div>

        <article className="fpa-deal-risk-rationale">
          <span className="metric-label">Recommend rationale</span>
          <strong>{workbookView.recommendationRationale}</strong>
          <div className="fpa-risk-card-meta">
            <span className="section-chip">Complexity {workbookView.context.complexityBand}</span>
            <span className="section-chip">Onshore {formatP2pDealRiskValue(workbookView.context.onshorePct, "percent1")}</span>
            <span className="section-chip">Nearshore {formatP2pDealRiskValue(workbookView.context.nearshorePct, "percent1")}</span>
            <span className="section-chip">Term {formatP2pDealRiskValue(workbookView.context.contractTermYears, "whole")}y</span>
          </div>
        </article>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 9-24"
        title="13 contextual deal-risk checks"
        note="These are bid-shaping cautions, not persona-disqualifying hard stops. The tab only checks the chosen persona here and pairs each caution with mitigation guidance."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Reconciliation {formatP2pDealRiskValue(workbookView.context.workloadRedVarianceCount, "whole")} RED variances</span>
            <span className="section-chip">Tie-out {workbookView.context.workloadTieOutMessage}</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-deal-risk-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Contextual Check</th>
                <th>Status</th>
                <th>Mitigation Guidance</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.ruleRows.map((row) => (
                <tr key={`deal-risk-rule-${row.id}`}>
                  <td className="fpa-risk-id-cell">
                    {row.id}
                    <span>Workbook row {row.rowNumber}</span>
                  </td>
                  <td className="fpa-risk-check-cell">
                    <strong>{row.label}</strong>
                  </td>
                  <td className="fpa-risk-status-cell">
                    <StatusPill tone={riskTone(row.status)}>{row.status}</StatusPill>
                  </td>
                  <td className="fpa-deal-risk-guidance-cell">{row.mitigation}</td>
                </tr>
              ))}

              <tr className="fpa-cost-total-row">
                <td className="fpa-risk-id-cell"> </td>
                <td className="fpa-risk-summary-label">
                  <strong>Deal-risk verdict</strong>
                  <span className="fpa-risk-summary-note">Workbook row 23</span>
                </td>
                <td className="fpa-risk-status-cell">
                  <StatusPill tone={riskTone(workbookView.dealRiskVerdict)}>{workbookView.dealRiskVerdict}</StatusPill>
                </td>
                <td className="fpa-deal-risk-guidance-cell">Roll-up across contextual checks 1-13.</td>
              </tr>

              <tr className="fpa-cost-total-row">
                <td className="fpa-risk-id-cell"> </td>
                <td className="fpa-risk-summary-label">
                  <strong>AMBER cautions (#)</strong>
                  <span className="fpa-risk-summary-note">Workbook row 24</span>
                </td>
                <td className="fpa-risk-status-cell">{formatP2pDealRiskValue(workbookView.amberCount, "whole")}</td>
                <td className="fpa-deal-risk-guidance-cell">Count of contextual cautions currently at AMBER.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
