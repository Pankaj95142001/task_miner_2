import { useEffect, useMemo, useState } from "react";

import {
  buildP2pTransitionWorkbookView,
  P2P_TRANSITION_SNAPSHOT,
  formatP2pTransitionInputValue,
  formatP2pTransitionValue,
  normalizeP2pTransitionInputValue,
} from "../config/p2pTransition";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = P2P_TRANSITION_SNAPSHOT.sheetName;

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

function readDraftValue(draftInputs, address, fallback = "") {
  return Object.prototype.hasOwnProperty.call(draftInputs, address)
    ? String(draftInputs[address] ?? "")
    : fallback;
}

function getStatusTone(value) {
  const normalized = String(value || "").toUpperCase();

  if (normalized === "OK" || normalized === "LOW") {
    return "success";
  }
  if (normalized === "MEDIUM") {
    return "info";
  }
  if (normalized.startsWith("AMBER") || normalized === "HIGH") {
    return "warning";
  }
  if (normalized.startsWith("FIX") || normalized === "VERY HIGH") {
    return "danger";
  }

  return "neutral";
}

function EditableCellInput({ cell, value, canEditP2p, isBusy, label, onChange, onCommit, onToggle }) {
  if (cell?.kind === "binary") {
    if (!canEditP2p) {
      return <strong>{Number(cell?.value || 0) ? "Yes" : "No"}</strong>;
    }

    return (
      <label className="sidebar-toggle-control" style={{ justifyContent: "center" }}>
        <input
          type="checkbox"
          checked={Boolean(Number(cell?.value || 0))}
          disabled={isBusy}
          aria-label={label}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </label>
    );
  }

  if (!canEditP2p || !cell?.isEditable) {
    return <strong>{value || "-"}</strong>;
  }

  return (
    <input
      type="text"
      className="fpa-rate-card-input is-numeric"
      value={value}
      autoComplete="off"
      disabled={isBusy}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function buildDraftInputs(workbookView) {
  const entries = {
    [workbookView.controls.transitionMarkup.address]: formatP2pTransitionInputValue(
      workbookView.controls.transitionMarkup.kind,
      workbookView.controls.transitionMarkup.value,
    ),
  };

  workbookView.phaseRows.forEach((row) => {
    row.weekCells.forEach((cell) => {
      entries[cell.address] = formatP2pTransitionInputValue(cell.kind, cell.value);
    });
    entries[row.providerRamp.address] = formatP2pTransitionInputValue(row.providerRamp.kind, row.providerRamp.value);
    entries[row.billingPct.address] = formatP2pTransitionInputValue(row.billingPct.kind, row.billingPct.value);
  });

  workbookView.transitionCostRows.forEach((row) => {
    row.values.forEach((cell) => {
      if (cell.isEditable && cell.address) {
        entries[cell.address] = formatP2pTransitionInputValue(cell.kind, cell.value);
      }
    });
  });

  workbookView.transformationRows.forEach((row) => {
    row.values.forEach((cell) => {
      if (cell.isEditable && cell.address) {
        entries[cell.address] = formatP2pTransitionInputValue(cell.kind, cell.value);
      }
    });

    if (row.split?.isEditable && row.split.address) {
      entries[row.split.address] = formatP2pTransitionInputValue(row.split.kind, row.split.value);
    }
  });

  return entries;
}

export default function P2pTransitionPage({ currentDeal, canEditP2p, isBusy, onUpdateCell }) {
  const transitionInputs = currentDeal?.p2pWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.p2pWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.p2pWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;

  const workbookView = useMemo(
    () => buildP2pTransitionWorkbookView({ currentDeal }),
    [currentDeal],
  );

  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(workbookView));

  useEffect(() => {
    setDraftInputs(buildDraftInputs(workbookView));
  }, [currentDeal?.dealId, transitionInputs, workbookView]);

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(cell, nextValue) {
    const normalizedValue = normalizeP2pTransitionInputValue(cell.kind, nextValue);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [cell.address]: formatP2pTransitionInputValue(cell.kind, cell.value),
      }));
      return;
    }

    setDraftInputs((previous) => ({
      ...previous,
      [cell.address]: formatP2pTransitionInputValue(
        cell.kind,
        normalizedValue === "" ? "" : Number(normalizedValue),
      ),
    }));

    if (typeof onUpdateCell === "function") {
      onUpdateCell(SHEET_NAME, cell.address, normalizedValue);
    }
  }

  function handleBinaryCommit(cell, checked) {
    if (typeof onUpdateCell === "function") {
      onUpdateCell(SHEET_NAME, cell.address, checked ? "1" : "0");
    }
  }

  const markupInputValue = readDraftValue(
    draftInputs,
    workbookView.controls.transitionMarkup.address,
    formatP2pTransitionInputValue(workbookView.controls.transitionMarkup.kind, workbookView.controls.transitionMarkup.value),
  );

  return (
    <div className="fpa-form-stack fpa-cost-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local Transition</span>
            <h4>{P2P_TRANSITION_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_TRANSITION_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone={getStatusTone(workbookView.billingFactorStatus)}>{workbookView.billingFactorStatus}</StatusPill>
            <StatusPill tone={getStatusTone(workbookView.complexityBand)}>{workbookView.complexityBand}</StatusPill>
            <span className="section-chip">{P2P_TRANSITION_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Revenue Band Index"
            value={formatP2pTransitionValue(workbookView.revenueBandIndex, "whole")}
            note="Workbook row 4 from Workload F5"
          />
          <MetricCard
            label="Selected Band"
            value={workbookView.selectedPhaseBand.label.replace(" (wks)", "")}
            note="Phase duration column used by rows 7-12"
          />
          <MetricCard
            label="Pre-cutover Weeks"
            value={formatP2pTransitionValue(workbookView.preCutoverWeeks, "whole")}
            note="Workbook row 14"
          />
          <MetricCard
            label="Y1 Transition Billing Factor"
            value={formatP2pTransitionValue(workbookView.y1BillingFactor, "percent1")}
            note="Workbook row 15"
          />
          <MetricCard
            label="Transition Duration"
            value={formatP2pTransitionValue(workbookView.transitionDurationWeeks, "whole")}
            note="Workbook row 40 = SUM(I7:I11)"
          />
          <MetricCard
            label="Complexity-Adjusted Duration"
            value={formatP2pTransitionValue(workbookView.complexityAdjustedDurationWeeks, "number2")}
            note="Workbook row 41"
          />
        </div>
      </section>

      {workbookView.billingFactorStatus !== "OK" ? (
        <section className="compact-card info-banner">
          <div>
            <p className="section-kicker">Workbook Guard</p>
            <h3>Transition exceeds the workbook 12-month envelope</h3>
            <p className="muted-copy">
              Row 15 turns amber when pre-cutover weeks exceed 52. Shorten the pre-cutover phase stack or explicitly extend the deal model.
            </p>
          </div>
          <StatusPill tone="warning">{workbookView.billingFactorStatus}</StatusPill>
        </section>
      ) : null}
      <SectionCard
        badge="Workbook Rows 6-15"
        title="Phase ramp and billing profile"
        note="Each phase keeps the exact workbook structure: duration by revenue band, provider ramp %, billing %, effective weeks, and whether the phase lands pre-cutover."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Weighted effort {formatP2pTransitionValue(workbookView.weightedEffortWeeks, "number2")} weeks</span>
            <span className="section-chip">Billing credit {formatP2pTransitionValue(workbookView.preCutoverBillingCreditWeeks, "number2")} weeks</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-detail-table">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Small (wks)</th>
                <th>Mid</th>
                <th>Large</th>
                <th>Mega</th>
                <th>Provider ramp %</th>
                <th>Billing %</th>
                <th>Eff. weeks</th>
                <th>Pre-cutover?</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.phaseRows.map((row) => (
                <tr key={`transition-phase-${row.key}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.weekCells.map((cell) => {
                    const inputValue = readDraftValue(
                      draftInputs,
                      cell.address,
                      formatP2pTransitionInputValue(cell.kind, cell.value),
                    );

                    return (
                      <td key={cell.address} className="fpa-cost-value-cell">
                        <EditableCellInput
                          cell={cell}
                          value={inputValue}
                          canEditP2p={canEditP2p}
                          isBusy={isBusy}
                          label={`${row.label} ${cell.label}`}
                          onChange={(value) => handleDraftChange(cell.address, value)}
                          onCommit={(value) => handleDraftCommit(cell, value)}
                        />
                      </td>
                    );
                  })}
                  <td className="fpa-cost-value-cell">
                    <EditableCellInput
                      cell={row.providerRamp}
                      value={readDraftValue(draftInputs, row.providerRamp.address, formatP2pTransitionInputValue(row.providerRamp.kind, row.providerRamp.value))}
                      canEditP2p={canEditP2p}
                      isBusy={isBusy}
                      label={`${row.label} provider ramp`}
                      onChange={(value) => handleDraftChange(row.providerRamp.address, value)}
                      onCommit={(value) => handleDraftCommit(row.providerRamp, value)}
                    />
                  </td>
                  <td className="fpa-cost-value-cell">
                    <EditableCellInput
                      cell={row.billingPct}
                      value={readDraftValue(draftInputs, row.billingPct.address, formatP2pTransitionInputValue(row.billingPct.kind, row.billingPct.value))}
                      canEditP2p={canEditP2p}
                      isBusy={isBusy}
                      label={`${row.label} billing pct`}
                      onChange={(value) => handleDraftChange(row.billingPct.address, value)}
                      onCommit={(value) => handleDraftCommit(row.billingPct, value)}
                    />
                  </td>
                  <td className="fpa-cost-value-cell">{formatP2pTransitionValue(row.effectiveWeeks, "whole")}</td>
                  <td className="fpa-cost-value-cell is-status">
                    <EditableCellInput
                      cell={row.preCutover}
                      value=""
                      canEditP2p={canEditP2p}
                      isBusy={isBusy}
                      label={`${row.label} pre-cutover`}
                      onChange={() => {}}
                      onCommit={() => {}}
                      onToggle={(checked) => handleBinaryCommit(row.preCutover, checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 17-28"
        title="Transition cost and fee by persona"
        note="Rows 21-26 pull steady-state FTE from the FTE Engine, blended Y1 cost per FTE from Cost, then apply the workbook travel, PMO, and markup formulas exactly."
        meta={
          <div className="fpa-tab-meta">
            <label className="fpa-cost-picker">
              <span>Transition markup</span>
              <input
                type="text"
                className="fpa-rate-card-input is-numeric"
                value={markupInputValue}
                autoComplete="off"
                disabled={!canEditP2p || isBusy}
                onChange={(event) => handleDraftChange(workbookView.controls.transitionMarkup.address, event.target.value)}
                onBlur={(event) => handleDraftCommit(workbookView.controls.transitionMarkup, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </label>
            <span className="section-chip">Recommended persona {workbookView.recommendedPersona?.label || "Standard"}</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-summary-table">
            <thead>
              <tr>
                <th>Line</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th key={`transition-cost-head-${persona.key}`}>{persona.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.transitionCostRows.map((row) => (
                <tr key={`transition-cost-row-${row.key}`} className={row.isTotal ? "fpa-cost-total-row" : ""}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => {
                    const inputValue = cell.address
                      ? readDraftValue(draftInputs, cell.address, formatP2pTransitionInputValue(cell.kind, cell.value))
                      : formatP2pTransitionValue(cell.value, row.format);

                    return (
                      <td key={`transition-cost-${row.key}-${cell.key}`} className="fpa-cost-value-cell">
                        {cell.isEditable ? (
                          <EditableCellInput
                            cell={cell}
                            value={inputValue}
                            canEditP2p={canEditP2p}
                            isBusy={isBusy}
                            label={`${row.label} ${cell.label}`}
                            onChange={(value) => handleDraftChange(cell.address, value)}
                            onCommit={(value) => handleDraftCommit(cell, value)}
                          />
                        ) : (
                          formatP2pTransitionValue(cell.value, row.format)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 30-38"
        title="Transformation build and funding"
        note="Transformation build equals build intensity times Y1 price for each persona, then rows 33-36 distribute that build across the four workbook component buckets."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={getStatusTone(workbookView.componentReconciliationStatus)}>{workbookView.componentReconciliationStatus}</StatusPill>
            <span className="section-chip">Split total {formatP2pTransitionValue(workbookView.componentSplitTotal, "percent1")}</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-detail-table">
            <thead>
              <tr>
                <th>Line</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th key={`transition-build-head-${persona.key}`}>{persona.label}</th>
                ))}
                <th>Split %</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.transformationRows.map((row) => (
                <tr key={`transition-build-row-${row.key}`} className={row.isTotal ? "fpa-cost-total-row" : ""}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => {
                    const inputValue = cell.address
                      ? readDraftValue(draftInputs, cell.address, formatP2pTransitionInputValue(cell.kind, cell.value))
                      : formatP2pTransitionValue(cell.value, row.format);

                    return (
                      <td key={`transition-build-${row.key}-${cell.key}`} className="fpa-cost-value-cell">
                        {cell.isEditable ? (
                          <EditableCellInput
                            cell={cell}
                            value={inputValue}
                            canEditP2p={canEditP2p}
                            isBusy={isBusy}
                            label={`${row.label} ${cell.label}`}
                            onChange={(value) => handleDraftChange(cell.address, value)}
                            onCommit={(value) => handleDraftCommit(cell, value)}
                          />
                        ) : (
                          formatP2pTransitionValue(cell.value, row.format)
                        )}
                      </td>
                    );
                  })}
                  <td className="fpa-cost-value-cell">
                    {row.split ? (
                      <EditableCellInput
                        cell={row.split}
                        value={readDraftValue(draftInputs, row.split.address, formatP2pTransitionInputValue(row.split.kind, row.split.value))}
                        canEditP2p={canEditP2p}
                        isBusy={isBusy}
                        label={`${row.label} split`}
                        onChange={(value) => handleDraftChange(row.split.address, value)}
                        onCommit={(value) => handleDraftCommit(row.split, value)}
                      />
                    ) : "-"}
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

