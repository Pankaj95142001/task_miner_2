import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { P2P_PERSONA_LIBRARY_COLUMNS } from "./p2pPersonas";
import { buildP2pRiskWorkbookView } from "./p2pRisk";
import { buildP2pWorkloadModel } from "./p2pWorkload";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "./p2pWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_ONE_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const PERCENT_ONE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const P2P_RECOMMEND_SNAPSHOT = Object.freeze({
  sheetName: "P2P_20 Recommend",
  title: "20. Recommendation Engine — P2P weighted fit with RED penalties",
  note: "Adjusted score = Σ(criterion score × weight) × 100/30 − 100 per RED. Weights are editable inputs.",
  formulaCount: 67,
  editableCellCount: 6,
  criterionCount: 6,
  personaCount: P2P_PERSONA_LIBRARY_COLUMNS.length,
});

const RECOMMEND_CRITERIA = Object.freeze([
  {
    key: "complexityFit",
    rowNumber: 16,
    label: "Complexity fit",
    weightAddress: "I16",
    defaultWeight: 0.25,
    computeScore: (personaKey, context) => scoreComplexityFit(personaKey, context.complexityBand),
  },
  {
    key: "competitivePositioning",
    rowNumber: 17,
    label: "Competitive positioning",
    weightAddress: "I17",
    defaultWeight: 0.15,
    computeScore: (personaKey, context) => scoreCompetitivePositioning(personaKey, context.competitionBand),
  },
  {
    key: "digitalMaturityAlignment",
    rowNumber: 18,
    label: "Digital-maturity alignment",
    weightAddress: "I18",
    defaultWeight: 0.15,
    computeScore: (personaKey, context) => scoreDigitalAlignment(personaKey, context.digitalMaturity),
  },
  {
    key: "dealSizeLeverage",
    rowNumber: 19,
    label: "Deal-size leverage",
    weightAddress: "I19",
    defaultWeight: 0.15,
    computeScore: (personaKey, context) => scoreDealSize(personaKey, context.revenueBand),
  },
  {
    key: "discoveryConfidence",
    rowNumber: 20,
    label: "Discovery confidence",
    weightAddress: "I20",
    defaultWeight: 0.15,
    computeScore: (personaKey, context) => scoreDiscoveryConfidence(personaKey, context.discoveryCoverageShare),
  },
  {
    key: "platformReadiness",
    rowNumber: 21,
    label: "Platform / data readiness",
    weightAddress: "I21",
    defaultWeight: 0.15,
    computeScore: (personaKey, context) => scorePlatformReadiness(personaKey, context.platformReadinessOpen),
  },
]);

const CUSTOMER_ENABLER_ROWS = Object.freeze([
  {
    key: "access",
    rowNumber: 39,
    text: "1. ERP, workflow, and vendor-master access from Day 1 of knowledge transfer.",
  },
  {
    key: "smeAvailability",
    rowNumber: 40,
    text: "2. SMEs available across sourcing, AP, payments, vendor master, and T&E through KT and shadow phases.",
  },
  {
    key: "controls",
    rowNumber: 41,
    text: "3. Customer process owners align approval matrix, exception ownership, and control-accountability before go-live.",
  },
]);

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function trimTrailingZeros(value) {
  return String(value).replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
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

export function formatP2pRecommendValue(value, format = "status") {
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
      return DECIMAL_ONE_FORMATTER.format(numeric);
    case "whole":
      return INTEGER_FORMATTER.format(Math.round(numeric));
    case "weight1":
      return `${DECIMAL_ONE_FORMATTER.format(numeric * 100)}%`;
    default:
      return String(value ?? "—");
  }
}

export function formatP2pRecommendInputValue(kind, value) {
  if (kind !== "weight") {
    return trimValue(value);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return trimTrailingZeros(round(numeric * 100, 1));
}

export function normalizeP2pRecommendInputValue(kind, value) {
  if (kind !== "weight") {
    return null;
  }

  const normalized = trimValue(value).replace(/,/g, "").replace(/%/g, "");
  if (!normalized) {
    return "";
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const ratio = numeric <= 1 && normalized.includes(".")
    ? numeric
    : numeric / 100;

  return round(clamp(ratio, 0, 1), 12);
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

function isLegacyP2pPlatform(value) {
  return ["ERP AP module only (manual)", "Other / mixed"].includes(trimValue(value));
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

function rankDescending(values, target) {
  return values.filter((value) => value > target).length + 1;
}

function nthLargestIncludingDuplicates(values, rank) {
  const sorted = [...values].sort((left, right) => right - left);
  return sorted[Math.max(0, rank - 1)] ?? sorted[0] ?? 0;
}

function readWeightValue(recommendInputs, address, defaultWeight) {
  const parsed = parseNumericText(recommendInputs[address], Number.NaN);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : defaultWeight;
}

export function buildP2pRecommendWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : EMPTY_INPUTS;
  const recommendInputs = workbookInputs[P2P_RECOMMEND_SNAPSHOT.sheetName]
    && typeof workbookInputs[P2P_RECOMMEND_SNAPSHOT.sheetName] === "object"
    ? workbookInputs[P2P_RECOMMEND_SNAPSHOT.sheetName]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const effectiveDiscovery = discoveryMetrics.effectiveDiscovery || {};
  const riskView = buildP2pRiskWorkbookView({ currentDeal, workspace });
  const workloadView = buildP2pWorkloadModel(workspace, currentDeal);

  const personas = P2P_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
  }));

  const redCountByPersona = Object.fromEntries(
    (riskView.personaVerdicts || []).map((persona) => [persona.key, Number(persona.redCount || 0)]),
  );

  const discoveryCoverageShare = round(Number(discoveryMetrics.coveragePct || 0), 12);
  const competitionBand = normalizeCompetitionBand(effectiveDiscovery.competitiveIntensity);
  const revenueBand = trimValue(discoveryMetrics.revenueBand) || "Small ($1-5B)";
  const platformReadinessOpen = trimValue(effectiveDiscovery.platformModernizationInScope) === "Yes"
    || !isLegacyP2pPlatform(effectiveDiscovery.p2pPlatform);

  const selectionContext = {
    complexityBand: trimValue(riskView.complexityBand || "LOW").toUpperCase(),
    sizingMode: trimValue(discoveryMetrics.sizingMode || "DISCOVERY-CONFIRMED"),
    discoveryCoverageShare,
    competitionBand,
    competitiveIntensity: trimValue(effectiveDiscovery.competitiveIntensity) || "Medium (2-3 bidders)",
    digitalMaturity: trimValue(effectiveDiscovery.digitalMaturity) || "Traditional",
    revenueBand,
    platformReadinessOpen,
    p2pPlatform: trimValue(effectiveDiscovery.p2pPlatform) || "ERP AP module only (manual)",
    aiMaturity: trimValue(effectiveDiscovery.aiMaturity) || "Exploring",
    painMotion: trimValue(discoveryMetrics.transformationUrgency) || "MEDIUM — balanced bid",
  };

  const criterionRows = RECOMMEND_CRITERIA.map((criterion) => {
    const weightValue = readWeightValue(recommendInputs, criterion.weightAddress, criterion.defaultWeight);
    const scores = personas.map((persona) => {
      const value = criterion.computeScore(persona.key, selectionContext);
      return {
        key: persona.key,
        label: persona.label,
        value,
        text: formatP2pRecommendValue(value, "whole"),
      };
    });

    return {
      ...criterion,
      weightValue,
      weightText: formatP2pRecommendValue(weightValue, "weight1"),
      scores,
    };
  });

  const weightTotal = round(criterionRows.reduce((sum, row) => sum + row.weightValue, 0), 12);
  const weightStatus = Math.abs(weightTotal - 1) > 0.001 ? "FIX — weights must total 100%" : "Weights OK";

  const personaSelection = personas.map((persona) => {
    const weightedFit = round(
      (criterionRows.reduce((sum, row) => {
        const score = Number(row.scores.find((cell) => cell.key === persona.key)?.value || 0);
        return sum + (row.weightValue * score);
      }, 0) * 100) / 30,
      12,
    );
    const redValidations = Number(redCountByPersona[persona.key] || 0);
    const adjustedScore = round(weightedFit - (100 * redValidations), 12);

    return {
      ...persona,
      weightedFit,
      redValidations,
      adjustedScore,
    };
  });

  const adjustedScores = personaSelection.map((persona) => persona.adjustedScore);
  const maxAdjustedScore = Math.max(...adjustedScores);
  const runnerUpScore = nthLargestIncludingDuplicates(adjustedScores, 2);
  const rankedPersonaSelection = personaSelection.map((persona) => ({
    ...persona,
    rank: rankDescending(adjustedScores, persona.adjustedScore),
  }));

  const recommendedPersona = rankedPersonaSelection.find((persona) => persona.adjustedScore === maxAdjustedScore)
    || rankedPersonaSelection.find((persona) => persona.key === "standard")
    || rankedPersonaSelection[0];
  const runnerUpPersona = rankedPersonaSelection.find((persona) => persona.adjustedScore === runnerUpScore && persona.key !== recommendedPersona?.key)
    || rankedPersonaSelection.find((persona) => persona.key !== recommendedPersona?.key)
    || recommendedPersona;

  const recommendationRationale = `Best adjusted fit (${formatP2pRecommendValue(recommendedPersona?.adjustedScore || 0, "score1")}) for ${selectionContext.complexityBand} complexity, ${selectionContext.sizingMode}, ${selectionContext.competitiveIntensity}; ${selectionContext.painMotion}.`;
  const workloadCustomerActualsShared = trimValue(workloadView.workload?.sharedCustomerFte).toUpperCase() === "YES";
  const workloadRedVarianceCount = Number(workloadView.redVarianceCount || 0);

  const contextRows = [
    { key: "complexityBand", rowNumber: 6, label: "Complexity band", value: selectionContext.complexityBand, format: "status" },
    { key: "sizingMode", rowNumber: 7, label: "Sizing mode", value: selectionContext.sizingMode, format: "status" },
    { key: "discoveryCoverage", rowNumber: 8, label: "Discovery coverage", value: discoveryCoverageShare, format: "percent1" },
    { key: "competitiveIntensity", rowNumber: 9, label: "Competitive intensity", value: selectionContext.competitiveIntensity, format: "status" },
    { key: "digitalMaturity", rowNumber: 10, label: "Customer digital maturity", value: selectionContext.digitalMaturity, format: "status" },
    { key: "revenueBand", rowNumber: 11, label: "Revenue band", value: selectionContext.revenueBand, format: "status" },
  ];

  const summaryRows = [
    {
      key: "weightedFit",
      rowNumber: 22,
      label: "Weighted fit (0-100)",
      format: "score1",
      values: rankedPersonaSelection.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: persona.weightedFit,
        text: formatP2pRecommendValue(persona.weightedFit, "score1"),
      })),
      sideValue: formatP2pRecommendValue(weightTotal, "weight1"),
    },
    {
      key: "redValidations",
      rowNumber: 23,
      label: "RED validations (18)",
      format: "whole",
      values: rankedPersonaSelection.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: persona.redValidations,
        text: formatP2pRecommendValue(persona.redValidations, "whole"),
      })),
      sideValue: weightStatus,
    },
    {
      key: "adjustedScore",
      rowNumber: 24,
      label: "ADJUSTED SCORE",
      format: "score1",
      values: rankedPersonaSelection.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: persona.adjustedScore,
        text: formatP2pRecommendValue(persona.adjustedScore, "score1"),
      })),
    },
    {
      key: "rank",
      rowNumber: 25,
      label: "Rank",
      format: "whole",
      values: rankedPersonaSelection.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: persona.rank,
        text: formatP2pRecommendValue(persona.rank, "whole"),
      })),
    },
  ];

  const conditionsRows = [
    {
      key: "platform",
      rowNumber: 33,
      text: isLegacyP2pPlatform(selectionContext.p2pPlatform)
        ? "1. Fund P2P platform / workflow modernisation ahead of automation scale-up."
        : "1. Platform adequate — protect workflow, data-readiness, and integrations.",
    },
    {
      key: "aiMaturity",
      rowNumber: 34,
      text: ["None", "Exploring"].includes(selectionContext.aiMaturity)
        ? "2. Lift AI maturity to Piloting before agentic benefits are priced into the solution."
        : "2. AI maturity supports the modeled automation and AI ramp.",
    },
    {
      key: "discoveryCoverage",
      rowNumber: 35,
      text: discoveryCoverageShare < 0.3
        ? "3. Run a paid discovery sprint to validate invoice, PO, and payment volumes before contracting outcome/fixed constructs."
        : "3. Discovery coverage is adequate for the chosen commercial construct.",
    },
    {
      key: "workloadTieOut",
      rowNumber: 36,
      text: workloadRedVarianceCount > 0
        ? "4. Resolve customer-FTE vs driver variances in 05 Workload before final pricing."
        : workloadCustomerActualsShared
          ? "4. Customer actuals are shared — lock the operating baseline in the SOW."
          : "4. Sizing is still proxy-driven — include a volume true-up clause.",
    },
  ];

  const fallbackLogic = `If conditions fail, drop to ${runnerUpPersona?.label || "Standard"} and re-run 18 Risk before submission.`;

  return {
    ...P2P_RECOMMEND_SNAPSHOT,
    personaHeaders: personas.map((persona) => ({
      key: persona.key,
      label: persona.label,
      workbookColumn: persona.workbookColumn,
      index: persona.index,
    })),
    context: selectionContext,
    contextRows,
    criterionRows,
    summaryRows,
    weightTotal,
    weightTotalText: formatP2pRecommendValue(weightTotal, "weight1"),
    weightStatus,
    recommendedPersona,
    runnerUpPersona,
    recommendedPersonaIndex: recommendedPersona?.index || 0,
    recommendationRationale,
    conditionsRows,
    customerEnablerRows: CUSTOMER_ENABLER_ROWS,
    fallbackLogic,
  };
}
