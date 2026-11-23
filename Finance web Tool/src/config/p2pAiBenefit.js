import { buildP2pBenchmarkModel } from "./p2pBenchmarks";
import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { buildP2pWorkloadModel } from "./p2pWorkload";

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const EMPTY_INPUTS = Object.freeze({});
const YEAR_KEYS = Object.freeze(["y1", "y2", "y3", "y4", "y5", "y6", "y7"]);
const YEAR_LABELS = Object.freeze(["Y1", "Y2", "Y3", "Y4", "Y5", "Y6", "Y7"]);
const PERSONA_AMBITION_DEFAULTS = Object.freeze({ C: 0.4, D: 0.65, E: 0.8, F: 1, G: 1 });

export const P2P_AI_BENEFIT_SNAPSHOT = Object.freeze({
  sheetName: "P2P_08 AI Benefit",
  title: "08. Addressability & AI Benefit Engine - P2P L2 x lever x persona x year",
  note: "Effect = Addr x Red x (1-Residual) x Ambition x Ramp x Gate, applied sequentially across levers and capped at the effective ceiling.",
  formulaCount: 0,
  editableCellCount: 142,
  processCount: 10,
  personaCount: 5,
});

export const AI_GATE_OPTIONS = Object.freeze(["P", "PE", "S"]);

export const P2P_AI_BENEFIT_PERSONAS = Object.freeze([
  { id: "conservative", label: "Conservative", workbookColumn: "C", rampProfileId: "standard", sectionTitle: "Persona 1: Conservative - Net Reduction by Process & Year", detailStartRow: 36 },
  { id: "standard", label: "Standard", workbookColumn: "D", rampProfileId: "standard", sectionTitle: "Persona 2: Standard - Net Reduction by Process & Year", detailStartRow: 53 },
  { id: "lean", label: "Lean", workbookColumn: "E", rampProfileId: "standard", sectionTitle: "Persona 3: Lean - Net Reduction by Process & Year", detailStartRow: 70 },
  { id: "aggressiveAiFirst", label: "Aggressive AI-First", workbookColumn: "F", rampProfileId: "standard", sectionTitle: "Persona 4: Aggressive AI-First - Net Reduction by Process & Year", detailStartRow: 87 },
  { id: "autonomousFinance", label: "Autonomous Finance", workbookColumn: "G", rampProfileId: "autonomous", sectionTitle: "Persona 5: Autonomous Finance - Net Reduction by Process & Year", detailStartRow: 104 },
]);

export const P2P_AI_BENEFIT_MATRIX_ROWS = Object.freeze([
  { id: "requisitionSourcingSupport", aiRow: 12, label: "Requisition & Sourcing Support", defaults: { autoAddr: 0.5, autoRed: 0.55, autoRes: 0.1, copAddr: 0.3, copRed: 0.35, copRes: 0.15, agtAddr: 0.25, agtRed: 0.5, agtRes: 0.2, gate: "P" } },
  { id: "poManagement", aiRow: 13, label: "PO Management", defaults: { autoAddr: 0.55, autoRed: 0.6, autoRes: 0.1, copAddr: 0.25, copRed: 0.3, copRes: 0.15, agtAddr: 0.3, agtRed: 0.55, agtRes: 0.15, gate: "P" } },
  { id: "vendorMaster", aiRow: 14, label: "Vendor Master", defaults: { autoAddr: 0.5, autoRed: 0.55, autoRes: 0.1, copAddr: 0.2, copRed: 0.3, copRes: 0.2, agtAddr: 0.2, agtRed: 0.5, agtRes: 0.2, gate: "P" } },
  { id: "invoiceProcessing", aiRow: 15, label: "Invoice Processing", defaults: { autoAddr: 0.7, autoRed: 0.65, autoRes: 0.1, copAddr: 0.2, copRed: 0.3, copRes: 0.15, agtAddr: 0.35, agtRed: 0.6, agtRes: 0.15, gate: "P" } },
  { id: "threeWayMatch", aiRow: 16, label: "3-Way Match", defaults: { autoAddr: 0.7, autoRed: 0.65, autoRes: 0.1, copAddr: 0.2, copRed: 0.3, copRes: 0.15, agtAddr: 0.35, agtRed: 0.6, agtRes: 0.15, gate: "P" } },
  { id: "exceptionQueryHandling", aiRow: 17, label: "Exception & Query Handling", defaults: { autoAddr: 0.45, autoRed: 0.5, autoRes: 0.1, copAddr: 0.4, copRed: 0.45, copRes: 0.15, agtAddr: 0.35, agtRed: 0.55, agtRes: 0.15, gate: "P" } },
  { id: "paymentsDisbursement", aiRow: 18, label: "Payments & Disbursement", defaults: { autoAddr: 0.6, autoRed: 0.6, autoRes: 0.1, copAddr: 0.25, copRed: 0.3, copRes: 0.15, agtAddr: 0.3, agtRed: 0.55, agtRes: 0.15, gate: "P" } },
  { id: "travelExpense", aiRow: 19, label: "Travel & Expense", defaults: { autoAddr: 0.55, autoRed: 0.6, autoRes: 0.1, copAddr: 0.3, copRed: 0.35, copRes: 0.15, agtAddr: 0.3, agtRed: 0.5, agtRes: 0.15, gate: "P" } },
  { id: "supplierReconciliationStatements", aiRow: 20, label: "Supplier Reconciliation & Statements", defaults: { autoAddr: 0.6, autoRed: 0.6, autoRes: 0.1, copAddr: 0.25, copRed: 0.3, copRes: 0.15, agtAddr: 0.3, agtRed: 0.55, agtRes: 0.15, gate: "P" } },
  { id: "reportingControlsGovernance", aiRow: 21, label: "P2P Reporting, Controls & Governance", defaults: { autoAddr: 0.5, autoRed: 0.55, autoRes: 0.1, copAddr: 0.35, copRed: 0.4, copRes: 0.15, agtAddr: 0.25, agtRed: 0.5, agtRes: 0.2, gate: "P" } },
]);

export const P2P_AI_BENEFIT_RAMP_PROFILES = Object.freeze({
  standard: {
    id: "standard",
    label: "Standard Ramp",
    note: "Workbook rows 25-27 are used by Conservative, Standard, Lean, and Aggressive AI-First.",
    rows: [
      { id: "auto", label: "AUTO (standard)", row: 25, values: { y1: 0.5, y2: 0.85, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
      { id: "copilot", label: "COPILOT (standard)", row: 26, values: { y1: 0.25, y2: 0.6, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
      { id: "agent", label: "AGENT (standard)", row: 27, values: { y1: 0, y2: 0.4, y3: 0.8, y4: 1, y5: 1, y6: 1, y7: 1 } },
    ],
  },
  autonomous: {
    id: "autonomous",
    label: "Autonomous Ramp",
    note: "Workbook rows 29-31 are used only by Autonomous Finance.",
    rows: [
      { id: "auto", label: "AUTO (Autonomous persona)", row: 29, values: { y1: 0.6, y2: 0.9, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
      { id: "copilot", label: "COPILOT (Autonomous persona)", row: 30, values: { y1: 0.4, y2: 0.8, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
      { id: "agent", label: "AGENT (Autonomous persona)", row: 31, values: { y1: 0.25, y2: 0.6, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
    ],
  },
});

function trimValue(value) {
  return String(value ?? "").trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 12) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value).replace(/,/g, "");
  if (!text) {
    return fallback;
  }
  if (text.endsWith("%")) {
    const numericPercent = Number(text.slice(0, -1).trim());
    return Number.isFinite(numericPercent) ? numericPercent / 100 : fallback;
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeGateValue(value, fallback = "P") {
  const normalized = trimValue(value).toUpperCase();
  return AI_GATE_OPTIONS.includes(normalized) ? normalized : fallback;
}

function readWorkbookPercentInput(workbookInputs, address, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }
  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.abs(numeric) > 1 ? numeric / 100 : numeric;
}

function readWorkbookTextInput(workbookInputs, address, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }
  const text = trimValue(workbookInputs[address]);
  return text || fallback;
}

function buildMatrixRows(aiWorkbookInputs, gateDrivers) {
  return P2P_AI_BENEFIT_MATRIX_ROWS.map((definition) => {
    const rowNumber = definition.aiRow;
    const nextRow = {
      ...definition,
      autoAddr: { address: `C${rowNumber}`, value: readWorkbookPercentInput(aiWorkbookInputs, `C${rowNumber}`, definition.defaults.autoAddr) },
      autoRed: { address: `D${rowNumber}`, value: readWorkbookPercentInput(aiWorkbookInputs, `D${rowNumber}`, definition.defaults.autoRed) },
      autoRes: { address: `E${rowNumber}`, value: readWorkbookPercentInput(aiWorkbookInputs, `E${rowNumber}`, definition.defaults.autoRes) },
      copAddr: { address: `F${rowNumber}`, value: readWorkbookPercentInput(aiWorkbookInputs, `F${rowNumber}`, definition.defaults.copAddr) },
      copRed: { address: `G${rowNumber}`, value: readWorkbookPercentInput(aiWorkbookInputs, `G${rowNumber}`, definition.defaults.copRed) },
      copRes: { address: `H${rowNumber}`, value: readWorkbookPercentInput(aiWorkbookInputs, `H${rowNumber}`, definition.defaults.copRes) },
      agtAddr: { address: `I${rowNumber}`, value: readWorkbookPercentInput(aiWorkbookInputs, `I${rowNumber}`, definition.defaults.agtAddr) },
      agtRed: { address: `J${rowNumber}`, value: readWorkbookPercentInput(aiWorkbookInputs, `J${rowNumber}`, definition.defaults.agtRed) },
      agtRes: { address: `K${rowNumber}`, value: readWorkbookPercentInput(aiWorkbookInputs, `K${rowNumber}`, definition.defaults.agtRes) },
      gate: { address: `L${rowNumber}`, value: normalizeGateValue(readWorkbookTextInput(aiWorkbookInputs, `L${rowNumber}`, definition.defaults.gate), definition.defaults.gate) },
    };

    const gateCode = nextRow.gate.value;
    const { aiMaturityRank, platformModernizationFlag } = gateDrivers;
    const gateOk = gateCode === "S"
      ? Number(aiMaturityRank >= 4)
      : gateCode === "PE"
        ? Number(aiMaturityRank >= 3 && platformModernizationFlag === 1)
        : Number(aiMaturityRank >= 3);

    return {
      ...nextRow,
      gateOk: { address: `M${rowNumber}`, value: gateOk },
    };
  });
}

function buildRampProfiles(aiWorkbookInputs) {
  return Object.fromEntries(
    Object.entries(P2P_AI_BENEFIT_RAMP_PROFILES).map(([profileId, profile]) => [
      profileId,
      {
        ...profile,
        rows: profile.rows.map((row) => ({
          ...row,
          years: YEAR_KEYS.map((yearKey, yearIndex) => {
            const column = String.fromCharCode("C".charCodeAt(0) + yearIndex);
            const address = `${column}${row.row}`;
            return {
              key: yearKey,
              label: YEAR_LABELS[yearIndex],
              address,
              value: readWorkbookPercentInput(aiWorkbookInputs, address, row.values[yearKey]),
            };
          }),
        })),
      },
    ]),
  );
}

function getPersonaAmbitionScalar(personaInputs, workbookColumn) {
  const address = `${workbookColumn}17`;
  return {
    address,
    value: readWorkbookPercentInput(personaInputs, address, PERSONA_AMBITION_DEFAULTS[workbookColumn] || 1),
  };
}

function computeLeverEffects(matrixRow, ambitionScalar, gateDrivers) {
  const leAuto = matrixRow.autoAddr.value * matrixRow.autoRed.value * (1 - matrixRow.autoRes.value) * ambitionScalar;
  const leCopilot = matrixRow.copAddr.value * matrixRow.copRed.value * (1 - matrixRow.copRes.value) * ambitionScalar;
  const leAgent = matrixRow.agtAddr.value
    * matrixRow.agtRed.value
    * (1 - matrixRow.agtRes.value)
    * ambitionScalar
    * matrixRow.gateOk.value
    * gateDrivers.agenticDataGate;

  return {
    leAuto: clamp(leAuto, 0, 1),
    leCopilot: clamp(leCopilot, 0, 1),
    leAgent: clamp(leAgent, 0, 1),
  };
}

function computeYearReduction(leAuto, leCopilot, leAgent, effectiveCeiling, autoRamp, copilotRamp, agentRamp) {
  return Math.min(
    1 - (1 - (leAuto * autoRamp)) * (1 - (leCopilot * copilotRamp)) * (1 - (leAgent * agentRamp)),
    effectiveCeiling,
  );
}

function formatPercentage(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function formatWholeNumber(value) {
  return NUMBER_FORMATTER.format(Math.round(Number(value || 0)));
}

function formatFactor(value) {
  return Number(value || 0).toFixed(2);
}

function buildConsolidatedRows(personas) {
  return [
    { label: "Implied Automation %", format: "percent1", values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.impliedAutomationPct])) },
    { label: "Implied AI %", format: "percent1", values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.impliedAiPct])) },
    { label: "Weighted Net Red - Steady", format: "percent1", values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.weightedNetReductionSteady])) },
    { label: "Weighted Net Red - Y1", format: "percent1", values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.weightedNetReductionY1])) },
    { label: "Hours removed / month (steady)", format: "whole", values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.hoursRemovedPerMonthSteady])) },
    { label: "Agent hours Y3 (annualised)", format: "whole", values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.agentHoursY3Annualised])) },
  ];
}

export function formatAiBenefitValue(value, format = "percent1") {
  switch (format) {
    case "percent0":
      return formatPercentage(value, 0);
    case "percent1":
      return formatPercentage(value, 1);
    case "whole":
      return formatWholeNumber(value);
    case "factor":
      return formatFactor(value);
    default:
      return String(value ?? "-");
  }
}

export function normalizeAiBenefitInputValue(kind, value) {
  if (kind === "gate") {
    return normalizeGateValue(value);
  }
  const numeric = parseNumericText(value, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const normalized = Math.abs(numeric) > 1 ? numeric / 100 : numeric;
  return String(normalized);
}

export function formatAiBenefitInputValue(kind, value) {
  if (kind === "gate") {
    return normalizeGateValue(value);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return `${(numeric * 100).toFixed(1)}%`;
}

export function buildP2pAiBenefitWorkbookView({
  aiWorkbookInputs = EMPTY_INPUTS,
  benchmarkInputs = EMPTY_INPUTS,
  workloadInputs = EMPTY_INPUTS,
  personaInputs = EMPTY_INPUTS,
  workspace = {},
  currentDeal = {},
} = {}) {
  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const benchmarkModel = buildP2pBenchmarkModel(discoveryMetrics.effectiveDiscovery, workspace.benchmarks || {});
  const workloadModel = buildP2pWorkloadModel(workspace, currentDeal);

  const aiMaturityRank = discoveryMetrics.effectiveDiscovery.aiMaturity === "None"
    ? 1
    : discoveryMetrics.effectiveDiscovery.aiMaturity === "Exploring"
      ? 2
      : discoveryMetrics.effectiveDiscovery.aiMaturity === "Piloting"
        ? 3
        : 4;
  const platformModernizationFlag = discoveryMetrics.effectiveDiscovery.platformModernizationInScope === "Yes" ? 1 : 0;
  const effectiveCeiling = clamp(benchmarkModel.automationCeiling + (platformModernizationFlag === 1 ? 0.15 : 0), 0, 1);
  const gateDrivers = {
    industryAutomationCeiling: benchmarkModel.automationCeiling,
    effectiveCeiling,
    aiMaturityCeiling: benchmarkModel.aiBenefitCeiling,
    aiMaturityRank,
    platformModernizationFlag,
    agenticDataGate: benchmarkModel.agenticDataGate,
    gateNarrative: benchmarkModel.agenticDataGate === 1
      ? "OPEN - data readiness supports agentic levers"
      : "SHUT - agent benefit suppressed until data readiness and AI maturity improve",
  };

  const matrixRows = buildMatrixRows(aiWorkbookInputs, gateDrivers);
  const rampProfiles = buildRampProfiles(aiWorkbookInputs);
  const workloadHours = P2P_AI_BENEFIT_MATRIX_ROWS.map((definition) => (
    workloadModel.processRows.find((row) => row.id === definition.id)?.finalHours || 0
  ));
  const totalMonthlyHours = round(workloadHours.reduce((sum, value) => sum + value, 0), 12);

  const personas = P2P_AI_BENEFIT_PERSONAS.map((persona) => {
    const ambitionScalar = getPersonaAmbitionScalar(personaInputs, persona.workbookColumn);
    const rampProfile = rampProfiles[persona.rampProfileId];
    const rampRowMap = Object.fromEntries(rampProfile.rows.map((row) => [row.id, row]));
    const weightedAgentBase = { value: 0 };

    const processRows = matrixRows.map((row, index) => {
      const leverEffects = computeLeverEffects(row, ambitionScalar.value, gateDrivers);
      const steady = Math.min(
        1 - (1 - leverEffects.leAuto) * (1 - leverEffects.leCopilot) * (1 - leverEffects.leAgent),
        effectiveCeiling,
      );
      const years = YEAR_KEYS.map((yearKey, yearIndex) => ({
        key: yearKey,
        label: YEAR_LABELS[yearIndex],
        reduction: round(
          computeYearReduction(
            leverEffects.leAuto,
            leverEffects.leCopilot,
            leverEffects.leAgent,
            effectiveCeiling,
            rampRowMap.auto.years[yearIndex].value,
            rampRowMap.copilot.years[yearIndex].value,
            rampRowMap.agent.years[yearIndex].value,
          ),
          12,
        ),
      }));

      weightedAgentBase.value += workloadHours[index] * leverEffects.leAgent;

      return {
        id: row.id,
        label: row.label,
        detailRow: persona.detailStartRow + index,
        monthlyHours: workloadHours[index],
        leAuto: round(leverEffects.leAuto, 12),
        leCopilot: round(leverEffects.leCopilot, 12),
        leAgent: round(leverEffects.leAgent, 12),
        steady: round(steady, 12),
        years,
      };
    });

    const reducedHoursSteady = processRows.reduce((sum, row, index) => sum + (workloadHours[index] * (1 - row.steady)), 0);
    const reducedHoursByYear = YEAR_KEYS.map((yearKey) => processRows.reduce((sum, row, index) => {
      const yearValue = row.years.find((item) => item.key === yearKey)?.reduction || 0;
      return sum + (workloadHours[index] * (1 - yearValue));
    }, 0));
    const weightedNetReductionSteady = totalMonthlyHours > 0 ? processRows.reduce((sum, row, index) => sum + (workloadHours[index] * row.steady), 0) / totalMonthlyHours : 0;
    const weightedNetReductionByYear = YEAR_KEYS.map((yearKey) => (
      totalMonthlyHours > 0
        ? processRows.reduce((sum, row, index) => {
          const yearValue = row.years.find((item) => item.key === yearKey)?.reduction || 0;
          return sum + (workloadHours[index] * yearValue);
        }, 0) / totalMonthlyHours
        : 0
    ));
    const agentHoursAnnualisedByYear = YEAR_KEYS.map((yearKey, yearIndex) => weightedAgentBase.value * rampRowMap.agent.years[yearIndex].value * 12);
    const impliedAutomationPct = totalMonthlyHours > 0
      ? processRows.reduce((sum, row, index) => sum + (workloadHours[index] * row.leAuto), 0) / totalMonthlyHours
      : 0;
    const impliedAiPct = totalMonthlyHours > 0
      ? processRows.reduce((sum, row, index) => sum + (workloadHours[index] * (1 - (1 - row.leCopilot) * (1 - row.leAgent))), 0) / totalMonthlyHours
      : 0;

    return {
      ...persona,
      ambitionScalar,
      rampProfile,
      processRows,
      summary: {
        reducedHoursSteady: round(reducedHoursSteady, 12),
        reducedHoursByYear: reducedHoursByYear.map((value) => round(value, 12)),
        weightedNetReductionSteady: round(weightedNetReductionSteady, 12),
        weightedNetReductionByYear: weightedNetReductionByYear.map((value) => round(value, 12)),
        agentHoursAnnualisedByYear: agentHoursAnnualisedByYear.map((value) => round(value, 12)),
        impliedAutomationPct: round(impliedAutomationPct, 12),
        impliedAiPct: round(impliedAiPct, 12),
        hoursRemovedPerMonthSteady: round(totalMonthlyHours - reducedHoursSteady, 12),
        agentHoursY3Annualised: round(agentHoursAnnualisedByYear[2] || 0, 12),
        weightedNetReductionY1: round(weightedNetReductionByYear[0] || 0, 12),
      },
    };
  });

  return {
    ...P2P_AI_BENEFIT_SNAPSHOT,
    gateDrivers,
    matrixRows,
    rampProfiles,
    personas,
    consolidatedRows: buildConsolidatedRows(personas),
    totalMonthlyHours,
    yearLabels: YEAR_LABELS,
  };
}