import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";
import { buildFpaPricingWorkbookView } from "./fpaPricing";
import { deriveFpaScopeMetrics } from "./fpaScope";
import { buildFpaWorkloadWorkbookView } from "./fpaWorkload";
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

export const FPA_OUTCOME_INSPECT_AUTO = "__AUTO__";

export const FPA_OUTCOME_SNAPSHOT = Object.freeze({
  sheetName: "FPA_14 Outcome",
  title: "14. Outcome-Based Pricing - FP&A per-unit rates (reconciles to ARC)",
  note: "Volumes are scope-adjusted effective drivers. Allocation % must total 100%; sum(unit price x volume) must reconcile to ARC.",
  formulaCount: 27,
  editableCellCount: 7,
  unitCount: 7,
});

const OUTCOME_UNIT_DEFS = Object.freeze([
  {
    key: "reportPackDelivered",
    rowNumber: 9,
    label: "Report pack delivered",
    defaultAllocationPct: 0.4,
    volumeSource: "Report packs per month x 12 x Scope row 70",
    computeVolume: ({ discovery, scopePctByRow }) => discovery.reportPacksPerMonth * 12 * (scopePctByRow[70] || 0),
  },
  {
    key: "forecastCycleSupported",
    rowNumber: 10,
    label: "Forecast cycle supported",
    defaultAllocationPct: 0.2,
    volumeSource: "Workload C9 forecast cycles per year x Scope row 64",
    computeVolume: ({ scopePctByRow, forecastCyclesPerYear }) => forecastCyclesPerYear * (scopePctByRow[64] || 0),
  },
  {
    key: "annualBudgetCycle",
    rowNumber: 11,
    label: "Annual budget cycle",
    defaultAllocationPct: 0.05,
    volumeSource: "1 x Scope row 63",
    computeVolume: ({ scopePctByRow }) => 1 * (scopePctByRow[63] || 0),
  },
  {
    key: "entityConsolidationMonth",
    rowNumber: 12,
    label: "Entity consolidation-month",
    defaultAllocationPct: 0.15,
    volumeSource: "Legal entities x 12 x Scope row 68",
    computeVolume: ({ discovery, scopePctByRow }) => discovery.legalEntities * 12 * (scopePctByRow[68] || 0),
  },
  {
    key: "buPlanningCycle",
    rowNumber: 13,
    label: "BU planning cycle",
    defaultAllocationPct: 0.05,
    volumeSource: "Business units x 12 x Scope row 64",
    computeVolume: ({ discovery, scopePctByRow }) => discovery.businessUnits * 12 * (scopePctByRow[64] || 0),
  },
  {
    key: "varianceAnalysisPack",
    rowNumber: 14,
    label: "Variance analysis pack",
    defaultAllocationPct: 0.1,
    volumeSource: "Business units x 36 x Scope row 69",
    computeVolume: ({ discovery, scopePctByRow }) => discovery.businessUnits * 36 * (scopePctByRow[69] || 0),
  },
  {
    key: "boardExecPack",
    rowNumber: 15,
    label: "Board / exec pack",
    defaultAllocationPct: 0.05,
    volumeSource: "4 x Scope row 70",
    computeVolume: ({ scopePctByRow }) => 4 * (scopePctByRow[70] || 0),
  },
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
  const cellMap = {};

  rows.forEach((row) => {
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    cells.forEach((cell) => {
      if (cell?.address) {
        cellMap[cell.address] = cell;
      }
    });
  });

  return cellMap;
}

function getCellNumber(cellMap, address, fallback = 0) {
  const candidate = cellMap[address];
  const numeric = parseNumericText(candidate?.raw ?? candidate?.text, Number.NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
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

export function formatOutcomeValue(value, format = "currency0") {
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
    case "number2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "whole":
    default:
      return INTEGER_FORMATTER.format(Math.round(numeric));
  }
}

export function formatOutcomeInputValue(kind, value) {
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

export function normalizeOutcomeInputValue(kind, value) {
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

function getPricingRowValue(pricingView, rowKey, personaKey) {
  const row = pricingView.summaryRows.find((item) => item.key === rowKey);
  const cell = row?.values?.find((item) => item.key === personaKey);
  return round(Number(cell?.value || 0), 12);
}

function resolveSelectedPersona(pricingView, inspectPersonaId) {
  const recommendedPersonaId = normalizePersonaId(pricingView.recommendedPersona?.key || "standard");
  const selectedPersonaId = normalizePersonaId(
    inspectPersonaId === FPA_OUTCOME_INSPECT_AUTO ? recommendedPersonaId : inspectPersonaId,
  );

  const personaHeaders = pricingView.personaHeaders || [];
  const selectedHeader = personaHeaders.find((persona) => persona.key === selectedPersonaId) || personaHeaders[1] || personaHeaders[0];
  const recommendedHeader = personaHeaders.find((persona) => persona.key === recommendedPersonaId) || personaHeaders[1] || personaHeaders[0];

  return {
    selectedPersonaId: selectedHeader?.key || "standard",
    recommendedPersonaId: recommendedHeader?.key || "standard",
    selectedPersona: {
      ...selectedHeader,
      index: Math.max(1, personaHeaders.findIndex((persona) => persona.key === selectedHeader?.key) + 1),
    },
    recommendedPersona: {
      ...recommendedHeader,
      index: Math.max(1, personaHeaders.findIndex((persona) => persona.key === recommendedHeader?.key) + 1),
    },
  };
}

function resolveReconciliationMessage(totalAllocationPct, annualCheckTotal, annualRecurringCharge) {
  if (Math.abs(totalAllocationPct - 1) > 0.001) {
    return "FIX - allocation must total 100%";
  }

  if (Math.abs(annualCheckTotal - annualRecurringCharge) > 1) {
    return "FIX - does not reconcile to ARC";
  }

  return "Reconciles to ARC - OK";
}

export function buildFpaOutcomeWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
  inspectPersonaId = FPA_OUTCOME_INSPECT_AUTO,
} = {}) {
  const workspace = normalizeFpaWorkspace(workspaceValue || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const workbookInputs = currentDeal?.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
    ? currentDeal.fpaWorkbookInputs
    : EMPTY_INPUTS;
  const outcomeInputs = workbookInputs[FPA_OUTCOME_SNAPSHOT.sheetName] && typeof workbookInputs[FPA_OUTCOME_SNAPSHOT.sheetName] === "object"
    ? workbookInputs[FPA_OUTCOME_SNAPSHOT.sheetName]
    : EMPTY_INPUTS;
  const benchmarkInputs = workbookInputs["FPA_04 Benchmarks"] && typeof workbookInputs["FPA_04 Benchmarks"] === "object"
    ? workbookInputs["FPA_04 Benchmarks"]
    : EMPTY_INPUTS;
  const workloadInputs = workbookInputs["FPA_05 Workload"] && typeof workbookInputs["FPA_05 Workload"] === "object"
    ? workbookInputs["FPA_05 Workload"]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const scopeMetrics = deriveFpaScopeMetrics(workspace.scopeL3, workspace.scopeL2);
  const workloadView = buildFpaWorkloadWorkbookView(workloadInputs, benchmarkInputs, workspace, currentDeal);
  const workloadCellMap = createAddressMap(workloadView.rows);
  const pricingView = buildFpaPricingWorkbookView({ currentDeal, workspace });

  const { selectedPersona, recommendedPersona } = resolveSelectedPersona(pricingView, inspectPersonaId);
  const annualRecurringCharge = getPricingRowValue(pricingView, "recommendedAnnualPrice", selectedPersona.key);
  const recommendedAnnualRecurringCharge = getPricingRowValue(
    pricingView,
    "recommendedAnnualPrice",
    recommendedPersona.key,
  );
  const scopePctByRow = Object.fromEntries(scopeMetrics.l2RollupRows.map((row) => [row.row, row.scopePct]));
  const discovery = discoveryMetrics.effectiveDiscovery;
  const forecastCyclesPerYear = getCellNumber(workloadCellMap, "C9", 12);

  const unitRows = OUTCOME_UNIT_DEFS.map((definition) => {
    const annualVolume = round(definition.computeVolume({
      discovery,
      scopePctByRow,
      forecastCyclesPerYear,
    }), 12);
    const allocationPct = readWorkbookPercentInput(outcomeInputs, `D${definition.rowNumber}`, definition.defaultAllocationPct);
    const unitPrice = annualVolume > 0
      ? round((annualRecurringCharge * allocationPct) / annualVolume, 12)
      : 0;
    const annualCheck = round(annualVolume * unitPrice, 12);
    const hasZeroVolumeAllocationIssue = annualVolume <= 0 && allocationPct > 0;

    return {
      ...definition,
      allocationAddress: `D${definition.rowNumber}`,
      annualVolume,
      allocationPct,
      unitPrice,
      annualCheck,
      hasZeroVolumeAllocationIssue,
    };
  });

  const totalAllocationPct = round(unitRows.reduce((sum, row) => sum + row.allocationPct, 0), 12);
  const annualCheckTotal = round(unitRows.reduce((sum, row) => sum + row.annualCheck, 0), 12);
  const zeroVolumeIssueCount = unitRows.filter((row) => row.hasZeroVolumeAllocationIssue).length;
  const reconciliationMessage = resolveReconciliationMessage(totalAllocationPct, annualCheckTotal, annualRecurringCharge);

  return {
    ...FPA_OUTCOME_SNAPSHOT,
    personaHeaders: pricingView.personaHeaders || [],
    selectedPersona: {
      ...selectedPersona,
      annualRecurringCharge,
    },
    recommendedPersona: {
      ...recommendedPersona,
      annualRecurringCharge: recommendedAnnualRecurringCharge,
    },
    scopePctByRow,
    forecastCyclesPerYear,
    drivers: {
      reportPacksPerMonth: discovery.reportPacksPerMonth,
      legalEntities: discovery.legalEntities,
      businessUnits: discovery.businessUnits,
      budgetingScopePct: scopePctByRow[63] || 0,
      rollingForecastScopePct: scopePctByRow[64] || 0,
      cashFlowScopePct: scopePctByRow[68] || 0,
      varianceScopePct: scopePctByRow[69] || 0,
      managementReportingScopePct: scopePctByRow[70] || 0,
    },
    unitRows,
    totals: {
      totalAllocationPct,
      annualCheckTotal,
      zeroVolumeIssueCount,
      annualRecurringChargeDelta: round(annualCheckTotal - annualRecurringCharge, 12),
    },
    reconciliationMessage,
    guardNote: "Guard: zero-volume unit with allocation > 0 will fail reconciliation - set its allocation to 0.",
  };
}
