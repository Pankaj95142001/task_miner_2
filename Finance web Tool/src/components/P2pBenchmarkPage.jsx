import { useMemo } from "react";

import {
  buildP2pBenchmarkModel,
  createDefaultP2pBenchmarkSettings,
  normalizeP2pBenchmarkSettings,
  P2P_BASELINE_MONTHLY_HOURS,
  P2P_DRIVER_NORMS,
  P2P_INDUSTRY_BENCHMARKS,
  P2P_REVENUE_BAND_DEFAULTS,
  P2P_SELECT_OPTIONS,
} from "../config/p2pBenchmarks";
import { deriveP2pDiscoveryMetrics } from "../config/p2pDiscovery";
import { formatCurrency, formatOneDecimal, formatPercent, formatWhole } from "../config/p2pMath";
import { P2P_SCOPE_L2_ROWS } from "../config/p2pCatalog";
import { MetricCard, SectionCard, StatusPill } from "./TowerWorkspacePrimitives";

function FieldBlock({ label, value, options, disabled, onChange }) {
  return (
    <label className="field-block">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export default function P2pBenchmarkPage({ p2pWorkspace, canEditP2p, isBusy, onUpdateWorkspace }) {
  const discoveryMetrics = useMemo(() => deriveP2pDiscoveryMetrics(p2pWorkspace), [p2pWorkspace]);
  const benchmarkSettings = normalizeP2pBenchmarkSettings(p2pWorkspace.benchmarks || createDefaultP2pBenchmarkSettings());
  const benchmarkModel = useMemo(
    () => buildP2pBenchmarkModel(discoveryMetrics.effectiveDiscovery, benchmarkSettings),
    [benchmarkSettings, discoveryMetrics.effectiveDiscovery],
  );
  const disabled = !canEditP2p || isBusy;

  function updateSetting(fieldId, nextValue) {
    onUpdateWorkspace({
      ...p2pWorkspace,
      benchmarks: {
        ...p2pWorkspace.benchmarks,
        [fieldId]: nextValue,
      },
    });
  }

  return (
    <div className="fpa-form-stack">
      <SectionCard
        badge="Workbook Benchmarks"
        title="P2P factor chain — local reference model"
        note="Industry norms, revenue-band defaults, and workload multipliers are now local so the tab loads instantly."
        meta={(
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Local engine</StatusPill>
            <span className="section-chip">Workbook rows 4-159</span>
          </div>
        )}
      >
        <div className="fpa-kpi-grid">
          <MetricCard label="Industry" value={benchmarkModel.industryBenchmark.label} note={`Reg load ${benchmarkModel.regulatoryLoad}/5`} />
          <MetricCard label="Revenue Band" value={benchmarkModel.revenueBand} note={`Band index ${benchmarkModel.bandIndex}`} />
          <MetricCard label="AI Ceiling" value={formatPercent(benchmarkModel.aiBenefitCeiling, 0)} note="Industry and AI maturity capped" />
          <MetricCard label="Data Multiplier" value={benchmarkModel.dataIntegrationMultiplier.toFixed(2)} note={benchmarkModel.techStackClass} />
          <MetricCard label="Productive Hours / FTE-month" value={formatWhole(benchmarkModel.productiveHoursPerFteMonth)} note="Capacity sanity proxy" />
        </div>
      </SectionCard>

      <SectionCard badge="Controls" title="Scenario controls" note="These local controls shape the factor chain without waiting on backend workbook render.">
        <div className="form-grid form-grid-3">
          <FieldBlock
            label="Percentile"
            value={benchmarkSettings.percentile}
            options={P2P_SELECT_OPTIONS.percentile}
            disabled={disabled}
            onChange={(nextValue) => updateSetting("percentile", nextValue)}
          />
          <FieldBlock
            label="Process Cadence"
            value={benchmarkSettings.processCadence}
            options={P2P_SELECT_OPTIONS.processCadence}
            disabled={disabled}
            onChange={(nextValue) => updateSetting("processCadence", nextValue)}
          />
          <FieldBlock
            label="Ad-hoc Intensity"
            value={benchmarkSettings.adHocIntensity}
            options={P2P_SELECT_OPTIONS.adHocIntensity}
            disabled={disabled}
            onChange={(nextValue) => updateSetting("adHocIntensity", nextValue)}
          />
        </div>
      </SectionCard>

      <div className="fpa-workload-two-column">
        <SectionCard badge="Selected Factors" title="Active multipliers" note="These values feed the local workload engine directly.">
          <div className="fpa-workload-fact-grid">
            {[
              ["Complexity multiplier", benchmarkModel.complexityMultiplier, "Industry benchmark"],
              ["Volume multiplier", benchmarkModel.volumeMultiplier, "Industry benchmark"],
              ["Platform adjustment", benchmarkModel.primaryPlatformAdjustment, discoveryMetrics.effectiveDiscovery.p2pPlatform],
              ["Close adjustment", benchmarkModel.closeAdjustment, discoveryMetrics.effectiveDiscovery.monthlyCloseComplexity],
              ["Percentile factor", benchmarkModel.percentileFactor, benchmarkSettings.percentile],
              ["Cycles / year", benchmarkModel.cyclesPerYear, benchmarkSettings.processCadence],
              ["Ad-hoc allowance", formatPercent(benchmarkModel.adHocAllowance, 0), benchmarkSettings.adHocIntensity],
              ["Normalisation", benchmarkModel.normalisationFactor, discoveryMetrics.effectiveDiscovery.processMaturity],
            ].map(([label, value, note]) => (
              <article key={label} className="fpa-workload-fact-card">
                <span className="metric-label">{label}</span>
                <strong>{typeof value === "number" ? formatOneDecimal(value) : value}</strong>
                <span className="metric-note">{note}</span>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard badge="Tech Readiness" title="Six-layer stack summary" note="Average effort multiplier and readiness are computed from the discovery stack selections.">
          <div className="fpa-table-wrap">
            <table className="fpa-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Effective</th>
                  <th className="is-number">Effort mult</th>
                  <th className="is-number">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkModel.technologyLayers.map((layer) => (
                  <tr key={layer.id}>
                    <td>{layer.label}</td>
                    <td>{layer.effectiveValue}</td>
                    <td className="is-number">{layer.effortMultiplier.toFixed(2)}</td>
                    <td className="is-number">{layer.readiness}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard badge="Industry Norms" title="Industry benchmark table" note="Workbook section A. Used to infer complexity, automation ceiling, and current-org proxies.">
        <div className="fpa-table-wrap">
          <table className="fpa-table">
            <thead>
              <tr>
                <th>Industry</th>
                <th className="is-number">Volume</th>
                <th className="is-number">Complexity</th>
                <th className="is-number">AI Ceiling</th>
                <th className="is-number">Reg Load</th>
                <th className="is-number">FTE / $1B</th>
                <th>Digital Maturity</th>
              </tr>
            </thead>
            <tbody>
              {P2P_INDUSTRY_BENCHMARKS.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="is-number">{row.volumeMultiplier.toFixed(2)}</td>
                  <td className="is-number">{row.complexityMultiplier.toFixed(2)}</td>
                  <td className="is-number">{formatPercent(row.automationCeiling, 0)}</td>
                  <td className="is-number">{row.regulatoryLoad}</td>
                  <td className="is-number">{row.ftePerRevenueB}</td>
                  <td>{row.defaultDigitalMaturity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard badge="Band Defaults" title="Revenue-band proxy defaults and band seeds" note="Workbook sections B and C. These defaults backfill blank discovery fields and seed Method E sizing.">
        <div className="fpa-workload-two-column">
          <div className="fpa-table-wrap">
            <table className="fpa-table">
              <thead>
                <tr>
                  <th>Band</th>
                  <th className="is-number">Entities</th>
                  <th className="is-number">BUs</th>
                  <th className="is-number">Employees (000s)</th>
                  <th className="is-number">Countries</th>
                  <th className="is-number">Invoices (000s)</th>
                </tr>
              </thead>
              <tbody>
                {P2P_REVENUE_BAND_DEFAULTS.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="is-number">{row.legalEntities}</td>
                    <td className="is-number">{row.businessUnits}</td>
                    <td className="is-number">{row.employeeCount000}</td>
                    <td className="is-number">{row.geoCountries}</td>
                    <td className="is-number">{row.supplierInvoices000}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fpa-table-wrap">
            <table className="fpa-table">
              <thead>
                <tr>
                  <th>L2 Process</th>
                  <th className="is-number">Small</th>
                  <th className="is-number">Mid</th>
                  <th className="is-number">Large</th>
                  <th className="is-number">Mega</th>
                </tr>
              </thead>
              <tbody>
                {P2P_SCOPE_L2_ROWS.map((row) => {
                  const seeds = P2P_BASELINE_MONTHLY_HOURS[row.id];
                  return (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      <td className="is-number">{formatWhole(seeds.small)}</td>
                      <td className="is-number">{formatWhole(seeds.mid)}</td>
                      <td className="is-number">{formatWhole(seeds.large)}</td>
                      <td className="is-number">{formatWhole(seeds.mega)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard badge="Driver Norms" title="Handling-time norms" note="Workbook section G. These formulas are what the local workload page uses to compute Method D driver hours.">
        <div className="fpa-table-wrap">
          <table className="fpa-table">
            <thead>
              <tr>
                <th>L2 Process</th>
                <th className="is-number">Param 1</th>
                <th className="is-number">Param 2</th>
                <th className="is-number">Param 3</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {P2P_SCOPE_L2_ROWS.map((row) => {
                const norm = P2P_DRIVER_NORMS[row.id];
                return (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td className="is-number">{norm?.param1 ?? "-"}</td>
                    <td className="is-number">{norm?.param2 ?? "-"}</td>
                    <td className="is-number">{norm?.param3 ?? "-"}</td>
                    <td>{norm?.meaning || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
