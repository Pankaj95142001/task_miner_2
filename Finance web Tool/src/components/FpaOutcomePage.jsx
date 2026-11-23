import { useEffect, useMemo, useState } from "react";

import {
  buildFpaOutcomeWorkbookView,
  FPA_OUTCOME_INSPECT_AUTO,
  FPA_OUTCOME_SNAPSHOT,
  formatOutcomeInputValue,
  formatOutcomeValue,
  normalizeOutcomeInputValue,
} from "../config/fpaOutcome";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = FPA_OUTCOME_SNAPSHOT.sheetName;

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

  if (normalized.includes("OK") || normalized.startsWith("RECONCILES")) {
    return "success";
  }

  if (normalized.startsWith("FIX")) {
    return "danger";
  }

  return "neutral";
}

function AllocationInput({ value, canEditFpa, isBusy, label, onChange, onCommit }) {
  if (!canEditFpa) {
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
  return Object.fromEntries(
    workbookView.unitRows.map((row) => [row.allocationAddress, formatOutcomeInputValue("percent", row.allocationPct)]),
  );
}

export default function FpaOutcomePage({ currentDeal, canEditFpa, isBusy, onUpdateCell }) {
  const outcomeInputs = currentDeal?.fpaWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.fpaWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.fpaWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;

  const [inspectPersonaId, setInspectPersonaId] = useState(FPA_OUTCOME_INSPECT_AUTO);
  const workbookView = useMemo(
    () => buildFpaOutcomeWorkbookView({ currentDeal, inspectPersonaId }),
    [currentDeal, inspectPersonaId],
  );
  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(workbookView));

  useEffect(() => {
    setInspectPersonaId(FPA_OUTCOME_INSPECT_AUTO);
  }, [currentDeal?.dealId]);

  useEffect(() => {
    setDraftInputs(buildDraftInputs(workbookView));
  }, [currentDeal?.dealId, outcomeInputs]);

  const recommendedPersona = workbookView.recommendedPersona;
  const selectedPersona = workbookView.selectedPersona;
  const isAutoInspect = inspectPersonaId === FPA_OUTCOME_INSPECT_AUTO;

  const inspectOptions = useMemo(
    () => [
      {
        key: FPA_OUTCOME_INSPECT_AUTO,
        label: `Auto - ${recommendedPersona?.label || "Standard"}`,
      },
      ...workbookView.personaHeaders.map((persona) => ({
        key: persona.key,
        label: persona.label,
      })),
    ],
    [recommendedPersona?.label, workbookView.personaHeaders],
  );

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(row, nextValue) {
    const normalizedValue = normalizeOutcomeInputValue("percent", nextValue);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [row.allocationAddress]: formatOutcomeInputValue("percent", row.allocationPct),
      }));
      return;
    }

    setDraftInputs((previous) => ({
      ...previous,
      [row.allocationAddress]: formatOutcomeInputValue("percent", normalizedValue === "" ? "" : Number(normalizedValue)),
    }));

    if (typeof onUpdateCell === "function") {
      onUpdateCell(SHEET_NAME, row.allocationAddress, normalizedValue);
    }
  }

  return (
    <div className="fpa-form-stack fpa-cost-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Outcome</span>
            <h4>{FPA_OUTCOME_SNAPSHOT.title}</h4>
            <p className="section-note">{FPA_OUTCOME_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone={getStatusTone(workbookView.reconciliationMessage)}>{workbookView.reconciliationMessage}</StatusPill>
            <span className="section-chip">{FPA_OUTCOME_SNAPSHOT.formulaCount} formulas</span>
            <span className="section-chip">{FPA_OUTCOME_SNAPSHOT.editableCellCount} editable cells</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Recommended Persona"
            value={recommendedPersona?.label || "-"}
            note="Workbook row 4 default from Pricing recommendation"
          />
          <MetricCard
            label="Inspecting"
            value={selectedPersona?.label || "-"}
            note={isAutoInspect ? "Auto-follow mode" : "Manual inspection mode"}
          />
          <MetricCard
            label="Persona Index"
            value={formatOutcomeValue(selectedPersona?.index || 0, "whole")}
            note="Workbook row 5"
          />
          <MetricCard
            label="Recommended Annual Price"
            value={formatOutcomeValue(selectedPersona?.annualRecurringCharge || 0, "currency0")}
            note="Workbook row 6"
          />
          <MetricCard
            label="Total Allocation"
            value={formatOutcomeValue(workbookView.totals.totalAllocationPct, "percent1")}
            note="Workbook row 17"
          />
          <MetricCard
            label="Annual Check Total"
            value={formatOutcomeValue(workbookView.totals.annualCheckTotal, "currency0")}
            note="Workbook row 17"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 4-6"
        title="Persona and driver controls"
        note="The Excel outcome unit prices are recalculated from the selected persona's ARC and the scope-adjusted volume drivers below."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Forecast cycles {formatOutcomeValue(workbookView.forecastCyclesPerYear, "whole")}</span>
            <span className="section-chip">Zero-volume flags {formatOutcomeValue(workbookView.totals.zeroVolumeIssueCount, "whole")}</span>
          </div>
        }
      >
        <div className="fpa-cost-inspector-grid">
          <div className="fpa-cost-inspect-card">
            <label className="fpa-cost-picker">
              <span>Inspect persona</span>
              <select
                className="fpa-cost-select"
                value={inspectPersonaId}
                disabled={isBusy}
                onChange={(event) => setInspectPersonaId(event.target.value)}
              >
                {inspectOptions.map((option) => (
                  <option key={`outcome-inspect-${option.key}`} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="fpa-cost-inspector-summary">
              <MetricCard
                label="Recommended ARC"
                value={formatOutcomeValue(recommendedPersona?.annualRecurringCharge || 0, "currency0")}
                note="Pricing row 11"
              />
              <MetricCard
                label="Selected ARC"
                value={formatOutcomeValue(selectedPersona?.annualRecurringCharge || 0, "currency0")}
                note="Pricing row 11"
              />
              <MetricCard
                label="Annual Check Delta"
                value={formatOutcomeValue(workbookView.totals.annualRecurringChargeDelta, "currency0")}
                note="Check minus ARC"
              />
              <MetricCard
                label="Workbook Reconciliation"
                value={workbookView.reconciliationMessage}
                note="Workbook row 19"
              />
            </div>
          </div>

          <div className="fpa-cost-driver-grid">
            <article className="fpa-cost-driver-card">
              <span>Report Packs / Month</span>
              <strong>{formatOutcomeValue(workbookView.drivers.reportPacksPerMonth, "whole")}</strong>
              <small>Discovery row 20</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Forecast Cycles / Year</span>
              <strong>{formatOutcomeValue(workbookView.forecastCyclesPerYear, "whole")}</strong>
              <small>Workload cell C9</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Legal Entities</span>
              <strong>{formatOutcomeValue(workbookView.drivers.legalEntities, "whole")}</strong>
              <small>Discovery row 10</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Business Units</span>
              <strong>{formatOutcomeValue(workbookView.drivers.businessUnits, "whole")}</strong>
              <small>Discovery row 11</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Scope row 63</span>
              <strong>{formatOutcomeValue(workbookView.drivers.budgetingScopePct, "percent1")}</strong>
              <small>Annual Budgeting & Target Setting</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Scope row 64</span>
              <strong>{formatOutcomeValue(workbookView.drivers.rollingForecastScopePct, "percent1")}</strong>
              <small>Rolling Forecasting & IBP</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Scope row 68</span>
              <strong>{formatOutcomeValue(workbookView.drivers.cashFlowScopePct, "percent1")}</strong>
              <small>Cash Flow & Capital Planning</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Scope row 69</span>
              <strong>{formatOutcomeValue(workbookView.drivers.varianceScopePct, "percent1")}</strong>
              <small>Variance Analysis & Performance Management</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Scope row 70</span>
              <strong>{formatOutcomeValue(workbookView.drivers.managementReportingScopePct, "percent1")}</strong>
              <small>Management Reporting & Decision Support</small>
            </article>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 8-17"
        title="Outcome unit table"
        note="Allocation percentages are the only editable cells on this tab. Prices recalculate instantly using the same Excel structure: ARC x allocation / annual volume."
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-detail-table">
            <thead>
              <tr>
                <th>Outcome Unit</th>
                <th>Annual Volume (scope-adj.)</th>
                <th>Allocation %</th>
                <th>Price per Unit</th>
                <th>Annual Check</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.unitRows.map((row) => {
                const inputValue = readDraftValue(
                  draftInputs,
                  row.allocationAddress,
                  formatOutcomeInputValue("percent", row.allocationPct),
                );

                return (
                  <tr key={`outcome-row-${row.key}`}>
                    <td className="fpa-cost-label-cell">
                      <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber} - ${row.volumeSource}`} />
                    </td>
                    <td className="fpa-cost-value-cell">{formatOutcomeValue(row.annualVolume, "whole")}</td>
                    <td className="fpa-cost-value-cell">
                      <AllocationInput
                        value={inputValue}
                        canEditFpa={canEditFpa}
                        isBusy={isBusy}
                        label={`${row.label} allocation`}
                        onChange={(value) => handleDraftChange(row.allocationAddress, value)}
                        onCommit={(value) => handleDraftCommit(row, value)}
                      />
                    </td>
                    <td className="fpa-cost-value-cell">{formatOutcomeValue(row.unitPrice, "currency2")}</td>
                    <td className="fpa-cost-value-cell">{formatOutcomeValue(row.annualCheck, "currency0")}</td>
                    <td className="fpa-cost-value-cell">
                      {row.hasZeroVolumeAllocationIssue ? (
                        <StatusPill tone="warning">Zero volume with allocation</StatusPill>
                      ) : (
                        <StatusPill tone="success">OK</StatusPill>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="fpa-cost-total-row">
                <td className="fpa-cost-label-cell">
                  <RowLabel primary="TOTAL" secondary="Workbook row 17" />
                </td>
                <td className="fpa-cost-value-cell">-</td>
                <td className="fpa-cost-value-cell">{formatOutcomeValue(workbookView.totals.totalAllocationPct, "percent1")}</td>
                <td className="fpa-cost-value-cell">-</td>
                <td className="fpa-cost-value-cell">{formatOutcomeValue(workbookView.totals.annualCheckTotal, "currency0")}</td>
                <td className="fpa-cost-value-cell">
                  <StatusPill tone={getStatusTone(workbookView.reconciliationMessage)}>{workbookView.reconciliationMessage}</StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 19-21"
        title="Reconciliation and guardrails"
        note="This follows the workbook checks exactly: allocations must total 100%, then annual check must reconcile back to ARC."
      >
        <div className="fpa-cost-driver-grid">
          <article className="fpa-cost-driver-card">
            <span>Reconciliation</span>
            <strong>{workbookView.reconciliationMessage}</strong>
            <small>Workbook row 19</small>
          </article>
          <article className="fpa-cost-driver-card">
            <span>Annual Check Delta</span>
            <strong>{formatOutcomeValue(workbookView.totals.annualRecurringChargeDelta, "currency0")}</strong>
            <small>Annual check total minus ARC</small>
          </article>
          <article className="fpa-cost-driver-card">
            <span>Guard Note</span>
            <strong>{workbookView.totals.zeroVolumeIssueCount > 0 ? "Action needed" : "Clear"}</strong>
            <small>{workbookView.guardNote}</small>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
