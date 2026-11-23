import { useEffect, useMemo, useState } from "react";

import {
  buildFpaCostWorkbookView,
  FPA_COST_INSPECT_AUTO,
  FPA_COST_SNAPSHOT,
  formatCostValue,
} from "../config/fpaCost";

const DRIVER_DEFINITIONS = Object.freeze([
  { key: "year1LearningCurvePct", label: "Y1 learning curve", format: "percent1", note: "Personas row 18" },
  { key: "contingencyPct", label: "Contingency", format: "percent1", note: "Personas row 26" },
  { key: "agentGovernancePodFte", label: "Governance pod FTE", format: "number2", note: "Personas row 27" },
  { key: "corporateOverheadPct", label: "Corporate overhead", format: "percent1", note: "Deal Master D26" },
  { key: "backfillMultiplier", label: "Backfill multiplier", format: "percent1", note: "Rate Card C29" },
  { key: "agentRunCost", label: "Agent run cost", format: "currency2", note: "Rate Card C34" },
  { key: "copilotLicense", label: "Copilot license / user", format: "currency0", note: "Rate Card row 31" },
  { key: "platformBase", label: "Platform base", format: "currency0", note: "Rate Card row 32" },
  { key: "blendedSeatCostPerFte", label: "Seat and infra / FTE", format: "currency0", note: "Ops Model row 77" },
  { key: "blendedAttritionPct", label: "Blended attrition", format: "percent1", note: "Ops Model row 79" },
  { key: "nearshoreBlendedCost", label: "Nearshore blended cost", format: "currency0", note: "Ops Model row 58" },
  { key: "nearshoreWageInflationPct", label: "Nearshore wage inflation", format: "percent1", note: "Ops Model row 63" },
]);

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

function getConfirmationTone(value) {
  return value === "Yes" ? "success" : "warning";
}

export default function FpaCostPage({ currentDeal, isBusy = false }) {
  const [inspectPersonaId, setInspectPersonaId] = useState(FPA_COST_INSPECT_AUTO);

  useEffect(() => {
    setInspectPersonaId(FPA_COST_INSPECT_AUTO);
  }, [currentDeal?.dealId]);

  const workbookView = useMemo(
    () => buildFpaCostWorkbookView({ currentDeal, inspectPersonaId }),
    [currentDeal, inspectPersonaId],
  );

  const recommendedPersona = workbookView.recommendedPersona;
  const selectedPersona = workbookView.selectedPersona;
  const isAutoInspect = inspectPersonaId === FPA_COST_INSPECT_AUTO;

  const inspectOptions = useMemo(
    () => [
      {
        key: FPA_COST_INSPECT_AUTO,
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
    <div className="fpa-form-stack fpa-cost-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Cost</span>
            <h4>{FPA_COST_SNAPSHOT.title}</h4>
            <p className="section-note">{FPA_COST_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone={getConfirmationTone(workbookView.rateCardConfirmation)}>
              Rate card {workbookView.rateCardConfirmation}
            </StatusPill>
            <span className="section-chip">{FPA_COST_SNAPSHOT.formulaCount} formulas</span>
            <span className="section-chip">{formatCostValue(workbookView.corporateOverheadPct, "percent1")} overhead</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Recommended Persona"
            value={recommendedPersona?.label || "-"}
            note="Pulled from Ops Model persona selection"
          />
          <MetricCard
            label="Inspecting"
            value={selectedPersona?.label || "-"}
            note={isAutoInspect ? "Auto-follow mode" : "Manual inspection mode"}
          />
          <MetricCard
            label="Cost-to-Serve Y1"
            value={formatCostValue(selectedPersona?.summary?.costToServeY1 || 0, "currency0")}
            note={`Workbook row ${selectedPersona?.summaryRowNumber || 74}`}
          />
          <MetricCard
            label="Cost-to-Serve Y7"
            value={formatCostValue(selectedPersona?.summary?.costToServeY7 || 0, "currency0")}
            note="Seventh-year run cost"
          />
          <MetricCard
            label="Technology and AI Run Y1"
            value={formatCostValue(selectedPersona?.summary?.technologyAiRunY1 || 0, "currency0")}
            note="Includes copilot, platform, and agent run"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 7-9"
        title="Y1 summary across personas"
        note="Rows 7 to 9 in the workbook show Y1 cost-to-serve, delivery labor, and blended cost per FTE for every persona side by side."
      >
        <div className="fpa-cost-persona-grid">
          {workbookView.personaCards.map((personaCard) => {
            const isSelected = personaCard.key === selectedPersona?.key;
            const isRecommended = personaCard.key === recommendedPersona?.key;

            return (
              <button
                key={personaCard.key}
                type="button"
                className={[
                  "fpa-cost-persona-card",
                  isSelected ? "is-selected" : "",
                  isRecommended ? "is-recommended" : "",
                ].filter(Boolean).join(" ")}
                disabled={isBusy}
                onClick={() => setInspectPersonaId(personaCard.key)}
              >
                <div className="fpa-cost-persona-card-top">
                  <span className="step-badge">{isRecommended ? "Recommended" : "Persona"}</span>
                  {isSelected ? <StatusPill tone="info">Inspecting</StatusPill> : null}
                </div>
                <strong>{personaCard.label}</strong>
                <span className="fpa-cost-persona-card-value">{personaCard.valueText}</span>
                <span className="fpa-cost-persona-card-note">Cost-to-Serve Y1</span>
              </button>
            );
          })}
        </div>

        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-summary-table">
            <thead>
              <tr>
                <th>Summary line</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th key={`cost-summary-head-${persona.key}`}>{persona.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.summaryRows.map((row) => (
                <tr key={`cost-summary-row-${row.key}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => (
                    <td key={`cost-summary-${row.key}-${cell.key}`} className="fpa-cost-value-cell">{cell.text}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge={`Workbook Rows ${selectedPersona?.sectionHeaderRow || 11}-${selectedPersona?.summaryRowNumber || 22}`}
        title={`Selected persona block - ${selectedPersona?.label || "Standard"}`}
        note="This keeps the Excel line structure intact for one persona at a time, so the portal stays fast and easier to review than the raw sheet."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Column {selectedPersona?.workbookColumn || "D"}</span>
            <span className="section-chip">10 cost lines</span>
            <span className="section-chip">7 years</span>
          </div>
        }
      >
        <div className="fpa-cost-inspector-grid">
          <div className="fpa-cost-inspect-card">
            <label className="fpa-cost-picker">
              <span>Jump to persona</span>
              <select
                className="fpa-cost-select"
                value={inspectPersonaId}
                disabled={isBusy}
                onChange={(event) => setInspectPersonaId(event.target.value)}
              >
                {inspectOptions.map((option) => (
                  <option key={`cost-inspect-${option.key}`} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="fpa-cost-inspector-summary">
              <MetricCard
                label="Total FTE Y1"
                value={formatCostValue(selectedPersona?.summary?.totalFteY1 || 0, "number2")}
                note="Workbook line 1"
              />
              <MetricCard
                label="Blended Cost / FTE Y1"
                value={formatCostValue(selectedPersona?.summary?.blendedCostPerFteY1 || 0, "currency2")}
                note="Workbook line 2"
              />
              <MetricCard
                label="Delivery Labor Y1"
                value={formatCostValue(selectedPersona?.summary?.deliveryLaborY1 || 0, "currency0")}
                note="Workbook line 3"
              />
              <MetricCard
                label="Technology and AI Run Y1"
                value={formatCostValue(selectedPersona?.summary?.technologyAiRunY1 || 0, "currency0")}
                note="Workbook line 6"
              />
            </div>
          </div>

          <div className="fpa-cost-driver-grid">
            {DRIVER_DEFINITIONS.map((driver) => (
              <article key={driver.key} className="fpa-cost-driver-card">
                <span>{driver.label}</span>
                <strong>{formatCostValue(selectedPersona?.drivers?.[driver.key] ?? 0, driver.format)}</strong>
                <small>{driver.note}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-detail-table">
            <thead>
              <tr>
                <th>Cost line</th>
                {workbookView.yearHeaders.map((year) => (
                  <th key={`cost-detail-head-${year.key}`}>{year.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedPersona?.lines?.map((line) => (
                <tr key={`cost-line-${line.key}`} className={line.isTotal ? "fpa-cost-total-row" : ""}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={line.label} secondary={`Workbook row ${line.rowNumber}`} />
                  </td>
                  {line.values.map((cell) => (
                    <td key={`cost-line-${line.key}-${cell.key}`} className="fpa-cost-value-cell">{cell.text}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
