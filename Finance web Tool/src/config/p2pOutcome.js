import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { buildP2pPricingWorkbookView } from "./p2pPricing";
import { deriveP2pScopeMetrics } from "./p2pScope";
import { buildP2pWorkloadModel } from "./p2pWorkload";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "./p2pWorkspace";

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

const FALLBACK_ALLOCATION_PCTS = Object.freeze({
  requisitionSourcingSupport: 0.05,
  poManagement: 0.08,
  vendorMaster: 0.07,
  invoiceProcessing: 0.24,
  threeWayMatch: 0.1,
  exceptionQueryHandling: 0.12,
  paymentsDisbursement: 0.12,
  travelExpense: 0.06,
  supplierReconciliationStatements: 0.08,
  reportingControlsGovernance: 0.08,
});

export const P2P_OUTCOME_INSPECT_AUTO = "__AUTO__";

export const P2P_OUTCOME_SNAPSHOT = Object.freeze({
  sheetName: "P2P_14 Outcome",
  title: "14. Outcome-Based Pricing - P2P per-unit rates (reconciles to ARC)",
  note: "Volumes are scope-adjusted P2P outcome drivers. Allocation percent must total 100 percent; sum(unit price x annual volume) must reconcile to ARC.",
  formulaCount: 40,
  editableCellCount: 10,
  unitCount: 10,
});

const OUTCOME_UNIT_DEFS = Object.freeze([
  {
    key: "requisitionSupported",
    rowNumber: 8,
    l2Id: "requisitionSourcingSupport",
    label: "Requisition supported",
    volumeSource: "Requisitions / yr (000s) x 1,000 x Scope L2 #1",
    computeVolume: ({ discovery, scopePctByL2Id }) => toAnnualUnits(discovery.requisitions000) * (scopePctByL2Id.requisitionSourcingSupport || 0),
  },
  {
    key: "purchaseOrderManaged",
    rowNumber: 9,
    l2Id: "poManagement",
    label: "Purchase order managed",
    volumeSource: "Purchase orders / yr (000s) x 1,000 x Scope L2 #2",
    computeVolume: ({ discovery, scopePctByL2Id }) => toAnnualUnits(discovery.purchaseOrders000) * (scopePctByL2Id.poManagement || 0),
  },
  {
    key: "vendorMasterServed",
    rowNumber: 10,
    l2Id: "vendorMaster",
    label: "Vendor master served",
    volumeSource: "Active vendors (000s) x 1,000 x Scope L2 #3",
    computeVolume: ({ discovery, scopePctByL2Id }) => toAnnualUnits(discovery.activeVendors000) * (scopePctByL2Id.vendorMaster || 0),
  },
  {
    key: "supplierInvoiceProcessed",
    rowNumber: 11,
    l2Id: "invoiceProcessing",
    label: "Supplier invoice processed",
    volumeSource: "Supplier invoices / yr (000s) x 1,000 x Scope L2 #4",
    computeVolume: ({ discovery, scopePctByL2Id }) => toAnnualUnits(discovery.supplierInvoices000) * (scopePctByL2Id.invoiceProcessing || 0),
  },
  {
    key: "matchCaseHandled",
    rowNumber: 12,
    l2Id: "threeWayMatch",
    label: "Match case handled",
    volumeSource: "Supplier invoices / yr (000s) x PO-backed spend share x Scope L2 #5",
    computeVolume: ({ discovery, scopePctByL2Id }) => (
      toAnnualUnits(discovery.supplierInvoices000)
      * toPercent(discovery.poBackedSpendShare, 0.6)
      * (scopePctByL2Id.threeWayMatch || 0)
    ),
  },
  {
    key: "exceptionCaseResolved",
    rowNumber: 13,
    l2Id: "exceptionQueryHandling",
    label: "Exception / query case resolved",
    volumeSource: "Supplier invoices / yr (000s) x invoice exception rate x Scope L2 #6",
    computeVolume: ({ discovery, scopePctByL2Id }) => (
      toAnnualUnits(discovery.supplierInvoices000)
      * toPercent(discovery.invoiceExceptionRate, 0.18)
      * (scopePctByL2Id.exceptionQueryHandling || 0)
    ),
  },
  {
    key: "paymentRunExecuted",
    rowNumber: 14,
    l2Id: "paymentsDisbursement",
    label: "Payment run executed",
    volumeSource: "Payment runs / month x 12 x Scope L2 #7",
    computeVolume: ({ discovery, scopePctByL2Id }) => (
      toNumber(discovery.paymentRunsPerMonth, 0)
      * 12
      * (scopePctByL2Id.paymentsDisbursement || 0)
    ),
  },
  {
    key: "travelExpenseClaimProcessed",
    rowNumber: 15,
    l2Id: "travelExpense",
    label: "T&E claim processed",
    volumeSource: "T&E claims / yr (000s) x 1,000 x Scope L2 #8",
    computeVolume: ({ discovery, scopePctByL2Id }) => toAnnualUnits(discovery.tneClaims000) * (scopePctByL2Id.travelExpense || 0),
  },
  {
    key: "supplierStatementReconciled",
    rowNumber: 16,
    l2Id: "supplierReconciliationStatements",
    label: "Supplier statement reconciled",
    volumeSource: "Active vendors (000s) x 12 x Scope L2 #9",
    computeVolume: ({ discovery, scopePctByL2Id }) => (
      toAnnualUnits(discovery.activeVendors000)
      * 12
      * (scopePctByL2Id.supplierReconciliationStatements || 0)
    ),
  },
  {
    key: "governanceCycleDelivered",
    rowNumber: 17,
    l2Id: "reportingControlsGovernance",
    label: "Governance cycle delivered",
    volumeSource: "(12 + legal entities x 4 + business units x 2) x Scope L2 #10",
    computeVolume: ({ discovery, scopePctByL2Id }) => (
      (12 + (toNumber(discovery.legalEntities, 0) * 4) + (toNumber(discovery.businessUnits, 0) * 2))
      * (scopePctByL2Id.reportingControlsGovernance || 0)
    ),
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

function toNumber(value, fallback = 0) {
  const numeric = parseNumericText(value, Number.NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toPercent(value, fallback = 0) {
  const numeric = parseNumericText(value, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1);
}

function toAnnualUnits(value) {
  return toNumber(value, 0) * 1000;
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

export function formatP2pOutcomeValue(value, format = "currency0") {
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

export function formatP2pOutcomeInputValue(kind, value) {
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

export function normalizeP2pOutcomeInputValue(kind, value) {
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

function getPricingRowValue(pricingView, rowKey, personaKey) {
  const row = pricingView.summaryRows.find((item) => item.key === rowKey);
  const cell = row?.values?.find((item) => item.key === personaKey);
  return round(Number(cell?.value || 0), 12);
}

function resolveSelectedPersona(pricingView, inspectPersonaId) {
  const recommendedPersonaId = normalizePersonaId(pricingView.recommendedPersona?.key || "standard");
  const selectedPersonaId = normalizePersonaId(
    inspectPersonaId === P2P_OUTCOME_INSPECT_AUTO ? recommendedPersonaId : inspectPersonaId,
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

export function buildP2pOutcomeWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
  inspectPersonaId = P2P_OUTCOME_INSPECT_AUTO,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : EMPTY_INPUTS;
  const outcomeInputs = workbookInputs[P2P_OUTCOME_SNAPSHOT.sheetName] && typeof workbookInputs[P2P_OUTCOME_SNAPSHOT.sheetName] === "object"
    ? workbookInputs[P2P_OUTCOME_SNAPSHOT.sheetName]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const scopeMetrics = deriveP2pScopeMetrics(workspace.scopeL3 || {});
  const workloadModel = buildP2pWorkloadModel(workspace, currentDeal);
  const pricingView = buildP2pPricingWorkbookView({ currentDeal, workspace });

  const { selectedPersona, recommendedPersona } = resolveSelectedPersona(pricingView, inspectPersonaId);
  const annualRecurringCharge = getPricingRowValue(pricingView, "recommendedAnnualPrice", selectedPersona.key);
  const recommendedAnnualRecurringCharge = getPricingRowValue(
    pricingView,
    "recommendedAnnualPrice",
    recommendedPersona.key,
  );

  const discovery = discoveryMetrics.effectiveDiscovery;
  const scopePctByL2Id = Object.fromEntries(scopeMetrics.l2RollupRows.map((row) => [row.id, row.scopePct]));
  const processHoursByL2 = Object.fromEntries(workloadModel.processRows.map((row) => [row.id, round(row.finalHours || 0, 12)]));
  const totalMonthlyHours = round(workloadModel.totalMonthlyHours || 0, 12);
  const allocationMode = totalMonthlyHours > 0 ? "Workload hour mix" : "Fallback defaults";

  const unitRows = OUTCOME_UNIT_DEFS.map((definition) => {
    const defaultAllocationPct = totalMonthlyHours > 0
      ? clamp((processHoursByL2[definition.l2Id] || 0) / totalMonthlyHours, 0, 1)
      : (FALLBACK_ALLOCATION_PCTS[definition.l2Id] || 0);
    const annualVolume = round(definition.computeVolume({
      discovery,
      scopePctByL2Id,
    }), 12);
    const allocationPct = readWorkbookPercentInput(outcomeInputs, `D${definition.rowNumber}`, defaultAllocationPct);
    const unitPrice = annualVolume > 0
      ? round((annualRecurringCharge * allocationPct) / annualVolume, 12)
      : 0;
    const annualCheck = round(annualVolume * unitPrice, 12);
    const hasZeroVolumeAllocationIssue = annualVolume <= 0 && allocationPct > 0;

    return {
      ...definition,
      allocationAddress: `D${definition.rowNumber}`,
      defaultAllocationPct,
      annualVolume,
      allocationPct,
      unitPrice,
      annualCheck,
      hasZeroVolumeAllocationIssue,
      workloadHoursShare: defaultAllocationPct,
    };
  });

  const totalAllocationPct = round(unitRows.reduce((sum, row) => sum + row.allocationPct, 0), 12);
  const annualCheckTotal = round(unitRows.reduce((sum, row) => sum + row.annualCheck, 0), 12);
  const zeroVolumeIssueCount = unitRows.filter((row) => row.hasZeroVolumeAllocationIssue).length;
  const reconciliationMessage = resolveReconciliationMessage(totalAllocationPct, annualCheckTotal, annualRecurringCharge);

  return {
    ...P2P_OUTCOME_SNAPSHOT,
    personaHeaders: pricingView.personaHeaders || [],
    selectedPersona: {
      ...selectedPersona,
      annualRecurringCharge,
    },
    recommendedPersona: {
      ...recommendedPersona,
      annualRecurringCharge: recommendedAnnualRecurringCharge,
    },
    allocationMode,
    drivers: {
      requisitions000: discovery.requisitions000,
      purchaseOrders000: discovery.purchaseOrders000,
      supplierInvoices000: discovery.supplierInvoices000,
      activeVendors000: discovery.activeVendors000,
      paymentRunsPerMonth: discovery.paymentRunsPerMonth,
      tneClaims000: discovery.tneClaims000,
      poBackedSpendShare: discovery.poBackedSpendShare,
      invoiceExceptionRate: discovery.invoiceExceptionRate,
    },
    totalMonthlyHours,
    selectedL2Count: scopeMetrics.selectedL2Count,
    unitRows,
    totals: {
      totalAllocationPct,
      annualCheckTotal,
      zeroVolumeIssueCount,
      annualRecurringChargeDelta: round(annualCheckTotal - annualRecurringCharge, 12),
    },
    reconciliationMessage,
    guardNote: "Guard: zero-volume unit with allocation > 0 or allocation total not equal to 100% will fail reconciliation.",
  };
}
