import { useEffect, useMemo, useState } from "react";

import {
  buildP2pBusinessCaseWorkbookView,
  P2P_BUSINESS_CASE_INSPECT_AUTO,
  P2P_BUSINESS_CASE_SNAPSHOT,
  formatP2pBusinessCaseValue,
} from "../config/p2pBusinessCase";

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

function YearMatrixTable({ rows, yearHeaders, rowLabel = "Persona" }) {
  return (
    <div className="fpa-table-wrap fpa-cost-table-wrap">
      <table className="fpa-table fpa-cost-table fpa-cost-detail-table">
        <thead>
          <tr>
            <th>{rowLabel}</th>
            {yearHeaders.map((year) => (
              <th key={`business-year-head-${rowLabel}-${year.key}`}>{year.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`business-year-row-${row.key}`} className={row.isTotal ? "fpa-cost-total-row" : ""}>
              <td className="fpa-cost-label-cell">
                <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
              </td>
              {row.values.map((cell) => (
                <td key={`business-year-cell-${row.key}-${cell.key}`} className="fpa-cost-value-cell">{cell.text}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonaSummaryTable({ rows, personaHeaders, firstColumnLabel = "Metric" }) {
  return (
    <div className="fpa-table-wrap fpa-cost-table-wrap">
      <table className="fpa-table fpa-cost-table fpa-cost-summary-table">
        <thead>
          <tr>
            <th>{firstColumnLabel}</th>
            {personaHeaders.map((persona) => (
              <th key={`business-summary-head-${persona.key}`}>{persona.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`business-summary-row-${row.key}`}>
              <td className="fpa-cost-label-cell">
                <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
              </td>
              {row.values.map((cell) => (
                <td key={`business-summary-cell-${row.key}-${cell.key}`} className="fpa-cost-value-cell">{cell.text}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getPaybackTone(value) {
  if (typeof value === "string") {
    return "warning";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "neutral";
  }

  if (numeric <= 2) {
    return "success";
  }

  if (numeric <= 4) {
    return "info";
  }

  return "warning";
}

export default function P2pBusinessCasePage({ currentDeal, isBusy = false }) {
  const [inspectPersonaId, setInspectPersonaId] = useState(P2P_BUSINESS_CASE_INSPECT_AUTO);

  useEffect(() => {
    setInspectPersonaId(P2P_BUSINESS_CASE_INSPECT_AUTO);
  }, [currentDeal?.dealId]);

  const workbookView = useMemo(
    () => buildP2pBusinessCaseWorkbookView({ currentDeal, inspectPersonaId }),
    [currentDeal, inspectPersonaId],
  );

  const selectedPersona = workbookView.selectedPersona;
  const recommendedPersona = workbookView.recommendedPersona;
  const selectedSummary = selectedPersona?.summary || {};

  const inspectOptions = useMemo(
    () => [
      {
        key: P2P_BUSINESS_CASE_INSPECT_AUTO,
        label: `Auto - ${recommendedPersona?.label || "Standard"}`,
      },
      ...workbookView.personaHeaders.map((persona) => ({
        key: persona.key,
        label: persona.label,
      })),
    ],
    [recommendedPersona?.label, workbookView.personaHeaders],
  );

  return (
    <div className="fpa-form-stack fpa-cost-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local Business Case</span>
            <h4>{P2P_BUSINESS_CASE_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_BUSINESS_CASE_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone="info">{workbookView.transitionCommercials}</StatusPill>
            <StatusPill tone="info">{workbookView.transformationFunding}</StatusPill>
            <span className="section-chip">{P2P_BUSINESS_CASE_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Contract Term"
            value={`${workbookView.contractTermYears} years`}
            note="Deal Setup D11"
          />
          <MetricCard
            label="Discount Rate"
            value={formatP2pBusinessCaseValue(workbookView.discountRate, "percent1")}
            note="Deal Setup D12"
          />

          <MetricCard
            label="Y1 Billing Factor"
            value={formatP2pBusinessCaseValue(workbookView.y1BillingFactor, "percent1")}
            note="Transition row 15"
          />
          <MetricCard
            label="Auto Persona"
            value={recommendedPersona?.label || "-"}
            note="Current P2P recommended track"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 4-19"
        title="Deal controls, committed productivity, and price glide"
        note="The workbook first builds in-term and discount controls, then applies committed productivity by persona before rolling the annual recurring charge from Y1 to Y7. Deal-level committed productivity overrides win when present."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">5 personas</span>
            <span className="section-chip">7-year frame</span>
            <span className="section-chip">Y2-Y7 productivity</span>
          </div>
        }
      >
        <div className="fpa-cost-driver-grid">
          <article className="fpa-cost-driver-card">
            <span>Transition Commercials</span>
            <strong>{workbookView.transitionCommercials}</strong>
            <small>Controls transition fee treatment in row 22-26 and row 51</small>
          </article>
          <article className="fpa-cost-driver-card">
            <span>Transformation Funding</span>
            <strong>{workbookView.transformationFunding}</strong>
            <small>Controls transformation adders in row 22-33 and row 51</small>
          </article>
          <article className="fpa-cost-driver-card">
            <span>Auto Detail Persona</span>
            <strong>{recommendedPersona?.label || "-"}</strong>
            <small>Used by the selected-persona detail block when inspect is set to auto</small>
          </article>
        </div>

        <PersonaSummaryTable
          rows={[workbookView.inTermMaskRow, workbookView.discountFactorRow]}
          personaHeaders={workbookView.yearHeaders}
          firstColumnLabel="Deal control"
        />

        <YearMatrixTable
          rows={workbookView.committedProductivityRows}
          yearHeaders={workbookView.productivityHeaders}
          rowLabel="Persona"
        />

        <YearMatrixTable
          rows={workbookView.annualChargeRows}
          yearHeaders={workbookView.yearHeaders}
          rowLabel="Persona"
        />
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 22-47"
        title="Revenue, cost, and gross margin by persona"
        note="This is the exact multi-year economics stack from the workbook: revenue after transition billing logic, run-state plus funded cost treatment, gross margin $, and gross margin %."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Selected NPV {formatP2pBusinessCaseValue(selectedSummary.npv || 0, "currency0")}</span>
            <span className="section-chip">Selected payback {formatP2pBusinessCaseValue(selectedSummary.payback || ">term", "payback")}</span>
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
                  <option key={`business-case-inspect-${option.key}`} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="fpa-cost-inspector-summary">
              <MetricCard
                label="Selected TCV"
                value={formatP2pBusinessCaseValue(selectedSummary.tcv || 0, "currency0")}
                note="Workbook row 64"
              />
              <MetricCard
                label="Selected NPV"
                value={formatP2pBusinessCaseValue(selectedSummary.npv || 0, "currency0")}
                note="Workbook row 69"
              />
              <MetricCard
                label="Selected Avg GM %"
                value={formatP2pBusinessCaseValue(selectedSummary.avgGmPct || 0, "percent1")}
                note="Workbook row 71"
              />
              <MetricCard
                label="Selected Payback"
                value={formatP2pBusinessCaseValue(selectedSummary.payback || ">term", "payback")}
                note="Workbook row 70"
              />
            </div>
          </div>

          <div className="fpa-cost-driver-grid">
            <article className="fpa-cost-driver-card">
              <span>Provider-Carried Investment</span>
              <strong>{formatP2pBusinessCaseValue(selectedSummary.investment || 0, "currency0")}</strong>
              <small>Workbook row 51 for the inspected persona</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Min GM % Y2+ In-Term</span>
              <strong>{formatP2pBusinessCaseValue(selectedSummary.minGmY2InTerm || 0, "percent1")}</strong>
              <small>Workbook row 60</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Cumulative Net Cash</span>
              <strong>{formatP2pBusinessCaseValue(selectedSummary.cumulativeNetCashTerm || 0, "currency0")}</strong>
              <small>Workbook row 72 at the deal term year</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Transition Billing Logic</span>
              <strong>{formatP2pBusinessCaseValue(workbookView.y1BillingFactor, "percent1")}</strong>
              <small>Y1 recurring revenue is multiplied by this factor</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Recommended Persona</span>
              <strong>{recommendedPersona?.label || "-"}</strong>
              <small>Auto detail follows this until you pick a different persona</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Payback Status</span>
              <strong>
                <StatusPill tone={getPaybackTone(selectedSummary.payback)}>
                  {formatP2pBusinessCaseValue(selectedSummary.payback || ">term", "payback")}
                </StatusPill>
              </strong>
              <small>First year where cumulative net cash turns positive</small>
            </article>
          </div>
        </div>

        <div className="fpa-cost-persona-grid">
          {workbookView.personaCards.map((personaCard) => {
            const isSelected = personaCard.key === selectedPersona?.key;
            const isRecommended = personaCard.key === recommendedPersona?.key;

            return (
              <button
                key={personaCard.key}
                type="button"
                className={[
                  "fpa-cost-persona-card",
                  isSelected ? "is-selected" : "",
                  isRecommended ? "is-recommended" : "",
                ].filter(Boolean).join(" ")}
                disabled={isBusy}
                onClick={() => setInspectPersonaId(personaCard.key)}
              >
                <div className="fpa-cost-persona-card-top">
                  <span className="step-badge">{isRecommended ? "Auto" : "Persona"}</span>
                  <StatusPill tone={getPaybackTone(personaCard.summary?.payback)}>
                    {formatP2pBusinessCaseValue(personaCard.summary?.payback || ">term", "payback")}
                  </StatusPill>
                </div>
                <strong>{personaCard.label}</strong>
                <span className="fpa-cost-persona-card-value">{formatP2pBusinessCaseValue(personaCard.summary?.npv || 0, "currency0")}</span>
                <span className="fpa-cost-persona-card-note">
                  {`${formatP2pBusinessCaseValue(personaCard.summary?.avgGmPct || 0, "percent1")} avg GM | ${formatP2pBusinessCaseValue(personaCard.summary?.tcv || 0, "currency0")} TCV`}
                </span>
              </button>
            );
          })}
        </div>

        <YearMatrixTable rows={workbookView.revenueRows} yearHeaders={workbookView.yearHeaders} rowLabel="Revenue persona" />
        <YearMatrixTable rows={workbookView.costRows} yearHeaders={workbookView.yearHeaders} rowLabel="Cost persona" />
        <YearMatrixTable rows={workbookView.grossMarginRows} yearHeaders={workbookView.yearHeaders} rowLabel="GM$ persona" />
        <YearMatrixTable rows={workbookView.grossMarginPctRows} yearHeaders={workbookView.yearHeaders} rowLabel="GM% persona" />
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 50-81"
        title="Investment, term summary, and selected persona detail"
        note="The final workbook block carries provider-funded investment below gross margin, summarizes the in-term economics by persona, and then expands one selected persona across the full seven-year detail view."
      >
        <PersonaSummaryTable
          rows={workbookView.investmentSummaryRows}
          personaHeaders={workbookView.personaHeaders}
          firstColumnLabel="Metric"
        />

        <YearMatrixTable
          rows={workbookView.cumulativeCashRows}
          yearHeaders={workbookView.yearHeaders}
          rowLabel="Cumulative cash persona"
        />

        <PersonaSummaryTable
          rows={workbookView.termSummaryRows}
          personaHeaders={workbookView.personaHeaders}
          firstColumnLabel="Term summary metric"
        />

        <SectionCard
          badge="Workbook Rows 75-81"
          title={`Selected persona detail - ${selectedPersona?.label || "Standard"}`}
          note="Matches the workbook's final detail view block: revenue, cost, GM$, GM%, and cumulative cash for one persona across Y1-Y7."
          meta={
            <div className="fpa-tab-meta">
              <span className="section-chip">Detail index {selectedPersona?.index || 2}</span>
              <span className="section-chip">Auto persona {recommendedPersona?.label || "Standard"}</span>
            </div>
          }
        >
          <YearMatrixTable
            rows={selectedPersona?.detailRows || []}
            yearHeaders={workbookView.yearHeaders}
            rowLabel="Selected line"
          />
        </SectionCard>
      </SectionCard>
    </div>
  );
}


