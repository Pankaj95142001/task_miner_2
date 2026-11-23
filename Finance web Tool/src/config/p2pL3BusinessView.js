import { buildP2pAiBenefitWorkbookView } from "./p2pAiBenefit";
import { P2P_SCOPE_CLUSTERS, P2P_SCOPE_L2_BY_ID } from "./p2pCatalog";
import { buildP2pCostWorkbookView } from "./p2pCost";
import { buildP2pRecommendWorkbookView } from "./p2pRecommend";
import { deriveP2pScopeMetrics } from "./p2pScope";
import { buildP2pWorkloadModel } from "./p2pWorkload";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "./p2pWorkspace";

const WHOLE_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ONE_DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const TWO_DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const CURRENCY_ZERO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const DISPOSITION_ORDER = Object.freeze(["Transfer", "Transfer + retain", "Retain", "Review"]);
const LOCATION_ORDER = Object.freeze([
  "Follow model",
  "Retain onshore",
  "Nearshore first",
  "Offshore first",
]);

export const P2P_L3_BUSINESS_VIEW_SNAPSHOT = Object.freeze({
  sheetName: "P2P_29 L3 Business View",
  title: "29. L3 Business View — P2P cluster roll-up, L2 money map, L3 allocated hours, TOM split & lever map",
  note: "Business-facing lens on the P2P sizing model: scope, workload, cost lens, and lever visibility by cluster, L2 process, and L3 activity.",
  formulaCount: 0,
  sectionCount: 5,
});

export const P2P_L3_BUSINESS_VIEW_SECTIONS = Object.freeze([
  {
    id: "clusterRollup",
    code: "A",
    title: "Cluster roll-up",
    rowRange: "Portal section A",
    note: "Rolls the selected L2 processes into the P2P cluster lens with hours, cost view, and steady-state reduction.",
  },
  {
    id: "l2MoneyMap",
    code: "B",
    title: "L2 money map",
    rowRange: "Portal section B",
    note: "Shows the business impact per L2 process using the selected ops-model persona and the current workload model.",
  },
  {
    id: "l3AllocatedHours",
    code: "C",
    title: "L3 allocated hours",
    rowRange: "Portal section C",
    note: "Allocates each in-scope L2 monthly-hour total across the selected L3 activities using the live scope percentages.",
  },
  {
    id: "tomSplit",
    code: "D",
    title: "Target operating model split",
    rowRange: "Portal section D",
    note: "Summarizes the selected L3 workload by disposition and location intent.",
  },
  {
    id: "leverMap",
    code: "E",
    title: "Automation & AI lever map",
    rowRange: "Portal section E",
    note: "Highlights the dominant lever for each selected L2 process using the chosen persona's AI-benefit posture.",
  },
]);

function round(value, digits = 12) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Number(numeric.toFixed(digits));
}

function formatValue(value, formatter, fallback = "-") {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatter.format(numeric) : fallback;
}

export function formatP2pL3BusinessViewValue(value, format = "status") {
  if (format === "status") {
    const text = String(value ?? "").trim();
    return text || "-";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }

  switch (format) {
    case "whole":
      return formatValue(numeric, WHOLE_FORMATTER);
    case "number1":
      return formatValue(numeric, ONE_DECIMAL_FORMATTER);
    case "number2":
      return formatValue(numeric, TWO_DECIMAL_FORMATTER);
    case "currency0":
      return formatValue(numeric, CURRENCY_ZERO_FORMATTER);
    case "percent0":
      return `${(numeric * 100).toFixed(0)}%`;
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    default:
      return String(value ?? "-");
  }
}

function safeRatio(part, whole) {
  const numerator = Number(part);
  const denominator = Number(whole);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function clusterLabel(clusterCode) {
  return P2P_SCOPE_CLUSTERS.find((cluster) => cluster.code === clusterCode)?.label || clusterCode;
}

function normalizePersonaKey(value) {
  const text = String(value ?? "").trim();
  return text || "standard";
}

function buildLeverSummary(autoPct = 0, copilotPct = 0, agentPct = 0) {
  const candidates = [
    { key: "automation", label: "Automation", value: Number(autoPct) || 0 },
    { key: "copilot", label: "Copilot", value: Number(copilotPct) || 0 },
    { key: "agentic", label: "Agentic", value: Number(agentPct) || 0 },
  ];

  const dominant = candidates
    .slice()
    .sort((left, right) => right.value - left.value)[0];

  if (!dominant || dominant.value <= 0) {
    return { key: "none", label: "No lever", value: 0 };
  }

  return dominant;
}

function dispositionLabel(row) {
  if (row.disposition === "Retain") {
    return "Retain";
  }
  if (row.disposition === "Review") {
    return "Review";
  }
  return row.retainedToo === "Y" ? "Transfer + retain" : "Transfer";
}

function sortByOrder(rows, order, key) {
  const rank = Object.fromEntries(order.map((value, index) => [value, index]));
  return rows.slice().sort((left, right) => {
    const leftRank = rank[left[key]] ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank[right[key]] ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return String(left[key]).localeCompare(String(right[key]));
  });
}

export function buildP2pL3BusinessView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(
    workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace(),
  );
  const scopeMetrics = deriveP2pScopeMetrics(workspace.scopeL3);
  const workloadView = buildP2pWorkloadModel(workspace, currentDeal);
  const recommendView = buildP2pRecommendWorkbookView({ currentDeal, workspace });
  const aiView = buildP2pAiBenefitWorkbookView({ workspace, currentDeal });
  const costView = buildP2pCostWorkbookView({ workspace, currentDeal });

  const productiveHoursPerFteMonth = Number(workloadView.benchmarkModel?.productiveHoursPerFteMonth || 0);
  const selectedPersonaKey = normalizePersonaKey(costView.selectedPersona?.key || workspace?.opsModel?.selectedPersonaId);
  const selectedPersonaLabel = costView.selectedPersona?.label || "Standard";
  const recommendedPersonaKey = normalizePersonaKey(recommendView.recommendedPersona?.key);
  const recommendedPersonaLabel = recommendView.recommendedPersona?.label || "Standard";
  const selectedAiPersona = aiView.personas.find((persona) => persona.id === selectedPersonaKey)
    || aiView.personas.find((persona) => persona.id === recommendedPersonaKey)
    || aiView.personas[1]
    || aiView.personas[0];
  const blendedCostPerFteY1 = Number(costView.selectedPersona?.summary?.blendedCostPerFteY1 || 0);

  const aiProcessMap = Object.fromEntries((selectedAiPersona?.processRows || []).map((row) => [row.id, row]));
  const aiMatrixMap = Object.fromEntries((aiView.matrixRows || []).map((row) => [row.id, row]));
  const workloadProcessMap = Object.fromEntries((workloadView.processRows || []).map((row) => [row.id, row]));

  const l2MoneyRows = (workloadView.processRows || []).map((row) => {
    const aiProcess = aiProcessMap[row.id] || null;
    const matrixRow = aiMatrixMap[row.id] || null;
    const monthlyHours = Number(row.finalHours || 0);
    const deliveryFte = productiveHoursPerFteMonth > 0 ? monthlyHours / productiveHoursPerFteMonth : 0;
    const annualCostY1 = deliveryFte * blendedCostPerFteY1;
    const steadyReductionPct = Number(aiProcess?.steady || 0);
    const hoursRemovedPerMonth = monthlyHours * steadyReductionPct;
    const netRunHoursPerMonth = monthlyHours - hoursRemovedPerMonth;
    const autoPct = Number(aiProcess?.leAuto || 0);
    const copilotPct = Number(aiProcess?.leCopilot || 0);
    const agentPct = Number(aiProcess?.leAgent || 0);
    const dominantLever = buildLeverSummary(autoPct, copilotPct, agentPct);

    return {
      id: row.id,
      processNumber: row.number,
      processLabel: row.label,
      clusterCode: row.cluster,
      clusterLabel: clusterLabel(row.cluster),
      selected: Number(row.scopePct || 0) > 0,
      scopePct: Number(row.scopePct || 0),
      method: row.method,
      confidence: row.confidence,
      monthlyHours: round(monthlyHours),
      annualHours: round(monthlyHours * 12),
      deliveryFte: round(deliveryFte),
      annualCostY1: round(annualCostY1),
      retainedShare: Number(row.retainedShare || 0),
      transferredShare: 1 - Number(row.retainedShare || 0),
      steadyReductionPct: round(steadyReductionPct),
      hoursRemovedPerMonth: round(hoursRemovedPerMonth),
      netRunHoursPerMonth: round(netRunHoursPerMonth),
      autoPct: round(autoPct),
      copilotPct: round(copilotPct),
      agentPct: round(agentPct),
      dominantLever,
      gateCode: matrixRow?.gate?.value || "P",
      gateOpen: Number(matrixRow?.gateOk?.value || 0) === 1,
    };
  });

  const selectedL2MoneyRows = l2MoneyRows.filter((row) => row.selected);

  const clusterRows = P2P_SCOPE_CLUSTERS.map((cluster) => {
    const rows = selectedL2MoneyRows.filter((row) => row.clusterCode === cluster.code);
    const monthlyHours = rows.reduce((sum, row) => sum + row.monthlyHours, 0);
    const annualCostY1 = rows.reduce((sum, row) => sum + row.annualCostY1, 0);
    const hoursRemovedPerMonth = rows.reduce((sum, row) => sum + row.hoursRemovedPerMonth, 0);
    const deliveryFte = rows.reduce((sum, row) => sum + row.deliveryFte, 0);
    const autoHours = rows.reduce((sum, row) => sum + (row.monthlyHours * row.autoPct), 0);
    const copilotHours = rows.reduce((sum, row) => sum + (row.monthlyHours * row.copilotPct), 0);
    const agentHours = rows.reduce((sum, row) => sum + (row.monthlyHours * row.agentPct), 0);
    const dominantLever = buildLeverSummary(autoHours, copilotHours, agentHours);

    return {
      id: cluster.id,
      clusterCode: cluster.code,
      clusterLabel: cluster.label,
      selectedL2Count: rows.length,
      monthlyHours: round(monthlyHours),
      towerShare: round(safeRatio(monthlyHours, workloadView.totalMonthlyHours)),
      deliveryFte: round(deliveryFte),
      annualCostY1: round(annualCostY1),
      steadyReductionPct: round(safeRatio(hoursRemovedPerMonth, monthlyHours)),
      hoursRemovedPerMonth: round(hoursRemovedPerMonth),
      netRunHoursPerMonth: round(monthlyHours - hoursRemovedPerMonth),
      dominantLever,
    };
  }).filter((row) => row.selectedL2Count > 0 || row.monthlyHours > 0);

  const l3AllocatedRows = scopeMetrics.l3Rows
    .filter((row) => Number(row.finalPct || 0) > 0)
    .map((row) => {
      const parentProcess = workloadProcessMap[row.l2Id];
      const siblingRows = scopeMetrics.l3Rows.filter((candidate) => candidate.l2Id === row.l2Id && Number(candidate.finalPct || 0) > 0);
      const siblingScopeTotal = siblingRows.reduce((sum, candidate) => sum + Number(candidate.finalPct || 0), 0);
      const shareWithinL2 = safeRatio(row.finalPct, siblingScopeTotal);
      const allocatedHoursPerMonth = Number(parentProcess?.finalHours || 0) * shareWithinL2;
      const allocatedFte = productiveHoursPerFteMonth > 0 ? allocatedHoursPerMonth / productiveHoursPerFteMonth : 0;
      const aiProcess = aiProcessMap[row.l2Id] || null;
      const steadyReductionPct = Number(aiProcess?.steady || 0);
      const hoursRemovedPerMonth = allocatedHoursPerMonth * steadyReductionPct;

      return {
        id: row.id,
        rowNumber: row.rowNumber,
        clusterCode: row.cluster,
        clusterLabel: clusterLabel(row.cluster),
        l2Id: row.l2Id,
        l2Label: P2P_SCOPE_L2_BY_ID[row.l2Id]?.label || row.l2Id,
        l2Number: row.l2Number,
        l3Label: row.label,
        scopePct: Number(row.finalPct || 0),
        shareWithinL2: round(shareWithinL2),
        allocatedHoursPerMonth: round(allocatedHoursPerMonth),
        allocatedAnnualHours: round(allocatedHoursPerMonth * 12),
        allocatedFte: round(allocatedFte),
        disposition: row.disposition,
        dispositionLabel: dispositionLabel(row),
        retainedToo: row.retainedToo,
        locationIntent: row.locationIntent,
        hoursRemovedPerMonth: round(hoursRemovedPerMonth),
        netRunHoursPerMonth: round(allocatedHoursPerMonth - hoursRemovedPerMonth),
      };
    });

  const tomSplitRows = sortByOrder(DISPOSITION_ORDER.map((label) => {
    const rows = l3AllocatedRows.filter((row) => row.dispositionLabel === label);
    const monthlyHours = rows.reduce((sum, row) => sum + row.allocatedHoursPerMonth, 0);
    return {
      label,
      activityCount: rows.length,
      monthlyHours: round(monthlyHours),
      sharePct: round(safeRatio(monthlyHours, workloadView.totalMonthlyHours)),
    };
  }).filter((row) => row.activityCount > 0 || row.monthlyHours > 0), DISPOSITION_ORDER, "label");

  const locationIntentRows = sortByOrder(LOCATION_ORDER.map((label) => {
    const rows = l3AllocatedRows.filter((row) => row.locationIntent === label);
    const monthlyHours = rows.reduce((sum, row) => sum + row.allocatedHoursPerMonth, 0);
    return {
      label,
      activityCount: rows.length,
      monthlyHours: round(monthlyHours),
      sharePct: round(safeRatio(monthlyHours, workloadView.totalMonthlyHours)),
    };
  }).filter((row) => row.activityCount > 0 || row.monthlyHours > 0), LOCATION_ORDER, "label");

  const leverMapRows = selectedL2MoneyRows
    .map((row) => ({
      ...row,
      processDisplay: `${row.processNumber}. ${row.processLabel}`,
    }))
    .sort((left, right) => right.hoursRemovedPerMonth - left.hoursRemovedPerMonth);

  return {
    ...P2P_L3_BUSINESS_VIEW_SNAPSHOT,
    sections: P2P_L3_BUSINESS_VIEW_SECTIONS,
    selectedPersonaKey,
    selectedPersonaLabel,
    recommendedPersonaKey,
    recommendedPersonaLabel,
    selectedPersonaMatchesRecommend: selectedPersonaKey === recommendedPersonaKey,
    totalMonthlyHours: round(workloadView.totalMonthlyHours || 0),
    totalAnnualHours: round((workloadView.totalMonthlyHours || 0) * 12),
    deliveryFte: round(productiveHoursPerFteMonth > 0 ? (workloadView.totalMonthlyHours || 0) / productiveHoursPerFteMonth : 0),
    annualCostY1: round((productiveHoursPerFteMonth > 0 ? (workloadView.totalMonthlyHours || 0) / productiveHoursPerFteMonth : 0) * blendedCostPerFteY1),
    steadyReductionPct: round(Number(selectedAiPersona?.summary?.weightedNetReductionSteady || 0)),
    hoursRemovedPerMonthSteady: round(Number(selectedAiPersona?.summary?.hoursRemovedPerMonthSteady || 0)),
    netRunHoursPerMonth: round((workloadView.totalMonthlyHours || 0) - Number(selectedAiPersona?.summary?.hoursRemovedPerMonthSteady || 0)),
    selectedL2Count: selectedL2MoneyRows.length,
    selectedL3Count: l3AllocatedRows.length,
    clusterRows,
    l2MoneyRows,
    selectedL2MoneyRows,
    l3AllocatedRows,
    tomSplitRows,
    locationIntentRows,
    leverMapRows,
    gateNarrative: aiView.gateDrivers?.gateNarrative || "",
    recommendedPersonaRationale: recommendView.recommendationRationale || "",
  };
}

