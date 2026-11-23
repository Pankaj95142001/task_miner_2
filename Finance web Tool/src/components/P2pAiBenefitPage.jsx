import { useEffect, useMemo, useState } from "react";

import {
  AI_GATE_OPTIONS,
  buildP2pAiBenefitWorkbookView,
  P2P_AI_BENEFIT_SNAPSHOT,
  formatAiBenefitInputValue,
  formatAiBenefitValue,
  normalizeAiBenefitInputValue,
} from "../config/p2pAiBenefit";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = P2P_AI_BENEFIT_SNAPSHOT.sheetName;
const MATRIX_PERCENT_FIELDS = Object.freeze([
  "autoAddr",
  "autoRed",
  "autoRes",
  "copAddr",
  "copRed",
  "copRes",
  "agtAddr",
  "agtRed",
  "agtRes",
]);
const MATRIX_GROUPS = Object.freeze([
  {
    label: "AUTO",
    columns: [
      { key: "autoAddr", label: "Addr" },
      { key: "autoRed", label: "Red" },
      { key: "autoRes", label: "Residual" },
    ],
  },
  {
    label: "COPILOT",
    columns: [
      { key: "copAddr", label: "Addr" },
      { key: "copRed", label: "Red" },
      { key: "copRes", label: "Residual" },
    ],
  },
  {
    label: "AGENT",
    columns: [
      { key: "agtAddr", label: "Addr" },
      { key: "agtRed", label: "Red" },
      { key: "agtRes", label: "Residual" },
    ],
  },
]);

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

function readDraftValue(draftInputs, address, fallback = "") {
  return Object.prototype.hasOwnProperty.call(draftInputs, address)
    ? String(draftInputs[address] ?? "")
    : fallback;
}

function gateStatusTone(value) {
  return Number(value) === 1 ? "success" : "danger";
}

function gateStatusLabel(value) {
  return Number(value) === 1 ? "OK" : "Blocked";
}

function buildDraftInputs(workbookView) {
  const nextDraftInputs = {};

  workbookView.matrixRows.forEach((row) => {
    MATRIX_PERCENT_FIELDS.forEach((fieldKey) => {
      nextDraftInputs[row[fieldKey].address] = formatAiBenefitInputValue("percent", row[fieldKey].value);
    });

    nextDraftInputs[row.gate.address] = row.gate.value;
  });

  Object.values(workbookView.rampProfiles).forEach((profile) => {
    profile.rows.forEach((row) => {
      row.years.forEach((year) => {
        nextDraftInputs[year.address] = formatAiBenefitInputValue("percent", year.value);
      });
    });
  });

  return nextDraftInputs;
}

function buildDisplayMap(workbookView) {
  return buildDraftInputs(workbookView);
}

function AiBenefitCellEditor({
  kind,
  address,
  label,
  value,
  canEditP2p,
  isBusy,
  onChange,
  onCommit,
}) {
  if (kind === "gate") {
    return (
      <select
        aria-label={label}
        className="fpa-ai-benefit-select"
        value={value}
        disabled={!canEditP2p || isBusy}
        onChange={(event) => onCommit(event.target.value)}
      >
        {AI_GATE_OPTIONS.map((option) => (
          <option key={`${address}-${option}`} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (!canEditP2p) {
    return <span className="fpa-ai-benefit-readonly">{value || "—"}</span>;
  }

  return (
    <input
      aria-label={label}
      type="text"
      className="fpa-ai-benefit-input is-numeric"
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

function RampProfileTable({
  profile,
  draftInputs,
  canEditP2p,
  isBusy,
  onDraftChange,
  onDraftCommit,
}) {
  return (
    <article className="fpa-ai-benefit-ramp-card">
      <div className="step-header fpa-ai-benefit-ramp-header">
        <div>
          <span className="step-badge">Rows {profile.rows[0]?.row}-{profile.rows[profile.rows.length - 1]?.row}</span>
          <h5>{profile.label}</h5>
          <p className="section-note">{profile.note}</p>
        </div>
      </div>

      <div className="fpa-table-wrap fpa-ai-benefit-table-wrap">
        <table className="fpa-table fpa-ai-benefit-ramp-table">
          <thead>
            <tr>
              <th>Lever</th>
              {profile.rows[0]?.years.map((year) => (
                <th key={`${profile.id}-${year.key}`}>{year.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profile.rows.map((row) => (
              <tr key={`${profile.id}-${row.id}`}>
                <td className="fpa-ai-benefit-label-cell">
                  <div className="fpa-ai-benefit-process-cell">
                    <strong>{row.label}</strong>
                    <span>Workbook row {row.row}</span>
                  </div>
                </td>
                {row.years.map((year) => (
                  <td key={year.address} className="fpa-ai-benefit-value-cell">
                    <AiBenefitCellEditor
                      kind="percent"
                      address={year.address}
                      label={`${profile.label} ${row.label} ${year.label}`}
                      value={readDraftValue(draftInputs, year.address, formatAiBenefitInputValue("percent", year.value))}
                      canEditP2p={canEditP2p}
                      isBusy={isBusy}
                      onChange={(nextValue) => onDraftChange(year.address, nextValue)}
                      onCommit={(nextValue) => onDraftCommit("percent", year.address, nextValue)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default function P2pAiBenefitPage({
  currentDeal,
  p2pWorkspace,
  canEditP2p,
  isBusy,
  onUpdateCell,
}) {
  const aiWorkbookInputs = currentDeal?.p2pWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.p2pWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.p2pWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;
  const benchmarkInputs = currentDeal?.p2pWorkbookInputs?.["P2P_04 Benchmarks"] && typeof currentDeal.p2pWorkbookInputs["P2P_04 Benchmarks"] === "object"
    ? currentDeal.p2pWorkbookInputs["P2P_04 Benchmarks"]
    : EMPTY_INPUTS;
  const workloadInputs = currentDeal?.p2pWorkbookInputs?.["P2P_05 Workload"] && typeof currentDeal.p2pWorkbookInputs["P2P_05 Workload"] === "object"
    ? currentDeal.p2pWorkbookInputs["P2P_05 Workload"]
    : EMPTY_INPUTS;
  const personaInputs = currentDeal?.p2pWorkbookInputs?.["P2P_07 Personas"] && typeof currentDeal.p2pWorkbookInputs["P2P_07 Personas"] === "object"
    ? currentDeal.p2pWorkbookInputs["P2P_07 Personas"]
    : EMPTY_INPUTS;

  const committedWorkbookView = useMemo(
    () => buildP2pAiBenefitWorkbookView({
      aiWorkbookInputs,
      benchmarkInputs,
      workloadInputs,
      personaInputs,
      workspace: p2pWorkspace,
      currentDeal,
    }),
    [aiWorkbookInputs, benchmarkInputs, workloadInputs, personaInputs, p2pWorkspace, currentDeal],
  );

  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(committedWorkbookView));

  useEffect(() => {
    setDraftInputs(buildDraftInputs(committedWorkbookView));
  }, [committedWorkbookView]);

  const previewWorkbookView = useMemo(
    () => buildP2pAiBenefitWorkbookView({
      aiWorkbookInputs: {
        ...aiWorkbookInputs,
        ...draftInputs,
      },
      benchmarkInputs,
      workloadInputs,
      personaInputs,
      workspace: p2pWorkspace,
      currentDeal,
    }),
    [aiWorkbookInputs, benchmarkInputs, currentDeal, draftInputs, p2pWorkspace, personaInputs, workloadInputs],
  );

  const persistedDisplayMap = useMemo(() => buildDisplayMap(committedWorkbookView), [committedWorkbookView]);

  const [selectedPersonaId, setSelectedPersonaId] = useState(
    () => previewWorkbookView.personas.find((persona) => persona.id === "standard")?.id || previewWorkbookView.personas[0]?.id || "",
  );

  useEffect(() => {
    const defaultPersonaId = previewWorkbookView.personas.find((persona) => persona.id === "standard")?.id
      || previewWorkbookView.personas[0]?.id
      || "";

    if (!previewWorkbookView.personas.some((persona) => persona.id === selectedPersonaId)) {
      setSelectedPersonaId(defaultPersonaId);
    }
  }, [previewWorkbookView.personas, selectedPersonaId]);

  const selectedPersona = previewWorkbookView.personas.find((persona) => persona.id === selectedPersonaId)
    || previewWorkbookView.personas[0]
    || null;

  const gateDrivers = previewWorkbookView.gateDrivers;
  const gateDriverCards = useMemo(() => ([
    {
      label: "Industry Automation Ceiling",
      value: formatAiBenefitValue(gateDrivers.industryAutomationCeiling, "percent1"),
      note: "Benchmark lookup by Discovery industry vertical.",
    },
    {
      label: "Effective Ceiling",
      value: formatAiBenefitValue(gateDrivers.effectiveCeiling, "percent1"),
      note: "Local engine cap applied to sequential lever reductions.",
    },
    {
      label: "AI Maturity Ceiling",
      value: formatAiBenefitValue(gateDrivers.aiMaturityCeiling, "percent1"),
      note: "Reference lookup from benchmark section D.",
    },
    {
      label: "AI Maturity Rank",
      value: String(gateDrivers.aiMaturityRank),
      note: "None=1, Exploring=2, Piloting=3, Scaled=4.",
    },
    {
      label: "Platform Modernisation",
      value: gateDrivers.platformModernizationFlag === 1 ? "Yes" : "No",
      note: "Adds 15 points to the effective ceiling when in scope.",
    },
    {
      label: "Agentic Data Gate",
      value: gateDrivers.agenticDataGate === 1 ? "Open" : "Shut",
      note: gateDrivers.gateNarrative,
    },
  ]), [gateDrivers]);

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(kind, address, value) {
    const normalizedValue = normalizeAiBenefitInputValue(kind, value);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [address]: persistedDisplayMap[address] ?? "",
      }));
      return;
    }

    const nextDisplayValue = kind === "gate" ? normalizedValue : formatAiBenefitInputValue(kind, normalizedValue);

    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextDisplayValue,
    }));

    onUpdateCell(SHEET_NAME, address, normalizedValue);
  }

  if (!selectedPersona) {
    return null;
  }

  return (
    <div className="fpa-form-stack fpa-ai-benefit-layout">
      <section className="compact-card fpa-subpanel fpa-ai-benefit-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local AI Benefit</span>
            <h4>{P2P_AI_BENEFIT_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_AI_BENEFIT_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={gateDrivers.agenticDataGate === 1 ? "success" : "danger"}>{gateDrivers.agenticDataGate === 1 ? "Gate Open" : "Gate Shut"}</StatusPill>
            <span className="section-chip">{P2P_AI_BENEFIT_SNAPSHOT.processCount} process rows</span>
            <span className="section-chip">{P2P_AI_BENEFIT_SNAPSHOT.editableCellCount} editable cells</span>
            <span className="section-chip">{P2P_AI_BENEFIT_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-kpi-grid fpa-ai-benefit-kpi-grid">
          <MetricCard label="Total Monthly Hours" value={formatAiBenefitValue(previewWorkbookView.totalMonthlyHours, "whole")} note="Base workload pulled from local P2P tab 05 Workload." />
          <MetricCard label="Weighted Net Reduction (Standard, steady)" value={formatAiBenefitValue(previewWorkbookView.personas.find((persona) => persona.id === "standard")?.summary.weightedNetReductionSteady || 0, "percent1")} note="Local steady-state view for the Standard persona." />
          <MetricCard label="Weighted Net Reduction (Autonomous, Y1)" value={formatAiBenefitValue(previewWorkbookView.personas.find((persona) => persona.id === "autonomousFinance")?.summary.weightedNetReductionY1 || 0, "percent1")} note="First-year local ramp reduction for Autonomous Finance." />
          <MetricCard label="Agent Hours Y3 (Autonomous)" value={formatAiBenefitValue(previewWorkbookView.personas.find((persona) => persona.id === "autonomousFinance")?.summary.agentHoursY3Annualised || 0, "whole")} note="Annualized agentic hours after the Y3 local autonomous ramp." />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 4-9"
        title="Ceilings, maturity, and data gate"
        note="These workbook drivers feed the gate tests, the effective ceiling, and every persona detail block below."
      >
        <div className="fpa-ai-benefit-driver-grid">
          {gateDriverCards.map((item) => (
            <MetricCard key={item.label} label={item.label} value={item.value} note={item.note} />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 12-21"
        title="Addressability, reduction, residual, and gate matrix"
        note="This is the editable AI benefit matrix from the workbook. The Gate OK column follows the exact workbook tests: P requires rank >= 3, PE requires rank >= 3 plus platform modernisation, and S requires rank >= 4."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone="info">10 L2 rows</StatusPill>
            <span className="section-chip">120 editable cells</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-ai-benefit-table-wrap">
          <table className="fpa-table fpa-ai-benefit-matrix-table">
            <thead>
              <tr>
                <th rowSpan="2">P2P L2 Process</th>
                {MATRIX_GROUPS.map((group) => (
                  <th key={group.label} colSpan={group.columns.length}>{group.label}</th>
                ))}
                <th rowSpan="2">Gate</th>
                <th rowSpan="2">Gate OK</th>
              </tr>
              <tr>
                {MATRIX_GROUPS.flatMap((group) => group.columns.map((column) => (
                  <th key={`${group.label}-${column.key}`}>{column.label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {previewWorkbookView.matrixRows.map((row) => (
                <tr key={row.id}>
                  <td className="fpa-ai-benefit-label-cell">
                    <div className="fpa-ai-benefit-process-cell">
                      <strong>{row.label}</strong>
                      <span>Workbook row {row.aiRow}</span>
                    </div>
                  </td>

                  {MATRIX_GROUPS.flatMap((group) => group.columns).map((column) => {
                    const cell = row[column.key];
                    return (
                      <td key={cell.address} className="fpa-ai-benefit-value-cell">
                        <AiBenefitCellEditor
                          kind="percent"
                          address={cell.address}
                          label={`${row.label} ${column.label}`}
                          value={readDraftValue(draftInputs, cell.address, formatAiBenefitInputValue("percent", cell.value))}
                          canEditP2p={canEditP2p}
                          isBusy={isBusy}
                          onChange={(nextValue) => handleDraftChange(cell.address, nextValue)}
                          onCommit={(nextValue) => handleDraftCommit("percent", cell.address, nextValue)}
                        />
                      </td>
                    );
                  })}

                  <td className="fpa-ai-benefit-value-cell">
                    <AiBenefitCellEditor
                      kind="gate"
                      address={row.gate.address}
                      label={`${row.label} gate`}
                      value={readDraftValue(draftInputs, row.gate.address, row.gate.value)}
                      canEditP2p={canEditP2p}
                      isBusy={isBusy}
                      onChange={() => {}}
                      onCommit={(nextValue) => handleDraftCommit("gate", row.gate.address, nextValue)}
                    />
                  </td>

                  <td className="fpa-ai-benefit-value-cell is-status">
                    <StatusPill tone={gateStatusTone(row.gateOk.value)}>{gateStatusLabel(row.gateOk.value)}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 27-33"
        title="Benefit ramp curves"
        note="The workbook uses one standard ramp set for four personas and a second autonomous ramp set for the Autonomous Finance persona."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">42 editable cells</span>
          </div>
        }
      >
        <div className="fpa-ai-benefit-ramp-grid">
          {Object.values(previewWorkbookView.rampProfiles).map((profile) => (
            <RampProfileTable
              key={profile.id}
              profile={profile}
              draftInputs={draftInputs}
              canEditP2p={canEditP2p}
              isBusy={isBusy}
              onDraftChange={handleDraftChange}
              onDraftCommit={handleDraftCommit}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 133-138"
        title="Consolidated persona outputs"
        note="These six workbook outputs summarise the weighted automation and AI effect across all P2P L2 workload rows."
      >
        <div className="fpa-table-wrap fpa-ai-benefit-table-wrap">
          <table className="fpa-table fpa-ai-benefit-summary-table">
            <thead>
              <tr>
                <th>Output Row</th>
                {previewWorkbookView.personas.map((persona) => (
                  <th key={persona.id}>{persona.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewWorkbookView.consolidatedRows.map((row) => (
                <tr key={row.label}>
                  <td className="fpa-ai-benefit-label-cell">
                    <div className="fpa-ai-benefit-process-cell">
                      <strong>{row.label}</strong>
                    </div>
                  </td>
                  {previewWorkbookView.personas.map((persona) => (
                    <td key={`${row.label}-${persona.id}`} className="fpa-ai-benefit-summary-value">
                      {formatAiBenefitValue(row.values[persona.id], row.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 38-129"
        title="Persona detail block"
        note="The Excel file repeats this detail table five times. The portal keeps one selector so you can review the exact formulas without five long stacked tables."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={selectedPersona.rampProfileId === "autonomous" ? "info" : "neutral"}>{selectedPersona.rampProfileId === "autonomous" ? "Autonomous Ramp" : "Standard Ramp"}</StatusPill>
            <span className="section-chip">Row block {selectedPersona.detailStartRow}-{selectedPersona.detailStartRow + selectedPersona.processRows.length - 1}</span>
          </div>
        }
      >
        <div className="fpa-ai-benefit-toolbar">
          <label className="fpa-ai-benefit-picker">
            <span>Review persona workbook block</span>
            <select value={selectedPersona.id} onChange={(event) => setSelectedPersonaId(event.target.value)}>
              {previewWorkbookView.personas.map((persona) => (
                <option key={persona.id} value={persona.id}>{persona.label}</option>
              ))}
            </select>
          </label>

          <div className="fpa-ai-benefit-toolbar-meta">
            <span className="section-chip">Ambition {formatAiBenefitValue(selectedPersona.ambitionScalar.value, "percent1")}</span>
            <span className="section-chip">Workbook {selectedPersona.ambitionScalar.address}</span>
          </div>
        </div>

        <div className="fpa-kpi-grid fpa-ai-benefit-persona-kpi-grid">
          <MetricCard label="Implied Automation" value={formatAiBenefitValue(selectedPersona.summary.impliedAutomationPct, "percent1")} note="Weighted AUTO lever effect before capping by year." />
          <MetricCard label="Implied AI" value={formatAiBenefitValue(selectedPersona.summary.impliedAiPct, "percent1")} note="Weighted COPILOT + AGENT effect before year ramping." />
          <MetricCard label="Weighted Net Reduction (steady)" value={formatAiBenefitValue(selectedPersona.summary.weightedNetReductionSteady, "percent1")} note="Weighted steady-state reduction after sequential levers and ceiling cap." />
          <MetricCard label="Weighted Net Reduction (Y1)" value={formatAiBenefitValue(selectedPersona.summary.weightedNetReductionY1, "percent1")} note="First-year net reduction using the selected ramp curve." />
          <MetricCard label="Hours Removed / Month" value={formatAiBenefitValue(selectedPersona.summary.hoursRemovedPerMonthSteady, "whole")} note="Steady-state monthly hours removed across the 12 workload rows." />
          <MetricCard label="Agent Hours Y3" value={formatAiBenefitValue(selectedPersona.summary.agentHoursY3Annualised, "whole")} note="Annualized agent-hours contribution in year 3." />
        </div>

        <div className="fpa-table-wrap fpa-ai-benefit-table-wrap">
          <table className="fpa-table fpa-ai-benefit-process-table">
            <thead>
              <tr>
                <th>FP&amp;A L2 Process</th>
                <th>Monthly Hrs</th>
                <th>LE Auto</th>
                <th>LE Copilot</th>
                <th>LE Agent</th>
                <th>Steady</th>
                {previewWorkbookView.yearLabels.map((yearLabel) => (
                  <th key={`${selectedPersona.id}-${yearLabel}`}>{yearLabel}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedPersona.processRows.map((row) => (
                <tr key={`${selectedPersona.id}-${row.id}`}>
                  <td className="fpa-ai-benefit-label-cell">
                    <div className="fpa-ai-benefit-process-cell">
                      <strong>{row.label}</strong>
                      <span>Workbook row {row.detailRow}</span>
                    </div>
                  </td>
                  <td className="fpa-ai-benefit-summary-value">{formatAiBenefitValue(row.monthlyHours, "whole")}</td>
                  <td className="fpa-ai-benefit-summary-value">{formatAiBenefitValue(row.leAuto, "percent1")}</td>
                  <td className="fpa-ai-benefit-summary-value">{formatAiBenefitValue(row.leCopilot, "percent1")}</td>
                  <td className="fpa-ai-benefit-summary-value">{formatAiBenefitValue(row.leAgent, "percent1")}</td>
                  <td className="fpa-ai-benefit-summary-value is-emphasis">{formatAiBenefitValue(row.steady, "percent1")}</td>
                  {row.years.map((year) => (
                    <td key={`${selectedPersona.id}-${row.id}-${year.key}`} className="fpa-ai-benefit-summary-value">
                      {formatAiBenefitValue(year.reduction, "percent1")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
