import { useEffect, useMemo, useState } from "react";

import {
  buildP2pRateCardWorkbookView,
  formatRateCardInputValue,
  formatRateCardValue,
  P2P_RATE_CARD_SNAPSHOT,
  normalizeRateCardInputValue,
  RATE_CARD_CONFIRM_OPTIONS,
} from "../config/p2pRateCard";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = P2P_RATE_CARD_SNAPSHOT.sheetName;

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
    <div className="fpa-rate-card-row-label">
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

function RateCardInputCell({
  kind,
  address,
  label,
  value,
  canEditP2p,
  isBusy,
  onChange,
  onCommit,
}) {
  if (kind === "choice") {
    return (
      <select
        aria-label={label}
        className="fpa-rate-card-select"
        value={value}
        disabled={!canEditP2p || isBusy}
        onChange={(event) => onCommit(event.target.value)}
      >
        {RATE_CARD_CONFIRM_OPTIONS.map((option) => (
          <option key={`${address}-${option}`} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (!canEditP2p) {
    return <span className="fpa-rate-card-readonly">{value || "—"}</span>;
  }

  return (
    <input
      aria-label={label}
      type="text"
      className={`fpa-rate-card-input ${kind !== "choice" ? "is-numeric" : ""}`.trim()}
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
  );
}

function buildDraftInputs(workbookView) {
  const nextDraftInputs = {};

  workbookView.baseSalaryRows.forEach((row) => {
    Object.values(row.values).forEach((cell) => {
      nextDraftInputs[cell.address] = formatRateCardInputValue("whole", cell.value);
    });
  });

  Object.values(workbookView.benefitsLoadRow.values).forEach((cell) => {
    nextDraftInputs[cell.address] = formatRateCardInputValue("percent", cell.value);
  });

  workbookView.locationFactorRows.forEach((row) => {
    Object.values(row.values).forEach((cell) => {
      nextDraftInputs[cell.address] = formatRateCardInputValue(row.kind, cell.value);
    });
  });

  workbookView.technologyCostRows.forEach((row) => {
    Object.values(row.values).forEach((cell) => {
      nextDraftInputs[cell.address] = formatRateCardInputValue(row.kind, cell.value);
    });
  });

  nextDraftInputs[workbookView.backfillMultiplier.address] = formatRateCardInputValue(workbookView.backfillMultiplier.kind, workbookView.backfillMultiplier.value);
  nextDraftInputs[workbookView.agentRunCost.address] = formatRateCardInputValue(workbookView.agentRunCost.kind, workbookView.agentRunCost.value);
  nextDraftInputs[workbookView.consumptionCost.address] = formatRateCardInputValue(workbookView.consumptionCost.kind, workbookView.consumptionCost.value);
  nextDraftInputs[workbookView.confirmation.address] = formatRateCardInputValue(workbookView.confirmation.kind, workbookView.confirmation.value);

  return nextDraftInputs;
}

export default function P2pRateCardPage({
  currentDeal,
  canEditP2p,
  isBusy,
  onUpdateCell,
}) {
  const rateCardInputs = currentDeal?.p2pWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.p2pWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.p2pWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;

  const committedWorkbookView = useMemo(
    () => buildP2pRateCardWorkbookView({ workbookInputs: rateCardInputs }),
    [rateCardInputs],
  );

  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(committedWorkbookView));

  useEffect(() => {
    setDraftInputs(buildDraftInputs(committedWorkbookView));
  }, [committedWorkbookView]);

  const previewWorkbookView = useMemo(
    () => buildP2pRateCardWorkbookView({
      workbookInputs: {
        ...rateCardInputs,
        ...draftInputs,
      },
    }),
    [draftInputs, rateCardInputs],
  );

  const persistedDisplayMap = useMemo(() => buildDraftInputs(committedWorkbookView), [committedWorkbookView]);

  const loadedSeniorAnalystUs = previewWorkbookView.loadedCostRows.find((row) => row.id === "seniorAnalyst")?.values?.onshoreUs?.value ?? 0;
  const loadedAnalystIndia = previewWorkbookView.loadedCostRows.find((row) => row.id === "analyst")?.values?.offshoreIndia?.value ?? 0;
  const standardCopilot = previewWorkbookView.technologyCostRows.find((row) => row.id === "copilotLicense")?.values?.standard?.value ?? 0;
  const autonomousPlatform = previewWorkbookView.technologyCostRows.find((row) => row.id === "platformBase")?.values?.autonomousFinance?.value ?? 0;

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(kind, address, value) {
    const normalizedValue = normalizeRateCardInputValue(kind, value);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [address]: persistedDisplayMap[address] ?? "",
      }));
      return;
    }

    const nextDisplayValue = normalizedValue === "" ? "" : formatRateCardInputValue(kind, normalizedValue);

    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextDisplayValue,
    }));

    onUpdateCell(SHEET_NAME, address, normalizedValue);
  }

  return (
    <div className="fpa-form-stack fpa-rate-card-layout">
      <section className="compact-card fpa-subpanel fpa-rate-card-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local Rate Card</span>
            <h4>{P2P_RATE_CARD_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_RATE_CARD_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={previewWorkbookView.confirmation.value === "Yes" ? "success" : "warning"}>
              Deal Desk {previewWorkbookView.confirmation.value}
            </StatusPill>
            <span className="section-chip">{P2P_RATE_CARD_SNAPSHOT.editableCellCount} editable cells</span>
            <span className="section-chip">{P2P_RATE_CARD_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-rate-card-kpi-grid">
          <MetricCard
            label="Senior Analyst | Onshore - US"
            value={formatRateCardValue(loadedSeniorAnalystUs, "whole")}
            note="Loaded annual cost"
          />
          <MetricCard
            label="Analyst | Offshore - India"
            value={formatRateCardValue(loadedAnalystIndia, "whole")}
            note="Loaded annual cost"
          />
          <MetricCard
            label="Standard persona"
            value={formatRateCardValue(standardCopilot, "whole")}
            note="AI copilot & licence / user"
          />
          <MetricCard
            label="Autonomous Finance"
            value={formatRateCardValue(autonomousPlatform, "whole")}
            note="Platform / orchestration base"
          />
          <MetricCard
            label="Shared backfill multiplier"
            value={formatRateCardValue(previewWorkbookView.backfillMultiplier.value, "percent1")}
            note="Applied to loaded annual cost"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 6-15"
        title="A. Base Salary (USD/yr)"
        note="Rows 6-13 are editable by band and location. Workbook row 15 carries the statutory load percentages used by the loaded-cost formulas."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">48 salary inputs</span>
            <span className="section-chip">6 load inputs</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-rate-card-table-wrap">
          <table className="fpa-table fpa-rate-card-table">
            <thead>
              <tr>
                <th>Band</th>
                {previewWorkbookView.locations.map((location) => (
                  <th key={location.id} className="is-number">{location.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewWorkbookView.baseSalaryRows.map((row) => (
                <tr key={row.id}>
                  <td className="fpa-rate-card-label-cell">
                    <RowLabel primary={`${row.bandCode} | ${row.label}`} secondary={`Workbook row ${row.baseRow}`} />
                  </td>
                  {previewWorkbookView.locations.map((location) => {
                    const cell = row.values[location.id];
                    return (
                      <td key={cell.address} className="fpa-rate-card-value-cell">
                        <RateCardInputCell
                          kind="whole"
                          address={cell.address}
                          label={`${row.label} ${location.label} base salary`}
                          value={readDraftValue(draftInputs, cell.address, formatRateCardInputValue("whole", cell.value))}
                          canEditP2p={canEditP2p}
                          isBusy={isBusy}
                          onChange={(nextValue) => handleDraftChange(cell.address, nextValue)}
                          onCommit={(nextValue) => handleDraftCommit("whole", cell.address, nextValue)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="fpa-rate-card-label-cell">
                  <RowLabel primary={previewWorkbookView.benefitsLoadRow.label} secondary={`Workbook row ${previewWorkbookView.benefitsLoadRow.rowNumber}`} />
                </td>
                {previewWorkbookView.locations.map((location) => {
                  const cell = previewWorkbookView.benefitsLoadRow.values[location.id];
                  return (
                    <td key={cell.address} className="fpa-rate-card-value-cell">
                      <RateCardInputCell
                        kind="percent"
                        address={cell.address}
                        label={`${location.label} benefits load`}
                        value={readDraftValue(draftInputs, cell.address, formatRateCardInputValue("percent", cell.value))}
                        canEditP2p={canEditP2p}
                        isBusy={isBusy}
                        onChange={(nextValue) => handleDraftChange(cell.address, nextValue)}
                        onCommit={(nextValue) => handleDraftCommit("percent", cell.address, nextValue)}
                      />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 17-24"
        title="B. Fully-Loaded Cost (USD/yr)"
        note="These cells stay formula-driven exactly like Excel: Base salary × (1 + benefits load)."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">48 formula cells</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-rate-card-table-wrap">
          <table className="fpa-table fpa-rate-card-table">
            <thead>
              <tr>
                <th>Band</th>
                {previewWorkbookView.locations.map((location) => (
                  <th key={location.id} className="is-number">{location.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewWorkbookView.loadedCostRows.map((row) => (
                <tr key={row.id}>
                  <td className="fpa-rate-card-label-cell">
                    <RowLabel primary={`${row.bandCode} | ${row.label}`} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {previewWorkbookView.locations.map((location) => {
                    const cell = row.values[location.id];
                    return (
                      <td key={cell.address} className="fpa-rate-card-value-cell">
                        <span className="fpa-rate-card-readonly">{formatRateCardValue(cell.value, "whole")}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="fpa-rate-card-bottom-grid">
        <SectionCard
          badge="Workbook Rows 26-29"
          title="C. Location Cost Factors"
          note="Rows 26-28 are location-specific market factors. Row 29 is the single shared backfill proxy that feeds the downstream cost stack."
          meta={
            <div className="fpa-tab-meta">
              <span className="section-chip">18 location inputs</span>
              <span className="section-chip">1 shared multiplier</span>
            </div>
          }
        >
          <div className="fpa-table-wrap fpa-rate-card-table-wrap">
            <table className="fpa-table fpa-rate-card-table fpa-rate-card-factor-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  {previewWorkbookView.locations.map((location) => (
                    <th key={location.id} className="is-number">{location.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewWorkbookView.locationFactorRows.map((row) => (
                  <tr key={row.id}>
                    <td className="fpa-rate-card-label-cell">
                      <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                    </td>
                    {previewWorkbookView.locations.map((location) => {
                      const cell = row.values[location.id];
                      return (
                        <td key={cell.address} className="fpa-rate-card-value-cell">
                          <RateCardInputCell
                            kind={row.kind}
                            address={cell.address}
                            label={`${row.label} ${location.label}`}
                            value={readDraftValue(draftInputs, cell.address, formatRateCardInputValue(row.kind, cell.value))}
                            canEditP2p={canEditP2p}
                            isBusy={isBusy}
                            onChange={(nextValue) => handleDraftChange(cell.address, nextValue)}
                            onCommit={(nextValue) => handleDraftCommit(row.kind, cell.address, nextValue)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <article className="fpa-rate-card-shared-card">
            <div>
              <span className="step-badge">Workbook Row {previewWorkbookView.backfillMultiplier.rowNumber}</span>
              <h5>{previewWorkbookView.backfillMultiplier.label}</h5>
              <p className="section-note">Excel carries this as a single shared cell. The same multiplier is applied when leaver backfill costs are rolled into the downstream model.</p>
            </div>
            <RateCardInputCell
              kind={previewWorkbookView.backfillMultiplier.kind}
              address={previewWorkbookView.backfillMultiplier.address}
              label={previewWorkbookView.backfillMultiplier.label}
              value={readDraftValue(draftInputs, previewWorkbookView.backfillMultiplier.address, formatRateCardInputValue(previewWorkbookView.backfillMultiplier.kind, previewWorkbookView.backfillMultiplier.value))}
              canEditP2p={canEditP2p}
              isBusy={isBusy}
              onChange={(nextValue) => handleDraftChange(previewWorkbookView.backfillMultiplier.address, nextValue)}
              onCommit={(nextValue) => handleDraftCommit(previewWorkbookView.backfillMultiplier.kind, previewWorkbookView.backfillMultiplier.address, nextValue)}
            />
          </article>
        </SectionCard>

        <SectionCard
          badge="Workbook Rows 29-37"
          title="D. Technology & AI Run Cost"
          note="Rows 31-32 vary by persona. Rows 34-35 remain shared commercial assumptions, and row 37 carries the workbook confirmation control."
          meta={
            <div className="fpa-tab-meta">
              <span className="section-chip">10 persona inputs</span>
              <span className="section-chip">3 shared controls</span>
            </div>
          }
        >
          <div className="fpa-table-wrap fpa-rate-card-table-wrap">
            <table className="fpa-table fpa-rate-card-table fpa-rate-card-tech-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  {previewWorkbookView.personas.map((persona) => (
                    <th key={persona.id} className="is-number">{persona.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewWorkbookView.technologyCostRows.map((row) => (
                  <tr key={row.id}>
                    <td className="fpa-rate-card-label-cell">
                      <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                    </td>
                    {previewWorkbookView.personas.map((persona) => {
                      const cell = row.values[persona.id];
                      return (
                        <td key={cell.address} className="fpa-rate-card-value-cell">
                          <RateCardInputCell
                            kind={row.kind}
                            address={cell.address}
                            label={`${row.label} ${persona.label}`}
                            value={readDraftValue(draftInputs, cell.address, formatRateCardInputValue(row.kind, cell.value))}
                            canEditP2p={canEditP2p}
                            isBusy={isBusy}
                            onChange={(nextValue) => handleDraftChange(cell.address, nextValue)}
                            onCommit={(nextValue) => handleDraftCommit(row.kind, cell.address, nextValue)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="fpa-rate-card-shared-grid">
            <article className="fpa-rate-card-shared-card">
              <div>
                <span className="step-badge">Workbook Row {previewWorkbookView.agentRunCost.rowNumber}</span>
                <h5>{previewWorkbookView.agentRunCost.label}</h5>
              </div>
              <RateCardInputCell
                kind={previewWorkbookView.agentRunCost.kind}
                address={previewWorkbookView.agentRunCost.address}
                label={previewWorkbookView.agentRunCost.label}
                value={readDraftValue(draftInputs, previewWorkbookView.agentRunCost.address, formatRateCardInputValue(previewWorkbookView.agentRunCost.kind, previewWorkbookView.agentRunCost.value))}
                canEditP2p={canEditP2p}
                isBusy={isBusy}
                onChange={(nextValue) => handleDraftChange(previewWorkbookView.agentRunCost.address, nextValue)}
                onCommit={(nextValue) => handleDraftCommit(previewWorkbookView.agentRunCost.kind, previewWorkbookView.agentRunCost.address, nextValue)}
              />
            </article>

            <article className="fpa-rate-card-shared-card">
              <div>
                <span className="step-badge">Workbook Row {previewWorkbookView.consumptionCost.rowNumber}</span>
                <h5>{previewWorkbookView.consumptionCost.label}</h5>
              </div>
              <RateCardInputCell
                kind={previewWorkbookView.consumptionCost.kind}
                address={previewWorkbookView.consumptionCost.address}
                label={previewWorkbookView.consumptionCost.label}
                value={readDraftValue(draftInputs, previewWorkbookView.consumptionCost.address, formatRateCardInputValue(previewWorkbookView.consumptionCost.kind, previewWorkbookView.consumptionCost.value))}
                canEditP2p={canEditP2p}
                isBusy={isBusy}
                onChange={(nextValue) => handleDraftChange(previewWorkbookView.consumptionCost.address, nextValue)}
                onCommit={(nextValue) => handleDraftCommit(previewWorkbookView.consumptionCost.kind, previewWorkbookView.consumptionCost.address, nextValue)}
              />
            </article>

            <article className="fpa-rate-card-shared-card fpa-rate-card-shared-card-confirmation">
              <div>
                <span className="step-badge">Workbook Row {previewWorkbookView.confirmation.rowNumber}</span>
                <h5>{previewWorkbookView.confirmation.label}</h5>
                <p className="section-note">Keep this aligned with the commercial validation story before moving into FTE Engine and Cost.</p>
              </div>
              <div className="fpa-rate-card-confirmation-stack">
                <StatusPill tone={previewWorkbookView.confirmation.value === "Yes" ? "success" : "warning"}>
                  {previewWorkbookView.confirmation.value}
                </StatusPill>
                <RateCardInputCell
                  kind={previewWorkbookView.confirmation.kind}
                  address={previewWorkbookView.confirmation.address}
                  label={previewWorkbookView.confirmation.label}
                  value={readDraftValue(draftInputs, previewWorkbookView.confirmation.address, previewWorkbookView.confirmation.value)}
                  canEditP2p={canEditP2p}
                  isBusy={isBusy}
                  onChange={() => {}}
                  onCommit={(nextValue) => handleDraftCommit(previewWorkbookView.confirmation.kind, previewWorkbookView.confirmation.address, nextValue)}
                />
              </div>
            </article>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
