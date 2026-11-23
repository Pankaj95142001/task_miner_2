import {
  buildP2pBenchmarkModel,
  deriveP2pRevenueBand,
  getP2pIndustryBenchmark,
  getP2pRevenueBandDefaults,
  P2P_CAPACITY_PROXIES,
  P2P_SELECT_OPTIONS,
  P2P_TECH_OPTION_SETS,
} from "./p2pBenchmarks";
import { completionRatio, formatCurrency, formatOneDecimal, formatPercent, formatWhole, trimText, toNumberOrNull } from "./p2pMath";

const DISCOVERY_DEFAULTS = {
  industryVertical: "",
  annualRevenueUsdB: "",
  legalEntities: "",
  businessUnits: "",
  employeeCount000: "",
  geoCountries: "",
  languagesBeyondEnglish: "",
  supplierInvoices000: "",
  purchaseOrders000: "",
  requisitions000: "",
  activeVendors000: "",
  paymentRunsPerMonth: "",
  invoiceExceptionRate: "",
  tneClaims000: "",
  poBackedSpendShare: "",
  p2pPlatform: "",
  monthlyCloseComplexity: "",
  processMaturity: "",
  automationMaturity: "",
  aiMaturity: "",
  digitalMaturity: "",
  competitiveIntensity: "",
  platformModernizationInScope: "",
  peakMonth1: "",
  peakMonth2: "",
  peakMonth3: "",
  retainedOrgIntent: "",
  dataSourcesCount: "",
  currentTowerStaff: "",
  currentTowerCostBaselineUsd: "",
  ocrIdpCapture: "",
  supplierNetwork: "",
  bankConnectivity: "",
  tneTool: "",
  reportingBiLayer: "",
  vendorMasterDataManagement: "",
};

function emptyPainPoint() {
  return {
    present: "",
    severity: "",
  };
}

export const P2P_DISCOVERY_PROXY_FIELDS = [
  { id: "industryVertical", rowNumber: 7, label: "Industry Vertical", control: "select", options: P2P_SELECT_OPTIONS.industryVertical, criticality: 2, defaultSource: "Neutral default" },
  { id: "annualRevenueUsdB", rowNumber: 8, label: "Annual Revenue (USD $B)", control: "number", step: "0.1", criticality: 3, defaultSource: "Mid-band anchor" },
  { id: "legalEntities", rowNumber: 10, label: "# Legal Entities", control: "number", criticality: 3, defaultSource: "Revenue-band default" },
  { id: "businessUnits", rowNumber: 11, label: "# Business Units", control: "number", criticality: 3, defaultSource: "Revenue-band default" },
  { id: "employeeCount000", rowNumber: 12, label: "Employee Count (000s)", control: "number", criticality: 2, defaultSource: "Revenue-band default" },
  { id: "geoCountries", rowNumber: 13, label: "Geographic Footprint (# countries)", control: "number", criticality: 2, defaultSource: "Revenue-band default" },
  { id: "languagesBeyondEnglish", rowNumber: 14, label: "Languages beyond English (#)", control: "number", criticality: 1, defaultSource: "0 if unknown" },
  { id: "supplierInvoices000", rowNumber: 15, label: "# Supplier Invoices / yr (000s)", control: "number", criticality: 3, defaultSource: "Revenue-band default" },
  { id: "purchaseOrders000", rowNumber: 16, label: "# Purchase Orders / yr (000s)", control: "number", criticality: 3, defaultSource: "Revenue-band default" },
  { id: "requisitions000", rowNumber: 17, label: "# Requisitions / yr (000s)", control: "number", criticality: 1, defaultSource: "Revenue-band default" },
  { id: "activeVendors000", rowNumber: 18, label: "# Active Vendors (000s)", control: "number", criticality: 3, defaultSource: "Revenue-band default" },
  { id: "paymentRunsPerMonth", rowNumber: 19, label: "# Payment Runs / month", control: "number", criticality: 2, defaultSource: "Revenue-band default" },
  { id: "invoiceExceptionRate", rowNumber: 20, label: "Invoice Exception Rate (share)", control: "number", step: "0.01", criticality: 3, defaultSource: "18% peer anchor" },
  { id: "tneClaims000", rowNumber: 21, label: "# T&E Claims / yr (000s)", control: "number", criticality: 2, defaultSource: "Revenue-band default" },
  { id: "poBackedSpendShare", rowNumber: 22, label: "PO-Backed Spend Share", control: "number", step: "0.01", criticality: 1, defaultSource: "60% peer anchor" },
  { id: "p2pPlatform", rowNumber: 23, label: "AP / P2P Platform", control: "select", options: P2P_SELECT_OPTIONS.primaryPlatform, criticality: 3, defaultSource: "Worst-case stack" },
  { id: "monthlyCloseComplexity", rowNumber: 24, label: "Monthly Close Complexity", control: "select", options: P2P_SELECT_OPTIONS.monthlyCloseComplexity, criticality: 2, defaultSource: "Standard" },
  { id: "processMaturity", rowNumber: 25, label: "Procure-to-Pay Maturity", control: "select", options: P2P_SELECT_OPTIONS.processMaturity, criticality: 2, defaultSource: "Developing" },
  { id: "automationMaturity", rowNumber: 26, label: "Automation Maturity", control: "select", options: P2P_SELECT_OPTIONS.automationMaturity, criticality: 2, defaultSource: "Low" },
  { id: "aiMaturity", rowNumber: 27, label: "AI Maturity", control: "select", options: P2P_SELECT_OPTIONS.aiMaturity, criticality: 2, defaultSource: "Exploring" },
  { id: "digitalMaturity", rowNumber: 28, label: "Customer Digital Maturity", control: "select", options: P2P_SELECT_OPTIONS.digitalMaturity, criticality: 1, defaultSource: "Industry default" },
  { id: "competitiveIntensity", rowNumber: 29, label: "Competitive Intensity", control: "select", options: P2P_SELECT_OPTIONS.competitiveIntensity, criticality: 1, defaultSource: "Medium" },
  { id: "platformModernizationInScope", rowNumber: 30, label: "P2P Platform Modernisation in Transformation Scope?", control: "select", options: P2P_SELECT_OPTIONS.yesNo, criticality: 2, defaultSource: "+15pp automation ceiling" },
  { id: "peakMonth1", rowNumber: 31, label: "Peak Month 1", control: "select", options: P2P_SELECT_OPTIONS.months, criticality: 1, defaultSource: "Seasonality default" },
  { id: "peakMonth2", rowNumber: 32, label: "Peak Month 2", control: "select", options: P2P_SELECT_OPTIONS.months, criticality: 1, defaultSource: "Seasonality default" },
  { id: "peakMonth3", rowNumber: 33, label: "Peak Month 3", control: "select", options: P2P_SELECT_OPTIONS.months, criticality: 1, defaultSource: "Seasonality default" },
  { id: "retainedOrgIntent", rowNumber: 34, label: "Retained-Organisation Intent", control: "select", options: P2P_SELECT_OPTIONS.retainedOrgIntent, criticality: 1, defaultSource: "Hybrid" },
  { id: "dataSourcesCount", rowNumber: 35, label: "# Data Sources feeding the tower", control: "number", criticality: 2, defaultSource: "Revenue-band default" },
  { id: "currentTowerStaff", rowNumber: 36, label: "# P2P / AP Staff (current)", control: "number", criticality: 3, defaultSource: "Revenue × benchmark FTE/$1B" },
  { id: "currentTowerCostBaselineUsd", rowNumber: 37, label: "Current P2P Cost Baseline (USD/yr)", control: "number", criticality: 2, defaultSource: "Current staff × $70k" },
];

export const P2P_DISCOVERY_COVERAGE_FIELDS = [
  { id: "volumesCoreDrivers", rowNumber: 42, label: "Volumes (P2P core drivers)", weight: 10 },
  { id: "currentFteByProcess", rowNumber: 43, label: "Current FTE by process", weight: 10 },
  { id: "platformAndMaturity", rowNumber: 44, label: "Platform & maturity", weight: 10 },
  { id: "automationAlreadyAchieved", rowNumber: 45, label: "Automation % already achieved", weight: 10 },
  { id: "kpiBaselineCycleMetrics", rowNumber: 46, label: "KPI baseline / cycle metrics", weight: 10 },
  { id: "activityInventory", rowNumber: 47, label: "Activity / report inventory (with effort)", weight: 10 },
  { id: "closeCalendar", rowNumber: 48, label: "Close / process calendar", weight: 10 },
  { id: "existingSlasKpis", rowNumber: 49, label: "Existing SLAs / KPIs", weight: 10 },
  { id: "currentCostBaseline", rowNumber: 50, label: "Current cost baseline", weight: 10 },
  { id: "painPointsPriorities", rowNumber: 51, label: "Pain points & priorities", weight: 10 },
  { id: "retainedOrgIntentShared", rowNumber: 52, label: "Retained-org intent shared", weight: 10 },
  { id: "dataSourceLandscape", rowNumber: 53, label: "Data-source landscape", weight: 10 },
  { id: "peakCalendarConfirmed", rowNumber: 54, label: "Peak calendar confirmed", weight: 10 },
];

export const P2P_DISCOVERY_TECH_FIELDS = Object.entries(P2P_TECH_OPTION_SETS).map(([id, definition], index) => ({
  id,
  rowNumber: 65 + index,
  label: definition.label,
  control: "select",
  options: Object.keys(definition.options),
}));

export const P2P_DISCOVERY_PAIN_POINT_FIELDS = [
  { id: "costPerInvoiceAbovePeerMedian", rowNumber: 82, label: "Cost per invoice above peer median" },
  { id: "lowTouchlessRate", rowNumber: 83, label: "Low touchless rate (<30%)" },
  { id: "highExceptionVolume", rowNumber: 84, label: "High exception / blocked-invoice volume" },
  { id: "latePaymentsLostDiscounts", rowNumber: 85, label: "Late payments & lost discounts" },
  { id: "duplicatePaymentsDetected", rowNumber: 86, label: "Duplicate payments detected" },
  { id: "vendorMasterDuplicatesFraudRisk", rowNumber: 87, label: "Vendor master duplicates / fraud risk" },
  { id: "manualTneAudit", rowNumber: 88, label: "Manual T&E audit" },
  { id: "poorPoCompliance", rowNumber: 89, label: "Poor PO compliance (maverick spend)" },
];

export const P2P_DISCOVERY_CELL_MAP = {
  industryVertical: "D7",
  annualRevenueUsdB: "D8",
  legalEntities: "D10",
  businessUnits: "D11",
  employeeCount000: "D12",
  geoCountries: "D13",
  languagesBeyondEnglish: "D14",
  supplierInvoices000: "D15",
  purchaseOrders000: "D16",
  requisitions000: "D17",
  activeVendors000: "D18",
  paymentRunsPerMonth: "D19",
  invoiceExceptionRate: "D20",
  tneClaims000: "D21",
  poBackedSpendShare: "D22",
  p2pPlatform: "D23",
  monthlyCloseComplexity: "D24",
  processMaturity: "D25",
  automationMaturity: "D26",
  aiMaturity: "D27",
  digitalMaturity: "D28",
  competitiveIntensity: "D29",
  platformModernizationInScope: "D30",
  peakMonth1: "D31",
  peakMonth2: "D32",
  peakMonth3: "D33",
  retainedOrgIntent: "D34",
  dataSourcesCount: "D35",
  currentTowerStaff: "D36",
  currentTowerCostBaselineUsd: "D37",
  ocrIdpCapture: "D65",
  supplierNetwork: "D66",
  bankConnectivity: "D67",
  tneTool: "D68",
  reportingBiLayer: "D69",
  vendorMasterDataManagement: "D70",
};

export const P2P_DISCOVERY_COVERAGE_CELL_MAP = Object.fromEntries(
  P2P_DISCOVERY_COVERAGE_FIELDS.map((field) => [field.id, `H${field.rowNumber}`]),
);

export const P2P_DISCOVERY_PAIN_CELL_MAP = Object.fromEntries(
  P2P_DISCOVERY_PAIN_POINT_FIELDS.map((field) => [field.id, { present: `D${field.rowNumber}`, severity: `E${field.rowNumber}` }]),
);

const COVERAGE_DEFAULTS = Object.fromEntries(P2P_DISCOVERY_COVERAGE_FIELDS.map((field) => [field.id, ""]));
const TECH_FIELD_IDS = P2P_DISCOVERY_TECH_FIELDS.map((field) => field.id);
const PROXY_FIELD_IDS = P2P_DISCOVERY_PROXY_FIELDS.map((field) => field.id);
const DISCOVERY_FIELD_IDS = [...PROXY_FIELD_IDS, ...TECH_FIELD_IDS];
const PEAK_MONTH_DEFAULTS = ["Dec", "Mar", "Nov"];
const SEVERITY_SCORES = { Low: 1, Medium: 2, High: 3, Critical: 4 };

export function createDefaultP2pDiscovery() {
  return { ...DISCOVERY_DEFAULTS };
}

export function createDefaultP2pDiscoveryCoverage() {
  return { ...COVERAGE_DEFAULTS };
}

export function createDefaultP2pDiscoveryPainPoints() {
  return Object.fromEntries(P2P_DISCOVERY_PAIN_POINT_FIELDS.map((field) => [field.id, emptyPainPoint()]));
}

export function normalizeP2pDiscoveryFields(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.keys(DISCOVERY_DEFAULTS).map((fieldId) => [fieldId, trimText(incoming[fieldId])]),
  );
}

export function normalizeP2pDiscoveryCoverage(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.keys(COVERAGE_DEFAULTS).map((fieldId) => [fieldId, trimText(incoming[fieldId])]),
  );
}

export function normalizeP2pDiscoveryPainPoints(value = {}) {
  const defaults = createDefaultP2pDiscoveryPainPoints();
  const incoming = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    Object.keys(defaults).map((fieldId) => {
      const candidate = incoming[fieldId] && typeof incoming[fieldId] === "object" ? incoming[fieldId] : {};
      return [fieldId, { present: trimText(candidate.present), severity: trimText(candidate.severity) }];
    }),
  );
}

export function countFilledP2pDiscoveryFields(workspaceOrDiscovery = {}) {
  const discovery = normalizeP2pDiscoveryFields(workspaceOrDiscovery.discovery || workspaceOrDiscovery);
  return DISCOVERY_FIELD_IDS.filter((fieldId) => trimText(discovery[fieldId])).length;
}

export function countAnsweredP2pDiscoveryCoverage(value = {}) {
  const coverage = normalizeP2pDiscoveryCoverage(value);
  return Object.values(coverage).filter((entry) => trimText(entry)).length;
}

export function countAnsweredP2pPainPoints(value = {}) {
  const painPoints = normalizeP2pDiscoveryPainPoints(value);
  return Object.values(painPoints).filter((entry) => trimText(entry.present) || trimText(entry.severity)).length;
}

function effectiveOrFallback(rawValue, fallbackValue) {
  return trimText(rawValue) || fallbackValue;
}

export function formatP2pDiscoveryValue(fieldId, value) {
  const text = trimText(value);
  if (!text) {
    return "-";
  }

  if (["annualRevenueUsdB"].includes(fieldId)) {
    return `$${formatOneDecimal(text)}B`;
  }

  if (["currentTowerCostBaselineUsd"].includes(fieldId)) {
    return formatCurrency(text);
  }

  if (["invoiceExceptionRate", "poBackedSpendShare"].includes(fieldId)) {
    return formatPercent(text, 0);
  }

  if (["employeeCount000"].includes(fieldId)) {
    return `${formatWhole(text)}k`;
  }

  if ([
    "legalEntities",
    "businessUnits",
    "geoCountries",
    "languagesBeyondEnglish",
    "supplierInvoices000",
    "purchaseOrders000",
    "requisitions000",
    "activeVendors000",
    "paymentRunsPerMonth",
    "tneClaims000",
    "dataSourcesCount",
    "currentTowerStaff",
  ].includes(fieldId) && toNumberOrNull(text) !== null) {
    return formatWhole(text);
  }

  return text;
}

export function deriveP2pDiscoveryMetrics(workspace = {}) {
  const discovery = normalizeP2pDiscoveryFields(workspace.discovery || workspace);
  const discoveryCoverage = normalizeP2pDiscoveryCoverage(workspace.discoveryCoverage || {});
  const discoveryPainPoints = normalizeP2pDiscoveryPainPoints(workspace.discoveryPainPoints || {});
  const industryBenchmark = getP2pIndustryBenchmark(discovery.industryVertical);
  const revenueBand = deriveP2pRevenueBand(discovery.annualRevenueUsdB);
  const revenueDefaults = getP2pRevenueBandDefaults(revenueBand);

  const effectiveDiscovery = {
    ...discovery,
    legalEntities: effectiveOrFallback(discovery.legalEntities, String(revenueDefaults.legalEntities)),
    businessUnits: effectiveOrFallback(discovery.businessUnits, String(revenueDefaults.businessUnits)),
    employeeCount000: effectiveOrFallback(discovery.employeeCount000, String(revenueDefaults.employeeCount000)),
    geoCountries: effectiveOrFallback(discovery.geoCountries, String(revenueDefaults.geoCountries)),
    languagesBeyondEnglish: effectiveOrFallback(discovery.languagesBeyondEnglish, "0"),
    supplierInvoices000: effectiveOrFallback(discovery.supplierInvoices000, String(revenueDefaults.supplierInvoices000)),
    purchaseOrders000: effectiveOrFallback(discovery.purchaseOrders000, String(revenueDefaults.purchaseOrders000)),
    requisitions000: effectiveOrFallback(discovery.requisitions000, String(revenueDefaults.requisitions000)),
    activeVendors000: effectiveOrFallback(discovery.activeVendors000, String(revenueDefaults.activeVendors000)),
    paymentRunsPerMonth: effectiveOrFallback(discovery.paymentRunsPerMonth, String(revenueDefaults.paymentRunsPerMonth)),
    invoiceExceptionRate: effectiveOrFallback(discovery.invoiceExceptionRate, "0.18"),
    tneClaims000: effectiveOrFallback(discovery.tneClaims000, String(revenueDefaults.tneClaims000)),
    poBackedSpendShare: effectiveOrFallback(discovery.poBackedSpendShare, "0.6"),
    p2pPlatform: effectiveOrFallback(discovery.p2pPlatform, "ERP AP module only (manual)"),
    monthlyCloseComplexity: effectiveOrFallback(discovery.monthlyCloseComplexity, "Standard (6-8 days)"),
    processMaturity: effectiveOrFallback(discovery.processMaturity, "Developing"),
    automationMaturity: effectiveOrFallback(discovery.automationMaturity, "Low (<20%)"),
    aiMaturity: effectiveOrFallback(discovery.aiMaturity, "Exploring"),
    digitalMaturity: effectiveOrFallback(discovery.digitalMaturity, industryBenchmark.defaultDigitalMaturity),
    competitiveIntensity: effectiveOrFallback(discovery.competitiveIntensity, "Medium (2-3 bidders)"),
    platformModernizationInScope: effectiveOrFallback(discovery.platformModernizationInScope, "Yes"),
    peakMonth1: effectiveOrFallback(discovery.peakMonth1, PEAK_MONTH_DEFAULTS[0]),
    peakMonth2: effectiveOrFallback(discovery.peakMonth2, PEAK_MONTH_DEFAULTS[1]),
    peakMonth3: effectiveOrFallback(discovery.peakMonth3, PEAK_MONTH_DEFAULTS[2]),
    retainedOrgIntent: effectiveOrFallback(discovery.retainedOrgIntent, "Hybrid"),
    dataSourcesCount: effectiveOrFallback(discovery.dataSourcesCount, String(revenueDefaults.dataSourcesCount)),
  };

  const revenueValue = toNumberOrNull(discovery.annualRevenueUsdB);
  const currentTowerStaffProxy = revenueValue !== null
    ? revenueValue * industryBenchmark.ftePerRevenueB
    : null;
  effectiveDiscovery.currentTowerStaff = effectiveOrFallback(
    discovery.currentTowerStaff,
    currentTowerStaffProxy === null ? "" : String(currentTowerStaffProxy),
  );
  const towerStaffEffective = toNumberOrNull(effectiveDiscovery.currentTowerStaff);
  effectiveDiscovery.currentTowerCostBaselineUsd = effectiveOrFallback(
    discovery.currentTowerCostBaselineUsd,
    towerStaffEffective === null ? "" : String(towerStaffEffective * P2P_CAPACITY_PROXIES.clientLoadedCostPerFte),
  );

  const benchmarkModel = buildP2pBenchmarkModel(effectiveDiscovery, workspace.benchmarks || {});

  const coverageRows = P2P_DISCOVERY_COVERAGE_FIELDS.map((field) => {
    const answer = trimText(discoveryCoverage[field.id]);
    const score = answer === "Yes" ? field.weight : 0;
    return {
      ...field,
      answer,
      score,
    };
  });
  const coverageScore = coverageRows.reduce((total, field) => total + field.score, 0);
  const totalCoverageWeight = coverageRows.reduce((total, field) => total + field.weight, 0);
  const coveragePct = completionRatio(coverageScore, totalCoverageWeight);
  const sizingMode = coveragePct >= 0.75 ? "DISCOVERY-CONFIRMED" : coveragePct >= 0.45 ? "HYBRID" : "BLIND";

  const painRows = P2P_DISCOVERY_PAIN_POINT_FIELDS.map((field) => {
    const entry = discoveryPainPoints[field.id] || emptyPainPoint();
    const present = trimText(entry.present);
    const severity = trimText(entry.severity);
    const score = present === "Yes" ? (SEVERITY_SCORES[severity] || 0) : 0;
    return {
      ...field,
      present,
      severity,
      score,
    };
  });
  const painPointPressure = completionRatio(
    painRows.reduce((total, row) => total + row.score, 0),
    painRows.length * 4,
  );
  const transformationUrgency = painPointPressure >= 0.75
    ? "HIGH — intervention-led bid"
    : painPointPressure >= 0.45
      ? "MEDIUM — balanced bid"
      : "LOW — optimisation bid";

  const weightedFilled = P2P_DISCOVERY_PROXY_FIELDS.reduce((total, field) => (
    total + (trimText(discovery[field.id]) ? field.criticality : 0)
  ), 0) + P2P_DISCOVERY_TECH_FIELDS.reduce((total, field) => total + (trimText(discovery[field.id]) ? 2 : 0), 0);
  const weightedTotal = P2P_DISCOVERY_PROXY_FIELDS.reduce((total, field) => total + field.criticality, 0) + (P2P_DISCOVERY_TECH_FIELDS.length * 2);
  const weightedCompleteness = completionRatio(weightedFilled, weightedTotal);

  return {
    discovery,
    discoveryCoverage,
    discoveryPainPoints,
    effectiveDiscovery,
    benchmarkModel,
    revenueBand,
    discoveryFieldCount: DISCOVERY_FIELD_IDS.length,
    discoveryCount: countFilledP2pDiscoveryFields(discovery),
    coverageRows,
    coverageAnsweredCount: countAnsweredP2pDiscoveryCoverage(discoveryCoverage),
    coverageScore,
    coveragePct,
    sizingMode,
    painRows,
    painAnsweredCount: countAnsweredP2pPainPoints(discoveryPainPoints),
    painPointPressure,
    transformationUrgency,
    weightedCompleteness,
  };
}

export function buildP2pDiscoveryWorkbookInputs(workspace = {}) {
  const discovery = normalizeP2pDiscoveryFields(workspace.discovery || workspace);
  const coverage = normalizeP2pDiscoveryCoverage(workspace.discoveryCoverage || {});
  const painPoints = normalizeP2pDiscoveryPainPoints(workspace.discoveryPainPoints || {});
  const inputs = {};

  Object.entries(P2P_DISCOVERY_CELL_MAP).forEach(([fieldId, cell]) => {
    inputs[cell] = trimText(discovery[fieldId]);
  });

  Object.entries(P2P_DISCOVERY_COVERAGE_CELL_MAP).forEach(([fieldId, cell]) => {
    inputs[cell] = trimText(coverage[fieldId]);
  });

  Object.entries(P2P_DISCOVERY_PAIN_CELL_MAP).forEach(([fieldId, cells]) => {
    const entry = painPoints[fieldId] || emptyPainPoint();
    inputs[cells.present] = trimText(entry.present);
    inputs[cells.severity] = trimText(entry.severity);
  });

  return inputs;
}
