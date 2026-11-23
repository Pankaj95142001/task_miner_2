import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";
import { buildFpaCostWorkbookView } from "./fpaCost";
import {
  FPA_PERSONA_LIBRARY_COLUMNS,
  FPA_PERSONA_LIBRARY_ROWS,
} from "./fpaPersonas";
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

const PRICING_DEFAULTS = Object.freeze({
  commercialGmFloorPct: 0.15,
  gainshareProviderSharePct: 0.3,
});

export const FPA_PRICING_INSPECT_AUTO = "__AUTO__";

export const FPA_PRICING_SNAPSHOT = Object.freeze({
  sheetName: "FPA_13 Pricing",
  title: "13. Pricing & Constructs - FP&A Floor / Target / Markup / Recommended",
  note: "Recommended = MAX(Floor, MAX(Target, Markup) x Competition Bias). Construct outputs below.",
  formulaCount: 71,
  personaCount: 5,
  editableCellCount: 2,
  constructRowCount: 2,
});

const PRICING_ROW_DEFS = Object.freeze([
  { key: "costToServeY1", rowNumber: 7, label: "Cost-to-Serve Y1", format: "currency0" },
  { key: "floorPrice", rowNumber: 8, label: "FLOOR price (GM floor)", format: "currency0" },
  { key: "targetPrice", rowNumber: 9, label: "TARGET price (persona GM)", format: "currency0" },
  { key: "markupPrice", rowNumber: 10, label: "MARKUP price (cost-plus)", format: "currency0" },
  { key: "recommendedAnnualPrice", rowNumber: 11, label: "RECOMMENDED ANNUAL PRICE", format: "currency0", isTotal: true },
  { key: "biasClampFlag", rowNumber: 12, label: "Bias clamp flag", format: "status" },
  { key: "grossMarginAmount", rowNumber: 13, label: "Gross Margin $ (run-rate)", format: "currency0" },
  { key: "grossMarginPct", rowNumber: 14, label: "Gross Margin % (run-rate)", format: "percent1" },
  { key: "gmVsPersonaTargetPp", rowNumber: 15, label: "GM vs persona target (pp)", format: "pp1" },
  { key: "marginAlert", rowNumber: 16, label: "Margin alert", format: "status" },
  { key: "monthlyInvoiceSteady", rowNumber: 17, label: "Monthly invoice (steady)", format: "currency0" },
  { key: "blendedBillRatePerDeliveredFteY1", rowNumber: 18, label: "Blended bill rate / delivered FTE (Y1)", format: "currency2" },
]);

const CONSTRUCT_ROW_DEFS = Object.freeze([
  { key: "fixedFeeAnnual", rowNumber: 22, label: "Fixed fee (annual, +/-10% deadband)", format: "currency0" },
  { key: "gainshareBasePrice", rowNumber: 23, label: "Gainshare base price (markup -8pp)", format: "currency0" },
]);

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
    .replace(/\$/g, "")
    .replace(/x$/i, "");

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

export function formatPricingValue(value, format = "currency0") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (format === "status") {
    return String(value);
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
    case "percent0":
      return `${Math.round(numeric * 100)}%`;
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    case "pp1": {
      const sign = numeric > 0 ? "+" : "";
      return `${sign}${(numeric * 100).toFixed(1)} pp`;
    }
    case "factor2":
      return `${numeric.toFixed(2)}x`;
    case "number2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "whole":
    default:
      return INTEGER_FORMATTER.format(Math.round(numeric));
  }
}

export function formatPricingInputValue(kind, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  if (kind === "percent") {
    return `${(numeric * 100).toFixed(1)}%`;
  }

  return String(numeric);
}

export function normalizePricingInputValue(kind, value) {
  const trimmed = trimValue(value);
  if (!trimmed) {
    return "";
  }

  const numeric = parseNumericText(trimmed, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (kind === "percent") {
    return String(clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1));
  }

  return String(numeric);
}

function readPersonaMetric(personaInputs, persona, rowKey) {
  const row = PERSONA_ROW_MAP[rowKey];
  if (!row) {
    return 0;
  }

  const address = `${persona.workbookColumn}${row.workbookRow}`;
  if (!Object.prototype.hasOwnProperty.call(personaInputs, address)) {
    return row.values[persona.key];
  }

  const numeric = parseNumericText(personaInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? numeric : row.values[persona.key];
}

function readWorkbookPercentInput(workbookInputs, address, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1);
}

function safePriceFromMargin(costValue, marginPct) {
  if (!Number.isFinite(costValue) || !Number.isFinite(marginPct) || marginPct >= 1) {
    return 0;
  }

  return round(costValue / (1 - marginPct), 12);
}

function resolveCompetitionBias(competitiveIntensity) {
  const normalized = trimValue(competitiveIntensity).toUpperCase();

  if (normalized.startsWith("LOW")) {
    return 1;
  }

  if (normalized.startsWith("MEDIUM")) {
    return 0.99;
  }

  if (normalized.startsWith("HIGH")) {
    return 0.97;
  }

  return 0.95;
}

function buildPersonaMetrics({
  persona,
  costPersona,
  commercialGmFloorPct,
  competitionBias,
  targetGrossMarginPct,
  markupOnCostPct,
  riskPremiumPct,
}) {
  const costToServeY1 = round(costPersona?.summary?.costToServeY1 || 0, 12);
  const deliveredFteY1 = round(costPersona?.summary?.totalFteY1 || 0, 12);
  const floorPrice = safePriceFromMargin(costToServeY1, commercialGmFloorPct);
  const targetPrice = safePriceFromMargin(costToServeY1, targetGrossMarginPct);
  const markupPrice = round(costToServeY1 * (1 + markupOnCostPct) * (1 + riskPremiumPct), 12);
  const competitionAdjustedPrice = round(Math.max(targetPrice, markupPrice) * competitionBias, 12);
  const recommendedAnnualPrice = round(Math.max(floorPrice, competitionAdjustedPrice), 12);
  const biasClampFlag = competitionAdjustedPrice < floorPrice ? "AMBER - floor-clamped" : "OK";
  const grossMarginAmount = round(recommendedAnnualPrice - costToServeY1, 12);
  const grossMarginPct = recommendedAnnualPrice > 0 ? round(grossMarginAmount / recommendedAnnualPrice, 12) : 0;
  const gmVsPersonaTargetPp = round(grossMarginPct - targetGrossMarginPct, 12);
  const marginAlert = grossMarginPct < commercialGmFloorPct
    ? "RED - below floor"
    : gmVsPersonaTargetPp < 0
      ? "AMBER - below target"
      : "GREEN";
  const monthlyInvoiceSteady = round(recommendedAnnualPrice / 12, 12);
  const blendedBillRatePerDeliveredFteY1 = deliveredFteY1 > 0
    ? round(recommendedAnnualPrice / deliveredFteY1, 12)
    : 0;
  const fixedFeeAnnual = recommendedAnnualPrice;
  const gainshareBasePrice = round(costToServeY1 * (1 + markupOnCostPct - 0.08) * (1 + riskPremiumPct), 12);

  return {
    persona,
    costToServeY1,
    deliveredFteY1,
    commercialGmFloorPct,
    targetGrossMarginPct,
    markupOnCostPct,
    riskPremiumPct,
    competitionBias,
    floorPrice,
    targetPrice,
    markupPrice,
    recommendedAnnualPrice,
    biasClampFlag,
    grossMarginAmount,
    grossMarginPct,
    gmVsPersonaTargetPp,
    marginAlert,
    monthlyInvoiceSteady,
    blendedBillRatePerDeliveredFteY1,
    fixedFeeAnnual,
    gainshareBasePrice,
  };
}

export function buildFpaPricingWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
  inspectPersonaId = FPA_PRICING_INSPECT_AUTO,
} = {}) {
  const workspace = normalizeFpaWorkspace(workspaceValue || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const workbookInputs = currentDeal?.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
    ? currentDeal.fpaWorkbookInputs
    : EMPTY_INPUTS;
  const pricingInputs = workbookInputs[FPA_PRICING_SNAPSHOT.sheetName] && typeof workbookInputs[FPA_PRICING_SNAPSHOT.sheetName] === "object"
    ? workbookInputs[FPA_PRICING_SNAPSHOT.sheetName]
    : EMPTY_INPUTS;
  const personaInputs = workbookInputs["FPA_07 Personas"] && typeof workbookInputs["FPA_07 Personas"] === "object"
    ? workbookInputs["FPA_07 Personas"]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const competitiveIntensity = discoveryMetrics.effectiveDiscovery?.competitiveIntensity || "";
  const competitionBias = resolveCompetitionBias(competitiveIntensity);
  const commercialGmFloorPct = readWorkbookPercentInput(pricingInputs, "C4", PRICING_DEFAULTS.commercialGmFloorPct);
  const gainshareProviderSharePct = readWorkbookPercentInput(pricingInputs, "C24", PRICING_DEFAULTS.gainshareProviderSharePct);
  const recommendedPersonaId = normalizePersonaId(workspace?.opsModel?.selectedPersonaId || "standard");
  const costView = buildFpaCostWorkbookView({ currentDeal, workspace });
  const costPersonaMap = Object.fromEntries(costView.personaSections.map((persona) => [persona.key, persona]));

  const personas = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => {
    const targetGrossMarginPct = readPersonaMetric(personaInputs, persona, "targetGrossMarginPct");
    const markupOnCostPct = readPersonaMetric(personaInputs, persona, "markupOnCostPct");
    const riskPremiumPct = readPersonaMetric(personaInputs, persona, "riskPremiumPct");
    const metrics = buildPersonaMetrics({
      persona,
      costPersona: costPersonaMap[persona.key],
      commercialGmFloorPct,
      competitionBias,
      targetGrossMarginPct,
      markupOnCostPct,
      riskPremiumPct,
    });

    return {
      ...persona,
      index: index + 1,
      metrics,
    };
  });

  const selectedPersonaId = normalizePersonaId(
    inspectPersonaId === FPA_PRICING_INSPECT_AUTO ? recommendedPersonaId : inspectPersonaId,
  );
  const selectedPersona = personas.find((persona) => persona.key === selectedPersonaId) || personas[1] || personas[0];
  const recommendedPersona = personas.find((persona) => persona.key === recommendedPersonaId) || personas[1] || personas[0];

  const summaryRows = PRICING_ROW_DEFS.map((definition) => ({
    ...definition,
    values: personas.map((persona) => ({
      key: persona.key,
      label: persona.label,
      value: persona.metrics[definition.key],
      text: formatPricingValue(persona.metrics[definition.key], definition.format),
    })),
  }));

  const constructRows = CONSTRUCT_ROW_DEFS.map((definition) => ({
    ...definition,
    values: personas.map((persona) => ({
      key: persona.key,
      label: persona.label,
      value: persona.metrics[definition.key],
      text: formatPricingValue(persona.metrics[definition.key], definition.format),
    })),
  }));

  const personaCards = personas.map((persona) => ({
    key: persona.key,
    label: persona.label,
    value: persona.metrics.recommendedAnnualPrice,
    valueText: formatPricingValue(persona.metrics.recommendedAnnualPrice, "currency0"),
    note: `${formatPricingValue(persona.metrics.grossMarginPct, "percent1")} GM`,
    alert: persona.metrics.marginAlert,
  }));

  return {
    ...FPA_PRICING_SNAPSHOT,
    competitiveIntensity,
    competitionBias,
    recommendedPersona,
    selectedPersona,
    personaHeaders: personas.map((persona) => ({
      key: persona.key,
      label: persona.label,
      workbookColumn: persona.workbookColumn,
    })),
    controls: {
      commercialGmFloor: {
        key: "commercialGmFloorPct",
        label: "Commercial GM Floor",
        address: "C4",
        rowNumber: 4,
        kind: "percent",
        value: commercialGmFloorPct,
      },
      competitionBias: {
        key: "competitionBias",
        label: "Competition Bias",
        address: "F4",
        rowNumber: 4,
        kind: "factor",
        value: competitionBias,
        source: competitiveIntensity,
      },
      gainshareProviderShare: {
        key: "gainshareProviderSharePct",
        label: "Gainshare provider share",
        address: "C24",
        rowNumber: 24,
        kind: "percent",
        value: gainshareProviderSharePct,
      },
    },
    summaryRows,
    constructRows,
    personaCards,
    constructNote: "T&M view = rate card (10) + markup; volumes stay customer risk.",
  };
}
