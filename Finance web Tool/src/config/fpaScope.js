const DEFAULT_SCOPE_ROW = {
  status: "N",
  partialPct: "0",
  retainedToo: "",
  disposition: "",
  locationIntent: "",
};

const DEFAULT_SCOPE_L2_ROW = {
  status: "N",
  partialPct: "0",
  sourceLabel: "",
};

export const FPA_SCOPE_WORKBOOK_TITLE = "03. Scope Switchboard — FP&A L2 x L3 catalogue";
export const FPA_SCOPE_WORKBOOK_NOTE = "If source docs provide L3 activities, scope is calculated from L3 rows. Otherwise, the portal falls back to source-backed L2 process status only. Unreferenced rows stay 0.";
export const FPA_SCOPE_WORKBOOK_ROLLUP_TITLE = "L2 Roll-up — Scope % (feeds 05 Workload)";
export const FPA_SCOPE_WORKBOOK_FOOTNOTE = "Note: for a Hybrid retained-intent, mark strategic / judgement-heavy L3s Partial (e.g. 50%).";

export const FPA_SCOPE_STATUS_OPTIONS = ["Y", "Partial", "N"];
export const FPA_SCOPE_RETAINED_OPTIONS = ["Y", "N"];

export const FPA_SCOPE_L2_ROWS = [
  { id: "strategicLongRangePlanning", row: 62, l2Number: 1, label: "Strategic & Long-Range Planning", cluster: "P&F", l3Count: 4 },
  { id: "budgetingPlanning", row: 63, l2Number: 2, label: "Annual Budgeting & Target Setting", cluster: "P&F", l3Count: 6 },
  { id: "rollingForecastingIbp", row: 64, l2Number: 3, label: "Rolling Forecasting & IBP", cluster: "P&F", l3Count: 6 },
  { id: "commercialForecasting", row: 65, l2Number: 4, label: "Revenue & Commercial Forecasting", cluster: "P&F", l3Count: 4 },
  { id: "costProductivityMarginManagement", row: 66, l2Number: 5, label: "Cost, Productivity & Margin Management", cluster: "R&A", l3Count: 4 },
  { id: "workforceCapacityPlanning", row: 67, l2Number: 6, label: "Workforce & Capacity Planning", cluster: "P&F", l3Count: 3 },
  { id: "cashFlowCapitalPlanning", row: 68, l2Number: 7, label: "Cash Flow & Capital Planning", cluster: "P&F", l3Count: 3 },
  { id: "variancePerformanceManagement", row: 69, l2Number: 8, label: "Variance Analysis & Performance Management", cluster: "R&A", l3Count: 5 },
  { id: "managementReportingDecisionSupport", row: 70, l2Number: 9, label: "Management Reporting & Decision Support", cluster: "R&A", l3Count: 5 },
  { id: "scenarioRiskModeling", row: 71, l2Number: 10, label: "Scenario Planning & Risk Modelling", cluster: "P&F", l3Count: 3 },
  { id: "profitabilityPricingBusinessCases", row: 72, l2Number: 11, label: "Profitability, Pricing & Business Cases", cluster: "BP&DS", l3Count: 3 },
  { id: "governanceMasterDataBusinessPartnering", row: 73, l2Number: 12, label: "Governance, Master Data & Business Partnering", cluster: "D&G", l3Count: 6 },
];

const L2_LOOKUP = Object.fromEntries(FPA_SCOPE_L2_ROWS.map((row) => [row.id, row]));

const BASE_SCOPE_L3_ROWS = [
  { id: "strategicLrpModelBuildRefresh", row: 6, l2Id: "strategicLongRangePlanning", activity: "LRP model build/refresh", cluster: "P&F" },
  { id: "strategicScenarioSupport", row: 7, l2Id: "strategicLongRangePlanning", activity: "Strategic scenario support", cluster: "P&F" },
  { id: "strategicTargetCascade", row: 8, l2Id: "strategicLongRangePlanning", activity: "Target cascade", cluster: "P&F" },
  { id: "strategicBoardStrategyPackSupport", row: 9, l2Id: "strategicLongRangePlanning", activity: "Board strategy pack support", cluster: "P&F" },
  { id: "annualCalendarTemplates", row: 10, l2Id: "budgetingPlanning", activity: "Calendar & templates", cluster: "P&F" },
  { id: "annualTargetSettingSupport", row: 11, l2Id: "budgetingPlanning", activity: "Target setting support", cluster: "P&F" },
  { id: "annualSubmissionCollectionValidation", row: 12, l2Id: "budgetingPlanning", activity: "Submission collection & validation", cluster: "P&F" },
  { id: "annualConsolidationIteration", row: 13, l2Id: "budgetingPlanning", activity: "Consolidation & iteration", cluster: "P&F" },
  { id: "annualBridgeWalkAnalysis", row: 14, l2Id: "budgetingPlanning", activity: "Bridge & walk analysis", cluster: "P&F" },
  { id: "annualApprovalPack", row: 15, l2Id: "budgetingPlanning", activity: "Approval pack", cluster: "P&F" },
  { id: "forecastDataStagingValidation", row: 16, l2Id: "rollingForecastingIbp", activity: "Data staging & validation", cluster: "P&F" },
  { id: "forecastDriverUpdate", row: 17, l2Id: "rollingForecastingIbp", activity: "Driver update", cluster: "P&F" },
  { id: "forecastBuCollection", row: 18, l2Id: "rollingForecastingIbp", activity: "BU forecast collection", cluster: "P&F" },
  { id: "forecastConsolidationVersionControl", row: 19, l2Id: "rollingForecastingIbp", activity: "Consolidation & version control", cluster: "P&F" },
  { id: "forecastIbpSopAlignment", row: 20, l2Id: "rollingForecastingIbp", activity: "IBP / S&OP alignment", cluster: "P&F" },
  { id: "forecastAccuracyTracking", row: 21, l2Id: "rollingForecastingIbp", activity: "Forecast accuracy tracking", cluster: "P&F" },
  { id: "revenuePipelineBacklogAnalytics", row: 22, l2Id: "commercialForecasting", activity: "Pipeline / backlog analytics", cluster: "P&F" },
  { id: "revenuePricingVolumeMixAnalysis", row: 23, l2Id: "commercialForecasting", activity: "Pricing-volume-mix analysis", cluster: "P&F" },
  { id: "revenueModelMaintenance", row: 24, l2Id: "commercialForecasting", activity: "Revenue model maintenance", cluster: "P&F" },
  { id: "revenueCommercialReviewsSupport", row: 25, l2Id: "commercialForecasting", activity: "Commercial reviews support", cluster: "P&F" },
  { id: "costCentreReporting", row: 26, l2Id: "costProductivityMarginManagement", activity: "Cost-centre reporting", cluster: "R&A" },
  { id: "spendAnalytics", row: 27, l2Id: "costProductivityMarginManagement", activity: "Spend analytics", cluster: "R&A" },
  { id: "productivityTracking", row: 28, l2Id: "costProductivityMarginManagement", activity: "Productivity tracking", cluster: "R&A" },
  { id: "allocationMaintenance", row: 29, l2Id: "costProductivityMarginManagement", activity: "Allocation maintenance", cluster: "R&A" },
  { id: "workforceHeadcountReporting", row: 30, l2Id: "workforceCapacityPlanning", activity: "Headcount reporting", cluster: "P&F" },
  { id: "workforcePositionVacancyTracking", row: 31, l2Id: "workforceCapacityPlanning", activity: "Position / vacancy tracking", cluster: "P&F" },
  { id: "workforceCostModelling", row: 32, l2Id: "workforceCapacityPlanning", activity: "Workforce cost modelling", cluster: "P&F" },
  { id: "cashDirectIndirectForecast", row: 33, l2Id: "cashFlowCapitalPlanning", activity: "Direct / indirect cash forecast", cluster: "P&F" },
  { id: "cashCapexBusinessCaseSupport", row: 34, l2Id: "cashFlowCapitalPlanning", activity: "Capex tracking & business-case support", cluster: "P&F" },
  { id: "cashWorkingCapitalAnalytics", row: 35, l2Id: "cashFlowCapitalPlanning", activity: "Working-capital analytics", cluster: "P&F" },
  { id: "varianceFlashResults", row: 36, l2Id: "variancePerformanceManagement", activity: "Flash results", cluster: "R&A" },
  { id: "varianceDecomposition", row: 37, l2Id: "variancePerformanceManagement", activity: "Variance decomposition", cluster: "R&A" },
  { id: "varianceCommentaryDrafting", row: 38, l2Id: "variancePerformanceManagement", activity: "Commentary drafting", cluster: "R&A" },
  { id: "varianceKpiScorecards", row: 39, l2Id: "variancePerformanceManagement", activity: "KPI scorecards", cluster: "R&A" },
  { id: "variancePerformanceReviewPacks", row: 40, l2Id: "variancePerformanceManagement", activity: "Performance-review packs", cluster: "R&A" },
  { id: "reportingRecurringPackProduction", row: 41, l2Id: "managementReportingDecisionSupport", activity: "Recurring pack production", cluster: "R&A" },
  { id: "reportingDashboardRefresh", row: 42, l2Id: "managementReportingDecisionSupport", activity: "Dashboard refresh", cluster: "R&A" },
  { id: "reportingAdhocAnalysis", row: 43, l2Id: "managementReportingDecisionSupport", activity: "Ad-hoc analysis", cluster: "R&A" },
  { id: "reportingExecBoardPackSupport", row: 44, l2Id: "managementReportingDecisionSupport", activity: "Exec / board pack support", cluster: "R&A" },
  { id: "reportingDataReconciliation", row: 45, l2Id: "managementReportingDecisionSupport", activity: "Data reconciliation for reporting", cluster: "R&A" },
  { id: "scenarioBuilds", row: 46, l2Id: "scenarioRiskModeling", activity: "Scenario builds", cluster: "P&F" },
  { id: "scenarioSensitivityRuns", row: 47, l2Id: "scenarioRiskModeling", activity: "Sensitivity runs", cluster: "P&F" },
  { id: "scenarioRiskAdjustedViews", row: 48, l2Id: "scenarioRiskModeling", activity: "Risk-adjusted views", cluster: "P&F" },
  { id: "profitabilityCustomerProfitability", row: 49, l2Id: "profitabilityPricingBusinessCases", activity: "Product / customer profitability", cluster: "BP&DS" },
  { id: "profitabilityPricingAnalytics", row: 50, l2Id: "profitabilityPricingBusinessCases", activity: "Pricing analytics", cluster: "BP&DS" },
  { id: "profitabilityBusinessCaseModelling", row: 51, l2Id: "profitabilityPricingBusinessCases", activity: "Business-case modelling", cluster: "BP&DS" },
  { id: "governancePlanningCalendarGovernance", row: 52, l2Id: "governanceMasterDataBusinessPartnering", activity: "Planning-calendar governance", cluster: "D&G" },
  { id: "governanceEpmAdminMasterData", row: 53, l2Id: "governanceMasterDataBusinessPartnering", activity: "EPM admin & master data", cluster: "D&G" },
  { id: "governanceAccessHierarchyMaintenance", row: 54, l2Id: "governanceMasterDataBusinessPartnering", activity: "Access & hierarchy maintenance", cluster: "D&G" },
  { id: "governanceBusinessPartneringSupport", row: 55, l2Id: "governanceMasterDataBusinessPartnering", activity: "Business-partnering support", cluster: "D&G" },
  { id: "governanceKnowledgeManagementSops", row: 56, l2Id: "governanceMasterDataBusinessPartnering", activity: "Knowledge management & SOPs", cluster: "D&G" },
  { id: "governanceContinuousImprovement", row: 57, l2Id: "governanceMasterDataBusinessPartnering", activity: "Continuous improvement", cluster: "D&G" },
];

export const FPA_SCOPE_L3_ROWS = BASE_SCOPE_L3_ROWS.map((row) => ({
  ...row,
  l2Number: L2_LOOKUP[row.l2Id].l2Number,
  l2Process: L2_LOOKUP[row.l2Id].label,
}));

const LEGACY_SCOPE_GROUP_TO_L2_IDS = {
  budgetingPlanning: ["budgetingPlanning"],
  commercialForecasting: ["commercialForecasting"],
  workforceCapacityPlanning: ["workforceCapacityPlanning"],
  cashFlowCapitalPlanning: ["cashFlowCapitalPlanning"],
  variancePerformanceManagement: ["variancePerformanceManagement"],
  managementReportingDecisionSupport: ["managementReportingDecisionSupport"],
  scenarioRiskModeling: ["scenarioRiskModeling"],
  profitabilityPricingBusinessCases: ["profitabilityPricingBusinessCases"],
  costProductivityMarginManagement: ["costProductivityMarginManagement"],
  governanceMasterDataBusinessPartnering: ["governanceMasterDataBusinessPartnering"],
};

function cloneDefaultScopeRow() {
  return { ...DEFAULT_SCOPE_ROW };
}

function cloneDefaultScopeL2Row() {
  return { ...DEFAULT_SCOPE_L2_ROW };
}

function normalizeText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeScopeStatus(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  const upper = normalized.toUpperCase();
  if (upper === "Y" || upper === "YES") {
    return "Y";
  }

  if (upper === "N" || upper === "NO") {
    return "N";
  }

  if (upper === "PARTIAL" || upper === "P") {
    return "Partial";
  }

  return "";
}

function normalizeScopeRetained(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  const upper = normalized.toUpperCase();
  if (upper === "Y" || upper === "YES") {
    return "Y";
  }

  if (upper === "N" || upper === "NO") {
    return "N";
  }

  return normalized;
}

function roundScopeFraction(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatFpaScopeFraction(value) {
  const numericValue = typeof value === "number"
    ? value
    : Number.parseFloat(normalizeText(value));

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return String(roundScopeFraction(numericValue))
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function normalizeScopePartial(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  const numericValue = Number.parseFloat(normalized);
  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return formatFpaScopeFraction(Math.min(1, Math.max(0, numericValue)));
}

function normalizeScopeRow(value = {}, fallback = DEFAULT_SCOPE_ROW) {
  const candidate = value && typeof value === "object" ? value : {};
  const hasField = (field) => Object.prototype.hasOwnProperty.call(candidate, field);
  const normalizedStatus = hasField("status") ? normalizeScopeStatus(candidate.status) : fallback.status;

  return {
    status: normalizedStatus || fallback.status,
    partialPct: hasField("partialPct") ? normalizeScopePartial(candidate.partialPct) : fallback.partialPct,
    retainedToo: hasField("retainedToo") ? normalizeScopeRetained(candidate.retainedToo) : fallback.retainedToo,
    disposition: hasField("disposition") ? normalizeText(candidate.disposition) : fallback.disposition,
    locationIntent: hasField("locationIntent") ? normalizeText(candidate.locationIntent) : fallback.locationIntent,
  };
}

function normalizeScopeL2Row(value = {}, fallback = DEFAULT_SCOPE_L2_ROW) {
  const candidate = value && typeof value === "object" ? value : {};
  const hasField = (field) => Object.prototype.hasOwnProperty.call(candidate, field);
  const normalizedStatus = hasField("status") ? normalizeScopeStatus(candidate.status) : fallback.status;

  return {
    status: normalizedStatus || fallback.status,
    partialPct: hasField("partialPct") ? normalizeScopePartial(candidate.partialPct) : fallback.partialPct,
    sourceLabel: hasField("sourceLabel") ? normalizeText(candidate.sourceLabel) : fallback.sourceLabel,
  };
}

function createLegacyScopeRow(selected) {
  return {
    status: selected ? "Y" : "N",
    partialPct: selected ? "1" : "0",
    retainedToo: "N",
    disposition: selected ? "Transfer" : "Retain",
    locationIntent: "Follow model",
  };
}

export function createDefaultFpaScopeRows() {
  return Object.fromEntries(FPA_SCOPE_L3_ROWS.map((row) => [row.id, cloneDefaultScopeRow()]));
}

export function createDefaultFpaScopeL2Rows() {
  return Object.fromEntries(FPA_SCOPE_L2_ROWS.map((row) => [row.id, cloneDefaultScopeL2Row()]));
}

export function normalizeFpaScopeRows(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  const normalized = createDefaultFpaScopeRows();

  Object.entries(LEGACY_SCOPE_GROUP_TO_L2_IDS).forEach(([legacyKey, l2Ids]) => {
    if (!Object.prototype.hasOwnProperty.call(incoming, legacyKey) || typeof incoming[legacyKey] !== "boolean") {
      return;
    }

    const legacyRow = createLegacyScopeRow(Boolean(incoming[legacyKey]));
    FPA_SCOPE_L3_ROWS.forEach((row) => {
      if (l2Ids.includes(row.l2Id)) {
        normalized[row.id] = { ...legacyRow };
      }
    });
  });

  FPA_SCOPE_L3_ROWS.forEach((row) => {
    const candidate = incoming[row.id];
    if (candidate && typeof candidate === "object") {
      normalized[row.id] = normalizeScopeRow(candidate, normalized[row.id]);
    }
  });

  return normalized;
}

export function normalizeFpaScopeL2Rows(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  const normalized = createDefaultFpaScopeL2Rows();

  FPA_SCOPE_L2_ROWS.forEach((row) => {
    const candidate = incoming[row.id];
    if (candidate && typeof candidate === "object") {
      normalized[row.id] = normalizeScopeL2Row(candidate, normalized[row.id]);
    }
  });

  return normalized;
}

function toScopeFraction(value) {
  const numericValue = Number.parseFloat(normalizeText(value));
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.min(1, Math.max(0, numericValue));
}

export function deriveFpaScopeFinalPct(value = {}) {
  const normalized = normalizeScopeRow(value, cloneDefaultScopeRow());

  if (normalized.status === "N") {
    return 0;
  }

  if (normalized.status === "Y") {
    return 1;
  }

  return toScopeFraction(normalized.partialPct);
}

function deriveFpaScopeL2FinalPct(value = {}) {
  const normalized = normalizeScopeL2Row(value, cloneDefaultScopeL2Row());

  if (normalized.status === "N") {
    return 0;
  }

  if (normalized.status === "Y") {
    return 1;
  }

  return toScopeFraction(normalized.partialPct);
}

function matchesWorkbookDefault(row) {
  return row.status === DEFAULT_SCOPE_ROW.status
    && row.partialPct === DEFAULT_SCOPE_ROW.partialPct
    && row.retainedToo === DEFAULT_SCOPE_ROW.retainedToo
    && row.disposition === DEFAULT_SCOPE_ROW.disposition
    && row.locationIntent === DEFAULT_SCOPE_ROW.locationIntent;
}

function matchesWorkbookL2Default(row) {
  return row.status === DEFAULT_SCOPE_L2_ROW.status
    && row.partialPct === DEFAULT_SCOPE_L2_ROW.partialPct
    && row.sourceLabel === DEFAULT_SCOPE_L2_ROW.sourceLabel;
}

function hasL3ScopeDriverValue(row) {
  return row.status !== DEFAULT_SCOPE_ROW.status
    || row.partialPct !== DEFAULT_SCOPE_ROW.partialPct;
}

export function deriveFpaScopeMetrics(value = {}, l2Value = {}) {
  const scope = normalizeFpaScopeRows(value);
  const scopeL2 = normalizeFpaScopeL2Rows(l2Value);

  const l3Rows = FPA_SCOPE_L3_ROWS.map((definition, index) => {
    const row = scope[definition.id] || cloneDefaultScopeRow();
    const previous = index > 0 ? FPA_SCOPE_L3_ROWS[index - 1] : null;
    const finalPct = deriveFpaScopeFinalPct(row);

    return {
      ...definition,
      ...row,
      finalPct,
      finalPctLabel: formatFpaScopeFraction(finalPct),
      isLeadRow: !previous || previous.l2Id !== definition.l2Id,
      matchesWorkbookDefault: matchesWorkbookDefault(row),
    };
  });

  const l2RollupRows = FPA_SCOPE_L2_ROWS.map((definition) => {
    const sourceRows = l3Rows.filter((row) => row.l2Id === definition.id);
    const l3ScopePct = sourceRows.length
      ? sourceRows.reduce((sum, row) => sum + row.finalPct, 0) / sourceRows.length
      : 0;
    const hasL3Driver = sourceRows.some((row) => hasL3ScopeDriverValue(row));
    const l2Row = scopeL2[definition.id] || cloneDefaultScopeL2Row();
    const l2ScopePct = deriveFpaScopeL2FinalPct(l2Row);
    const scopePct = hasL3Driver ? l3ScopePct : l2ScopePct;

    return {
      ...definition,
      ...l2Row,
      scopePct,
      scopePctLabel: formatFpaScopeFraction(scopePct),
      basis: hasL3Driver ? "L3" : "L2",
      sourceLabel: hasL3Driver ? "" : l2Row.sourceLabel,
      hasL3Driver,
    };
  });

  return {
    scope,
    scopeL2,
    l3Rows,
    l2RollupRows,
    selectedL2Count: l2RollupRows.filter((row) => row.scopePct > 0).length,
    partialL2Count: l2RollupRows.filter((row) => row.scopePct > 0 && row.scopePct < 1).length,
    selectedL3Count: l3Rows.filter((row) => row.finalPct > 0).length,
    partialL3Count: l3Rows.filter((row) => row.finalPct > 0 && row.finalPct < 1).length,
    l2DrivenCount: l2RollupRows.filter((row) => row.basis === "L2" && row.scopePct > 0).length,
    l3DrivenCount: l2RollupRows.filter((row) => row.basis === "L3" && row.scopePct > 0).length,
    isAtWorkbookDefault: l3Rows.every((row) => row.matchesWorkbookDefault)
      && Object.values(scopeL2).every((row) => matchesWorkbookL2Default(row)),
  };
}

export function countSelectedFpaScopeL2Rows(value = {}, l2Value = {}) {
  return deriveFpaScopeMetrics(value, l2Value).selectedL2Count;
}

export function countSelectedFpaScopeL3Rows(value = {}, l2Value = {}) {
  return deriveFpaScopeMetrics(value, l2Value).selectedL3Count;
}

export function isFpaScopeAtWorkbookDefault(value = {}, l2Value = {}) {
  return deriveFpaScopeMetrics(value, l2Value).isAtWorkbookDefault;
}
