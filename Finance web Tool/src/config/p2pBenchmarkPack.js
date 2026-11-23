import { buildP2pAiBenefitWorkbookView } from "./p2pAiBenefit";
import { buildP2pBenchmarkModel, P2P_INDUSTRY_BENCHMARKS } from "./p2pBenchmarks";
import { buildP2pCostWorkbookView } from "./p2pCost";
import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { buildP2pOpsModelWorkbookView } from "./p2pOpsModel";
import {
  P2P_PERSONA_LIBRARY_COLUMNS,
  P2P_PERSONA_LIBRARY_ROWS,
} from "./p2pPersonas";
import { buildP2pPricingWorkbookView } from "./p2pPricing";
import { buildP2pRecommendWorkbookView } from "./p2pRecommend";
import { buildP2pTransitionWorkbookView } from "./p2pTransition";
import { buildP2pWorkloadModel } from "./p2pWorkload";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "./p2pWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_ONE_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const DECIMAL_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const CURRENCY_ZERO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PERSONA_HEADERS = Object.freeze(
  P2P_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
  })),
);

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(P2P_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

const RANGE_ROW_DEFS = Object.freeze([
  { metricNumber: 1, rowNumber: 6, label: "P2P FTE per $1B revenue (client org)", low: 0.75, high: 1.35, unit: "x P50", format: "decimal2", tag: "[BM]" },
  { metricNumber: 2, rowNumber: 7, label: "Productive hours per FTE-month", low: 140, high: 165, unit: "hrs", format: "decimal1", tag: "[PA]" },
  { metricNumber: 3, rowNumber: 8, label: "Utilisation", low: 0.6, high: 0.95, unit: "%", format: "percent0", tag: "[PA]" },
  { metricNumber: 4, rowNumber: 9, label: "Shrinkage", low: 0.05, high: 0.2, unit: "%", format: "percent0", tag: "[PA]" },
  { metricNumber: 5, rowNumber: 10, label: "Span of control", low: 5, high: 15, unit: "FTE/lead", format: "whole", tag: "[PA]" },
  { metricNumber: 6, rowNumber: 11, label: "Offshore mix", low: 0.3, high: 0.9, unit: "%", format: "percent0", tag: "[BM]" },
  { metricNumber: 7, rowNumber: 12, label: "Automation ceiling (effective)", low: 0.2, high: 0.75, unit: "%", format: "percent0", tag: "[BM]" },
  { metricNumber: 8, rowNumber: 13, label: "AI maturity ceiling", low: 0.08, high: 0.3, unit: "%", format: "percent0", tag: "[BM]" },
  { metricNumber: 9, rowNumber: 14, label: "Blended loaded cost / FTE", low: 20000, high: 90000, unit: "USD", format: "currency0", tag: "[MKT]" },
  { metricNumber: 10, rowNumber: 15, label: "Blended wage inflation", low: 0.03, high: 0.08, unit: "%/yr", format: "percent1", tag: "[MKT]" },
  { metricNumber: 11, rowNumber: 16, label: "Blended attrition", low: 0.08, high: 0.22, unit: "%", format: "percent1", tag: "[MKT]" },
  { metricNumber: 12, rowNumber: 17, label: "Transition duration (weeks incl. hypercare)", low: 8, high: 24, unit: "weeks", format: "decimal1", tag: "[PA]" },
  { metricNumber: 13, rowNumber: 18, label: "Client fully-loaded cost / FTE", low: 50000, high: 120000, unit: "USD", format: "currency0", tag: "[PA]" },
  { metricNumber: 14, rowNumber: 19, label: "Run-rate GM %", low: 0.15, high: 0.35, unit: "%", format: "percent1", tag: "[PA]" },
]);

const INDUSTRY_ROW_DEFS = Object.freeze(
  P2P_INDUSTRY_BENCHMARKS.map((item, index) => ({
    rowNumber: 25 + index,
    label: item.label,
    ftePerRevenueB: item.ftePerRevenueB,
    automationCeiling: item.automationCeiling,
    regulatoryLoad: item.regulatoryLoad,
  })),
);

const KPI_ROW_DEFS = Object.freeze([
  { rowNumber: 37, label: "Cost per invoice processed", sourceToken: "Cost per invoice", unit: "USD", typicalCurrent: "$5.5", topQuartile: "$2.2", targetStandard: "$3.5", targetAggressive: "$2.5" },
  { rowNumber: 38, label: "Touchless invoice rate", sourceToken: "Touchless", unit: "%", typicalCurrent: "25%", topQuartile: "70%", targetStandard: "45%", targetAggressive: "60%" },
  { rowNumber: 39, label: "Invoice exception rate", sourceToken: "Invoice exception", unit: "%", typicalCurrent: "18%", topQuartile: "5%", targetStandard: "12%", targetAggressive: "8%" },
  { rowNumber: 40, label: "PO-backed spend share", sourceToken: "PO backed spend", unit: "%", typicalCurrent: "55%", topQuartile: "85%", targetStandard: "70%", targetAggressive: "80%" },
  { rowNumber: 41, label: "On-time payment rate", sourceToken: "On time payments", unit: "%", typicalCurrent: "92%", topQuartile: "99%", targetStandard: "97%", targetAggressive: "98%" },
  { rowNumber: 42, label: "Supplier reconciliation automation", sourceToken: "Supplier reconciliation", unit: "%", typicalCurrent: "20%", topQuartile: "75%", targetStandard: "50%", targetAggressive: "65%" },
  { rowNumber: 43, label: "Vendor master setup cycle time", sourceToken: "Vendor master", unit: "days", typicalCurrent: "4", topQuartile: "1", targetStandard: "2", targetAggressive: "1" },
]);

const NOTE_ROW_DEFS = Object.freeze([
  { rowNumber: 47, label: "Cost per invoice processed median", benchmarkRange: "$3-6", source: "[BM] confirm & cite" },
  { rowNumber: 48, label: "Touchless invoice benchmark range", benchmarkRange: "25-70%", source: "[BM] confirm & cite" },
]);

export const P2P_BENCHMARK_PACK_SNAPSHOT = Object.freeze({
  sheetName: "P2P_27 Benchmark Pack",
  title: "27. Benchmark Pack — P2P tagged ranges, industry quartiles, KPI current vs target",
  note: "Source slots read the E2E Evidence Register by key (tower-specific first, then ALL); confirm & cite remains wherever no evidence is attached. Live model values are compared to the range.",
  formulaCount: 93,
  rangeMetricCount: RANGE_ROW_DEFS.length,
  industryCount: INDUSTRY_ROW_DEFS.length,
  kpiCount: KPI_ROW_DEFS.length,
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

function normalizeTagFragment(value) {
  return trimValue(value).replace(/^;+|;+$|\s+/gu, "").toUpperCase();
}

function normalizeEvidenceTag(value) {
  const normalized = normalizeTagFragment(value);
  return normalized ? `;${normalized};` : "";
}

function buildEvidenceRegisterRows(currentDeal) {
  const registerInputs = currentDeal?.p2pWorkbookInputs?.["E2E Evidence Register"]
    && typeof currentDeal.p2pWorkbookInputs["E2E Evidence Register"] === "object"
    ? currentDeal.p2pWorkbookInputs["E2E Evidence Register"]
    : currentDeal?.fpaWorkbookInputs?.["E2E Evidence Register"]
      && typeof currentDeal.fpaWorkbookInputs["E2E Evidence Register"] === "object"
      ? currentDeal.fpaWorkbookInputs["E2E Evidence Register"]
      : EMPTY_INPUTS;

  return Array.from({ length: 20 }, (_, index) => {
    const rowNumber = 13 + index;
    return {
      rowNumber,
      tags: normalizeEvidenceTag(registerInputs[`N${rowNumber}`]),
      source: trimValue(registerInputs[`Q${rowNumber}`]),
    };
  }).filter((row) => row.tags || row.source);
}

function findSectionASource(evidenceRows, metricNumber) {
  const token = normalizeTagFragment(metricNumber);
  const directToken = `;P2P|27|${token};`;
  const allToken = `;ALL|27|${token};`;
  const directMatch = evidenceRows.find((row) => row.tags.includes(directToken));
  if (directMatch?.source) {
    return directMatch.source;
  }
  const allMatch = evidenceRows.find((row) => row.tags.includes(allToken));
  return allMatch?.source || "confirm & cite";
}

function findKpiSource(evidenceRows, token) {
  const lookup = `;P2P|KPI|${normalizeTagFragment(token)};`;
  return evidenceRows.find((row) => row.tags.includes(lookup))?.source || "confirm & cite";
}

export function formatP2pBenchmarkPackValue(value, format = "text") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (["text", "status"].includes(format)) {
    return String(value);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  switch (format) {
    case "currency0":
      return CURRENCY_ZERO_FORMATTER.format(Math.round(numeric));
    case "percent0":
      return `${Math.round(numeric * 100)}%`;
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    case "decimal1":
      return DECIMAL_ONE_FORMATTER.format(numeric);
    case "decimal2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "whole":
      return INTEGER_FORMATTER.format(Math.round(numeric));
    default:
      return String(value);
  }
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

function buildMetricMap(rows = []) {
  return Object.fromEntries(
    rows
      .filter((row) => row?.key)
      .map((row) => [
        row.key,
        Object.fromEntries(
          (row.values || []).map((cell) => [cell.key, {
            value: cell.value,
            text: cell.text,
          }]),
        ),
      ]),
  );
}

function getPersonaMetricValue(metricMap, rowKey, personaKey, fallback = 0) {
  const value = metricMap?.[rowKey]?.[personaKey]?.value;
  return value === undefined || value === null || value === "" ? fallback : value;
}

function readPersonaMetric(currentDeal, metricKey, personaKey) {
  const persona = PERSONA_HEADERS.find((item) => item.key === normalizePersonaId(personaKey)) || PERSONA_HEADERS[1] || PERSONA_HEADERS[0];
  const definition = PERSONA_ROW_MAP[metricKey];
  const workbookInputs = currentDeal?.p2pWorkbookInputs?.["P2P_07 Personas"]
    && typeof currentDeal.p2pWorkbookInputs["P2P_07 Personas"] === "object"
    ? currentDeal.p2pWorkbookInputs["P2P_07 Personas"]
    : EMPTY_INPUTS;

  if (!persona || !definition) {
    return "";
  }

  const address = `${persona.workbookColumn}${definition.workbookRow}`;
  const rawValue = Object.prototype.hasOwnProperty.call(workbookInputs, address)
    ? workbookInputs[address]
    : definition.values[persona.key];

  if (definition.format === "text") {
    return trimValue(rawValue) || String(definition.values[persona.key] ?? "");
  }

  const numeric = Number(rawValue);
  return Number.isFinite(numeric) ? numeric : Number(definition.values[persona.key] || 0);
}

export function buildP2pBenchmarkPackWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const benchmarkModel = buildP2pBenchmarkModel(discoveryMetrics.effectiveDiscovery, workspace.benchmarks || {});
  const aiView = buildP2pAiBenefitWorkbookView({ currentDeal, workspace });
  const workloadView = buildP2pWorkloadModel(workspace, currentDeal);
  const opsView = buildP2pOpsModelWorkbookView({
    opsWorkbookInputs: workbookInputs["P2P_09 Ops Model"] && typeof workbookInputs["P2P_09 Ops Model"] === "object"
      ? workbookInputs["P2P_09 Ops Model"]
      : EMPTY_INPUTS,
    rateCardInputs: workbookInputs["P2P_10 Rate Card"] && typeof workbookInputs["P2P_10 Rate Card"] === "object"
      ? workbookInputs["P2P_10 Rate Card"]
      : EMPTY_INPUTS,
  });
  const costView = buildP2pCostWorkbookView({ currentDeal, workspace });
  const pricingView = buildP2pPricingWorkbookView({ currentDeal, workspace });
  const transitionView = buildP2pTransitionWorkbookView({ currentDeal, workspace });
  const recommendView = buildP2pRecommendWorkbookView({ currentDeal, workspace });
  const evidenceRows = buildEvidenceRegisterRows(currentDeal);

  const recommendedPersona = recommendView.recommendedPersona
    ? PERSONA_HEADERS.find((persona) => persona.key === recommendView.recommendedPersona.key)
    : PERSONA_HEADERS.find((persona) => persona.key === "standard") || PERSONA_HEADERS[0];
  const recommendedKey = recommendedPersona?.key || "standard";
  const pricingMap = buildMetricMap(pricingView.summaryRows);
  const costMap = buildMetricMap(costView.summaryRows);
  const offshoreMixRow = opsView.shoreMixTable?.rows?.find((row) => row.id === "offshore") || null;
  const wageInflationRow = opsView.personaFactorRows?.find((row) => row.id === "blendedWageInflation") || null;
  const attritionRow = opsView.personaFactorRows?.find((row) => row.id === "blendedAttrition") || null;
  const selectedIndustry = trimValue(discoveryMetrics.effectiveDiscovery?.industryVertical) || benchmarkModel.industryBenchmark?.label || "Manufacturing";
  const currentTowerStaff = Number(discoveryMetrics.effectiveDiscovery?.currentTowerStaff || 0);
  const annualRevenueUsdB = Number(discoveryMetrics.effectiveDiscovery?.annualRevenueUsdB || 0);
  const clientOrgFtePerRevenueB = annualRevenueUsdB > 0 ? round(currentTowerStaff / Math.max(annualRevenueUsdB, 0.01), 12) : 0;

  const industryRows = INDUSTRY_ROW_DEFS.map((definition) => {
    const p50 = Number(definition.ftePerRevenueB || 0);
    const p25 = round(p50 * 0.75, 12);
    const p75 = round(p50 * 1.35, 12);
    const clientOrgEffective = definition.label === selectedIndustry ? clientOrgFtePerRevenueB : null;

    let clientPosition = "";
    if (clientOrgEffective !== null) {
      if (clientOrgEffective < p25) {
        clientPosition = "Below P25 - lean org";
      } else if (clientOrgEffective > p75) {
        clientPosition = "Above P75 - savings headroom";
      } else {
        clientPosition = "Within IQR";
      }
    }

    return {
      ...definition,
      p25,
      p50,
      p75,
      clientOrgEffective,
      clientPosition,
      p25Text: formatP2pBenchmarkPackValue(p25, "decimal2"),
      p50Text: formatP2pBenchmarkPackValue(p50, "decimal2"),
      p75Text: formatP2pBenchmarkPackValue(p75, "decimal2"),
      clientOrgEffectiveText: clientOrgEffective === null ? "" : formatP2pBenchmarkPackValue(clientOrgEffective, "decimal2"),
    };
  });

  const industryP50ByName = Object.fromEntries(industryRows.map((row) => [row.label, row.p50]));


  const rangeModelValueByMetric = {
    1: (() => {
      const p50 = industryP50ByName[selectedIndustry] || 0;
      return p50 > 0 ? round(clientOrgFtePerRevenueB / p50, 12) : 0;
    })(),
    2: Number(benchmarkModel.productiveHoursPerFteMonth || 0),
    3: Number(readPersonaMetric(currentDeal, "utilisationPct", recommendedKey) || 0),
    4: Number(readPersonaMetric(currentDeal, "shrinkagePct", recommendedKey) || 0),
    5: Number(readPersonaMetric(currentDeal, "spanOfControl", recommendedKey) || 0),
    6: Number(offshoreMixRow?.values?.[recommendedKey]?.value || 0),
    7: Number(aiView.gateDrivers?.effectiveCeiling || 0),
    8: Number(aiView.gateDrivers?.aiMaturityCeiling || 0),
    9: Number(getPersonaMetricValue(costMap, "blendedCostPerFte", recommendedKey, 0)),
    10: Number(wageInflationRow?.values?.[recommendedKey] || 0),
    11: Number(attritionRow?.values?.[recommendedKey] || 0),
    12: Number(transitionView.complexityAdjustedDurationWeeks || 0),
    13: Number(benchmarkModel.clientLoadedCostPerFte || 0),
    14: Number(getPersonaMetricValue(pricingMap, "grossMarginPct", recommendedKey, 0)),
  };

  const sectionARows = RANGE_ROW_DEFS.map((definition) => {
    const modelValue = rangeModelValueByMetric[definition.metricNumber] || 0;
    const withinRange = modelValue >= definition.low && modelValue <= definition.high;
    const source = findSectionASource(evidenceRows, definition.metricNumber);

    return {
      ...definition,
      modelValue,
      modelValueText: formatP2pBenchmarkPackValue(modelValue, definition.format),
      lowText: formatP2pBenchmarkPackValue(definition.low, definition.format),
      highText: formatP2pBenchmarkPackValue(definition.high, definition.format),
      withinRange: withinRange ? "GREEN" : "AMBER",
      source,
      sourceMissing: source === "confirm & cite",
    };
  });

  const corroboratedCount = sectionARows.filter((row) => row.withinRange === "GREEN").length;
  const rangesCorroboratedPct = sectionARows.length ? round(corroboratedCount / sectionARows.length, 12) : 0;
  const rangesWithCitedEvidenceCount = sectionARows.filter((row) => !row.sourceMissing).length;

  const kpiRows = KPI_ROW_DEFS.map((definition) => {
    const source = findKpiSource(evidenceRows, definition.sourceToken);
    return {
      ...definition,
      source,
      sourceMissing: source === "confirm & cite",
    };
  });

  const kpiCitedEvidenceCount = kpiRows.filter((row) => !row.sourceMissing).length;
  const selectedIndustryRow = industryRows.find((row) => row.label === selectedIndustry) || null;

  return {
    ...P2P_BENCHMARK_PACK_SNAPSHOT,
    recommendedPersona: {
      key: recommendedKey,
      label: recommendedPersona?.label || "Standard",
      index: recommendedPersona?.index || 2,
    },
    sectionARows,
    rangesCorroboratedPct,
    corroboratedCount,
    rangesWithCitedEvidenceCount,
    industryRows,
    selectedIndustry,
    selectedIndustryRow,
    clientOrgFtePerRevenueB,
    clientOrgFtePerRevenueBText: formatP2pBenchmarkPackValue(clientOrgFtePerRevenueB, "decimal2"),
    blindFte: Number(workloadView.blindFte || 0),
    blindFteText: formatP2pBenchmarkPackValue(workloadView.blindFte || 0, "decimal2"),
    totalMonthlyHours: Number(workloadView.totalMonthlyHours || 0),
    totalMonthlyHoursText: formatP2pBenchmarkPackValue(workloadView.totalMonthlyHours || 0, "decimal1"),
    revenueBand: benchmarkModel.revenueBand,
    techStackClass: benchmarkModel.techStackClass,
    agenticDataGate: Number(aiView.gateDrivers?.agenticDataGate || 0),
    kpiRows,
    kpiCitedEvidenceCount,
    noteRows: NOTE_ROW_DEFS,
  };
}
