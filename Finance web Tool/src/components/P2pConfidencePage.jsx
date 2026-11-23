import { useMemo } from "react";

import {
  buildP2pConfidenceWorkbookView,
  formatP2pConfidenceValue,
} from "../config/p2pConfidence";
import { MetricCard, SectionCard, StatusPill } from "./TowerWorkspacePrimitives";

function bandTone(value) {
  if (value === "HIGH") {
    return "success";
  }

  if (value === "MEDIUM") {
    return "warning";
  }

  return "danger";
}

function scoreTone(value) {
  const numeric = Number(value);
  if (numeric >= 0.75) {
    return "success";
  }

  if (numeric >= 0.55) {
    return "warning";
  }

  return "danger";
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

export default function P2pConfidencePage({
  currentDeal,
  p2pWorkspace,
}) {
  const workbookView = useMemo(
    () => buildP2pConfidenceWorkbookView({ currentDeal, workspace: p2pWorkspace }),
    [currentDeal, p2pWorkspace],
  );

  const recommendedTone = bandTone(workbookView.recommendedSummary.confidenceBand);
  const lastSummaryRow = workbookView.summaryRows[workbookView.summaryRows.length - 1];

  return (
    <div className="fpa-form-stack">
      <div className="metric-grid fpa-confidence-metric-grid">
        <MetricCard
          label="Recommended Persona"
          value={workbookView.recommendedSummary.label}
          note={`Auto from 20 Recommend | Persona ${workbookView.recommendedSummary.index}`}
        />
        <MetricCard
          label="Confidence Score"
          value={workbookView.recommendedSummary.confidenceScoreText}
          note={`${workbookView.recommendedSummary.confidenceBand} band`}
        />
        <MetricCard
          label="Sizing Confidence"
          value={workbookView.weightedSizingConfidenceText}
          note={workbookView.recommendedSummary.methodMixText}
        />
        <MetricCard
          label="Recommended Price Range"
          value={workbookView.recommendedSummary.priceRangeText}
          note={`FTE range ${workbookView.recommendedSummary.fteRangeText}`}
        />
      </div>

      <SectionCard
        badge="Workbook A"
        title="Per-L2 Sizing Confidence"
        note={workbookView.note}
        meta={(
          <div className="overview-pills">
            <StatusPill tone={scoreTone(workbookView.weightedSizingConfidence)}>
              Weighted {workbookView.weightedSizingConfidenceText}
            </StatusPill>
            <StatusPill tone="info">{workbookView.sizingRows.length} L2 rows</StatusPill>
          </div>
        )}
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-confidence-table fpa-confidence-process-table">
            <colgroup>
              <col style={{ width: "72px" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "88px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "100px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>L2 Process</th>
                <th>Method</th>
                <th className="is-number">Method base</th>
                <th className="is-number">Coverage adj</th>
                <th className="is-number">Variance penalty</th>
                <th className="is-number">L2 confidence</th>
                <th className="is-number">Hours / mo</th>
                <th className="is-number">Weight</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.sizingRows.map((row) => (
                <tr key={row.confidenceRow}>
                  <td>
                    <span className="section-chip">{row.confidenceRow}</span>
                  </td>
                  <td className="fpa-confidence-wrap-cell">{row.label}</td>
                  <td>
                    <strong>{row.methodLetter}</strong>
                  </td>
                  <td className="is-number">{formatP2pConfidenceValue(row.methodBase, "decimal3")}</td>
                  <td className="is-number">{formatP2pConfidenceValue(row.coverageAdjustment, "decimal3")}</td>
                  <td className="is-number">{formatP2pConfidenceValue(row.variancePenalty, "decimal3")}</td>
                  <td className="is-number">{formatP2pConfidenceValue(row.l2Confidence, "decimal3")}</td>
                  <td className="is-number">{formatP2pConfidenceValue(row.hoursPerMonth, "number1")}</td>
                  <td className="is-number">{formatP2pConfidenceValue(row.weight, "percent2")}</td>
                </tr>
              ))}
              <tr className="fpa-confidence-total-row">
                <td>
                  <span className="section-chip">{workbookView.weightedSizingRowNumber}</span>
                </td>
                <td><strong>WEIGHTED SIZING CONFIDENCE</strong></td>
                <td colSpan={4} />
                <td className="is-number"><strong>{workbookView.weightedSizingConfidenceText}</strong></td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook B"
        title="Persona Confidence Score"
        note="Persona score = 40% sizing + 25% AI benefit + 20% commercial + 15% validation."
        meta={<StatusPill tone="info">{workbookView.personaHeaders.length} persona columns</StatusPill>}
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-confidence-table fpa-confidence-persona-table">
            <colgroup>
              <col style={{ width: "72px" }} />
              <col style={{ width: "24%" }} />
              {workbookView.personaHeaders.map((persona) => (
                <col key={persona.key} style={{ width: "12%" }} />
              ))}
              <col style={{ width: "92px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Component</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th key={persona.key}>{persona.label}</th>
                ))}
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.personaRows.map((row) => (
                <tr key={row.rowNumber} className={row.isTotal ? "fpa-confidence-total-row" : ""}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td><strong>{row.label}</strong></td>
                  {row.values.map((value) => (
                    <td key={`${row.rowNumber}-${value.key}`} className={row.format === "band" ? "fpa-confidence-band-cell" : "is-number"}>
                      {row.format === "band" ? (
                        <StatusPill tone={bandTone(value.text)}>{value.text}</StatusPill>
                      ) : (
                        <span>{value.text}</span>
                      )}
                    </td>
                  ))}
                  <td className="is-number">{row.weightText || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook C"
        title="Recommended-Persona Confidence Summary"
        note="This section resolves the auto-recommended persona from tab 20 into confidence, range, and sizing posture."
        meta={<StatusPill tone={recommendedTone}>{workbookView.recommendedSummary.confidenceBand}</StatusPill>}
      >
        <div className="review-grid">
          <article className="review-panel review-panel-wide">
            <h4>{`Workbook rows ${workbookView.summaryRows[0].rowNumber}-${lastSummaryRow.rowNumber}`}</h4>
            <SummaryList
              rows={workbookView.summaryRows.map((row) => ({
                label: `${row.rowNumber} | ${row.label}`,
                value: row.text,
              }))}
            />
          </article>
          <article className="review-panel">
            <h4>Recommendation context</h4>
            <p className="section-note fpa-confidence-rationale">{workbookView.recommendationRationale}</p>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
