import { average, clamp, trimText, toNumberOrNull } from "./p2pMath";

const DEFAULT_INDUSTRY = "Manufacturing";
const DEFAULT_PLATFORM = "ERP AP module only (manual)";
const DEFAULT_CLOSE_COMPLEXITY = "Standard (6-8 days)";
const DEFAULT_PROCESS_MATURITY = "Developing";
const DEFAULT_AI_MATURITY = "Exploring";
const DEFAULT_PERCENTILE = "P50";
const DEFAULT_PROCESS_CADENCE = "Monthly Rolling";
const DEFAULT_ADHOC_INTENSITY = "None";

export const P2P_INDUSTRY_BENCHMARKS = [
  { label: "BFSI", volumeMultiplier: 1.5, complexityMultiplier: 1.4, automationCeiling: 0.48, regulatoryLoad: 4, ftePerRevenueB: 22, defaultDigitalMaturity: "Traditional" },
  { label: "CPG & Retail", volumeMultiplier: 1.1, complexityMultiplier: 1.1, automationCeiling: 0.58, regulatoryLoad: 3, ftePerRevenueB: 40, defaultDigitalMaturity: "Traditional" },
  { label: "Technology & SaaS", volumeMultiplier: 0.9, complexityMultiplier: 1.2, automationCeiling: 0.65, regulatoryLoad: 2, ftePerRevenueB: 25, defaultDigitalMaturity: "Digital-native" },
  { label: "Manufacturing", volumeMultiplier: 1.2, complexityMultiplier: 1.15, automationCeiling: 0.55, regulatoryLoad: 3, ftePerRevenueB: 45, defaultDigitalMaturity: "Traditional" },
  { label: "Healthcare & Pharma", volumeMultiplier: 1.3, complexityMultiplier: 1.3, automationCeiling: 0.48, regulatoryLoad: 5, ftePerRevenueB: 35, defaultDigitalMaturity: "Legacy" },
  { label: "Energy & Utilities", volumeMultiplier: 1.15, complexityMultiplier: 1.2, automationCeiling: 0.5, regulatoryLoad: 4, ftePerRevenueB: 40, defaultDigitalMaturity: "Traditional" },
  { label: "Telecom & Media", volumeMultiplier: 1.2, complexityMultiplier: 1.1, automationCeiling: 0.58, regulatoryLoad: 3, ftePerRevenueB: 35, defaultDigitalMaturity: "Modernised" },
  { label: "Professional Services", volumeMultiplier: 0.85, complexityMultiplier: 0.95, automationCeiling: 0.52, regulatoryLoad: 2, ftePerRevenueB: 25, defaultDigitalMaturity: "Modernised" },
];

export const P2P_REVENUE_BAND_DEFAULTS = [
  { label: "Small ($1-5B)", legalEntities: 3, businessUnits: 5, employeeCount000: 8, geoCountries: 3, supplierInvoices000: 250, purchaseOrders000: 80, requisitions000: 60, activeVendors000: 10, paymentRunsPerMonth: 20, tneClaims000: 40, dataSourcesCount: 3 },
  { label: "Mid ($5-10B)", legalEntities: 8, businessUnits: 10, employeeCount000: 20, geoCountries: 8, supplierInvoices000: 600, purchaseOrders000: 200, requisitions000: 150, activeVendors000: 25, paymentRunsPerMonth: 40, tneClaims000: 100, dataSourcesCount: 6 },
  { label: "Large ($10-25B)", legalEntities: 15, businessUnits: 20, employeeCount000: 45, geoCountries: 18, supplierInvoices000: 1400, purchaseOrders000: 450, requisitions000: 350, activeVendors000: 55, paymentRunsPerMonth: 80, tneClaims000: 220, dataSourcesCount: 10 },
  { label: "Mega ($25B+)", legalEntities: 30, businessUnits: 40, employeeCount000: 90, geoCountries: 35, supplierInvoices000: 3000, purchaseOrders000: 1000, requisitions000: 750, activeVendors000: 120, paymentRunsPerMonth: 150, tneClaims000: 450, dataSourcesCount: 15 },
];

export const P2P_BASELINE_MONTHLY_HOURS = {
  requisitionSourcingSupport: { small: 200, mid: 360, large: 600, mega: 900 },
  poManagement: { small: 250, mid: 450, large: 750, mega: 1130 },
  vendorMaster: { small: 90, mid: 160, large: 270, mega: 400 },
  invoiceProcessing: { small: 600, mid: 1080, large: 1800, mega: 2700 },
  threeWayMatch: { small: 150, mid: 270, large: 450, mega: 680 },
  exceptionQueryHandling: { small: 500, mid: 900, large: 1500, mega: 2250 },
  paymentsDisbursement: { small: 110, mid: 200, large: 330, mega: 500 },
  travelExpense: { small: 130, mid: 230, large: 380, mega: 570 },
  supplierReconciliationStatements: { small: 110, mid: 200, large: 330, mega: 500 },
  reportingControlsGovernance: { small: 60, mid: 110, large: 180, mega: 270 },
};

export const P2P_AI_CEILING_BY_MATURITY = {
  None: 0.08,
  Exploring: 0.12,
  Piloting: 0.2,
  Scaled: 0.3,
};

export const P2P_CLOSE_ADJUSTMENTS = {
  "Simple (<=5 days)": 0.9,
  "Standard (6-8 days)": 1,
  "Complex (9-12 days)": 1.12,
  "Very Complex (>12 days)": 1.25,
};

export const P2P_PRIMARY_PLATFORM_ADJUSTMENTS = {
  "ERP AP module only (manual)": 1.2,
  "SAP Ariba": 0.88,
  "Coupa": 0.85,
  "Basware": 0.9,
  "Tungsten / Kofax (IDP) + ERP": 0.95,
  "Oracle Fusion Procurement": 0.93,
  "SAP S/4 MM/AP + partial workflow": 1,
  "Other / mixed": 1.1,
};

export const P2P_DRIVER_NORMS = {
  requisitionSourcingSupport: { param1: 0.05, param2: 20, meaning: "h per requisition + base" },
  poManagement: { param1: 0.04, param2: 15, meaning: "h per PO + base" },
  vendorMaster: { param1: 8, param2: 15, meaning: "h per 1,000 vendors + base" },
  invoiceProcessing: { param1: 0.03, meaning: "h per invoice" },
  threeWayMatch: { param1: 0.012, param2: 0.6, meaning: "h per PO-backed invoice" },
  exceptionQueryHandling: { param1: 0.15, meaning: "h per exception invoice" },
  paymentsDisbursement: { param1: 6, param2: 2, meaning: "h per payment run + h per 1,000 vendors" },
  travelExpense: { param1: 0.05, meaning: "h per claim" },
  supplierReconciliationStatements: { param1: 10, param2: 10, meaning: "h per 1,000 vendors + base" },
  reportingControlsGovernance: { param1: 30, param2: 4, param3: 2, meaning: "base + h/entity + h/BU" },
};

export const P2P_PERCENTILE_FACTORS = {
  P25: 0.75,
  P50: 1,
  P75: 1.35,
};

export const P2P_CADENCE_CYCLES = {
  "Continuous (12-month rolling)": 18,
  "Monthly Rolling": 12,
  Quarterly: 4,
  Annual: 1,
};

export const P2P_ADHOC_ALLOWANCES = {
  None: 0,
  Low: 0.15,
  Medium: 0.25,
  High: 0.4,
};

export const P2P_APPLICABILITY_MATRIX = {
  requisitionSourcingSupport: { platform: 1, close: 0, volume: 1, complexity: 1, data: 1 },
  poManagement: { platform: 1, close: 0, volume: 1, complexity: 1, data: 1 },
  vendorMaster: { platform: 1, close: 0, volume: 0, complexity: 1, data: 1 },
  invoiceProcessing: { platform: 1, close: 1, volume: 1, complexity: 1, data: 1 },
  threeWayMatch: { platform: 1, close: 0, volume: 1, complexity: 1, data: 1 },
  exceptionQueryHandling: { platform: 1, close: 0, volume: 1, complexity: 1, data: 1 },
  paymentsDisbursement: { platform: 1, close: 1, volume: 0, complexity: 1, data: 1 },
  travelExpense: { platform: 1, close: 0, volume: 1, complexity: 1, data: 1 },
  supplierReconciliationStatements: { platform: 1, close: 1, volume: 0, complexity: 1, data: 1 },
  reportingControlsGovernance: { platform: 1, close: 0, volume: 0, complexity: 1, data: 1 },
};

export const P2P_SEASONALITY_FACTORS = {
  Jan: 1,
  Feb: 1,
  Mar: 1.2,
  Apr: 1,
  May: 1,
  Jun: 1,
  Jul: 1,
  Aug: 1,
  Sep: 1,
  Oct: 1,
  Nov: 1.2,
  Dec: 1.2,
};

export const P2P_CAPACITY_PROXIES = {
  clientLoadedCostPerFte: 70000,
  clientCostInflation: 0.04,
  productiveHoursPerFteMonth: 147,
};

export const P2P_NORMALISATION_BY_MATURITY = {
  Leading: 1,
  Established: 0.97,
  Developing: 0.93,
  Basic: 0.88,
};

export const P2P_VARIANCE_THRESHOLDS = {
  avsDRed: 0.4,
  avsDAmber: 0.3,
  driverVsBandAmber: 0.4,
};

export const P2P_TECH_OPTION_SETS = {
  ocrIdpCapture: {
    label: "OCR / IDP capture",
    defaultValue: "Basic OCR",
    options: {
      "IDP with AI extraction (>90% capture)": { effortMultiplier: 0.88, readiness: 4 },
      "Basic OCR": { effortMultiplier: 1, readiness: 3 },
      "Manual keying": { effortMultiplier: 1.2, readiness: 1 },
    },
  },
  supplierNetwork: {
    label: "E-invoicing / supplier network",
    defaultValue: "<30% electronic",
    options: {
      ">70% electronic": { effortMultiplier: 0.9, readiness: 4 },
      "30-70% electronic": { effortMultiplier: 1, readiness: 3 },
      "<30% electronic": { effortMultiplier: 1.15, readiness: 1 },
    },
  },
  bankConnectivity: {
    label: "Payment platform / bank connectivity",
    defaultValue: "Bank portals, partial integration",
    options: {
      "Payment hub (Kyriba / SAP BCM) integrated": { effortMultiplier: 0.9, readiness: 4 },
      "Bank portals, partial integration": { effortMultiplier: 1, readiness: 3 },
      "Manual bank uploads": { effortMultiplier: 1.15, readiness: 1 },
    },
  },
  tneTool: {
    label: "T&E tool",
    defaultValue: "Concur / Expensify integrated",
    options: {
      "Concur / Expensify integrated": { effortMultiplier: 0.9, readiness: 4 },
      "T&E tool, partial integration": { effortMultiplier: 1, readiness: 3 },
      "Spreadsheet claims": { effortMultiplier: 1.2, readiness: 1 },
    },
  },
  reportingBiLayer: {
    label: "P2P reporting / BI layer",
    defaultValue: "Excel reporting",
    options: {
      "Governed P2P dashboards": { effortMultiplier: 0.92, readiness: 4 },
      "BI present, ungoverned": { effortMultiplier: 1, readiness: 3 },
      "Excel reporting": { effortMultiplier: 1.15, readiness: 1 },
    },
  },
  vendorMasterDataManagement: {
    label: "Vendor master data management",
    defaultValue: "None / ad hoc",
    options: {
      "Governed MDM tool": { effortMultiplier: 0.95, readiness: 4 },
      "Manual governance": { effortMultiplier: 1.05, readiness: 2 },
      "None / ad hoc": { effortMultiplier: 1.15, readiness: 1 },
    },
  },
};

export const P2P_SELECT_OPTIONS = {
  industryVertical: P2P_INDUSTRY_BENCHMARKS.map((item) => item.label),
  primaryPlatform: Object.keys(P2P_PRIMARY_PLATFORM_ADJUSTMENTS),
  monthlyCloseComplexity: Object.keys(P2P_CLOSE_ADJUSTMENTS),
  processMaturity: Object.keys(P2P_NORMALISATION_BY_MATURITY),
  automationMaturity: ["Low (<20%)", "Medium (20-40%)", "High (40-60%)", "Very High (>60%)"],
  aiMaturity: Object.keys(P2P_AI_CEILING_BY_MATURITY),
  digitalMaturity: ["Legacy", "Traditional", "Modernised", "Digital-native"],
  competitiveIntensity: ["Low (single bidder)", "Medium (2-3 bidders)", "High (4+ bidders)"],
  yesNo: ["Yes", "No"],
  retainedOrgIntent: ["Transfer", "Hybrid", "Retain"],
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  severity: ["Low", "Medium", "High", "Critical"],
  status: ["Y", "Partial", "N"],
  disposition: ["Transfer", "Retain", "Review"],
  locationIntent: ["Follow model", "Retain onshore", "Nearshore first", "Offshore first"],
  percentile: Object.keys(P2P_PERCENTILE_FACTORS),
  processCadence: Object.keys(P2P_CADENCE_CYCLES),
  adHocIntensity: Object.keys(P2P_ADHOC_ALLOWANCES),
};

const DEFAULT_BENCHMARK_SETTINGS = Object.freeze({
  percentile: DEFAULT_PERCENTILE,
  processCadence: DEFAULT_PROCESS_CADENCE,
  adHocIntensity: DEFAULT_ADHOC_INTENSITY,
});

function bandKey(label) {
  if (label.startsWith("Small")) {
    return "small";
  }
  if (label.startsWith("Mid")) {
    return "mid";
  }
  if (label.startsWith("Large")) {
    return "large";
  }
  return "mega";
}

export function createDefaultP2pBenchmarkSettings() {
  return { ...DEFAULT_BENCHMARK_SETTINGS };
}

export function normalizeP2pBenchmarkSettings(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  return {
    percentile: trimText(incoming.percentile) || DEFAULT_BENCHMARK_SETTINGS.percentile,
    processCadence: trimText(incoming.processCadence) || DEFAULT_BENCHMARK_SETTINGS.processCadence,
    adHocIntensity: trimText(incoming.adHocIntensity) || DEFAULT_BENCHMARK_SETTINGS.adHocIntensity,
  };
}

export function countTouchedP2pBenchmarkSettings(value = {}) {
  const normalized = normalizeP2pBenchmarkSettings(value);
  return Object.keys(DEFAULT_BENCHMARK_SETTINGS).filter((key) => normalized[key] !== DEFAULT_BENCHMARK_SETTINGS[key]).length;
}

export function deriveP2pRevenueBand(value) {
  const revenue = toNumberOrNull(value);
  if (revenue === null || revenue < 5) {
    return "Small ($1-5B)";
  }
  if (revenue < 10) {
    return "Mid ($5-10B)";
  }
  if (revenue < 25) {
    return "Large ($10-25B)";
  }
  return "Mega ($25B+)";
}

export function getP2pIndustryBenchmark(industry) {
  const normalized = trimText(industry) || DEFAULT_INDUSTRY;
  return P2P_INDUSTRY_BENCHMARKS.find((item) => item.label === normalized) || P2P_INDUSTRY_BENCHMARKS.find((item) => item.label === DEFAULT_INDUSTRY);
}

export function getP2pRevenueBandDefaults(band) {
  return P2P_REVENUE_BAND_DEFAULTS.find((item) => item.label === band) || P2P_REVENUE_BAND_DEFAULTS[0];
}

export function getP2pPrimaryPlatformAdjustment(platform) {
  return P2P_PRIMARY_PLATFORM_ADJUSTMENTS[trimText(platform) || DEFAULT_PLATFORM] || P2P_PRIMARY_PLATFORM_ADJUSTMENTS[DEFAULT_PLATFORM];
}

export function getP2pCloseAdjustment(value) {
  return P2P_CLOSE_ADJUSTMENTS[trimText(value) || DEFAULT_CLOSE_COMPLEXITY] || P2P_CLOSE_ADJUSTMENTS[DEFAULT_CLOSE_COMPLEXITY];
}

export function getP2pPercentileFactor(value) {
  return P2P_PERCENTILE_FACTORS[trimText(value) || DEFAULT_PERCENTILE] || P2P_PERCENTILE_FACTORS[DEFAULT_PERCENTILE];
}

export function getP2pCadenceCycles(value) {
  return P2P_CADENCE_CYCLES[trimText(value) || DEFAULT_PROCESS_CADENCE] || P2P_CADENCE_CYCLES[DEFAULT_PROCESS_CADENCE];
}

export function getP2pAdHocAllowance(value) {
  return P2P_ADHOC_ALLOWANCES[trimText(value) || DEFAULT_ADHOC_INTENSITY] || P2P_ADHOC_ALLOWANCES[DEFAULT_ADHOC_INTENSITY];
}

export function getP2pNormalisationFactor(processMaturity) {
  return P2P_NORMALISATION_BY_MATURITY[trimText(processMaturity) || DEFAULT_PROCESS_MATURITY] || P2P_NORMALISATION_BY_MATURITY[DEFAULT_PROCESS_MATURITY];
}

export function getP2pAiBenefitCeiling(aiMaturity) {
  return P2P_AI_CEILING_BY_MATURITY[trimText(aiMaturity) || DEFAULT_AI_MATURITY] || P2P_AI_CEILING_BY_MATURITY[DEFAULT_AI_MATURITY];
}

export function deriveP2pTechSummary(discovery = {}) {
  const layers = Object.entries(P2P_TECH_OPTION_SETS).map(([fieldId, definition]) => {
    const rawValue = trimText(discovery[fieldId]);
    const effectiveValue = rawValue || definition.defaultValue;
    const option = definition.options[effectiveValue] || definition.options[definition.defaultValue];

    return {
      id: fieldId,
      label: definition.label,
      rawValue,
      effectiveValue,
      effortMultiplier: option.effortMultiplier,
      readiness: option.readiness,
      defaulted: !rawValue,
    };
  });

  const dataIntegrationMultiplier = clamp(average(layers.map((item) => item.effortMultiplier)), 0.85, 1.35);
  const dataReadinessScore = average(layers.map((item) => item.readiness));
  const techStackClass = dataReadinessScore >= 3.25 ? "MODERN" : dataReadinessScore >= 2.25 ? "MIXED" : "LEGACY";
  const normalisationFactor = getP2pNormalisationFactor(discovery.processMaturity);
  const defaultedLayers = layers.filter((item) => item.defaulted).length;
  const aiMaturity = trimText(discovery.aiMaturity) || DEFAULT_AI_MATURITY;
  const agenticDataGate = dataReadinessScore >= 3 && ["Piloting", "Scaled"].includes(aiMaturity) ? 1 : 0;

  return {
    layers,
    dataIntegrationMultiplier,
    dataReadinessScore,
    techStackClass,
    normalisationFactor,
    defaultedLayers,
    agenticDataGate,
  };
}

export function buildP2pBenchmarkModel(discovery = {}, settings = {}) {
  const normalizedSettings = normalizeP2pBenchmarkSettings(settings);
  const industryBenchmark = getP2pIndustryBenchmark(discovery.industryVertical);
  const revenueBand = deriveP2pRevenueBand(discovery.annualRevenueUsdB);
  const revenueDefaults = getP2pRevenueBandDefaults(revenueBand);
  const technology = deriveP2pTechSummary(discovery);
  const aiBenefitCeiling = Math.min(industryBenchmark.automationCeiling, getP2pAiBenefitCeiling(discovery.aiMaturity));

  return {
    revenueBand,
    bandIndex: P2P_REVENUE_BAND_DEFAULTS.findIndex((item) => item.label === revenueBand) + 1,
    industryBenchmark,
    revenueDefaults,
    complexityMultiplier: industryBenchmark.complexityMultiplier,
    volumeMultiplier: industryBenchmark.volumeMultiplier,
    primaryPlatformAdjustment: getP2pPrimaryPlatformAdjustment(discovery.p2pPlatform),
    closeAdjustment: getP2pCloseAdjustment(discovery.monthlyCloseComplexity),
    percentile: normalizedSettings.percentile,
    percentileFactor: getP2pPercentileFactor(normalizedSettings.percentile),
    processCadence: normalizedSettings.processCadence,
    cyclesPerYear: getP2pCadenceCycles(normalizedSettings.processCadence),
    adHocIntensity: normalizedSettings.adHocIntensity,
    adHocAllowance: getP2pAdHocAllowance(normalizedSettings.adHocIntensity),
    aiBenefitCeiling,
    automationCeiling: industryBenchmark.automationCeiling,
    regulatoryLoad: industryBenchmark.regulatoryLoad,
    currentClientFtePerRevenueB: industryBenchmark.ftePerRevenueB,
    dataIntegrationMultiplier: technology.dataIntegrationMultiplier,
    dataReadinessScore: technology.dataReadinessScore,
    techStackClass: technology.techStackClass,
    normalisationFactor: technology.normalisationFactor,
    defaultedTechLayers: technology.defaultedLayers,
    agenticDataGate: technology.agenticDataGate,
    technologyLayers: technology.layers,
    applicabilityByL2: P2P_APPLICABILITY_MATRIX,
    seasonalityFactors: P2P_SEASONALITY_FACTORS,
    productiveHoursPerFteMonth: P2P_CAPACITY_PROXIES.productiveHoursPerFteMonth,
    clientLoadedCostPerFte: P2P_CAPACITY_PROXIES.clientLoadedCostPerFte,
    clientCostInflation: P2P_CAPACITY_PROXIES.clientCostInflation,
    varianceThresholds: P2P_VARIANCE_THRESHOLDS,
  };
}

export function getP2pBandSeedHours(l2Id, revenueBand) {
  const row = P2P_BASELINE_MONTHLY_HOURS[l2Id];
  if (!row) {
    return 0;
  }

  return row[bandKey(revenueBand)] || 0;
}
