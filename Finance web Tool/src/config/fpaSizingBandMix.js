import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";
import { buildFpaFteEngineWorkbookView } from "./fpaFteEngine";
import { buildFpaOpsModelWorkbookView } from "./fpaOpsModel";
import { FPA_PERSONA_LIBRARY_COLUMNS } from "./fpaPersonas";
import { buildFpaRateCardWorkbookView } from "./fpaRateCard";
import { buildFpaScplWorkbookView } from "./fpaScpl";
import { normalizeFpaWorkspace } from "./fpaWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = "FPA_31 Sizing & Band Mix";
const SCPL_SHEET_NAME = "FPA_30 SCPL";
const OPS_MODEL_SHEET_NAME = "FPA_09 Ops Model";
const RATE_CARD_SHEET_NAME = "FPA_10 Rate Card";

const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_ONE_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const DECIMAL_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const CURRENCY_ZERO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const FPA_SIZING_BAND_MIX_SNAPSHOT = Object.freeze({
  sheetName: SHEET_NAME,
  title: "31. Sizing & Band Mix — FP&A India roster by persona",
  note: "System-recommended India roster by persona: Discovery complexity can shift the pyramid seniority, manual band overrides stay by persona, and the final band roll-up mirrors the workbook feed back into SCPL.",
  formulaCount: 714,
  editableCellCount: 136,
  personaCount: 5,
  roleCount: 8,
  bandCount: 8,
});

const BAND_CODE_OPTIONS = Object.freeze(["E0.1", "E0.2", "E0.3", "E1", "E2", "E3", "E4", "E5"]);
const TILT_INDEX_MAP = Object.freeze({ Senior: 1, Standard: 2, Junior: 3 });
const INDEX_TO_TILT_MAP = Object.freeze({ 1: "Senior", 2: "Standard", 3: "Junior" });

const INDUSTRY_BENCHMARKS = Object.freeze({
  "BFSI": Object.freeze({ complexityMult: 1.4, regLoad: 4, defaultDigitalMaturity: "Traditional" }),
  "CPG & Retail": Object.freeze({ complexityMult: 1.1, regLoad: 3, defaultDigitalMaturity: "Traditional" }),
  "Technology & SaaS": Object.freeze({ complexityMult: 1.2, regLoad: 2, defaultDigitalMaturity: "Digital-native" }),
  "Manufacturing": Object.freeze({ complexityMult: 1.15, regLoad: 3, defaultDigitalMaturity: "Traditional" }),
  "Healthcare & Pharma": Object.freeze({ complexityMult: 1.3, regLoad: 5, defaultDigitalMaturity: "Legacy" }),
  "Energy & Utilities": Object.freeze({ complexityMult: 1.2, regLoad: 4, defaultDigitalMaturity: "Traditional" }),
  "Telecom & Media": Object.freeze({ complexityMult: 1.1, regLoad: 3, defaultDigitalMaturity: "Modernised" }),
  "Professional Services": Object.freeze({ complexityMult: 0.95, regLoad: 2, defaultDigitalMaturity: "Modernised" }),
});

const GRADE_MAPPING_DEFINITIONS = Object.freeze([
  {
    id: "director",
    rowNumber: 10,
    label: "Director",
    primaryBandDefault: "E5",
    primarySplitDefault: 1,
    altBandDefault: "",
    altSplitDefault: 0,
    rationale: "Director → E5 (DGM / GM); Senior Manager → E4 (Group Manager)",
  },
  {
    id: "seniorManager",
    rowNumber: 11,
    label: "Senior Manager",
    primaryBandDefault: "E4",
    primarySplitDefault: 1,
    altBandDefault: "",
    altSplitDefault: 0,
    rationale: "Senior Manager aligns to the leadership layer.",
  },
  {
    id: "manager",
    rowNumber: 12,
    label: "Manager",
    primaryBandDefault: "E3",
    primarySplitDefault: 0.4,
    altBandDefault: "E2",
    altSplitDefault: 0.6,
    rationale: "Manager grade split 40% E3 and 60% E2 — v6.2 workbook seed.",
  },
  {
    id: "seniorAnalyst",
    rowNumber: 13,
    label: "Senior Analyst",
    primaryBandDefault: "E1",
    primarySplitDefault: 1,
    altBandDefault: "",
    altSplitDefault: 0,
    rationale: "Senior Analyst maps directly to Lead Analyst.",
  },
  {
    id: "analyst",
    rowNumber: 14,
    label: "Analyst",
    primaryBandDefault: "E0.3",
    primarySplitDefault: 1,
    altBandDefault: "",
    altSplitDefault: 0,
    rationale: "Analyst maps directly to Analyst.",
  },
  {
    id: "associateAnalyst",
    rowNumber: 15,
    label: "Associate Analyst",
    primaryBandDefault: "E0.2",
    primarySplitDefault: 0.5,
    altBandDefault: "E0.1",
    altSplitDefault: 0.5,
    rationale: "Associate Analyst split 50% E0.2 / 50% E0.1 — v6.2 workbook seed.",
  },
]);

const TILT_ROLE_MIX = Object.freeze({
  Senior: Object.freeze({
    director: 0,
    seniorManager: 0,
    manager: 0.13,
    seniorAnalyst: 0.22,
    analyst: 0.45,
    associateAnalyst: 0.2,
  }),
  Standard: Object.freeze({
    director: 0,
    seniorManager: 0,
    manager: 0.08,
    seniorAnalyst: 0.22,
    analyst: 0.45,
    associateAnalyst: 0.25,
  }),
  Junior: Object.freeze({
    director: 0,
    seniorManager: 0,
    manager: 0.05,
    seniorAnalyst: 0.2,
    analyst: 0.45,
    associateAnalyst: 0.3,
  }),
});

const ROLE_DEFINITIONS = Object.freeze([
  { index: 1, roleLabel: "Director / Engagement lead", sourceGradeId: "director", sourceLabel: "Director", bandMode: "primary" },
  { index: 2, roleLabel: "Senior Manager / Service delivery lead", sourceGradeId: "seniorManager", sourceLabel: "Senior Manager", bandMode: "primary" },
  { index: 3, roleLabel: "Manager / Team lead", sourceGradeId: "manager", sourceLabel: "Manager", bandMode: "primary" },
  { index: 4, roleLabel: "Manager — deputy / Assistant Manager", sourceGradeId: "manager", sourceLabel: "Manager", bandMode: "alternate" },
  { index: 5, roleLabel: "Senior Analyst / Lead Analyst", sourceGradeId: "seniorAnalyst", sourceLabel: "Senior Analyst", bandMode: "primary" },
  { index: 6, roleLabel: "Analyst", sourceGradeId: "analyst", sourceLabel: "Analyst", bandMode: "primary" },
  { index: 7, roleLabel: "Associate Analyst — senior", sourceGradeId: "associateAnalyst", sourceLabel: "Associate Analyst", bandMode: "primary" },
  { index: 8, roleLabel: "Associate Analyst — junior", sourceGradeId: "associateAnalyst", sourceLabel: "Associate Analyst", bandMode: "alternate" },
]);

const PERSONA_ROLE_LABELS_BY_SOURCE_GRADE = Object.freeze(
  ROLE_DEFINITIONS.reduce((accumulator, definition) => {
    const currentLabels = accumulator[definition.sourceGradeId] || [];
    accumulator[definition.sourceGradeId] = [...currentLabels, definition.roleLabel];
    return accumulator;
  }, {}),
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function ceilHalf(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.ceil(value * 2) / 2;
}

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .replace(/₹/g, "");

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

function stripTrailingZeros(text) {
  return String(text).replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

function readWorkbookTextInput(sheetInputs, address, fallback = "") {
  if (!Object.prototype.hasOwnProperty.call(sheetInputs, address)) {
    return fallback;
  }

  return trimValue(sheetInputs[address]);
}

function readWorkbookBandInput(sheetInputs, address, fallback = "") {
  const nextValue = readWorkbookTextInput(sheetInputs, address, fallback);
  if (!nextValue) {
    return "";
  }

  return BAND_CODE_OPTIONS.includes(nextValue) ? nextValue : fallback;
}

function readWorkbookPercentInput(sheetInputs, address, fallback = 0) {
  if (!Object.prototype.hasOwnProperty.call(sheetInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(sheetInputs[address], Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1);
}

function readWorkbookDecimalInput(sheetInputs, address, fallback = null) {
  if (!Object.prototype.hasOwnProperty.call(sheetInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(sheetInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? round(numeric, 12) : fallback;
}

function buildPreviewDealForPersona(currentDeal, scplInputs, personaLabel) {
  return {
    ...currentDeal,
    fpaWorkbookInputs: {
      ...(currentDeal?.fpaWorkbookInputs || {}),
      [SCPL_SHEET_NAME]: {
        ...scplInputs,
        C6: personaLabel,
        C9: personaLabel,
      },
    },
  };
}

function mapDigitalMaturityScore(value) {
  switch (trimValue(value)) {
    case "Digital-native":
      return 1;
    case "Modernised":
      return 2;
    case "Traditional":
      return 4;
    default:
      return 5;
  }
}

function mapMonthlyCloseScore(value) {
  switch (trimValue(value)) {
    case "Simple (<=5 days)":
      return 1;
    case "Standard (6-8 days)":
      return 2;
    case "Complex (9-12 days)":
      return 4;
    default:
      return 5;
  }
}

function mapProcessMaturityScore(value) {
  switch (trimValue(value)) {
    case "Leading":
      return 1;
    case "Established":
      return 2;
    case "Developing":
      return 4;
    default:
      return 5;
  }
}

function mapAutomationMaturityScore(value) {
  switch (trimValue(value)) {
    case "None":
      return 5;
    case "Low (<20%)":
      return 4;
    case "Medium (20-40%)":
    case "Medium (20-50%)":
      return 2;
    default:
      return 1;
  }
}

function mapTechLandscapeScore(value) {
  switch (trimValue(value).toUpperCase()) {
    case "MODERN":
      return 1;
    case "TRANSITIONAL":
      return 3;
    default:
      return 5;
  }
}

function bucketScore(value, thresholds) {
  if (value <= thresholds[0]) {
    return 1;
  }
  if (value <= thresholds[1]) {
    return 2;
  }
  if (value <= thresholds[2]) {
    return 3;
  }
  if (value <= thresholds[3]) {
    return 4;
  }
  return 5;
}

function mapRetainedIntentScore(value) {
  const normalized = trimValue(value);
  if (normalized === "Full transfer" || normalized === "Lean") {
    return 2;
  }
  if (normalized === "Hybrid") {
    return 3;
  }
  return 4;
}

function mapCompetitiveIntensityScore(value) {
  const normalized = trimValue(value);
  if (normalized === "Low (Sole-source)" || normalized === "Low (1 bidder)") {
    return 1;
  }
  if (normalized === "Medium (2-3 bidders)") {
    return 2;
  }
  if (normalized === "High (5+ bidders)" || normalized === "High (4+ bidders)") {
    return 4;
  }
  return 5;
}

function buildDiscoveryComplexitySignals(discoveryMetrics) {
  const discovery = discoveryMetrics?.effectiveDiscovery || {};
  const industry = trimValue(discovery.industryVertical) || "Manufacturing";
  const industryBench = INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS.Manufacturing;
  const coverageRatio = Number(discoveryMetrics?.coverageScorePct || 0) / 100;
  const painIndex = Number(discoveryMetrics?.painPressurePct || 0) / 100;

  const rows = [
    {
      rowNumber: 94,
      label: "Industry — regulatory load",
      basis: "04 industry reg load (1-5)",
      score: industryBench.regLoad,
      weight: 0.08,
      lens: "I",
    },
    {
      rowNumber: 95,
      label: "Industry — process complexity",
      basis: "04 complexity multiplier → (mult−1)×5+3",
      score: round(((industryBench.complexityMult - 1) * 5) + 3, 1),
      weight: 0.09,
      lens: "I",
    },
    {
      rowNumber: 96,
      label: "Industry — digital maturity (inverse)",
      basis: "04 default digital maturity",
      score: mapDigitalMaturityScore(industryBench.defaultDigitalMaturity),
      weight: 0.08,
      lens: "I",
    },
    {
      rowNumber: 97,
      label: "Process — close / cycle complexity",
      basis: "Monthly close complexity",
      score: mapMonthlyCloseScore(discovery.monthlyCloseComplexity),
      weight: 0.1,
      lens: "P",
    },
    {
      rowNumber: 98,
      label: "Process — process maturity (inverse)",
      basis: "Tower process maturity",
      score: mapProcessMaturityScore(discovery.processMaturity),
      weight: 0.1,
      lens: "P",
    },
    {
      rowNumber: 99,
      label: "Process — automation maturity (inverse)",
      basis: "Automation maturity",
      score: mapAutomationMaturityScore(discovery.automationMaturity),
      weight: 0.08,
      lens: "P",
    },
    {
      rowNumber: 100,
      label: "Process — technology & data readiness (inverse)",
      basis: "Tech stack class (§D)",
      score: mapTechLandscapeScore(discoveryMetrics?.techLandscape),
      weight: 0.07,
      lens: "P",
    },
    {
      rowNumber: 101,
      label: "Process — pain-point pressure",
      basis: "§E pressure index → 1+4×index",
      score: round(1 + (4 * painIndex), 1),
      weight: 0.05,
      lens: "P",
    },
    {
      rowNumber: 102,
      label: "Account — organisational footprint",
      basis: "entities · BUs · countries (avg of 3 sub-scores)",
      score: round((
        bucketScore(Number(discovery.legalEntities || 0), [5, 10, 20, 50])
        + bucketScore(Number(discovery.businessUnits || 0), [4, 8, 15, 25])
        + bucketScore(Number(discovery.geoCountries || 0), [2, 5, 10, 20])
      ) / 3, 1),
      weight: 0.1,
      lens: "A",
    },
    {
      rowNumber: 103,
      label: "Account — language & time-zone coverage",
      basis: "languages (+1 if >10 countries)",
      score: Math.min(
        5,
        bucketScore(Number(discovery.languagesBeyondEnglish || 0), [0, 1, 2, 4]) + (Number(discovery.geoCountries || 0) > 10 ? 1 : 0),
      ),
      weight: 0.07,
      lens: "A",
    },
    {
      rowNumber: 104,
      label: "Account — stakeholder & retained-org interface",
      basis: "retained intent (+1 if >10 data sources)",
      score: Math.min(
        5,
        mapRetainedIntentScore(discovery.retainedOrgIntent) + (Number(discovery.dataSourcesCount || 0) > 10 ? 1 : 0),
      ),
      weight: 0.1,
      lens: "A",
    },
    {
      rowNumber: 105,
      label: "Account — deal governance & competitive pressure",
      basis: "competitive intensity (+1 if coverage <30%)",
      score: Math.min(5, mapCompetitiveIntensityScore(discovery.competitiveIntensity) + (coverageRatio < 0.3 ? 1 : 0)),
      weight: 0.08,
      lens: "A",
    },
  ].map((row) => ({
    ...row,
    weightedScore: round(row.score * row.weight, 12),
  }));

  const discoveryIndex = round(rows.reduce((sum, row) => sum + row.weightedScore, 0), 12);
  const discoveryBand = discoveryIndex < 2 ? "LOW" : discoveryIndex < 3 ? "MEDIUM" : discoveryIndex < 4 ? "HIGH" : "VERY HIGH";
  const seniorThreshold = 3.75;
  const juniorThreshold = 2.25;
  const seniorityAdjustment = discoveryIndex >= seniorThreshold ? -1 : discoveryIndex <= juniorThreshold ? 1 : 0;

  let seniorityMessage = "AS PERSONA — pyramid tilt unchanged";
  if (seniorityAdjustment === -1) {
    seniorityMessage = "MORE SENIOR — complexity above threshold";
  } else if (seniorityAdjustment === 1) {
    seniorityMessage = "MORE JUNIOR — low complexity";
  }

  return {
    rows,
    discoveryIndex,
    discoveryBand,
    seniorThreshold,
    juniorThreshold,
    seniorityAdjustment,
    seniorityMessage,
  };
}

function getScplRecommendedIndiaFte(view) {
  const row = Array.isArray(view?.sizingRows)
    ? (view.sizingRows.find((item) => item?.rowNumber === 29)
      || view.sizingRows.find((item) => item?.rowNumber === 10)
      || view.sizingRows.find((item) => String(item?.label || "").toLowerCase().includes("recommended india fte")))
    : null;
  return Number(row?.value || 0);
}

function formatPersonaBlockHeader({ personaLabel, personaIndex, isRecommended, isSelected, effectiveTiltLabel, recommendedIndiaFte }) {
  const parts = [`Persona ${personaIndex} — ${personaLabel}`];
  if (isRecommended) {
    parts.push("RECOMMENDED");
  }
  if (isSelected) {
    parts.push("SELECTED in 30 SCPL");
  }
  parts.push(`effective tilt: ${effectiveTiltLabel}`);
  parts.push(`SCPL recommended India FTE: ${DECIMAL_ONE_FORMATTER.format(recommendedIndiaFte)}`);
  return parts.join("  ·  ");
}

export function formatSizingBandMixValue(value, format = "whole") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (format === "text" || format === "status") {
    return String(value);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  switch (format) {
    case "currency0":
      return CURRENCY_ZERO_FORMATTER.format(Math.round(numeric));
    case "percent0":
      return `${Math.round(numeric * 100)}%`;
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    case "fte1":
      return DECIMAL_ONE_FORMATTER.format(numeric);
    case "fte2":
    case "number2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "whole":
    default:
      return INTEGER_FORMATTER.format(Math.round(numeric));
  }
}

export function formatSizingBandMixInputValue(kind, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (kind === "band" || kind === "note") {
    return String(value);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  if (kind === "percent") {
    return `${(numeric * 100).toFixed(1)}%`;
  }

  return stripTrailingZeros(numeric.toFixed(2));
}

export function normalizeSizingBandMixInputValue(kind, value) {
  const trimmed = trimValue(value);

  if (kind === "band") {
    if (!trimmed) {
      return "";
    }
    return BAND_CODE_OPTIONS.includes(trimmed) ? trimmed : null;
  }

  if (kind === "note") {
    return trimmed;
  }

  if (!trimmed) {
    return "";
  }

  const numeric = parseNumericText(trimmed, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (kind === "percent") {
    return String(clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1));
  }

  return String(round(numeric, 12));
}

function buildGradeSettings(sheetInputs) {
  return GRADE_MAPPING_DEFINITIONS.map((definition) => {
    const personaRoleLabels = PERSONA_ROLE_LABELS_BY_SOURCE_GRADE[definition.id] || [definition.label];
    const [personaRoleLabel = definition.label, ...additionalPersonaRoles] = personaRoleLabels;
    const primaryBandAddress = `D${definition.rowNumber}`;
    const primarySplitAddress = `E${definition.rowNumber}`;
    const altBandAddress = `F${definition.rowNumber}`;
    const altSplitAddress = `G${definition.rowNumber}`;
    const primaryBand = readWorkbookBandInput(sheetInputs, primaryBandAddress, definition.primaryBandDefault);
    const primarySplit = readWorkbookPercentInput(sheetInputs, primarySplitAddress, definition.primarySplitDefault);
    const altBand = readWorkbookBandInput(sheetInputs, altBandAddress, definition.altBandDefault);
    const altSplit = readWorkbookPercentInput(sheetInputs, altSplitAddress, definition.altSplitDefault);
    const splitTotal = round(primarySplit + altSplit, 12);

    return {
      ...definition,
      sourceLabel: definition.label,
      personaRoleLabel,
      personaRoleSecondaryLabel: additionalPersonaRoles.join(" · "),
      primaryBand: { address: primaryBandAddress, kind: "band", value: primaryBand, defaultValue: definition.primaryBandDefault },
      primarySplit: { address: primarySplitAddress, kind: "percent", value: primarySplit, defaultValue: definition.primarySplitDefault },
      altBand: { address: altBandAddress, kind: "band", value: altBand, defaultValue: definition.altBandDefault },
      altSplit: { address: altSplitAddress, kind: "percent", value: altSplit, defaultValue: definition.altSplitDefault },
      status: Math.abs(splitTotal - 1) > 0.001 ? "FIX — splits must total 100%" : "OK",
    };
  });
}

export function buildFpaSizingBandMixWorkbookView({ currentDeal = {} } = {}) {
  const workbookInputs = currentDeal?.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
    ? currentDeal.fpaWorkbookInputs
    : EMPTY_INPUTS;
  const sheetInputs = workbookInputs[SHEET_NAME] && typeof workbookInputs[SHEET_NAME] === "object"
    ? workbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;
  const scplInputs = workbookInputs[SCPL_SHEET_NAME] && typeof workbookInputs[SCPL_SHEET_NAME] === "object"
    ? workbookInputs[SCPL_SHEET_NAME]
    : EMPTY_INPUTS;
  const opsWorkbookInputs = workbookInputs[OPS_MODEL_SHEET_NAME] && typeof workbookInputs[OPS_MODEL_SHEET_NAME] === "object"
    ? workbookInputs[OPS_MODEL_SHEET_NAME]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs[RATE_CARD_SHEET_NAME] && typeof workbookInputs[RATE_CARD_SHEET_NAME] === "object"
    ? workbookInputs[RATE_CARD_SHEET_NAME]
    : EMPTY_INPUTS;

  const workspace = normalizeFpaWorkspace(currentDeal?.fpaWorkspace || {});
  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const discoveryComplexity = buildDiscoveryComplexitySignals(discoveryMetrics);
  const opsView = buildFpaOpsModelWorkbookView({ opsWorkbookInputs, rateCardInputs });
  const rateCardView = buildFpaRateCardWorkbookView({ workbookInputs: rateCardInputs });
  const scplSelectedView = buildFpaScplWorkbookView({ currentDeal });

  const baseSalaryByBandCode = Object.fromEntries(
    (rateCardView.baseSalaryRows || []).map((row) => [row.bandCode, Number(row?.values?.offshoreIndia?.value || 0)]),
  );
  const bandNameByCode = Object.fromEntries(
    (rateCardView.baseSalaryRows || []).map((row) => [row.bandCode, row.label]),
  );
  const loadedArcByBandCode = Object.fromEntries(
    (scplSelectedView.bandRows || []).map((row) => [row.bandCode, Number(row.blendedArcUsd || row.standardArcUsd || 0)]),
  );

  const gradeSettings = buildGradeSettings(sheetInputs);
  const gradeSettingsById = Object.fromEntries(gradeSettings.map((row) => [row.id, row]));

  const scplViewByPersona = Object.fromEntries(
    FPA_PERSONA_LIBRARY_COLUMNS.map((persona) => [
      persona.key,
      buildFpaScplWorkbookView({
        currentDeal: buildPreviewDealForPersona(currentDeal, scplInputs, persona.label),
      }),
    ]),
  );

  const recommendedPersonaLabel = scplSelectedView?.recommendedPersona?.label || "Standard";
  const selectedPersonaLabel = scplSelectedView?.selectedPersona?.label || "Standard";
  const selectedPersonaIndex = Math.max(1, FPA_PERSONA_LIBRARY_COLUMNS.findIndex((persona) => persona.label === selectedPersonaLabel) + 1);

  const personaSummaries = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, personaIndex) => {
    const baseTiltLabel = opsView?.personaTiltRow?.values?.[persona.key]?.value || (persona.label === "Conservative" ? "Senior" : persona.label === "Standard" ? "Standard" : "Junior");
    const baseTiltIndex = TILT_INDEX_MAP[baseTiltLabel] || 2;
    const effectiveTiltIndex = clamp(baseTiltIndex + discoveryComplexity.seniorityAdjustment, 1, 3);
    const effectiveTiltLabel = INDEX_TO_TILT_MAP[effectiveTiltIndex] || "Standard";
    const sourceMix = TILT_ROLE_MIX[effectiveTiltLabel] || TILT_ROLE_MIX.Standard;
    const scplPersonaView = scplViewByPersona[persona.key];
    const recommendedIndiaFte = getScplRecommendedIndiaFte(scplPersonaView);

    const blockStartRow = 27 + (personaIndex * 24);
    const roleRows = ROLE_DEFINITIONS.map((definition, roleIndex) => {
      const workbookRow = blockStartRow + 2 + roleIndex;
      const mappingRow = gradeSettingsById[definition.sourceGradeId];
      const recommendedBand = definition.bandMode === "alternate"
        ? mappingRow?.altBand?.value || ""
        : mappingRow?.primaryBand?.value || "";
      const splitPct = definition.bandMode === "alternate"
        ? Number(mappingRow?.altSplit?.value || 0)
        : Number(mappingRow?.primarySplit?.value || 0);
      const roleMixBase = Number(sourceMix[definition.sourceGradeId] || 0);
      const mixPct = round(roleMixBase * splitPct, 12);
      const systemFte = round(recommendedIndiaFte * mixPct, 12);
      const selectedBand = readWorkbookBandInput(sheetInputs, `E${workbookRow}`, "");
      const effectiveBand = selectedBand || recommendedBand;
      const displayBand = effectiveBand || recommendedBand;
      const bandRoleLabel = bandNameByCode[displayBand] || definition.roleLabel;
      const bandRoleSecondaryLabel = bandRoleLabel !== definition.roleLabel
        ? definition.roleLabel
        : definition.sourceLabel !== bandRoleLabel
          ? definition.sourceLabel
          : "";
      const adjustmentInput = readWorkbookDecimalInput(sheetInputs, `I${workbookRow}`, null);
      const adjustmentValue = adjustmentInput === null ? 0 : adjustmentInput;
      const finalFte = round(Math.max(0, systemFte + adjustmentValue), 12);
      const staffingView = ceilHalf(finalFte);
      const standardArc = Number(baseSalaryByBandCode[effectiveBand] || 0);
      const loadedArc = Number(loadedArcByBandCode[effectiveBand] || standardArc);
      const annualCost = round(finalFte * loadedArc, 12);
      const note = readWorkbookTextInput(sheetInputs, `O${workbookRow}`, "");

      return {
        ...definition,
        rowNumber: workbookRow,
        sourceLabel: definition.sourceLabel,
        bandRoleLabel,
        bandRoleSecondaryLabel,
        recommendedBand,
        selectedBandInput: { address: `E${workbookRow}`, kind: "band", value: selectedBand },
        effectiveBand,
        mixPct,
        systemFte,
        adjustmentInput: { address: `I${workbookRow}`, kind: "number", value: adjustmentInput },
        adjustmentValue,
        finalFte,
        staffingView,
        standardArc,
        loadedArc,
        annualCost,
        noteInput: { address: `O${workbookRow}`, kind: "note", value: note },
      };
    });

    const totalSystemFte = round(roleRows.reduce((sum, row) => sum + row.systemFte, 0), 12);
    const totalManualDelta = round(roleRows.reduce((sum, row) => sum + row.adjustmentValue, 0), 12);
    const totalFinalFte = round(roleRows.reduce((sum, row) => sum + row.finalFte, 0), 12);
    const totalStaffing = round(roleRows.reduce((sum, row) => sum + row.staffingView, 0), 12);
    const totalAnnualCost = round(roleRows.reduce((sum, row) => sum + row.annualCost, 0), 12);
    const loadedArcPerFte = totalFinalFte > 0 ? round(totalAnnualCost / totalFinalFte, 12) : 0;
    const mixTotal = round(roleRows.reduce((sum, row) => sum + row.mixPct, 0), 12);
    const bandOverrideCount = roleRows.filter((row) => trimValue(row.selectedBandInput.value)).length;
    const changesWithoutNote = roleRows.filter((row) => {
      const hasBandOverride = trimValue(row.selectedBandInput.value);
      const hasAdjustment = row.adjustmentInput.value !== null;
      return (hasBandOverride || hasAdjustment) && !trimValue(row.noteInput.value);
    }).length;

    const bandSummaryRows = BAND_CODE_OPTIONS.map((bandCode, bandIndex) => {
      const matchingFinalRows = roleRows.filter((row) => row.effectiveBand === bandCode);
      const matchingRecommendedRows = roleRows.filter((row) => row.recommendedBand === bandCode);
      const finalFte = round(matchingFinalRows.reduce((sum, row) => sum + row.finalFte, 0), 12);
      const systemFte = round(matchingRecommendedRows.reduce((sum, row) => sum + row.systemFte, 0), 12);
      const annualCost = round(matchingFinalRows.reduce((sum, row) => sum + row.annualCost, 0), 12);

      return {
        rowNumber: blockStartRow + 12 + bandIndex,
        bandCode,
        bandName: bandNameByCode[bandCode] || bandCode,
        finalFte,
        mixPct: totalFinalFte > 0 ? round(finalFte / totalFinalFte, 12) : 0,
        systemFte,
        deltaFte: round(finalFte - systemFte, 12),
        standardArc: Number(baseSalaryByBandCode[bandCode] || 0),
        annualCost,
      };
    });

    const totalStatus = Math.abs(mixTotal - 1) > 0.001
      ? `FIX — recommended mix ≠ 100% (check §A splits)`
      : `Mix OK · Δ vs system ${formatSizingBandMixValue(totalSystemFte > 0 ? round((totalFinalFte / totalSystemFte) - 1, 12) : 0, "percent1")}`;

    return {
      key: persona.key,
      label: persona.label,
      index: personaIndex + 1,
      blockStartRow,
      baseTiltLabel,
      baseTiltIndex,
      effectiveTiltIndex,
      effectiveTiltLabel,
      recommendedIndiaFte,
      isRecommended: persona.label === recommendedPersonaLabel,
      isSelected: persona.label === selectedPersonaLabel,
      headerText: formatPersonaBlockHeader({
        personaLabel: persona.label,
        personaIndex: personaIndex + 1,
        isRecommended: persona.label === recommendedPersonaLabel,
        isSelected: persona.label === selectedPersonaLabel,
        effectiveTiltLabel,
        recommendedIndiaFte,
      }),
      roleRows,
      totalRow: {
        rowNumber: blockStartRow + 10,
        mixTotal,
        systemFte: totalSystemFte,
        manualDelta: totalManualDelta,
        finalFte: totalFinalFte,
        staffingView: totalStaffing,
        loadedArcPerFte,
        annualCost: totalAnnualCost,
        statusText: totalStatus,
      },
      bandSummaryRows,
      discipline: {
        rowNumber: blockStartRow + 20,
        changesWithoutNote,
        bandOverrideCount,
        statusText: changesWithoutNote > 0
          ? `AMBER — ${changesWithoutNote} change(s) without a note (feeds 30 §F check 10)`
          : "OK — every change carries a note",
      },
    };
  });

  const selectedPersonaSummary = personaSummaries.find((persona) => persona.isSelected)
    || personaSummaries[selectedPersonaIndex - 1]
    || personaSummaries[1]
    || personaSummaries[0];

  const overallStatus = gradeSettings.some((row) => row.status.startsWith("FIX"))
    ? "FIX — mapping splits need attention"
    : selectedPersonaSummary?.discipline?.changesWithoutNote > 0
      ? "AMBER — selected persona has undocumented overrides"
      : "OK";

  return {
    ...FPA_SIZING_BAND_MIX_SNAPSHOT,
    bandOptions: BAND_CODE_OPTIONS,
    recommendedPersonaLabel,
    selectedPersonaLabel,
    selectedPersonaIndex,
    overallStatus,
    discoveryComplexity,
    gradeSettings,
    personaSettingsMatrix: {
      row18Label: "Persona pyramid tilt (09 §F)",
      row19Label: "Tilt index (1 Senior · 2 Standard · 3 Junior)",
      row20Label: "Effective tilt index = persona tilt + Discovery seniority adjustment, clamped 1-3",
      row21Label: "Effective pyramid tilt (drives the recommended mix)",
      row22Label: "SCPL recommended India FTE (30 §A, system base − Discovery adjustment)",
      personas: personaSummaries.map((persona) => ({
        key: persona.key,
        label: persona.label,
        baseTiltLabel: persona.baseTiltLabel,
        baseTiltIndex: persona.baseTiltIndex,
        effectiveTiltIndex: persona.effectiveTiltIndex,
        effectiveTiltLabel: persona.effectiveTiltLabel,
        recommendedIndiaFte: persona.recommendedIndiaFte,
      })),
    },
    personaSummaries,
    selectedPersonaSummary,
    feedSummary: {
      personaLabel: selectedPersonaSummary?.label || selectedPersonaLabel,
      systemFte: selectedPersonaSummary?.totalRow?.systemFte || 0,
      finalFte: selectedPersonaSummary?.totalRow?.finalFte || 0,
      manualDelta: selectedPersonaSummary?.totalRow?.manualDelta || 0,
      bandOverrideCount: selectedPersonaSummary?.discipline?.bandOverrideCount || 0,
      blendedLoadedArcPerFte: selectedPersonaSummary?.totalRow?.loadedArcPerFte || 0,
      annualHclCost: selectedPersonaSummary?.totalRow?.annualCost || 0,
    },
  };
}


