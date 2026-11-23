const DEFAULT_INDUSTRY = "Manufacturing";
const DEFAULT_ANNUAL_REVENUE_USD_B = 5;

const DISCOVERY_DEFAULTS = {
  sizingMotion: "Hybrid sizing",
  industryVertical: "",
  annualRevenueUsdM: "",
  legalEntities: "",
  businessUnits: "",
  employeeCount000: "",
  geoCountries: "",
  languagesBeyondEnglish: "",
  costCentres: "",
  productServiceLines: "",
  forecastCadence: "",
  planningIterationsPerBudget: "",
  forecastVersionsMaintained: "",
  reportPacksPerMonth: "",
  adhocAnalysisIntensity: "",
  epmPlatform: "",
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
  erpLandscape: "",
  consolidationApproach: "",
  biLandscape: "",
  dataMartMaturity: "",
  governanceMode: "",
};

const DEFAULT_EFFECTIVE_VALUES = {
  industryVertical: DEFAULT_INDUSTRY,
  annualRevenueUsdM: DEFAULT_ANNUAL_REVENUE_USD_B,
  forecastCadence: "Monthly Rolling",
  planningIterationsPerBudget: 3,
  forecastVersionsMaintained: 2,
  adhocAnalysisIntensity: "Medium",
  epmPlatform: "Excel-only / legacy",
  monthlyCloseComplexity: "Standard (6-8 days)",
  processMaturity: "Developing",
  automationMaturity: "Low (<20%)",
  aiMaturity: "Exploring",
  digitalMaturity: "Traditional",
  competitiveIntensity: "Medium (2-3 bidders)",
  platformModernizationInScope: "Yes",
  peakMonth1: "Oct",
  peakMonth2: "Nov",
  peakMonth3: "Dec",
  retainedOrgIntent: "Hybrid",
  erpLandscape: "Single legacy ERP (ECC, EBS, AX)",
  consolidationApproach: "Spreadsheet consolidation",
  biLandscape: "Excel / PowerPoint reporting",
  dataMartMaturity: "Direct extracts / manual",
  governanceMode: "None / ad hoc",
};

const INDUSTRY_DEFAULTS = {
  "BFSI": { plannersPerRevenueB: 22, digitalMaturity: "Traditional", forecastCadence: "Monthly Rolling" },
  "CPG & Retail": { plannersPerRevenueB: 15, digitalMaturity: "Traditional", forecastCadence: "Monthly Rolling" },
  "Technology & SaaS": { plannersPerRevenueB: 12, digitalMaturity: "Digital-native", forecastCadence: "Continuous (12-month rolling)" },
  "Manufacturing": { plannersPerRevenueB: 16, digitalMaturity: "Traditional", forecastCadence: "Monthly Rolling" },
  "Healthcare & Pharma": { plannersPerRevenueB: 20, digitalMaturity: "Legacy", forecastCadence: "Quarterly" },
  "Energy & Utilities": { plannersPerRevenueB: 18, digitalMaturity: "Traditional", forecastCadence: "Quarterly" },
  "Telecom & Media": { plannersPerRevenueB: 17, digitalMaturity: "Modernised", forecastCadence: "Monthly Rolling" },
  "Professional Services": { plannersPerRevenueB: 11, digitalMaturity: "Modernised", forecastCadence: "Monthly Rolling" },
};

const REVENUE_BAND_DEFAULTS = {
  "Small ($1-5B)": {
    legalEntities: 3,
    businessUnits: 5,
    employeeCount000: 8,
    geoCountries: 3,
    costCentres: 40,
    productServiceLines: 20,
    reportPacksPerMonth: 10,
    dataSourcesCount: 3,
  },
  "Mid ($5-10B)": {
    legalEntities: 8,
    businessUnits: 10,
    employeeCount000: 20,
    geoCountries: 8,
    costCentres: 120,
    productServiceLines: 40,
    reportPacksPerMonth: 25,
    dataSourcesCount: 6,
  },
  "Large ($10-25B)": {
    legalEntities: 15,
    businessUnits: 20,
    employeeCount000: 45,
    geoCountries: 18,
    costCentres: 300,
    productServiceLines: 80,
    reportPacksPerMonth: 50,
    dataSourcesCount: 10,
  },
  "Mega ($25B+)": {
    legalEntities: 30,
    businessUnits: 40,
    employeeCount000: 90,
    geoCountries: 35,
    costCentres: 700,
    productServiceLines: 150,
    reportPacksPerMonth: 100,
    dataSourcesCount: 15,
  },
};

const TECH_STACK_LOOKUPS = {
  erpLandscape: {
    "Single modern ERP (S/4, Fusion, D365)": { multiplier: 0.95, readiness: 4 },
    "Single legacy ERP (ECC, EBS, AX)": { multiplier: 1.05, readiness: 3 },
    "Multiple ERPs (2-3)": { multiplier: 1.15, readiness: 2 },
    "Fragmented (4+ ERPs / spreadsheets)": { multiplier: 1.3, readiness: 1 },
    "Single ERP": { multiplier: 1.05, readiness: 3 },
    "Complex ERP estate (4+)": { multiplier: 1.3, readiness: 1 },
  },
  consolidationApproach: {
    "OneStream / FCCS / HFM in place": { multiplier: 0.95, readiness: 4 },
    "Consolidation inside EPM": { multiplier: 1, readiness: 3 },
    "Spreadsheet consolidation": { multiplier: 1.15, readiness: 1 },
    "Consolidation outside EPM": { multiplier: 1.15, readiness: 1 },
    "Mixed consolidation": { multiplier: 1.14, readiness: 2 },
  },
  biLandscape: {
    "Enterprise BI (Power BI / Tableau), governed": { multiplier: 0.92, readiness: 4 },
    "BI present, ungoverned": { multiplier: 1, readiness: 3 },
    "Excel / PowerPoint reporting": { multiplier: 1.15, readiness: 1 },
    "No BI layer": { multiplier: 1.15, readiness: 1 },
    "BI present, governed": { multiplier: 0.92, readiness: 4 },
  },
  dataMartMaturity: {
    "Finance data warehouse / lakehouse": { multiplier: 0.92, readiness: 4 },
    "Partial data marts": { multiplier: 1, readiness: 3 },
    "Direct extracts / manual": { multiplier: 1.15, readiness: 1 },
    "No marts": { multiplier: 1.15, readiness: 1 },
    "Enterprise data platform": { multiplier: 0.92, readiness: 4 },
  },
  governanceMode: {
    "Governed MDM tool": { multiplier: 0.95, readiness: 4 },
    "Manual governance": { multiplier: 1.05, readiness: 2 },
    "None / ad hoc": { multiplier: 1.15, readiness: 1 },
    "Mixed governance": { multiplier: 1.02, readiness: 2 },
    "Standardized governance": { multiplier: 0.95, readiness: 4 },
  },
};

const MATURITY_NORMALIZATION = {
  Leading: 1,
  Established: 0.97,
  Developing: 0.93,
  Basic: 0.88,
  Nascent: 0.88,
  Stable: 0.97,
};

const LEGACY_VALUE_MAPS = {
  industryVertical: {
    "Healthcare & Life Sciences": "Healthcare & Pharma",
    Technology: "Technology & SaaS",
    Telecom: "Telecom & Media",
    "Retail & CPG": "CPG & Retail",
  },
  monthlyCloseComplexity: {
    "Moderate (6-8 days)": "Standard (6-8 days)",
  },
  processMaturity: {
    Nascent: "Basic",
    Stable: "Established",
  },
  aiMaturity: {
    Scaling: "Scaled",
    Industrialized: "Scaled",
  },
  digitalMaturity: {
    Transitional: "Modernised",
    Modern: "Modernised",
  },
  erpLandscape: {
    "Single ERP": "Single legacy ERP (ECC, EBS, AX)",
    "Complex ERP estate (4+)": "Fragmented (4+ ERPs / spreadsheets)",
  },
  consolidationApproach: {
    "Consolidation outside EPM": "Spreadsheet consolidation",
  },
  biLandscape: {
    "No BI layer": "Excel / PowerPoint reporting",
    "BI present, governed": "Enterprise BI (Power BI / Tableau), governed",
  },
  dataMartMaturity: {
    "No marts": "Direct extracts / manual",
    "Enterprise data platform": "Finance data warehouse / lakehouse",
  },
  governanceMode: {
    "Standardized governance": "Governed MDM tool",
  },
  epmPlatform: {
    "SAP BPC": "SAP (BPC/SAC)",
    "Oracle EPM": "Oracle EPM Cloud",
    "Adaptive / other": "Workday Adaptive",
  },
};

const NUMBER_FORMATTER = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export const FPA_DISCOVERY_OPTIONS = {
  industryVertical: Object.keys(INDUSTRY_DEFAULTS),
  forecastCadence: ["Quarterly", "Monthly Rolling", "Continuous (12-month rolling)"],
  adhocAnalysisIntensity: ["Low", "Medium", "High"],
  monthlyCloseComplexity: ["Simple (<=5 days)", "Standard (6-8 days)", "Complex (9-12 days)", "Very Complex (>12 days)"],
  processMaturity: ["Basic", "Developing", "Established", "Leading"],
  automationMaturity: ["Low (<20%)", "Medium (20-50%)", "High (>50%)"],
  aiMaturity: ["Exploring", "Piloting", "Scaled"],
  digitalMaturity: ["Legacy", "Traditional", "Modernised", "Digital-native"],
  competitiveIntensity: ["Low (1 bidder)", "Medium (2-3 bidders)", "High (4+ bidders)"],
  platformModernizationInScope: ["Yes", "No"],
  retainedOrgIntent: ["Lean", "Hybrid", "Oversight-heavy"],
  epmPlatform: ["Excel-only / legacy", "SAP (BPC/SAC)", "Oracle EPM Cloud", "Anaplan", "OneStream", "Workday Adaptive", "Hyperion (on-prem)", "IBM Planning Analytics", "Board / Jedox / Other"],
  commonEpmTools: ["Excel-only / legacy", "SAP (BPC/SAC)", "Oracle EPM Cloud", "Anaplan", "OneStream", "Workday Adaptive", "Hyperion (on-prem)", "IBM Planning Analytics", "Board / Jedox / Other"],
  erpLandscape: Object.keys(TECH_STACK_LOOKUPS.erpLandscape).filter((value) => !["Single ERP", "Complex ERP estate (4+)"] .includes(value)),
  consolidationApproach: ["OneStream / FCCS / HFM in place", "Consolidation inside EPM", "Spreadsheet consolidation"],
  biLandscape: ["Enterprise BI (Power BI / Tableau), governed", "BI present, ungoverned", "Excel / PowerPoint reporting"],
  dataMartMaturity: ["Finance data warehouse / lakehouse", "Partial data marts", "Direct extracts / manual"],
  governanceMode: ["Governed MDM tool", "Manual governance", "None / ad hoc"],
  yesNo: ["Yes", "No"],
  painSeverity: ["Low", "Medium", "High", "Critical"],
};

export const FPA_DISCOVERY_PROXY_GROUPS = [
  { id: "scale", label: "Business and volume proxies" },
  { id: "cadence", label: "Planning cadence and reporting" },
  { id: "maturity", label: "Maturity and transformation context" },
  { id: "calendar", label: "Calendar, operating model, and staffing" },
];

export const FPA_DISCOVERY_PROXY_FIELDS = [
  { row: 7, id: "industryVertical", groupId: "scale", label: "Industry Vertical", control: "select", optionsKey: "industryVertical", criticality: 2, defaultSource: "Workbook default: Manufacturing" },
  { row: 8, id: "annualRevenueUsdM", groupId: "scale", label: "Annual Revenue (USD $B)", control: "number", step: "0.1", placeholder: "5", criticality: 3, defaultSource: "Workbook default: 5" },
  { row: 9, id: "revenueBand", groupId: "scale", label: "Revenue Band (auto)", control: "derived", derived: true, criticality: 0, defaultSource: "Derived from annual revenue" },
  { row: 10, id: "legalEntities", groupId: "scale", label: "# Legal Entities", control: "number", criticality: 3, defaultSource: "Revenue-band benchmark default" },
  { row: 11, id: "businessUnits", groupId: "scale", label: "# Business Units", control: "number", criticality: 3, defaultSource: "Revenue-band benchmark default" },
  { row: 12, id: "employeeCount000", groupId: "scale", label: "Employee Count (000s)", control: "number", criticality: 2, defaultSource: "Revenue-band benchmark default" },
  { row: 13, id: "geoCountries", groupId: "scale", label: "Geographic Footprint (# countries)", control: "number", criticality: 2, defaultSource: "Revenue-band benchmark default" },
  { row: 14, id: "languagesBeyondEnglish", groupId: "scale", label: "Languages beyond English (#)", control: "number", criticality: 1, defaultSource: "Workbook default: 0" },
  { row: 15, id: "costCentres", groupId: "scale", label: "# Cost Centres", control: "number", criticality: 2, defaultSource: "Revenue-band benchmark default" },
  { row: 16, id: "productServiceLines", groupId: "scale", label: "# Products / Service Lines", control: "number", criticality: 2, defaultSource: "Revenue-band benchmark default" },
  { row: 17, id: "forecastCadence", groupId: "cadence", label: "Forecast Cadence", control: "select", optionsKey: "forecastCadence", criticality: 2, defaultSource: "Industry benchmark default" },
  { row: 18, id: "planningIterationsPerBudget", groupId: "cadence", label: "Planning Iterations per Budget", control: "number", criticality: 2, defaultSource: "Workbook default: 3" },
  { row: 19, id: "forecastVersionsMaintained", groupId: "cadence", label: "Forecast Versions Maintained", control: "number", criticality: 1, defaultSource: "Workbook default: 2" },
  { row: 20, id: "reportPacksPerMonth", groupId: "cadence", label: "# Report Packs / month", control: "number", criticality: 3, defaultSource: "Revenue-band benchmark default" },
  { row: 21, id: "adhocAnalysisIntensity", groupId: "cadence", label: "Ad-hoc Analysis Intensity", control: "select", optionsKey: "adhocAnalysisIntensity", criticality: 1, defaultSource: "Workbook default: Medium" },
  { row: 22, id: "epmPlatform", groupId: "cadence", label: "EPM Tool in Place", control: "select", optionsKey: "epmPlatform", criticality: 3, defaultSource: "Workbook default: Excel-only / legacy" },
  { row: 23, id: "monthlyCloseComplexity", groupId: "maturity", label: "Monthly Close Complexity", control: "select", optionsKey: "monthlyCloseComplexity", criticality: 2, defaultSource: "Workbook default: Standard (6-8 days)" },
  { row: 24, id: "processMaturity", groupId: "maturity", label: "Planning and Forecasting Maturity", control: "select", optionsKey: "processMaturity", criticality: 2, defaultSource: "Workbook default: Developing" },
  { row: 25, id: "automationMaturity", groupId: "maturity", label: "Automation Maturity", control: "select", optionsKey: "automationMaturity", criticality: 2, defaultSource: "Workbook default: Low (<20%)" },
  { row: 26, id: "aiMaturity", groupId: "maturity", label: "AI Maturity", control: "select", optionsKey: "aiMaturity", criticality: 2, defaultSource: "Workbook default: Exploring" },
  { row: 28, id: "competitiveIntensity", groupId: "maturity", label: "Competitive Intensity", control: "select", optionsKey: "competitiveIntensity", criticality: 1, defaultSource: "Workbook default: Medium (2-3 bidders)" },
  { row: 29, id: "platformModernizationInScope", groupId: "maturity", label: "EPM Modernisation in Transformation Scope?", control: "select", optionsKey: "platformModernizationInScope", criticality: 2, defaultSource: "Workbook default: Yes" },
  { row: 30, id: "peakMonth1", groupId: "calendar", label: "Peak Month 1", control: "month", criticality: 1, defaultSource: "Workbook default: Oct" },
  { row: 31, id: "peakMonth2", groupId: "calendar", label: "Peak Month 2", control: "month", criticality: 1, defaultSource: "Workbook default: Nov" },
  { row: 32, id: "peakMonth3", groupId: "calendar", label: "Peak Month 3", control: "month", criticality: 1, defaultSource: "Workbook default: Dec" },
  { row: 34, id: "dataSourcesCount", groupId: "calendar", label: "# Data Sources feeding the tower", control: "number", criticality: 2, defaultSource: "Revenue-band benchmark default" },
  { row: 35, id: "currentTowerStaff", groupId: "calendar", label: "# FP&A Planners / BPs (current)", control: "number", criticality: 3, defaultSource: "Industry planners-per-$B benchmark" },
  { row: 36, id: "currentTowerCostBaselineUsd", groupId: "calendar", label: "Current FP&A Cost Baseline (USD/yr)", control: "number", criticality: 2, defaultSource: "No workbook default; proxy derived if blank" },
];

export const FPA_DISCOVERY_COVERAGE_FIELDS = [
  { row: 41, id: "volumesCoreDrivers", label: "Volumes (FP&A core drivers)", weight: 10 },
  { row: 42, id: "currentFteByProcess", label: "Current FTE by process", weight: 10 },
  { row: 43, id: "platformAndMaturity", label: "Platform and maturity", weight: 10 },
  { row: 44, id: "automationAlreadyAchieved", label: "Automation % already achieved", weight: 10 },
  { row: 45, id: "kpiBaselineCycleMetrics", label: "KPI baseline / cycle metrics", weight: 10 },
  { row: 46, id: "activityInventory", label: "Activity / report inventory (with effort)", weight: 10 },
  { row: 47, id: "closeCalendar", label: "Close / process calendar", weight: 10 },
  { row: 48, id: "existingSlasKpis", label: "Existing SLAs / KPIs", weight: 10 },
  { row: 49, id: "currentCostBaseline", label: "Current cost baseline", weight: 10 },
  { row: 50, id: "painPointsPriorities", label: "Pain points and priorities", weight: 10 },
  { row: 51, id: "retainedOrgIntentShared", label: "Retained-org intent shared", weight: 10 },
  { row: 52, id: "dataSourceLandscape", label: "Data-source landscape", weight: 10 },
  { row: 53, id: "peakCalendarConfirmed", label: "Peak calendar confirmed", weight: 10 },
];

export const FPA_DISCOVERY_TECH_FIELDS = [
  { row: 64, id: "erpLandscape", label: "ERP GL feed", optionsKey: "erpLandscape", defaultSource: DEFAULT_EFFECTIVE_VALUES.erpLandscape },
  { row: 65, id: "consolidationApproach", label: "Close / consolidation tool", optionsKey: "consolidationApproach", defaultSource: DEFAULT_EFFECTIVE_VALUES.consolidationApproach },
  { row: 66, id: "biLandscape", label: "BI / reporting layer", optionsKey: "biLandscape", defaultSource: DEFAULT_EFFECTIVE_VALUES.biLandscape },
  { row: 67, id: "dataMartMaturity", label: "Finance data layer", optionsKey: "dataMartMaturity", defaultSource: DEFAULT_EFFECTIVE_VALUES.dataMartMaturity },
  { row: 68, id: "governanceMode", label: "Master data management", optionsKey: "governanceMode", defaultSource: DEFAULT_EFFECTIVE_VALUES.governanceMode },
];

export const FPA_DISCOVERY_PAIN_POINT_FIELDS = [
  { row: 80, id: "budgetCycleTooLong", label: "Budget cycle too long (>12 weeks)" },
  { row: 81, id: "forecastAccuracyPoor", label: "Forecast accuracy poor (>10% MAPE)" },
  { row: 82, id: "excelDependentConsolidation", label: "Excel-dependent consolidation" },
  { row: 83, id: "reportProliferation", label: "Report proliferation / low usage" },
  { row: 84, id: "lateCloseDelays", label: "Late close delays flash and commentary" },
  { row: 85, id: "weakDriverGovernance", label: "Weak driver governance" },
  { row: 86, id: "limitedScenarioCapability", label: "Limited scenario capability" },
  { row: 87, id: "businessPartnersConsumedByDataPrep", label: "Business partners consumed by data prep" },
];

const PROXY_EDITABLE_FIELD_IDS = FPA_DISCOVERY_PROXY_FIELDS.filter((field) => !field.derived).map((field) => field.id);
const TECH_FIELD_IDS = FPA_DISCOVERY_TECH_FIELDS.map((field) => field.id);

export const FPA_DISCOVERY_TOTAL_INPUT_FIELDS = PROXY_EDITABLE_FIELD_IDS.length + TECH_FIELD_IDS.length;

function trimValue(value) {
  return String(value ?? "").trim();
}

function toNumberOrNull(value) {
  const normalized = Number.parseFloat(trimValue(value).replace(/,/g, ""));
  return Number.isFinite(normalized) ? normalized : null;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mapLegacyValue(fieldId, value) {
  const normalized = trimValue(value);
  if (!normalized) {
    return "";
  }

  return LEGACY_VALUE_MAPS[fieldId]?.[normalized] || normalized;
}

function emptyEvidence() {
  return {
    source: "",
    confidence: "",
    owner: "",
    date: "",
    fileName: "",
    sheetName: "",
    cell: "",
    effectiveCell: "",
    effectiveValue: "",
    sourceClass: "",
    sourceClassCode: "",
    criticality: "",
    defaultSource: "",
    rawDateLabel: "",
    defaulted: false,
  };
}

function emptyPainPoint() {
  return {
    present: "",
    severity: "",
  };
}

function getIndustryDefaults(industryVertical) {
  return INDUSTRY_DEFAULTS[industryVertical] || INDUSTRY_DEFAULTS[DEFAULT_INDUSTRY];
}

function getRevenueBandDefaults(revenueBand) {
  return REVENUE_BAND_DEFAULTS[revenueBand] || REVENUE_BAND_DEFAULTS["Mid ($5-10B)"];
}

function resolveNumericRawValue(discovery, fieldId, fallback) {
  const rawNumeric = toNumberOrNull(discovery[fieldId]);
  return rawNumeric === null ? fallback : rawNumeric;
}

function resolveTechSignal(fieldId, rawValue) {
  const lookup = TECH_STACK_LOOKUPS[fieldId] || {};
  const normalizedRawValue = mapLegacyValue(fieldId, rawValue);
  const defaultValue = DEFAULT_EFFECTIVE_VALUES[fieldId] || "";
  const effectiveValue = normalizedRawValue || defaultValue;
  const lookupValue = lookup[effectiveValue] || { multiplier: 1, readiness: 2 };

  return {
    effectiveValue,
    multiplier: lookupValue.multiplier,
    readiness: lookupValue.readiness,
    defaulted: !trimValue(rawValue),
  };
}

function painSeverityScore(present, severity) {
  if (present !== "Yes") {
    return 0;
  }

  if (severity === "Critical") {
    return 4;
  }

  if (severity === "High") {
    return 3;
  }

  if (severity === "Medium") {
    return 2;
  }

  return 1;
}

export function deriveRevenueBand(annualRevenueUsdB) {
  const revenueBillions = toNumberOrNull(annualRevenueUsdB);
  const safeRevenueBillions = revenueBillions === null ? DEFAULT_ANNUAL_REVENUE_USD_B : revenueBillions;

  if (safeRevenueBillions < 5) {
    return "Small ($1-5B)";
  }

  if (safeRevenueBillions < 10) {
    return "Mid ($5-10B)";
  }

  if (safeRevenueBillions < 25) {
    return "Large ($10-25B)";
  }

  return "Mega ($25B+)";
}

export function getAnnualRevenueUsdMillions(value) {
  const numeric = toNumberOrNull(value);
  if (numeric === null) {
    return 0;
  }

  return numeric <= 200 ? numeric * 1000 : numeric;
}

export function createDefaultFpaDiscovery() {
  return { ...DISCOVERY_DEFAULTS };
}

export function createDefaultFpaDiscoveryEvidence() {
  return Object.fromEntries(PROXY_EDITABLE_FIELD_IDS.map((fieldId) => [fieldId, emptyEvidence()]));
}

export function createDefaultFpaDiscoveryCoverage() {
  return Object.fromEntries(FPA_DISCOVERY_COVERAGE_FIELDS.map((field) => [field.id, ""]));
}

export function createDefaultFpaDiscoveryPainPoints() {
  return Object.fromEntries(FPA_DISCOVERY_PAIN_POINT_FIELDS.map((field) => [field.id, emptyPainPoint()]));
}

export function normalizeFpaDiscoveryFields(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  const normalized = {
    ...createDefaultFpaDiscovery(),
    ...incoming,
  };

  Object.keys(normalized).forEach((fieldId) => {
    normalized[fieldId] = typeof normalized[fieldId] === "string"
      ? normalized[fieldId].trim()
      : normalized[fieldId];
  });

  Object.keys(LEGACY_VALUE_MAPS).forEach((fieldId) => {
    normalized[fieldId] = mapLegacyValue(fieldId, normalized[fieldId]);
  });

  return normalized;
}

export function normalizeFpaDiscoveryEvidence(value = {}) {
  const defaults = createDefaultFpaDiscoveryEvidence();
  const incoming = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    Object.keys(defaults).map((fieldId) => {
      const candidate = incoming[fieldId] && typeof incoming[fieldId] === "object" ? incoming[fieldId] : {};
      return [
        fieldId,
        {
          ...defaults[fieldId],
          source: trimValue(candidate.source),
          confidence: trimValue(candidate.confidence),
          owner: trimValue(candidate.owner),
          date: trimValue(candidate.date),
          fileName: trimValue(candidate.fileName),
          sheetName: trimValue(candidate.sheetName),
          cell: trimValue(candidate.cell),
          effectiveCell: trimValue(candidate.effectiveCell),
          effectiveValue: trimValue(candidate.effectiveValue),
          sourceClass: trimValue(candidate.sourceClass),
          sourceClassCode: trimValue(candidate.sourceClassCode),
          criticality: trimValue(candidate.criticality),
          defaultSource: trimValue(candidate.defaultSource),
          rawDateLabel: trimValue(candidate.rawDateLabel),
          defaulted: Boolean(candidate.defaulted),
        },
      ];
    }),
  );
}
export function normalizeFpaDiscoveryCoverage(value = {}) {
  const defaults = createDefaultFpaDiscoveryCoverage();
  const incoming = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    Object.keys(defaults).map((fieldId) => [fieldId, trimValue(incoming[fieldId])]),
  );
}

export function normalizeFpaDiscoveryPainPoints(value = {}) {
  const defaults = createDefaultFpaDiscoveryPainPoints();
  const incoming = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    Object.keys(defaults).map((fieldId) => {
      const candidate = incoming[fieldId] && typeof incoming[fieldId] === "object" ? incoming[fieldId] : {};
      return [
        fieldId,
        {
          present: trimValue(candidate.present),
          severity: trimValue(candidate.severity),
        },
      ];
    }),
  );
}

export function countTotalFpaDiscoveryFields() {
  return FPA_DISCOVERY_TOTAL_INPUT_FIELDS;
}

export function countFilledFpaDiscoveryFields(workspace) {
  const normalizedDiscovery = normalizeFpaDiscoveryFields(workspace?.discovery || workspace);
  return [...PROXY_EDITABLE_FIELD_IDS, ...TECH_FIELD_IDS].filter((fieldId) => trimValue(normalizedDiscovery[fieldId])).length;
}

export function formatFpaDiscoveryValue(fieldId, value) {
  const normalized = value ?? "";

  if (fieldId === "currentTowerCostBaselineUsd" && typeof normalized === "string" && normalized.trim() && Number.isNaN(Number(normalized))) {
    return normalized;
  }

  const numeric = toNumberOrNull(normalized);

  if (numeric !== null) {
    if (fieldId === "annualRevenueUsdM") {
      return `$${NUMBER_FORMATTER.format(numeric)}B`;
    }

    if (fieldId === "currentTowerCostBaselineUsd") {
      return `$${NUMBER_FORMATTER.format(numeric)}`;
    }

    if (fieldId === "employeeCount000") {
      return `${NUMBER_FORMATTER.format(numeric)}k`;
    }

    return NUMBER_FORMATTER.format(numeric);
  }

  return trimValue(normalized) || "-";
}

export function deriveFpaDiscoveryMetrics(workspace) {
  const discovery = normalizeFpaDiscoveryFields(workspace?.discovery || workspace);
  const discoveryEvidence = normalizeFpaDiscoveryEvidence(workspace?.discoveryEvidence);
  const discoveryCoverage = normalizeFpaDiscoveryCoverage(workspace?.discoveryCoverage);
  const discoveryPainPoints = normalizeFpaDiscoveryPainPoints(workspace?.discoveryPainPoints);

  const industryVertical = trimValue(discovery.industryVertical) || DEFAULT_INDUSTRY;
  const annualRevenueUsdB = resolveNumericRawValue(discovery, "annualRevenueUsdM", DEFAULT_ANNUAL_REVENUE_USD_B);
  const revenueBand = deriveRevenueBand(annualRevenueUsdB);
  const industryDefaults = getIndustryDefaults(industryVertical);
  const bandDefaults = getRevenueBandDefaults(revenueBand);

  const effectiveDiscovery = {
    ...discovery,
    industryVertical,
    annualRevenueUsdM: annualRevenueUsdB,
    legalEntities: resolveNumericRawValue(discovery, "legalEntities", bandDefaults.legalEntities),
    businessUnits: resolveNumericRawValue(discovery, "businessUnits", bandDefaults.businessUnits),
    employeeCount000: resolveNumericRawValue(discovery, "employeeCount000", bandDefaults.employeeCount000),
    geoCountries: resolveNumericRawValue(discovery, "geoCountries", bandDefaults.geoCountries),
    languagesBeyondEnglish: resolveNumericRawValue(discovery, "languagesBeyondEnglish", 0),
    costCentres: resolveNumericRawValue(discovery, "costCentres", bandDefaults.costCentres),
    productServiceLines: resolveNumericRawValue(discovery, "productServiceLines", bandDefaults.productServiceLines),
    forecastCadence: trimValue(discovery.forecastCadence) || industryDefaults.forecastCadence,
    planningIterationsPerBudget: resolveNumericRawValue(discovery, "planningIterationsPerBudget", 3),
    forecastVersionsMaintained: resolveNumericRawValue(discovery, "forecastVersionsMaintained", 2),
    reportPacksPerMonth: resolveNumericRawValue(discovery, "reportPacksPerMonth", bandDefaults.reportPacksPerMonth),
    adhocAnalysisIntensity: trimValue(discovery.adhocAnalysisIntensity) || DEFAULT_EFFECTIVE_VALUES.adhocAnalysisIntensity,
    epmPlatform: trimValue(discovery.epmPlatform) || DEFAULT_EFFECTIVE_VALUES.epmPlatform,
    monthlyCloseComplexity: trimValue(discovery.monthlyCloseComplexity) || DEFAULT_EFFECTIVE_VALUES.monthlyCloseComplexity,
    processMaturity: trimValue(discovery.processMaturity) || DEFAULT_EFFECTIVE_VALUES.processMaturity,
    automationMaturity: trimValue(discovery.automationMaturity) || DEFAULT_EFFECTIVE_VALUES.automationMaturity,
    aiMaturity: trimValue(discovery.aiMaturity) || DEFAULT_EFFECTIVE_VALUES.aiMaturity,
    digitalMaturity: trimValue(discovery.digitalMaturity) || industryDefaults.digitalMaturity,
    competitiveIntensity: trimValue(discovery.competitiveIntensity) || DEFAULT_EFFECTIVE_VALUES.competitiveIntensity,
    platformModernizationInScope: trimValue(discovery.platformModernizationInScope) || DEFAULT_EFFECTIVE_VALUES.platformModernizationInScope,
    peakMonth1: trimValue(discovery.peakMonth1) || DEFAULT_EFFECTIVE_VALUES.peakMonth1,
    peakMonth2: trimValue(discovery.peakMonth2) || DEFAULT_EFFECTIVE_VALUES.peakMonth2,
    peakMonth3: trimValue(discovery.peakMonth3) || DEFAULT_EFFECTIVE_VALUES.peakMonth3,
    retainedOrgIntent: trimValue(discovery.retainedOrgIntent) || DEFAULT_EFFECTIVE_VALUES.retainedOrgIntent,
    dataSourcesCount: resolveNumericRawValue(discovery, "dataSourcesCount", bandDefaults.dataSourcesCount),
    currentTowerStaff: resolveNumericRawValue(discovery, "currentTowerStaff", Math.round(industryDefaults.plannersPerRevenueB * annualRevenueUsdB)),
    currentTowerCostBaselineUsd: trimValue(discovery.currentTowerCostBaselineUsd),
  };

  const proxyRows = FPA_DISCOVERY_PROXY_FIELDS.map((field) => {
    const rawValue = field.derived ? "" : discovery[field.id];
    const effectiveValue = field.id === "revenueBand"
      ? revenueBand
      : field.id === "currentTowerCostBaselineUsd"
        ? trimValue(discovery.currentTowerCostBaselineUsd) || "n/a - proxy used"
        : effectiveDiscovery[field.id];

    return {
      ...field,
      rawValue,
      effectiveValue,
      isDefaulted: !field.derived && !trimValue(rawValue),
      evidence: field.derived ? emptyEvidence() : discoveryEvidence[field.id] || emptyEvidence(),
    };
  });

  const proxyInputCount = PROXY_EDITABLE_FIELD_IDS.length;
  const proxyFilledCount = PROXY_EDITABLE_FIELD_IDS.filter((fieldId) => trimValue(discovery[fieldId])).length;
  const proxyWeightedTotalPoints = proxyRows.reduce((sum, field) => sum + field.criticality, 0);
  const proxyWeightedFilledPoints = proxyRows.reduce(
    (sum, field) => sum + ((!field.derived && trimValue(field.rawValue)) ? field.criticality : 0),
    0,
  );
  const proxyWeightedCompletenessPct = proxyWeightedTotalPoints
    ? (proxyWeightedFilledPoints / proxyWeightedTotalPoints) * 100
    : 0;

  let proxyCompletenessStatus = "GREEN - adequate input coverage";
  if (proxyWeightedCompletenessPct < 50) {
    proxyCompletenessStatus = "RED - critical proxies missing";
  } else if (proxyWeightedCompletenessPct < 70) {
    proxyCompletenessStatus = "AMBER - thin inputs: size is proxy-driven";
  }

  const coverageRows = FPA_DISCOVERY_COVERAGE_FIELDS.map((field) => {
    const response = discoveryCoverage[field.id];
    return {
      ...field,
      response,
      score: response === "Yes" ? field.weight : 0,
    };
  });

  const coverageWeightTotal = coverageRows.reduce((sum, field) => sum + field.weight, 0);
  const coverageScore = coverageRows.reduce((sum, field) => sum + field.score, 0);
  const coverageAnsweredCount = coverageRows.filter((field) => field.response).length;
  const coverageScorePct = coverageWeightTotal ? (coverageScore / coverageWeightTotal) * 100 : 0;

  let coverageMode = "DISCOVERY-CONFIRMED";
  if (coverageScorePct < 30) {
    coverageMode = "PURE BLIND SIZING";
  } else if (coverageScorePct < 70) {
    coverageMode = "HYBRID SIZING";
  }

  const sizingMotion = coverageMode === "PURE BLIND SIZING"
    ? "Blind sizing"
    : coverageMode === "HYBRID SIZING"
      ? "Hybrid sizing"
      : "Discovery confirmed";

  const techRows = FPA_DISCOVERY_TECH_FIELDS.map((field) => {
    const signal = resolveTechSignal(field.id, discovery[field.id]);
    effectiveDiscovery[field.id] = signal.effectiveValue;

    return {
      ...field,
      rawValue: discovery[field.id],
      effectiveValue: signal.effectiveValue,
      multiplier: signal.multiplier,
      readiness: signal.readiness,
      defaulted: signal.defaulted,
    };
  });

  const techEffortMultiplier = techRows.length
    ? clamp(techRows.reduce((sum, field) => sum + field.multiplier, 0) / techRows.length, 0.85, 1.35)
    : 1;
  const techReadinessScore = techRows.length
    ? techRows.reduce((sum, field) => sum + field.readiness, 0) / techRows.length
    : 0;
  const techLandscape = techReadinessScore >= 3.3 ? "MODERN" : techReadinessScore >= 2.3 ? "TRANSITIONAL" : "LEGACY";
  const techModernizationGate = techReadinessScore >= 2.3 ? 1 : 0;
  const techMaturityNormalization = MATURITY_NORMALIZATION[effectiveDiscovery.processMaturity] || 1;
  const techDefaultedCount = techRows.filter((field) => field.defaulted).length;

  const painRows = FPA_DISCOVERY_PAIN_POINT_FIELDS.map((field) => {
    const state = discoveryPainPoints[field.id] || emptyPainPoint();
    const score = painSeverityScore(state.present, state.severity);
    return {
      ...field,
      present: state.present,
      severity: state.severity,
      score,
    };
  });

  const painAnsweredCount = painRows.filter((field) => field.present).length;
  const painPressurePct = (painRows.reduce((sum, field) => sum + field.score, 0) / (painRows.length * 4)) * 100;
  const painMotion = painPressurePct >= 60
    ? "HIGH - transformation-led bid"
    : painPressurePct >= 35
      ? "MEDIUM - balanced bid"
      : "LOW - continuity-led bid";

  effectiveDiscovery.sizingMotion = sizingMotion;

  return {
    discovery,
    effectiveDiscovery,
    proxyRows,
    proxyInputCount,
    proxyFilledCount,
    proxyWeightedFilledPoints,
    proxyWeightedTotalPoints,
    proxyWeightedCompletenessPct: round(proxyWeightedCompletenessPct, 1),
    proxyCompletenessStatus,
    coverageRows,
    coverageWeightTotal,
    coverageAnsweredCount,
    coverageScorePct: round(coverageScorePct, 1),
    coverageMode,
    sizingMotion,
    techRows,
    techEffortMultiplier: round(techEffortMultiplier, 2),
    techReadinessScore: round(techReadinessScore, 2),
    techLandscape,
    techModernizationGate,
    techMaturityNormalization,
    techDefaultedCount,
    painRows,
    painAnsweredCount,
    painPressurePct: round(painPressurePct, 1),
    painMotion,
    discoveryCount: countFilledFpaDiscoveryFields({ discovery }),
    discoveryFieldCount: countTotalFpaDiscoveryFields(),
    rawDiscoveryFillPct: round((countFilledFpaDiscoveryFields({ discovery }) / countTotalFpaDiscoveryFields()) * 100, 1),
  };
}



