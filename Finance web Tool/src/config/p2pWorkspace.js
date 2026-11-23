import {
  createDefaultP2pBenchmarkSettings,
  countTouchedP2pBenchmarkSettings,
  normalizeP2pBenchmarkSettings,
} from "./p2pBenchmarks";
import {
  buildP2pDiscoveryWorkbookInputs,
  countAnsweredP2pDiscoveryCoverage,
  countAnsweredP2pPainPoints,
  countFilledP2pDiscoveryFields,
  createDefaultP2pDiscovery,
  createDefaultP2pDiscoveryCoverage,
  createDefaultP2pDiscoveryPainPoints,
  normalizeP2pDiscoveryCoverage,
  normalizeP2pDiscoveryFields,
  normalizeP2pDiscoveryPainPoints,
} from "./p2pDiscovery";
import {
  buildP2pScopeWorkbookInputs,
  countChangedP2pScopeRows,
  deriveP2pScopeMetrics,
  createDefaultP2pScopeRows,
  normalizeP2pScopeRows,
} from "./p2pScope";
import {
  buildP2pWorkloadWorkbookInputs,
  countTouchedP2pWorkloadInputs,
  createDefaultP2pWorkload,
  normalizeP2pWorkload,
} from "./p2pWorkload";
export const P2P_TABS = [
  {
    id: "p2p-00-cover",
    sheetName: "P2P_00 Cover",
    sidebarLabel: "00 Cover",
    title: "Cover",
    kind: "summary",
    formulaCount: 0,
    description: "Workbook cover, usage guide, and tower framing preserved from the Excel model.",
  },
  {
    id: "p2p-00-logic",
    sheetName: "P2P_00 Logic",
    sidebarLabel: "00 Logic",
    title: "Logic",
    kind: "reference",
    formulaCount: 0,
    description: "Sizing logic, assumptions, and workbook mechanics for the P2P tower.",
  },
  {
    id: "p2p-00-dict",
    sheetName: "P2P_00 Dict",
    sidebarLabel: "00 Dict",
    title: "Data Dictionary",
    kind: "reference",
    formulaCount: 0,
    description: "Input, output, and evidence definitions for P2P workbook fields.",
  },
  {
    id: "p2p-01-deal-setup",
    sheetName: "P2P_01 Deal Setup",
    sidebarLabel: "01 Deal Setup",
    title: "Deal Setup",
    kind: "input",
    formulaCount: 0,
    description: "Deal-level context inherited from the shared Deal Master and P2P assumptions.",
  },
  {
    id: "p2p-02-discovery",
    sheetName: "P2P_02 Discovery",
    sidebarLabel: "02 Discovery",
    title: "Discovery",
    kind: "input",
    formulaCount: 0,
    description: "Source-to-pay discovery drivers used to establish P2P volumes, coverage, and fit.",
  },
  {
    id: "p2p-03-scope-l3",
    sheetName: "P2P_03 Scope L3",
    sidebarLabel: "03 Scope L2",
    title: "Scope L3",
    kind: "input",
    formulaCount: 0,
    description: "Scope switchboard for included P2P process lines and ownership dispositions.",
  },
  {
    id: "p2p-04-benchmarks",
    sheetName: "P2P_04 Benchmarks",
    sidebarLabel: "04 Benchmarks",
    title: "Benchmarks",
    kind: "engine",
    formulaCount: 0,
    description: "Reference benchmark layer used by workload and effort calculations.",
  },
  {
    id: "p2p-05-workload",
    sheetName: "P2P_05 Workload",
    sidebarLabel: "05 Workload",
    title: "Workload",
    kind: "engine",
    formulaCount: 0,
    description: "Workload build-up translating process drivers into annual demand and effort.",
  },
  {
    id: "p2p-06-complexity",
    sheetName: "P2P_06 Complexity",
    sidebarLabel: "06 Complexity",
    title: "Complexity",
    kind: "engine",
    formulaCount: 0,
    description: "Complexity scoring and overlays that shape the final P2P sizing pattern.",
  },
  {
    id: "p2p-07-personas",
    sheetName: "P2P_07 Personas",
    sidebarLabel: "07 Personas",
    title: "Personas",
    kind: "engine",
    formulaCount: 0,
    description: "Delivery persona definitions used by the P2P operating model and banding logic.",
  },
  {
    id: "p2p-08-ai-benefit",
    sheetName: "P2P_08 AI Benefit",
    sidebarLabel: "08 AI Benefit",
    title: "AI Benefit",
    kind: "engine",
    formulaCount: 0,
    description: "Automation and AI levers that adjust addressable effort and future-state FTE.",
  },
  {
    id: "p2p-09-ops-model",
    sheetName: "P2P_09 Ops Model",
    sidebarLabel: "09 Ops Model",
    title: "Ops Model",
    kind: "engine",
    formulaCount: 0,
    description: "Location mix, delivery model, retained organization, and utilization assumptions.",
  },
  {
    id: "p2p-10-rate-card",
    sheetName: "P2P_10 Rate Card",
    sidebarLabel: "10 Rate Card",
    title: "Rate Card",
    kind: "engine",
    formulaCount: 0,
    description: "Blended rate structure supporting P2P cost and pricing outputs.",
  },
  {
    id: "p2p-11-fte-engine",
    sheetName: "P2P_11 FTE Engine",
    sidebarLabel: "11 FTE Engine",
    title: "FTE Engine",
    kind: "engine",
    formulaCount: 0,
    description: "Hours-to-FTE and productivity engine for steady-state P2P staffing.",
  },
  {
    id: "p2p-12-cost",
    sheetName: "P2P_12 Cost",
    sidebarLabel: "12 Cost",
    title: "Cost",
    kind: "engine",
    formulaCount: 0,
    description: "Cost-to-serve outputs across run, transition, and transformation layers.",
  },
  {
    id: "p2p-13-pricing",
    sheetName: "P2P_13 Pricing",
    sidebarLabel: "13 Pricing",
    title: "Pricing",
    kind: "engine",
    formulaCount: 0,
    description: "Pricing recommendation, margin thresholds, and commercial construct outputs.",
  },
  {
    id: "p2p-30-scpl",
    sheetName: "P2P_30 SCPL",
    sidebarLabel: "30 SCPL",
    title: "SCPL",
    kind: "engine",
    formulaCount: 0,
    description: "SCPL workbook section for the P2P tower.",
  },

  {
    id: "p2p-14-outcome",
    sheetName: "P2P_14 Outcome",
    sidebarLabel: "14 Outcome",
    title: "Outcome",
    kind: "engine",
    formulaCount: 0,
    description: "Outcome metrics and operational benefit summary for the P2P tower.",
  },
  {
    id: "p2p-15-transition",
    sheetName: "P2P_15 Transition",
    sidebarLabel: "15 Transition",
    title: "Transition",
    kind: "engine",
    formulaCount: 0,
    description: "Transition assumptions, ramp profile, and one-time enablement costs.",
  },
  {
    id: "p2p-16-business-case",
    sheetName: "P2P_16 Business Case",
    sidebarLabel: "16 Business Case",
    title: "Business Case",
    kind: "engine",
    formulaCount: 0,
    description: "Business case outputs covering multi-year economics and savings view.",
  },
  {
    id: "p2p-17-sensitivity",
    sheetName: "P2P_17 Sensitivity",
    sidebarLabel: "17 Sensitivity",
    title: "Sensitivity",
    kind: "engine",
    formulaCount: 0,
    description: "Sensitivity scenarios for the main P2P commercial assumptions.",
  },
  {
    id: "p2p-18-risk",
    sheetName: "P2P_18 Risk",
    sidebarLabel: "18 Risk",
    title: "Risk",
    kind: "engine",
    formulaCount: 0,
    description: "Risk overlays and mitigation scoring for the P2P solution model.",
  },
  {
    id: "p2p-19-deal-risks",
    sheetName: "P2P_19 Deal Risks",
    sidebarLabel: "19 Deal Risks",
    title: "Deal Risks",
    kind: "engine",
    formulaCount: 0,
    description: "Deal-level risk register and commercial red-flag consolidation.",
  },
  {
    id: "p2p-20-recommend",
    sheetName: "P2P_20 Recommend",
    sidebarLabel: "20 Recommend",
    title: "Recommend",
    kind: "output",
    formulaCount: 0,
    description: "Recommendation summary and decision support outputs for P2P.",
  },
  {
    id: "p2p-21-client-value",
    sheetName: "P2P_21 Client Value",
    sidebarLabel: "21 Client Value",
    title: "Client Value",
    kind: "output",
    formulaCount: 0,
    description: "Client-facing value, savings, and impact narrative.",
  },
  {
    id: "p2p-22-dashboard",
    sheetName: "P2P_22 Dashboard",
    sidebarLabel: "22 Dashboard",
    title: "Dashboard",
    kind: "output",
    formulaCount: 0,
    description: "Dashboard and cockpit-ready outputs for the P2P tower.",
  },
  {
    id: "p2p-23-trace-log",
    sheetName: "P2P_23 Trace Log",
    sidebarLabel: "23 Trace Log",
    title: "Trace Log",
    kind: "output",
    formulaCount: 0,
    description: "Traceability between outputs, calculations, and source assumptions.",
  },
  {
    id: "p2p-24-governance",
    sheetName: "P2P_24 Governance",
    sidebarLabel: "24 Governance",
    title: "Governance",
    kind: "governance",
    formulaCount: 0,
    description: "Governance controls, approvals, and review checkpoints.",
  },
  {
    id: "p2p-25-confidence",
    sheetName: "P2P_25 Confidence",
    sidebarLabel: "25 Confidence",
    title: "Confidence",
    kind: "governance",
    formulaCount: 0,
    description: "Confidence and evidence-strength scoring for the P2P model.",
  },
  {
    id: "p2p-26-calibration",
    sheetName: "P2P_26 Calibration",
    sidebarLabel: "26 Calibration",
    title: "Calibration",
    kind: "governance",
    formulaCount: 0,
    description: "Calibration checks against reference norms and historical deals.",
  },
  {
    id: "p2p-27-benchmark-pack",
    sheetName: "P2P_27 Benchmark Pack",
    sidebarLabel: "27 Benchmark Pack",
    title: "Benchmark Pack",
    kind: "governance",
    formulaCount: 0,
    description: "Benchmark backup pack for evidence, corroboration, and auditability.",
  },
  {
    id: "p2p-28-change-log",
    sheetName: "P2P_28 Change Log",
    sidebarLabel: "28 Change Log",
    title: "Change Log",
    kind: "governance",
    formulaCount: 0,
    description: "Controlled log of workbook changes and commercial decisions.",
  },
  {
    id: "p2p-29-l3-business-view",
    sheetName: "P2P_29 L3 Business View",
    sidebarLabel: "29 L3 Business View",
    title: "L3 Business View",
    kind: "output",
    formulaCount: 0,
    description: "Business view of process-level scope, outputs, and lever visibility.",
  },
];

export const P2P_TOTAL_FORMULAS = P2P_TABS.reduce((total, tab) => total + tab.formulaCount, 0);
export const P2P_APPROVAL_STAGE_OPTIONS = [
  "Working",
  "Tower Lead Review",
  "Finance Review",
  "Solution Review",
  "Submission Ready",
];
export const P2P_LOCAL_TAB_IDS = new Set(["p2p-02-discovery", "p2p-03-scope-l3", "p2p-04-benchmarks", "p2p-05-workload", "p2p-06-complexity", "p2p-07-personas", "p2p-08-ai-benefit", "p2p-09-ops-model", "p2p-10-rate-card", "p2p-11-fte-engine", "p2p-12-cost", "p2p-13-pricing", "p2p-14-outcome", "p2p-15-transition", "p2p-16-business-case", "p2p-17-sensitivity", "p2p-18-risk", "p2p-19-deal-risks", "p2p-20-recommend", "p2p-21-client-value", "p2p-22-dashboard", "p2p-23-trace-log", "p2p-24-governance", "p2p-25-confidence", "p2p-26-calibration", "p2p-27-benchmark-pack", "p2p-28-change-log", "p2p-29-l3-business-view"]);

const DEFAULT_GOVERNANCE = {
  approvalStage: "Working",
  evidenceCoveragePct: "55",
  benchmarkCorroborationPct: "50",
  overrideCount: "0",
  qaReviewComplete: false,
  financeLeadershipReview: false,
  clientEvidenceValidated: false,
  benchmarkPackReady: false,
  calibrationComplete: false,
  changeNote: "",
};

const DEFAULT_P2P_WORKSPACE = Object.freeze({
  status: "Not Started",
  notes: "",
});

function countFilledRecordValues(record = {}) {
  if (!record || typeof record !== "object") {
    return 0;
  }

  return Object.values(record).filter((value) => {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === "boolean") {
      return value;
    }

    return String(value).trim() !== "";
  }).length;
}

export function createDefaultP2pWorkspace() {
  return {
    ...DEFAULT_P2P_WORKSPACE,
    discovery: createDefaultP2pDiscovery(),
    discoveryCoverage: createDefaultP2pDiscoveryCoverage(),
    discoveryPainPoints: createDefaultP2pDiscoveryPainPoints(),
    scopeL3: createDefaultP2pScopeRows(),
    benchmarks: createDefaultP2pBenchmarkSettings(),
    workload: createDefaultP2pWorkload(),
    governance: { ...DEFAULT_GOVERNANCE },
  };
}

export function normalizeP2pWorkspace(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  const defaults = createDefaultP2pWorkspace();
  return {
    ...defaults,
    ...incoming,
    status: trimString(incoming.status, defaults.status),
    notes: typeof incoming.notes === "string" ? incoming.notes : defaults.notes,
    discovery: normalizeP2pDiscoveryFields(incoming.discovery),
    discoveryCoverage: normalizeP2pDiscoveryCoverage(incoming.discoveryCoverage),
    discoveryPainPoints: normalizeP2pDiscoveryPainPoints(incoming.discoveryPainPoints),
    scopeL3: normalizeP2pScopeRows(incoming.scopeL3),
    benchmarks: normalizeP2pBenchmarkSettings(incoming.benchmarks),
    workload: normalizeP2pWorkload(incoming.workload),
    governance: {
      ...DEFAULT_GOVERNANCE,
      ...(incoming.governance && typeof incoming.governance === "object" ? incoming.governance : {}),
    },
  };
}

function trimString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function countTouchedP2pGovernanceFields(value = {}) {
  const governance = {
    ...DEFAULT_GOVERNANCE,
    ...(value && typeof value === "object" ? value : {}),
  };

  let touched = 0;

  if (trimString(governance.approvalStage, DEFAULT_GOVERNANCE.approvalStage) !== DEFAULT_GOVERNANCE.approvalStage) touched += 1;
  if (trimString(governance.evidenceCoveragePct, DEFAULT_GOVERNANCE.evidenceCoveragePct) !== DEFAULT_GOVERNANCE.evidenceCoveragePct) touched += 1;
  if (trimString(governance.benchmarkCorroborationPct, DEFAULT_GOVERNANCE.benchmarkCorroborationPct) !== DEFAULT_GOVERNANCE.benchmarkCorroborationPct) touched += 1;
  if (trimString(governance.overrideCount, DEFAULT_GOVERNANCE.overrideCount) !== DEFAULT_GOVERNANCE.overrideCount) touched += 1;
  if (Boolean(governance.qaReviewComplete)) touched += 1;
  if (Boolean(governance.financeLeadershipReview)) touched += 1;
  if (Boolean(governance.clientEvidenceValidated)) touched += 1;
  if (Boolean(governance.benchmarkPackReady)) touched += 1;
  if (Boolean(governance.calibrationComplete)) touched += 1;
  if (trimString(governance.changeNote, "")) touched += 1;

  return touched;
}

export function countCompletedP2pGovernanceChecks(workspaceValue = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue);
  const governance = workspace.governance || DEFAULT_GOVERNANCE;

  return [
    governance.qaReviewComplete,
    governance.financeLeadershipReview,
    governance.clientEvidenceValidated,
    governance.benchmarkPackReady,
    governance.calibrationComplete,
  ].filter(Boolean).length;
}

export function countPopulatedP2pSheets(workbookInputs = {}) {
  if (!workbookInputs || typeof workbookInputs !== "object") {
    return 0;
  }

  return Object.values(workbookInputs).filter((sheetInputs) => countFilledRecordValues(sheetInputs) > 0).length;
}

export function countPopulatedP2pWorkbookCells(workbookInputs = {}) {
  if (!workbookInputs || typeof workbookInputs !== "object") {
    return 0;
  }

  return Object.values(workbookInputs).reduce((total, sheetInputs) => total + countFilledRecordValues(sheetInputs), 0);
}

export function countTouchedP2pChangeLogFields(value = {}) {
  const changeLog = {
    ...DEFAULT_CHANGE_LOG,
    ...(value && typeof value === "object" ? value : {}),
  };

  return countFilledRecordValues(changeLog);
}

export function countPopulatedP2pLocalFields(workspaceValue = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue);
  const scopeMetrics = deriveP2pScopeMetrics(workspace.scopeL3);

  return countFilledP2pDiscoveryFields(workspace.discovery)
    + countAnsweredP2pDiscoveryCoverage(workspace.discoveryCoverage)
    + countAnsweredP2pPainPoints(workspace.discoveryPainPoints)
    + countChangedP2pScopeRows(workspace.scopeL3)
    + countTouchedP2pBenchmarkSettings(workspace.benchmarks)
    + countTouchedP2pWorkloadInputs(workspace.workload)
    + countTouchedP2pGovernanceFields(workspace.governance)
    + (scopeMetrics.selectedL2Count > 0 ? 1 : 0);
}

export function syncP2pWorkbookInputsFromWorkspace(workspaceValue = {}, existingWorkbookInputs = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue);

  return {
    ...(existingWorkbookInputs && typeof existingWorkbookInputs === "object" ? existingWorkbookInputs : {}),
    "P2P_02 Discovery": buildP2pDiscoveryWorkbookInputs(workspace),
    "P2P_03 Scope L3": buildP2pScopeWorkbookInputs(workspace.scopeL3),
    "P2P_05 Workload": {
      ...((existingWorkbookInputs && existingWorkbookInputs["P2P_05 Workload"] && typeof existingWorkbookInputs["P2P_05 Workload"] === "object") ? existingWorkbookInputs["P2P_05 Workload"] : {}),
      ...buildP2pWorkloadWorkbookInputs(workspace.workload),
    },
  };
}

export function deriveP2pWorkspaceStatus(workspaceValue = {}, workbookInputs = {}) {
  const normalized = normalizeP2pWorkspace(workspaceValue);
  const populatedSheets = countPopulatedP2pSheets(workbookInputs);
  const discoveryCount = countFilledP2pDiscoveryFields(normalized.discovery);
  const coverageCount = countAnsweredP2pDiscoveryCoverage(normalized.discoveryCoverage);
  const painCount = countAnsweredP2pPainPoints(normalized.discoveryPainPoints);
  const scopeMetrics = deriveP2pScopeMetrics(normalized.scopeL3);
  const benchmarkTouches = countTouchedP2pBenchmarkSettings(normalized.benchmarks);
  const workloadTouches = countTouchedP2pWorkloadInputs(normalized.workload);
  const governanceTouches = countTouchedP2pGovernanceFields(normalized.governance);
  const hasNotes = Boolean(String(normalized.notes || "").trim());

  if (!discoveryCount && !coverageCount && !painCount && !benchmarkTouches && !workloadTouches && !governanceTouches && !hasNotes && !populatedSheets) {
    return "Not Started";
  }

  if (discoveryCount >= 10 && coverageCount >= 5 && scopeMetrics.selectedL2Count > 0) {
    return "Ready for Engine";
  }

  return "In Progress";
}

















