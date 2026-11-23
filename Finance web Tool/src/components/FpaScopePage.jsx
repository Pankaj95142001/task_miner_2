import { useMemo } from "react";

import {
  deriveFpaScopeMetrics,
  FPA_SCOPE_RETAINED_OPTIONS,
  FPA_SCOPE_STATUS_OPTIONS,
  FPA_SCOPE_WORKBOOK_FOOTNOTE,
  FPA_SCOPE_WORKBOOK_NOTE,
  FPA_SCOPE_WORKBOOK_ROLLUP_TITLE,
  FPA_SCOPE_WORKBOOK_TITLE,
  formatFpaScopeFraction,
} from "../config/fpaScope";

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function scopeTone(scopePct) {
  if (scopePct >= 1) {
    return "success";
  }

  if (scopePct > 0) {
    return "warning";
  }

  return "neutral";
}

function ScopeSelect({ value, options, disabled, onChange, allowBlank = false }) {
  const normalizedValue = options.includes(value) ? value : allowBlank ? "" : (options[0] || "");
  const showBlankOption = allowBlank;

  return (
    <select className="fpa-scope-cell-select" value={normalizedValue} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {showBlankOption ? <option value="">Blank</option> : null}
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function ScopeTextInput({ value, disabled, type = "text", min, max, step, onChange }) {
  return (
    <input
      className="fpa-scope-cell-input"
      type={type}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export default function FpaScopePage({
  fpaWorkspace,
  canEditFpa,
  isBusy,
  onUpdateWorkspace,
}) {
  const scopeMetrics = useMemo(
    () => deriveFpaScopeMetrics(fpaWorkspace.scopeL3, fpaWorkspace.scopeL2),
    [fpaWorkspace.scopeL3, fpaWorkspace.scopeL2],
  );
  const selectedL2Count = scopeMetrics.selectedL2Count;
  const selectedL3Count = scopeMetrics.selectedL3Count;
  const switchboardRows = useMemo(() => {
    const rows = [];

    scopeMetrics.l2RollupRows.forEach((l2Row) => {
      if (l2Row.basis === "L2") {
        rows.push({
          switchboardId: `l2-${l2Row.id}`,
          rowType: "L2",
          id: l2Row.id,
          l2Id: l2Row.id,
          isLeadRow: true,
          l2Number: l2Row.l2Number,
          l2Process: l2Row.label,
          scopeLine: l2Row.sourceLabel ? `L2 process only — ${l2Row.sourceLabel}` : "L2 process only",
          cluster: l2Row.cluster,
          status: l2Row.status,
          partialPct: l2Row.partialPct,
          finalPct: l2Row.scopePct,
        });
        return;
      }

      scopeMetrics.l3Rows
        .filter((row) => row.l2Id === l2Row.id)
        .forEach((row) => {
          rows.push({
            ...row,
            switchboardId: `l3-${row.id}`,
            rowType: "L3",
            scopeLine: row.activity,
          });
        });
    });

    return rows;
  }, [scopeMetrics]);

  function cloneWorkspace() {
    return {
      ...fpaWorkspace,
      scopeL2: Object.fromEntries(
        Object.entries(fpaWorkspace.scopeL2 || {}).map(([key, value]) => [
          key,
          value && typeof value === "object" ? { ...value } : value,
        ]),
      ),
      scopeL3: Object.fromEntries(
        Object.entries(fpaWorkspace.scopeL3 || {}).map(([key, value]) => [
          key,
          value && typeof value === "object" ? { ...value } : value,
        ]),
      ),
    };
  }

  function updateScopeRow(rowId, field, value) {
    const nextWorkspace = cloneWorkspace();
    nextWorkspace.scopeL3[rowId] = {
      ...(nextWorkspace.scopeL3[rowId] || {}),
      [field]: value,
    };
    onUpdateWorkspace(nextWorkspace);
  }

  function updateScopeL2Row(rowId, field, value) {
    const nextWorkspace = cloneWorkspace();
    nextWorkspace.scopeL2[rowId] = {
      ...(nextWorkspace.scopeL2[rowId] || {}),
      [field]: value,
    };
    onUpdateWorkspace(nextWorkspace);
  }

  return (
    <div className="fpa-form-stack fpa-scope-layout">
      <section className="compact-card fpa-scope-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Scope</span>
            <h4>{FPA_SCOPE_WORKBOOK_TITLE}</h4>
            <p className="section-note">{FPA_SCOPE_WORKBOOK_NOTE}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={scopeMetrics.isAtWorkbookDefault ? "neutral" : "info"}>{scopeMetrics.isAtWorkbookDefault ? "Workbook defaults" : "Edited"}</StatusPill>
            <StatusPill tone={scopeMetrics.partialL2Count > 0 || scopeMetrics.partialL3Count > 0 ? "warning" : "success"}>
              {scopeMetrics.partialL3Count > 0 ? `${scopeMetrics.partialL3Count} partial L3 rows` : "No partial rows"}
            </StatusPill>
          </div>
        </div>

        <div className="fpa-scope-meta-grid">
          <article className="fpa-scope-meta-card">
            <span className="section-kicker">L2 Processes In Scope</span>
            <strong>{selectedL2Count}/{scopeMetrics.l2RollupRows.length}</strong>
            <span className="section-note">Workbook roll-up rows with scope above zero.</span>
          </article>
          <article className="fpa-scope-meta-card">
            <span className="section-kicker">L3 Activities In Scope</span>
            <strong>{selectedL3Count}/{scopeMetrics.l3Rows.length}</strong>
            <span className="section-note">Underlying L3 rows with final scope above zero.</span>
          </article>
          <article className="fpa-scope-meta-card">
            <span className="section-kicker">Partial L2 Rows</span>
            <strong>{scopeMetrics.partialL2Count}</strong>
            <span className="section-note">Roll-up rows where scope resolves between zero and one.</span>
          </article>
          <article className="fpa-scope-meta-card">
            <span className="section-kicker">Partial L3 Rows</span>
            <strong>{scopeMetrics.partialL3Count}</strong>
            <span className="section-note">Individual activities using the partial percentage path.</span>
          </article>
        </div>
      </section>

      <section className="compact-card fpa-subpanel">
        <div className="step-header">
          <div>
            <span className="step-badge">Input Grid</span>
            <h4>Scope switchboard</h4>
            <p className="section-note">Columns mirror the workbook input block. When the source docs only support an L2 process, this table shows one L2 line and hides unsupported L3 activities. The portal still calculates `Final %` with the same Excel rule: `IF(Status="N",0,IF(Status="Y",1,Partial %))`.</p>
          </div>
          <span className="section-chip">{switchboardRows.length} visible switchboard rows</span>
        </div>

        <div className="fpa-table-wrap fpa-scope-table-wrap fpa-scope-switchboard-wrap">
          <table className="fpa-table fpa-scope-table">
            <thead>
              <tr>
                <th>L2#</th>
                <th>L2 Process</th>
                <th>Scope line</th>
                <th>Cluster</th>
                <th>Status</th>
                <th>Partial %</th>
                <th>Final %</th>
                <th>Retained too?</th>
                <th>Disposition</th>
                <th>Location intent</th>
              </tr>
            </thead>
            <tbody>
              {switchboardRows.map((row) => {
                const isL2Row = row.rowType === "L2";

                return (
                  <tr key={row.switchboardId}>
                    <td className="fpa-scope-l2-cell">{row.isLeadRow ? row.l2Number : ""}</td>
                    <td className="fpa-scope-process-cell">{row.isLeadRow ? row.l2Process : ""}</td>
                    <td className="fpa-scope-activity-cell">{row.scopeLine}</td>
                    <td>{row.cluster}</td>
                    <td>
                      <ScopeSelect value={row.status} options={FPA_SCOPE_STATUS_OPTIONS} disabled={!canEditFpa || isBusy} onChange={(value) => (isL2Row ? updateScopeL2Row(row.id, "status", value) : updateScopeRow(row.id, "status", value))} />
                    </td>
                    <td>
                      <ScopeTextInput value={row.partialPct} type="number" min="0" max="1" step="0.05" disabled={!canEditFpa || isBusy} onChange={(value) => (isL2Row ? updateScopeL2Row(row.id, "partialPct", value) : updateScopeRow(row.id, "partialPct", value))} />
                    </td>
                    <td className="fpa-scope-readonly-cell">{formatFpaScopeFraction(row.finalPct)}</td>
                    <td>
                      {isL2Row ? (
                        <span className="fpa-scope-readonly-cell">—</span>
                      ) : (
                        <ScopeSelect value={row.retainedToo} options={FPA_SCOPE_RETAINED_OPTIONS} allowBlank disabled={!canEditFpa || isBusy} onChange={(value) => updateScopeRow(row.id, "retainedToo", value)} />
                      )}
                    </td>
                    <td>
                      {isL2Row ? (
                        <span className="fpa-scope-readonly-cell">—</span>
                      ) : (
                        <ScopeTextInput value={row.disposition} disabled={!canEditFpa || isBusy} onChange={(value) => updateScopeRow(row.id, "disposition", value)} />
                      )}
                    </td>
                    <td>
                      {isL2Row ? (
                        <span className="fpa-scope-readonly-cell">—</span>
                      ) : (
                        <ScopeTextInput value={row.locationIntent} disabled={!canEditFpa || isBusy} onChange={(value) => updateScopeRow(row.id, "locationIntent", value)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="compact-card fpa-subpanel">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Roll-up</span>
            <h4>{FPA_SCOPE_WORKBOOK_ROLLUP_TITLE}</h4>
            <p className="section-note">Each L2 scope percentage uses L3 `Final %` rows when activity-level scope exists. Otherwise it falls back to the source-backed L2 process flag.</p>
          </div>
          <span className="section-chip">12 workbook L2 rows</span>
        </div>

        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-scope-rollup-table">
            <thead>
              <tr>
                <th>L2#</th>
                <th>L2 Process</th>
                <th>Scope %</th>
                <th>Cluster</th>
                <th>Basis</th>
                <th>Source Ref</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {scopeMetrics.l2RollupRows.map((row) => (
                <tr key={row.id}>
                  <td className="fpa-scope-l2-cell">{row.l2Number}</td>
                  <td className="fpa-scope-process-cell">{row.label}</td>
                  <td className="fpa-scope-readonly-cell">{row.scopePctLabel}</td>
                  <td>{row.cluster}</td>
                  <td>{row.basis === "L3" ? "L3 activity" : "L2 process"}</td>
                  <td>{row.sourceLabel || (row.basis === "L3" ? "Matching L3 rows" : "—")}</td>
                  <td>
                    <StatusPill tone={scopeTone(row.scopePct)}>
                      {row.scopePct >= 1 ? "Y" : row.scopePct > 0 ? "Partial" : "N"}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="compact-card fpa-subpanel fpa-scope-footnote-panel">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Note</span>
            <h4>Hybrid retained-intent guidance</h4>
            <p className="section-note">{FPA_SCOPE_WORKBOOK_FOOTNOTE}</p>
          </div>
          <span className="section-chip">Row 75 note</span>
        </div>
      </section>
    </div>
  );
}
