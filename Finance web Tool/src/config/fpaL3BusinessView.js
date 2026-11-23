import {
  buildFpaAiBenefitWorkbookView,
  FPA_AI_BENEFIT_MATRIX_ROWS,
  FPA_AI_BENEFIT_SNAPSHOT,
} from "./fpaAiBenefit";
import { buildFpaFteEngineWorkbookView } from "./fpaFteEngine";
import { buildFpaRecommendWorkbookView } from "./fpaRecommend";
import {
  deriveFpaScopeMetrics,
  FPA_SCOPE_L2_ROWS,
} from "./fpaScope";
import { buildFpaWorkloadWorkbookView } from "./fpaWorkload";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const WHOLE_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_ONE_FORMATTER = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DECIMAL_TWO_FORMATTER = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PERCENT_ZERO_FORMATTER = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PERCENT_ONE_FORMATTER = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const FPA_L3_BUSINESS_VIEW_SNAPSHOT = Object.freeze({
  sheetName: "FPA_29 L3 Business View",
  title: "29. L3 Business View — FP&A cluster roll-up, L2 money map, L3 allocated hours, TOM split & lever map",
  note: "Business-facing lens on the sizing: where the hours are, where automation removes them, and how scope splits between transferred and retained work (recommended persona).",
  formulaCount: 557,
  sectionCount: 5,
});

export const FPA_L3_BUSINESS_VIEW_SECTIONS = Object.freeze([
  {
    id: "clusterRollup",
    code: "A",
    title: "Cluster Roll-up",
    rowRange: "Rows 6-12",
    note: "Cluster-level roll-up of monthly workload, tower share, recommended FTE, steady-state hours removed, and pod-floor status.",
  },
  {
    id: "l2MoneyMap",
    code: "B",
    title: "L2 Money Map",
    rowRange: "Rows 15-29",
    note: "Recommended-persona view of workload, net reduction, hours removed, delivery FTE, dominant lever, and sizing method by L2 process.",
  },
  {
    id: "l3AllocatedHours",
    code: "C",
    title: "L3 Allocated Hours",
    rowRange: "Rows 32-86",
    note: "Tab 05 final hours are allocated across the in-scope L3 activities using the exact Scope L3 final-% weighting from the workbook.",
  },
  {
    id: "tomSplit",
    code: "D",
    title: "Target-Operating-Model Split",
    rowRange: "Rows 89-95",
    note: "Disposition mix of the L3 allocation, shown as hours, share of tower, and activity count.",
  },
  {
    id: "leverMap",
    code: "E",
    title: "Automation & AI Lever Map",
    rowRange: "Rows 98-104",
    note: "Recommended-persona lever view that aggregates workbook workload hours against the exact Auto, Copilot, and Agent reduction columns.",
  },
]);

const CLUSTER_META = Object.freeze({
  "P&F": { description: "Planning & Forecasting", floor: 2, floorLabel: "2 (hard)", floorType: "hard" },
  "R&A": { description: "Reporting & Analytics", floor: 2, floorLabel: "2 (hard)", floorType: "hard" },
  "BP&DS": { description: "Business Partnering & Decision Support", floor: 0.5, floorLabel: "0.5 (advisory)", floorType: "advisory" },
  "D&G": { description: "Data & Governance", floor: 0.5, floorLabel: "0.5 (advisory)", floorType: "advisory" },
});

const DISPOSITION_ORDER = Object.freeze(["Retain", "Transfer", "Centralise", "Automate", "Eliminate"]);

const LEVER_ROW_DEFS = Object.freeze([
  {
    id: "driverBasedPlanning",
    label: "Driver-based planning",
    type: "Automation",
    linkedProcesses: "BUD; RF; REV; WFP",
    leverKey: "leAuto",
    lifeCycle: "Quick-win (Y1)",
    processIds: ["budgetingPlanning", "rollingForecastingIbp", "commercialForecasting", "workforceCapacityPlanning"],
  },
  {
    id: "selfServiceBi",
    label: "Self-service BI & report rationalisation",
    type: "Automation",
    linkedProcesses: "COST; VAR; MR",
    leverKey: "leAuto",
    lifeCycle: "Quick-win (Y1)",
    processIds: ["costProductivityMarginManagement", "variancePerformanceManagement", "managementReportingDecisionSupport"],
  },
  {
    id: "genAiNarratives",
    label: "GenAI variance & commentary narratives",
    type: "Copilot / GenAI",
    linkedProcesses: "VAR; MR; LRP",
    leverKey: "leCopilot",
    lifeCycle: "Quick-win → scale (Y1-Y2)",
    processIds: ["variancePerformanceManagement", "managementReportingDecisionSupport", "strategicLongRangePlanning"],
  },
  {
    id: "scenarioForecastCopilots",
    label: "Scenario & forecasting copilots",
    type: "Copilot / GenAI",
    linkedProcesses: "RF; REV; SCN; PROF",
    leverKey: "leCopilot",
    lifeCycle: "Quick-win → scale (Y1-Y2)",
    processIds: ["rollingForecastingIbp", "commercialForecasting", "scenarioRiskModeling", "profitabilityPricingBusinessCases"],
  },
  {
    id: "agenticDataStewardship",
    label: "Agentic data stewardship & reconciliation",
    type: "Autonomous agent",
    linkedProcesses: "GOV; MR; CASH",
    leverKey: "leAgent",
    lifeCycle: "Structural (Y2+)",
    processIds: ["governanceMasterDataBusinessPartnering", "managementReportingDecisionSupport", "cashFlowCapitalPlanning"],
  },
]);

const WORKLOAD_ROW_BY_L2_ID = Object.freeze(
  Object.fromEntries(FPA_AI_BENEFIT_MATRIX_ROWS.map((row) => [row.id, row.workloadRow])),
);

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

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value).replace(/,/gu, "").replace(/\$/gu, "");
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

function getCellText(addressMap, address, fallback = "") {
  const cell = addressMap[address];
  const rawValue = cell?.text ?? cell?.raw ?? cell?.value;
  const normalized = trimValue(rawValue);
  return normalized || fallback;
}

function findPersonaValue(values = [], personaKey, fallback = 0) {
  const cell = values.find((item) => item.key === personaKey);
  const numeric = Number(cell?.value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function rankDescending(values = [], currentValue) {
  return values.filter((value) => value > currentValue + 1e-9).length + 1;
}

function dominantLeverLabel(processRow) {
  const autoValue = Number(processRow?.leAuto || 0);
  const copilotValue = Number(processRow?.leCopilot || 0);
  const agentValue = Number(processRow?.leAgent || 0);
  const maxValue = Math.max(autoValue, copilotValue, agentValue);

  if (maxValue <= 0) {
    return "—";
  }

  if (autoValue >= Math.max(copilotValue, agentValue)) {
    return "AUTO";
  }

  if (copilotValue >= agentValue) {
    return "COPILOT";
  }

  return "AGENT";
}

function floorStatusLabel(fteValue, floorValue, floorType) {
  if (fteValue < floorValue) {
    return floorType === "hard" ? "RED" : "AMBER";
  }

  return "OK";
}

function formatSmartPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  const percentage = numeric * 100;
  const roundedWhole = Math.round(percentage);
  if (Math.abs(percentage - roundedWhole) < 0.01) {
    return `${roundedWhole}%`;
  }

  return `${percentage.toFixed(1)}%`;
}

export function formatL3BusinessViewValue(value, format = "text") {
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
    case "whole":
      return WHOLE_FORMATTER.format(numeric);
    case "decimal1":
      return DECIMAL_ONE_FORMATTER.format(numeric);
    case "decimal2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "fte2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "percent0":
      return PERCENT_ZERO_FORMATTER.format(numeric);
    case "percent1":
      return PERCENT_ONE_FORMATTER.format(numeric);
    case "scopePercent":
      return formatSmartPercent(numeric);
    default:
      return String(value);
  }
}

export function buildFpaL3BusinessViewWorkbookView({
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
  const personaInputs = workbookInputs["FPA_07 Personas"] && typeof workbookInputs["FPA_07 Personas"] === "object"
    ? workbookInputs["FPA_07 Personas"]
    : EMPTY_INPUTS;
  const aiWorkbookInputs = workbookInputs[FPA_AI_BENEFIT_SNAPSHOT.sheetName] && typeof workbookInputs[FPA_AI_BENEFIT_SNAPSHOT.sheetName] === "object"
    ? workbookInputs[FPA_AI_BENEFIT_SNAPSHOT.sheetName]
    : EMPTY_INPUTS;

  const recommendView = buildFpaRecommendWorkbookView({ currentDeal, workspace });
  const workloadView = buildFpaWorkloadWorkbookView(workloadInputs, benchmarkInputs, workspace, currentDeal);
  const aiView = buildFpaAiBenefitWorkbookView({
    currentDeal,
    workspace,
    benchmarkInputs,
    workloadInputs,
    aiWorkbookInputs,
    personaInputs,
  });
  const fteView = buildFpaFteEngineWorkbookView({ currentDeal, workspace });
  const scopeMetrics = deriveFpaScopeMetrics(workspace.scopeL3, workspace.scopeL2);

  const workloadCellMap = createAddressMap(workloadView.rows);
  const recommendedPersona = recommendView.recommendedPersona || recommendView.personaHeaders?.[1] || recommendView.personaHeaders?.[0] || { key: "standard", label: "Standard", index: 2 };
  const recommendedPersonaKey = recommendedPersona.key || "standard";
  const recommendedAiPersona = aiView.personas.find((persona) => persona.id === recommendedPersonaKey) || aiView.personas[1] || aiView.personas[0];
  const recommendedFtePersona = fteView.personas.find((persona) => persona.key === recommendedPersonaKey) || fteView.personas[1] || fteView.personas[0];
  const aiProcessMap = Object.fromEntries((recommendedAiPersona?.processRows || []).map((row) => [row.id, row]));
  const fteProcessMap = Object.fromEntries((fteView.processRows || []).map((row) => [row.id, row]));
  const clusterFteMap = Object.fromEntries((fteView.clusterRows || []).map((row) => [row.key, findPersonaValue(row.values, recommendedPersonaKey, 0)]));


  const l2MoneyRowsBase = FPA_SCOPE_L2_ROWS.map((definition, index) => {
    const workloadRow = WORKLOAD_ROW_BY_L2_ID[definition.id];
    const aiProcess = aiProcessMap[definition.id] || null;
    const fteProcess = fteProcessMap[definition.id] || null;
    const monthlyHours = round(getCellNumber(workloadCellMap, `K${workloadRow}`, Number(aiProcess?.monthlyHours || 0)), 12);
    const netReduction = round(Number(aiProcess?.steady || 0), 12);
    const hoursRemoved = round(monthlyHours * netReduction, 12);
    const recommendedFte = round(findPersonaValue(fteProcess?.values, recommendedPersonaKey, 0), 12);
    const dominantLever = dominantLeverLabel(aiProcess);
    const methodLabel = getCellText(workloadCellMap, `F${workloadRow}`, "—");

    return {
      ...definition,
      rowNumber: 17 + index,
      workloadRow,
      monthlyHours,
      netReduction,
      hoursRemoved,
      recommendedFte,
      dominantLever,
      methodLabel,
    };
  });

  const removedHoursValues = l2MoneyRowsBase.map((row) => row.hoursRemoved);
  const l2MoneyRows = l2MoneyRowsBase.map((row) => ({
    ...row,
    rank: rankDescending(removedHoursValues, row.hoursRemoved),
  }));

  const l2MonthlyHoursById = Object.fromEntries(l2MoneyRows.map((row) => [row.id, row.monthlyHours]));
  const totalMonthlyHours = round(l2MoneyRows.reduce((sum, row) => sum + row.monthlyHours, 0), 12);
  const totalHoursRemoved = round(l2MoneyRows.reduce((sum, row) => sum + row.hoursRemoved, 0), 12);
  const totalRecommendedFte = round(l2MoneyRows.reduce((sum, row) => sum + row.recommendedFte, 0), 12);
  const totalNetReduction = totalMonthlyHours > 0 ? round(totalHoursRemoved / totalMonthlyHours, 12) : 0;

  const clusterRows = Object.entries(CLUSTER_META).map(([clusterKey, metadata], index) => {
    const clusterHours = round(l2MoneyRows.reduce((sum, row) => sum + (row.cluster === clusterKey ? row.monthlyHours : 0), 0), 12);
    const clusterPct = totalMonthlyHours > 0 ? round(clusterHours / totalMonthlyHours, 12) : 0;
    const clusterFte = round(clusterFteMap[clusterKey] || 0, 12);
    const clusterHoursRemoved = round(l2MoneyRows.reduce((sum, row) => sum + (row.cluster === clusterKey ? row.hoursRemoved : 0), 0), 12);

    return {
      rowNumber: 8 + index,
      cluster: clusterKey,
      description: metadata.description,
      hoursPerMonth: clusterHours,
      towerShare: clusterPct,
      recommendedFte: clusterFte,
      hoursRemoved: clusterHoursRemoved,
      podFloor: metadata.floorLabel,
      floorStatus: floorStatusLabel(clusterFte, metadata.floor, metadata.floorType),
    };
  });

  const clusterTotalRow = {
    rowNumber: 12,
    label: "TOTAL",
    hoursPerMonth: round(clusterRows.reduce((sum, row) => sum + row.hoursPerMonth, 0), 12),
    towerShare: totalMonthlyHours > 0 ? 1 : 0,
    recommendedFte: round(clusterRows.reduce((sum, row) => sum + row.recommendedFte, 0), 12),
    hoursRemoved: round(clusterRows.reduce((sum, row) => sum + row.hoursRemoved, 0), 12),
  };

  const l2MoneyTotalRow = {
    rowNumber: 29,
    label: "TOTAL",
    monthlyHours: totalMonthlyHours,
    netReduction: totalNetReduction,
    hoursRemoved: totalHoursRemoved,
    recommendedFte: totalRecommendedFte,
  };

  const l3ScopeTotalsByL2Id = Object.fromEntries(
    FPA_SCOPE_L2_ROWS.map((definition) => [
      definition.id,
      round(
        scopeMetrics.l3Rows.reduce((sum, row) => sum + (row.l2Id === definition.id ? Number(row.finalPct || 0) : 0), 0),
        12,
      ),
    ]),
  );

  const l3AllocatedRows = scopeMetrics.l3Rows.map((row, index) => {
    const denominator = Number(l3ScopeTotalsByL2Id[row.l2Id] || 0);
    const l2FinalHours = Number(l2MonthlyHoursById[row.l2Id] || 0);
    const allocatedHours = denominator > 0
      ? round((l2FinalHours * Number(row.finalPct || 0)) / denominator, 12)
      : 0;

    return {
      ...row,
      rowNumber: 34 + index,
      allocatedHours,
    };
  });

  const allocatedHoursTotal = round(l3AllocatedRows.reduce((sum, row) => sum + row.allocatedHours, 0), 12);
  const l2DrivenRowsWithoutL3Detail = scopeMetrics.l2RollupRows.filter((row) => row.basis === "L2" && row.scopePct > 0);
  const l3AllocatedTotalRow = {
    rowNumber: 86,
    label: "TOTAL (ties to 05 FINAL hours)",
    allocatedHours: allocatedHoursTotal,
    status: l2DrivenRowsWithoutL3Detail.length > 0
      ? `L2-driven scope only for ${l2DrivenRowsWithoutL3Detail.length} L2 row${l2DrivenRowsWithoutL3Detail.length === 1 ? "" : "s"}`
      : Math.abs(allocatedHoursTotal - totalMonthlyHours) < 0.5 ? "OK — ties to 05" : "CHECK — allocation gap",
  };

  const tomSplitRows = DISPOSITION_ORDER.map((disposition, index) => {
    const hoursPerMonth = round(
      l3AllocatedRows.reduce((sum, row) => sum + (row.disposition === disposition ? row.allocatedHours : 0), 0),
      12,
    );
    const towerShare = allocatedHoursTotal > 0 ? round(hoursPerMonth / allocatedHoursTotal, 12) : 0;

    return {
      rowNumber: 91 + index,
      disposition,
      hoursPerMonth,
      towerShare,
      activityCount: l3AllocatedRows.filter((row) => row.disposition === disposition).length,
    };
  });

  const productiveCapacity = Number(recommendedFtePersona?.productiveCapacity || 0);
  const leverRows = LEVER_ROW_DEFS.map((definition, index) => {
    const hoursRemoved = round(
      definition.processIds.reduce((sum, processId) => {
        const workloadHours = Number(l2MonthlyHoursById[processId] || 0);
        const process = aiProcessMap[processId] || {};
        const leverValue = Number(process[definition.leverKey] || 0);
        return sum + (workloadHours * leverValue);
      }, 0),
      12,
    );

    return {
      ...definition,
      rowNumber: 100 + index,
      hoursRemoved,
      fteEquivalent: productiveCapacity > 0 ? round(hoursRemoved / productiveCapacity, 12) : 0,
    };
  });

  const dominantDisposition = tomSplitRows.reduce(
    (best, row) => (row.hoursPerMonth > (best?.hoursPerMonth || 0) ? row : best),
    tomSplitRows[0] || null,
  );
  const leadingLever = leverRows.reduce(
    (best, row) => (row.hoursRemoved > (best?.hoursRemoved || 0) ? row : best),
    leverRows[0] || null,
  );

  return {
    ...FPA_L3_BUSINESS_VIEW_SNAPSHOT,
    sections: FPA_L3_BUSINESS_VIEW_SECTIONS,
    recommendedPersona: {
      key: recommendedPersonaKey,
      label: recommendedPersona.label || "Standard",
      index: recommendedPersona.index || recommendView.recommendedPersonaIndex || 0,
    },
    totalMonthlyHours,
    totalHoursRemoved,
    totalNetReduction,
    totalRecommendedFte,
    selectedL3Count: scopeMetrics.selectedL3Count,
    totalL3Count: scopeMetrics.l3Rows.length,
    dominantDisposition,
    leadingLever,
    clusterRows,
    clusterTotalRow,
    l2MoneyRows,
    l2MoneyTotalRow,
    l3AllocatedRows,
    l3AllocatedTotalRow,
    tomSplitRows,
    leverRows,
  };
}
