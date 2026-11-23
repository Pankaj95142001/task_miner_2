import { countFilledP2pDiscoveryFields, deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { buildP2pWorkloadModel } from "./p2pWorkload";
import { buildP2pPricingWorkbookView } from "./p2pPricing";
import { buildP2pBusinessCaseWorkbookView } from "./p2pBusinessCase";
import { buildP2pRecommendWorkbookView } from "./p2pRecommend";
import { buildP2pRiskWorkbookView } from "./p2pRisk";
import { buildP2pDealRisksWorkbookView } from "./p2pDealRisks";
import { buildP2pClientValueWorkbookView } from "./p2pClientValue";
import { buildP2pOutcomeWorkbookView } from "./p2pOutcome";
import { deriveP2pScopeMetrics } from "./p2pScope";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "./p2pWorkspace";

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
const CURRENCY_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const P2P_DASHBOARD_SNAPSHOT = Object.freeze({
  sheetName: "P2P_22 Dashboard",
  title: "22. Executive Dashboard - P2P (Procure-to-Pay)",
  note: "Cockpit-ready local dashboard built from discovery, workload, pricing, business case, outcome, risk, and client value tabs.",
  formulaCount: 128,
});

function trimValue(value) {
  return String(value ?? "").trim();
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

export function formatP2pDashboardValue(value, format = "text") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (["status", "text"].includes(format)) {
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
    case "score1":
    case "number1":
      return DECIMAL_ONE_FORMATTER.format(numeric);
    case "number2":
    case "fte2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "factor2":
      return `${DECIMAL_TWO_FORMATTER.format(numeric)}x`;
    case "whole":
      return INTEGER_FORMATTER.format(Math.round(numeric));
    default:
      return DECIMAL_TWO_FORMATTER.format(numeric);
  }
}

function createMetricRow(rowNumber, label, value, format = "text") {
  return {
    rowNumber,
    label,
    value,
    format,
    text: formatP2pDashboardValue(value, format),
  };
}

function buildPersonaMetricMaps(rows = []) {
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

function getPersonaMetricText(metricMap, rowKey, personaKey, fallback = "") {
  const text = metricMap?.[rowKey]?.[personaKey]?.text;
  return trimValue(text || fallback);
}

function createPersonaSummaryRow({
  key,
  rowNumber,
  label,
  format,
  metricMap,
  metricKey,
  personaHeaders,
}) {
  return {
    key,
    rowNumber,
    label,
    format,
    values: personaHeaders.map((persona) => {
      const cellText = getPersonaMetricText(metricMap, metricKey, persona.key, "");
      const cellValue = getPersonaMetricValue(metricMap, metricKey, persona.key, "");
      const text = format === "status"
        ? (cellText || formatP2pDashboardValue(cellValue, format))
        : formatP2pDashboardValue(cellValue, format);

      return {
        key: persona.key,
        label: persona.label,
        value: cellValue,
        text,
      };
    }),
  };
}

function verdictToStatus(value) {
  const normalized = trimValue(value).toUpperCase();
  if (normalized === "GREEN" || normalized === "OK" || normalized === "READY") {
    return "OK";
  }
  if (normalized === "AMBER" || normalized === "REVIEW" || normalized === "CHECK") {
    return "REVIEW";
  }
  if (normalized === "RED" || normalized === "NOT READY") {
    return "RED";
  }
  return normalized || "REVIEW";
}

function bandStatus(value, okThreshold, reviewThreshold = okThreshold) {
  if (!Number.isFinite(value)) {
    return "REVIEW";
  }
  if (value >= okThreshold) {
    return "OK";
  }
  if (value >= reviewThreshold) {
    return "REVIEW";
  }
  return "RED";
}

function buildLogicChecks({
  currentDeal,
  recommendView,
  riskPersona,
  riskView,
  dealRisksView,
  discoveryMetrics,
  scopeMetrics,
  workloadView,
  outcomeView,
  businessCaseView,
  clientValueView,
}) {
  const recommendedPersonaKey = recommendView.recommendedPersona?.key || "standard";
  const selectedBusinessCaseSummary = businessCaseView.selectedPersona?.summary || {};
  const outcomeOk = outcomeView.reconciliationMessage === "Reconciles to ARC - OK"
    && Number(outcomeView.totals?.zeroVolumeIssueCount || 0) === 0;
  const dealRiskAligned = trimValue(dealRisksView.selectedPersona?.key) === recommendedPersonaKey;

  const checks = [
    { id: 1, rowNumber: 26, label: "Client name set on deal master", status: trimValue(currentDeal?.clientName) ? "OK" : "RED" },
    { id: 2, rowNumber: 27, label: "Discovery coverage at hybrid-or-better", status: bandStatus(Number(discoveryMetrics.coveragePct || 0), 0.45, 0.3) },
    { id: 3, rowNumber: 28, label: "Weighted completeness at 60%+", status: bandStatus(Number(discoveryMetrics.weightedCompleteness || 0), 0.6, 0.4) },
    { id: 4, rowNumber: 29, label: "At least one L2 process is in scope", status: Number(scopeMetrics.selectedL2Count || 0) > 0 ? "OK" : "RED" },
    {
      id: 5,
      rowNumber: 30,
      label: "Workload tie-out closed",
      status: trimValue(workloadView.typedTieOut).startsWith("OK")
        ? "OK"
        : trimValue(workloadView.typedTieOut).startsWith("Awaiting")
          ? "REVIEW"
          : "RED",
    },
    { id: 6, rowNumber: 31, label: "Customer-vs-driver RED variances cleared", status: Number(workloadView.redVarianceCount || 0) === 0 ? "OK" : "RED" },
    { id: 7, rowNumber: 32, label: "Recommend weights total 100%", status: trimValue(recommendView.weightStatus) === "Weights OK" ? "OK" : "RED" },
    { id: 8, rowNumber: 33, label: "Recommended persona passes persona risk gate", status: verdictToStatus(riskPersona?.verdict || "REVIEW") },
    { id: 9, rowNumber: 34, label: "Outcome allocation reconciles to ARC", status: outcomeOk ? "OK" : "RED" },
    { id: 10, rowNumber: 35, label: "Business case NPV is positive", status: Number(selectedBusinessCaseSummary.npv || 0) > 0 ? "OK" : "RED" },
    { id: 11, rowNumber: 36, label: "Client value remains positive over term", status: Number(clientValueView.termSavings || 0) > 0 ? "OK" : Number(clientValueView.termSavings || 0) === 0 ? "REVIEW" : "RED" },
    { id: 12, rowNumber: 37, label: "Workload and complexity overrides have rationale", status: Number(riskView.governanceOverrideIssueCount || 0) === 0 ? "OK" : "REVIEW" },
    { id: 13, rowNumber: 38, label: "Deal-risk persona matches recommendation", status: dealRiskAligned ? "OK" : "REVIEW" },
    { id: 14, rowNumber: 39, label: "Deal-risk verdict is not RED", status: verdictToStatus(dealRisksView.dealRiskVerdict || "REVIEW") },
  ];

  const redCount = checks.filter((check) => check.status === "RED").length;
  const reviewCount = checks.filter((check) => check.status === "REVIEW").length;

  return {
    checks,
    redCount,
    reviewCount,
    text: redCount > 0 ? "NOT READY" : reviewCount > 0 ? "READY WITH REVIEW ITEMS" : "READY",
  };
}

export function buildP2pDashboardWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const scopeMetrics = deriveP2pScopeMetrics(workspace.scopeL3 || {});
  const workloadView = buildP2pWorkloadModel(workspace, currentDeal);
  const recommendView = buildP2pRecommendWorkbookView({ currentDeal, workspace });
  const inspectPersonaId = recommendView.recommendedPersona?.key || "standard";
  const pricingView = buildP2pPricingWorkbookView({ currentDeal, workspace, inspectPersonaId });
  const businessCaseView = buildP2pBusinessCaseWorkbookView({ currentDeal, workspace, inspectPersonaId });
  const riskView = buildP2pRiskWorkbookView({ currentDeal, workspace });
  const dealRisksView = buildP2pDealRisksWorkbookView({ currentDeal, workspace });
  const clientValueView = buildP2pClientValueWorkbookView({ currentDeal, workspace });
  const outcomeView = buildP2pOutcomeWorkbookView({ currentDeal, workspace, inspectPersonaId });

  const personaHeaders = recommendView.personaHeaders || pricingView.personaHeaders || [];
  const recommendMap = buildPersonaMetricMaps(recommendView.summaryRows || []);
  const pricingMap = buildPersonaMetricMaps(pricingView.summaryRows || []);
  const businessMap = buildPersonaMetricMaps(businessCaseView.termSummaryRows || []);
  const riskMap = buildPersonaMetricMaps(riskView.summaryRows || []);
  const recommendedPersonaKey = recommendView.recommendedPersona?.key || inspectPersonaId;
  const riskPersona = (riskView.personaVerdicts || []).find((persona) => persona.key === recommendedPersonaKey)
    || riskView.recommendedPersona
    || { key: recommendedPersonaKey, label: recommendView.recommendedPersona?.label || "Standard", verdict: "REVIEW", redCount: 0, amberCount: 0 };
  const businessSummary = businessCaseView.selectedPersona?.summary || {};

  const personaComparisonRows = [
    createPersonaSummaryRow({ key: "weightedFit", rowNumber: 12, label: "Weighted fit (0-100)", format: "score1", metricMap: recommendMap, metricKey: "weightedFit", personaHeaders }),
    createPersonaSummaryRow({ key: "redValidations", rowNumber: 13, label: "RED validations", format: "whole", metricMap: recommendMap, metricKey: "redValidations", personaHeaders }),
    createPersonaSummaryRow({ key: "adjustedScore", rowNumber: 14, label: "Adjusted score", format: "score1", metricMap: recommendMap, metricKey: "adjustedScore", personaHeaders }),
    createPersonaSummaryRow({ key: "rank", rowNumber: 15, label: "Rank", format: "whole", metricMap: recommendMap, metricKey: "rank", personaHeaders }),
    createPersonaSummaryRow({ key: "verdict", rowNumber: 16, label: "Risk verdict", format: "status", metricMap: riskMap, metricKey: "verdict", personaHeaders }),
    createPersonaSummaryRow({ key: "recommendedAnnualPrice", rowNumber: 17, label: "Annual price", format: "currency0", metricMap: pricingMap, metricKey: "recommendedAnnualPrice", personaHeaders }),
    createPersonaSummaryRow({ key: "grossMarginPct", rowNumber: 18, label: "Run-rate GM %", format: "percent1", metricMap: pricingMap, metricKey: "grossMarginPct", personaHeaders }),
    createPersonaSummaryRow({ key: "tcv", rowNumber: 19, label: "TCV", format: "currency0", metricMap: businessMap, metricKey: "tcv", personaHeaders }),
    createPersonaSummaryRow({ key: "npv", rowNumber: 20, label: "NPV", format: "currency0", metricMap: businessMap, metricKey: "npv", personaHeaders }),
    createPersonaSummaryRow({ key: "payback", rowNumber: 21, label: "Payback (year)", format: "status", metricMap: businessMap, metricKey: "payback", personaHeaders }),
  ];

  const logicSummary = buildLogicChecks({
    currentDeal,
    recommendView,
    riskPersona,
    riskView,
    dealRisksView,
    discoveryMetrics,
    scopeMetrics,
    workloadView,
    outcomeView,
    businessCaseView,
    clientValueView,
  });

  const annualPrice = getPersonaMetricValue(pricingMap, "recommendedAnnualPrice", recommendedPersonaKey, 0);
  const costToServeY1 = getPersonaMetricValue(pricingMap, "costToServeY1", recommendedPersonaKey, 0);
  const runRateGmPct = getPersonaMetricValue(pricingMap, "grossMarginPct", recommendedPersonaKey, 0);
  const adjustedScore = getPersonaMetricValue(recommendMap, "adjustedScore", recommendedPersonaKey, 0);
  const payback = getPersonaMetricText(businessMap, "payback", recommendedPersonaKey, "-");

  const overviewFacts = [
    createMetricRow(6, "Client", currentDeal?.clientName || "-", "text"),
    createMetricRow(7, "Contract term", `${trimValue(currentDeal?.contractTerm) || "-"} years`, "text"),
    createMetricRow(8, "Revenue band", discoveryMetrics.revenueBand || "-", "status"),
    createMetricRow(9, "Competitive intensity", discoveryMetrics.effectiveDiscovery?.competitiveIntensity || "-", "status"),
    createMetricRow(10, "Digital maturity", discoveryMetrics.effectiveDiscovery?.digitalMaturity || "-", "status"),
    createMetricRow(11, "Sizing mode", discoveryMetrics.sizingMode || "-", "status"),
    createMetricRow(12, "Transformation urgency", discoveryMetrics.transformationUrgency || "-", "status"),
    createMetricRow(13, "Discovery fields filled", countFilledP2pDiscoveryFields(workspace.discovery || {}), "whole"),
  ];

  const assumptionRows = [
    createMetricRow(26, "Complexity band", riskView.complexityBand || "-", "status"),
    createMetricRow(27, "Discovery coverage", discoveryMetrics.coveragePct || 0, "percent1"),
    createMetricRow(28, "Weighted completeness", discoveryMetrics.weightedCompleteness || 0, "percent1"),
    createMetricRow(29, "L2 processes in scope", scopeMetrics.selectedL2Count || 0, "whole"),
    createMetricRow(30, "Monthly workload hours", workloadView.totalMonthlyHours || 0, "fte2"),
    createMetricRow(31, "Blind FTE", workloadView.blindFte || 0, "fte2"),
    createMetricRow(32, "Transferred share of client org", workloadView.impliedShare || 0, "percent1"),
    createMetricRow(33, "Outcome allocation mode", outcomeView.allocationMode || "-", "status"),
    createMetricRow(34, "Outcome reconciliation", outcomeView.reconciliationMessage || "-", "text"),
    createMetricRow(35, "Gainshare provider share", pricingView.controls?.gainshareProviderShare?.value || 0, "percent1"),
  ];

  const commercialTiles = [
    createMetricRow(36, "Annual price", annualPrice, "currency0"),
    createMetricRow(37, "Cost to serve Y1", costToServeY1, "currency0"),
    createMetricRow(38, "Run-rate GM %", runRateGmPct, "percent1"),
    createMetricRow(39, "TCV", businessSummary.tcv || 0, "currency0"),
    createMetricRow(40, "NPV", businessSummary.npv || 0, "currency0"),
    createMetricRow(41, "Payback", payback, "status"),
    createMetricRow(42, "Term savings", clientValueView.termSavings || 0, "currency0"),
    createMetricRow(43, "Term savings %", clientValueView.termSavingsPct || 0, "percent1"),
    createMetricRow(44, "Gainshare pool", clientValueView.totalGainsharePool || 0, "currency0"),
    createMetricRow(45, "Adjusted score", adjustedScore, "score1"),
  ];

  const readinessRows = [
    createMetricRow(48, "Current tower staff", parseNumericText(discoveryMetrics.effectiveDiscovery?.currentTowerStaff, 0), "fte2"),
    createMetricRow(49, "Client cost baseline", parseNumericText(discoveryMetrics.effectiveDiscovery?.currentTowerCostBaselineUsd, 0), "currency0"),
    createMetricRow(50, "P2P platform", discoveryMetrics.effectiveDiscovery?.p2pPlatform || "-", "text"),
    createMetricRow(51, "PO-backed spend share", parseNumericText(discoveryMetrics.effectiveDiscovery?.poBackedSpendShare, 0), "percent1"),
    createMetricRow(52, "Peak month factor", workloadView.peakMonthFactor || 0, "factor2"),
    createMetricRow(53, "Annual workload hours", workloadView.annualHours || 0, "whole"),
    createMetricRow(54, "Outcome allocation total", outcomeView.totals?.totalAllocationPct || 0, "percent1"),
    createMetricRow(55, "Outcome zero-volume issues", outcomeView.totals?.zeroVolumeIssueCount || 0, "whole"),
    createMetricRow(56, "Business case ACV", businessSummary.acv || 0, "currency0"),
    createMetricRow(57, "Business case avg GM %", businessSummary.avgGmPct || 0, "percent1"),
    createMetricRow(58, "Client value baseline", clientValueView.termBaseline || 0, "currency0"),
    createMetricRow(59, "Baseline source", clientValueView.usesCustomerBaseline ? "Customer baseline" : "Proxy baseline", "status"),
  ];

  return {
    ...P2P_DASHBOARD_SNAPSHOT,
    personaHeaders,
    recommendedPersona: recommendView.recommendedPersona || pricingView.selectedPersona,
    runnerUpPersona: recommendView.runnerUpPersona,
    overviewFacts,
    recommendation: {
      riskVerdict: riskPersona?.verdict || "REVIEW",
      dealRiskVerdict: dealRisksView.dealRiskVerdict || "REVIEW",
      rationale: recommendView.recommendationRationale,
      alignmentText: trimValue(dealRisksView.selectedPersona?.key) === recommendedPersonaKey ? "Aligned" : "Review alignment",
    },
    personaComparisonRows,
    assumptionRows,
    commercialTiles,
    readinessRows,
    logicChecks: logicSummary.checks,
    uploadReadiness: {
      text: logicSummary.text,
      redCount: logicSummary.redCount,
      reviewCount: logicSummary.reviewCount,
    },
    notes: {
      clientBaseline: clientValueView.baselineSourceMessage,
      guardrail: outcomeView.guardNote,
    },
  };
}
