import { buildP2pAiBenefitWorkbookView } from "./p2pAiBenefit";
import { buildP2pCostWorkbookView } from "./p2pCost";
import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { buildP2pFteEngineWorkbookView } from "./p2pFteEngine";
import { P2P_PERSONA_LIBRARY_COLUMNS } from "./p2pPersonas";
import { buildP2pPricingWorkbookView } from "./p2pPricing";
import { buildP2pRateCardWorkbookView } from "./p2pRateCard";
import { buildP2pRecommendWorkbookView } from "./p2pRecommend";
import { buildP2pRiskWorkbookView } from "./p2pRisk";
import { buildP2pWorkloadModel } from "./p2pWorkload";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "./p2pWorkspace";

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
  { confidenceRow: 6, id: "requisitionSourcingSupport", label: "Requisition & Sourcing Support" },
  { confidenceRow: 7, id: "poManagement", label: "PO Management" },
  { confidenceRow: 8, id: "vendorMaster", label: "Vendor Master" },
  { confidenceRow: 9, id: "invoiceProcessing", label: "Invoice Processing" },
  { confidenceRow: 10, id: "threeWayMatch", label: "3-Way Match" },
  { confidenceRow: 11, id: "exceptionQueryHandling", label: "Exception & Query Handling" },
  { confidenceRow: 12, id: "paymentsDisbursement", label: "Payments & Disbursement" },
  { confidenceRow: 13, id: "travelExpense", label: "Travel & Expense" },
  { confidenceRow: 14, id: "supplierReconciliationStatements", label: "Supplier Reconciliation & Statements" },
  { confidenceRow: 15, id: "reportingControlsGovernance", label: "P2P Reporting, Controls & Governance" },
]);

const CONFIDENCE_CONSTANTS = Object.freeze({
  methodBaseA: 0.9,
  methodBaseD: 0.6,
  methodBaseE: 0.35,
  coverageScalar: 0.05,
  variancePenaltyFactor: 0.9,
  rateCardConfirmedBonus: 0.05,
});

export const P2P_CONFIDENCE_SNAPSHOT = Object.freeze({
  sheetName: "P2P_25 Confidence",
  title: "25. Confidence Engine — P2P sizing / AI / commercial / validation confidence (per L2 and per persona)",
  note: "Per-L2 confidence = method base (A 0.9 / D 0.6 / E 0.35) x coverage adjustment x variance penalty. Persona score = 40% sizing + 25% AI benefit + 20% commercial + 15% validation.",
  formulaCount: 0,
  l2ProcessCount: SIZING_PROCESS_ROWS.length,
  personaCount: P2P_PERSONA_LIBRARY_COLUMNS.length,
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

export function formatP2pConfidenceValue(value, format = "status") {
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
    text: formatP2pConfidenceValue(valueMap[persona.key], format),
  }));
}

function buildMethodMixText(workloadModel) {
  const methodMix = workloadModel?.methodMix || {};
  return `${Number(methodMix.A || 0)} A / ${Number(methodMix.D || 0)} D / ${Number(methodMix.E || 0)} E`;
}

export function buildP2pConfidenceWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : EMPTY_INPUTS;
  const benchmarkInputs = workbookInputs["P2P_04 Benchmarks"] && typeof workbookInputs["P2P_04 Benchmarks"] === "object"
    ? workbookInputs["P2P_04 Benchmarks"]
    : EMPTY_INPUTS;
  const workloadInputs = workbookInputs["P2P_05 Workload"] && typeof workbookInputs["P2P_05 Workload"] === "object"
    ? workbookInputs["P2P_05 Workload"]
    : EMPTY_INPUTS;
  const aiWorkbookInputs = workbookInputs["P2P_08 AI Benefit"] && typeof workbookInputs["P2P_08 AI Benefit"] === "object"
    ? workbookInputs["P2P_08 AI Benefit"]
    : EMPTY_INPUTS;
  const personaInputs = workbookInputs["P2P_07 Personas"] && typeof workbookInputs["P2P_07 Personas"] === "object"
    ? workbookInputs["P2P_07 Personas"]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs["P2P_10 Rate Card"] && typeof workbookInputs["P2P_10 Rate Card"] === "object"
    ? workbookInputs["P2P_10 Rate Card"]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const workloadModel = buildP2pWorkloadModel(workspace, currentDeal);
  const aiView = buildP2pAiBenefitWorkbookView({
    aiWorkbookInputs,
    benchmarkInputs,
    workloadInputs,
    personaInputs,
    workspace,
    currentDeal,
  });
  const rateCardView = buildP2pRateCardWorkbookView({ workbookInputs: rateCardInputs });
  const pricingView = buildP2pPricingWorkbookView({ currentDeal, workspace });
  const riskView = buildP2pRiskWorkbookView({ currentDeal, workspace });
  const fteView = buildP2pFteEngineWorkbookView({ currentDeal, workspace });
  const costView = buildP2pCostWorkbookView({ currentDeal, workspace });
  const recommendView = buildP2pRecommendWorkbookView({ currentDeal, workspace });

  const personaHeaders = P2P_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
  }));

  const coverageShare = round(Number(discoveryMetrics.coveragePct || 0), 12);
  const coverageAdjustment = round(
    Math.min(0.15, Math.max(0, (coverageShare - 0.3) / 0.1) * CONFIDENCE_CONSTANTS.coverageScalar),
    12,
  );
  const totalMonthlyHours = Math.max(0.01, Number(workloadModel.totalMonthlyHours || aiView.totalMonthlyHours || 0.01));

  const sizingRows = SIZING_PROCESS_ROWS.map((definition, index) => {
    const processRow = workloadModel.processRows.find((row) => row.id === definition.id) || workloadModel.processRows[index] || {};
    const methodText = trimValue(processRow.method || "E — band");
    const methodLetter = methodText.charAt(0).toUpperCase() || "E";
    const methodBase = methodLetter === "A"
      ? CONFIDENCE_CONSTANTS.methodBaseA
      : methodLetter === "D"
        ? CONFIDENCE_CONSTANTS.methodBaseD
        : CONFIDENCE_CONSTANTS.methodBaseE;
    const varianceFlags = [
      trimValue(processRow.avsDFlag).toUpperCase(),
      trimValue(processRow.driverVsBandFlag).toUpperCase(),
    ].filter(Boolean);
    const variancePenalty = varianceFlags.some((flag) => !flag.startsWith("OK"))
      ? CONFIDENCE_CONSTANTS.variancePenaltyFactor
      : 1;
    const hoursPerMonth = round(Number(processRow.finalHours || 0), 12);
    const weight = round(hoursPerMonth / totalMonthlyHours, 12);
    const l2Confidence = round(Math.min(0.98, (methodBase + coverageAdjustment) * variancePenalty), 12);

    return {
      ...definition,
      confidenceLabel: trimValue(processRow.confidence || ""),
      methodText,
      methodLetter,
      methodBase,
      coverageAdjustment,
      variancePenalty,
      varianceFlags,
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

  const effectiveCeiling = Math.max(0.01, Number(aiView.gateDrivers?.effectiveCeiling || workloadModel.benchmarkModel?.aiBenefitCeiling || 0.01));
  const agenticDataGate = Number(aiView.gateDrivers?.agenticDataGate || workloadModel.benchmarkModel?.agenticDataGate || 0);
  const rateCardConfirmed = trimValue(rateCardView.confirmation?.value).toUpperCase() === "YES";
  const commercialBase = rateCardConfirmed ? 0.85 + CONFIDENCE_CONSTANTS.rateCardConfirmedBonus : 0.65;

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
    return [persona.key, clamp(value, 0.3, 0.98)];
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
    weightText: row.weight != null ? formatP2pConfidenceValue(row.weight, "percent0") : "",
  }));

  const recommendedPersona = recommendView.recommendedPersona
    || personaHeaders.find((persona) => persona.key === "standard")
    || personaHeaders[0];
  const recommendedKey = recommendedPersona?.key || "standard";
  const recommendedIndex = Number(
    recommendedPersona?.index || personaHeaders.find((persona) => persona.key === recommendedKey)?.index || 2,
  );

  const recommendedSummary = {
    key: recommendedKey,
    label: recommendedPersona?.label || "Standard",
    index: recommendedIndex,
    confidenceScore: confidenceScoreByPersona[recommendedKey] || 0,
    confidenceScoreText: formatP2pConfidenceValue(confidenceScoreByPersona[recommendedKey] || 0, "decimal3"),
    confidenceBand: confidenceBandByPersona[recommendedKey] || "LOW",
    fteLow: fteLowByPersona[recommendedKey] || 0,
    fteHigh: fteHighByPersona[recommendedKey] || 0,
    fteRangeText: `${formatP2pConfidenceValue(fteLowByPersona[recommendedKey] || 0, "fte1")} — ${formatP2pConfidenceValue(fteHighByPersona[recommendedKey] || 0, "fte1")}`,
    priceLow: priceLowByPersona[recommendedKey] || 0,
    priceHigh: priceHighByPersona[recommendedKey] || 0,
    priceRangeText: `${formatP2pConfidenceValue(priceLowByPersona[recommendedKey] || 0, "rangeK")} — ${formatP2pConfidenceValue(priceHighByPersona[recommendedKey] || 0, "rangeK")}`,
    sizingConfidence: weightedSizingConfidence,
    sizingConfidenceText: formatP2pConfidenceValue(weightedSizingConfidence, "decimal3"),
    methodMixText: buildMethodMixText(workloadModel),
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
    ...P2P_CONFIDENCE_SNAPSHOT,
    benchmarkConstants: CONFIDENCE_CONSTANTS,
    coverageShare,
    coverageAdjustment,
    personaHeaders,
    sizingRows,
    weightedSizingConfidence,
    weightedSizingConfidenceText: formatP2pConfidenceValue(weightedSizingConfidence, "decimal3"),
    weightedSizingRowNumber: SIZING_PROCESS_ROWS[SIZING_PROCESS_ROWS.length - 1].confidenceRow + 1,
    personaRows,
    recommendedSummary,
    summaryRows,
    recommendationRationale: recommendView.recommendationRationale,
  };
}
