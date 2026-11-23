import { useMemo } from "react";

import {
  deriveP2pScopeMetrics,
  P2P_SCOPE_DISPOSITION_OPTIONS,
  P2P_SCOPE_LOCATION_OPTIONS,
  P2P_SCOPE_RETAINED_OPTIONS,
  P2P_SCOPE_STATUS_OPTIONS,
} from "../config/p2pScope";
import { MetricCard, SectionCard, StatusPill } from "./TowerWorkspacePrimitives";

function SelectControl({ value, options, disabled, onChange }) {
  return (
    <select className="fpa-discovery-control" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={`${option}-${value}`} value={option}>{option}</option>
      ))}
    </select>
  );
}

export default function P2pScopePage({ p2pWorkspace, canEditP2p, isBusy, onUpdateWorkspace }) {
  const metrics = useMemo(() => deriveP2pScopeMetrics(p2pWorkspace.scopeL3 || {}), [p2pWorkspace.scopeL3]);
  const disabled = !canEditP2p || isBusy;

  function updateRow(rowId, fieldName, nextValue) {
    onUpdateWorkspace({
      ...p2pWorkspace,
      scopeL3: {
        ...p2pWorkspace.scopeL3,
        [rowId]: {
          ...(p2pWorkspace.scopeL3?.[rowId] || {}),
          [fieldName]: nextValue,
        },
      },
    });
  }

  return (
    <div className="fpa-form-stack">
      <SectionCard
        badge="Workbook Scope"
        title="P2P L2 × L3 switchboard"
        note="Frontend-native roll-up mirrors the workbook logic: each L2 scope % is the average of its L3 final percentages."
        meta={(
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Local engine</StatusPill>
            <span className="section-chip">49 L3 activities</span>
          </div>
        )}
      >
        <div className="fpa-kpi-grid">
          <MetricCard label="L2 In Scope" value={metrics.selectedL2Count} note="Rolled up from L3 final %" />
          <MetricCard label="Partial L2" value={metrics.partialL2Count} note="Any L2 between 0% and 100%" />
          <MetricCard label="L3 Active" value={metrics.selectedL3Count} note="Rows with final % above zero" />
          <MetricCard label="Changed Rows" value={metrics.changedRowCount} note="Differs from workbook default" />
        </div>
      </SectionCard>

      <SectionCard badge="L2 Roll-up" title="Scope summary for workload" note="This is the scope percentage that feeds the P2P workload engine.">
        <div className="fpa-table-wrap">
          <table className="fpa-table">
            <thead>
              <tr>
                <th>L2#</th>
                <th>L2 Process</th>
                <th>Cluster</th>
                <th># L3</th>
                <th className="is-number">Scope %</th>
              </tr>
            </thead>
            <tbody>
              {metrics.l2RollupRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.number}</td>
                  <td>{row.label}</td>
                  <td>{row.cluster}</td>
                  <td>{row.l3Count}</td>
                  <td className="is-number">{row.scopePctLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard badge="L3 Detail" title="Row-by-row switchboard" note="Use Y / Partial / N exactly like the workbook. Partial % only matters when the row status is Partial.">
        <div className="fpa-discovery-table-shell">
          <table className="fpa-discovery-table">
            <thead>
              <tr>
                <th>L2#</th>
                <th>L2 Process</th>
                <th>L3 Activity</th>
                <th>Cluster</th>
                <th>Status</th>
                <th>Partial %</th>
                <th>Final %</th>
                <th>Retained?</th>
                <th>Disposition</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {metrics.l3Rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.isLeadRow ? row.l2Number : ""}</td>
                  <td>{row.isLeadRow ? row.label && row.l2Id ? metrics.l2RollupRows.find((item) => item.id === row.l2Id)?.label : "" : ""}</td>
                  <td>{row.label}</td>
                  <td>{row.cluster}</td>
                  <td>
                    <SelectControl
                      value={row.status}
                      options={P2P_SCOPE_STATUS_OPTIONS}
                      disabled={disabled}
                      onChange={(nextValue) => updateRow(row.id, "status", nextValue)}
                    />
                  </td>
                  <td>
                    <input
                      className="fpa-discovery-control"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={row.partialPct}
                      disabled={disabled || row.status !== "Partial"}
                      onChange={(event) => updateRow(row.id, "partialPct", event.target.value)}
                    />
                  </td>
                  <td>{row.finalPctLabel}</td>
                  <td>
                    <SelectControl
                      value={row.retainedToo}
                      options={P2P_SCOPE_RETAINED_OPTIONS}
                      disabled={disabled}
                      onChange={(nextValue) => updateRow(row.id, "retainedToo", nextValue)}
                    />
                  </td>
                  <td>
                    <SelectControl
                      value={row.disposition}
                      options={P2P_SCOPE_DISPOSITION_OPTIONS}
                      disabled={disabled}
                      onChange={(nextValue) => updateRow(row.id, "disposition", nextValue)}
                    />
                  </td>
                  <td>
                    <SelectControl
                      value={row.locationIntent}
                      options={P2P_SCOPE_LOCATION_OPTIONS}
                      disabled={disabled}
                      onChange={(nextValue) => updateRow(row.id, "locationIntent", nextValue)}
                    />
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
