import { useMemo } from "react";

import {
  buildFpaBenchmarkPackWorkbookView,
  formatBenchmarkPackValue,
} from "../config/fpaBenchmarkPack";

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

function coverageTone(value) {
  const numeric = Number(value);
  if (numeric >= 0.75) {
    return "success";
  }
  if (numeric >= 0.5) {
    return "warning";
  }
  return "danger";
}

function rangeTone(value) {
  if (value === "GREEN") {
    return "success";
  }
  if (value === "AMBER") {
    return "warning";
  }
  return "neutral";
}

function sourceTone(sourceMissing) {
  return sourceMissing ? "warning" : "success";
}

function positionTone(value) {
  if (value === "Within IQR") {
    return "success";
  }
  if (String(value || "").startsWith("Above")) {
    return "warning";
  }
  if (String(value || "").startsWith("Below")) {
    return "info";
  }
  return "neutral";
}

function SourceCell({ source, sourceMissing }) {
  if (sourceMissing) {
    return <StatusPill tone="warning">confirm &amp; cite</StatusPill>;
  }

  return <span className="fpa-benchmark-pack-source-text">{source}</span>;
}

export default function FpaBenchmarkPackPage({
  currentDeal,
  fpaWorkspace,
}) {
  const workbookView = useMemo(
    () => buildFpaBenchmarkPackWorkbookView({ currentDeal, workspace: fpaWorkspace }),
    [currentDeal, fpaWorkspace],
  );

  const sectionARowCount = workbookView.sectionARows.length;
  const kpiRowCount = workbookView.kpiRows.length;
  const rangeEvidenceCoverage = sectionARowCount
    ? workbookView.rangesWithCitedEvidenceCount / sectionARowCount
    : 0;
  const kpiEvidenceCoverage = kpiRowCount
    ? workbookView.kpiCitedEvidenceCount / kpiRowCount
    : 0;
  const selectedIndustryPosition = workbookView.selectedIndustryRow?.clientPosition || "Awaiting industry mapping";

  return (
    <div className="fpa-form-stack">
      <div className="metric-grid fpa-benchmark-pack-metric-grid">
        <MetricCard
          label="Recommended Persona"
          value={workbookView.recommendedPersona.label}
          note={`Tab 20 selection | Persona ${workbookView.recommendedPersona.index}`}
          tone="info"
        />
        <MetricCard
          label="Ranges Corroborated"
          value={`${workbookView.corroboratedCount}/${sectionARowCount}`}
          note={formatBenchmarkPackValue(workbookView.rangesCorroboratedPct, "percent0")}
          tone={coverageTone(workbookView.rangesCorroboratedPct)}
        />
        <MetricCard
          label="Range Evidence"
          value={`${workbookView.rangesWithCitedEvidenceCount}/${sectionARowCount}`}
          note="Rows 6-19 with attached source"
          tone={coverageTone(rangeEvidenceCoverage)}
        />
        <MetricCard
          label="KPI Evidence"
          value={`${workbookView.kpiCitedEvidenceCount}/${kpiRowCount}`}
          note={workbookView.selectedIndustry || "Industry default applied"}
          tone={coverageTone(kpiEvidenceCoverage)}
        />
      </div>

      <SectionCard
        badge="Workbook A"
        title="Tagged range corroboration"
        note={workbookView.note}
        meta={(
          <div className="overview-pills">
            <StatusPill tone={positionTone(selectedIndustryPosition)}>{selectedIndustryPosition}</StatusPill>
            <StatusPill tone="info">{sectionARowCount} benchmark checks</StatusPill>
          </div>
        )}
      >
        <div className="review-grid fpa-benchmark-pack-review-grid">
          <article className="review-panel">
            <h4>Current client context</h4>
            <SummaryList
              rows={[
                { label: "Industry", value: workbookView.selectedIndustry || "-" },
                { label: "Client FP&A FTE / $1B", value: workbookView.clientOrgFtePerRevenueBText },
                { label: "Industry position", value: selectedIndustryPosition },
              ]}
            />
          </article>

          <article className="review-panel review-panel-wide">
            <h4>Workbook parity</h4>
            <p className="section-note">
              Rows 6-19 compare live portal outputs against the Excel low/high ranges. Source lookup follows the workbook order:
              tower key first (`;FPA|27|n;`), then fallback to shared (`;ALL|27|n;`).
            </p>
          </article>
        </div>

        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-benchmark-pack-table">
            <colgroup>
              <col style={{ width: "72px" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "22%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Metric</th>
                <th>Tag</th>
                <th className="is-number">Low</th>
                <th className="is-number">Model</th>
                <th className="is-number">High</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.sectionARows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td className="fpa-benchmark-pack-wrap-cell">
                    <strong>{row.label}</strong>
                    <div className="field-hint">{row.unit}</div>
                  </td>
                  <td>{row.tag}</td>
                  <td className="is-number">{row.lowText}</td>
                  <td className="is-number"><strong>{row.modelValueText}</strong></td>
                  <td className="is-number">{row.highText}</td>
                  <td className="fpa-benchmark-pack-status-cell">
                    <StatusPill tone={rangeTone(row.withinRange)}>{row.withinRange}</StatusPill>
                  </td>
                  <td className="fpa-benchmark-pack-wrap-cell fpa-benchmark-pack-source-cell">
                    <SourceCell source={row.source} sourceMissing={row.sourceMissing} />
                  </td>
                </tr>
              ))}
              <tr className="fpa-benchmark-pack-total-row">
                <td>
                  <span className="section-chip">20</span>
                </td>
                <td><strong>Ranges corroborated</strong></td>
                <td colSpan={2} />
                <td className="is-number"><strong>{formatBenchmarkPackValue(workbookView.rangesCorroboratedPct, "percent0")}</strong></td>
                <td colSpan={3}>{`${workbookView.corroboratedCount}/${sectionARowCount} rows within range`}</td>
              </tr>
              <tr className="fpa-benchmark-pack-total-row">
                <td>
                  <span className="section-chip">21</span>
                </td>
                <td><strong>Ranges with cited evidence (#)</strong></td>
                <td colSpan={2} />
                <td className="is-number"><strong>{formatBenchmarkPackValue(workbookView.rangesWithCitedEvidenceCount, "whole")}</strong></td>
                <td colSpan={3}>Section A source coverage</td>
              </tr>
              <tr className="fpa-benchmark-pack-total-row">
                <td>
                  <span className="section-chip">22</span>
                </td>
                <td><strong>KPI rows with cited evidence (#) / KPI rows</strong></td>
                <td colSpan={2} />
                <td className="is-number"><strong>{`${workbookView.kpiCitedEvidenceCount}/${kpiRowCount}`}</strong></td>
                <td colSpan={3}>Section C source coverage</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook B"
        title="Industry FP&A FTE per $1B - quartiles [BM]"
        note="Rows 25-32 anchor the client organisation against the industry P25 / P50 / P75 benchmark spread. Only the resolved industry carries the client effective value."
        meta={<StatusPill tone="info">8 industries</StatusPill>}
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-benchmark-pack-table">
            <colgroup>
              <col style={{ width: "72px" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "22%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Industry</th>
                <th className="is-number">P25</th>
                <th className="is-number">P50</th>
                <th className="is-number">P75</th>
                <th className="is-number">Client org</th>
                <th>Client position</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.industryRows.map((row) => {
                const isSelectedIndustry = row.label === workbookView.selectedIndustry;
                return (
                  <tr key={row.rowNumber} className={isSelectedIndustry ? "fpa-benchmark-pack-selected-row" : ""}>
                    <td>
                      <span className="section-chip">{row.rowNumber}</span>
                    </td>
                    <td><strong>{row.label}</strong></td>
                    <td className="is-number">{row.p25Text}</td>
                    <td className="is-number">{row.p50Text}</td>
                    <td className="is-number">{row.p75Text}</td>
                    <td className="is-number">{row.clientOrgEffectiveText || "-"}</td>
                    <td className="fpa-benchmark-pack-status-cell">
                      {row.clientPosition ? <StatusPill tone={positionTone(row.clientPosition)}>{row.clientPosition}</StatusPill> : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook C"
        title="FP&A KPI benchmarks - current vs target"
        note="Rows 37-43 preserve the workbook benchmark targets. KPI source lookup uses the first-token evidence key pattern from the Excel sheet."
        meta={(
          <div className="overview-pills">
            <StatusPill tone={coverageTone(kpiEvidenceCoverage)}>{`${workbookView.kpiCitedEvidenceCount}/${kpiRowCount} sourced`}</StatusPill>
            <StatusPill tone="info">7 KPI rows</StatusPill>
          </div>
        )}
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-benchmark-pack-table">
            <colgroup>
              <col style={{ width: "72px" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>KPI</th>
                <th>Unit</th>
                <th className="is-number">Typical current</th>
                <th className="is-number">Top quartile</th>
                <th className="is-number">Target - Standard</th>
                <th className="is-number">Target - Aggressive AI-First</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.kpiRows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td className="fpa-benchmark-pack-wrap-cell"><strong>{row.label}</strong></td>
                  <td>{row.unit}</td>
                  <td className="is-number">{row.typicalCurrent}</td>
                  <td className="is-number">{row.topQuartile}</td>
                  <td className="is-number">{row.targetStandard}</td>
                  <td className="is-number">{row.targetAggressive}</td>
                  <td className="fpa-benchmark-pack-wrap-cell fpa-benchmark-pack-source-cell">
                    <SourceCell source={row.source} sourceMissing={row.sourceMissing} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook D"
        title="Supplemental benchmark notes"
        note="Rows 47-48 are static benchmark reminders from the workbook and stay narrative rather than calculated."
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-benchmark-pack-table">
            <colgroup>
              <col style={{ width: "72px" }} />
              <col style={{ width: "34%" }} />
              <col style={{ width: "180px" }} />
              <col style={{ width: "28%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Metric</th>
                <th>Benchmark range</th>
                <th>Source note</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.noteRows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td className="fpa-benchmark-pack-wrap-cell"><strong>{row.label}</strong></td>
                  <td>{row.benchmarkRange}</td>
                  <td className="fpa-benchmark-pack-wrap-cell">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
