import { useEffect, useMemo, useState } from "react";

import {
  buildFpaScplWorkbookView,
  FPA_SCPL_AUTO_PERSONA,
  FPA_SCPL_SNAPSHOT,
  formatScplInputValue,
  formatScplValue,
  normalizeScplInputValue,
} from "../config/fpaScpl";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = FPA_SCPL_SNAPSHOT.sheetName;

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

  if (normalized === "OK" || normalized.startsWith("GREEN")) {
    return "success";
  }

  if (normalized.startsWith("AMBER") || normalized === "N/A") {
    return "warning";
  }

  if (normalized.startsWith("FIX") || normalized.startsWith("RED")) {
    return "danger";
  }

  return "neutral";
}

function ScplEditableField({
  kind,
  label,
  value,
  canEditFpa,
  isBusy,
  options = [],
  onChange,
  onCommit,
}) {
  if (kind === "choice" || kind === "persona") {
    if (!canEditFpa) {
      const selectedOption = options.find((option) => option.value === value);
      return <span className="fpa-rate-card-readonly">{selectedOption?.label || value || "-"}</span>;
    }

    return (
      <select
        aria-label={label}
        className="fpa-rate-card-select"
        value={value}
        disabled={isBusy}
        onChange={(event) => onCommit(event.target.value)}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  if (!canEditFpa) {
    return <span className="fpa-rate-card-readonly">{value || "-"}</span>;
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
  const nextDraftInputs = {
    [workbookView.controls.personaOverride.address]: workbookView.controls.personaOverride.value || FPA_SCPL_AUTO_PERSONA,
    [workbookView.controls.offshoreShare.address]: formatScplInputValue(
      workbookView.controls.offshoreShare.kind,
      workbookView.controls.offshoreShare.value,
    ),
    [workbookView.controls.arcLoading.address]: formatScplInputValue(
      workbookView.controls.arcLoading.kind,
      workbookView.controls.arcLoading.value,
    ),
    [workbookView.controls.fxReference.address]: formatScplInputValue(
      workbookView.controls.fxReference.kind,
      workbookView.controls.fxReference.value,
    ),
    [workbookView.controls.pricingGrossMargin.address]: formatScplInputValue(
      workbookView.controls.pricingGrossMargin.kind,
      workbookView.controls.pricingGrossMargin.value,
    ),
    [workbookView.controls.rateCardConfirmed.address]: workbookView.controls.rateCardConfirmed.value,
    [workbookView.controls.locationFactorsConfirmed.address]: workbookView.controls.locationFactorsConfirmed.value,
    [workbookView.controls.minSecondaryCenterFte.address]: formatScplInputValue(
      workbookView.controls.minSecondaryCenterFte.kind,
      workbookView.controls.minSecondaryCenterFte.value,
    ),
  };

  workbookView.bandRows.forEach((row) => {
    nextDraftInputs[row.mixInput.address] = formatScplInputValue(row.mixInput.kind, row.mixInput.value);
  });

  workbookView.locationRows.forEach((row) => {
    nextDraftInputs[row.allocationInput.address] = formatScplInputValue(row.allocationInput.kind, row.allocationInput.value);
    nextDraftInputs[row.factorInput.address] = formatScplInputValue(row.factorInput.kind, row.factorInput.value);
  });

  return nextDraftInputs;
}

function buildPreviewDeal(currentDeal, scplInputs, draftInputs) {
  const nextSheetInputs = {
    ...scplInputs,
    ...draftInputs,
  };

  if (nextSheetInputs.C6 === FPA_SCPL_AUTO_PERSONA) {
    nextSheetInputs.C6 = "";
  }

  if (nextSheetInputs.C9 === FPA_SCPL_AUTO_PERSONA) {
    nextSheetInputs.C9 = "";
  }

  return {
    ...currentDeal,
    fpaWorkbookInputs: {
      ...(currentDeal?.fpaWorkbookInputs || {}),
      [SHEET_NAME]: nextSheetInputs,
    },
  };
}

export default function FpaScplPage({
  currentDeal,
  canEditFpa,
  isBusy,
  onUpdateCell,
}) {
  const scplInputs = currentDeal?.fpaWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.fpaWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.fpaWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;

  const committedWorkbookView = useMemo(
    () => buildFpaScplWorkbookView({ currentDeal }),
    [currentDeal],
  );

  const persistedDisplayMap = useMemo(
    () => buildDraftInputs(committedWorkbookView),
    [committedWorkbookView],
  );

  const [draftInputs, setDraftInputs] = useState(() => persistedDisplayMap);

  useEffect(() => {
    setDraftInputs(buildDraftInputs(committedWorkbookView));
  }, [currentDeal?.dealId, scplInputs, committedWorkbookView]);

  const previewDeal = useMemo(
    () => buildPreviewDeal(currentDeal, scplInputs, draftInputs),
    [currentDeal, draftInputs, scplInputs],
  );

  const workbookView = useMemo(
    () => buildFpaScplWorkbookView({ currentDeal: previewDeal }),
    [previewDeal],
  );

  const yearGridSection = workbookView.yearGridSection || {
    badge: "Workbook Rows 6-17",
    title: "A. Sizing bridge and contract-year view",
    note: "SCPL starts from the selected persona's total FTE, applies the India share, then projects the offshore layer across in-term years.",
  };
  const bandSection = workbookView.bandSection || {
    badge: "Workbook Rows 21-33",
    title: "B. Band mix, staffing and pricing by band",
    note: "This block converts the India FTE layer into banded staffing, then applies the HCL India rate card, ARC loading, location blend and pricing GM.",
  };
  const locationSection = workbookView.locationSection || {
    badge: "Workbook Rows 56-63",
    title: "D. Delivery-center split",
    note: "Each active center gets a share of the India FTE pool and an optional cost factor. The blended factor flows back into the loaded ARC in B.",
  };
  const yearViewSection = workbookView.yearViewSection || {
    badge: "Workbook Rows 67-73",
    title: "E. Year view",
    note: "Inflation is applied to the blended ARC, then yearly cost, price, margin and bill rate are projected only for in-term years.",
    showTotalColumn: true,
  };
  const reconciliationSection = workbookView.reconciliationSection || {
    badge: "Workbook Rows 77-83",
    title: "F. Reconciliation to the main model",
    note: "These checks explain how the local SCPL commercial view compares with the core Ops Model, Cost and Pricing outputs already built in the portal.",
  };
  const checkSection = workbookView.checkSection || {
    badge: "Workbook Rows 87-95",
    title: "G. Quality checks",
    note: "The SCPL status is driven from the same workbook-style validation rules: fix hard breaks first, then clear amber assumptions as the deal matures.",
  };

  const bandStaffingTotal = useMemo(
    () => workbookView.bandRows.reduce((sum, row) => sum + Number(row.staffingView || 0), 0),
    [workbookView.bandRows],
  );

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(kind, address, nextValue) {
    const normalizedValue = normalizeScplInputValue(kind, nextValue);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [address]: persistedDisplayMap[address] ?? "",
      }));
      return;
    }

    let nextDisplayValue = normalizedValue;
    if (kind === "persona") {
      nextDisplayValue = normalizedValue || FPA_SCPL_AUTO_PERSONA;
    } else if (kind !== "choice") {
      nextDisplayValue = normalizedValue === ""
        ? ""
        : formatScplInputValue(kind, Number(normalizedValue));
    }

    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextDisplayValue,
    }));

    if (typeof onUpdateCell === "function") {
      onUpdateCell(SHEET_NAME, address, normalizedValue);
    }
  }

  return (
    <div className="fpa-form-stack fpa-scpl-layout">
      <section className="compact-card fpa-subpanel fpa-scpl-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook SCPL</span>
            <h4>{FPA_SCPL_SNAPSHOT.title}</h4>
            <p className="section-note">{FPA_SCPL_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone={workbookView.status.overallTone}>{workbookView.status.overallStatus}</StatusPill>
            <span className="section-chip">{FPA_SCPL_SNAPSHOT.editableCellCount} editable cells</span>
            <span className="section-chip">{FPA_SCPL_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-scpl-kpi-grid">
          <MetricCard
            label="Recommended Persona"
            value={workbookView.recommendedPersona?.label || "-"}
            note="From 11 FTE Engine / 09 Ops Model flow"
          />
          <MetricCard
            label="Active Persona"
            value={workbookView.selectedPersona?.label || "-"}
            note={workbookView.isAutoPersona ? "Auto-follow mode" : "Manual override"}
          />
          <MetricCard
            label="Delivery Tilt"
            value={workbookView.selectedTiltLabel || "-"}
            note="From 09 Ops Model offshore pyramid"
          />
          <MetricCard
            label="India FTE | Steady"
            value={formatScplValue(workbookView.pricingTotals?.annualCostSteady > 0 ? workbookView.locationSummary.totalFte : workbookView.sizingRows?.[4]?.value || 0, "fte2")}
            note="Workbook row 10 / reconciled"
          />
          <MetricCard
            label="Annual Cost"
            value={formatScplValue(workbookView.pricingTotals.annualCostSteady, "currency0")}
            note="India scope labour cost"
          />
          <MetricCard
            label="Annual Price"
            value={formatScplValue(workbookView.pricingTotals.annualPriceSteady, "currency0")}
            note="India scope commercial price"
          />
          <MetricCard
            label="Gross Margin"
            value={formatScplValue(workbookView.pricingTotals.grossMarginSteady, "currency0")}
            note="Price less cost"
          />
          <MetricCard
            label="Bill Rate / FTE"
            value={formatScplValue(workbookView.pricingTotals.billRatePerIndiaFte, "currency2")}
            note="Steady-state annual bill rate"
          />
          <MetricCard
            label="Blended ARC / FTE"
            value={formatScplValue(workbookView.pricingTotals.blendedArcPerFte, "currency2")}
            note="After load and location blend"
          />
          <MetricCard
            label="Monthly Invoice"
            value={formatScplValue(workbookView.pricingTotals.monthlyInvoiceSteady, "currency0")}
            note="Steady-state run rate"
          />
          <MetricCard
            label="Contract Term"
            value={formatScplValue(workbookView.yearViewSummary.contractTermYears, "whole")}
            note="Derived from Deal Setup"
          />
          <MetricCard
            label="India Wage Inflation"
            value={formatScplValue(workbookView.yearViewSummary.wageInflationIndia, "percent1")}
            note="From 10 Rate Card"
          />
        </div>
      </section>

      <SectionCard
        badge={yearGridSection.badge}
        title={yearGridSection.title}
        note={yearGridSection.note}
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={getStatusTone(workbookView.checkRows.find((row) => row.rowNumber === 89)?.status)}>
              {workbookView.checkRows.find((row) => row.rowNumber === 89)?.status}
            </StatusPill>
            <span className="section-chip">7 year grid</span>
            <span className="section-chip">Term mask applied</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-scpl-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Value</th>
                <th>How it reads</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.sizingRows.map((row) => (
                <tr key={`scpl-sizing-${row.rowNumber}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.value, row.valueFormat)}</td>
                  <td className="fpa-scpl-note-cell">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-scpl-year-table">
            <thead>
              <tr>
                <th>Year bridge</th>
                {workbookView.yearGrid.headers.map((header) => (
                  <th key={`scpl-year-head-${header.key}`}>{header.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.yearGrid.mode === "personaRows"
                ? workbookView.yearGrid.rows.map((row) => (
                    <tr key={`scpl-year-grid-row-${row.rowNumber}`}>
                      <td className="fpa-cost-label-cell">
                        <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                      </td>
                      {row.values.map((value, index) => (
                        <td key={`scpl-year-grid-cell-${row.rowNumber}-${workbookView.yearGrid.headers[index].key}`} className="fpa-cost-value-cell">
                          {formatScplValue(value, row.format || "fte2")}
                        </td>
                      ))}
                    </tr>
                  ))
                : (
                  <>
                    <tr>
                      <td className="fpa-cost-label-cell">
                        <RowLabel primary="Tower total FTE" secondary="Workbook row 15  from 11 FTE Engine" />
                      </td>
                      {workbookView.yearGrid.totalFteByYear.map((value, index) => (
                        <td key={`scpl-total-fte-${workbookView.yearGrid.headers[index].key}`} className="fpa-cost-value-cell">
                          {formatScplValue(value, "fte2")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="fpa-cost-label-cell">
                        <RowLabel primary="India offshore FTE" secondary="Workbook row 16  total FTE  India share" />
                      </td>
                      {workbookView.yearGrid.offshoreFteByYear.map((value, index) => (
                        <td key={`scpl-offshore-fte-${workbookView.yearGrid.headers[index].key}`} className="fpa-cost-value-cell">
                          {formatScplValue(value, "fte2")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="fpa-cost-label-cell">
                        <RowLabel primary="In-term mask" secondary="Workbook row 17  1 means contract year is active" />
                      </td>
                      {workbookView.yearGrid.inTermMask.map((value, index) => (
                        <td key={`scpl-mask-${workbookView.yearGrid.headers[index].key}`} className="fpa-cost-value-cell">
                          {formatScplValue(value, "whole")}
                        </td>
                      ))}
                    </tr>
                  </>
                )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge={bandSection.badge}
        title={bandSection.title}
        note={bandSection.note}
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={getStatusTone(workbookView.compositionChecks.bandMixStatus)}>
              {workbookView.compositionChecks.bandMixStatus}
            </StatusPill>
            <StatusPill tone={getStatusTone(workbookView.compositionChecks.leadershipSpanStatus)}>
              {workbookView.compositionChecks.leadershipSpanStatus}
            </StatusPill>
          </div>
        }
      >
        <div className="fpa-scpl-summary-grid">
          <MetricCard
            label="Band Mix Total"
            value={formatScplValue(workbookView.compositionChecks.bandMixTotal, "percent1")}
            note="Must equal 100%"
          />
          <MetricCard
            label="Junior Share"
            value={formatScplValue(workbookView.compositionChecks.juniorShare, "percent1")}
            note="Rows 21-23"
          />
          <MetricCard
            label="Senior Share"
            value={formatScplValue(workbookView.compositionChecks.seniorShare, "percent1")}
            note="Rows 25-28"
          />
          <MetricCard
            label="Implied Span"
            value={typeof workbookView.compositionChecks.impliedSpan === "number"
              ? formatScplValue(workbookView.compositionChecks.impliedSpan, "number2")
              : String(workbookView.compositionChecks.impliedSpan || "-")}
            note={`Expected ${formatScplValue(workbookView.compositionChecks.expectedSpan, "number2")}`}
          />
        </div>

        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-scpl-band-table">
            <thead>
              <tr>
                <th>Band</th>
                <th>Mix %</th>
                <th>Steady FTE</th>
                <th>Staffing</th>
                <th>ARC USD</th>
                <th>ARC INR</th>
                <th>Loaded ARC / FTE</th>
                <th>Annual Cost</th>
                <th>Bill Rate / FTE</th>
                <th>Annual Price</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.bandRows.map((row) => (
                <tr key={`scpl-band-${row.rowNumber}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel
                      primary={`${row.bandCode}  ${row.label}`}
                      secondary={`${row.seedNote}  Workbook row ${row.rowNumber}`}
                    />
                  </td>
                  <td className="fpa-scpl-value-cell">
                    <ScplEditableField
                      kind={row.mixInput.kind}
                      label={`${row.label} mix %`}
                      value={readDraftValue(
                        draftInputs,
                        row.mixInput.address,
                        formatScplInputValue(row.mixInput.kind, row.mixInput.value),
                      )}
                      canEditFpa={canEditFpa && row.mixInput.readOnly !== true}
                      isBusy={isBusy}
                      onChange={(nextValue) => handleDraftChange(row.mixInput.address, nextValue)}
                      onCommit={(nextValue) => handleDraftCommit(row.mixInput.kind, row.mixInput.address, nextValue)}
                    />
                  </td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.steadyFte, "fte2")}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.staffingView, "number2")}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.standardArcUsd, "currency0")}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.standardArcInr, "currencyInr0")}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.blendedArcUsd, "currency2")}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.annualCostSteady, "currency0")}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.billRatePerFte, "currency2")}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.annualPriceSteady, "currency0")}</td>
                </tr>
              ))}
              <tr className="fpa-cost-total-row fpa-scpl-total-row">
                <td className="fpa-cost-label-cell">
                  <RowLabel primary="Total" secondary="Workbook rows 29-33 roll-up" />
                </td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.compositionChecks.bandMixTotal, "percent1")}</td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.locationSummary.totalFte, "fte2")}</td>
                <td className="fpa-cost-value-cell">{formatScplValue(bandStaffingTotal, "number2")}</td>
                <td className="fpa-cost-value-cell">-</td>
                <td className="fpa-cost-value-cell">-</td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.pricingTotals.blendedArcPerFte, "currency2")}</td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.pricingTotals.annualCostSteady, "currency0")}</td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.pricingTotals.billRatePerIndiaFte, "currency2")}</td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.pricingTotals.annualPriceSteady, "currency0")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge={locationSection.badge}
        title={locationSection.title}
        note={locationSection.note}
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={getStatusTone(workbookView.locationSummary.allocationStatus)}>
              {workbookView.locationSummary.allocationStatus}
            </StatusPill>
            <StatusPill tone={getStatusTone(workbookView.locationSummary.locationFactorStatus)}>
              {workbookView.locationSummary.locationFactorStatus}
            </StatusPill>
          </div>
        }
      >
        <div className="fpa-scpl-summary-grid">
          <MetricCard
            label="Allocation Total"
            value={formatScplValue(workbookView.locationSummary.allocationTotal, "percent1")}
            note="Must equal 100%"
          />
          <MetricCard
            label="Blended Factor"
            value={formatScplValue(workbookView.locationSummary.blendedLocationFactor, "number2")}
            note="Weighted location factor"
          />
          <MetricCard
            label="India Staffing"
            value={formatScplValue(workbookView.locationSummary.totalStaffing, "number2")}
            note="Rounded to 0.5 steps"
          />
          <MetricCard
            label="Sub-scale Check"
            value={workbookView.locationSummary.subScaleCenterStatus}
            note={`Minimum split size ${formatScplValue(workbookView.locationSummary.minSecondaryCenterFte, "whole")} FTE`}
          />
        </div>

        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-scpl-location-table">
            <thead>
              <tr>
                <th>Center</th>
                <th>Allocation %</th>
                <th>Factor</th>
                <th>Steady FTE</th>
                <th>Staffing</th>
                <th>Annual Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.locationRows.map((row) => (
                <tr key={`scpl-location-${row.rowNumber}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.name} secondary={`${row.region}  Workbook row ${row.rowNumber}`} />
                  </td>
                  <td className="fpa-scpl-value-cell">
                    <ScplEditableField
                      kind={row.allocationInput.kind}
                      label={`${row.name} allocation %`}
                      value={readDraftValue(
                        draftInputs,
                        row.allocationInput.address,
                        formatScplInputValue(row.allocationInput.kind, row.allocationInput.value),
                      )}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      onChange={(nextValue) => handleDraftChange(row.allocationInput.address, nextValue)}
                      onCommit={(nextValue) => handleDraftCommit(row.allocationInput.kind, row.allocationInput.address, nextValue)}
                    />
                  </td>
                  <td className="fpa-scpl-value-cell">
                    <ScplEditableField
                      kind={row.factorInput.kind}
                      label={`${row.name} location factor`}
                      value={readDraftValue(
                        draftInputs,
                        row.factorInput.address,
                        formatScplInputValue(row.factorInput.kind, row.factorInput.value),
                      )}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      onChange={(nextValue) => handleDraftChange(row.factorInput.address, nextValue)}
                      onCommit={(nextValue) => handleDraftCommit(row.factorInput.kind, row.factorInput.address, nextValue)}
                    />
                  </td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.steadyFte, "fte2")}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.staffingView, "number2")}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.annualCost, "currency0")}</td>
                  <td className="fpa-scpl-note-cell">{row.statusText}</td>
                </tr>
              ))}
              <tr className="fpa-cost-total-row fpa-scpl-total-row">
                <td className="fpa-cost-label-cell">
                  <RowLabel primary="Total" secondary="Workbook rows 59-63 summary" />
                </td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.locationSummary.allocationTotal, "percent1")}</td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.locationSummary.blendedLocationFactor, "number2")}</td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.locationSummary.totalFte, "fte2")}</td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.locationSummary.totalStaffing, "number2")}</td>
                <td className="fpa-cost-value-cell">{formatScplValue(workbookView.locationSummary.totalCost, "currency0")}</td>
                <td className="fpa-scpl-note-cell">{workbookView.locationSummary.subScaleCenterStatus}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge={yearViewSection.badge}
        title={yearViewSection.title}
        note={yearViewSection.note}
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-scpl-year-table">
            <thead>
              <tr>
                <th>Line</th>
                {workbookView.yearHeaders.map((header) => (
                  <th key={`scpl-year-view-${header.key}`}>{header.label}</th>
                ))}
                {yearViewSection.showTotalColumn !== false ? <th>In Term Total</th> : null}
              </tr>
            </thead>
            <tbody>
              {workbookView.yearViewRows.map((row) => (
                <tr key={`scpl-year-row-${row.rowNumber}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((value, index) => (
                    <td key={`scpl-year-cell-${row.rowNumber}-${workbookView.yearHeaders[index].key}`} className="fpa-cost-value-cell">
                      {formatScplValue(value, row.format)}
                    </td>
                  ))}
                  {yearViewSection.showTotalColumn !== false ? (
                    <td className="fpa-cost-value-cell">
                      {row.termTotal === null ? "-" : formatScplValue(row.termTotal, row.format)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge={reconciliationSection.badge}
        title={reconciliationSection.title}
        note={reconciliationSection.note}
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-scpl-recon-table">
            <thead>
              <tr>
                <th>Reconciliation line</th>
                <th>SCPL</th>
                <th>Model</th>
                <th>Delta</th>
                <th>Delta %</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.reconciliationRows.map((row) => (
                <tr key={`scpl-recon-${row.rowNumber}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.scplValue, row.format)}</td>
                  <td className="fpa-cost-value-cell">{formatScplValue(row.modelValue, row.format)}</td>
                  <td className="fpa-cost-value-cell">{row.deltaFormat === "text" ? "-" : formatScplValue(row.delta, row.deltaFormat)}</td>
                  <td className="fpa-cost-value-cell">{row.deltaPctFormat === "text" ? "-" : formatScplValue(row.deltaPct, row.deltaPctFormat)}</td>
                  <td className="fpa-scpl-note-cell">{row.read}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge={checkSection.badge}
        title={checkSection.title}
        note={checkSection.note}
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-scpl-check-table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
                <th>Section</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.checkRows.map((row) => (
                <tr key={`scpl-check-${row.rowNumber}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  <td className="fpa-scpl-status-cell">
                    <StatusPill tone={row.tone}>{row.status}</StatusPill>
                  </td>
                  <td className="fpa-scpl-note-cell">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
