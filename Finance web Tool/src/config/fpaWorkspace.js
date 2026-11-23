import {
  FPA_DISCOVERY_OPTIONS,
  countFilledFpaDiscoveryFields as countWorkbookDiscoveryFields,
  createDefaultFpaDiscovery,
  createDefaultFpaDiscoveryCoverage,
  createDefaultFpaDiscoveryEvidence,
  createDefaultFpaDiscoveryPainPoints,
  deriveFpaDiscoveryMetrics,
  normalizeFpaDiscoveryCoverage,
  normalizeFpaDiscoveryEvidence,
  normalizeFpaDiscoveryFields,
  normalizeFpaDiscoveryPainPoints,
} from "./fpaDiscovery";
import {
  countSelectedFpaScopeL2Rows,
  createDefaultFpaScopeL2Rows,
  createDefaultFpaScopeRows,
  deriveFpaScopeMetrics,
  FPA_SCOPE_L2_ROWS,
  normalizeFpaScopeL2Rows,
  normalizeFpaScopeRows,
} from "./fpaScope";
export const FPA_TABS = [
  {
    id: "fpa-00-cover",
    sheetName: "FPA_00 Cover",
    sidebarLabel: "00 Cover",
    title: "Cover",
    kind: "summary",
    formulaCount: 0,
    description: "Workbook cover, usage guide, legend, and FP&A tower profile preserved from the Excel model.",
  },
  {
    id: "fpa-00-logic",
    sheetName: "FPA_00 Logic",
    sidebarLabel: "00 Logic",
    title: "Logic",
    kind: "reference",
    formulaCount: 33,
    description: "Core sizing and governance logic carried from the workbook.",
  },
  {
    id: "fpa-00-dict",
    sheetName: "FPA_00 Dict",
    sidebarLabel: "00 Dict",
    title: "Data Dictionary",
    kind: "reference",
    formulaCount: 82,
    description: "Input, output, and evidence definitions for the FP&A tower.",
  },
  {
    id: "fpa-01-deal-setup",
    sheetName: "FPA_01 Deal Setup",
    sidebarLabel: "01 Deal Setup",
    title: "Deal Setup",
    kind: "input",
    formulaCount: 19,
    description: "Deal-level commercial and contract context inherited from the shared Deal Master.",
  },
  {
    id: "fpa-02-discovery",
    sheetName: "FPA_02 Discovery",
    sidebarLabel: "02 Discovery",
    title: "Discovery",
    kind: "input",
    formulaCount: 84,
    description: "FP&A discovery drivers, proxy data, and platform signals used to size the tower.",
  },
  {
    id: "fpa-03-scope-l3",
    sheetName: "FPA_03 Scope L3",
    sidebarLabel: "03 Scope L2",
    title: "Scope L3",
    kind: "input",
    formulaCount: 76,
    description: "L3 process switchboard that defines which FP&A process lines are included.",
  },
  {
    id: "fpa-04-benchmarks",
    sheetName: "FPA_04 Benchmarks",
    sidebarLabel: "04 Benchmarks",
    title: "Benchmarks",
    kind: "engine",
    formulaCount: 17,
    description: "Reference norms and percentile adjustments used by the workload engine.",
  },
  {
    id: "fpa-05-workload",
    sheetName: "FPA_05 Workload",
    sidebarLabel: "05 Workload",
    title: "Workload",
    kind: "engine",
    formulaCount: 205,
    description: "Proxy-to-volume translation and workload build-up for FP&A activity demand.",
  },
  {
    id: "fpa-06-complexity",
    sheetName: "FPA_06 Complexity",
    sidebarLabel: "06 Complexity",
    title: "Complexity",
    kind: "engine",
    formulaCount: 32,
    description: "Complexity scoring and bands that drive buffers and transition profile.",
  },
  {
    id: "fpa-07-personas",
    sheetName: "FPA_07 Personas",
    sidebarLabel: "07 Personas",
    title: "Personas",
    kind: "engine",
    formulaCount: 0,
    description: "Fixed delivery persona comparison for Standard through Autonomous Finance.",
  },
  {
    id: "fpa-08-ai-benefit",
    sheetName: "FPA_08 AI Benefit",
    sidebarLabel: "08 AI Benefit",
    title: "AI Benefit",
    kind: "engine",
    formulaCount: 834,
    description: "Largest formula block in FP&A: multiplicative AI benefits and capped reductions.",
  },
  {
    id: "fpa-09-ops-model",
    sheetName: "FPA_09 Ops Model",
    sidebarLabel: "09 Ops Model",
    title: "Ops Model",
    kind: "engine",
    formulaCount: 88,
    description: "Delivery mix, pyramids, utilization, and retained organization assumptions.",
  },
  {
    id: "fpa-10-rate-card",
    sheetName: "FPA_10 Rate Card",
    sidebarLabel: "10 Rate Card",
    title: "Rate Card",
    kind: "engine",
    formulaCount: 36,
    description: "Tower rate structures, loads, and pricing basis for FP&A costing.",
  },
  {
    id: "fpa-11-fte-engine",
    sheetName: "FPA_11 FTE Engine",
    sidebarLabel: "11 FTE Engine",
    title: "FTE Engine",
    kind: "engine",
    formulaCount: 285,
    description: "Hours, staffing, productivity, and net FTE translation logic.",
  },
  {
    id: "fpa-12-cost",
    sheetName: "FPA_12 Cost",
    sidebarLabel: "12 Cost",
    title: "Cost",
    kind: "engine",
    formulaCount: 365,
    description: "Cost-to-serve build across run, transition, and transformation layers.",
  },
  {
    id: "fpa-13-pricing",
    sheetName: "FPA_13 Pricing",
    sidebarLabel: "13 Pricing",
    title: "Pricing",
    kind: "engine",
    formulaCount: 71,
    description: "Recommended price, floors, targets, markup, and commercial construct logic.",
  },
  {
    id: "fpa-30-scpl",
    sheetName: "FPA_30 SCPL",
    sidebarLabel: "30 SCPL",
    title: "SCPL",
    kind: "engine",
    formulaCount: 300,
    description:
      "Parallel HCL India offshore commercial view: FTE flows in from FTE Engine, while band mix and location assumptions drive SCPL cost and price outputs.",
  },  {
    id: "fpa-31-sizing-band-mix",
    sheetName: "FPA_31 Sizing & Band Mix",
    sidebarLabel: "31 Sizing & Band Mix",
    title: "Sizing & Band Mix",
    kind: "engine",
    formulaCount: 714,
    description: "India roster by persona: workbook-exact band mapping, manual overrides, and the roll-up that feeds the SCPL band layer.",
  },
  {
    id: "fpa-14-outcome",
    sheetName: "FPA_14 Outcome",
    sidebarLabel: "14 Outcome",
    title: "Outcome",
    kind: "engine",
    formulaCount: 27,
    description: "Outcome metrics and delivery impact summary.",
  },
  {
    id: "fpa-15-transition",
    sheetName: "FPA_15 Transition",
    sidebarLabel: "15 Transition",
    title: "Transition",
    kind: "engine",
    formulaCount: 72,
    description: "Transition staffing, fee, duration, and ramp readiness logic.",
  },
  {
    id: "fpa-16-business-case",
    sheetName: "FPA_16 Business Case",
    sidebarLabel: "16 Business Case",
    title: "Business Case",
    kind: "engine",
    formulaCount: 346,
    description: "NPV, payback, multi-year economics, and client value modeling.",
  },
  {
    id: "fpa-17-sensitivity",
    sheetName: "FPA_17 Sensitivity",
    sidebarLabel: "17 Sensitivity",
    title: "Sensitivity",
    kind: "engine",
    formulaCount: 85,
    description: "Sensitivity stress tests across scenario and commercial assumptions.",
  },
  {
    id: "fpa-18-risk",
    sheetName: "FPA_18 Risk",
    sidebarLabel: "18 Risk",
    title: "Risk",
    kind: "engine",
    formulaCount: 115,
    description: "Tower risk overlays, exposure scoring, and verdict logic.",
  },
  {
    id: "fpa-19-deal-risks",
    sheetName: "FPA_19 Deal Risks",
    sidebarLabel: "19 Deal Risks",
    title: "Deal Risks",
    kind: "engine",
    formulaCount: 17,
    description: "Deal-level risk rollups that feed recommendation and governance.",
  },
  {
    id: "fpa-20-recommend",
    sheetName: "FPA_20 Recommend",
    sidebarLabel: "20 Recommend",
    title: "Recommend",
    kind: "output",
    formulaCount: 67,
    description: "Recommended tower stance and decision support outputs.",
  },
  {
    id: "fpa-21-client-value",
    sheetName: "FPA_21 Client Value",
    sidebarLabel: "21 Client Value",
    title: "Client Value",
    kind: "output",
    formulaCount: 57,
    description: "Client-facing value story, savings, and transformation outcomes.",
  },

  {
    id: "fpa-22-dashboard",
    sheetName: "FPA_22 Dashboard",
    sidebarLabel: "22 Dashboard",
    title: "Dashboard",
    kind: "output",
    formulaCount: 220,
    description: "Tower dashboard label contract and cockpit-ready output rows.",
  },
  {
    id: "fpa-23-trace-log",
    sheetName: "FPA_23 Trace Log",
    sidebarLabel: "23 Trace Log",
    title: "Trace Log",
    kind: "output",
    formulaCount: 4,
    description: "Traceability hooks from outputs back to source assumptions.",
  },
  {
    id: "fpa-24-governance",
    sheetName: "FPA_24 Governance",
    sidebarLabel: "24 Governance",
    title: "Governance",
    kind: "governance",
    formulaCount: 0,
    description: "Approval routing, override controls, and evidence-linked governance status.",
  },
  {
    id: "fpa-25-confidence",
    sheetName: "FPA_25 Confidence",
    sidebarLabel: "25 Confidence",
    title: "Confidence",
    kind: "governance",
    formulaCount: 157,
    description: "Confidence scoring across evidence, discovery quality, and proxy usage.",
  },
  {
    id: "fpa-26-calibration",
    sheetName: "FPA_26 Calibration",
    sidebarLabel: "26 Calibration",
    title: "Calibration",
    kind: "governance",
    formulaCount: 231,
    description: "Calibration closure checks and benchmark reconciliation views.",
  },
  {
    id: "fpa-27-benchmark-pack",
    sheetName: "FPA_27 Benchmark Pack",
    sidebarLabel: "27 Benchmark Pack",
    title: "Benchmark Pack",
    kind: "governance",
    formulaCount: 93,
    description: "Benchmark evidence pack and corroboration support.",
  },
  {
    id: "fpa-28-change-log",
    sheetName: "FPA_28 Change Log",
    sidebarLabel: "28 Change Log",
    title: "Change Log",
    kind: "governance",
    formulaCount: 0,
    description: "Controlled record of workbook and solution changes over time.",
  },  {
    id: "fpa-29-l3-business-view",
    sheetName: "FPA_29 L3 Business View",
    sidebarLabel: "29 L3 Business View",
    title: "L3 Business View",
    kind: "output",
    formulaCount: 557,
    description: "Largest output matrix for process-level business views and lever visibility.",
  },
];

export const FPA_TOTAL_FORMULAS = FPA_TABS.reduce((total, tab) => total + tab.formulaCount, 0);

export { FPA_DISCOVERY_OPTIONS } from "./fpaDiscovery";

export const MONTH_OPTIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FPA_SCOPE_CLUSTER_GROUPS = [
  { id: "pf", cluster: "P&F", label: "P&F · Planning & Forecasting" },
  { id: "ra", cluster: "R&A", label: "R&A · Reporting & Analytics" },
  { id: "bpds", cluster: "BP&DS", label: "BP&DS · Business Partnering & Decision Support" },
  { id: "dg", cluster: "D&G", label: "D&G · Data & Governance" },
];

export const FPA_SCOPE_GROUPS = FPA_SCOPE_CLUSTER_GROUPS
  .map((group) => ({
    id: group.id,
    label: group.label,
    items: FPA_SCOPE_L2_ROWS
      .filter((item) => item.cluster === group.cluster)
      .map((item) => ({
        id: item.id,
        label: item.label,
        cluster: item.cluster,
      })),
  }))
  .filter((group) => group.items.length > 0);

export const FPA_SCOPE_ITEMS = FPA_SCOPE_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    groupId: group.id,
    groupLabel: group.label,
  })),
);

export const FPA_SCOPE_METADATA = {
  budgetingPlanning: {
    family: "Planning",
    weight: 1.22,
    aiEligiblePct: 0.24,
    lever: "Budget cycle compression",
  },
  commercialForecasting: {
    family: "Planning",
    weight: 1.1,
    aiEligiblePct: 0.28,
    lever: "Forecast refresh productivity",
  },
  workforceCapacityPlanning: {
    family: "Planning",
    weight: 0.78,
    aiEligiblePct: 0.19,
    lever: "Capacity signal automation",
  },
  cashFlowCapitalPlanning: {
    family: "Planning",
    weight: 0.72,
    aiEligiblePct: 0.17,
    lever: "Capital plan scenario support",
  },
  variancePerformanceManagement: {
    family: "Reporting & Analysis",
    weight: 1.18,
    aiEligiblePct: 0.34,
    lever: "Variance narrative automation",
  },
  managementReportingDecisionSupport: {
    family: "Reporting & Analysis",
    weight: 1.3,
    aiEligiblePct: 0.39,
    lever: "Pack and insight generation",
  },
  scenarioRiskModeling: {
    family: "Planning",
    weight: 0.96,
    aiEligiblePct: 0.31,
    lever: "Scenario drafting acceleration",
  },
  profitabilityPricingBusinessCases: {
    family: "Business Partnering",
    weight: 1.08,
    aiEligiblePct: 0.27,
    lever: "Decision support uplift",
  },
  costProductivityMarginManagement: {
    family: "Reporting & Analysis",
    weight: 1.02,
    aiEligiblePct: 0.22,
    lever: "Productivity analytics",
  },
  governanceMasterDataBusinessPartnering: {
    family: "Data & Governance",
    weight: 0.76,
    aiEligiblePct: 0.15,
    lever: "Controls and master data hygiene",
  },
};

export const FPA_PERSONAS = [
  {
    id: "conservative",
    label: "Conservative",
    productivityUpliftPct: 0,
    automationReachPct: 10,
    retainedOrgPct: 24,
    utilizationPct: 78,
    deliveryMix: { onshore: 34, nearshore: 22, offshore: 44 },
    roleMix: { analyst: 0.34, senior: 0.32, lead: 0.22, architect: 0.12 },
    note: "Highest control footprint with heavier leadership coverage.",
  },
  {
    id: "standard",
    label: "Standard",
    productivityUpliftPct: 6,
    automationReachPct: 18,
    retainedOrgPct: 18,
    utilizationPct: 82,
    deliveryMix: { onshore: 24, nearshore: 18, offshore: 58 },
    roleMix: { analyst: 0.42, senior: 0.3, lead: 0.2, architect: 0.08 },
    note: "Balanced managed-services posture with measured AI support.",
  },
  {
    id: "lean",
    label: "Lean",
    productivityUpliftPct: 11,
    automationReachPct: 24,
    retainedOrgPct: 15,
    utilizationPct: 84,
    deliveryMix: { onshore: 20, nearshore: 16, offshore: 64 },
    roleMix: { analyst: 0.46, senior: 0.28, lead: 0.18, architect: 0.08 },
    note: "Tighter run posture with moderate automation-backed productivity.",
  },
  {
    id: "aggressive-ai-first",
    label: "Aggressive AI-First",
    productivityUpliftPct: 18,
    automationReachPct: 33,
    retainedOrgPct: 12,
    utilizationPct: 86,
    deliveryMix: { onshore: 18, nearshore: 14, offshore: 68 },
    roleMix: { analyst: 0.5, senior: 0.26, lead: 0.16, architect: 0.08 },
    note: "AI-first run-state with stronger self-service and industrialized content generation.",
  },
  {
    id: "autonomous-finance",
    label: "Autonomous Finance",
    productivityUpliftPct: 25,
    automationReachPct: 42,
    retainedOrgPct: 8,
    utilizationPct: 88,
    deliveryMix: { onshore: 14, nearshore: 12, offshore: 74 },
    roleMix: { analyst: 0.56, senior: 0.22, lead: 0.14, architect: 0.08 },
    note: "Future-state benchmark where AI and standardized data pipelines carry most repetitive demand.",
  },
];

export const FPA_BENCHMARK_OPTIONS = {
  benchmarkPercentile: ["Use Deal Policy", "Auto", "P25", "P50", "P75"],
  benchmarkRegion: [
    "Global managed services blend",
    "North America weighted",
    "Europe weighted",
    "APAC weighted",
  ],
  workloadConfidence: ["Stretch", "Balanced", "Conservative"],
  evidenceMode: ["Market and delivery evidence", "Benchmark-first", "Practitioner-adjusted"],
  deliveryShape: ["Hybrid Global", "Regional Hub", "Onshore-led", "Offshore-led"],
};

export const FPA_APPROVAL_STAGE_OPTIONS = [
  "Working",
  "Tower Lead Review",
  "Finance Review",
  "Solution Review",
  "Submission Ready",
];

const DEFAULT_SCOPE = createDefaultFpaScopeRows();

const DEFAULT_BENCHMARKS = {
  benchmarkPercentile: "Use Deal Policy",
  benchmarkRegion: "Global managed services blend",
  workloadConfidence: "Balanced",
  evidenceMode: "Market and delivery evidence",
  planningCyclesPerYear: "4",
  forecastCyclesPerYear: "12",
  managementReportsPerMonth: "8",
  scenarioBurstsPerQuarter: "2",
  benchmarkAdjustmentPct: "0",
  productivityFloorPct: "92",
};

const DEFAULT_AI_BENEFIT = {
  addressableAutomationPct: "38",
  genAiNarrativePct: "24",
  selfServiceShiftPct: "15",
  controlResidualPct: "62",
  adoptionRampMonths: "6",
  businessPartnerAccelerationPct: "10",
};

const DEFAULT_OPS_MODEL = {
  selectedPersonaId: "standard",
  deliveryShape: "Hybrid Global",
  onshorePct: "24",
  nearshorePct: "18",
  offshorePct: "58",
  managerSpan: "10",
  utilisationPct: "82",
  retainedOrgPct: "18",
  qualityBufferPct: "6",
};

const DEFAULT_RATE_CARD = {
  analystRateUsd: "34",
  seniorRateUsd: "48",
  leadRateUsd: "65",
  architectRateUsd: "82",
  transitionRateMultiplier: "1.12",
  transformationPodCostUsd: "185000",
};

const DEFAULT_PRICING = {
  targetMarginPct: "18",
  floorMarginPct: "12",
  strategicDiscountPct: "0",
  gainsharePct: "0",
  volumeRiskBufferPct: "5",
};

const DEFAULT_TRANSITION = {
  transitionMonths: "4",
  knowledgeTransferWeeks: "6",
  stabilizationWeeks: "8",
  digitalSprints: "3",
  travelEnablementUsd: "45000",
};

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

const DEFAULT_CHANGE_LOG = {
  latestChangeSummary: "",
  lastReviewer: "",
  lastDecision: "",
  versionNote: "",
};

const NESTED_SECTIONS = [
  "discovery",
  "discoveryEvidence",
  "discoveryCoverage",
  "discoveryPainPoints",
  "scopeL2",
  "scopeL3",
  "benchmarks",
  "aiBenefit",
  "opsModel",
  "rateCard",
  "pricing",
  "transition",
  "governance",
  "changeLog",
];

export function createDefaultFpaWorkspace() {
  return {
    status: "Not Started",
    discovery: createDefaultFpaDiscovery(),
    discoveryEvidence: createDefaultFpaDiscoveryEvidence(),
    discoveryCoverage: createDefaultFpaDiscoveryCoverage(),
    discoveryPainPoints: createDefaultFpaDiscoveryPainPoints(),
    scopeL2: createDefaultFpaScopeL2Rows(),
    scopeL3: createDefaultFpaScopeRows(),
    benchmarks: { ...DEFAULT_BENCHMARKS },
    aiBenefit: { ...DEFAULT_AI_BENEFIT },
    opsModel: { ...DEFAULT_OPS_MODEL },
    rateCard: { ...DEFAULT_RATE_CARD },
    pricing: { ...DEFAULT_PRICING },
    transition: { ...DEFAULT_TRANSITION },
    governance: { ...DEFAULT_GOVERNANCE },
    changeLog: { ...DEFAULT_CHANGE_LOG },
    notes: "",
  };
}

export function normalizeFpaWorkspace(value = {}) {
  const defaults = createDefaultFpaWorkspace();
  const incoming = value && typeof value === "object" ? value : {};
  const normalized = {
    ...defaults,
    ...incoming,
  };

  NESTED_SECTIONS.forEach((section) => {
    const defaultValue = defaults[section] && typeof defaults[section] === "object" ? defaults[section] : {};
    const incomingValue = incoming[section] && typeof incoming[section] === "object" ? incoming[section] : {};
    normalized[section] = {
      ...defaultValue,
      ...incomingValue,
    };
  });

  normalized.discovery = normalizeFpaDiscoveryFields(normalized.discovery);
  normalized.discoveryEvidence = normalizeFpaDiscoveryEvidence(normalized.discoveryEvidence);
  normalized.discoveryCoverage = normalizeFpaDiscoveryCoverage(normalized.discoveryCoverage);
  normalized.discoveryPainPoints = normalizeFpaDiscoveryPainPoints(normalized.discoveryPainPoints);
  normalized.scopeL2 = normalizeFpaScopeL2Rows(normalized.scopeL2);
  normalized.scopeL3 = normalizeFpaScopeRows(normalized.scopeL3);
  normalized.notes = typeof incoming.notes === "string" ? incoming.notes : defaults.notes;
  normalized.status = typeof incoming.status === "string" && incoming.status.trim() ? incoming.status : defaults.status;
  normalized.discovery.sizingMotion = deriveFpaDiscoveryMetrics(normalized).sizingMotion;

  return normalized;
}

export function countFilledFpaDiscoveryFields(workspace) {
  const normalized = normalizeFpaWorkspace(workspace);
  return countWorkbookDiscoveryFields(normalized);
}

export function countSelectedFpaScopes(workspace) {
  const normalized = normalizeFpaWorkspace(workspace);
  return countSelectedFpaScopeL2Rows(normalized.scopeL3, normalized.scopeL2);
}

export function countCompletedFpaGovernanceChecks(workspace) {
  const normalized = normalizeFpaWorkspace(workspace);
  const governance = normalized.governance;
  return [
    governance.qaReviewComplete,
    governance.financeLeadershipReview,
    governance.clientEvidenceValidated,
    governance.benchmarkPackReady,
    governance.calibrationComplete,
  ].filter(Boolean).length;
}

export function deriveFpaWorkspaceStatus(workspace) {
  const normalized = normalizeFpaWorkspace(workspace);
  const discoveryCount = countWorkbookDiscoveryFields(normalized);
  const discoveryMetrics = deriveFpaDiscoveryMetrics(normalized);
  const scopeMetrics = deriveFpaScopeMetrics(normalized.scopeL3, normalized.scopeL2);
  const scopeCount = scopeMetrics.selectedL2Count;

  if (discoveryCount === 0 && discoveryMetrics.coverageAnsweredCount === 0 && discoveryMetrics.painAnsweredCount === 0 && scopeMetrics.isAtWorkbookDefault) {
    return "Not Started";
  }

  if (discoveryMetrics.proxyWeightedCompletenessPct >= 70 && discoveryMetrics.coverageScorePct >= 70 && scopeCount >= 4) {
    return "Ready for Engine";
  }

  return "In Progress";
}









