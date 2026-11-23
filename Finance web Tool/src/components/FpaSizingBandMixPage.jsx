import { useEffect, useMemo, useState } from "react";

import {
  buildFpaSizingBandMixWorkbookView,
  formatSizingBandMixInputValue,
  formatSizingBandMixValue,
  FPA_SIZING_BAND_MIX_SNAPSHOT,
  normalizeSizingBandMixInputValue,
} from "../config/fpaSizingBandMix";

const SHEET_NAME = FPA_SIZING_BAND_MIX_SNAPSHOT.sheetName;

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
    <div className="fpa-sizing-row-label">
      <strong>{primary}</strong>
      {secondary ? <span>{secondary}</span> : null}
    </div>
  );
}

function statusToneFromValue(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "OK" || normalized.startsWith("GREEN")) {
    return "success";
  }
  if (normalized.startsWith("AMBER")) {
    return "warning";
  }
  if (normalized.startsWith("FIX") || normalized.startsWith("RED")) {
    return "danger";
  }
  return "info";
}

function readDraftValue(draftInputs, address, fallback = "") {
  return Object.prototype.hasOwnProperty.call(draftInputs, address)
    ? String(draftInputs[address] ?? "")
    : fallback;
}

function buildDraftInputs(workbookView) {
  const nextDraftInputs = {};

  workbookView.gradeSettings.forEach((row) => {
    nextDraftInputs[row.primaryBand.address] = formatSizingBandMixInputValue(row.primaryBand.kind, row.primaryBand.value);
    nextDraftInputs[row.primarySplit.address] = formatSizingBandMixInputValue(row.primarySplit.kind, row.primarySplit.value);
    nextDraftInputs[row.altBand.address] = formatSizingBandMixInputValue(row.altBand.kind, row.altBand.value);
    nextDraftInputs[row.altSplit.address] = formatSizingBandMixInputValue(row.altSplit.kind, row.altSplit.value);
  });

  workbookView.personaSummaries.forEach((persona) => {
    persona.roleRows.forEach((row) => {
      nextDraftInputs[row.selectedBandInput.address] = formatSizingBandMixInputValue(row.selectedBandInput.kind, row.selectedBandInput.value);
      nextDraftInputs[row.adjustmentInput.address] = formatSizingBandMixInputValue(row.adjustmentInput.kind, row.adjustmentInput.value);
      nextDraftInputs[row.noteInput.address] = formatSizingBandMixInputValue(row.noteInput.kind, row.noteInput.value);
    });
  });

  return nextDraftInputs;
}

function EditableField({
  kind,
  address,
  label,
  value,
  canEditFpa,
  isBusy,
  bandOptions = [],
  onChange,
  onCommit,
}) {
  if (kind === "band") {
    return (
      <select
        aria-label={label}
        className="fpa-sizing-select"
        value={value}
        disabled={!canEditFpa || isBusy}
        onChange={(event) => {
          onChange(event.target.value);
          onCommit(event.target.value);
        }}
      >
        <option value="">Recommended</option>
        {bandOptions.map((option) => (
          <option key={`${address}-${option}`} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (!canEditFpa) {
    return <span className="fpa-sizing-readonly">{value || "—"}</span>;
  }

  const handleStepAdjust = (delta) => {
    const normalizedValue = normalizeSizingBandMixInputValue(kind, value);
    if (normalizedValue === null) {
      return;
    }

    const baseValue = normalizedValue === "" ? 0 : Number(normalizedValue);
    const nextNumericValue = Math.round((baseValue + delta) * 100) / 100;
    const nextDisplayValue = formatSizingBandMixInputValue(kind, nextNumericValue);
    onChange(nextDisplayValue);
    onCommit(nextDisplayValue);
  };

  if (kind === "number") {
    return (
      <div className="fpa-sizing-stepper">
        <button
          type="button"
          className="fpa-sizing-stepper-button"
          aria-label={`Decrease ${label}`}
          disabled={isBusy}
          onClick={() => handleStepAdjust(-0.5)}
        >
          -
        </button>
        <input
          aria-label={label}
          type="text"
          className="fpa-sizing-input fpa-sizing-input--stepper"
          value={value}
          autoComplete="off"
          disabled={isBusy}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="fpa-sizing-stepper-button"
          aria-label={`Increase ${label}`}
          disabled={isBusy}
          onClick={() => handleStepAdjust(0.5)}
        >
          +
        </button>
      </div>
    );
  }

  return (
    <input
      aria-label={label}
      type="text"
      className={kind === "note" ? "fpa-sizing-note-input" : "fpa-sizing-input"}
      value={value}
      autoComplete="off"
      disabled={isBusy}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && kind !== "note") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export default function FpaSizingBandMixPage({
  currentDeal,
  canEditFpa,
  isBusy,
  onUpdateCell,
}) {
  const workbookView = useMemo(
    () => buildFpaSizingBandMixWorkbookView({ currentDeal }),
    [currentDeal],
  );

  const [activePersonaKey, setActivePersonaKey] = useState(workbookView.selectedPersonaSummary?.key || "standard");
  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(workbookView));

  useEffect(() => {
    setActivePersonaKey(workbookView.selectedPersonaSummary?.key || "standard");
  }, [currentDeal?.dealId, workbookView.selectedPersonaSummary?.key]);

  useEffect(() => {
    setDraftInputs(buildDraftInputs(workbookView));
  }, [workbookView]);

  const activePersona = workbookView.personaSummaries.find((persona) => persona.key === activePersonaKey)
    || workbookView.selectedPersonaSummary
    || workbookView.personaSummaries[0];

  function handleDraftChange(address, nextValue) {
    setDraftInputs((current) => ({
      ...current,
      [address]: nextValue,
    }));
  }

  function handleDraftCommit(kind, address, nextValue) {
    const normalizedValue = normalizeSizingBandMixInputValue(kind, nextValue);
    if (normalizedValue === null) {
      return;
    }

    setDraftInputs((current) => ({
      ...current,
      [address]: formatSizingBandMixInputValue(kind, normalizedValue),
    }));

    onUpdateCell(SHEET_NAME, address, normalizedValue);
  }

  return (
    <div className="fpa-form-stack fpa-sizing-layout">
      <section className="compact-card fpa-subpanel fpa-sizing-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Sizing &amp; Band Mix</span>
            <h4>{FPA_SIZING_BAND_MIX_SNAPSHOT.title}</h4>
            <p className="section-note">{FPA_SIZING_BAND_MIX_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={statusToneFromValue(workbookView.overallStatus)}>{workbookView.overallStatus}</StatusPill>
            <span className="section-chip">{FPA_SIZING_BAND_MIX_SNAPSHOT.editableCellCount} editable cells</span>
            <span className="section-chip">{FPA_SIZING_BAND_MIX_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-sizing-kpi-grid">
          <MetricCard label="Selected persona" value={workbookView.feedSummary.personaLabel} note="Current 30 SCPL feed" />
          <MetricCard label="System FTE" value={formatSizingBandMixValue(workbookView.feedSummary.systemFte, "fte2")} note="SCPL recommended India layer" />
          <MetricCard label="Final FTE" value={formatSizingBandMixValue(workbookView.feedSummary.finalFte, "fte2")} note="After overrides and adjustments" />
          <MetricCard label="Manual Δ FTE" value={formatSizingBandMixValue(workbookView.feedSummary.manualDelta, "fte2")} note="Total adjustment on selected persona" />
          <MetricCard label="Band overrides" value={formatSizingBandMixValue(workbookView.feedSummary.bandOverrideCount, "whole")} note="Selected persona only" />
          <MetricCard label="Blended loaded ARC / FTE" value={formatSizingBandMixValue(workbookView.feedSummary.blendedLoadedArcPerFte, "currency0")} note="From selected final roster" />
          <MetricCard label="Annual HCL cost" value={formatSizingBandMixValue(workbookView.feedSummary.annualHclCost, "currency0")} note="India layer cost roll-up" />
          <MetricCard label="Discovery seniority shift" value={workbookView.discoveryComplexity.seniorityMessage} note={`Index ${formatSizingBandMixValue(workbookView.discoveryComplexity.discoveryIndex, "number2")}`} />
        </div>
      </section>

      <div className="fpa-sizing-settings-grid">
        <SectionCard badge="Workbook Rows 10-15" title="A1. Persona roster builder role to HCL band mapping" note="These workbook inputs set the recommended band per Persona roster builder role family, including the seeded split role pairs for Manager and Associate Analyst.">
          <div className="fpa-table-wrap">
            <table className="fpa-table">
              <thead>
                <tr>
                  <th>Persona roster builder role</th>
                  <th>Default band</th>
                  <th>Split %</th>
                  <th>Alternative band</th>
                  <th>Alt split %</th>
                  <th>Check</th>
                </tr>
              </thead>
              <tbody>
                {workbookView.gradeSettings.map((row) => (
                  <tr key={row.id}>
                    <td><RowLabel primary={row.personaRoleLabel || row.label} secondary={row.personaRoleSecondaryLabel || ""} /></td>
                    <td>
                      <EditableField
                        kind="band"
                        address={row.primaryBand.address}
                        label={`${row.personaRoleLabel || row.label} default band`}
                        value={readDraftValue(draftInputs, row.primaryBand.address, formatSizingBandMixInputValue(row.primaryBand.kind, row.primaryBand.value))}
                        canEditFpa={canEditFpa}
                        isBusy={isBusy}
                        bandOptions={workbookView.bandOptions}
                        onChange={(nextValue) => handleDraftChange(row.primaryBand.address, nextValue)}
                        onCommit={(nextValue) => handleDraftCommit(row.primaryBand.kind, row.primaryBand.address, nextValue)}
                      />
                    </td>
                    <td>
                      <EditableField
                        kind="percent"
                        address={row.primarySplit.address}
                        label={`${row.personaRoleLabel || row.label} split %`}
                        value={readDraftValue(draftInputs, row.primarySplit.address, formatSizingBandMixInputValue(row.primarySplit.kind, row.primarySplit.value))}
                        canEditFpa={canEditFpa}
                        isBusy={isBusy}
                        onChange={(nextValue) => handleDraftChange(row.primarySplit.address, nextValue)}
                        onCommit={(nextValue) => handleDraftCommit(row.primarySplit.kind, row.primarySplit.address, nextValue)}
                      />
                    </td>
                    <td>
                      <EditableField
                        kind="band"
                        address={row.altBand.address}
                        label={`${row.personaRoleLabel || row.label} alternative band`}
                        value={readDraftValue(draftInputs, row.altBand.address, formatSizingBandMixInputValue(row.altBand.kind, row.altBand.value))}
                        canEditFpa={canEditFpa}
                        isBusy={isBusy}
                        bandOptions={workbookView.bandOptions}
                        onChange={(nextValue) => handleDraftChange(row.altBand.address, nextValue)}
                        onCommit={(nextValue) => handleDraftCommit(row.altBand.kind, row.altBand.address, nextValue)}
                      />
                    </td>
                    <td>
                      <EditableField
                        kind="percent"
                        address={row.altSplit.address}
                        label={`${row.personaRoleLabel || row.label} alt split %`}
                        value={readDraftValue(draftInputs, row.altSplit.address, formatSizingBandMixInputValue(row.altSplit.kind, row.altSplit.value))}
                        canEditFpa={canEditFpa}
                        isBusy={isBusy}
                        onChange={(nextValue) => handleDraftChange(row.altSplit.address, nextValue)}
                        onCommit={(nextValue) => handleDraftCommit(row.altSplit.kind, row.altSplit.address, nextValue)}
                      />
                    </td>
                    <td><StatusPill tone={statusToneFromValue(row.status)}>{row.status}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard badge="Workbook Rows 18-24" title="A2. Persona tilt and SCPL feed" note="Ops Model sets the base tilt, Discovery can shift it by ±1 step, and SCPL provides the system India FTE by persona.">
          <div className="fpa-table-wrap">
            <table className="fpa-table">
              <thead>
                <tr>
                  <th>Line</th>
                  {workbookView.personaSettingsMatrix.personas.map((persona) => (
                    <th key={`persona-setting-head-${persona.key}`}>{persona.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><RowLabel primary={workbookView.personaSettingsMatrix.row18Label} secondary="09 Ops Model row 56" /></td>
                  {workbookView.personaSettingsMatrix.personas.map((persona) => <td key={`${persona.key}-row18`}>{persona.baseTiltLabel}</td>)}
                </tr>
                <tr>
                  <td><RowLabel primary={workbookView.personaSettingsMatrix.row19Label} secondary="1 Senior · 2 Standard · 3 Junior" /></td>
                  {workbookView.personaSettingsMatrix.personas.map((persona) => <td key={`${persona.key}-row19`}>{formatSizingBandMixValue(persona.baseTiltIndex, "whole")}</td>)}
                </tr>
                <tr>
                  <td><RowLabel primary={workbookView.personaSettingsMatrix.row20Label} secondary={workbookView.discoveryComplexity.seniorityMessage} /></td>
                  {workbookView.personaSettingsMatrix.personas.map((persona) => <td key={`${persona.key}-row20`}>{formatSizingBandMixValue(persona.effectiveTiltIndex, "whole")}</td>)}
                </tr>
                <tr>
                  <td><RowLabel primary={workbookView.personaSettingsMatrix.row21Label} secondary={`Discovery index ${formatSizingBandMixValue(workbookView.discoveryComplexity.discoveryIndex, "number2")}`} /></td>
                  {workbookView.personaSettingsMatrix.personas.map((persona) => <td key={`${persona.key}-row21`}>{persona.effectiveTiltLabel}</td>)}
                </tr>
                <tr>
                  <td><RowLabel primary={workbookView.personaSettingsMatrix.row22Label} secondary="30 SCPL row 29 equivalent" /></td>
                  {workbookView.personaSettingsMatrix.personas.map((persona) => <td key={`${persona.key}-row22`}>{formatSizingBandMixValue(persona.recommendedIndiaFte, "fte2")}</td>)}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="fpa-sizing-discovery-strip">
            <StatusPill tone={statusToneFromValue(workbookView.discoveryComplexity.discoveryBand)}>{workbookView.discoveryComplexity.discoveryBand}</StatusPill>
            <span className="section-chip">Shift senior if ≥ {formatSizingBandMixValue(workbookView.discoveryComplexity.seniorThreshold, "number2")}</span>
            <span className="section-chip">Shift junior if ≤ {formatSizingBandMixValue(workbookView.discoveryComplexity.juniorThreshold, "number2")}</span>
          </div>
        </SectionCard>
      </div>

      <SectionCard badge="Discovery Signal" title="A3. Discovery complexity lens behind the seniority shift" note="These 12 rows replicate the hidden Discovery lens that pushes the band mix one notch more senior or more junior.">
        <div className="fpa-table-wrap">
          <table className="fpa-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Basis</th>
                <th>Score</th>
                <th>Weight</th>
                <th>Weighted</th>
                <th>Lens</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.discoveryComplexity.rows.map((row) => (
                <tr key={`discovery-complexity-${row.rowNumber}`}>
                  <td><RowLabel primary={row.label} secondary="" /></td>
                  <td>{row.basis}</td>
                  <td>{formatSizingBandMixValue(row.score, "number2")}</td>
                  <td>{formatSizingBandMixValue(row.weight, "percent1")}</td>
                  <td>{formatSizingBandMixValue(row.weightedScore, "number2")}</td>
                  <td>{row.lens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge={`Workbook Rows ${activePersona.blockStartRow}-${activePersona.blockStartRow + 20}`}
        title="B. Persona roster builder"
        note="Inspect and adjust one persona at a time. Blank band override keeps the workbook recommendation. Any override or FTE delta should carry a note."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={activePersona.isSelected ? "info" : "neutral"}>{activePersona.isSelected ? "Feeds SCPL" : "Scenario view"}</StatusPill>
            {activePersona.isRecommended ? <StatusPill tone="success">Recommended by SCPL</StatusPill> : null}
          </div>
        }
      >
        <div className="fpa-sizing-persona-strip">
          {workbookView.personaSummaries.map((persona) => (
            <button
              key={persona.key}
              type="button"
              className={`fpa-sizing-persona-pill${persona.key === activePersona.key ? " is-active" : ""}`}
              onClick={() => setActivePersonaKey(persona.key)}
            >
              <strong>{persona.label}</strong>
              <span>{formatSizingBandMixValue(persona.totalRow.finalFte, "fte1")} FTE</span>
            </button>
          ))}
        </div>

        <div className="fpa-sizing-header-text">{activePersona.headerText}</div>

        <div className="fpa-table-wrap">
          <table className="fpa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Role</th>
                <th>Band — recommended</th>
                <th>Band — selected</th>
                <th>Band effective</th>
                <th>Mix %</th>
                <th>System FTE</th>
                <th>FTE adjustment</th>
                <th>Final FTE</th>
                <th>Staffing (0.5)</th>
                <th>Std ARC</th>
                <th>Loaded ARC</th>
                <th>Annual cost</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {activePersona.roleRows.map((row) => (
                <tr key={`persona-role-${activePersona.key}-${row.rowNumber}`}>
                  <td>{row.index}</td>
                  <td><RowLabel primary={row.bandRoleLabel || row.roleLabel} secondary={row.bandRoleSecondaryLabel || row.sourceLabel} /></td>
                  <td>{row.recommendedBand || "—"}</td>
                  <td>
                    <EditableField
                      kind="band"
                      address={row.selectedBandInput.address}
                      label={`${activePersona.label} ${row.bandRoleLabel || row.roleLabel} selected band`}
                      value={readDraftValue(draftInputs, row.selectedBandInput.address, formatSizingBandMixInputValue(row.selectedBandInput.kind, row.selectedBandInput.value))}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      bandOptions={workbookView.bandOptions}
                      onChange={(nextValue) => handleDraftChange(row.selectedBandInput.address, nextValue)}
                      onCommit={(nextValue) => handleDraftCommit(row.selectedBandInput.kind, row.selectedBandInput.address, nextValue)}
                    />
                  </td>
                  <td>{row.effectiveBand || "—"}</td>
                  <td>{formatSizingBandMixValue(row.mixPct, "percent1")}</td>
                  <td>{formatSizingBandMixValue(row.systemFte, "fte2")}</td>
                  <td>
                    <EditableField
                      kind="number"
                      address={row.adjustmentInput.address}
                      label={`${activePersona.label} ${row.bandRoleLabel || row.roleLabel} FTE adjustment`}
                      value={readDraftValue(draftInputs, row.adjustmentInput.address, formatSizingBandMixInputValue(row.adjustmentInput.kind, row.adjustmentInput.value))}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      onChange={(nextValue) => handleDraftChange(row.adjustmentInput.address, nextValue)}
                      onCommit={(nextValue) => handleDraftCommit(row.adjustmentInput.kind, row.adjustmentInput.address, nextValue)}
                    />
                  </td>
                  <td>{formatSizingBandMixValue(row.finalFte, "fte2")}</td>
                  <td>{formatSizingBandMixValue(row.staffingView, "number2")}</td>
                  <td>{formatSizingBandMixValue(row.standardArc, "currency0")}</td>
                  <td>{formatSizingBandMixValue(row.loadedArc, "currency0")}</td>
                  <td>{formatSizingBandMixValue(row.annualCost, "currency0")}</td>
                  <td>
                    <EditableField
                      kind="note"
                      address={row.noteInput.address}
                      label={`${activePersona.label} ${row.bandRoleLabel || row.roleLabel} note`}
                      value={readDraftValue(draftInputs, row.noteInput.address, formatSizingBandMixInputValue(row.noteInput.kind, row.noteInput.value))}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      onChange={(nextValue) => handleDraftChange(row.noteInput.address, nextValue)}
                      onCommit={(nextValue) => handleDraftCommit(row.noteInput.kind, row.noteInput.address, nextValue)}
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5}><RowLabel primary="TOTAL — roster" secondary="" /></td>
                <td>{formatSizingBandMixValue(activePersona.totalRow.mixTotal, "percent1")}</td>
                <td>{formatSizingBandMixValue(activePersona.totalRow.systemFte, "fte2")}</td>
                <td>{formatSizingBandMixValue(activePersona.totalRow.manualDelta, "fte2")}</td>
                <td>{formatSizingBandMixValue(activePersona.totalRow.finalFte, "fte2")}</td>
                <td>{formatSizingBandMixValue(activePersona.totalRow.staffingView, "number2")}</td>
                <td>—</td>
                <td>{formatSizingBandMixValue(activePersona.totalRow.loadedArcPerFte, "currency0")}</td>
                <td>{formatSizingBandMixValue(activePersona.totalRow.annualCost, "currency0")}</td>
                <td><StatusPill tone={statusToneFromValue(activePersona.totalRow.statusText)}>{activePersona.totalRow.statusText}</StatusPill></td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard badge="Workbook Band Roll-up" title="C. Final FTE by HCL band" note="This is the row set that feeds the selected SCPL band composition layer in the Excel workbook.">
        <div className="fpa-table-wrap">
          <table className="fpa-table">
            <thead>
              <tr>
                <th>Band</th>
                <th>Band name</th>
                <th>Final FTE</th>
                <th>Mix %</th>
                <th>System FTE</th>
                <th>Δ FTE</th>
                <th>Std ARC</th>
                <th>Annual cost</th>
              </tr>
            </thead>
            <tbody>
              {activePersona.bandSummaryRows.map((row) => (
                <tr key={`band-summary-${activePersona.key}-${row.bandCode}`}>
                  <td>{row.bandCode}</td>
                  <td>{row.bandName}</td>
                  <td>{formatSizingBandMixValue(row.finalFte, "fte2")}</td>
                  <td>{formatSizingBandMixValue(row.mixPct, "percent1")}</td>
                  <td>{formatSizingBandMixValue(row.systemFte, "fte2")}</td>
                  <td>{formatSizingBandMixValue(row.deltaFte, "fte2")}</td>
                  <td>{formatSizingBandMixValue(row.standardArc, "currency0")}</td>
                  <td>{formatSizingBandMixValue(row.annualCost, "currency0")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fpa-sizing-discipline-card">
          <MetricCard label="Changes without note" value={formatSizingBandMixValue(activePersona.discipline.changesWithoutNote, "whole")} note="Selected persona only" />
          <MetricCard label="Band overrides" value={formatSizingBandMixValue(activePersona.discipline.bandOverrideCount, "whole")} note="Selected band dropdown used" />
          <article className="metric-card">
            <span className="metric-label">Discipline status</span>
            <strong>{activePersona.discipline.statusText}</strong>
            <span className="metric-note">Feeds SCPL quality checks in the workbook flow.</span>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}




