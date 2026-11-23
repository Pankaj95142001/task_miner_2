import { useEffect, useMemo, useState } from "react";

import {
  buildFpaSensitivityWorkbookView,
  FPA_SENSITIVITY_INSPECT_AUTO,
  FPA_SENSITIVITY_SNAPSHOT,
  formatSensitivityValue,
} from "../config/fpaSensitivity";

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

function getNpvTone(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "neutral";
  }
  if (numeric > 100000000) {
    return "success";
  }
  if (numeric > 0) {
    return "info";
  }
  return "danger";
}

function getGmTone(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "neutral";
  }
  if (numeric >= 0.25) {
    return "success";
  }
  if (numeric >= 0.15) {
    return "info";
  }
  if (numeric >= 0.05) {
    return "warning";
  }
  return "danger";
}

function getHeatCellStyle(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  if (numeric >= 0.25) {
    return { background: "rgba(34, 197, 94, 0.12)", color: "#166534" };
  }
  if (numeric >= 0.2) {
    return { background: "rgba(59, 130, 246, 0.10)", color: "#1d4ed8" };
  }
  if (numeric >= 0.1) {
    return { background: "rgba(245, 158, 11, 0.12)", color: "#92400e" };
  }
  return { background: "rgba(239, 68, 68, 0.10)", color: "#991b1b" };
}

export default function FpaSensitivityPage({ currentDeal, isBusy = false }) {
  const [inspectPersonaId, setInspectPersonaId] = useState(FPA_SENSITIVITY_INSPECT_AUTO);

  useEffect(() => {
    setInspectPersonaId(FPA_SENSITIVITY_INSPECT_AUTO);
  }, [currentDeal?.dealId]);

  const workbookView = useMemo(
    () => buildFpaSensitivityWorkbookView({ currentDeal, inspectPersonaId }),
    [currentDeal, inspectPersonaId],
  );

  const selectedPersona = workbookView.selectedPersona;
  const recommendedPersona = workbookView.recommendedPersona;
  const metrics = selectedPersona?.metrics || {};

  const inspectOptions = useMemo(
    () => [
      {
        key: FPA_SENSITIVITY_INSPECT_AUTO,
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
            <span className="step-badge">Workbook Sensitivity</span>
            <h4>{FPA_SENSITIVITY_SNAPSHOT.title}</h4>
            <p className="section-note">{FPA_SENSITIVITY_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone="info">Persona {selectedPersona?.index || 2}</StatusPill>
            <span className="section-chip">{FPA_SENSITIVITY_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Persona Under Test"
            value={selectedPersona?.label || "-"}
            note="Workbook rows 5-6"
          />
          <MetricCard
            label="Recommended Price"
            value={formatSensitivityValue(metrics.recommendedPrice || 0, "currency0")}
            note="Workbook row 8"
          />
          <MetricCard
            label="Cost-to-Serve Y1"
            value={formatSensitivityValue(metrics.costToServeY1 || 0, "currency0")}
            note="Workbook row 9"
          />
          <MetricCard
            label="Run-Rate GM %"
            value={formatSensitivityValue(metrics.grossMarginPct || 0, "percent1")}
            note="Workbook row 10"
          />
          <MetricCard
            label="Base NPV"
            value={formatSensitivityValue(workbookView.highlights.baseNpv || 0, "currency0")}
            note="Workbook row 33"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 5-17"
        title="Persona under test and sensitivity drivers"
        note="The workbook picks one persona, then reads its run-rate commercial, AI, capacity, and cost posture before applying closed-form shocks."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Auto persona {recommendedPersona?.label || "Standard"}</span>
            <span className="section-chip">11 driver reads</span>
          </div>
        }
      >
        <div className="fpa-cost-inspector-grid">
          <div className="fpa-cost-inspect-card">
            <label className="fpa-cost-picker">
              <span>Persona under test</span>
              <select
                className="fpa-cost-select"
                value={inspectPersonaId}
                disabled={isBusy}
                onChange={(event) => setInspectPersonaId(event.target.value)}
              >
                {inspectOptions.map((option) => (
                  <option key={`sensitivity-inspect-${option.key}`} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="fpa-cost-inspector-summary">
              <MetricCard
                label="Implied Automation"
                value={formatSensitivityValue(metrics.impliedAutomationPct || 0, "percent1")}
                note="Workbook row 11"
              />
              <MetricCard
                label="Utilisation"
                value={formatSensitivityValue(metrics.utilisationPct || 0, "percent1")}
                note="Workbook row 12"
              />
              <MetricCard
                label="Shrinkage"
                value={formatSensitivityValue(metrics.shrinkagePct || 0, "percent1")}
                note="Workbook row 13"
              />
              <MetricCard
                label="Labor Share of Cost"
                value={formatSensitivityValue(metrics.laborShareOfCostPct || 0, "percent1")}
                note="Workbook row 14"
              />
            </div>
          </div>

          <div className="fpa-cost-driver-grid">
            {workbookView.baseDriverRows.slice(7).map((row) => (
              <article key={row.key} className="fpa-cost-driver-card">
                <span>{row.label}</span>
                <strong>{formatSensitivityValue(row.value, row.format)}</strong>
                <small>{`Workbook row ${row.rowNumber}`}</small>
              </article>
            ))}
            <article className="fpa-cost-driver-card">
              <span>Provider-Carried Investment</span>
              <strong>{formatSensitivityValue(metrics.providerCarriedInvestment || 0, "currency0")}</strong>
              <small>Used in scenario NPV recomputation from Business Case row 51</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>GM Formula</span>
              <strong>{workbookView.formulaNarrative}</strong>
              <small>Workbook row 2</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Scenario NPV Formula</span>
              <strong>{workbookView.scenarioNpvNarrative}</strong>
              <small>Workbook row 33</small>
            </article>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 21-29"
        title="One-way shocks"
        note="Each shock changes either the price factor, the cost factor, or both. The resulting GM% is computed directly from the base run-rate GM."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={getGmTone(workbookView.highlights.downsideGmPct)}>
              Downside GM {formatSensitivityValue(workbookView.highlights.downsideGmPct || 0, "percent1")}
            </StatusPill>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-detail-table">
            <thead>
              <tr>
                <th>Shock</th>
                <th>Price Factor</th>
                <th>Cost Factor</th>
                <th>New GM %</th>
                <th>? GM (pp)</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.oneWayShockRows.map((row) => (
                <tr key={`sensitivity-shock-${row.key}`} className={row.key === "combinedDownside" ? "fpa-cost-total-row" : ""}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  <td className="fpa-cost-value-cell">{formatSensitivityValue(row.priceFactor, "factor4")}</td>
                  <td className="fpa-cost-value-cell">{formatSensitivityValue(row.costFactor, "factor4")}</td>
                  <td className="fpa-cost-value-cell">{formatSensitivityValue(row.newGrossMarginPct, "percent1")}</td>
                  <td className="fpa-cost-value-cell">{formatSensitivityValue(row.deltaGrossMarginPp, "pp1")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 33-35"
        title="Scenario cases"
        note="These cases reuse the same closed-form GM logic, then re-discount the Business Case revenue and cost NPVs using the scenario price and cost factors."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={getNpvTone(workbookView.highlights.baseNpv)}>
              Base NPV {formatSensitivityValue(workbookView.highlights.baseNpv || 0, "currency0")}
            </StatusPill>
            <StatusPill tone={getNpvTone(workbookView.highlights.downsideNpv)}>
              Downside NPV {formatSensitivityValue(workbookView.highlights.downsideNpv || 0, "currency0")}
            </StatusPill>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-summary-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Price Factor</th>
                <th>Cost Factor</th>
                <th>GM %</th>
                <th>NPV</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.scenarioCaseRows.map((row) => (
                <tr key={`sensitivity-scenario-${row.key}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  <td className="fpa-cost-value-cell">{formatSensitivityValue(row.priceFactor, "factor4")}</td>
                  <td className="fpa-cost-value-cell">{formatSensitivityValue(row.costFactor, "factor4")}</td>
                  <td className="fpa-cost-value-cell">{formatSensitivityValue(row.grossMarginScenarioPct, "percent1")}</td>
                  <td className="fpa-cost-value-cell">{formatSensitivityValue(row.npv, "currency0")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 38-44"
        title="Two-way GM matrix"
        note="Columns shift automation by plus or minus 10 percentage points on labor-share cost. Rows apply price discounts from 0% to 10%. Each cell recomputes GM% instantly."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={getGmTone(workbookView.highlights.maxUpsideGmPct)}>
              Best cell {formatSensitivityValue(workbookView.highlights.maxUpsideGmPct || 0, "percent1")}
            </StatusPill>
            <StatusPill tone={getGmTone(workbookView.highlights.maxDownsideGmPct)}>
              Worst cell {formatSensitivityValue(workbookView.highlights.maxDownsideGmPct || 0, "percent1")}
            </StatusPill>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-detail-table">
            <thead>
              <tr>
                <th>Price Discount</th>
                {workbookView.automationDeltaColumns.map((column) => (
                  <th key={`sensitivity-matrix-head-${column.key}`}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.matrixRows.map((row) => (
                <tr key={`sensitivity-matrix-row-${row.key}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.cells.map((cell) => (
                    <td
                      key={`sensitivity-matrix-cell-${cell.key}`}
                      className="fpa-cost-value-cell"
                      style={getHeatCellStyle(cell.value)}
                      title={`Price factor ${formatSensitivityValue(cell.priceFactor, "factor4")} | Cost factor ${formatSensitivityValue(cell.costFactor, "factor4")}`}
                    >
                      {formatSensitivityValue(cell.value, "percent1")}
                    </td>
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
