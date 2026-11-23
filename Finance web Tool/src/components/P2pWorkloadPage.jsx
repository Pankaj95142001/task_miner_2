import { useMemo } from "react";

import { buildP2pWorkloadModel, formatP2pWorkloadHours } from "../config/p2pWorkload";
import { formatOneDecimal, formatPercent } from "../config/p2pMath";
import { MetricCard, SectionCard, StatusPill } from "./TowerWorkspacePrimitives";

function NumberInput({ value, disabled, step = "0.1", onChange }) {
  return (
    <input
      type="number"
      step={step}
      className="fpa-workload-input is-numeric"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export default function P2pWorkloadPage({ currentDeal, p2pWorkspace, canEditP2p, isBusy, onUpdateWorkspace }) {
  const model = useMemo(() => buildP2pWorkloadModel(p2pWorkspace, currentDeal || {}), [currentDeal, p2pWorkspace]);
  const disabled = !canEditP2p || isBusy;
  const workload = model.workload;

  function updateWorkloadField(fieldId, nextValue) {
    onUpdateWorkspace({
      ...p2pWorkspace,
      workload: {
        ...p2pWorkspace.workload,
        [fieldId]: nextValue,
      },
    });
  }

  function updateWorkloadMap(mapName, rowId, nextValue) {
    onUpdateWorkspace({
      ...p2pWorkspace,
      workload: {
        ...p2pWorkspace.workload,
        [mapName]: {
          ...(p2pWorkspace.workload?.[mapName] || {}),
          [rowId]: nextValue,
        },
      },
    });
  }

  return (
    <div className="fpa-form-stack fpa-workload-layout">
      <SectionCard
        badge="Workbook Workload"
        title="P2P workload engine — frontend-native"
        note="Method A beats D beats E, just like the workbook. Customer-FTE reconciliation and manual overrides are kept local and mirrored back to workbook input cells."
        meta={(
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Local engine</StatusPill>
            <span className="section-chip">10 L2 rows</span>
          </div>
        )}
        className="fpa-workload-hero"
      >
        <div className="fpa-kpi-grid">
          <MetricCard label="Total Monthly Hours" value={formatP2pWorkloadHours(model.totalMonthlyHours)} note="Final in-scope hours / month" />
          <MetricCard label="Annual Hours" value={formatP2pWorkloadHours(model.annualHours)} note="Monthly total × 12" />
          <MetricCard label="Peak Month Hours" value={formatP2pWorkloadHours(model.peakMonthHours)} note={`Peak factor ${formatOneDecimal(model.peakMonthFactor)}`} />
          <MetricCard label="Implied Blind FTE" value={formatOneDecimal(model.blindFte)} note="Monthly hours ÷ productive-hours proxy" />
        </div>
      </SectionCard>

      <div className="fpa-workload-two-column">
        <SectionCard badge="Factor Chain" title="Active workload drivers" note="All multipliers here are local and instantly recalculated.">
          <div className="fpa-workload-fact-grid">
            {[
              ["Revenue band", model.benchmarkModel.revenueBand, `Band index ${model.benchmarkModel.bandIndex}`],
              ["Complexity multiplier", model.benchmarkModel.complexityMultiplier.toFixed(2), "Industry benchmark"],
              ["Volume multiplier", model.benchmarkModel.volumeMultiplier.toFixed(2), "Industry benchmark"],
              ["Platform adjustment", model.benchmarkModel.primaryPlatformAdjustment.toFixed(2), model.discoveryMetrics.effectiveDiscovery.p2pPlatform],
              ["Close adjustment", model.benchmarkModel.closeAdjustment.toFixed(2), model.discoveryMetrics.effectiveDiscovery.monthlyCloseComplexity],
              ["Data multiplier", model.benchmarkModel.dataIntegrationMultiplier.toFixed(2), model.benchmarkModel.techStackClass],
              ["Percentile factor", model.benchmarkModel.percentileFactor.toFixed(2), model.benchmarkSettings.percentile],
              ["Normalisation", model.benchmarkModel.normalisationFactor.toFixed(2), model.discoveryMetrics.effectiveDiscovery.processMaturity],
            ].map(([label, value, note]) => (
              <article key={label} className="fpa-workload-fact-card">
                <span className="metric-label">{label}</span>
                <strong>{value}</strong>
                <span className="metric-note">{note}</span>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard badge="Sanity & Governance" title="Sizing checks" note="The same checks flag outliers before the rest of the P2P tower is ported locally.">
          <div className="fpa-kpi-grid fpa-workload-mini-kpis">
            <MetricCard label="Customer P2P Staff" value={model.currentTowerStaff ? formatOneDecimal(model.currentTowerStaff) : "-"} note="From discovery effective values" />
            <MetricCard label="Implied Share" value={model.impliedShare === null ? "-" : formatPercent(model.impliedShare, 0)} note="Blind FTE vs current staff" />
            <MetricCard label="Method Mix" value={`${model.methodMix.A} A / ${model.methodMix.D} D / ${model.methodMix.E} E`} note="Selected source precedence" />
            <MetricCard label="Overrides Without Note" value={model.overridesWithoutNote} note={model.redVarianceCount > 0 ? `${model.redVarianceCount} red variances` : "No red variances"} />
          </div>
        </SectionCard>
      </div>

      <SectionCard badge="Controls" title="Customer-FTE reconciliation inputs" note="These are the editable inputs that drive Method A. Leave them blank to fall back to Method D / E.">
        <div className="form-grid form-grid-3">
          <label className="field-block">
            <span>Customer shared current FTE?</span>
            <select value={workload.sharedCustomerFte} disabled={disabled} onChange={(event) => updateWorkloadField("sharedCustomerFte", event.target.value)}>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </label>
          <label className="field-block">
            <span>Typed total customer FTE</span>
            <input value={workload.typedTotalCustomerFte} disabled={disabled} onChange={(event) => updateWorkloadField("typedTotalCustomerFte", event.target.value)} />
          </label>
          <label className="field-block">
            <span>Default retained share</span>
            <input value={workload.defaultRetainedShare} disabled={disabled} onChange={(event) => updateWorkloadField("defaultRetainedShare", event.target.value)} />
          </label>
        </div>
        <div className="overview-pills" style={{ marginTop: "1rem" }}>
          <StatusPill tone={model.typedTieOut.startsWith("OK") ? "success" : "warning"}>{model.typedTieOut}</StatusPill>
          <StatusPill tone="info">Σ decomposition {formatOneDecimal(model.decompositionFte)} FTE</StatusPill>
        </div>
      </SectionCard>

      <SectionCard badge="L2 Workload" title="Driver, customer, and final hours by process" note="Overrides are allowed locally. If you type an override, add a note so governance tabs can reconcile the decision later.">
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-workload-process-table">
            <thead>
              <tr>
                <th>#</th>
                <th>L2 Process</th>
                <th className="is-number">Customer FTE</th>
                <th className="is-number">Retained %</th>
                <th className="is-number">Driver hrs</th>
                <th className="is-number">Band seed</th>
                <th className="is-number">Customer hrs</th>
                <th>Method</th>
                <th className="is-number">Scope %</th>
                <th className="is-number">Final hrs/mo</th>
                <th className="is-number">Override</th>
                <th>Override note</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {model.processRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.number}</td>
                  <td>{row.label}</td>
                  <td className="is-number">
                    <NumberInput
                      value={workload.customerFteByL2[row.id] || ""}
                      disabled={disabled}
                      onChange={(nextValue) => updateWorkloadMap("customerFteByL2", row.id, nextValue)}
                    />
                  </td>
                  <td className="is-number">
                    <NumberInput
                      value={workload.retainedShareByL2[row.id] || ""}
                      disabled={disabled}
                      onChange={(nextValue) => updateWorkloadMap("retainedShareByL2", row.id, nextValue)}
                    />
                  </td>
                  <td className="is-number">{formatP2pWorkloadHours(row.driverHours)}</td>
                  <td className="is-number">{formatP2pWorkloadHours(row.bandSeed)}</td>
                  <td className="is-number">{row.customerHours === null ? "-" : formatP2pWorkloadHours(row.customerHours)}</td>
                  <td>{row.method}</td>
                  <td className="is-number">{row.scopePctLabel}</td>
                  <td className="is-number">{formatP2pWorkloadHours(row.finalHours)}</td>
                  <td className="is-number">
                    <NumberInput
                      value={workload.overrideHoursByL2[row.id] || ""}
                      disabled={disabled}
                      onChange={(nextValue) => updateWorkloadMap("overrideHoursByL2", row.id, nextValue)}
                    />
                  </td>
                  <td>
                    <input
                      className="fpa-workload-note-input"
                      value={workload.overrideNotesByL2[row.id] || ""}
                      disabled={disabled}
                      onChange={(event) => updateWorkloadMap("overrideNotesByL2", row.id, event.target.value)}
                    />
                  </td>
                  <td>
                    <div className="overview-pills">
                      <StatusPill tone={row.driverVsBandFlag.startsWith("AMBER") ? "warning" : "success"}>{row.driverVsBandFlag}</StatusPill>
                      {row.avsDFlag !== "—" ? <StatusPill tone={row.avsDFlag.startsWith("RED") ? "danger" : row.avsDFlag.startsWith("AMBER") ? "warning" : "success"}>{row.avsDFlag}</StatusPill> : null}
                      {row.overrideNeedsNote ? <StatusPill tone="warning">Note required</StatusPill> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
