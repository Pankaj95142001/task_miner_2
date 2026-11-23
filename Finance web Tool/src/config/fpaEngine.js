import {
  FPA_PERSONAS,
  FPA_SCOPE_ITEMS,
  FPA_SCOPE_METADATA,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";
import {
  countFilledFpaDiscoveryFields,
  countTotalFpaDiscoveryFields,
  deriveFpaDiscoveryMetrics,
  getAnnualRevenueUsdMillions,
} from "./fpaDiscovery";
import { deriveFpaScopeMetrics } from "./fpaScope";

const PERCENTILE_FACTORS = {
  Auto: 1,
  P25: 0.92,
  P50: 1,
  P75: 1.1,
};

const WORKLOAD_CONFIDENCE_FACTORS = {
  Stretch: 0.92,
  Balanced: 1,
  Conservative: 1.08,
};

const CLOSE_FACTORS = {
  "Simple (<=5 days)": 0.88,
  "Standard (6-8 days)": 1,
  "Moderate (6-8 days)": 1,
  "Complex (9-12 days)": 1.15,
  "Very Complex (>12 days)": 1.28,
};

const PROCESS_FACTORS = {
  Basic: 1.16,
  Nascent: 1.16,
  Developing: 1.08,
  Established: 1,
  Stable: 1,
  Leading: 0.9,
};

const AUTOMATION_FACTORS = {
  "Low (<20%)": 1.08,
  "Medium (20-50%)": 1,
  "High (>50%)": 0.92,
};

const AI_MATURITY_FACTORS = {
  Exploring: 0.78,
  Piloting: 0.92,
  Scaled: 1.05,
  Scaling: 1.05,
  Industrialized: 1.15,
};

const DIGITAL_FACTORS = {
  Legacy: 1.12,
  Traditional: 1.08,
  Modernised: 0.98,
  "Digital-native": 0.9,
  Transitional: 0.98,
  Modern: 0.98,
};

const COMPETITIVE_FACTORS = {
  "Low (1 bidder)": 0.98,
  "Medium (2-3 bidders)": 1.02,
  "High (4+ bidders)": 1.07,
};

const MODERNIZATION_FACTORS = {
  Yes: 1.08,
  No: 0.98,
};

const ERP_FACTORS = {
  "Single modern ERP (S/4, Fusion, D365)": 0.94,
  "Single legacy ERP (ECC, EBS, AX)": 1,
  "Single ERP": 1,
  "Multiple ERPs (2-3)": 1.05,
  "Fragmented (4+ ERPs / spreadsheets)": 1.16,
  "Complex ERP estate (4+)": 1.16,
};

const CONSOLIDATION_FACTORS = {
  "OneStream / FCCS / HFM in place": 0.94,
  "Consolidation inside EPM": 0.96,
  "Spreadsheet consolidation": 1.08,
  "Consolidation outside EPM": 1.08,
  "Mixed consolidation": 1.14,
};

const BI_FACTORS = {
  "Enterprise BI (Power BI / Tableau), governed": 0.95,
  "BI present, governed": 0.95,
  "BI present, ungoverned": 1.02,
  "Excel / PowerPoint reporting": 1.09,
  "No BI layer": 1.09,
};

const DATAMART_FACTORS = {
  "Finance data warehouse / lakehouse": 0.92,
  "Enterprise data platform": 0.92,
  "Partial data marts": 1.03,
  "Direct extracts / manual": 1.12,
  "No marts": 1.12,
};

const GOVERNANCE_FACTORS = {
  "Governed MDM tool": 0.93,
  "Standardized governance": 0.93,
  "Manual governance": 1.12,
  "Mixed governance": 1.02,
  "None / ad hoc": 1.15,
};

const RETAINED_INTENT_FACTORS = {
  Lean: 0.96,
  Hybrid: 1.03,
  "Oversight-heavy": 1.09,
};

const EPM_FACTORS = {
  "Excel-only / legacy": 1.08,
  "SAP (BPC/SAC)": 0.98,
  "SAP BPC": 1.02,
  "Oracle EPM Cloud": 0.95,
  "Oracle EPM": 0.98,
  Anaplan: 0.9,
  OneStream: 0.92,
  "OneStream / FCCS / HFM in place": 0.95,
  "Workday Adaptive": 0.95,
  "Hyperion (on-prem)": 1.05,
  "IBM Planning Analytics": 0.96,
  "Board / Jedox / Other": 1,
  "Adaptive / other": 1,
  "Other / None": 1.08,
};

const REGION_FACTORS = {
  "Global managed services blend": 1,
  "North America weighted": 1.05,
  "Europe weighted": 1.02,
  "APAC weighted": 0.96,
};

const ROLE_LABELS = {
  analyst: "Analyst",
  senior: "Senior Analyst",
  lead: "Tower Lead",
  architect: "Solution Architect",
};

const SCOPE_FAMILY_BY_GROUP = {
  pf: "Planning",
  ra: "Reporting & Analysis",
  bpds: "Business Partnering",
  dg: "Data & Governance",
};

function toNumber(value, fallback = 0) {
  const normalized = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(normalized) ? normalized : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function pick(map, key, fallback = 1) {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
}

function severityLabel(score) {
  if (score >= 75) {
    return "High";
  }

  if (score >= 55) {
    return "Medium";
  }

  return "Low";
}

function confidenceLabel(score) {
  if (score >= 75) {
    return "High confidence";
  }

  if (score >= 55) {
    return "Moderate confidence";
  }

  return "Low confidence";
}

function complexityBand(score) {
  if (score >= 74) {
    return "Very High";
  }

  if (score >= 56) {
    return "High";
  }

  if (score >= 38) {
    return "Moderate";
  }

  return "Low";
}

function resolveBenchmarkPolicy(benchmarkPercentile, dealBenchmarkPolicy) {
  if (benchmarkPercentile === "Use Deal Policy") {
    return dealBenchmarkPolicy || "Auto";
  }

  return benchmarkPercentile || "Auto";
}

function normalizeMix(parts) {
  const keys = Object.keys(parts);
  const total = keys.reduce((sum, key) => sum + Math.max(toNumber(parts[key], 0), 0), 0);

  if (total <= 0) {
    const evenShare = 100 / keys.length;
    return Object.fromEntries(keys.map((key) => [key, evenShare]));
  }

  return Object.fromEntries(keys.map((key) => [key, (Math.max(toNumber(parts[key], 0), 0) / total) * 100]));
}

function getPersona(personaId) {
  return FPA_PERSONAS.find((item) => item.id === personaId) || FPA_PERSONAS[1];
}

function familyEventLoad(family, numeric) {
  if (family === "Planning") {
    return Math.max(4, numeric.planningCyclesPerYear + numeric.forecastCyclesPerYear * 0.6);
  }

  if (family === "Reporting & Analysis") {
    return Math.max(6, numeric.managementReportsPerMonth * 1.8 + numeric.scenarioBurstsPerQuarter * 1.2);
  }

  if (family === "Business Partnering") {
    return Math.max(4, numeric.scenarioBurstsPerQuarter * 2.1 + numeric.managementReportsPerMonth * 0.75);
  }

  return Math.max(3, numeric.dataSourcesCount * 0.85 + numeric.legalEntities * 0.18);
}

function buildRiskRow(label, score, driver, mitigation) {
  return {
    label,
    score: round(clamp(score, 0, 100)),
    severity: severityLabel(score),
    driver,
    mitigation,
  };
}

export function deriveFpaEngine(currentDeal = {}, workspace = {}) {
  const normalized = normalizeFpaWorkspace(workspace);
  const discoveryMetrics = deriveFpaDiscoveryMetrics(normalized);
  const discovery = discoveryMetrics.effectiveDiscovery;
  const benchmarks = normalized.benchmarks;
  const aiBenefit = normalized.aiBenefit;
  const opsModel = normalized.opsModel;
  const rateCard = normalized.rateCard;
  const pricing = normalized.pricing;
  const transition = normalized.transition;
  const governance = normalized.governance;
  const changeLog = normalized.changeLog;

  const discoveryCount = countFilledFpaDiscoveryFields(normalized);
  const discoveryFieldCount = countTotalFpaDiscoveryFields();
  const discoveryFillPct = discoveryMetrics.proxyWeightedCompletenessPct;
  const scopeMetrics = deriveFpaScopeMetrics(normalized.scopeL3, normalized.scopeL2);
  const scopeCount = scopeMetrics.selectedL2Count;
  const scopeCoveragePct = FPA_SCOPE_ITEMS.length ? (scopeCount / FPA_SCOPE_ITEMS.length) * 100 : 0;
  const scopePctById = Object.fromEntries(scopeMetrics.l2RollupRows.map((row) => [row.id, row.scopePct]));

  const numeric = {
    annualRevenueUsdM: Math.max(getAnnualRevenueUsdMillions(discovery.annualRevenueUsdM), 50),
    legalEntities: Math.max(toNumber(discovery.legalEntities, 6), 1),
    businessUnits: Math.max(toNumber(discovery.businessUnits, 4), 1),
    employeeCount000: Math.max(toNumber(discovery.employeeCount000, 18), 1),
    geoCountries: Math.max(toNumber(discovery.geoCountries, 3), 1),
    languagesBeyondEnglish: Math.max(toNumber(discovery.languagesBeyondEnglish, 1), 0),
    dataSourcesCount: Math.max(toNumber(discovery.dataSourcesCount, 4), 1),
    currentTowerStaff: Math.max(toNumber(discovery.currentTowerStaff, 0), 0),
    currentTowerCostBaselineUsd: Math.max(toNumber(discovery.currentTowerCostBaselineUsd, 0), 0),
    planningCyclesPerYear: Math.max(toNumber(benchmarks.planningCyclesPerYear, 4), 1),
    forecastCyclesPerYear: Math.max(toNumber(benchmarks.forecastCyclesPerYear, 12), 1),
    managementReportsPerMonth: Math.max(toNumber(benchmarks.managementReportsPerMonth, 8), 1),
    scenarioBurstsPerQuarter: Math.max(toNumber(benchmarks.scenarioBurstsPerQuarter, 2), 1),
    benchmarkAdjustmentPct: toNumber(benchmarks.benchmarkAdjustmentPct, 0),
    productivityFloorPct: clamp(toNumber(benchmarks.productivityFloorPct, 92), 65, 100),
    addressableAutomationPct: clamp(toNumber(aiBenefit.addressableAutomationPct, 38), 0, 100),
    genAiNarrativePct: clamp(toNumber(aiBenefit.genAiNarrativePct, 24), 0, 100),
    selfServiceShiftPct: clamp(toNumber(aiBenefit.selfServiceShiftPct, 15), 0, 100),
    controlResidualPct: clamp(toNumber(aiBenefit.controlResidualPct, 62), 0, 100),
    adoptionRampMonths: clamp(toNumber(aiBenefit.adoptionRampMonths, 6), 1, 18),
    businessPartnerAccelerationPct: clamp(toNumber(aiBenefit.businessPartnerAccelerationPct, 10), 0, 100),
    onshorePct: clamp(toNumber(opsModel.onshorePct, 24), 0, 100),
    nearshorePct: clamp(toNumber(opsModel.nearshorePct, 18), 0, 100),
    offshorePct: clamp(toNumber(opsModel.offshorePct, 58), 0, 100),
    managerSpan: Math.max(toNumber(opsModel.managerSpan, 10), 4),
    utilisationPct: clamp(toNumber(opsModel.utilisationPct, 82), 65, 92),
    retainedOrgPct: clamp(toNumber(opsModel.retainedOrgPct, 18), 0, 45),
    qualityBufferPct: clamp(toNumber(opsModel.qualityBufferPct, 6), 0, 25),
    analystRateUsd: Math.max(toNumber(rateCard.analystRateUsd, 34), 10),
    seniorRateUsd: Math.max(toNumber(rateCard.seniorRateUsd, 48), 15),
    leadRateUsd: Math.max(toNumber(rateCard.leadRateUsd, 65), 20),
    architectRateUsd: Math.max(toNumber(rateCard.architectRateUsd, 82), 25),
    transitionRateMultiplier: Math.max(toNumber(rateCard.transitionRateMultiplier, 1.12), 0.8),
    transformationPodCostUsd: Math.max(toNumber(rateCard.transformationPodCostUsd, 185000), 25000),
    targetMarginPct: clamp(toNumber(pricing.targetMarginPct, 18), 5, 45),
    floorMarginPct: clamp(toNumber(pricing.floorMarginPct, 12), 2, 35),
    strategicDiscountPct: clamp(toNumber(pricing.strategicDiscountPct, 0), 0, 25),
    gainsharePct: clamp(toNumber(pricing.gainsharePct, 0), 0, 30),
    volumeRiskBufferPct: clamp(toNumber(pricing.volumeRiskBufferPct, 5), 0, 25),
    transitionMonths: clamp(toNumber(transition.transitionMonths, 4), 1, 18),
    knowledgeTransferWeeks: clamp(toNumber(transition.knowledgeTransferWeeks, 6), 1, 24),
    stabilizationWeeks: clamp(toNumber(transition.stabilizationWeeks, 8), 1, 24),
    digitalSprints: clamp(toNumber(transition.digitalSprints, 3), 0, 12),
    travelEnablementUsd: Math.max(toNumber(transition.travelEnablementUsd, 45000), 0),
    evidenceCoveragePct: clamp(toNumber(governance.evidenceCoveragePct, 55), 0, 100),
    benchmarkCorroborationPct: clamp(toNumber(governance.benchmarkCorroborationPct, 50), 0, 100),
    overrideCount: clamp(toNumber(governance.overrideCount, 0), 0, 30),
    discountRatePct: clamp(toNumber(currentDeal.discountRate, 10), 0, 30),
  };

  const resolvedBenchmarkPolicy = resolveBenchmarkPolicy(benchmarks.benchmarkPercentile, currentDeal.benchmarkPolicy);
  const benchmarkFactor = pick(PERCENTILE_FACTORS, resolvedBenchmarkPolicy, 1)
    * pick(WORKLOAD_CONFIDENCE_FACTORS, benchmarks.workloadConfidence, 1)
    * pick(REGION_FACTORS, benchmarks.benchmarkRegion, 1)
    * (1 + numeric.benchmarkAdjustmentPct / 100);

  const complexityMultiplier = clamp(
    pick(CLOSE_FACTORS, discovery.monthlyCloseComplexity, 1)
    * pick(PROCESS_FACTORS, discovery.processMaturity, 1)
    * pick(AUTOMATION_FACTORS, discovery.automationMaturity, 1)
    * pick(DIGITAL_FACTORS, discovery.digitalMaturity, 1)
    * pick(ERP_FACTORS, discovery.erpLandscape, 1)
    * pick(CONSOLIDATION_FACTORS, discovery.consolidationApproach, 1)
    * pick(BI_FACTORS, discovery.biLandscape, 1)
    * pick(DATAMART_FACTORS, discovery.dataMartMaturity, 1)
    * pick(GOVERNANCE_FACTORS, discovery.governanceMode, 1)
    * pick(RETAINED_INTENT_FACTORS, discovery.retainedOrgIntent, 1)
    * pick(MODERNIZATION_FACTORS, discovery.platformModernizationInScope, 1)
    * pick(COMPETITIVE_FACTORS, discovery.competitiveIntensity, 1)
    * pick(EPM_FACTORS, discovery.epmPlatform, 1),
    0.82,
    1.62,
  );

  const businessScaleUnits = Math.max(
    90,
    numeric.annualRevenueUsdM * 0.015
    + numeric.legalEntities * 11
    + numeric.businessUnits * 8
    + numeric.employeeCount000 * 17
    + numeric.geoCountries * 6
    + numeric.languagesBeyondEnglish * 4
    + numeric.dataSourcesCount * 7
    + numeric.currentTowerStaff * 5,
  );

  const aiMaturityFactor = pick(AI_MATURITY_FACTORS, discovery.aiMaturity, 0.92);
  const rampFactor = clamp((12 - numeric.adoptionRampMonths / 2) / 12, 0.45, 1);
  const residualGuardFactor = clamp(1 - numeric.controlResidualPct / 100 * 0.45, 0.3, 1);
  const baseAiReachPct = clamp(
    ((numeric.addressableAutomationPct * 0.6) + (numeric.genAiNarrativePct * 0.25) + (numeric.selfServiceShiftPct * 0.15)) / 100
    * aiMaturityFactor
    * rampFactor,
    0,
    0.5,
  );

  const scopeRows = FPA_SCOPE_ITEMS.map((item) => {
    const metadata = FPA_SCOPE_METADATA[item.id] || {
      family: SCOPE_FAMILY_BY_GROUP[item.groupId] || item.groupLabel,
      weight: 1,
      aiEligiblePct: 0.2,
      lever: "Operational efficiency",
    };
    const scopePct = Math.max(0, Math.min(scopePctById[item.id] || 0, 1));
    const selected = scopePct > 0;
    const annualEventLoad = familyEventLoad(metadata.family, numeric);
    const benchmarkHours = selected
      ? businessScaleUnits * metadata.weight * annualEventLoad * benchmarkFactor * 0.55 * scopePct
      : 0;
    const grossHours = benchmarkHours * complexityMultiplier;
    const businessPartnerBonus = metadata.family === "Business Partnering"
      ? (numeric.businessPartnerAccelerationPct / 100) * 0.06
      : 0;
    const rowReductionPct = clamp(
      baseAiReachPct
      * (metadata.aiEligiblePct / 0.3)
      * residualGuardFactor
      + businessPartnerBonus,
      0,
      0.45,
    );
    const aiHoursSaved = grossHours * rowReductionPct;
    const netHours = Math.max(grossHours - aiHoursSaved, grossHours * 0.42);

    return {
      id: item.id,
      label: item.label,
      groupLabel: item.groupLabel,
      family: metadata.family,
      selected,
      scopePct: round(scopePct, 3),
      weight: metadata.weight,
      annualEventLoad: round(annualEventLoad, 1),
      benchmarkHours: round(benchmarkHours),
      grossHours: round(grossHours),
      aiReductionPct: round(rowReductionPct * 100, 1),
      aiHoursSaved: round(aiHoursSaved),
      netHours: round(netHours),
      valueLever: metadata.lever,
    };
  });

  const selectedScopeRows = scopeRows.filter((row) => row.selected);
  const totalBenchmarkHours = selectedScopeRows.reduce((sum, row) => sum + row.benchmarkHours, 0);
  const totalGrossHours = selectedScopeRows.reduce((sum, row) => sum + row.grossHours, 0);
  const totalAiHoursSaved = selectedScopeRows.reduce((sum, row) => sum + row.aiHoursSaved, 0);
  const totalNetHours = selectedScopeRows.reduce((sum, row) => sum + row.netHours, 0);

  const familyBreakdown = Array.from(
    selectedScopeRows.reduce((map, row) => {
      const entry = map.get(row.family) || {
        family: row.family,
        scopeCount: 0,
        benchmarkHours: 0,
        grossHours: 0,
        aiHoursSaved: 0,
        netHours: 0,
      };
      entry.scopeCount += 1;
      entry.benchmarkHours += row.benchmarkHours;
      entry.grossHours += row.grossHours;
      entry.aiHoursSaved += row.aiHoursSaved;
      entry.netHours += row.netHours;
      map.set(row.family, entry);
      return map;
    }, new Map()).values(),
  ).map((row) => ({
    ...row,
    benchmarkHours: round(row.benchmarkHours),
    grossHours: round(row.grossHours),
    aiHoursSaved: round(row.aiHoursSaved),
    netHours: round(row.netHours),
    aiReductionPct: row.grossHours ? round((row.aiHoursSaved / row.grossHours) * 100, 1) : 0,
  }));

  const complexityDrivers = [
    {
      label: "Monthly close and reporting cadence",
      score: clamp((pick(CLOSE_FACTORS, discovery.monthlyCloseComplexity, 1) - 0.85) * 70, 4, 22),
      detail: discovery.monthlyCloseComplexity || "No close complexity selected",
    },
    {
      label: "Process maturity and governance",
      score: clamp((pick(PROCESS_FACTORS, discovery.processMaturity, 1) + pick(GOVERNANCE_FACTORS, discovery.governanceMode, 1) - 1.8) * 34, 4, 18),
      detail: [discovery.processMaturity, discovery.governanceMode].filter(Boolean).join(" | ") || "No maturity or governance mode captured",
    },
    {
      label: "Technology landscape",
      score: clamp((pick(ERP_FACTORS, discovery.erpLandscape, 1) + pick(EPM_FACTORS, discovery.epmPlatform, 1) + pick(DATAMART_FACTORS, discovery.dataMartMaturity, 1) - 2.7) * 22, 3, 18),
      detail: [discovery.erpLandscape, discovery.epmPlatform, discovery.dataMartMaturity].filter(Boolean).join(" | ") || "No ERP / EPM / data maturity captured",
    },
    {
      label: "Geography and language footprint",
      score: clamp(numeric.geoCountries * 0.45 + numeric.languagesBeyondEnglish * 0.85, 2, 14),
      detail: `${round(numeric.geoCountries)} countries | ${round(numeric.languagesBeyondEnglish)} additional languages`,
    },
    {
      label: "Scope breadth and partnering demand",
      score: clamp(scopeCount * 1.45 + (numeric.businessUnits * 0.4), 2, 16),
      detail: `${scopeCount} selected L2 processes | ${round(numeric.businessUnits)} business units`,
    },
    {
      label: "Commercial and modernization pressure",
      score: clamp((pick(COMPETITIVE_FACTORS, discovery.competitiveIntensity, 1) + pick(MODERNIZATION_FACTORS, discovery.platformModernizationInScope, 1) - 1.8) * 18, 1, 12),
      detail: [discovery.competitiveIntensity, discovery.platformModernizationInScope].filter(Boolean).join(" | ") || "No commercial pressure captured",
    },
  ].map((item) => ({
    ...item,
    score: round(item.score, 1),
  }));

  const complexityScore = round(clamp(complexityDrivers.reduce((sum, item) => sum + item.score, 0), 12, 100), 1);
  const complexityCategory = complexityBand(complexityScore);
  const topComplexityDrivers = [...complexityDrivers].sort((left, right) => right.score - left.score).slice(0, 3);

  const selectedPersona = getPersona(opsModel.selectedPersonaId);
  const deliveryMixPct = normalizeMix({
    onshore: numeric.onshorePct,
    nearshore: numeric.nearshorePct,
    offshore: numeric.offshorePct,
  });
  const productiveHoursPerFte = 2080 * (numeric.utilisationPct / 100);
  const personaEfficiencyFactor = 1 - selectedPersona.productivityUpliftPct / 100 * 0.35;
  const grossFte = productiveHoursPerFte ? totalGrossHours / productiveHoursPerFte : 0;
  const deliveryFte = productiveHoursPerFte ? (totalNetHours / productiveHoursPerFte) * personaEfficiencyFactor : 0;
  const retainedOrgFte = deliveryFte * (numeric.retainedOrgPct / 100);
  const managedFte = deliveryFte + retainedOrgFte;

  const geoRateFactor = (deliveryMixPct.onshore * 1.15 + deliveryMixPct.nearshore * 1 + deliveryMixPct.offshore * 0.86) / 100;
  const roleRateMap = {
    analyst: numeric.analystRateUsd * geoRateFactor,
    senior: numeric.seniorRateUsd * geoRateFactor,
    lead: numeric.leadRateUsd * geoRateFactor,
    architect: numeric.architectRateUsd * geoRateFactor,
  };

  const roleRows = Object.entries(selectedPersona.roleMix).map(([roleId, share]) => {
    const hours = totalNetHours * share;
    const fte = deliveryFte * share;
    const hourlyRate = roleRateMap[roleId] || 0;
    const cost = hours * hourlyRate;
    return {
      roleId,
      roleLabel: ROLE_LABELS[roleId] || roleId,
      sharePct: round(share * 100, 1),
      hours: round(hours),
      fte: round(fte, 2),
      hourlyRate: round(hourlyRate, 2),
      annualCost: round(cost),
    };
  });

  const baseRunCost = roleRows.reduce((sum, row) => sum + row.annualCost, 0);
  const qualityBufferCost = baseRunCost * (numeric.qualityBufferPct / 100);
  const annualRunCost = baseRunCost + qualityBufferCost;
  const blendedHourlyRate = roleRows.reduce((sum, row) => sum + row.hourlyRate * (row.sharePct / 100), 0);
  const transitionCost = (
    numeric.transitionMonths
    * 160
    * Math.max(deliveryFte * 0.35, 1)
    * blendedHourlyRate
    * numeric.transitionRateMultiplier
  ) + numeric.travelEnablementUsd;
  const transformationCost = numeric.digitalSprints * numeric.transformationPodCostUsd;
  const firstYearCost = annualRunCost + transitionCost + transformationCost;

  const floorMargin = clamp(numeric.floorMarginPct / 100, 0.02, 0.45);
  const targetMargin = clamp(numeric.targetMarginPct / 100, floorMargin + 0.01, 0.55);
  const priceFloor = annualRunCost / (1 - floorMargin);
  const priceTarget = annualRunCost / (1 - targetMargin);
  const riskBufferedTarget = priceTarget * (1 + numeric.volumeRiskBufferPct / 100 * 0.35);
  const recommendedPrice = riskBufferedTarget * (1 - numeric.strategicDiscountPct / 100);

  const currentBaselineCost = numeric.currentTowerCostBaselineUsd > 0
    ? numeric.currentTowerCostBaselineUsd
    : numeric.currentTowerStaff > 0
      ? numeric.currentTowerStaff * 2080 * blendedHourlyRate * 1.05
      : annualRunCost * 1.22;

  const annualSavings = Math.max(currentBaselineCost - recommendedPrice, 0);
  const gainshareUpside = annualSavings * (numeric.gainsharePct / 100);
  const savingsPct = currentBaselineCost ? (annualSavings / currentBaselineCost) * 100 : 0;
  const productivityGainPct = grossFte ? ((grossFte - deliveryFte) / grossFte) * 100 : 0;
  const closeAccelerationDays = clamp((pick(CLOSE_FACTORS, discovery.monthlyCloseComplexity, 1) - 0.82) * 12 + baseAiReachPct * 5, 0.5, 4.5);
  const insightCycleReductionPct = clamp(baseAiReachPct * 48 + selectedPersona.productivityUpliftPct * 0.65, 5, 42);
  const forecastAccuracyUpliftPct = clamp(
    (pick(DATAMART_FACTORS, discovery.dataMartMaturity, 1) < 1 ? 4 : 2)
    + (pick(GOVERNANCE_FACTORS, discovery.governanceMode, 1) < 1 ? 3.5 : 1.5)
    + baseAiReachPct * 12,
    2,
    12,
  );

  const transitionPlan = [
    {
      phase: "Mobilize",
      duration: `${Math.max(1, Math.round(numeric.transitionMonths * 0.25))} month`,
      focus: "Governance, access, current-state baselining, and stakeholder mobilization.",
    },
    {
      phase: "Knowledge Transfer",
      duration: `${round(numeric.knowledgeTransferWeeks / 4.3, 1)} months`,
      focus: "Process walk-throughs, report catalog transfer, and shadow operations.",
    },
    {
      phase: "Stabilize",
      duration: `${round(numeric.stabilizationWeeks / 4.3, 1)} months`,
      focus: "Output quality controls, planning cadence hardening, and issue burn-down.",
    },
    {
      phase: "Transform",
      duration: `${numeric.digitalSprints} sprint${numeric.digitalSprints === 1 ? "" : "s"}`,
      focus: "Automation, AI narratives, scenario acceleration, and dashboard industrialization.",
    },
  ];

  const discountRate = numeric.discountRatePct / 100;
  const year0 = -(transitionCost + transformationCost);
  const year1 = annualSavings * 0.65 + gainshareUpside * 0.45;
  const year2 = annualSavings + gainshareUpside * 0.7;
  const year3 = annualSavings * 1.03 + gainshareUpside;
  const npv = year0 + (year1 / ((1 + discountRate) ** 1)) + (year2 / ((1 + discountRate) ** 2)) + (year3 / ((1 + discountRate) ** 3));
  const paybackMonths = annualSavings > 0 ? ((transitionCost + transformationCost) / (annualSavings / 12)) : 0;
  const roiPct = (transitionCost + transformationCost) > 0
    ? (((year1 + year2 + year3) - (transitionCost + transformationCost)) / (transitionCost + transformationCost)) * 100
    : 0;

  const scenarioRows = [
    {
      scenario: "Downside",
      volumeFactor: 1.12,
      aiFactor: 0.82,
      priceFactor: 0.98,
    },
    {
      scenario: "Base",
      volumeFactor: 1,
      aiFactor: 1,
      priceFactor: 1,
    },
    {
      scenario: "Upside",
      volumeFactor: 0.92,
      aiFactor: 1.12,
      priceFactor: 1.03,
    },
  ].map((item) => {
    const scenarioHours = totalNetHours * item.volumeFactor * (1 - (baseAiReachPct * (item.aiFactor - 1) * 0.25));
    const scenarioFte = productiveHoursPerFte ? scenarioHours / productiveHoursPerFte * personaEfficiencyFactor : 0;
    const scenarioCost = annualRunCost * item.volumeFactor * (1 - (item.aiFactor - 1) * 0.18);
    const scenarioPrice = recommendedPrice * item.priceFactor;
    const scenarioSavings = Math.max(currentBaselineCost - scenarioPrice, 0);

    return {
      scenario: item.scenario,
      netHours: round(scenarioHours),
      deliveryFte: round(scenarioFte, 2),
      annualCost: round(scenarioCost),
      annualPrice: round(scenarioPrice),
      annualSavings: round(scenarioSavings),
    };
  });

  const governanceChecksCompleted = [
    governance.qaReviewComplete,
    governance.financeLeadershipReview,
    governance.clientEvidenceValidated,
    governance.benchmarkPackReady,
    governance.calibrationComplete,
  ].filter(Boolean).length;

  const confidenceScore = round(clamp(
    discoveryFillPct * 0.35
    + scopeCoveragePct * 0.15
    + numeric.evidenceCoveragePct * 0.2
    + numeric.benchmarkCorroborationPct * 0.15
    + ((governanceChecksCompleted / 5) * 100) * 0.15
    - numeric.overrideCount * 3,
    0,
    100,
  ));

  const benchmarkRiskScore = clamp(
    (100 - numeric.benchmarkCorroborationPct) * 0.72
    + Math.abs(numeric.benchmarkAdjustmentPct) * 1.2
    + (resolvedBenchmarkPolicy === "P75" ? 8 : 0),
    20,
    92,
  );
  const dataRiskScore = clamp(
    (100 - discoveryFillPct) * 0.65
    + (["No marts", "Direct extracts / manual"].includes(discovery.dataMartMaturity) ? 10 : 0)
    + (["Nascent", "Basic"].includes(discovery.processMaturity) ? 10 : 0),
    18,
    95,
  );
  const transitionRiskScore = clamp(
    (numeric.transitionMonths < 4 ? 22 : 10)
    + (discovery.platformModernizationInScope === "Yes" ? 15 : 4)
    + (complexityScore * 0.38),
    16,
    96,
  );
  const commercialRiskScore = clamp(
    (discovery.competitiveIntensity === "High (4+ bidders)" ? 24 : discovery.competitiveIntensity === "Medium (2-3 bidders)" ? 14 : 8)
    + numeric.strategicDiscountPct * 1.2
    + numeric.volumeRiskBufferPct,
    12,
    88,
  );
  const governanceRiskScore = clamp(
    (100 - ((governanceChecksCompleted / 5) * 100)) * 0.6
    + numeric.overrideCount * 4
    + (100 - numeric.evidenceCoveragePct) * 0.2,
    10,
    95,
  );

  const riskRows = [
    buildRiskRow(
      "Benchmark defensibility",
      benchmarkRiskScore,
      `${numeric.benchmarkCorroborationPct}% corroboration with ${resolvedBenchmarkPolicy} anchor`,
      "Expand corroborating peer references or tighten percentile choice before sign-off.",
    ),
    buildRiskRow(
      "Data quality and proxy sufficiency",
      dataRiskScore,
      `${round(discoveryFillPct)}% discovery completeness and ${discovery.dataMartMaturity || "unknown"} data maturity`,
      "Close missing discovery fields and capture primary data lineage before client-safe outputs.",
    ),
    buildRiskRow(
      "Transition dependency",
      transitionRiskScore,
      `${numeric.transitionMonths} transition months with ${discovery.platformModernizationInScope || "no modernization flag"}`,
      "Sequence stabilization gates and decouple modernization from BAU where possible.",
    ),
    buildRiskRow(
      "Commercial pressure",
      commercialRiskScore,
      `${discovery.competitiveIntensity || "unknown competitiveness"} with ${numeric.strategicDiscountPct}% planned discount`,
      "Reconfirm walk-away floor and isolate optional transformation components.",
    ),
    buildRiskRow(
      "Governance readiness",
      governanceRiskScore,
      `${governanceChecksCompleted}/5 governance gates complete and ${numeric.overrideCount} overrides logged`,
      "Complete review checkpoints and convert working assumptions into evidence-backed positions.",
    ),
  ].sort((left, right) => right.score - left.score);

  const riskScore = round(riskRows.reduce((sum, row) => sum + row.score, 0) / Math.max(riskRows.length, 1));
  const dealRisks = riskRows.slice(0, 3).map((row) => ({
    headline: row.label,
    severity: row.severity,
    summary: row.driver,
    action: row.mitigation,
  }));

  const marginPct = recommendedPrice > 0 ? ((recommendedPrice - annualRunCost) / recommendedPrice) * 100 : 0;
  const recommendationStance = confidenceScore >= 70 && riskScore <= 55
    ? "Advance"
    : confidenceScore >= 55 && riskScore <= 70
      ? "Calibrate"
      : "Hold";

  const recommendationActions = [
    discoveryFillPct < 70 ? "Close missing discovery inputs before locking the benchmark baseline." : null,
    scopeCount < 4 ? "Confirm in-scope FP&A processes with the deal owner and tower lead." : null,
    numeric.evidenceCoveragePct < 70 ? "Increase evidence coverage to support benchmark and pricing assumptions." : null,
    riskScore > 60 ? "Escalate the highest risk items into the governance thread before submission." : null,
    numeric.strategicDiscountPct > 8 ? "Validate discount pressure against the commercial floor and volume-risk buffer." : null,
    governanceChecksCompleted < 3 ? "Complete at least three governance gates before calling the solution submission-ready." : null,
  ].filter(Boolean).slice(0, 4);

  const dashboardCards = [
    {
      label: "Delivery FTE",
      value: round(deliveryFte, 2),
      note: "Net of AI, persona tuning, and utilization.",
    },
    {
      label: "Annual Run Cost",
      value: round(annualRunCost),
      note: "Run-state cost including quality buffer.",
    },
    {
      label: "Recommended Price",
      value: round(recommendedPrice),
      note: "Target margin with risk buffer and discount.",
    },
    {
      label: "Annual Savings",
      value: round(annualSavings),
      note: "Versus current-state baseline cost.",
    },
    {
      label: "Confidence",
      value: confidenceScore,
      note: confidenceLabel(confidenceScore),
    },
    {
      label: "Aggregate Risk",
      value: riskScore,
      note: `${severityLabel(riskScore)} current exposure`,
    },
  ];

  const traceLog = [
    {
      output: "Benchmark hours",
      sources: ["Discovery scale signals", "Benchmark controls", "Scope L3 selection"],
      explanation: "Revenue, entities, data volume, and selected FP&A processes create the gross benchmark hour demand.",
    },
    {
      output: "Complexity band",
      sources: ["Close complexity", "ERP/EPM landscape", "Governance mode", "Geo footprint"],
      explanation: "Structural friction and operating diversity lift or reduce the effective workload multiplier.",
    },
    {
      output: "AI savings hours",
      sources: ["AI levers", "AI maturity", "Per-process eligibility"],
      explanation: "Addressable automation, narrative generation, and self-service shift reduce gross hours at different rates by process family.",
    },
    {
      output: "Delivery FTE",
      sources: ["Net hours", "Persona", "Utilization"],
      explanation: "Net annual hours convert into FTE after persona productivity stance and utilization targets are applied.",
    },
    {
      output: "Run cost",
      sources: ["Rate card", "Role mix", "Ops model"],
      explanation: "Role-based hourly rates and the selected persona mix create the annual managed-services cost structure.",
    },
    {
      output: "Recommended price",
      sources: ["Run cost", "Target margin", "Risk buffer", "Strategic discount"],
      explanation: "The commercial construct adds target economics and volume-risk protection, then applies any discount pressure.",
    },
    {
      output: "Business case",
      sources: ["Savings", "Transition cost", "Transformation cost", "Discount rate"],
      explanation: "Multi-year cash flows and NPV rely on the modeled savings against the current baseline and one-time investments.",
    },
    {
      output: "Recommendation",
      sources: ["Confidence", "Risk", "Margin", "Governance"],
      explanation: "The final tower stance balances commercial viability with evidence quality, governance maturity, and implementation risk.",
    },
  ];

  const benchmarkPack = [
    {
      item: "Benchmark anchor",
      status: resolvedBenchmarkPolicy,
      note: benchmarks.benchmarkRegion,
    },
    {
      item: "Workload confidence",
      status: benchmarks.workloadConfidence,
      note: benchmarks.evidenceMode,
    },
    {
      item: "Productivity floor",
      status: `${numeric.productivityFloorPct}%`,
      note: "Applied as the minimum sustainable productivity baseline.",
    },
    {
      item: "Evidence coverage",
      status: numeric.evidenceCoveragePct >= 70 ? "Ready" : "Build-up required",
      note: `${numeric.evidenceCoveragePct}% evidence coverage`,
    },
    {
      item: "Corroboration",
      status: numeric.benchmarkCorroborationPct >= 65 ? "Corroborated" : "Partial",
      note: `${numeric.benchmarkCorroborationPct}% corroboration across benchmark and delivery evidence`,
    },
    {
      item: "Governance packaging",
      status: governance.benchmarkPackReady ? "Ready" : "Working",
      note: governance.changeNote || "No benchmark-pack commentary recorded yet.",
    },
  ];

  const currentStaffGapPct = numeric.currentTowerStaff > 0 ? ((deliveryFte - numeric.currentTowerStaff) / numeric.currentTowerStaff) * 100 : 0;
  const currentCostGapPct = currentBaselineCost > 0 ? ((annualRunCost - currentBaselineCost) / currentBaselineCost) * 100 : 0;
  const calibration = {
    currentStaff: numeric.currentTowerStaff,
    modeledDeliveryFte: round(deliveryFte, 2),
    staffGapPct: round(currentStaffGapPct, 1),
    currentCostBaselineUsd: round(currentBaselineCost),
    modeledRunCostUsd: round(annualRunCost),
    costGapPct: round(currentCostGapPct, 1),
    benchmarkAdjustmentPct: round(numeric.benchmarkAdjustmentPct, 1),
  };

  const changeLogRows = [
    {
      when: currentDeal.updatedAt || currentDeal.createdAt || "-",
      actor: changeLog.lastReviewer || currentDeal.dealOwnerName || currentDeal.presalesLead || "Workspace Owner",
      summary: changeLog.latestChangeSummary || "Current saved workspace version",
      decision: changeLog.lastDecision || "Working draft",
    },
    {
      when: currentDeal.createdAt || "-",
      actor: currentDeal.dealOwnerName || currentDeal.presalesLead || "Workspace Owner",
      summary: changeLog.versionNote || "Workspace initialized from the shared Deal Master shell.",
      decision: "Version 1 baseline",
    },
  ];

  const valueNarrative = [
    `Estimated annual savings opportunity of ${round(savingsPct, 1)}% versus the captured current-state baseline.`,
    `${round(totalAiHoursSaved)} annual hours are released through AI-backed reporting, narratives, and self-service shifts.`,
    `Delivery model targets ${round(deliveryFte, 2)} managed-service FTE with ${round(retainedOrgFte, 2)} retained customer FTE for oversight and decision rights.`,
    `Recommendation confidence is ${confidenceLabel(confidenceScore).toLowerCase()} with ${riskRows[0]?.severity?.toLowerCase() || "managed"} benchmark and implementation risk concentration.`,
  ];

  const personaComparisons = FPA_PERSONAS.map((persona) => {
    const personaHoursFactor = 1 - persona.productivityUpliftPct / 100 * 0.35;
    const personaFte = productiveHoursPerFte ? (totalNetHours / productiveHoursPerFte) * personaHoursFactor : 0;
    const personaCost = annualRunCost * (personaFte / Math.max(deliveryFte || 1, 1)) * (1 - persona.automationReachPct / 100 * 0.06);
    return {
      id: persona.id,
      label: persona.label,
      productivityUpliftPct: persona.productivityUpliftPct,
      automationReachPct: persona.automationReachPct,
      retainedOrgPct: persona.retainedOrgPct,
      deliveryFte: round(personaFte, 2),
      annualRunCostUsd: round(personaCost),
      note: persona.note,
    };
  });

  const aiSummary = {
    baseAiReachPct: round(baseAiReachPct * 100, 1),
    totalAiHoursSaved: round(totalAiHoursSaved),
    annualRunRateSavingsUsd: round(totalAiHoursSaved * blendedHourlyRate),
    addressableHours: round(totalGrossHours * clamp(numeric.addressableAutomationPct / 100, 0, 1)),
  };

  const opsModelSummary = {
    deliveryMixPct: {
      onshore: round(deliveryMixPct.onshore, 1),
      nearshore: round(deliveryMixPct.nearshore, 1),
      offshore: round(deliveryMixPct.offshore, 1),
    },
    managerCount: round(Math.max(deliveryFte / numeric.managerSpan, 0), 2),
    productiveHoursPerFte: round(productiveHoursPerFte),
    retainedOrgFte: round(retainedOrgFte, 2),
    managedFte: round(managedFte, 2),
  };

  return {
    discoveryCount,
    discoveryFieldCount,
    discoveryFillPct: round(discoveryFillPct, 1),
    scopeCount,
    scopeCoveragePct: round(scopeCoveragePct, 1),
    resolvedBenchmarkPolicy,
    benchmarkFactor: round(benchmarkFactor, 3),
    businessScaleUnits: round(businessScaleUnits, 1),
    complexityMultiplier: round(complexityMultiplier, 3),
    complexityScore,
    complexityCategory,
    complexityDrivers,
    topComplexityDrivers,
    selectedPersona,
    personaComparisons,
    scopeRows,
    selectedScopeRows,
    familyBreakdown,
    totalBenchmarkHours: round(totalBenchmarkHours),
    totalGrossHours: round(totalGrossHours),
    totalAiHoursSaved: round(totalAiHoursSaved),
    totalNetHours: round(totalNetHours),
    aiSummary,
    opsModelSummary,
    roleRows,
    productiveHoursPerFte: round(productiveHoursPerFte),
    grossFte: round(grossFte, 2),
    deliveryFte: round(deliveryFte, 2),
    retainedOrgFte: round(retainedOrgFte, 2),
    annualRunCost: round(annualRunCost),
    qualityBufferCost: round(qualityBufferCost),
    transitionCost: round(transitionCost),
    transformationCost: round(transformationCost),
    firstYearCost: round(firstYearCost),
    blendedHourlyRate: round(blendedHourlyRate, 2),
    priceFloor: round(priceFloor),
    priceTarget: round(priceTarget),
    recommendedPrice: round(recommendedPrice),
    gainshareUpside: round(gainshareUpside),
    marginPct: round(marginPct, 1),
    currentBaselineCost: round(currentBaselineCost),
    annualSavings: round(annualSavings),
    savingsPct: round(savingsPct, 1),
    productivityGainPct: round(productivityGainPct, 1),
    closeAccelerationDays: round(closeAccelerationDays, 1),
    insightCycleReductionPct: round(insightCycleReductionPct, 1),
    forecastAccuracyUpliftPct: round(forecastAccuracyUpliftPct, 1),
    transitionPlan,
    businessCase: {
      year0: round(year0),
      year1: round(year1),
      year2: round(year2),
      year3: round(year3),
      npv: round(npv),
      paybackMonths: round(paybackMonths, 1),
      roiPct: round(roiPct, 1),
    },
    scenarioRows,
    riskRows,
    riskScore,
    dealRisks,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore),
    recommendationStance,
    recommendationActions,
    recommendationNarrative: `The FP&A tower is currently assessed as ${recommendationStance.toLowerCase()} based on ${confidenceLabel(confidenceScore).toLowerCase()}, ${severityLabel(riskScore).toLowerCase()} aggregate risk, and a modeled ${round(marginPct, 1)}% margin at the recommended price point.`,
    dashboardCards,
    traceLog,
    benchmarkPack,
    calibration,
    valueNarrative,
    changeLogRows,
  };
}


