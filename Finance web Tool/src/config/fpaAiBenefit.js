import { buildFpaBenchmarkWorkbookView } from "./fpaBenchmarks";
import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";
import { buildFpaWorkloadWorkbookView } from "./fpaWorkload";

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const EMPTY_INPUTS = Object.freeze({});
const YEAR_KEYS = Object.freeze(["y1", "y2", "y3", "y4", "y5", "y6", "y7"]);
const YEAR_LABELS = Object.freeze(["Y1", "Y2", "Y3", "Y4", "Y5", "Y6", "Y7"]);
const PERSONA_AMBITION_DEFAULTS = Object.freeze({
  C: 0.4,
  D: 0.65,
  E: 0.8,
  F: 1,
  G: 1,
});

export const FPA_AI_BENEFIT_SNAPSHOT = Object.freeze({
  sheetName: "FPA_08 AI Benefit",
  title: "08. Addressability & AI Benefit Engine — FP&A L2 x lever x persona x year",
  note: "Effect = Addr x Red x (1-Residual) x Ambition x Ramp x Gate, applied sequentially across levers (structurally <=100%), capped at the effective ceiling. Agent lever also gated by the 02 §D data gate. [PA — calibrate].",
  formulaCount: 834,
  editableCellCount: 162,
  processCount: 12,
  personaCount: 5,
});

export const AI_GATE_OPTIONS = Object.freeze(["P", "PE", "S"]);

export const FPA_AI_BENEFIT_PERSONAS = Object.freeze([
  {
    id: "conservative",
    label: "Conservative",
    workbookColumn: "C",
    rampProfileId: "standard",
    sectionTitle: "Persona 1: Conservative — Net Reduction by Process & Year",
    detailStartRow: 38,
  },
  {
    id: "standard",
    label: "Standard",
    workbookColumn: "D",
    rampProfileId: "standard",
    sectionTitle: "Persona 2: Standard — Net Reduction by Process & Year",
    detailStartRow: 57,
  },
  {
    id: "lean",
    label: "Lean",
    workbookColumn: "E",
    rampProfileId: "standard",
    sectionTitle: "Persona 3: Lean — Net Reduction by Process & Year",
    detailStartRow: 76,
  },
  {
    id: "aggressiveAiFirst",
    label: "Aggressive AI-First",
    workbookColumn: "F",
    rampProfileId: "standard",
    sectionTitle: "Persona 4: Aggressive AI-First — Net Reduction by Process & Year",
    detailStartRow: 95,
  },
  {
    id: "autonomousFinance",
    label: "Autonomous Finance",
    workbookColumn: "G",
    rampProfileId: "autonomous",
    sectionTitle: "Persona 5: Autonomous Finance — Net Reduction by Process & Year",
    detailStartRow: 114,
  },
]);

export const FPA_AI_BENEFIT_MATRIX_ROWS = Object.freeze([
  {
    id: "strategicLongRangePlanning",
    workloadRow: 14,
    aiRow: 12,
    label: "Strategic & Long-Range Planning",
    defaults: { autoAddr: 0.15, autoRed: 0.4, autoRes: 0.1, copAddr: 0.3, copRed: 0.3, copRes: 0.2, agtAddr: 0.05, agtRed: 0.4, agtRes: 0.3, gate: "P" },
  },
  {
    id: "budgetingPlanning",
    workloadRow: 15,
    aiRow: 13,
    label: "Annual Budgeting & Target Setting",
    defaults: { autoAddr: 0.45, autoRed: 0.55, autoRes: 0.1, copAddr: 0.3, copRed: 0.35, copRes: 0.15, agtAddr: 0.2, agtRed: 0.5, agtRes: 0.2, gate: "PE" },
  },
  {
    id: "rollingForecastingIbp",
    workloadRow: 16,
    aiRow: 14,
    label: "Rolling Forecasting & IBP",
    defaults: { autoAddr: 0.45, autoRed: 0.55, autoRes: 0.1, copAddr: 0.35, copRed: 0.4, copRes: 0.15, agtAddr: 0.25, agtRed: 0.5, agtRes: 0.2, gate: "PE" },
  },
  {
    id: "commercialForecasting",
    workloadRow: 17,
    aiRow: 15,
    label: "Revenue & Commercial Forecasting",
    defaults: { autoAddr: 0.4, autoRed: 0.5, autoRes: 0.1, copAddr: 0.35, copRed: 0.4, copRes: 0.15, agtAddr: 0.2, agtRed: 0.5, agtRes: 0.2, gate: "P" },
  },
  {
    id: "costProductivityMarginManagement",
    workloadRow: 18,
    aiRow: 16,
    label: "Cost, Productivity & Margin Management",
    defaults: { autoAddr: 0.5, autoRed: 0.55, autoRes: 0.1, copAddr: 0.3, copRed: 0.35, copRes: 0.15, agtAddr: 0.2, agtRed: 0.5, agtRes: 0.2, gate: "P" },
  },
  {
    id: "workforceCapacityPlanning",
    workloadRow: 19,
    aiRow: 17,
    label: "Workforce & Capacity Planning",
    defaults: { autoAddr: 0.4, autoRed: 0.5, autoRes: 0.1, copAddr: 0.25, copRed: 0.35, copRes: 0.15, agtAddr: 0.15, agtRed: 0.45, agtRes: 0.2, gate: "P" },
  },
  {
    id: "cashFlowCapitalPlanning",
    workloadRow: 20,
    aiRow: 18,
    label: "Cash Flow & Capital Planning",
    defaults: { autoAddr: 0.45, autoRed: 0.5, autoRes: 0.1, copAddr: 0.25, copRed: 0.35, copRes: 0.15, agtAddr: 0.15, agtRed: 0.45, agtRes: 0.25, gate: "P" },
  },
  {
    id: "variancePerformanceManagement",
    workloadRow: 21,
    aiRow: 19,
    label: "Variance Analysis & Performance Management",
    defaults: { autoAddr: 0.5, autoRed: 0.55, autoRes: 0.1, copAddr: 0.45, copRed: 0.45, copRes: 0.15, agtAddr: 0.3, agtRed: 0.55, agtRes: 0.2, gate: "P" },
  },
  {
    id: "managementReportingDecisionSupport",
    workloadRow: 22,
    aiRow: 20,
    label: "Management Reporting & Decision Support",
    defaults: { autoAddr: 0.55, autoRed: 0.6, autoRes: 0.1, copAddr: 0.35, copRed: 0.4, copRes: 0.15, agtAddr: 0.3, agtRed: 0.55, agtRes: 0.2, gate: "P" },
  },
  {
    id: "scenarioRiskModeling",
    workloadRow: 23,
    aiRow: 21,
    label: "Scenario Planning & Risk Modelling",
    defaults: { autoAddr: 0.25, autoRed: 0.45, autoRes: 0.1, copAddr: 0.35, copRed: 0.35, copRes: 0.2, agtAddr: 0.1, agtRed: 0.4, agtRes: 0.3, gate: "S" },
  },
  {
    id: "profitabilityPricingBusinessCases",
    workloadRow: 24,
    aiRow: 22,
    label: "Profitability, Pricing & Business Cases",
    defaults: { autoAddr: 0.35, autoRed: 0.5, autoRes: 0.1, copAddr: 0.3, copRed: 0.35, copRes: 0.2, agtAddr: 0.15, agtRed: 0.45, agtRes: 0.25, gate: "P" },
  },
  {
    id: "governanceMasterDataBusinessPartnering",
    workloadRow: 25,
    aiRow: 23,
    label: "Governance, Master Data & Business Partnering",
    defaults: { autoAddr: 0.4, autoRed: 0.5, autoRes: 0.1, copAddr: 0.2, copRed: 0.3, copRes: 0.2, agtAddr: 0.15, agtRed: 0.45, agtRes: 0.25, gate: "P" },
  },
]);

export const FPA_AI_BENEFIT_RAMP_PROFILES = Object.freeze({
  standard: {
    id: "standard",
    label: "Standard Ramp",
    note: "Workbook rows 27-29 are used by Conservative, Standard, Lean, and Aggressive AI-First.",
    rows: [
      { id: "auto", label: "AUTO (standard)", row: 27, values: { y1: 0.5, y2: 0.85, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
      { id: "copilot", label: "COPILOT (standard)", row: 28, values: { y1: 0.25, y2: 0.6, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
      { id: "agent", label: "AGENT (standard)", row: 29, values: { y1: 0, y2: 0.4, y3: 0.8, y4: 1, y5: 1, y6: 1, y7: 1 } },
    ],
  },
  autonomous: {
    id: "autonomous",
    label: "Autonomous Ramp",
    note: "Workbook rows 31-33 are used only by Autonomous Finance.",
    rows: [
      { id: "auto", label: "AUTO (Autonomous persona)", row: 31, values: { y1: 0.6, y2: 0.9, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
      { id: "copilot", label: "COPILOT (Autonomous persona)", row: 32, values: { y1: 0.4, y2: 0.8, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
      { id: "agent", label: "AGENT (Autonomous persona)", row: 33, values: { y1: 0.25, y2: 0.6, y3: 1, y4: 1, y5: 1, y6: 1, y7: 1 } },
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

function createAddressMap(rows = []) {
  const addressMap = {};

  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      addressMap[cell.address] = cell;
    });
  });

  return addressMap;
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

function getCellNumber(addressMap, address, fallback = 0) {
  const cell = addressMap[address];
  if (!cell) {
    return fallback;
  }

  const numeric = parseNumericText(cell.raw ?? cell.text, Number.NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getCellText(addressMap, address, fallback = "") {
  const cell = addressMap[address];
  if (!cell) {
    return fallback;
  }

  const text = trimValue(cell.text || cell.raw);
  return text || fallback;
}

function lookupByLabel(addressMap, { startRow, endRow, lookupValue, valueColumn, fallback = 0 }) {
  const needle = trimValue(lookupValue);
  for (let row = startRow; row <= endRow; row += 1) {
    const label = getCellText(addressMap, `B${row}`);
    if (label === needle) {
      return getCellNumber(addressMap, `${valueColumn}${row}`, fallback);
    }
  }

  return fallback;
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
  return FPA_AI_BENEFIT_MATRIX_ROWS.map((definition) => {
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
    Object.entries(FPA_AI_BENEFIT_RAMP_PROFILES).map(([profileId, profile]) => {
      const rows = profile.rows.map((row) => ({
        ...row,
        years: YEAR_KEYS.map((yearKey, index) => ({
          key: yearKey,
          label: YEAR_LABELS[index],
          address: `${String.fromCharCode(67 + index)}${row.row}`,
          value: readWorkbookPercentInput(aiWorkbookInputs, `${String.fromCharCode(67 + index)}${row.row}`, row.values[yearKey]),
        })),
      }));

      return [
        profileId,
        {
          ...profile,
          rows,
        },
      ];
    }),
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
    {
      label: "Implied Automation %",
      format: "percent1",
      values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.impliedAutomationPct])),
    },
    {
      label: "Implied AI %",
      format: "percent1",
      values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.impliedAiPct])),
    },
    {
      label: "Weighted Net Red — Steady",
      format: "percent1",
      values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.weightedNetReductionSteady])),
    },
    {
      label: "Weighted Net Red — Y1",
      format: "percent1",
      values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.weightedNetReductionY1])),
    },
    {
      label: "Hours removed / month (steady)",
      format: "whole",
      values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.hoursRemovedPerMonthSteady])),
    },
    {
      label: "Agent hours Y3 (annualised)",
      format: "whole",
      values: Object.fromEntries(personas.map((persona) => [persona.id, persona.summary.agentHoursY3Annualised])),
    },
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
      return String(value ?? "—");
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

export function buildFpaAiBenefitWorkbookView({
  aiWorkbookInputs = EMPTY_INPUTS,
  benchmarkInputs = EMPTY_INPUTS,
  workloadInputs = EMPTY_INPUTS,
  personaInputs = EMPTY_INPUTS,
  workspace = {},
  currentDeal = {},
} = {}) {
  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const benchmarkView = buildFpaBenchmarkWorkbookView(benchmarkInputs, discoveryMetrics.effectiveDiscovery);
  const benchmarkCellMap = createAddressMap(benchmarkView.rows);
  const workloadView = buildFpaWorkloadWorkbookView(workloadInputs, benchmarkInputs, workspace, currentDeal);
  const workloadCellMap = createAddressMap(workloadView.rows);

  const industryAutomationCeiling = lookupByLabel(benchmarkCellMap, {
    startRow: 6,
    endRow: 13,
    lookupValue: discoveryMetrics.effectiveDiscovery.industryVertical,
    valueColumn: "E",
    fallback: 0.35,
  });
  const aiMaturityCeiling = lookupByLabel(benchmarkCellMap, {
    startRow: 40,
    endRow: 43,
    lookupValue: discoveryMetrics.effectiveDiscovery.aiMaturity,
    valueColumn: "C",
    fallback: 0.12,
  });

  const aiMaturityRank = discoveryMetrics.effectiveDiscovery.aiMaturity === "None"
    ? 1
    : discoveryMetrics.effectiveDiscovery.aiMaturity === "Exploring"
      ? 2
      : discoveryMetrics.effectiveDiscovery.aiMaturity === "Piloting"
        ? 3
        : 4;
  const platformModernizationFlag = discoveryMetrics.effectiveDiscovery.platformModernizationInScope === "Yes" ? 1 : 0;
  const effectiveCeiling = industryAutomationCeiling + (platformModernizationFlag === 1 ? 0.15 : 0);
  const agenticDataGate = Number(discoveryMetrics.techModernizationGate || 0);
  const gateNarrative = agenticDataGate === 1
    ? "OPEN — data readiness supports agentic levers"
    : "SHUT — agent benefit suppressed until data readiness >= 2.3";

  const gateDrivers = {
    industryAutomationCeiling,
    effectiveCeiling,
    aiMaturityCeiling,
    aiMaturityRank,
    platformModernizationFlag,
    agenticDataGate,
    gateNarrative,
  };

  const matrixRows = buildMatrixRows(aiWorkbookInputs, gateDrivers);
  const rampProfiles = buildRampProfiles(aiWorkbookInputs);
  const workloadHours = FPA_AI_BENEFIT_MATRIX_ROWS.map((definition) => getCellNumber(workloadCellMap, `K${definition.workloadRow}`, 0));
  const totalMonthlyHours = round(workloadHours.reduce((sum, value) => sum + value, 0), 12);

  const personas = FPA_AI_BENEFIT_PERSONAS.map((persona) => {
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
      const years = YEAR_KEYS.map((yearKey, yearIndex) => {
        const reduction = computeYearReduction(
          leverEffects.leAuto,
          leverEffects.leCopilot,
          leverEffects.leAgent,
          effectiveCeiling,
          rampRowMap.auto.years[yearIndex].value,
          rampRowMap.copilot.years[yearIndex].value,
          rampRowMap.agent.years[yearIndex].value,
        );

        return {
          key: yearKey,
          label: YEAR_LABELS[yearIndex],
          reduction: round(reduction, 12),
        };
      });

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
    ...FPA_AI_BENEFIT_SNAPSHOT,
    gateDrivers,
    matrixRows,
    rampProfiles,
    personas,
    consolidatedRows: buildConsolidatedRows(personas),
    totalMonthlyHours,
    yearLabels: YEAR_LABELS,
  };
}
