import { buildFpaAiBenefitWorkbookView } from "./fpaAiBenefit";
import {
  deriveFpaDiscoveryMetrics,
  deriveRevenueBand,
} from "./fpaDiscovery";
import { buildFpaOpsModelWorkbookView } from "./fpaOpsModel";
import { FPA_PERSONA_LIBRARY_COLUMNS } from "./fpaPersonas";
import { buildFpaRiskWorkbookView } from "./fpaRisk";
import { buildFpaWorkloadWorkbookView } from "./fpaWorkload";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const PERCENT_ONE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const DEAL_RISK_RULE_DEFS = Object.freeze([
  { id: 1, rowNumber: 9, label: "VERY HIGH complexity with aggressive persona", mitigation: "Phase the ambition; start Standard, contract option to accelerate" },
  { id: 2, rowNumber: 10, label: "Take-out competition vs conservative build", mitigation: "Sharpen price via Lean levers or productivity commitments" },
  { id: 3, rowNumber: 11, label: "Outcome construct on unvalidated volumes", mitigation: "Add true-up clause; run volume validation in DD" },
  { id: 4, rowNumber: 12, label: "Deep automation on legacy platform", mitigation: "Sequence platform modernisation ahead of automation scale" },
  { id: 5, rowNumber: 13, label: "Agentic persona vs low AI maturity", mitigation: "Reposition to Aggressive AI-First; agentic as Y2 option" },
  { id: 6, rowNumber: 14, label: "Short term with heavy transformation", mitigation: "Extend term or shift build to customer-funded" },
  { id: 7, rowNumber: 15, label: "Onshore-heavy under price pressure", mitigation: "Shift onshore presence to nearshore hub" },
  { id: 8, rowNumber: 16, label: "Legacy stack + material AI reliance", mitigation: "Gate AI benefits on data-readiness milestones" },
  { id: 9, rowNumber: 17, label: "Wide footprint, thin nearshore", mitigation: "Add nearshore coverage for time zones/languages" },
  { id: 10, rowNumber: 18, label: "Heavy reporting load on Conservative build", mitigation: "Introduce automation carve-out even in Conservative" },
  { id: 11, rowNumber: 19, label: "Separate transition fee in take-out fight", mitigation: "Offer amortised transition as alternative" },
  { id: 12, rowNumber: 20, label: "Gainshare without cost baseline", mitigation: "Gainshare unmeasurable — obtain baseline or switch construct" },
  { id: 13, rowNumber: 21, label: "Customer-FTE reconciliation (A vs D) unresolved", mitigation: "Resolve RED A-vs-D variances / tie-out on 05 §C before pricing" },
]);

export const FPA_DEAL_RISKS_SNAPSHOT = Object.freeze({
  sheetName: "FPA_19 Deal Risks",
  title: "19. Deal Risks — FP&A context checks on the chosen persona",
  note: "Bid-shaping cautions (not hard stops); check 13 is the customer-FTE reconciliation gate.",
  formulaCount: 17,
  ruleCount: DEAL_RISK_RULE_DEFS.length,
});

function trimValue(value) {
  return String(value ?? "").trim();
}

function parseNumericText(value, fallback = Number.NaN) {
  const normalized = trimValue(value).replace(/,/g, "").replace(/\$/g, "");
  if (!normalized) {
    return fallback;
  }
  if (normalized.endsWith("%")) {
    const numericPercent = Number(normalized.slice(0, -1).trim());
    return Number.isFinite(numericPercent) ? numericPercent / 100 : fallback;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function round(value, digits = 12) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatDealRiskValue(value, format = "status") {
  if (format === "status") {
    return trimValue(value) || "—";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  switch (format) {
    case "percent1":
      return PERCENT_ONE_FORMATTER.format(numeric);
    case "score1":
      return numeric.toFixed(1);
    case "whole":
      return String(Math.round(numeric));
    default:
      return String(value ?? "—");
  }
}

function normalizeCompetitionBand(value) {
  const normalized = trimValue(value);
  if (normalized === "Aggressive (Take-out)") {
    return "aggressive";
  }
  if (["High (4+ bidders)", "High (5+ bidders)"].includes(normalized)) {
    return "high";
  }
  if (normalized === "Medium (2-3 bidders)") {
    return "medium";
  }
  return "low";
}

function isLegacyEpmPlatform(value) {
  return ["Excel-only / legacy", "Hyperion (on-prem)"].includes(trimValue(value));
}

function parseContractTermYears(value) {
  const numeric = parseNumericText(value, Number.NaN);
  return Number.isFinite(numeric) ? Math.min(7, Math.max(1, Math.round(numeric))) : 5;
}

function scoreComplexityFit(personaKey, complexityBand) {
  switch (personaKey) {
    case "conservative":
      return complexityBand === "VERY HIGH" ? 30 : complexityBand === "HIGH" ? 25 : complexityBand === "MEDIUM" ? 15 : 8;
    case "standard":
      return complexityBand === "VERY HIGH" ? 25 : complexityBand === "HIGH" ? 28 : complexityBand === "MEDIUM" ? 25 : 18;
    case "lean":
      return complexityBand === "VERY HIGH" ? 15 : complexityBand === "HIGH" ? 20 : complexityBand === "MEDIUM" ? 28 : 25;
    case "aggressiveAiFirst":
      return complexityBand === "VERY HIGH" ? 8 : complexityBand === "HIGH" ? 12 : complexityBand === "MEDIUM" ? 22 : 30;
    case "autonomousFinance":
      return complexityBand === "VERY HIGH" ? 5 : complexityBand === "HIGH" ? 8 : complexityBand === "MEDIUM" ? 18 : 25;
    default:
      return 0;
  }
}

function scoreCompetitivePositioning(personaKey, competitionBand) {
  switch (personaKey) {
    case "conservative":
      return competitionBand === "low" ? 28 : competitionBand === "medium" ? 20 : competitionBand === "high" ? 12 : 8;
    case "standard":
      return competitionBand === "low" ? 25 : competitionBand === "medium" ? 26 : competitionBand === "high" ? 20 : 15;
    case "lean":
      return competitionBand === "low" ? 18 : competitionBand === "medium" ? 24 : competitionBand === "high" ? 26 : 25;
    case "aggressiveAiFirst":
      return competitionBand === "low" ? 12 : competitionBand === "medium" ? 18 : competitionBand === "high" ? 25 : 28;
    case "autonomousFinance":
      return competitionBand === "low" ? 10 : competitionBand === "medium" ? 15 : competitionBand === "high" ? 20 : 22;
    default:
      return 0;
  }
}

function scoreDigitalAlignment(personaKey, digitalMaturity) {
  switch (personaKey) {
    case "conservative":
      return digitalMaturity === "Digital-native" ? 8 : digitalMaturity === "Modernised" ? 12 : digitalMaturity === "Traditional" ? 22 : 28;
    case "standard":
      return digitalMaturity === "Digital-native" ? 15 : digitalMaturity === "Modernised" ? 22 : digitalMaturity === "Traditional" ? 28 : 25;
    case "lean":
      return digitalMaturity === "Digital-native" ? 22 : digitalMaturity === "Modernised" ? 26 : digitalMaturity === "Traditional" ? 22 : 15;
    case "aggressiveAiFirst":
      return digitalMaturity === "Digital-native" ? 28 : digitalMaturity === "Modernised" ? 26 : digitalMaturity === "Traditional" ? 15 : 8;
    case "autonomousFinance":
      return digitalMaturity === "Digital-native" ? 30 : digitalMaturity === "Modernised" ? 22 : digitalMaturity === "Traditional" ? 10 : 5;
    default:
      return 0;
  }
}

function scoreDealSize(personaKey, revenueBand) {
  switch (personaKey) {
    case "conservative":
      return revenueBand === "Small ($1-5B)" ? 22 : revenueBand === "Mid ($5-10B)" ? 18 : revenueBand === "Large ($10-25B)" ? 14 : 10;
    case "standard":
      return revenueBand === "Small ($1-5B)" ? 28 : revenueBand === "Mid ($5-10B)" ? 26 : revenueBand === "Large ($10-25B)" ? 24 : 20;
    case "lean":
      return revenueBand === "Small ($1-5B)" ? 25 : revenueBand === "Mid ($5-10B)" ? 26 : revenueBand === "Large ($10-25B)" ? 26 : 24;
    case "aggressiveAiFirst":
      return revenueBand === "Small ($1-5B)" ? 12 : revenueBand === "Mid ($5-10B)" ? 20 : revenueBand === "Large ($10-25B)" ? 25 : 28;
    case "autonomousFinance":
      return revenueBand === "Small ($1-5B)" ? 8 : revenueBand === "Mid ($5-10B)" ? 14 : revenueBand === "Large ($10-25B)" ? 20 : 25;
    default:
      return 0;
  }
}

function scoreDiscoveryConfidence(personaKey, coverageShare) {
  switch (personaKey) {
    case "conservative":
      return coverageShare < 0.3 ? 28 : coverageShare < 0.7 ? 20 : 15;
    case "standard":
      return coverageShare < 0.3 ? 26 : coverageShare < 0.7 ? 26 : 22;
    case "lean":
      return coverageShare < 0.3 ? 18 : coverageShare < 0.7 ? 24 : 25;
    case "aggressiveAiFirst":
      return coverageShare < 0.3 ? 10 : coverageShare < 0.7 ? 18 : 26;
    case "autonomousFinance":
      return coverageShare < 0.3 ? 6 : coverageShare < 0.7 ? 14 : 22;
    default:
      return 0;
  }
}

function scorePlatformReadiness(personaKey, readinessOpen) {
  switch (personaKey) {
    case "conservative":
      return readinessOpen ? 12 : 25;
    case "standard":
      return readinessOpen ? 20 : 26;
    case "lean":
      return readinessOpen ? 25 : 20;
    case "aggressiveAiFirst":
      return readinessOpen ? 28 : 12;
    case "autonomousFinance":
      return readinessOpen ? 25 : 8;
    default:
      return 0;
  }
}

function nthLargest(values, rank) {
  const sorted = [...values].sort((left, right) => right - left);
  return sorted[Math.max(0, rank - 1)] ?? sorted[0] ?? 0;
}

function rankDescending(values, target) {
  return values.filter((value) => value > target).length + 1;
}

function getShoreMixValue(opsView, layerId, personaKey) {
  const row = opsView.shoreMixTable?.rows?.find((entry) => entry.id === layerId);
  return Number(row?.values?.[personaKey]?.value || 0);
}

function toWorkbookCellMap(rows = []) {
  const cellMap = {};
  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      cellMap[cell.address] = cell;
    });
  });
  return cellMap;
}

function buildPersonaSelection(personas, context, redCountByPersona) {
  return personas.map((persona) => {
    const complexityFit = scoreComplexityFit(persona.key, context.complexityBand);
    const competitivePositioning = scoreCompetitivePositioning(persona.key, context.competitionBand);
    const digitalMaturityAlignment = scoreDigitalAlignment(persona.key, context.digitalMaturity);
    const dealSizeLeverage = scoreDealSize(persona.key, context.revenueBand);
    const discoveryConfidence = scoreDiscoveryConfidence(persona.key, context.discoveryCoverageShare);
    const platformReadiness = scorePlatformReadiness(persona.key, context.platformReadinessOpen);
    const weightedFit = round((
      (0.25 * complexityFit)
      + (0.15 * competitivePositioning)
      + (0.15 * digitalMaturityAlignment)
      + (0.15 * dealSizeLeverage)
      + (0.15 * discoveryConfidence)
      + (0.15 * platformReadiness)
    ) * 100 / 30, 12);
    const redValidations = redCountByPersona[persona.key] || 0;
    const adjustedScore = round(weightedFit - (100 * redValidations), 12);

    return {
      key: persona.key,
      label: persona.label,
      workbookColumn: persona.workbookColumn,
      index: persona.index,
      weightedFit,
      redValidations,
      adjustedScore,
    };
  });
}

export function buildFpaDealRisksWorkbookView({
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
  const aiWorkbookInputs = workbookInputs["FPA_08 AI Benefit"] && typeof workbookInputs["FPA_08 AI Benefit"] === "object"
    ? workbookInputs["FPA_08 AI Benefit"]
    : EMPTY_INPUTS;
  const personaInputs = workbookInputs["FPA_07 Personas"] && typeof workbookInputs["FPA_07 Personas"] === "object"
    ? workbookInputs["FPA_07 Personas"]
    : EMPTY_INPUTS;
  const opsWorkbookInputs = workbookInputs["FPA_09 Ops Model"] && typeof workbookInputs["FPA_09 Ops Model"] === "object"
    ? workbookInputs["FPA_09 Ops Model"]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs["FPA_10 Rate Card"] && typeof workbookInputs["FPA_10 Rate Card"] === "object"
    ? workbookInputs["FPA_10 Rate Card"]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const effectiveDiscovery = discoveryMetrics.effectiveDiscovery || {};
  const revenueBand = deriveRevenueBand(Number(effectiveDiscovery.annualRevenueUsdM || 5));
  const riskView = buildFpaRiskWorkbookView({ currentDeal, workspace });
  const aiView = buildFpaAiBenefitWorkbookView({
    aiWorkbookInputs,
    benchmarkInputs,
    workloadInputs,
    personaInputs,
    workspace,
    currentDeal,
  });
  const opsView = buildFpaOpsModelWorkbookView({ opsWorkbookInputs, rateCardInputs });
  const workloadView = buildFpaWorkloadWorkbookView(workloadInputs, benchmarkInputs, workspace, currentDeal);
  const workloadCellMap = toWorkbookCellMap(workloadView.rows);

  const personas = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
  }));

  const redCountByPersona = Object.fromEntries(
    (riskView.personaVerdicts || []).map((persona) => [persona.key, Number(persona.redCount || 0)]),
  );
  const impliedAutomationPctByPersona = Object.fromEntries(
    (aiView.personas || []).map((persona) => [persona.id, Number(persona.summary?.impliedAutomationPct || 0)]),
  );
  const impliedAiPctByPersona = Object.fromEntries(
    (aiView.personas || []).map((persona) => [persona.id, Number(persona.summary?.impliedAiPct || 0)]),
  );

  const competitionBand = normalizeCompetitionBand(effectiveDiscovery.competitiveIntensity);
  const platformReadinessOpen = trimValue(effectiveDiscovery.platformModernizationInScope) === "Yes"
    || !isLegacyEpmPlatform(effectiveDiscovery.epmPlatform);
  const discoveryCoverageShare = round(Number(discoveryMetrics.coverageScorePct || 0) / 100, 12);
  const selectionContext = {
    complexityBand: trimValue(riskView.complexityBand || "LOW").toUpperCase(),
    competitionBand,
    digitalMaturity: trimValue(effectiveDiscovery.digitalMaturity) || "Traditional",
    revenueBand,
    discoveryCoverageShare,
    platformReadinessOpen,
  };

  const personaSelection = buildPersonaSelection(personas, selectionContext, redCountByPersona);
  const adjustedScores = personaSelection.map((persona) => persona.adjustedScore);
  const maxAdjustedScore = Math.max(...adjustedScores);
  const runnerUpScore = nthLargest(adjustedScores, 2);
  const rankedPersonaSelection = personaSelection.map((persona) => ({
    ...persona,
    rank: rankDescending(adjustedScores, persona.adjustedScore),
  }));

  const selectedPersona = rankedPersonaSelection.find((persona) => persona.adjustedScore === maxAdjustedScore)
    || rankedPersonaSelection.find((persona) => persona.key === "standard")
    || rankedPersonaSelection[0];
  const runnerUpPersona = rankedPersonaSelection.find((persona) => persona.adjustedScore === runnerUpScore)
    || rankedPersonaSelection[1]
    || selectedPersona;

  const contractTermYears = parseContractTermYears(currentDeal?.contractTerm);
  const onshorePct = getShoreMixValue(opsView, "onshore", selectedPersona.key);
  const nearshorePct = getShoreMixValue(opsView, "nearshore", selectedPersona.key);
  const workloadTieOutMessage = trimValue(workloadCellMap.C57?.text || workloadCellMap.C57?.raw);
  const workloadRedVarianceCount = Number(parseNumericText(workloadCellMap.C58?.raw ?? workloadCellMap.C58?.text, 0));
  const currentCostBaselineNumeric = parseNumericText(effectiveDiscovery.currentTowerCostBaselineUsd, Number.NaN);

  const ruleRows = DEAL_RISK_RULE_DEFS.map((definition) => {
    let status = "GREEN";

    switch (definition.id) {
      case 1:
        status = selectionContext.complexityBand === "VERY HIGH" && selectedPersona.index >= 4 ? "AMBER" : "GREEN";
        break;
      case 2:
        status = trimValue(effectiveDiscovery.competitiveIntensity) === "Aggressive (Take-out)" && selectedPersona.index === 1 ? "AMBER" : "GREEN";
        break;
      case 3:
        status = trimValue(currentDeal?.pricingConstruct) === "Outcome-based" && discoveryCoverageShare < 0.3 ? "AMBER" : "GREEN";
        break;
      case 4:
        status = isLegacyEpmPlatform(effectiveDiscovery.epmPlatform) && Number(impliedAutomationPctByPersona[selectedPersona.key] || 0) > 0.25 ? "AMBER" : "GREEN";
        break;
      case 5:
        status = ["None", "Exploring"].includes(trimValue(effectiveDiscovery.aiMaturity)) && selectedPersona.index === 5 ? "RED" : "GREEN";
        break;
      case 6:
        status = contractTermYears === 3 && selectedPersona.index >= 4 ? "AMBER" : "GREEN";
        break;
      case 7:
        status = onshorePct > 0.25 && ["high", "aggressive"].includes(competitionBand) ? "AMBER" : "GREEN";
        break;
      case 8:
        status = isLegacyEpmPlatform(effectiveDiscovery.epmPlatform) && Number(impliedAiPctByPersona[selectedPersona.key] || 0) > 0.12 ? "AMBER" : "GREEN";
        break;
      case 9:
        status = Number(effectiveDiscovery.geoCountries || 0) > 20 && nearshorePct < 0.15 ? "AMBER" : "GREEN";
        break;
      case 10:
        status = Number(effectiveDiscovery.reportPacksPerMonth || 0) > 100 && selectedPersona.index === 1 ? "AMBER" : "GREEN";
        break;
      case 11:
        status = trimValue(currentDeal?.transitionCommercials) === "Separate fee" && trimValue(effectiveDiscovery.competitiveIntensity) === "Aggressive (Take-out)" ? "AMBER" : "GREEN";
        break;
      case 12:
        status = trimValue(currentDeal?.pricingConstruct) === "Gainshare" && !Number.isFinite(currentCostBaselineNumeric) ? "RED" : "GREEN";
        break;
      case 13:
        status = workloadRedVarianceCount > 0 && workloadTieOutMessage.startsWith("AMBER")
          ? "RED"
          : workloadRedVarianceCount > 0 || workloadTieOutMessage.startsWith("AMBER")
            ? "AMBER"
            : "GREEN";
        break;
      default:
        status = "GREEN";
    }

    return {
      ...definition,
      status,
    };
  });

  const amberCount = ruleRows.filter((row) => row.status === "AMBER").length;
  const hasRed = ruleRows.some((row) => row.status === "RED");
  const dealRiskVerdict = hasRed ? "RED" : amberCount > 0 ? "AMBER" : "GREEN";
  const recommendationRationale = `Best adjusted fit (${formatDealRiskValue(selectedPersona.adjustedScore, "score1")}) for ${selectionContext.complexityBand} complexity, ${discoveryMetrics.coverageMode}, ${trimValue(effectiveDiscovery.competitiveIntensity) || "Medium (2-3 bidders)"}; ${discoveryMetrics.painMotion}.`;

  return {
    ...FPA_DEAL_RISKS_SNAPSHOT,
    contextRows: [
      { rowNumber: 8, label: "Discovery coverage", value: discoveryCoverageShare, format: "percent1" },
      { rowNumber: 9, label: "Competitive intensity", value: trimValue(effectiveDiscovery.competitiveIntensity) || "Medium (2-3 bidders)", format: "status" },
      { rowNumber: 10, label: "Customer digital maturity", value: trimValue(effectiveDiscovery.digitalMaturity) || "Traditional", format: "status" },
      { rowNumber: 11, label: "Revenue band", value: revenueBand, format: "status" },
    ],
    personaSelection: rankedPersonaSelection,
    selectedPersona,
    runnerUpPersona,
    selectedPersonaIndex: selectedPersona.index,
    dealRiskVerdict,
    amberCount,
    recommendationRationale,
    ruleRows,
    context: {
      complexityBand: selectionContext.complexityBand,
      discoveryCoverageShare,
      onshorePct,
      nearshorePct,
      contractTermYears,
      workloadTieOutMessage: workloadTieOutMessage || "—",
      workloadRedVarianceCount,
    },
  };
}
