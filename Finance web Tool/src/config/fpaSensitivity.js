import { buildFpaAiBenefitWorkbookView } from "./fpaAiBenefit";
import { buildFpaBusinessCaseWorkbookView } from "./fpaBusinessCase";
import { buildFpaCostWorkbookView } from "./fpaCost";
import { buildFpaOpsModelWorkbookView } from "./fpaOpsModel";
import {
  FPA_PERSONA_LIBRARY_COLUMNS,
  FPA_PERSONA_LIBRARY_ROWS,
} from "./fpaPersonas";
import { buildFpaPricingWorkbookView } from "./fpaPricing";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const CURRENCY_ZERO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const CURRENCY_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

const ONE_WAY_SHOCK_DEFS = Object.freeze([
  {
    key: "automationShortfall",
    rowNumber: 21,
    label: "Automation shortfall -5pp",
    getPriceFactor: () => 1,
    getCostFactor: ({ laborShareOfCostPct }) => 1 + (0.05 * laborShareOfCostPct),
  },
  {
    key: "automationUpside",
    rowNumber: 22,
    label: "Automation upside +5pp",
    getPriceFactor: () => 1,
    getCostFactor: ({ laborShareOfCostPct }) => 1 - (0.05 * laborShareOfCostPct),
  },
  {
    key: "utilisationDown",
    rowNumber: 23,
    label: "Utilisation -5pp",
    getPriceFactor: () => 1,
    getCostFactor: ({ utilisationPct }) => safeDivide(utilisationPct, utilisationPct - 0.05),
  },
  {
    key: "shrinkageUp",
    rowNumber: 24,
    label: "Shrinkage +5pp",
    getPriceFactor: () => 1,
    getCostFactor: ({ shrinkagePct }) => safeDivide(1 - shrinkagePct, (1 - shrinkagePct) - 0.05),
  },
  {
    key: "priceDiscount",
    rowNumber: 25,
    label: "Price discount -5%",
    getPriceFactor: () => 0.95,
    getCostFactor: () => 1,
  },
  {
    key: "scopeCreep",
    rowNumber: 26,
    label: "Scope creep +10% hours",
    getPriceFactor: () => 1,
    getCostFactor: ({ laborShareOfCostPct }) => 1 + (0.1 * laborShareOfCostPct),
  },
  {
    key: "wageGapOffshore",
    rowNumber: 27,
    label: "Wage gap +2pp (offshore)",
    getPriceFactor: () => 1,
    getCostFactor: ({ laborShareOfCostPct, offshoreMixPct }) => 1 + (0.02 * laborShareOfCostPct * offshoreMixPct),
  },
  {
    key: "benefitRampSlip",
    rowNumber: 28,
    label: "Benefit ramp slips 6 mo",
    getPriceFactor: () => 1,
    getCostFactor: ({ netReductionSteadyPct, netReductionY1Pct, laborShareOfCostPct }) => (
      1 + (0.5 * safeDivide(netReductionSteadyPct - netReductionY1Pct, 1 - netReductionY1Pct) * laborShareOfCostPct)
    ),
  },
  {
    key: "combinedDownside",
    rowNumber: 29,
    label: "COMBINED DOWNSIDE",
    getPriceFactor: () => 0.95,
    getCostFactor: ({ laborShareOfCostPct, utilisationPct, shrinkagePct }) => (
      (1 + (0.05 * laborShareOfCostPct))
      * safeDivide(utilisationPct, utilisationPct - 0.05)
      * safeDivide(1 - shrinkagePct, (1 - shrinkagePct) - 0.05)
    ),
  },
]);

const SCENARIO_CASE_DEFS = Object.freeze([
  {
    key: "base",
    rowNumber: 33,
    label: "Base",
    getPriceFactor: () => 1,
    getCostFactor: () => 1,
  },
  {
    key: "best",
    rowNumber: 34,
    label: "Best (cost -3%)",
    getPriceFactor: () => 1,
    getCostFactor: () => 0.97,
  },
  {
    key: "downside",
    rowNumber: 35,
    label: "Downside (combined)",
    fromShockKey: "combinedDownside",
  },
]);

const AUTOMATION_DELTA_COLUMNS = Object.freeze([
  { key: "minus10", rowNumber: 39, label: "-10%", value: -0.1 },
  { key: "minus5", rowNumber: 39, label: "-5%", value: -0.05 },
  { key: "zero", rowNumber: 39, label: "0%", value: 0 },
  { key: "plus5", rowNumber: 39, label: "+5%", value: 0.05 },
  { key: "plus10", rowNumber: 39, label: "+10%", value: 0.1 },
]);

const PRICE_DISCOUNT_ROWS = Object.freeze([
  { key: "pd0", rowNumber: 40, label: "0%", value: 0 },
  { key: "pd25", rowNumber: 41, label: "2.5%", value: 0.025 },
  { key: "pd50", rowNumber: 42, label: "5.0%", value: 0.05 },
  { key: "pd75", rowNumber: 43, label: "7.5%", value: 0.075 },
  { key: "pd100", rowNumber: 44, label: "10.0%", value: 0.1 },
]);

export const FPA_SENSITIVITY_INSPECT_AUTO = "__AUTO__";

export const FPA_SENSITIVITY_SNAPSHOT = Object.freeze({
  sheetName: "FPA_17 Sensitivity",
  title: "17. Sensitivity - FP&A closed-form shocks on the priced deal",
  note: "Price is contracted: shocks hit cost. New GM% = 1-(1-GM%) x CostFactor / PriceFactor. Case NPVs re-discount the 16 revenue/cost lines.",
  formulaCount: 85,
  personaCount: 5,
  oneWayShockCount: ONE_WAY_SHOCK_DEFS.length,
  scenarioCount: SCENARIO_CASE_DEFS.length,
  matrixRowCount: PRICE_DISCOUNT_ROWS.length,
  matrixColumnCount: AUTOMATION_DELTA_COLUMNS.length,
});

function trimValue(value) {
  return String(value ?? "").trim();
}

function round(value, digits = 12) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "");

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

function safeDivide(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return 0;
  }

  if (Math.abs(denominator) < 0.000001) {
    return 0;
  }

  return numerator / denominator;
}

function normalizePersonaId(value) {
  const normalized = trimValue(value);

  switch (normalized) {
    case "aggressive-ai-first":
      return "aggressiveAiFirst";
    case "autonomous-finance":
      return "autonomousFinance";
    default:
      return normalized || "standard";
  }
}

function readPersonaMetric(personaInputs, persona, rowKey) {
  const row = PERSONA_ROW_MAP[rowKey];
  if (!row) {
    return 0;
  }

  const address = `${persona.workbookColumn}${row.workbookRow}`;
  if (!Object.prototype.hasOwnProperty.call(personaInputs, address)) {
    return Number(row.values[persona.key] || 0);
  }

  const numeric = parseNumericText(personaInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? numeric : Number(row.values[persona.key] || 0);
}

function getPricingRowValue(pricingView, rowKey, personaKey) {
  const row = pricingView.summaryRows.find((item) => item.key === rowKey);
  const cell = row?.values?.find((item) => item.key === personaKey);
  return Number(cell?.value || 0);
}

function computeNewGrossMarginPct(baseGrossMarginPct, priceFactor, costFactor) {
  return round(1 - ((1 - baseGrossMarginPct) * costFactor / priceFactor), 12);
}

function computeScenarioNpv(npvRevenue, npvCost, investment, priceFactor, costFactor) {
  return round((npvRevenue * priceFactor) - (npvCost * costFactor) - investment, 12);
}

export function formatSensitivityValue(value, format = "currency0") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  switch (format) {
    case "currency2":
      return CURRENCY_TWO_FORMATTER.format(numeric);
    case "currency0":
      return CURRENCY_ZERO_FORMATTER.format(Math.round(numeric));
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    case "pp1": {
      const sign = numeric > 0 ? "+" : "";
      return `${sign}${(numeric * 100).toFixed(1)} pp`;
    }
    case "factor3":
      return numeric.toFixed(3);
    case "factor4":
      return numeric.toFixed(4);
    case "whole":
      return INTEGER_FORMATTER.format(Math.round(numeric));
    case "number2":
    default:
      return DECIMAL_TWO_FORMATTER.format(numeric);
  }
}

export function buildFpaSensitivityWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
  inspectPersonaId = FPA_SENSITIVITY_INSPECT_AUTO,
} = {}) {
  const workspace = normalizeFpaWorkspace(workspaceValue || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const workbookInputs = currentDeal?.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
    ? currentDeal.fpaWorkbookInputs
    : EMPTY_INPUTS;
  const benchmarkInputs = workbookInputs["FPA_04 Benchmarks"] && typeof workbookInputs["FPA_04 Benchmarks"] === "object"
    ? workbookInputs["FPA_04 Benchmarks"]
    : EMPTY_INPUTS;
  const workloadInputs = workbookInputs["FPA_05 Workload"] && typeof workbookInputs["FPA_05 Workload"] === "object"
    ? workbookInputs["FPA_05 Workload"]
    : EMPTY_INPUTS;
  const personaInputs = workbookInputs["FPA_07 Personas"] && typeof workbookInputs["FPA_07 Personas"] === "object"
    ? workbookInputs["FPA_07 Personas"]
    : EMPTY_INPUTS;
  const aiWorkbookInputs = workbookInputs["FPA_08 AI Benefit"] && typeof workbookInputs["FPA_08 AI Benefit"] === "object"
    ? workbookInputs["FPA_08 AI Benefit"]
    : EMPTY_INPUTS;
  const opsWorkbookInputs = workbookInputs["FPA_09 Ops Model"] && typeof workbookInputs["FPA_09 Ops Model"] === "object"
    ? workbookInputs["FPA_09 Ops Model"]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs["FPA_10 Rate Card"] && typeof workbookInputs["FPA_10 Rate Card"] === "object"
    ? workbookInputs["FPA_10 Rate Card"]
    : EMPTY_INPUTS;

  const pricingView = buildFpaPricingWorkbookView({ currentDeal, workspace, inspectPersonaId });
  const costView = buildFpaCostWorkbookView({ currentDeal, workspace, inspectPersonaId });
  const businessCaseView = buildFpaBusinessCaseWorkbookView({ currentDeal, workspace, inspectPersonaId });
  const aiView = buildFpaAiBenefitWorkbookView({
    aiWorkbookInputs,
    benchmarkInputs,
    workloadInputs,
    personaInputs,
    workspace,
    currentDeal,
  });
  const opsView = buildFpaOpsModelWorkbookView({
    opsWorkbookInputs,
    rateCardInputs,
  });

  const selectedPersonaId = normalizePersonaId(
    pricingView.selectedPersona?.key
      || businessCaseView.selectedPersona?.key
      || (inspectPersonaId === FPA_SENSITIVITY_INSPECT_AUTO ? pricingView.recommendedPersona?.key : inspectPersonaId)
      || "standard",
  );
  const recommendedPersonaId = normalizePersonaId(pricingView.recommendedPersona?.key || "standard");
  const personaHeaders = pricingView.personaHeaders || FPA_PERSONA_LIBRARY_COLUMNS;
  const selectedHeader = personaHeaders.find((persona) => persona.key === selectedPersonaId) || personaHeaders[1] || personaHeaders[0];
  const recommendedHeader = personaHeaders.find((persona) => persona.key === recommendedPersonaId) || personaHeaders[1] || personaHeaders[0];
  const selectedPersonaDefinition = FPA_PERSONA_LIBRARY_COLUMNS.find((persona) => persona.key === selectedHeader.key) || FPA_PERSONA_LIBRARY_COLUMNS[1] || FPA_PERSONA_LIBRARY_COLUMNS[0];

  const selectedAiPersona = aiView.personas.find((persona) => persona.id === selectedHeader.key) || aiView.personas[1] || aiView.personas[0];
  const selectedCostPersona = costView.personaSections.find((persona) => persona.key === selectedHeader.key) || costView.selectedPersona;
  const selectedBusinessCasePersona = businessCaseView.selectedPersona?.key === selectedHeader.key
    ? businessCaseView.selectedPersona
    : buildFpaBusinessCaseWorkbookView({ currentDeal, workspace, inspectPersonaId: selectedHeader.key }).selectedPersona;
  const offshoreMixRow = opsView.shoreMixTable.rows.find((row) => row.id === "offshore");

  const recommendedPrice = getPricingRowValue(pricingView, "recommendedAnnualPrice", selectedHeader.key);
  const costToServeY1 = Number(selectedCostPersona?.summary?.costToServeY1 || 0);
  const grossMarginPct = getPricingRowValue(pricingView, "grossMarginPct", selectedHeader.key);
  const impliedAutomationPct = Number(selectedAiPersona?.summary?.impliedAutomationPct || 0);
  const utilisationPct = readPersonaMetric(personaInputs, selectedPersonaDefinition, "utilisationPct");
  const shrinkagePct = readPersonaMetric(personaInputs, selectedPersonaDefinition, "shrinkagePct");
  const deliveryLaborY1 = Number(selectedCostPersona?.summary?.deliveryLaborY1 || 0);
  const laborShareOfCostPct = costToServeY1 > 0 ? round(deliveryLaborY1 / costToServeY1, 12) : 0;
  const offshoreMixPct = Number(offshoreMixRow?.values?.[selectedHeader.key]?.value || 0);
  const netReductionSteadyPct = Number(selectedAiPersona?.summary?.weightedNetReductionSteady || 0);
  const netReductionY1Pct = Number(selectedAiPersona?.summary?.weightedNetReductionY1 || 0);
  const npvRevenue = Number(selectedBusinessCasePersona?.summary?.npvRevenue || 0);
  const npvCost = Number(selectedBusinessCasePersona?.summary?.npvCost || 0);
  const providerCarriedInvestment = Number(selectedBusinessCasePersona?.summary?.investment || 0);
  const baseNpv = Number(selectedBusinessCasePersona?.summary?.npv || 0);

  const oneWayShockRows = ONE_WAY_SHOCK_DEFS.map((definition) => {
    const priceFactor = round(definition.getPriceFactor({
      laborShareOfCostPct,
      utilisationPct,
      shrinkagePct,
      offshoreMixPct,
      netReductionSteadyPct,
      netReductionY1Pct,
    }), 12);
    const costFactor = round(definition.getCostFactor({
      laborShareOfCostPct,
      utilisationPct,
      shrinkagePct,
      offshoreMixPct,
      netReductionSteadyPct,
      netReductionY1Pct,
    }), 12);
    const newGrossMarginPct = computeNewGrossMarginPct(grossMarginPct, priceFactor, costFactor);

    return {
      ...definition,
      priceFactor,
      costFactor,
      newGrossMarginPct,
      deltaGrossMarginPp: round(newGrossMarginPct - grossMarginPct, 12),
    };
  });

  const oneWayShockMap = Object.fromEntries(oneWayShockRows.map((row) => [row.key, row]));

  const scenarioCaseRows = SCENARIO_CASE_DEFS.map((definition) => {
    const priceFactor = definition.fromShockKey
      ? Number(oneWayShockMap[definition.fromShockKey]?.priceFactor || 1)
      : round(definition.getPriceFactor(), 12);
    const costFactor = definition.fromShockKey
      ? Number(oneWayShockMap[definition.fromShockKey]?.costFactor || 1)
      : round(definition.getCostFactor(), 12);
    const grossMarginScenarioPct = computeNewGrossMarginPct(grossMarginPct, priceFactor, costFactor);

    return {
      ...definition,
      priceFactor,
      costFactor,
      grossMarginScenarioPct,
      npv: computeScenarioNpv(npvRevenue, npvCost, providerCarriedInvestment, priceFactor, costFactor),
    };
  });

  const baseScenario = scenarioCaseRows.find((row) => row.key === "base") || scenarioCaseRows[0];
  const downsideScenario = scenarioCaseRows.find((row) => row.key === "downside") || scenarioCaseRows[scenarioCaseRows.length - 1];

  const matrixRows = PRICE_DISCOUNT_ROWS.map((priceRow) => ({
    ...priceRow,
    cells: AUTOMATION_DELTA_COLUMNS.map((column) => {
      const costFactor = round(1 - (column.value * laborShareOfCostPct), 12);
      const priceFactor = round(1 - priceRow.value, 12);
      const value = computeNewGrossMarginPct(grossMarginPct, priceFactor, costFactor);

      return {
        key: `${priceRow.key}-${column.key}`,
        automationDeltaPct: column.value,
        priceDiscountPct: priceRow.value,
        costFactor,
        priceFactor,
        value,
      };
    }),
  }));

  const baseDriverRows = [
    { key: "recommendedPrice", rowNumber: 8, label: "Recommended price", value: recommendedPrice, format: "currency0" },
    { key: "costToServeY1", rowNumber: 9, label: "Cost-to-Serve Y1", value: costToServeY1, format: "currency0" },
    { key: "gmPct", rowNumber: 10, label: "GM % (run-rate)", value: grossMarginPct, format: "percent1" },
    { key: "impliedAutomation", rowNumber: 11, label: "Implied automation %", value: impliedAutomationPct, format: "percent1" },
    { key: "utilisation", rowNumber: 12, label: "Utilisation", value: utilisationPct, format: "percent1" },
    { key: "shrinkage", rowNumber: 13, label: "Shrinkage", value: shrinkagePct, format: "percent1" },
    { key: "laborShare", rowNumber: 14, label: "Labor share of cost", value: laborShareOfCostPct, format: "percent1" },
    { key: "offshoreMix", rowNumber: 15, label: "Offshore mix", value: offshoreMixPct, format: "percent1" },
    { key: "netRedSteady", rowNumber: 16, label: "Net red - steady", value: netReductionSteadyPct, format: "percent1" },
    { key: "netRedY1", rowNumber: 17, label: "Net red - Y1", value: netReductionY1Pct, format: "percent1" },
  ];

  return {
    ...FPA_SENSITIVITY_SNAPSHOT,
    formulaNarrative: "New GM % = 1 - (1 - GM %) x Cost Factor / Price Factor",
    scenarioNpvNarrative: "NPV = NPV Revenue x Price Factor - NPV Cost x Cost Factor - Investment",
    personaHeaders,
    selectedPersona: {
      ...selectedHeader,
      index: Math.max(1, personaHeaders.findIndex((persona) => persona.key === selectedHeader.key) + 1),
      metrics: {
        recommendedPrice,
        costToServeY1,
        grossMarginPct,
        impliedAutomationPct,
        utilisationPct,
        shrinkagePct,
        laborShareOfCostPct,
        offshoreMixPct,
        netReductionSteadyPct,
        netReductionY1Pct,
        npvRevenue,
        npvCost,
        providerCarriedInvestment,
        baseNpv,
      },
    },
    recommendedPersona: {
      ...recommendedHeader,
      index: Math.max(1, personaHeaders.findIndex((persona) => persona.key === recommendedHeader.key) + 1),
    },
    baseDriverRows,
    oneWayShockRows,
    scenarioCaseRows,
    automationDeltaColumns: AUTOMATION_DELTA_COLUMNS,
    matrixRows,
    highlights: {
      baseNpv: Number(baseScenario?.npv || 0),
      downsideNpv: Number(downsideScenario?.npv || 0),
      downsideGmPct: Number(downsideScenario?.grossMarginScenarioPct || 0),
      maxUpsideGmPct: Math.max(...matrixRows.flatMap((row) => row.cells.map((cell) => cell.value))),
      maxDownsideGmPct: Math.min(...matrixRows.flatMap((row) => row.cells.map((cell) => cell.value))),
    },
  };
}
