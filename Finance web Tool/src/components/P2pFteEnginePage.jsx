import { useEffect, useMemo, useState } from "react";

import {
  buildP2pFteEngineWorkbookView,
  P2P_FTE_ENGINE_INSPECT_AUTO,
  P2P_FTE_ENGINE_SNAPSHOT,
  formatP2pFteValue,
} from "../config/p2pFteEngine";

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
    <div className="fpa-fte-row-label">
      <strong>{primary}</strong>
      {secondary ? <span>{secondary}</span> : null}
    </div>
  );
}

function getStatusTone(value) {
  switch (String(value || "").toUpperCase()) {
    case "OK":
      return "success";
    case "AMBER":
      return "warning";
    case "RED":
      return "danger";
    case "CHECK":
      return "info";
    default:
      return "neutral";
  }
}

export default function P2pFteEnginePage({ currentDeal, isBusy }) {
  const [inspectPersonaId, setInspectPersonaId] = useState(P2P_FTE_ENGINE_INSPECT_AUTO);

  useEffect(() => {
    setInspectPersonaId(P2P_FTE_ENGINE_INSPECT_AUTO);
  }, [currentDeal?.dealId]);

  const workbookView = useMemo(
    () => buildP2pFteEngineWorkbookView({ currentDeal, inspectPersonaId }),
    [currentDeal, inspectPersonaId],
  );

  const recommendedPersona = workbookView.recommendedPersona;
  const selectedPersona = workbookView.selectedPersona;
  const isAutoInspect = inspectPersonaId === P2P_FTE_ENGINE_INSPECT_AUTO;

  const inspectOptions = useMemo(
    () => [
      {
        key: P2P_FTE_ENGINE_INSPECT_AUTO,
        label: `Auto - ${recommendedPersona?.label || "Standard"}`,
      },
      ...workbookView.personaHeaders.map((persona) => ({
        key: persona.key,
        label: persona.label,
      })),
    ],
    [recommendedPersona?.label, workbookView.personaHeaders],
  );

  return (
    <div className="fpa-form-stack fpa-fte-layout">
      <section className="compact-card fpa-subpanel fpa-fte-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local FTE Engine</span>
            <h4>{P2P_FTE_ENGINE_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_FTE_ENGINE_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <span className="section-chip">{P2P_FTE_ENGINE_SNAPSHOT.formulaCount} formulas</span>
            <span className="section-chip">{P2P_FTE_ENGINE_SNAPSHOT.processCount} process rows</span>
            <span className="section-chip">{P2P_FTE_ENGINE_SNAPSHOT.yearCount} years</span>
          </div>
        </div>

        <div className="fpa-fte-kpi-grid">
          <MetricCard
            label="Recommended Persona"
            value={recommendedPersona?.label || "-"}
            note="Auto default for now; can later follow a stored P2P persona selection."
          />
          <MetricCard
            label="Inspecting"
            value={selectedPersona?.label || "-"}
            note={isAutoInspect ? "Auto-follow mode" : "Manual inspection mode"}
          />
          <MetricCard
            label="Total FTE - Steady"
            value={formatP2pFteValue(selectedPersona?.steadyTotal, "fte2")}
            note="Local row 37 equivalent"
          />
          <MetricCard
            label="Total FTE - Y1"
            value={formatP2pFteValue(selectedPersona?.yearOneTotal, "fte2")}
            note="Local year-one total after ramp"
          />
          <MetricCard
            label="Peak Month Factor"
            value={workbookView.peakMonthFactorText}
            note="Pulled from the local workload seasonality model"
          />
        </div>
      </section>

      <div className="fpa-fte-inspector-grid">
        <section className="compact-card fpa-subpanel">
          <div className="step-header">
            <div>
              <span className="step-badge">Local Inspect Mode</span>
              <h4>Inspection Persona</h4>
              <p className="section-note">Inspect any persona instantly without waiting on the workbook. Auto currently follows the default P2P recommendation.</p>
            </div>
            <div className="fpa-tab-meta">
              <StatusPill tone={isAutoInspect ? "info" : "warning"}>{isAutoInspect ? "Auto" : "Manual"}</StatusPill>
            </div>
          </div>

          <div className="fpa-fte-inspect-card">
            <label className="fpa-fte-picker">
              <span>Persona To Inspect</span>
              <select
                className="fpa-fte-select"
                value={inspectPersonaId}
                disabled={isBusy}
                onChange={(event) => setInspectPersonaId(event.target.value)}
              >
                {inspectOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>

            <RowLabel
              primary={`Recommended persona: ${recommendedPersona?.label || "-"}`}
              secondary="This is the local auto default until P2P stores a tower-level selected persona."
            />
            <RowLabel
              primary={`Persona index: ${formatP2pFteValue(selectedPersona?.index, "whole")}`}
              secondary={`Tilt: ${selectedPersona?.tiltLabel || "-"} - Tilt index ${formatP2pFteValue(selectedPersona?.tiltIndex, "whole")}`}
            />
          </div>
        </section>

        <div className="fpa-fte-inspector-summary">
          <MetricCard
            label="Peak Flex FTE"
            value={formatP2pFteValue(selectedPersona?.peakFlex, "fte2")}
            note="Local row 34 equivalent"
          />
          <MetricCard
            label="Supervision FTE"
            value={formatP2pFteValue(selectedPersona?.supervision, "fte2")}
            note="Local row 35 equivalent"
          />
          <MetricCard
            label="Governance Pod"
            value={formatP2pFteValue(selectedPersona?.governancePod, "fte2")}
            note="Pulled from the persona assumptions"
          />
          <MetricCard
            label="Grade Tilt"
            value={selectedPersona?.tiltLabel || "-"}
            note={`Selected persona: ${selectedPersona?.label || "-"}`}
          />
        </div>
      </div>
      <SectionCard
        badge="Workbook Rows 6-13"
        title="A. Capacity Parameters (from 07 Personas)"
        note="The same persona assumptions feed productive capacity, shrinkage, management buffer, backup coverage, peak uplift, supervision span, and governance pod logic."
      >
        <div className="fpa-table-wrap fpa-fte-table-wrap">
          <table className="fpa-table fpa-fte-table fpa-fte-capacity-table">
            <thead>
              <tr>
                <th>Parameter</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th key={`capacity-head-${persona.key}`}>{persona.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.capacityRows.map((row) => (
                <tr key={`capacity-row-${row.key}`}>
                  <td className="fpa-fte-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => (
                    <td key={`capacity-${row.key}-${cell.key}`} className="fpa-fte-value-cell">{cell.text}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 20-37"
        title="B. Steady-State Delivery FTE by Process"
        note="Remaining monthly hours after AI benefit are converted into steady-state FTE for each persona using the local capacity stack."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">{workbookView.processRows.length} process rows</span>
            <span className="section-chip">5 steady summary rows</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-fte-table-wrap">
          <table className="fpa-table fpa-fte-table fpa-fte-process-table">
            <thead>
              <tr>
                <th>L2 Process</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th key={`process-head-${persona.key}`}>{persona.label}</th>
                ))}
                <th>Hours / mo</th>
                <th>Cluster</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.processRows.map((row) => (
                <tr key={`process-row-${row.id}`}>
                  <td className="fpa-fte-label-cell is-wide">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => (
                    <td key={`process-${row.id}-${cell.key}`} className="fpa-fte-value-cell">{cell.text}</td>
                  ))}
                  <td className="fpa-fte-value-cell">{row.hoursText}</td>
                  <td className="fpa-fte-value-cell is-center">
                    <span className="fpa-fte-process-chip">{row.cluster}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fpa-fte-inline-block">
          <h5 className="fpa-fte-inline-heading">Steady-state summary</h5>
          <div className="fpa-table-wrap fpa-fte-table-wrap">
            <table className="fpa-table fpa-fte-table fpa-fte-summary-table">
              <thead>
                <tr>
                  <th>Summary Row</th>
                  {workbookView.personaHeaders.map((persona) => (
                    <th key={`summary-head-${persona.key}`}>{persona.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workbookView.summaryRows.map((row) => (
                  <tr key={`summary-row-${row.rowNumber}`} className={row.isTotal ? "fpa-fte-total-row" : "fpa-fte-summary-row"}>
                    <td className="fpa-fte-label-cell">
                      <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                    </td>
                    {row.values.map((cell) => (
                      <td key={`summary-${row.rowNumber}-${cell.key}`} className="fpa-fte-value-cell">{cell.text}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>
      <SectionCard
        badge="Workbook Rows 42-57"
        title="C. Year Grid � Total FTE by Persona"
        note="Year totals apply the AI benefit ramp from Y1 through Y7 and then add peak flex, supervision, and governance pod for each persona."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">{workbookView.personaHeaders.length} personas</span>
            <span className="section-chip">{workbookView.yearHeaders.length} years</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-fte-table-wrap">
          <table className="fpa-table fpa-fte-table fpa-fte-year-table">
            <thead>
              <tr>
                <th>Persona / FTE</th>
                {workbookView.yearHeaders.map((year) => (
                  <th key={`year-head-${year.key}`}>{year.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.yearRows.map((row) => (
                <tr key={`year-row-${row.rowNumber}`} className={row.isTotal ? "fpa-fte-total-row" : ""}>
                  <td className="fpa-fte-label-cell is-wide">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => (
                    <td key={`year-${row.rowNumber}-${cell.key}`} className="fpa-fte-value-cell">{cell.text}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fpa-fte-inline-block">
          <h5 className="fpa-fte-inline-heading">Y1 total FTE snapshot</h5>
          <div className="fpa-fte-year-summary">
            {workbookView.yearOneSummary.map((persona) => (
              <MetricCard
                key={`year-one-${persona.key}`}
                label={persona.label}
                value={persona.text}
                note="Local year-one total after ramp"
              />
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 65-71"
        title="D. Heads by Grade & Layer (selected persona)"
        note={`Headcount split uses the ${selectedPersona?.label || "selected"} persona shore mix and the ${selectedPersona?.tiltLabel || "selected"} grade tilt from Ops Model.`}
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">{selectedPersona?.label || "�"}</span>
            <span className="section-chip">Tilt {selectedPersona?.tiltLabel || "�"}</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-fte-table-wrap">
          <table className="fpa-table fpa-fte-table fpa-fte-headcount-table">
            <thead>
              <tr>
                <th>Grade</th>
                {workbookView.layerHeaders.map((layer) => (
                  <th key={`layer-head-${layer.key}`}>{layer.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.headcountRows.map((row) => (
                <tr key={`headcount-row-${row.rowNumber}`} className={row.isTotal ? "fpa-fte-total-row" : ""}>
                  <td className="fpa-fte-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => (
                    <td key={`headcount-${row.rowNumber}-${cell.key}`} className="fpa-fte-value-cell">{cell.text}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <div className="fpa-fte-bottom-grid">
        <SectionCard
          badge="Workbook Rows 75-78"
          title="E. Cluster Pods & Floors"
          note="Cluster totals roll up the steady-state process FTE into local pod floors used for viability checks."
        >
          <div className="fpa-table-wrap fpa-fte-table-wrap">
            <table className="fpa-table fpa-fte-table fpa-fte-cluster-table">
              <thead>
                <tr>
                  <th>Cluster / Floor</th>
                  {workbookView.personaHeaders.map((persona) => (
                    <th key={`cluster-head-${persona.key}`}>{persona.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workbookView.clusterRows.map((row) => (
                  <tr key={`cluster-row-${row.key}`}>
                    <td className="fpa-fte-label-cell is-wide">
                      <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                    </td>
                    {row.values.map((cell) => (
                      <td key={`cluster-${row.key}-${cell.key}`} className="fpa-fte-value-cell">{cell.text}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          badge="Workbook Rows 80-82"
          title="Quality Checks"
          note={`Pod floor, peak coverage, and Y1-versus-steady checks are evaluated across all personas. Peak coverage uses factor ${workbookView.peakMonthFactorText}.`}
        >
          <div className="fpa-table-wrap fpa-fte-table-wrap">
            <table className="fpa-table fpa-fte-table fpa-fte-status-table">
              <thead>
                <tr>
                  <th>Validation</th>
                  {workbookView.personaHeaders.map((persona) => (
                    <th key={`status-head-${persona.key}`}>{persona.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workbookView.statusRows.map((row) => (
                  <tr key={`status-row-${row.rowNumber}`}>
                    <td className="fpa-fte-label-cell">
                      <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                    </td>
                    {row.values.map((cell) => (
                      <td key={`status-${row.rowNumber}-${cell.key}`} className="fpa-fte-value-cell is-status">
                        <StatusPill tone={getStatusTone(cell.value)}>{cell.text}</StatusPill>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
