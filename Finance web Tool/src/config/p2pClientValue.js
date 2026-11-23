import { buildP2pBusinessCaseWorkbookView } from "./p2pBusinessCase";
import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { buildP2pPricingWorkbookView } from "./p2pPricing";
import { buildP2pRecommendWorkbookView } from "./p2pRecommend";
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
const CURRENCY_ZERO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const PERCENT_ONE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const P2P_CLIENT_VALUE_SNAPSHOT = Object.freeze({
  sheetName: "P2P_21 Client Value",
  title: "21. Client Value View — P2P savings vs baseline (client-facing chart source)",
  note: "Baseline = customer-shared cost if given, else current staff × client cost/FTE [PA proxy], scaled by transferred share.",
  formulaCount: 57,
  editableCellCount: 1,
  yearCount: 7,
});

const YEAR_KEYS = Object.freeze(["Y1", "Y2", "Y3", "Y4", "Y5", "Y6", "Y7"]);

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
  const normalized = trimValue(value).replace(/,/g, "").replace(/\$/g, "");

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

export function formatP2pClientValueValue(value, format = "currency0") {
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
    case "currency0":
      return CURRENCY_ZERO_FORMATTER.format(Math.round(numeric));
    case "percent1":
      return PERCENT_ONE_FORMATTER.format(numeric);
    case "score1":
      return DECIMAL_ONE_FORMATTER.format(numeric);
    case "whole":
    default:
      return INTEGER_FORMATTER.format(Math.round(numeric));
  }
}

export function formatP2pClientValueInputValue(kind, value) {
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

export function normalizeP2pClientValueInputValue(kind, value) {
  const trimmed = trimValue(value);
  if (!trimmed) {
    return "";
  }

  const numeric = parseNumericText(trimmed, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (kind === "percent") {
    return String(clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 2));
  }

  return String(numeric);
}

function readWorkbookPercentInput(workbookInputs, address, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 2);
}

export function buildP2pClientValueWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : EMPTY_INPUTS;
  const clientValueInputs = workbookInputs[P2P_CLIENT_VALUE_SNAPSHOT.sheetName]
    && typeof workbookInputs[P2P_CLIENT_VALUE_SNAPSHOT.sheetName] === "object"
    ? workbookInputs[P2P_CLIENT_VALUE_SNAPSHOT.sheetName]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const recommendView = buildP2pRecommendWorkbookView({ currentDeal, workspace });
  const businessCaseView = buildP2pBusinessCaseWorkbookView({ currentDeal, workspace });
  const pricingView = buildP2pPricingWorkbookView({ currentDeal, workspace });
  const workloadView = buildP2pWorkloadModel(workspace, currentDeal);

  const recommendedPersona = recommendView.recommendedPersona
    || businessCaseView.recommendedPersona
    || { key: "standard", label: "Standard", index: 2 };
  const recommendedPersonaIndex = Number(recommendedPersona.index || 2);
  const transferredShare = round(clamp(Number(workloadView.impliedShare || 0), 0, 1), 12);
  const baselineOverheadUpliftPct = readWorkbookPercentInput(clientValueInputs, "C9", 0.3);
  const benchmarkClientCostPerFte = Number(workloadView.benchmarkModel?.clientLoadedCostPerFte || 0);
  const benchmarkInflationPct = Number(workloadView.benchmarkModel?.clientCostInflation || 0);
  const rawBaselineInput = workspace?.discovery?.currentTowerCostBaselineUsd;
  const typedClientBaselineY1 = parseNumericText(rawBaselineInput, Number.NaN);
  const usesCustomerBaseline = Number.isFinite(typedClientBaselineY1);
  const proxyBaselineY1 = round(
    Number(discoveryMetrics.effectiveDiscovery?.currentTowerStaff || 0) * benchmarkClientCostPerFte * (1 + baselineOverheadUpliftPct),
    12,
  );
  const clientBaselineY1 = round((usesCustomerBaseline ? typedClientBaselineY1 : proxyBaselineY1) * transferredShare, 12);

  const inTermMaskValues = businessCaseView.inTermMaskRow?.values?.map((cell) => Number(cell.value || 0)) || YEAR_KEYS.map(() => 0);
  const annualChargeRow = businessCaseView.annualChargeRows?.find((row) => row.key === recommendedPersona.key)
    || businessCaseView.annualChargeRows?.[Math.max(0, recommendedPersonaIndex - 1)]
    || null;
  const annualChargeValues = annualChargeRow?.values?.map((cell) => Number(cell.value || 0)) || YEAR_KEYS.map(() => 0);
  const gainshareProviderSharePct = Number(pricingView.controls?.gainshareProviderShare?.value || 0);
  const isGainshare = trimValue(currentDeal?.pricingConstruct) === "Gainshare";

  let cumulativeSavings = 0;
  let termSavings = 0;
  let termBaseline = 0;
  let totalGainsharePool = 0;

  const yearRows = YEAR_KEYS.map((label, yearIndex) => {
    const inTerm = Number(inTermMaskValues[yearIndex] || 0);
    const clientBaselineInflated = round(clientBaselineY1 * ((1 + benchmarkInflationPct) ** yearIndex), 12);
    const ourArc = round(annualChargeValues[yearIndex] || 0, 12);
    const savings = round(clientBaselineInflated - ourArc, 12);
    const savingsPct = clientBaselineInflated !== 0 ? round(savings / clientBaselineInflated, 12) : 0;

    cumulativeSavings = round(cumulativeSavings + (savings * inTerm), 12);
    const gainsharePool = isGainshare ? round(gainshareProviderSharePct * Math.max(0, savings) * inTerm, 12) : 0;

    termSavings = round(termSavings + (savings * inTerm), 12);
    termBaseline = round(termBaseline + (clientBaselineInflated * inTerm), 12);
    totalGainsharePool = round(totalGainsharePool + gainsharePool, 12);

    return {
      key: label.toLowerCase(),
      label,
      rowNumber: 12 + yearIndex,
      inTerm,
      clientBaselineInflated,
      ourArc,
      savings,
      savingsPct,
      cumulativeSavings,
      gainsharePool,
    };
  });

  const termSavingsPct = termBaseline !== 0 ? round(termSavings / termBaseline, 12) : 0;
  const baselineSourceMessage = usesCustomerBaseline
    ? "Baseline: customer-provided (CC)."
    : "INDICATIVE — baseline is a provider proxy [PA]; validate before any client use.";

  return {
    ...P2P_CLIENT_VALUE_SNAPSHOT,
    recommendedPersona: {
      key: recommendedPersona.key,
      label: recommendedPersona.label,
      index: recommendedPersonaIndex,
    },
    controls: {
      baselineOverheadUplift: {
        key: "baselineOverheadUpliftPct",
        label: "Client mgmt/tooling overhead uplift on baseline [PA]",
        address: "C9",
        rowNumber: 9,
        kind: "percent",
        value: baselineOverheadUpliftPct,
      },
    },
    contextRows: [
      { key: "persona", rowNumber: 5, label: "Persona (auto = recommended)", value: recommendedPersona.label, format: "status" },
      { key: "index", rowNumber: 6, label: "Index", value: recommendedPersonaIndex, format: "whole" },
      { key: "transferredShare", rowNumber: 8, label: "Transferred share of client P2P organisation", value: transferredShare, format: "percent1" },
      { key: "baselineOverheadUplift", rowNumber: 9, label: "Client mgmt/tooling overhead uplift on baseline [PA]", value: baselineOverheadUpliftPct, format: "percent1" },
      { key: "clientBaselineY1", rowNumber: 10, label: "Client baseline Y1 (transferred scope, TCO)", value: clientBaselineY1, format: "currency0" },
    ],
    yearRows,
    baselineSourceMessage,
    usesCustomerBaseline,
    benchmarkClientCostPerFte,
    benchmarkInflationPct,
    termSavings,
    termSavingsPct,
    termBaseline,
    totalGainsharePool,
  };
}
