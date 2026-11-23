import { useEffect, useMemo, useState } from "react";

import {
  buildP2pOutcomeWorkbookView,
  P2P_OUTCOME_INSPECT_AUTO,
  P2P_OUTCOME_SNAPSHOT,
  formatP2pOutcomeInputValue,
  formatP2pOutcomeValue,
  normalizeP2pOutcomeInputValue,
} from "../config/p2pOutcome";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = P2P_OUTCOME_SNAPSHOT.sheetName;

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

function AllocationInput({ value, canEditP2p, isBusy, label, onChange, onCommit }) {
  if (!canEditP2p) {
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
    workbookView.unitRows.map((row) => [row.allocationAddress, formatP2pOutcomeInputValue("percent", row.allocationPct)]),
  );
}

export default function P2pOutcomePage({ currentDeal, canEditP2p, isBusy, onUpdateCell }) {
  const outcomeInputs = currentDeal?.p2pWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.p2pWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.p2pWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;

  const [inspectPersonaId, setInspectPersonaId] = useState(P2P_OUTCOME_INSPECT_AUTO);
  const workbookView = useMemo(
    () => buildP2pOutcomeWorkbookView({ currentDeal, inspectPersonaId }),
    [currentDeal, inspectPersonaId],
  );
  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(workbookView));

  useEffect(() => {
    setInspectPersonaId(P2P_OUTCOME_INSPECT_AUTO);
  }, [currentDeal?.dealId]);

  useEffect(() => {
    setDraftInputs(buildDraftInputs(workbookView));
  }, [currentDeal?.dealId, outcomeInputs]);

  const recommendedPersona = workbookView.recommendedPersona;
  const selectedPersona = workbookView.selectedPersona;
  const isAutoInspect = inspectPersonaId === P2P_OUTCOME_INSPECT_AUTO;

  const inspectOptions = useMemo(
    () => [
      {
        key: P2P_OUTCOME_INSPECT_AUTO,
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
    const normalizedValue = normalizeP2pOutcomeInputValue("percent", nextValue);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [row.allocationAddress]: formatP2pOutcomeInputValue("percent", row.allocationPct),
      }));
      return;
    }

    setDraftInputs((previous) => ({
      ...previous,
      [row.allocationAddress]: formatP2pOutcomeInputValue("percent", normalizedValue === "" ? "" : Number(normalizedValue)),
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
            <span className="step-badge">Local Outcome</span>
            <h4>{P2P_OUTCOME_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_OUTCOME_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={getStatusTone(workbookView.reconciliationMessage)}>{workbookView.reconciliationMessage}</StatusPill>
            <span className="section-chip">{P2P_OUTCOME_SNAPSHOT.formulaCount} formulas</span>
            <span className="section-chip">{P2P_OUTCOME_SNAPSHOT.editableCellCount} editable cells</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Inspect Persona"
            value={formatP2pOutcomeValue(selectedPersona?.index || 0, "whole")}
            note={selectedPersona?.label || "Standard"}
          />
          <MetricCard
            label="Selected ARC"
            value={formatP2pOutcomeValue(selectedPersona?.annualRecurringCharge || 0, "currency0")}
            note="Pricing recommended annual price"
          />
          <MetricCard
            label="Allocation Total"
            value={formatP2pOutcomeValue(workbookView.totals.totalAllocationPct, "percent1")}
            note="Must total 100%"
          />
          <MetricCard
            label="Annual Check"
            value={formatP2pOutcomeValue(workbookView.totals.annualCheckTotal, "currency0")}
            note="Sum of all outcome checks"
          />
          <MetricCard
            label="Default Allocation Mode"
            value={workbookView.allocationMode}
            note="Blank sheet inputs follow local workload mix"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 4-6"
        title="Persona and driver controls"
        note="Outcome unit prices are recalculated from the selected persona ARC and the scope-adjusted P2P volume drivers below."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={isAutoInspect ? "info" : "warning"}>{isAutoInspect ? "Auto" : "Manual"}</StatusPill>
            <span className="section-chip">{formatP2pOutcomeValue(workbookView.selectedL2Count, "whole")} L2 in scope</span>
            <span className="section-chip">{formatP2pOutcomeValue(workbookView.totalMonthlyHours, "number2")} monthly hours</span>
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
                  <option key={`p2p-outcome-inspect-${option.key}`} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="fpa-cost-inspector-summary">
              <MetricCard
                label="Recommended ARC"
                value={formatP2pOutcomeValue(recommendedPersona?.annualRecurringCharge || 0, "currency0")}
                note="From local pricing"
              />
              <MetricCard
                label="Selected ARC"
                value={formatP2pOutcomeValue(selectedPersona?.annualRecurringCharge || 0, "currency0")}
                note="From local pricing"
              />
              <MetricCard
                label="Annual Check Delta"
                value={formatP2pOutcomeValue(workbookView.totals.annualRecurringChargeDelta, "currency0")}
                note="Check minus ARC"
              />
              <MetricCard
                label="Reconciliation"
                value={workbookView.reconciliationMessage}
                note="Outcome guardrail"
              />
            </div>
          </div>

          <div className="fpa-cost-driver-grid">
            <article className="fpa-cost-driver-card">
              <span>Requisitions / yr</span>
              <strong>{formatP2pOutcomeValue(Number(workbookView.drivers.requisitions000 || 0) * 1000, "whole")}</strong>
              <small>Discovery row 17</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Purchase Orders / yr</span>
              <strong>{formatP2pOutcomeValue(Number(workbookView.drivers.purchaseOrders000 || 0) * 1000, "whole")}</strong>
              <small>Discovery row 16</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Supplier Invoices / yr</span>
              <strong>{formatP2pOutcomeValue(Number(workbookView.drivers.supplierInvoices000 || 0) * 1000, "whole")}</strong>
              <small>Discovery row 15</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Active Vendors</span>
              <strong>{formatP2pOutcomeValue(Number(workbookView.drivers.activeVendors000 || 0) * 1000, "whole")}</strong>
              <small>Discovery row 18</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Payment Runs / Month</span>
              <strong>{formatP2pOutcomeValue(workbookView.drivers.paymentRunsPerMonth || 0, "whole")}</strong>
              <small>Discovery row 19</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>T&E Claims / yr</span>
              <strong>{formatP2pOutcomeValue(Number(workbookView.drivers.tneClaims000 || 0) * 1000, "whole")}</strong>
              <small>Discovery row 21</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>PO-Backed Spend Share</span>
              <strong>{formatP2pOutcomeValue(workbookView.drivers.poBackedSpendShare || 0, "percent1")}</strong>
              <small>Discovery row 22</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Invoice Exception Rate</span>
              <strong>{formatP2pOutcomeValue(workbookView.drivers.invoiceExceptionRate || 0, "percent1")}</strong>
              <small>Discovery row 20</small>
            </article>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 8-18"
        title="Outcome unit table"
        note="Allocation percentages are the editable cells on this tab. Prices recalculate instantly using ARC x allocation / annual volume."
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
                  formatP2pOutcomeInputValue("percent", row.allocationPct),
                );

                return (
                  <tr key={`p2p-outcome-row-${row.key}`}>
                    <td className="fpa-cost-label-cell">
                      <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber} - ${row.volumeSource}`} />
                    </td>
                    <td className="fpa-cost-value-cell">{formatP2pOutcomeValue(row.annualVolume, "whole")}</td>
                    <td className="fpa-cost-value-cell">
                      <AllocationInput
                        value={inputValue}
                        canEditP2p={canEditP2p}
                        isBusy={isBusy}
                        label={`${row.label} allocation`}
                        onChange={(value) => handleDraftChange(row.allocationAddress, value)}
                        onCommit={(value) => handleDraftCommit(row, value)}
                      />
                    </td>
                    <td className="fpa-cost-value-cell">{formatP2pOutcomeValue(row.unitPrice, "currency2")}</td>
                    <td className="fpa-cost-value-cell">{formatP2pOutcomeValue(row.annualCheck, "currency0")}</td>
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
                  <RowLabel primary="TOTAL" secondary="Workbook row 18" />
                </td>
                <td className="fpa-cost-value-cell">-</td>
                <td className="fpa-cost-value-cell">{formatP2pOutcomeValue(workbookView.totals.totalAllocationPct, "percent1")}</td>
                <td className="fpa-cost-value-cell">-</td>
                <td className="fpa-cost-value-cell">{formatP2pOutcomeValue(workbookView.totals.annualCheckTotal, "currency0")}</td>
                <td className="fpa-cost-value-cell">
                  <StatusPill tone={getStatusTone(workbookView.reconciliationMessage)}>{workbookView.reconciliationMessage}</StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 20-22"
        title="Reconciliation and guardrails"
        note="Allocations must total 100%, then annual check must reconcile back to ARC."
      >
        <div className="fpa-cost-driver-grid">
          <article className="fpa-cost-driver-card">
            <span>Reconciliation</span>
            <strong>{workbookView.reconciliationMessage}</strong>
            <small>Outcome guardrail</small>
          </article>
          <article className="fpa-cost-driver-card">
            <span>Annual Check Delta</span>
            <strong>{formatP2pOutcomeValue(workbookView.totals.annualRecurringChargeDelta, "currency0")}</strong>
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
