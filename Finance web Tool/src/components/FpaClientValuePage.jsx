import { useEffect, useMemo, useState } from "react";

import {
  buildFpaClientValueWorkbookView,
  FPA_CLIENT_VALUE_SNAPSHOT,
  formatClientValueInputValue,
  formatClientValueValue,
  normalizeClientValueInputValue,
} from "../config/fpaClientValue";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = FPA_CLIENT_VALUE_SNAPSHOT.sheetName;

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

function savingsTone(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "neutral";
  }
  if (numeric > 0) {
    return "success";
  }
  if (numeric < 0) {
    return "danger";
  }
  return "neutral";
}

function buildDraftInputs(workbookView) {
  return {
    [workbookView.controls.baselineOverheadUplift.address]: formatClientValueInputValue(
      workbookView.controls.baselineOverheadUplift.kind,
      workbookView.controls.baselineOverheadUplift.value,
    ),
  };
}

function PercentInput({ value, canEditFpa, isBusy, onChange, onCommit }) {
  if (!canEditFpa) {
    return <strong>{value || "-"}</strong>;
  }

  return (
    <input
      className="fpa-client-value-input"
      type="text"
      inputMode="decimal"
      value={value}
      disabled={isBusy}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export default function FpaClientValuePage({
  currentDeal,
  canEditFpa,
  isBusy,
  onUpdateCell,
}) {
  const clientValueInputs = currentDeal?.fpaWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.fpaWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.fpaWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;

  const workbookView = useMemo(
    () => buildFpaClientValueWorkbookView({ currentDeal }),
    [currentDeal],
  );

  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(workbookView));

  useEffect(() => {
    setDraftInputs(buildDraftInputs(workbookView));
  }, [currentDeal?.dealId, clientValueInputs, workbookView.controls.baselineOverheadUplift.value]);

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(control, nextValue) {
    const normalizedValue = normalizeClientValueInputValue(control.kind, nextValue);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [control.address]: formatClientValueInputValue(control.kind, control.value),
      }));
      return;
    }

    setDraftInputs((previous) => ({
      ...previous,
      [control.address]: normalizedValue === "" ? "" : formatClientValueInputValue(control.kind, normalizedValue),
    }));

    if (typeof onUpdateCell === "function") {
      onUpdateCell(SHEET_NAME, control.address, normalizedValue);
    }
  }

  return (
    <div className="fpa-form-stack fpa-cost-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Client Value</span>
            <h4>{FPA_CLIENT_VALUE_SNAPSHOT.title}</h4>
            <p className="section-note">{FPA_CLIENT_VALUE_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone={workbookView.usesCustomerBaseline ? "success" : "warning"}>
              {workbookView.usesCustomerBaseline ? "Customer baseline" : "Proxy baseline"}
            </StatusPill>
            <StatusPill tone={savingsTone(workbookView.termSavings)}>
              {workbookView.termSavings > 0 ? "Positive savings" : workbookView.termSavings < 0 ? "Negative savings" : "Flat savings"}
            </StatusPill>
            <span className="section-chip">{FPA_CLIENT_VALUE_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Persona"
            value={workbookView.recommendedPersona.label}
            note="Workbook row 5"
          />
          <MetricCard
            label="Persona Index"
            value={formatClientValueValue(workbookView.recommendedPersona.index, "whole")}
            note="Workbook row 6"
          />
          <MetricCard
            label="Transferred Share"
            value={formatClientValueValue(workbookView.contextRows[2].value, "percent1")}
            note="Workbook row 8"
          />
          <MetricCard
            label="Baseline Y1"
            value={formatClientValueValue(workbookView.contextRows[4].value, "currency0")}
            note="Workbook row 10"
          />
          <MetricCard
            label="Term Savings"
            value={formatClientValueValue(workbookView.termSavings, "currency0")}
            note="Workbook row 22"
          />
          <MetricCard
            label="Term Savings %"
            value={formatClientValueValue(workbookView.termSavingsPct, "percent1")}
            note="Workbook row 23"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 5-10"
        title="Client baseline assumptions"
        note="The portal mirrors the workbook baseline logic: use customer baseline if provided; otherwise apply the benchmarked client cost-per-FTE proxy and uplift, then scale by transferred share."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Client cost / FTE {formatClientValueValue(workbookView.benchmarkClientCostPerFte, "currency0")}</span>
            <span className="section-chip">Inflation {formatClientValueValue(workbookView.benchmarkInflationPct, "percent1")}</span>
          </div>
        }
      >
        <div className="fpa-client-value-assumption-grid">
          {workbookView.contextRows.slice(0, 3).map((row) => (
            <MetricCard
              key={`client-context-${row.key}`}
              label={row.label}
              value={formatClientValueValue(row.value, row.format)}
              note={`Workbook row ${row.rowNumber}`}
            />
          ))}

          <article className="metric-card">
            <span className="metric-label">{workbookView.controls.baselineOverheadUplift.label}</span>
            <PercentInput
              value={draftInputs[workbookView.controls.baselineOverheadUplift.address] ?? formatClientValueInputValue("percent", workbookView.controls.baselineOverheadUplift.value)}
              canEditFpa={canEditFpa}
              isBusy={isBusy}
              onChange={(value) => handleDraftChange(workbookView.controls.baselineOverheadUplift.address, value)}
              onCommit={(value) => handleDraftCommit(workbookView.controls.baselineOverheadUplift, value)}
            />
            <span className="metric-note">Workbook row 9</span>
          </article>

          <MetricCard
            label={workbookView.contextRows[4].label}
            value={formatClientValueValue(workbookView.contextRows[4].value, workbookView.contextRows[4].format)}
            note="Workbook row 10"
          />
        </div>

        <div className="fpa-deal-risk-rationale fpa-client-value-note">
          <span className="section-kicker">Workbook row 20</span>
          <strong>{workbookView.baselineSourceMessage}</strong>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 11-18"
        title="Year-by-year client value bridge"
        note="Each year shows the in-term mask, inflated client baseline, our annual recurring charge, savings delta, cumulative savings, and gainshare pool."
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-client-value-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>In term?</th>
                <th>Client baseline</th>
                <th>Our ARC</th>
                <th>Savings $</th>
                <th>Savings %</th>
                <th>Cumulative savings</th>
                <th>Gainshare pool</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.yearRows.map((row) => (
                <tr key={`client-value-year-${row.key}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  <td className="fpa-risk-status-cell">{row.inTerm ? "1" : "0"}</td>
                  <td className="fpa-cost-value-cell">{formatClientValueValue(row.clientBaselineInflated, "currency0")}</td>
                  <td className="fpa-cost-value-cell">{formatClientValueValue(row.ourArc, "currency0")}</td>
                  <td className={`fpa-cost-value-cell fpa-client-value-delta ${row.savings > 0 ? "is-positive" : row.savings < 0 ? "is-negative" : ""}`}>
                    {formatClientValueValue(row.savings, "currency0")}
                  </td>
                  <td className={`fpa-cost-value-cell fpa-client-value-delta ${row.savingsPct > 0 ? "is-positive" : row.savingsPct < 0 ? "is-negative" : ""}`}>
                    {formatClientValueValue(row.savingsPct, "percent1")}
                  </td>
                  <td className={`fpa-cost-value-cell fpa-client-value-delta ${row.cumulativeSavings > 0 ? "is-positive" : row.cumulativeSavings < 0 ? "is-negative" : ""}`}>
                    {formatClientValueValue(row.cumulativeSavings, "currency0")}
                  </td>
                  <td className="fpa-cost-value-cell">{formatClientValueValue(row.gainsharePool, "currency0")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 22-24"
        title="Term summary"
        note="This section rolls only the in-term years into total savings, savings percent, and baseline."
      >
        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Term Savings"
            value={formatClientValueValue(workbookView.termSavings, "currency0")}
            note="Workbook row 22"
          />
          <MetricCard
            label="Term Savings % of Baseline"
            value={formatClientValueValue(workbookView.termSavingsPct, "percent1")}
            note="Workbook row 23"
          />
          <MetricCard
            label="Baseline (Term, Undiscounted)"
            value={formatClientValueValue(workbookView.termBaseline, "currency0")}
            note="Workbook row 24"
          />
          <MetricCard
            label="Gainshare Pool"
            value={formatClientValueValue(workbookView.totalGainsharePool, "currency0")}
            note="Workbook rows 12-18 total"
          />
        </div>
      </SectionCard>
    </div>
  );
}