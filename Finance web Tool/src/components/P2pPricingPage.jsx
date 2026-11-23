import { useEffect, useMemo, useState } from "react";

import {
  buildP2pPricingWorkbookView,
  P2P_PRICING_INSPECT_AUTO,
  P2P_PRICING_SNAPSHOT,
  formatP2pPricingInputValue,
  formatP2pPricingValue,
  normalizeP2pPricingInputValue,
} from "../config/p2pPricing";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = P2P_PRICING_SNAPSHOT.sheetName;

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

  if (normalized.startsWith("AMBER")) {
    return "warning";
  }

  if (normalized.startsWith("RED")) {
    return "danger";
  }

  return "neutral";
}

function PricingInputControl({ control, value, canEditP2p, isBusy, onChange, onCommit }) {
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
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      aria-label={control.label}
    />
  );
}

function buildDraftInputs(workbookView) {
  return {
    [workbookView.controls.commercialGmFloor.address]: formatP2pPricingInputValue(
      workbookView.controls.commercialGmFloor.kind,
      workbookView.controls.commercialGmFloor.value,
    ),
    [workbookView.controls.gainshareProviderShare.address]: formatP2pPricingInputValue(
      workbookView.controls.gainshareProviderShare.kind,
      workbookView.controls.gainshareProviderShare.value,
    ),
  };
}

export default function P2pPricingPage({
  currentDeal,
  canEditP2p,
  isBusy,
  onUpdateCell,
}) {
  const pricingInputs = currentDeal?.p2pWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.p2pWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.p2pWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;
  const [inspectPersonaId, setInspectPersonaId] = useState(P2P_PRICING_INSPECT_AUTO);

  const workbookView = useMemo(
    () => buildP2pPricingWorkbookView({ currentDeal, inspectPersonaId }),
    [currentDeal, inspectPersonaId],
  );

  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(workbookView));

  useEffect(() => {
    setInspectPersonaId(P2P_PRICING_INSPECT_AUTO);
  }, [currentDeal?.dealId]);

  useEffect(() => {
    setDraftInputs(buildDraftInputs(workbookView));
  }, [currentDeal?.dealId, pricingInputs]);

  const recommendedPersona = workbookView.recommendedPersona;
  const selectedPersona = workbookView.selectedPersona;
  const inspectOptions = useMemo(
    () => [
      {
        key: P2P_PRICING_INSPECT_AUTO,
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

  function handleDraftCommit(control, nextValue) {
    const normalizedValue = normalizeP2pPricingInputValue(control.kind, nextValue);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [control.address]: formatP2pPricingInputValue(control.kind, control.value),
      }));
      return;
    }

    setDraftInputs((previous) => ({
      ...previous,
      [control.address]: normalizedValue === "" ? "" : formatP2pPricingInputValue(control.kind, normalizedValue),
    }));

    onUpdateCell(SHEET_NAME, control.address, normalizedValue);
  }

  return (
    <div className="fpa-form-stack fpa-cost-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local Pricing</span>
            <h4>{P2P_PRICING_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_PRICING_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone={getStatusTone(selectedPersona?.metrics?.marginAlert)}>
              {selectedPersona?.metrics?.marginAlert || "GREEN"}
            </StatusPill>
            <span className="section-chip">{P2P_PRICING_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Recommended Persona"
            value={recommendedPersona?.label || "-"}
            note="Pulled from the local P2P ops model persona selection"
          />
          <MetricCard
            label="Inspecting"
            value={selectedPersona?.label || "-"}
            note={inspectPersonaId === P2P_PRICING_INSPECT_AUTO ? "Auto-follow mode" : "Manual inspection mode"}
          />
          <MetricCard
            label="Recommended Annual Price"
            value={formatP2pPricingValue(selectedPersona?.metrics?.recommendedAnnualPrice || 0, "currency0")}
            note="Workbook row 11"
          />
          <MetricCard
            label="Gross Margin %"
            value={formatP2pPricingValue(selectedPersona?.metrics?.grossMarginPct || 0, "percent1")}
            note="Workbook row 14"
          />
          <MetricCard
            label="Monthly Invoice"
            value={formatP2pPricingValue(selectedPersona?.metrics?.monthlyInvoiceSteady || 0, "currency0")}
            note="Workbook row 17"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Controls"
        title="Pricing controls and market context"
        note="Only the commercial GM floor and gainshare provider share are direct workbook inputs on this sheet. Competition bias is derived from Discovery competitive intensity."
      >
        <div className="fpa-cost-driver-grid">
          <article className="fpa-cost-driver-card">
            <span>{workbookView.controls.commercialGmFloor.label}</span>
            <PricingInputControl
              control={workbookView.controls.commercialGmFloor}
              value={readDraftValue(
                draftInputs,
                workbookView.controls.commercialGmFloor.address,
                formatP2pPricingInputValue(workbookView.controls.commercialGmFloor.kind, workbookView.controls.commercialGmFloor.value),
              )}
              canEditP2p={canEditP2p}
              isBusy={isBusy}
              onChange={(nextValue) => handleDraftChange(workbookView.controls.commercialGmFloor.address, nextValue)}
              onCommit={(nextValue) => handleDraftCommit(workbookView.controls.commercialGmFloor, nextValue)}
            />
            <small>{`Workbook row ${workbookView.controls.commercialGmFloor.rowNumber}`}</small>
          </article>

          <article className="fpa-cost-driver-card">
            <span>{workbookView.controls.competitionBias.label}</span>
            <strong>{formatP2pPricingValue(workbookView.controls.competitionBias.value, "factor2")}</strong>
            <small>{`Derived from Discovery: ${workbookView.controls.competitionBias.source || "Default"}`}</small>
          </article>

          <article className="fpa-cost-driver-card">
            <span>{workbookView.controls.gainshareProviderShare.label}</span>
            <PricingInputControl
              control={workbookView.controls.gainshareProviderShare}
              value={readDraftValue(
                draftInputs,
                workbookView.controls.gainshareProviderShare.address,
                formatP2pPricingInputValue(workbookView.controls.gainshareProviderShare.kind, workbookView.controls.gainshareProviderShare.value),
              )}
              canEditP2p={canEditP2p}
              isBusy={isBusy}
              onChange={(nextValue) => handleDraftChange(workbookView.controls.gainshareProviderShare.address, nextValue)}
              onCommit={(nextValue) => handleDraftCommit(workbookView.controls.gainshareProviderShare, nextValue)}
            />
            <small>{`Workbook row ${workbookView.controls.gainshareProviderShare.rowNumber}`}</small>
          </article>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 7-18"
        title="Pricing grid across personas"
        note="This is the full workbook pricing block: cost floor, target, markup, recommended price, margin checks, monthly invoice, and delivered-FTE bill rate."
      >
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
                  <span className="step-badge">{isRecommended ? "Recommended" : "Persona"}</span>
                  <StatusPill tone={getStatusTone(personaCard.alert)}>{personaCard.alert}</StatusPill>
                </div>
                <strong>{personaCard.label}</strong>
                <span className="fpa-cost-persona-card-value">{personaCard.valueText}</span>
                <span className="fpa-cost-persona-card-note">{personaCard.note}</span>
              </button>
            );
          })}
        </div>

        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-summary-table">
            <thead>
              <tr>
                <th>Pricing line</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th key={`pricing-head-${persona.key}`}>{persona.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.summaryRows.map((row) => (
                <tr key={`pricing-row-${row.key}`} className={row.isTotal ? "fpa-cost-total-row" : ""}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => (
                    <td key={`pricing-${row.key}-${cell.key}`} className="fpa-cost-value-cell">
                      {row.format === "status"
                        ? <StatusPill tone={getStatusTone(cell.value)}>{cell.text}</StatusPill>
                        : cell.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Selected Persona"
        title={`Pricing review - ${selectedPersona?.label || "Standard"}`}
        note="Use this view to compare the recommended price against the floor, target margin, and markup-based commercial anchor for the selected persona."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={getStatusTone(selectedPersona?.metrics?.biasClampFlag)}>{selectedPersona?.metrics?.biasClampFlag || "OK"}</StatusPill>
            <StatusPill tone={getStatusTone(selectedPersona?.metrics?.marginAlert)}>{selectedPersona?.metrics?.marginAlert || "GREEN"}</StatusPill>
          </div>
        }
      >
        <div className="fpa-cost-inspector-grid">
          <div className="fpa-cost-inspect-card">
            <label className="fpa-cost-picker">
              <span>Jump to persona</span>
              <select
                className="fpa-cost-select"
                value={inspectPersonaId}
                disabled={isBusy}
                onChange={(event) => setInspectPersonaId(event.target.value)}
              >
                {inspectOptions.map((option) => (
                  <option key={`pricing-inspect-${option.key}`} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="fpa-cost-inspector-summary">
              <MetricCard
                label="Floor Price"
                value={formatP2pPricingValue(selectedPersona?.metrics?.floorPrice || 0, "currency0")}
                note="Workbook row 8"
              />
              <MetricCard
                label="Target Price"
                value={formatP2pPricingValue(selectedPersona?.metrics?.targetPrice || 0, "currency0")}
                note="Workbook row 9"
              />
              <MetricCard
                label="Markup Price"
                value={formatP2pPricingValue(selectedPersona?.metrics?.markupPrice || 0, "currency0")}
                note="Workbook row 10"
              />
              <MetricCard
                label="Recommended Price"
                value={formatP2pPricingValue(selectedPersona?.metrics?.recommendedAnnualPrice || 0, "currency0")}
                note="Workbook row 11"
              />
              <MetricCard
                label="Gross Margin $"
                value={formatP2pPricingValue(selectedPersona?.metrics?.grossMarginAmount || 0, "currency0")}
                note="Workbook row 13"
              />
              <MetricCard
                label="Delivered FTE Bill Rate"
                value={formatP2pPricingValue(selectedPersona?.metrics?.blendedBillRatePerDeliveredFteY1 || 0, "currency2")}
                note="Workbook row 18"
              />
            </div>
          </div>

          <div className="fpa-cost-driver-grid">
            <article className="fpa-cost-driver-card">
              <span>Target Gross Margin</span>
              <strong>{formatP2pPricingValue(selectedPersona?.metrics?.targetGrossMarginPct || 0, "percent1")}</strong>
              <small>Personas row 23</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Markup on Cost</span>
              <strong>{formatP2pPricingValue(selectedPersona?.metrics?.markupOnCostPct || 0, "percent1")}</strong>
              <small>Personas row 24</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Risk Premium</span>
              <strong>{formatP2pPricingValue(selectedPersona?.metrics?.riskPremiumPct || 0, "percent1")}</strong>
              <small>Personas row 25</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Competition Bias</span>
              <strong>{formatP2pPricingValue(selectedPersona?.metrics?.competitionBias || 0, "factor2")}</strong>
              <small>{workbookView.competitiveIntensity || "Discovery default"}</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>GM vs Persona Target</span>
              <strong>{formatP2pPricingValue(selectedPersona?.metrics?.gmVsPersonaTargetPp || 0, "pp1")}</strong>
              <small>Workbook row 15</small>
            </article>
            <article className="fpa-cost-driver-card">
              <span>Gainshare Base Price</span>
              <strong>{formatP2pPricingValue(selectedPersona?.metrics?.gainshareBasePrice || 0, "currency0")}</strong>
              <small>Workbook row 23</small>
            </article>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 22-26"
        title="Construct outputs"
        note="The workbook gives direct annual fixed-fee and gainshare base price outputs, then carries a note for the T&M commercial view."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Provider share {formatP2pPricingValue(workbookView.controls.gainshareProviderShare.value, "percent1")}</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-cost-summary-table">
            <thead>
              <tr>
                <th>Construct line</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th key={`construct-head-${persona.key}`}>{persona.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workbookView.constructRows.map((row) => (
                <tr key={`construct-row-${row.key}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => (
                    <td key={`construct-${row.key}-${cell.key}`} className="fpa-cost-value-cell">{cell.text}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fpa-cost-driver-grid">
          <article className="fpa-cost-driver-card">
            <span>T&M Commercial View</span>
            <strong>Rate card + markup</strong>
            <small>{workbookView.constructNote}</small>
          </article>
          <article className="fpa-cost-driver-card">
            <span>Competition Bias Source</span>
            <strong>{workbookView.competitiveIntensity || "Medium (2-3 bidders)"}</strong>
            <small>Workbook row 4 derived from Discovery row 28</small>
          </article>
          <article className="fpa-cost-driver-card">
            <span>Gainshare Provider Share</span>
            <strong>{formatP2pPricingValue(workbookView.controls.gainshareProviderShare.value, "percent1")}</strong>
            <small>Saved in workbook input cell C24 for downstream constructs</small>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}


