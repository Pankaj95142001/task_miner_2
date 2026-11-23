import { useMemo } from "react";

import {
  deriveP2pDiscoveryMetrics,
  formatP2pDiscoveryValue,
  P2P_DISCOVERY_COVERAGE_FIELDS,
  P2P_DISCOVERY_PAIN_POINT_FIELDS,
  P2P_DISCOVERY_PROXY_FIELDS,
  P2P_DISCOVERY_TECH_FIELDS,
} from "../config/p2pDiscovery";
import { formatPercent } from "../config/p2pMath";
import { MetricCard, SectionCard, StatusPill } from "./TowerWorkspacePrimitives";

function withCurrentOption(options = [], value = "") {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue || options.includes(normalizedValue)) {
    return options;
  }
  return [normalizedValue, ...options];
}

function FieldControl({ field, value, disabled, onChange }) {
  if (field.control === "select") {
    const options = withCurrentOption(field.options, value);
    return (
      <select className="fpa-discovery-control" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={`${field.id}-${option}`} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="fpa-discovery-control"
      type="number"
      step={field.step || "1"}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export default function P2pDiscoveryPage({ p2pWorkspace, canEditP2p, isBusy, onUpdateWorkspace }) {
  const metrics = useMemo(() => deriveP2pDiscoveryMetrics(p2pWorkspace), [p2pWorkspace]);
  const disabled = !canEditP2p || isBusy;

  function updateDiscoveryField(fieldId, nextValue) {
    onUpdateWorkspace({
      ...p2pWorkspace,
      discovery: {
        ...p2pWorkspace.discovery,
        [fieldId]: nextValue,
      },
    });
  }

  function updateCoverageField(fieldId, nextValue) {
    onUpdateWorkspace({
      ...p2pWorkspace,
      discoveryCoverage: {
        ...p2pWorkspace.discoveryCoverage,
        [fieldId]: nextValue,
      },
    });
  }

  function updatePainPoint(fieldId, nextKey, nextValue) {
    onUpdateWorkspace({
      ...p2pWorkspace,
      discoveryPainPoints: {
        ...p2pWorkspace.discoveryPainPoints,
        [fieldId]: {
          ...(p2pWorkspace.discoveryPainPoints?.[fieldId] || {}),
          [nextKey]: nextValue,
        },
      },
    });
  }

  return (
    <div className="fpa-form-stack fpa-discovery-layout">
      <SectionCard
        badge="Workbook Discovery"
        title="P2P customer proxies — local formula mode"
        note="This tab mirrors workbook sections B–E with frontend-native calculations, effective defaults, and workbook-sync inputs for downstream tabs."
        meta={(
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Local engine</StatusPill>
            <span className="section-chip">36 workbook inputs mirrored</span>
          </div>
        )}
        className="fpa-discovery-hero"
      >
        <div className="fpa-kpi-grid">
          <MetricCard label="Revenue Band" value={metrics.revenueBand} note="Auto-derived from annual revenue" />
          <MetricCard label="Coverage Score" value={`${metrics.coverageScore}/130`} note={metrics.sizingMode} />
          <MetricCard label="Weighted Completeness" value={formatPercent(metrics.weightedCompleteness, 0)} note="Criticality-weighted input fill" />
          <MetricCard label="Pain Pressure" value={formatPercent(metrics.painPointPressure, 0)} note={metrics.transformationUrgency} />
          <MetricCard label="Tech Readiness" value={metrics.benchmarkModel.dataReadinessScore.toFixed(2)} note={metrics.benchmarkModel.techStackClass} />
        </div>
      </SectionCard>

      <SectionCard
        badge="Section B"
        title="Business & volume proxies"
        note="Blank values fall back to benchmark-driven effective values, matching the workbook logic."
      >
        <div className="fpa-discovery-table-shell">
          <table className="fpa-discovery-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Proxy</th>
                <th>Input</th>
                <th>Effective</th>
                <th>Default logic</th>
              </tr>
            </thead>
            <tbody>
              {P2P_DISCOVERY_PROXY_FIELDS.map((field) => (
                <tr key={field.id}>
                  <td>{field.rowNumber}</td>
                  <td>{field.label}</td>
                  <td>
                    <FieldControl
                      field={field}
                      value={metrics.discovery[field.id] || ""}
                      disabled={disabled}
                      onChange={(nextValue) => updateDiscoveryField(field.id, nextValue)}
                    />
                  </td>
                  <td>{formatP2pDiscoveryValue(field.id, metrics.effectiveDiscovery[field.id])}</td>
                  <td>{field.defaultSource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="fpa-workload-two-column">
        <SectionCard badge="Section C" title="Discovery coverage score" note="Coverage drives the sizing mode and indicates how much blind sizing remains.">
          <div className="fpa-discovery-table-shell">
            <table className="fpa-discovery-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Evidence item</th>
                  <th>Shared?</th>
                  <th>Weight</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {metrics.coverageRows.map((field) => (
                  <tr key={field.id}>
                    <td>{field.rowNumber}</td>
                    <td>{field.label}</td>
                    <td>
                      <select
                        className="fpa-discovery-control"
                        value={field.answer}
                        disabled={disabled}
                        onChange={(event) => updateCoverageField(field.id, event.target.value)}
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </td>
                    <td>{field.weight}</td>
                    <td>{field.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard badge="Section D" title="Technology stack" note="These six layers feed the data/integration multiplier, readiness score, and agentic-data gate.">
          <div className="fpa-discovery-table-shell">
            <table className="fpa-discovery-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Layer</th>
                  <th>Selection</th>
                  <th>Effective</th>
                  <th>Effort mult</th>
                  <th>Readiness</th>
                </tr>
              </thead>
              <tbody>
                {metrics.benchmarkModel.technologyLayers.map((layer) => {
                  const definition = P2P_DISCOVERY_TECH_FIELDS.find((field) => field.id === layer.id);
                  return (
                    <tr key={layer.id}>
                      <td>{definition?.rowNumber || "-"}</td>
                      <td>{layer.label}</td>
                      <td>
                        <FieldControl
                          field={definition}
                          value={metrics.discovery[layer.id] || ""}
                          disabled={disabled}
                          onChange={(nextValue) => updateDiscoveryField(layer.id, nextValue)}
                        />
                      </td>
                      <td>{layer.effectiveValue}</td>
                      <td>{layer.effortMultiplier.toFixed(2)}</td>
                      <td>{layer.readiness}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard badge="Section E" title="Pain points & priorities" note="Severity scoring rolls into the transformation urgency index used by the pursuit narrative.">
        <div className="fpa-discovery-table-shell">
          <table className="fpa-discovery-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Pain point</th>
                <th>Present?</th>
                <th>Severity</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {metrics.painRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.rowNumber}</td>
                  <td>{row.label}</td>
                  <td>
                    <select
                      className="fpa-discovery-control"
                      value={row.present}
                      disabled={disabled}
                      onChange={(event) => updatePainPoint(row.id, "present", event.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="fpa-discovery-control"
                      value={row.severity}
                      disabled={disabled}
                      onChange={(event) => updatePainPoint(row.id, "severity", event.target.value)}
                    >
                      <option value="">Select</option>
                      {P2P_DISCOVERY_PAIN_POINT_FIELDS && ["Low", "Medium", "High", "Critical"].map((option) => (
                        <option key={`${row.id}-${option}`} value={option}>{option}</option>
                      ))}
                    </select>
                  </td>
                  <td>{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
