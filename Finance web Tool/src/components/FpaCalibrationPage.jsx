import { useMemo } from "react";

import {
  buildFpaCalibrationWorkbookView,
  formatCalibrationValue,
} from "../config/fpaCalibration";

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

function classificationTone(value) {
  if (value === "Defendable") {
    return "success";
  }

  if (value === "AGGRESSIVE") {
    return "danger";
  }

  return "warning";
}

function verdictTone(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized.startsWith("GREEN")) {
    return "success";
  }
  if (normalized.startsWith("AMBER")) {
    return "warning";
  }
  if (normalized.startsWith("RED")) {
    return "danger";
  }
  return "neutral";
}

function corroborationBandTone(value) {
  if (value === "STRONG") {
    return "success";
  }
  if (value === "MODERATE") {
    return "warning";
  }
  return "danger";
}

function registerStatusTone(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "CONFIRMED" || normalized === "LOCKED") {
    return "success";
  }
  if (normalized === "EVIDENCE ATTACHED") {
    return "info";
  }
  if (normalized === "OPEN") {
    return "warning";
  }
  return "neutral";
}

function PersonaHeaderCell({ persona, recommendedKey }) {
  const isRecommended = persona.key === recommendedKey;
  return (
    <th className={isRecommended ? "fpa-calibration-recommended-col" : ""}>
      <div className="fpa-calibration-persona-head">
        <span>{persona.label}</span>
        {isRecommended ? <StatusPill tone="info">Recommended</StatusPill> : null}
      </div>
    </th>
  );
}

export default function FpaCalibrationPage({
  currentDeal,
  fpaWorkspace,
}) {
  const workbookView = useMemo(
    () => buildFpaCalibrationWorkbookView({ currentDeal, workspace: fpaWorkspace }),
    [currentDeal, fpaWorkspace],
  );

  const recommendedKey = workbookView.recommendedSummary.key;
  const recommendedVerdictTone = verdictTone(workbookView.recommendedSummary.verdict);
  const recommendedBandTone = corroborationBandTone(workbookView.recommendedSummary.corroborationBand);

  return (
    <div className="fpa-form-stack">
      <div className="metric-grid fpa-calibration-metric-grid">
        <MetricCard
          label="Recommended Persona"
          value={workbookView.recommendedSummary.label}
          note={`Tab 20 selection | Persona ${workbookView.recommendedSummary.index}`}
          tone="info"
        />
        <MetricCard
          label="Calibration Verdict"
          value={workbookView.recommendedSummary.verdict}
          note={`${workbookView.recommendedSummary.aggressiveCount} aggressive flags`}
          tone={recommendedVerdictTone}
        />
        <MetricCard
          label="Benchmark Corroboration"
          value={workbookView.recommendedSummary.corroborationScoreText}
          note={`${workbookView.recommendedSummary.corroborationBand} band`}
          tone={recommendedBandTone}
        />
        <MetricCard
          label="Calibration Register"
          value={workbookView.registerSummaryText}
          note={workbookView.registerSourceMode}
          tone="info"
        />
      </div>

      <SectionCard
        badge="Workbook A"
        title="Lever Values (from 07 Personas)"
        note="Rows 6-17 pull the exact persona lever values and compare them against defendable low/high ranges."
        meta={<StatusPill tone="info">{workbookView.leverRows.length} levers</StatusPill>}
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-calibration-table fpa-calibration-lever-table">
            <colgroup>
              <col style={{ width: "68px" }} />
              <col style={{ width: "25%" }} />
              {workbookView.personaHeaders.map((persona) => (
                <col key={persona.key} style={{ width: "9.6%" }} />
              ))}
              <col style={{ width: "8.5%" }} />
              <col style={{ width: "8.5%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Lever</th>
                {workbookView.personaHeaders.map((persona) => (
                  <PersonaHeaderCell key={persona.key} persona={persona} recommendedKey={recommendedKey} />
                ))}
                <th className="is-number">Range low</th>
                <th className="is-number">Range high</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.leverRows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td className="fpa-calibration-wrap-cell">{row.label}</td>
                  {row.values.map((cell) => (
                    <td key={`${row.key}-${cell.key}`} className="is-number">{cell.text}</td>
                  ))}
                  <td className="is-number">{row.rangeLowText}</td>
                  <td className="is-number">{row.rangeHighText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook B"
        title="Lever Classification"
        note="Rows 21-37 classify each persona lever as Defendable, AGGRESSIVE, or Over-conservative and roll that into the calibration verdict."
        meta={
          <div className="overview-pills">
            <StatusPill tone={recommendedVerdictTone}>{workbookView.recommendedSummary.verdict}</StatusPill>
            <StatusPill tone="info">12 rows</StatusPill>
          </div>
        }
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-calibration-table fpa-calibration-status-table">
            <colgroup>
              <col style={{ width: "68px" }} />
              <col style={{ width: "29%" }} />
              {workbookView.personaHeaders.map((persona) => (
                <col key={persona.key} style={{ width: "12.2%" }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Lever</th>
                {workbookView.personaHeaders.map((persona) => (
                  <PersonaHeaderCell key={persona.key} persona={persona} recommendedKey={recommendedKey} />
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.classificationRows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td className="fpa-calibration-wrap-cell">{row.label}</td>
                  {row.values.map((cell) => (
                    <td key={`${row.key}-${cell.key}`} className="fpa-calibration-status-cell">
                      <StatusPill tone={classificationTone(cell.text)}>{cell.text}</StatusPill>
                    </td>
                  ))}
                </tr>
              ))}
              {[workbookView.defendableCountRow, workbookView.aggressiveCountRow, workbookView.conservativeCountRow].map((row) => (
                <tr key={row.label} className="fpa-calibration-total-row">
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td><strong>{row.label}</strong></td>
                  {row.values.map((cell) => (
                    <td key={`${row.label}-${cell.key}`} className="is-number"><strong>{cell.text}</strong></td>
                  ))}
                </tr>
              ))}
              <tr className="fpa-calibration-total-row">
                <td>
                  <span className="section-chip">{workbookView.verdictRow.rowNumber}</span>
                </td>
                <td><strong>{workbookView.verdictRow.label}</strong></td>
                {workbookView.verdictRow.values.map((cell) => (
                  <td key={`${workbookView.verdictRow.label}-${cell.key}`} className="fpa-calibration-status-cell">
                    <StatusPill tone={verdictTone(cell.text)}>{cell.text}</StatusPill>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook C"
        title="Benchmark Corroboration"
        note="Rows 42-52 test each persona output against the workbook's eight external sanity bands."
        meta={
          <div className="overview-pills">
            <StatusPill tone={recommendedBandTone}>{workbookView.recommendedSummary.corroborationBand}</StatusPill>
            <StatusPill tone="info">{workbookView.corroborationRows.length} checks</StatusPill>
          </div>
        }
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-calibration-table fpa-calibration-status-table">
            <colgroup>
              <col style={{ width: "68px" }} />
              <col style={{ width: "31%" }} />
              {workbookView.personaHeaders.map((persona) => (
                <col key={persona.key} style={{ width: "11.2%" }} />
              ))}
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Check</th>
                {workbookView.personaHeaders.map((persona) => (
                  <PersonaHeaderCell key={persona.key} persona={persona} recommendedKey={recommendedKey} />
                ))}
                <th>Band</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.corroborationRows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td className="fpa-calibration-wrap-cell">{row.label}</td>
                  {row.values.map((cell) => (
                    <td key={`${row.key}-${cell.key}`} className="fpa-calibration-status-cell">
                      <StatusPill tone={cell.text === "GREEN" ? "success" : "warning"}>{cell.text}</StatusPill>
                    </td>
                  ))}
                  <td>{row.band}</td>
                </tr>
              ))}
              <tr className="fpa-calibration-total-row">
                <td>
                  <span className="section-chip">{workbookView.corroborationScoreRow.rowNumber}</span>
                </td>
                <td><strong>{workbookView.corroborationScoreRow.label}</strong></td>
                {workbookView.corroborationScoreRow.values.map((cell) => (
                  <td key={`${workbookView.corroborationScoreRow.label}-${cell.key}`} className="is-number"><strong>{cell.text}</strong></td>
                ))}
                <td />
              </tr>
              <tr className="fpa-calibration-total-row">
                <td>
                  <span className="section-chip">{workbookView.corroborationBandRow.rowNumber}</span>
                </td>
                <td><strong>{workbookView.corroborationBandRow.label}</strong></td>
                {workbookView.corroborationBandRow.values.map((cell) => (
                  <td key={`${workbookView.corroborationBandRow.label}-${cell.key}`} className="fpa-calibration-status-cell">
                    <StatusPill tone={corroborationBandTone(cell.text)}>{cell.text}</StatusPill>
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook D"
        title="Calibration Register"
        note="Rows 57-68 are governed by the shared E2E Calibration Closure sheet. This page reflects that register and keeps the FP&A workbook aligned."
        meta={
          <div className="overview-pills">
            <StatusPill tone="info">{workbookView.registerSourceMode}</StatusPill>
            <StatusPill tone={workbookView.registerOpenCount > 0 ? "warning" : "success"}>{workbookView.registerSummaryText}</StatusPill>
          </div>
        }
      >
        <div className="review-grid fpa-calibration-register-summary-grid">
          <article className="review-panel">
            <h4>Register status</h4>
            <SummaryList
              rows={[
                { label: "Open", value: formatCalibrationValue(workbookView.registerOpenCount, "whole") },
                { label: "Evidence attached", value: formatCalibrationValue(workbookView.registerEvidenceAttachedCount, "whole") },
                { label: "Confirmed / Locked", value: formatCalibrationValue(workbookView.registerConfirmedCount, "whole") },
              ]}
            />
          </article>
          <article className="review-panel review-panel-wide">
            <h4>Workbook row 68 summary</h4>
            <p className="section-note">{workbookView.registerSummaryText}</p>
            <p className="muted-copy">The editable source remains the shared E2E Calibration Closure register rather than this FP&amp;A page.</p>
          </article>
        </div>

        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-calibration-table fpa-calibration-register-table">
            <colgroup>
              <col style={{ width: "68px" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Row</th>
                <th>Item</th>
                <th>Tab</th>
                <th>Tag</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Target date</th>
                <th>Evidence ID(s)</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.registerRows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>
                    <span className="section-chip">{row.rowNumber}</span>
                  </td>
                  <td className="fpa-calibration-wrap-cell">{row.item}</td>
                  <td>{row.tab}</td>
                  <td>{row.tag}</td>
                  <td className="fpa-calibration-status-cell">
                    <StatusPill tone={registerStatusTone(row.status)}>{row.status}</StatusPill>
                  </td>
                  <td>{row.owner}</td>
                  <td>{row.targetDateText}</td>
                  <td className="fpa-calibration-wrap-cell">{row.evidenceIds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
