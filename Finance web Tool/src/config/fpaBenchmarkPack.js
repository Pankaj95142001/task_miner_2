import { buildFpaAiBenefitWorkbookView } from "./fpaAiBenefit";
import { buildFpaBenchmarkWorkbookView } from "./fpaBenchmarks";
import { buildFpaCostWorkbookView } from "./fpaCost";
import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";
import { buildFpaFteEngineWorkbookView } from "./fpaFteEngine";
import { buildFpaOpsModelWorkbookView } from "./fpaOpsModel";
import {
  FPA_PERSONA_LIBRARY_COLUMNS,
  FPA_PERSONA_LIBRARY_ROWS,
} from "./fpaPersonas";
import { buildFpaPricingWorkbookView } from "./fpaPricing";
import { buildFpaRecommendWorkbookView } from "./fpaRecommend";
import { buildFpaTransitionWorkbookView } from "./fpaTransition";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";

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
  FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
  })),
);

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

const RANGE_ROW_DEFS = Object.freeze([
  { metricNumber: 1, rowNumber: 6, label: "FP&A FTE per $1B revenue (client org)", low: 0.6, high: 1.4, unit: "x P50", format: "decimal2", tag: "[BM]" },
  { metricNumber: 2, rowNumber: 7, label: "Productive hours per FTE-month", low: 140, high: 165, unit: "hrs", format: "decimal1", tag: "[PA]" },
  { metricNumber: 3, rowNumber: 8, label: "Utilisation", low: 0.75, high: 0.92, unit: "%", format: "percent0", tag: "[PA]" },
  { metricNumber: 4, rowNumber: 9, label: "Shrinkage", low: 0.06, high: 0.16, unit: "%", format: "percent0", tag: "[PA]" },
  { metricNumber: 5, rowNumber: 10, label: "Span of control", low: 6, high: 12, unit: "FTE/lead", format: "whole", tag: "[PA]" },
  { metricNumber: 6, rowNumber: 11, label: "Offshore mix", low: 0.4, high: 0.9, unit: "%", format: "percent0", tag: "[BM]" },
  { metricNumber: 7, rowNumber: 12, label: "Automation ceiling (effective)", low: 0.25, high: 0.7, unit: "%", format: "percent0", tag: "[BM]" },
  { metricNumber: 8, rowNumber: 13, label: "AI maturity ceiling", low: 0.05, high: 0.35, unit: "%", format: "percent0", tag: "[BM]" },
  { metricNumber: 9, rowNumber: 14, label: "Blended loaded cost / FTE", low: 35000, high: 110000, unit: "USD", format: "currency0", tag: "[MKT]" },
  { metricNumber: 10, rowNumber: 15, label: "Blended wage inflation", low: 0.03, high: 0.08, unit: "%/yr", format: "percent1", tag: "[MKT]" },
  { metricNumber: 11, rowNumber: 16, label: "Blended attrition", low: 0.08, high: 0.2, unit: "%", format: "percent1", tag: "[MKT]" },
  { metricNumber: 12, rowNumber: 17, label: "Transition duration (weeks incl. hypercare)", low: 8, high: 30, unit: "weeks", format: "decimal1", tag: "[PA]" },
  { metricNumber: 13, rowNumber: 18, label: "Client fully-loaded cost / FTE", low: 55000, high: 160000, unit: "USD", format: "currency0", tag: "[PA]" },
  { metricNumber: 14, rowNumber: 19, label: "Run-rate GM %", low: 0.15, high: 0.35, unit: "%", format: "percent1", tag: "[PA]" },
]);

const INDUSTRY_ROW_DEFS = Object.freeze([
  { rowNumber: 25, label: "BFSI", benchmarkAddress: "G6" },
  { rowNumber: 26, label: "CPG & Retail", benchmarkAddress: "G7" },
  { rowNumber: 27, label: "Technology & SaaS", benchmarkAddress: "G8" },
  { rowNumber: 28, label: "Manufacturing", benchmarkAddress: "G9" },
  { rowNumber: 29, label: "Healthcare & Pharma", benchmarkAddress: "G10" },
  { rowNumber: 30, label: "Energy & Utilities", benchmarkAddress: "G11" },
  { rowNumber: 31, label: "Telecom & Media", benchmarkAddress: "G12" },
  { rowNumber: 32, label: "Professional Services", benchmarkAddress: "G13" },
]);

const KPI_ROW_DEFS = Object.freeze([
  { rowNumber: 37, label: "Forecast accuracy (MAPE)", sourceToken: "Forecast", unit: "%", typicalCurrent: "12%", topQuartile: "5%", targetStandard: "8%", targetAggressive: "5%" },
  { rowNumber: 38, label: "Budget cycle time", sourceToken: "Budget", unit: "weeks", typicalCurrent: "14", topQuartile: "6", targetStandard: "10", targetAggressive: "7" },
  { rowNumber: 39, label: "Budget variance (abs.)", sourceToken: "Budget", unit: "%", typicalCurrent: "8%", topQuartile: "3%", targetStandard: "5%", targetAggressive: "4%" },
  { rowNumber: 40, label: "Planning iterations per budget", sourceToken: "Planning", unit: "#", typicalCurrent: "4", topQuartile: "2", targetStandard: "3", targetAggressive: "2" },
  { rowNumber: 41, label: "Report turnaround after close", sourceToken: "Report", unit: "days", typicalCurrent: "7", topQuartile: "2", targetStandard: "4", targetAggressive: "2" },
  { rowNumber: 42, label: "Reports automated / self-service", sourceToken: "Reports", unit: "%", typicalCurrent: "20%", topQuartile: "75%", targetStandard: "50%", targetAggressive: "70%" },
  { rowNumber: 43, label: "Business-partner time on analysis vs data prep", sourceToken: "Business-partner", unit: "%", typicalCurrent: "30%", topQuartile: "70%", targetStandard: "50%", targetAggressive: "65%" },
]);

const NOTE_ROW_DEFS = Object.freeze([
  { rowNumber: 47, label: "Report packs per BU per month", benchmarkRange: "3-6", source: "[BM] confirm & cite" },
  { rowNumber: 48, label: "Forecast accuracy (MAPE) median", benchmarkRange: "8-12%", source: "[BM] confirm & cite" },
]);

export const FPA_BENCHMARK_PACK_SNAPSHOT = Object.freeze({
  sheetName: "FPA_27 Benchmark Pack",
  title: "27. Benchmark Pack — FP&A tagged ranges, industry quartiles, KPI current vs target",
  note: "Source slots read the E2E Evidence Register by key (tower-specific first, then ALL); confirm & cite remains wherever no evidence is attached. Live model values are compared to the range.",
  formulaCount: 93,
  rangeMetricCount: 14,
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

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .replace(/x$/iu, "");

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

function createAddressMap(rows = []) {
  const addressMap = {};

  rows.forEach((row) => {
    (row?.cells || []).forEach((cell) => {
      if (cell?.address) {
        addressMap[cell.address] = cell;
      }
    });
  });

  return addressMap;
}

function getCellNumber(addressMap, address, fallback = 0) {
  const cell = addressMap[address];
  const rawValue = cell?.raw ?? cell?.value ?? cell?.text;
  const parsed = parseNumericText(rawValue, Number.NaN);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const workbookInputs = currentDeal?.fpaWorkbookInputs?.["FPA_07 Personas"]
    && typeof currentDeal.fpaWorkbookInputs["FPA_07 Personas"] === "object"
    ? currentDeal.fpaWorkbookInputs["FPA_07 Personas"]
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

function normalizeEvidenceTag(value) {
  const normalized = trimValue(value).replace(/^;+|;+$|\s+/gu, "");
  return normalized ? `;${normalized.toUpperCase()};` : "";
}

function buildEvidenceRegisterRows(currentDeal) {
  const registerInputs = currentDeal?.fpaWorkbookInputs?.["E2E Evidence Register"]
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
  const token = String(metricNumber).toUpperCase();
  const directToken = `;FPA|27|${token};`;
  const allToken = `;ALL|27|${token};`;
  const directMatch = evidenceRows.find((row) => row.tags.includes(directToken));
  if (directMatch?.source) {
    return directMatch.source;
  }
  const allMatch = evidenceRows.find((row) => row.tags.includes(allToken));
  return allMatch?.source || "confirm & cite";
}

function findKpiSource(evidenceRows, token) {
  const lookup = `;FPA|KPI|${String(token).toUpperCase()};`;
  return evidenceRows.find((row) => row.tags.includes(lookup))?.source || "confirm & cite";
}

export function formatBenchmarkPackValue(value, format = "text") {
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

export function buildFpaBenchmarkPackWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeFpaWorkspace(workspaceValue || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const workbookInputs = currentDeal?.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
    ? currentDeal.fpaWorkbookInputs
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const benchmarkView = buildFpaBenchmarkWorkbookView(
    workbookInputs["FPA_04 Benchmarks"] && typeof workbookInputs["FPA_04 Benchmarks"] === "object"
      ? workbookInputs["FPA_04 Benchmarks"]
      : EMPTY_INPUTS,
    workspace.discovery,
  );
  const benchmarkCellMap = createAddressMap(benchmarkView.rows || []);
  const aiView = buildFpaAiBenefitWorkbookView({ currentDeal, workspace });
  const fteView = buildFpaFteEngineWorkbookView({ currentDeal, workspace });
  const opsView = buildFpaOpsModelWorkbookView({
    opsWorkbookInputs: workbookInputs["FPA_09 Ops Model"] && typeof workbookInputs["FPA_09 Ops Model"] === "object"
      ? workbookInputs["FPA_09 Ops Model"]
      : EMPTY_INPUTS,
    rateCardInputs: workbookInputs["FPA_10 Rate Card"] && typeof workbookInputs["FPA_10 Rate Card"] === "object"
      ? workbookInputs["FPA_10 Rate Card"]
      : EMPTY_INPUTS,
  });
  const costView = buildFpaCostWorkbookView({ currentDeal, workspace });
  const pricingView = buildFpaPricingWorkbookView({ currentDeal, workspace });
  const transitionView = buildFpaTransitionWorkbookView({ currentDeal, workspace });
  const recommendView = buildFpaRecommendWorkbookView({ currentDeal, workspace });
  const evidenceRows = buildEvidenceRegisterRows(currentDeal);

  const recommendedPersona = recommendView.recommendedPersona
    ? PERSONA_HEADERS.find((persona) => persona.key === recommendView.recommendedPersona.key)
    : PERSONA_HEADERS.find((persona) => persona.key === "standard") || PERSONA_HEADERS[0];
  const recommendedKey = recommendedPersona?.key || "standard";
  const capacityMap = buildMetricMap(fteView.capacityRows);
  const pricingMap = buildMetricMap(pricingView.summaryRows);
  const costMap = buildMetricMap(costView.summaryRows);
  const offshoreMixRow = opsView.shoreMixTable?.rows?.find((row) => row.id === "offshore") || null;
  const wageInflationRow = opsView.personaFactorRows?.find((row) => row.id === "blendedWageInflation") || null;
  const attritionRow = opsView.personaFactorRows?.find((row) => row.id === "blendedAttrition") || null;
  const selectedIndustry = trimValue(discoveryMetrics.effectiveDiscovery?.industryVertical);
  const currentTowerStaff = Number(discoveryMetrics.effectiveDiscovery?.currentTowerStaff || 0);
  const annualRevenueUsdB = Number(discoveryMetrics.effectiveDiscovery?.annualRevenueUsdM || 0);
  const clientOrgFtePerRevenueB = annualRevenueUsdB > 0 ? round(currentTowerStaff / Math.max(0.1, annualRevenueUsdB), 12) : 0;

  const industryRows = INDUSTRY_ROW_DEFS.map((definition) => {
    const p50 = getCellNumber(benchmarkCellMap, definition.benchmarkAddress, 0);
    const p25 = round(p50 * 0.75, 12);
    const p75 = round(p50 * 1.35, 12);
    const clientOrgEffective = definition.label === selectedIndustry ? clientOrgFtePerRevenueB : null;

    let clientPosition = "";
    if (clientOrgEffective !== null) {
      if (clientOrgEffective < p25) {
        clientPosition = "Below P25 — lean org";
      } else if (clientOrgEffective > p75) {
        clientPosition = "Above P75 — savings headroom";
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
      p25Text: formatBenchmarkPackValue(p25, "decimal2"),
      p50Text: formatBenchmarkPackValue(p50, "decimal2"),
      p75Text: formatBenchmarkPackValue(p75, "decimal2"),
      clientOrgEffectiveText: clientOrgEffective === null ? "" : formatBenchmarkPackValue(clientOrgEffective, "decimal2"),
    };
  });

  const industryP50ByName = Object.fromEntries(industryRows.map((row) => [row.label, row.p50]));

  const rangeModelValueByMetric = {
    1: (() => {
      const p50 = industryP50ByName[selectedIndustry] || 0;
      return p50 > 0 ? round(clientOrgFtePerRevenueB / p50, 12) : 0;
    })(),
    2: Number(getPersonaMetricValue(capacityMap, "productiveCapacity", recommendedKey, 0)),
    3: Number(readPersonaMetric(currentDeal, "utilisationPct", recommendedKey) || 0),
    4: Number(readPersonaMetric(currentDeal, "shrinkagePct", recommendedKey) || 0),
    5: Number(readPersonaMetric(currentDeal, "spanOfControl", recommendedKey) || 0),
    6: Number(offshoreMixRow?.values?.[recommendedKey]?.value || 0),
    7: Number(aiView.gateDrivers?.effectiveCeiling || 0),
    8: Number(aiView.gateDrivers?.aiMaturityCeiling || 0),
    9: Number(getPersonaMetricValue(costMap, "blendedCostPerFteY1", recommendedKey, 0)),
    10: Number(wageInflationRow?.values?.[recommendedKey] || 0),
    11: Number(attritionRow?.values?.[recommendedKey] || 0),
    12: Number(transitionView.complexityAdjustedDurationWeeks || 0),
    13: getCellNumber(benchmarkCellMap, "C118", 0),
    14: Number(getPersonaMetricValue(pricingMap, "grossMarginPct", recommendedKey, 0)),
  };

  const sectionARows = RANGE_ROW_DEFS.map((definition) => {
    const modelValue = rangeModelValueByMetric[definition.metricNumber] || 0;
    const withinRange = modelValue >= definition.low && modelValue <= definition.high;
    const source = findSectionASource(evidenceRows, definition.metricNumber);

    return {
      ...definition,
      modelValue,
      modelValueText: formatBenchmarkPackValue(modelValue, definition.format),
      lowText: formatBenchmarkPackValue(definition.low, definition.format),
      highText: formatBenchmarkPackValue(definition.high, definition.format),
      withinRange: withinRange ? "GREEN" : "AMBER",
      source,
      sourceMissing: source === "confirm & cite",
    };
  });

  const corroboratedCount = sectionARows.filter((row) => row.withinRange === "GREEN").length;
  const rangesCorroboratedPct = round(corroboratedCount / sectionARows.length, 12);
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
    ...FPA_BENCHMARK_PACK_SNAPSHOT,
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
    clientOrgFtePerRevenueBText: formatBenchmarkPackValue(clientOrgFtePerRevenueB, "decimal2"),
    kpiRows,
    kpiCitedEvidenceCount,
    noteRows: NOTE_ROW_DEFS,
  };
}


