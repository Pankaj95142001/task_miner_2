import { buildFpaAiBenefitWorkbookView } from "./fpaAiBenefit";
import { buildFpaBenchmarkWorkbookView } from "./fpaBenchmarks";
import { buildFpaCostWorkbookView } from "./fpaCost";
import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";
import { buildFpaFteEngineWorkbookView } from "./fpaFteEngine";
import { FPA_PERSONA_LIBRARY_COLUMNS } from "./fpaPersonas";
import { buildFpaPricingWorkbookView } from "./fpaPricing";
import { buildFpaRateCardWorkbookView } from "./fpaRateCard";
import { buildFpaRecommendWorkbookView } from "./fpaRecommend";
import { buildFpaRiskWorkbookView } from "./fpaRisk";
import { buildFpaWorkloadWorkbookView } from "./fpaWorkload";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const CURRENCY_ZERO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_ONE_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const SIZING_PROCESS_ROWS = Object.freeze([
  { confidenceRow: 6, workloadRow: 14, reconciliationRow: 44, label: "Strategic & Long-Range Planning" },
  { confidenceRow: 7, workloadRow: 15, reconciliationRow: 45, label: "Annual Budgeting & Target Setting" },
  { confidenceRow: 8, workloadRow: 16, reconciliationRow: 46, label: "Rolling Forecasting & IBP" },
  { confidenceRow: 9, workloadRow: 17, reconciliationRow: 47, label: "Revenue & Commercial Forecasting" },
  { confidenceRow: 10, workloadRow: 18, reconciliationRow: 48, label: "Cost, Productivity & Margin Management" },
  { confidenceRow: 11, workloadRow: 19, reconciliationRow: 49, label: "Workforce & Capacity Planning" },
  { confidenceRow: 12, workloadRow: 20, reconciliationRow: 50, label: "Cash Flow & Capital Planning" },
  { confidenceRow: 13, workloadRow: 21, reconciliationRow: 51, label: "Variance Analysis & Performance Management" },
  { confidenceRow: 14, workloadRow: 22, reconciliationRow: 52, label: "Management Reporting & Decision Support" },
  { confidenceRow: 15, workloadRow: 23, reconciliationRow: 53, label: "Scenario Planning & Risk Modelling" },
  { confidenceRow: 16, workloadRow: 24, reconciliationRow: 54, label: "Profitability, Pricing & Business Cases" },
  { confidenceRow: 17, workloadRow: 25, reconciliationRow: 55, label: "Governance, Master Data & Business Partnering" },
]);

export const FPA_CONFIDENCE_SNAPSHOT = Object.freeze({
  sheetName: "FPA_25 Confidence",
  title: "25. Confidence Engine — FP&A sizing / AI / commercial / validation confidence (per L2 and per persona)",
  note: "Per-L2 confidence = method base (A 0.9 / D 0.6 / E 0.35) x coverage adjustment x variance penalty. Persona score = 40% sizing + 25% AI benefit + 20% commercial + 15% validation.",
  formulaCount: 157,
  l2ProcessCount: SIZING_PROCESS_ROWS.length,
  personaCount: FPA_PERSONA_LIBRARY_COLUMNS.length,
});

function trimValue(value) {
  return String(value ?? "").trim();
}

function round(value, digits = 12) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumericText(value, fallback = Number.NaN) {
  const normalized = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "");

  if (!normalized) {
    return fallback;
  }

  if (normalized.endsWith("%")) {
    const numericPercent = Number(normalized.slice(0, -1).trim());
    return Number.isFinite(numericPercent) ? numericPercent / 100 : fallback;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function trimTrailingZeros(value) {
  return String(value)
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "");
}

function formatDecimal(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return trimTrailingZeros(numeric.toFixed(digits));
}

function formatPercent(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${(numeric * 100).toFixed(digits)}%`;
}

function formatThousandsCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${INTEGER_FORMATTER.format(Math.round(numeric / 1000))}k`;
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

function getCellText(addressMap, address, fallback = "") {
  const cell = addressMap[address];
  if (!cell) {
    return fallback;
  }

  const text = trimValue(cell.text ?? cell.raw ?? "");
  return text || fallback;
}

function getCellNumber(addressMap, address, fallback = 0) {
  const cell = addressMap[address];
  if (!cell) {
    return fallback;
  }

  const numeric = parseNumericText(cell.raw ?? cell.text, Number.NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getSummaryRowValueMap(summaryRows = [], rowNumber) {
  const row = summaryRows.find((candidate) => candidate.rowNumber === rowNumber);
  if (!row) {
    return {};
  }

  return Object.fromEntries((row.values || []).map((value) => [value.key, Number(value.value || 0)]));
}

function getSummaryRowTextMap(summaryRows = [], rowNumber) {
  const row = summaryRows.find((candidate) => candidate.rowNumber === rowNumber);
  if (!row) {
    return {};
  }

  return Object.fromEntries((row.values || []).map((value) => [value.key, trimValue(value.text || value.value)]));
}

function confidenceBand(score) {
  if (score >= 0.75) {
    return "HIGH";
  }

  if (score >= 0.55) {
    return "MEDIUM";
  }

  return "LOW";
}

export function formatConfidenceValue(value, format = "status") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  switch (format) {
    case "decimal3":
      return formatDecimal(value, 3);
    case "decimal2":
      return formatDecimal(value, 2);
    case "percent0":
      return formatPercent(value, 0);
    case "percent1":
      return formatPercent(value, 1);
    case "percent2":
      return formatPercent(value, 2);
    case "currency0": {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? CURRENCY_ZERO_FORMATTER.format(Math.round(numeric)) : "—";
    }
    case "fte1":
    case "number1": {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? DECIMAL_ONE_FORMATTER.format(numeric) : "—";
    }
    case "whole": {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? INTEGER_FORMATTER.format(Math.round(numeric)) : "—";
    }
    case "rangeK":
      return formatThousandsCurrency(value);
    case "band":
    case "method":
    case "status":
    default:
      return trimValue(value) || "—";
  }
}

function buildPersonaCells(personaHeaders, valueMap, format) {
  return personaHeaders.map((persona) => ({
    key: persona.key,
    label: persona.label,
    value: valueMap[persona.key],
    text: formatConfidenceValue(valueMap[persona.key], format),
  }));
}

export function buildFpaConfidenceWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
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
  const aiWorkbookInputs = workbookInputs["FPA_08 AI Benefit"] && typeof workbookInputs["FPA_08 AI Benefit"] === "object"
    ? workbookInputs["FPA_08 AI Benefit"]
    : EMPTY_INPUTS;
  const personaInputs = workbookInputs["FPA_07 Personas"] && typeof workbookInputs["FPA_07 Personas"] === "object"
    ? workbookInputs["FPA_07 Personas"]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs["FPA_10 Rate Card"] && typeof workbookInputs["FPA_10 Rate Card"] === "object"
    ? workbookInputs["FPA_10 Rate Card"]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const benchmarkView = buildFpaBenchmarkWorkbookView(benchmarkInputs, discoveryMetrics.effectiveDiscovery);
  const workloadView = buildFpaWorkloadWorkbookView(workloadInputs, benchmarkInputs, workspace, currentDeal);
  const aiView = buildFpaAiBenefitWorkbookView({
    aiWorkbookInputs,
    benchmarkInputs,
    workloadInputs,
    personaInputs,
    workspace,
    currentDeal,
  });
  const rateCardView = buildFpaRateCardWorkbookView({ workbookInputs: rateCardInputs });
  const pricingView = buildFpaPricingWorkbookView({ currentDeal, workspace });
  const riskView = buildFpaRiskWorkbookView({ currentDeal, workspace });
  const fteView = buildFpaFteEngineWorkbookView({ currentDeal, workspace });
  const costView = buildFpaCostWorkbookView({ currentDeal, workspace });
  const recommendView = buildFpaRecommendWorkbookView({ currentDeal, workspace });

  const benchmarkCellMap = createAddressMap(benchmarkView.rows);
  const workloadCellMap = createAddressMap(workloadView.rows);
  const personaHeaders = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
  }));

  const benchmarkConstants = {
    methodBaseA: getCellNumber(benchmarkCellMap, "C166", 0.9),
    methodBaseD: getCellNumber(benchmarkCellMap, "C167", 0.6),
    methodBaseE: getCellNumber(benchmarkCellMap, "C168", 0.35),
    coverageScalar: getCellNumber(benchmarkCellMap, "C169", 0.05),
    variancePenaltyFactor: getCellNumber(benchmarkCellMap, "C170", 0.9),
    rateCardConfirmedBonus: getCellNumber(benchmarkCellMap, "C171", 0.05),
  };

  const coverageShare = round(Number(discoveryMetrics.coverageScorePct || 0) / 100, 12);
  const coverageAdjustment = round(
    Math.min(0.15, Math.max(0, (coverageShare - 0.3) / 0.1) * benchmarkConstants.coverageScalar),
    12,
  );
  const totalMonthlyHours = Math.max(0.01, getCellNumber(workloadCellMap, "K26", Number(aiView.totalMonthlyHours || 0)));

  const sizingRows = SIZING_PROCESS_ROWS.map((definition) => {
    const methodText = getCellText(workloadCellMap, `F${definition.workloadRow}`, "E");
    const methodLetter = trimValue(methodText).charAt(0).toUpperCase() || "E";
    const methodBase = methodLetter === "A"
      ? benchmarkConstants.methodBaseA
      : methodLetter === "D"
        ? benchmarkConstants.methodBaseD
        : benchmarkConstants.methodBaseE;
    const workloadVariance = getCellText(workloadCellMap, `M${definition.workloadRow}`, "").toUpperCase();
    const reconciliationVariance = getCellText(workloadCellMap, `M${definition.reconciliationRow}`, "").toUpperCase();
    const variancePenalty = workloadVariance.startsWith("AMBER")
      || reconciliationVariance.startsWith("RED")
      || reconciliationVariance.startsWith("AMBER")
      ? benchmarkConstants.variancePenaltyFactor
      : 1;
    const hoursPerMonth = round(getCellNumber(workloadCellMap, `K${definition.workloadRow}`, 0), 12);
    const weight = round(hoursPerMonth / totalMonthlyHours, 12);
    const l2Confidence = round(Math.min(0.98, (methodBase + coverageAdjustment) * variancePenalty), 12);

    return {
      ...definition,
      methodText,
      methodLetter,
      methodBase,
      coverageAdjustment,
      variancePenalty,
      l2Confidence,
      hoursPerMonth,
      weight,
    };
  });

  const weightedSizingConfidence = round(
    sizingRows.reduce((sum, row) => sum + (row.l2Confidence * row.weight), 0),
    12,
  );

  const aiPersonaMap = Object.fromEntries((aiView.personas || []).map((persona) => [persona.id, persona]));
  const pricingBiasClampByPersona = getSummaryRowTextMap(pricingView.summaryRows || [], 12);
  const recommendedAnnualPriceByPersona = getSummaryRowValueMap(pricingView.summaryRows || [], 11);
  const costToServeByPersona = getSummaryRowValueMap(costView.summaryRows || [], 7);
  const steadyFteByPersona = getSummaryRowValueMap(fteView.summaryRows || [], 37);
  const riskPersonaMap = Object.fromEntries((riskView.personaVerdicts || []).map((persona) => [persona.key, persona]));

  const effectiveCeiling = Math.max(0.01, Number(aiView.gateDrivers?.effectiveCeiling || 0.01));
  const agenticDataGate = Number(aiView.gateDrivers?.agenticDataGate || 0);
  const rateCardConfirmed = trimValue(rateCardView.confirmation?.value).toUpperCase() === "YES";
  const commercialBase = rateCardConfirmed ? 0.85 + benchmarkConstants.rateCardConfirmedBonus : 0.65;

  const sizingConfidenceByPersona = Object.fromEntries(personaHeaders.map((persona) => [persona.key, weightedSizingConfidence]));
  const aiBenefitConfidenceByPersona = Object.fromEntries(personaHeaders.map((persona) => {
    const weightedNetReductionSteady = Number(aiPersonaMap[persona.key]?.summary?.weightedNetReductionSteady || 0);
    const value = round(
      Math.max(0.3, 1 - ((weightedNetReductionSteady / effectiveCeiling) * 0.6) - (agenticDataGate === 0 ? 0.05 : 0)),
      12,
    );
    return [persona.key, value];
  }));
  const commercialConfidenceByPersona = Object.fromEntries(personaHeaders.map((persona) => {
    const biasClamp = trimValue(pricingBiasClampByPersona[persona.key]).toUpperCase();
    const value = round(commercialBase - (biasClamp !== "OK" ? 0.1 : 0), 12);
    return [persona.key, value];
  }));
  const validationConfidenceByPersona = Object.fromEntries(personaHeaders.map((persona) => {
    const redCount = Number(riskPersonaMap[persona.key]?.redCount || 0);
    const amberCount = Number(riskPersonaMap[persona.key]?.amberCount || 0);
    const value = round(Math.max(0.3, 1 - (0.15 * redCount) - (0.05 * amberCount)), 12);
    return [persona.key, value];
  }));
  const confidenceScoreByPersona = Object.fromEntries(personaHeaders.map((persona) => {
    const value = round(
      (weightedSizingConfidence * 0.4)
      + ((aiBenefitConfidenceByPersona[persona.key] || 0) * 0.25)
      + ((commercialConfidenceByPersona[persona.key] || 0) * 0.2)
      + ((validationConfidenceByPersona[persona.key] || 0) * 0.15),
      12,
    );
    return [persona.key, value];
  }));
  const confidenceBandByPersona = Object.fromEntries(personaHeaders.map((persona) => [
    persona.key,
    confidenceBand(confidenceScoreByPersona[persona.key] || 0),
  ]));
  const rangePctByPersona = Object.fromEntries(personaHeaders.map((persona) => [
    persona.key,
    round((1 - (confidenceScoreByPersona[persona.key] || 0)) * 0.5, 12),
  ]));
  const fteLowByPersona = Object.fromEntries(personaHeaders.map((persona) => [
    persona.key,
    round((steadyFteByPersona[persona.key] || 0) * (1 - (rangePctByPersona[persona.key] || 0)), 12),
  ]));
  const fteHighByPersona = Object.fromEntries(personaHeaders.map((persona) => [
    persona.key,
    round((steadyFteByPersona[persona.key] || 0) * (1 + (rangePctByPersona[persona.key] || 0)), 12),
  ]));
  const priceLowByPersona = Object.fromEntries(personaHeaders.map((persona) => [
    persona.key,
    round((recommendedAnnualPriceByPersona[persona.key] || 0) * (1 - (rangePctByPersona[persona.key] || 0)), 12),
  ]));
  const priceHighByPersona = Object.fromEntries(personaHeaders.map((persona) => [
    persona.key,
    round((recommendedAnnualPriceByPersona[persona.key] || 0) * (1 + (rangePctByPersona[persona.key] || 0)), 12),
  ]));
  const costLowByPersona = Object.fromEntries(personaHeaders.map((persona) => [
    persona.key,
    round((costToServeByPersona[persona.key] || 0) * (1 - (rangePctByPersona[persona.key] || 0)), 12),
  ]));
  const costHighByPersona = Object.fromEntries(personaHeaders.map((persona) => [
    persona.key,
    round((costToServeByPersona[persona.key] || 0) * (1 + (rangePctByPersona[persona.key] || 0)), 12),
  ]));

  const personaRows = [
    { rowNumber: 23, label: "Sizing confidence", format: "decimal3", weight: 0.4, values: buildPersonaCells(personaHeaders, sizingConfidenceByPersona, "decimal3") },
    { rowNumber: 24, label: "AI-benefit confidence", format: "decimal3", weight: 0.25, values: buildPersonaCells(personaHeaders, aiBenefitConfidenceByPersona, "decimal3") },
    { rowNumber: 25, label: "Commercial confidence", format: "decimal3", weight: 0.2, values: buildPersonaCells(personaHeaders, commercialConfidenceByPersona, "decimal3") },
    { rowNumber: 26, label: "Validation confidence", format: "decimal3", weight: 0.15, values: buildPersonaCells(personaHeaders, validationConfidenceByPersona, "decimal3") },
    { rowNumber: 27, label: "CONFIDENCE SCORE", format: "decimal3", values: buildPersonaCells(personaHeaders, confidenceScoreByPersona, "decimal3"), isTotal: true },
    { rowNumber: 28, label: "Confidence band", format: "band", values: buildPersonaCells(personaHeaders, confidenceBandByPersona, "band") },
    { rowNumber: 29, label: "± range on size / price", format: "percent1", values: buildPersonaCells(personaHeaders, rangePctByPersona, "percent1") },
    { rowNumber: 30, label: "FTE low", format: "fte1", values: buildPersonaCells(personaHeaders, fteLowByPersona, "fte1") },
    { rowNumber: 31, label: "FTE high", format: "fte1", values: buildPersonaCells(personaHeaders, fteHighByPersona, "fte1") },
    { rowNumber: 32, label: "Price low", format: "currency0", values: buildPersonaCells(personaHeaders, priceLowByPersona, "currency0") },
    { rowNumber: 33, label: "Price high", format: "currency0", values: buildPersonaCells(personaHeaders, priceHighByPersona, "currency0") },
    { rowNumber: 34, label: "Cost-to-serve low", format: "currency0", values: buildPersonaCells(personaHeaders, costLowByPersona, "currency0") },
    { rowNumber: 35, label: "Cost-to-serve high", format: "currency0", values: buildPersonaCells(personaHeaders, costHighByPersona, "currency0") },
  ].map((row) => ({
    ...row,
    weightText: row.weight != null ? formatConfidenceValue(row.weight, "percent0") : "",
  }));

  const recommendedPersona = recommendView.recommendedPersona
    || personaHeaders.find((persona) => persona.key === "standard")
    || personaHeaders[0];
  const recommendedKey = recommendedPersona?.key || "standard";
  const recommendedIndex = Number(recommendedPersona?.index || personaHeaders.find((persona) => persona.key === recommendedKey)?.index || 2);

  const recommendedSummary = {
    key: recommendedKey,
    label: recommendedPersona?.label || "Standard",
    index: recommendedIndex,
    confidenceScore: confidenceScoreByPersona[recommendedKey] || 0,
    confidenceScoreText: formatConfidenceValue(confidenceScoreByPersona[recommendedKey] || 0, "decimal3"),
    confidenceBand: confidenceBandByPersona[recommendedKey] || "LOW",
    fteLow: fteLowByPersona[recommendedKey] || 0,
    fteHigh: fteHighByPersona[recommendedKey] || 0,
    fteRangeText: `${formatConfidenceValue(fteLowByPersona[recommendedKey] || 0, "fte1")} — ${formatConfidenceValue(fteHighByPersona[recommendedKey] || 0, "fte1")}`,
    priceLow: priceLowByPersona[recommendedKey] || 0,
    priceHigh: priceHighByPersona[recommendedKey] || 0,
    priceRangeText: `${formatConfidenceValue(priceLowByPersona[recommendedKey] || 0, "rangeK")} — ${formatConfidenceValue(priceHighByPersona[recommendedKey] || 0, "rangeK")}`,
    sizingConfidence: weightedSizingConfidence,
    sizingConfidenceText: formatConfidenceValue(weightedSizingConfidence, "decimal3"),
    methodMixText: getCellText(workloadCellMap, "C35", "0 A / 0 D / 0 E"),
  };

  const summaryRows = [
    { rowNumber: 39, label: "Recommended persona", value: recommendedSummary.label, text: recommendedSummary.label, format: "status" },
    { rowNumber: 40, label: "Confidence score", value: recommendedSummary.confidenceScore, text: recommendedSummary.confidenceScoreText, format: "decimal3" },
    { rowNumber: 41, label: "Confidence band", value: recommendedSummary.confidenceBand, text: recommendedSummary.confidenceBand, format: "band" },
    { rowNumber: 42, label: "Steady-state FTE (range)", value: recommendedSummary.fteRangeText, text: recommendedSummary.fteRangeText, format: "status" },
    { rowNumber: 43, label: "Recommended price (range)", value: recommendedSummary.priceRangeText, text: recommendedSummary.priceRangeText, format: "status" },
    { rowNumber: 44, label: "Sizing confidence", value: recommendedSummary.sizingConfidence, text: recommendedSummary.sizingConfidenceText, format: "decimal3" },
    { rowNumber: 45, label: "Method mix", value: recommendedSummary.methodMixText, text: recommendedSummary.methodMixText, format: "status" },
  ];

  return {
    ...FPA_CONFIDENCE_SNAPSHOT,
    benchmarkConstants,
    coverageShare,
    coverageAdjustment,
    personaHeaders,
    sizingRows,
    weightedSizingConfidence,
    weightedSizingConfidenceText: formatConfidenceValue(weightedSizingConfidence, "decimal3"),
    personaRows,
    recommendedSummary,
    summaryRows,
    recommendationRationale: recommendView.recommendationRationale,
  };
}
