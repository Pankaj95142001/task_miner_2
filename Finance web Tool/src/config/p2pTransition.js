import { buildP2pCostWorkbookView } from "./p2pCost";
import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { buildP2pFteEngineWorkbookView } from "./p2pFteEngine";
import { P2P_PERSONA_LIBRARY_COLUMNS } from "./p2pPersonas";
import { buildP2pPricingWorkbookView } from "./p2pPricing";
import { buildP2pWorkloadModel } from "./p2pWorkload";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "./p2pWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const CURRENCY_ZERO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const CURRENCY_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const REGULATORY_LOAD_FALLBACK = Object.freeze({
  BFSI: 4,
  "CPG & Retail": 3,
  "Technology & SaaS": 2,
  Manufacturing: 3,
  "Healthcare & Pharma": 5,
  "Energy & Utilities": 4,
  "Telecom & Media": 3,
  "Professional Services": 2,
});

const PHASE_BAND_HEADERS = Object.freeze([
  { key: "small", label: "Small (wks)", column: "C" },
  { key: "mid", label: "Mid", column: "D" },
  { key: "large", label: "Large", column: "E" },
  { key: "mega", label: "Mega", column: "F" },
]);

const PHASE_ROW_DEFS = Object.freeze([
  {
    key: "dueDiligence",
    rowNumber: 7,
    label: "Due diligence & solution validation",
    weekDefaults: { small: 2, mid: 3, large: 4, mega: 6 },
    providerRampDefault: 0.2,
    billingDefault: 0,
    preCutoverDefault: 1,
  },
  {
    key: "knowledgeTransfer",
    rowNumber: 8,
    label: "Knowledge transfer",
    weekDefaults: { small: 4, mid: 6, large: 8, mega: 10 },
    providerRampDefault: 0.6,
    billingDefault: 0,
    preCutoverDefault: 1,
  },
  {
    key: "shadow",
    rowNumber: 9,
    label: "Shadow",
    weekDefaults: { small: 3, mid: 4, large: 6, mega: 8 },
    providerRampDefault: 0.8,
    billingDefault: 0.5,
    preCutoverDefault: 1,
  },
  {
    key: "reverseShadow",
    rowNumber: 10,
    label: "Reverse shadow / parallel run",
    weekDefaults: { small: 3, mid: 4, large: 6, mega: 8 },
    providerRampDefault: 1,
    billingDefault: 0.75,
    preCutoverDefault: 1,
  },
  {
    key: "hypercare",
    rowNumber: 11,
    label: "Hypercare (post-cutover)",
    weekDefaults: { small: 4, mid: 6, large: 8, mega: 12 },
    providerRampDefault: 1.1,
    billingDefault: 1,
    preCutoverDefault: 0,
  },
  {
    key: "stabilisationGlide",
    rowNumber: 12,
    label: "Stabilisation glide",
    weekDefaults: { small: 12, mid: 12, large: 12, mega: 12 },
    providerRampDefault: 1.05,
    billingDefault: 1,
    preCutoverDefault: 0,
  },
]);

const TRAVEL_PER_FTE_DEFAULTS = Object.freeze({
  conservative: 3500,
  standard: 3000,
  lean: 2500,
  aggressiveAiFirst: 2000,
  autonomousFinance: 1500,
});

const TRANSITION_PMO_DEFAULTS = Object.freeze({
  conservative: 0.15,
  standard: 0.12,
  lean: 0.1,
  aggressiveAiFirst: 0.08,
  autonomousFinance: 0.08,
});

const BUILD_INTENSITY_DEFAULTS = Object.freeze({
  conservative: 0.08,
  standard: 0.15,
  lean: 0.25,
  aggressiveAiFirst: 0.45,
  autonomousFinance: 0.7,
});

const BUILD_COMPONENT_DEFS = Object.freeze([
  { key: "automationIntegration", rowNumber: 33, label: "Automation & integration", splitDefault: 0.45 },
  { key: "aiAgentBuild", rowNumber: 34, label: "AI / agent build & tuning", splitDefault: 0.3 },
  { key: "platformModernisation", rowNumber: 35, label: "Platform modernisation assist", splitDefault: 0.15 },
  { key: "changeTraining", rowNumber: 36, label: "Change & training", splitDefault: 0.1 },
]);

const TRANSITION_MARKUP_DEFAULT = 0.15;

export const P2P_TRANSITION_SNAPSHOT = Object.freeze({
  sheetName: "P2P_15 Transition",
  title: "15. Transition & Transformation - P2P 6 phases, billing ramp, funding",
  note: "Transition fee (default) = phase cost x (1 + transition markup), milestone-billed. Y1 revenue is ramped by the pre-cutover billing factor.",
  formulaCount: 72,
  phaseCount: 6,
  personaCount: 5,
  editableCellCount: 62,
});

function trimValue(value) {
  return String(value ?? "").trim();
}

function trimTrailingZeros(text) {
  const normalized = String(text ?? "");
  if (!normalized.includes(".")) {
    return normalized;
  }

  return normalized.replace(/0+$/u, "").replace(/\.$/u, "");
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

function thresholdScore(value, thresholds, fallback = 5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  for (let index = 0; index < thresholds.length; index += 1) {
    const [limit, score] = thresholds[index];
    if (numeric <= limit) {
      return score;
    }
  }

  return fallback;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "");

  if (!text) {
    return fallback;
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parsePercentLikeInput(value, fallback = Number.NaN) {
  const text = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "");

  if (!text) {
    return fallback;
  }

  const hasPercentSign = text.includes("%");
  const normalized = text.replace(/%/g, "");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (hasPercentSign) {
    return numeric / 100;
  }

  if (Math.abs(numeric) >= 2) {
    return numeric / 100;
  }

  return numeric;
}

function readWorkbookNumericInput(workbookInputs, address, fallback, kind = "number") {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const rawValue = workbookInputs[address];
  let numeric = kind === "share" || kind === "factor"
    ? parsePercentLikeInput(rawValue, Number.NaN)
    : parseNumericText(rawValue, Number.NaN);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (kind === "whole" || kind === "binary") {
    numeric = Math.round(numeric);
  }

  if (kind === "share") {
    return clamp(numeric, 0, 1);
  }

  if (kind === "factor") {
    return Math.max(0, numeric);
  }

  if (kind === "binary") {
    return numeric ? 1 : 0;
  }

  return numeric;
}

export function formatP2pTransitionValue(value, format = "currency0") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (format === "status") {
    return String(value);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  switch (format) {
    case "currency2":
      return CURRENCY_TWO_FORMATTER.format(numeric);
    case "currency0":
      return CURRENCY_ZERO_FORMATTER.format(Math.round(numeric));
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    case "number2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "whole":
    default:
      return INTEGER_FORMATTER.format(Math.round(numeric));
  }
}

export function formatP2pTransitionInputValue(kind, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  if (kind === "share" || kind === "factor") {
    return `${(numeric * 100).toFixed(1)}%`;
  }

  if (kind === "whole" || kind === "binary") {
    return String(Math.round(numeric));
  }

  return trimTrailingZeros(numeric.toFixed(2));
}

export function normalizeP2pTransitionInputValue(kind, value) {
  const trimmed = trimValue(value);
  if (!trimmed) {
    return "";
  }

  if (kind === "share") {
    const numeric = parsePercentLikeInput(trimmed, Number.NaN);
    return Number.isFinite(numeric) ? String(clamp(numeric, 0, 1)) : null;
  }

  if (kind === "factor") {
    const numeric = parsePercentLikeInput(trimmed, Number.NaN);
    return Number.isFinite(numeric) ? String(Math.max(0, numeric)) : null;
  }

  const numeric = parseNumericText(trimmed, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (kind === "whole" || kind === "binary") {
    return String(Math.round(numeric));
  }

  return String(numeric);
}

function scoreSupplierInvoices(value) {
  return thresholdScore(value, [[250, 1], [600, 2], [1400, 3], [3000, 4]], 5);
}

function scoreExceptionRate(value) {
  return thresholdScore(value, [[0.05, 1], [0.1, 2], [0.2, 3], [0.3, 4]], 5);
}

function scorePoComplianceInverse(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 4;
  }
  if (numeric >= 0.8) {
    return 1;
  }
  if (numeric >= 0.65) {
    return 2;
  }
  if (numeric >= 0.5) {
    return 3;
  }
  if (numeric >= 0.35) {
    return 4;
  }
  return 5;
}

function scoreLegalEntities(value) {
  return thresholdScore(value, [[5, 1], [10, 2], [20, 3], [35, 4]], 5);
}

function scoreBusinessUnits(value) {
  return thresholdScore(value, [[4, 1], [8, 2], [15, 3], [25, 4]], 5);
}

function scoreCountries(value) {
  return thresholdScore(value, [[5, 1], [10, 2], [20, 3], [35, 4]], 5);
}

function scoreP2pPlatform(value) {
  switch (trimValue(value)) {
    case "ERP AP module only (manual)":
      return 5;
    case "Other / mixed":
      return 4;
    case "SAP S/4 MM/AP + partial workflow":
    case "Tungsten / Kofax (IDP) + ERP":
      return 3;
    case "Oracle Fusion Procurement":
    case "Basware":
      return 2;
    case "SAP Ariba":
    case "Coupa":
      return 1;
    default:
      return 4;
  }
}

function scoreDataSources(value) {
  return thresholdScore(value, [[3, 1], [6, 2], [10, 3], [15, 4]], 5);
}

function scoreAiMaturity(value) {
  if (value === "None") {
    return 5;
  }
  if (value === "Exploring") {
    return 4;
  }
  if (value === "Piloting") {
    return 2;
  }
  if (value === "Scaled") {
    return 1;
  }
  return 4;
}

function scoreProcessMaturity(value) {
  if (value === "Basic") {
    return 5;
  }
  if (value === "Developing") {
    return 4;
  }
  if (value === "Established") {
    return 2;
  }
  if (value === "Leading") {
    return 1;
  }
  return 4;
}

function scorePaymentRuns(value) {
  return thresholdScore(value, [[4, 1], [8, 2], [15, 3], [25, 4]], 5);
}

function scoreAutomationMaturity(value) {
  if (value === "Low (<20%)") {
    return 4;
  }
  if (value === "Medium (20-40%)") {
    return 3;
  }
  if (value === "High (40-60%)") {
    return 2;
  }
  if (value === "Very High (>60%)") {
    return 1;
  }
  return 4;
}

function scoreLanguages(value) {
  return thresholdScore(value, [[0, 1], [2, 3]], 5);
}

function scoreActiveVendors(value) {
  return thresholdScore(value, [[10, 1], [25, 2], [55, 3], [120, 4]], 5);
}

function scoreCurrentTowerStaff(value) {
  return thresholdScore(value, [[20, 1], [50, 2], [100, 3], [200, 4]], 5);
}

const COMPLEXITY_DIMENSIONS = Object.freeze([
  {
    row: 6,
    computeAutoScore: ({ discovery }) => average([
      scoreSupplierInvoices(Number(discovery.supplierInvoices000 || 0)),
      scoreExceptionRate(Number(discovery.invoiceExceptionRate || 0.18)),
      scorePoComplianceInverse(Number(discovery.poBackedSpendShare || 0.6)),
    ]),
    weight: 0.14,
  },
  {
    row: 7,
    computeAutoScore: ({ discovery }) => average([
      scoreLegalEntities(discovery.legalEntities),
      scoreBusinessUnits(discovery.businessUnits),
      scoreCountries(discovery.geoCountries),
    ]),
    weight: 0.12,
  },
  {
    row: 8,
    computeAutoScore: ({ discovery }) => average([
      scoreP2pPlatform(discovery.p2pPlatform),
      scoreDataSources(discovery.dataSourcesCount),
    ]),
    weight: 0.14,
  },
  {
    row: 9,
    computeAutoScore: ({ discovery }) => average([
      scoreP2pPlatform(discovery.p2pPlatform),
      scoreAiMaturity(discovery.aiMaturity),
    ]),
    weight: 0.10,
  },
  {
    row: 10,
    computeAutoScore: ({ discovery }) => average([
      scoreProcessMaturity(discovery.processMaturity),
      scorePaymentRuns(Number(discovery.paymentRunsPerMonth || 0)),
    ]),
    weight: 0.12,
  },
  {
    row: 11,
    computeAutoScore: ({ discovery }) => scoreAutomationMaturity(discovery.automationMaturity),
    weight: 0.10,
  },
  {
    row: 12,
    computeAutoScore: ({ discovery }) => average([
      scoreCountries(discovery.geoCountries),
      scoreLanguages(discovery.languagesBeyondEnglish),
    ]),
    weight: 0.08,
  },
  {
    row: 13,
    computeAutoScore: ({ discovery, benchmarkModel }) => average([
      benchmarkModel.regulatoryLoad,
      scoreActiveVendors(discovery.activeVendors000),
    ]),
    weight: 0.10,
  },
  {
    row: 14,
    computeAutoScore: ({ discovery }) => average([
      scoreActiveVendors(discovery.activeVendors000),
      scoreCurrentTowerStaff(discovery.currentTowerStaff),
    ]),
    weight: 0.10,
  },
]);

function deriveComplexityBand(complexityInputs, benchmarkModel, effectiveDiscovery) {
  const compositeScore = COMPLEXITY_DIMENSIONS.reduce((sum, dimension) => {
    const overrideValue = parseNumericText(complexityInputs[`E${dimension.row}`], Number.NaN);
    const autoScore = dimension.computeAutoScore({ discovery: effectiveDiscovery, benchmarkModel });
    const finalScore = Number.isFinite(overrideValue) ? overrideValue : autoScore;
    return sum + (dimension.weight * finalScore);
  }, 0);

  const band = compositeScore < 2 ? "LOW" : compositeScore < 3 ? "MEDIUM" : compositeScore < 4 ? "HIGH" : "VERY HIGH";

  return {
    compositeScore: round(compositeScore, 12),
    band,
  };
}

function buildPhaseRows(transitionInputs, revenueBandIndex) {
  const selectedIndex = clamp(Math.round(revenueBandIndex || 1), 1, 4);
  const selectedBand = PHASE_BAND_HEADERS[selectedIndex - 1] || PHASE_BAND_HEADERS[0];

  return PHASE_ROW_DEFS.map((definition) => {
    const weekCells = PHASE_BAND_HEADERS.map((band) => ({
      key: band.key,
      label: band.label,
      column: band.column,
      address: `${band.column}${definition.rowNumber}`,
      kind: "whole",
      isEditable: true,
      value: readWorkbookNumericInput(
        transitionInputs,
        `${band.column}${definition.rowNumber}`,
        definition.weekDefaults[band.key],
        "whole",
      ),
    }));

    const providerRamp = {
      address: `G${definition.rowNumber}`,
      kind: "factor",
      isEditable: true,
      value: readWorkbookNumericInput(transitionInputs, `G${definition.rowNumber}`, definition.providerRampDefault, "factor"),
    };
    const billingPct = {
      address: `H${definition.rowNumber}`,
      kind: "share",
      isEditable: true,
      value: readWorkbookNumericInput(transitionInputs, `H${definition.rowNumber}`, definition.billingDefault, "share"),
    };
    const preCutover = {
      address: `J${definition.rowNumber}`,
      kind: "binary",
      isEditable: true,
      value: readWorkbookNumericInput(transitionInputs, `J${definition.rowNumber}`, definition.preCutoverDefault, "binary"),
    };
    const selectedWeekCell = weekCells[selectedIndex - 1] || weekCells[0];

    return {
      ...definition,
      weekCells,
      providerRamp,
      billingPct,
      preCutover,
      effectiveWeeks: selectedWeekCell?.value || 0,
      selectedBandKey: selectedBand.key,
    };
  });
}

function buildPersonaInputCells(transitionInputs, rowNumber, defaults, kind) {
  return P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => ({
    key: persona.key,
    label: persona.label,
    workbookColumn: persona.workbookColumn,
    address: `${persona.workbookColumn}${rowNumber}`,
    kind,
    isEditable: true,
    value: readWorkbookNumericInput(transitionInputs, `${persona.workbookColumn}${rowNumber}`, defaults[persona.key] || 0, kind),
  }));
}

function toPersonaValueMap(cells = []) {
  return Object.fromEntries(cells.map((cell) => [cell.key, Number(cell.value || 0)]));
}

function getSummaryRowPersonaMap(summaryRows, rowNumber) {
  const row = summaryRows.find((item) => item.rowNumber === rowNumber);
  return Object.fromEntries((row?.values || []).map((cell) => [cell.key, Number(cell.value || 0)]));
}

function getPricingRowPersonaMap(pricingView, rowKey) {
  const row = pricingView.summaryRows.find((item) => item.key === rowKey);
  return Object.fromEntries((row?.values || []).map((cell) => [cell.key, Number(cell.value || 0)]));
}

export function buildP2pTransitionWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : EMPTY_INPUTS;
  const transitionInputs = workbookInputs[P2P_TRANSITION_SNAPSHOT.sheetName] && typeof workbookInputs[P2P_TRANSITION_SNAPSHOT.sheetName] === "object"
    ? workbookInputs[P2P_TRANSITION_SNAPSHOT.sheetName]
    : EMPTY_INPUTS;
  const complexityInputs = workbookInputs["P2P_06 Complexity"] && typeof workbookInputs["P2P_06 Complexity"] === "object"
    ? workbookInputs["P2P_06 Complexity"]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const workloadView = buildP2pWorkloadModel(workspace, currentDeal);
  const revenueBandIndex = clamp(
    Math.round(workloadView?.benchmarkModel?.bandIndex || discoveryMetrics?.benchmarkModel?.bandIndex || 1),
    1,
    4,
  );
  const selectedPhaseBand = PHASE_BAND_HEADERS[revenueBandIndex - 1] || PHASE_BAND_HEADERS[0];

  const phaseRows = buildPhaseRows(transitionInputs, revenueBandIndex);
  const phaseRowMap = Object.fromEntries(phaseRows.map((row) => [row.key, row]));
  const weightedEffortWeeks = round(
    phaseRows.reduce((sum, row) => sum + (row.effectiveWeeks * row.providerRamp.value), 0),
    12,
  );
  const preCutoverWeeks = round(
    phaseRows.reduce((sum, row) => sum + (row.effectiveWeeks * row.preCutover.value), 0),
    12,
  );
  const preCutoverBillingCreditWeeks = round(
    phaseRows.reduce((sum, row) => sum + (row.effectiveWeeks * row.preCutover.value * row.billingPct.value), 0),
    12,
  );
  const y1BillingFactor = round(Math.min(1, (preCutoverBillingCreditWeeks + (52 - preCutoverWeeks)) / 52), 12);
  const billingFactorStatus = preCutoverWeeks > 52
    ? "AMBER — transition exceeds 12 months; extend model"
    : "OK";

  const transitionDurationWeeks = round(
    ["dueDiligence", "knowledgeTransfer", "shadow", "reverseShadow", "hypercare"]
      .reduce((sum, key) => sum + (phaseRowMap[key]?.effectiveWeeks || 0), 0),
    12,
  );

  const complexityView = deriveComplexityBand(
    complexityInputs,
    workloadView.benchmarkModel || discoveryMetrics.benchmarkModel,
    discoveryMetrics.effectiveDiscovery,
  );
  const complexityAdjustedDurationWeeks = round(
    transitionDurationWeeks * (complexityView.band === "VERY HIGH" ? 1.3 : complexityView.band === "HIGH" ? 1.15 : 1),
    12,
  );

  const fteView = buildP2pFteEngineWorkbookView({ currentDeal, workspace });
  const costView = buildP2pCostWorkbookView({ currentDeal, workspace });
  const pricingView = buildP2pPricingWorkbookView({ currentDeal, workspace });

  const steadyFteByPersona = getSummaryRowPersonaMap(fteView.summaryRows, 37);
  const blendedCostPerFteByPersona = Object.fromEntries(
    costView.personaSections.map((persona) => [persona.key, Number(persona.summary.blendedCostPerFteY1 || 0)]),
  );
  const annualPriceByPersona = getPricingRowPersonaMap(pricingView, "recommendedAnnualPrice");

  const transitionMarkup = {
    address: "C28",
    kind: "share",
    isEditable: true,
    value: readWorkbookNumericInput(transitionInputs, "C28", TRANSITION_MARKUP_DEFAULT, "share"),
  };

  const travelPerFteCells = buildPersonaInputCells(transitionInputs, 19, TRAVEL_PER_FTE_DEFAULTS, "number");
  const transitionPmoCells = buildPersonaInputCells(transitionInputs, 20, TRANSITION_PMO_DEFAULTS, "share");
  const buildIntensityCells = buildPersonaInputCells(transitionInputs, 31, BUILD_INTENSITY_DEFAULTS, "share");

  const travelPerFteByPersona = toPersonaValueMap(travelPerFteCells);
  const transitionPmoByPersona = toPersonaValueMap(transitionPmoCells);
  const buildIntensityByPersona = toPersonaValueMap(buildIntensityCells);

  function phaseEffortCostForPersona(personaKey) {
    const steadyFte = steadyFteByPersona[personaKey] || 0;
    const blendedCost = blendedCostPerFteByPersona[personaKey] || 0;
    const travelPerFte = travelPerFteByPersona[personaKey] || 0;
    return round(((weightedEffortWeeks * steadyFte * blendedCost) / 52) + (travelPerFte * steadyFte), 12);
  }

  const transitionCostRows = [
    {
      key: "travelPerFte",
      rowNumber: 19,
      label: "Travel & knowledge-capture / FTE [PA]",
      format: "currency0",
      values: travelPerFteCells,
    },
    {
      key: "transitionPmoPct",
      rowNumber: 20,
      label: "Transition PMO % of effort",
      format: "percent1",
      values: transitionPmoCells,
    },
    {
      key: "steadyStateFte",
      rowNumber: 21,
      label: "Steady-State FTE",
      format: "number2",
      values: P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: steadyFteByPersona[persona.key] || 0,
        isEditable: false,
      })),
    },
    {
      key: "blendedCostPerFteY1",
      rowNumber: 22,
      label: "Blended Cost / FTE (Y1)",
      format: "currency2",
      values: P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: blendedCostPerFteByPersona[persona.key] || 0,
        isEditable: false,
      })),
    },
    {
      key: "phaseEffortCost",
      rowNumber: 23,
      label: "Phase effort cost",
      format: "currency0",
      values: P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: phaseEffortCostForPersona(persona.key),
        isEditable: false,
      })),
    },
    {
      key: "pmoCost",
      rowNumber: 24,
      label: "PMO cost",
      format: "currency0",
      values: P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => {
        const phaseEffortCost = phaseEffortCostForPersona(persona.key);
        const value = round(phaseEffortCost * (transitionPmoByPersona[persona.key] || 0), 12);
        return { key: persona.key, label: persona.label, value, isEditable: false };
      }),
    },
    {
      key: "transitionCost",
      rowNumber: 25,
      label: "TRANSITION COST (TC)",
      format: "currency0",
      isTotal: true,
      values: P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => {
        const phaseEffortCost = phaseEffortCostForPersona(persona.key);
        const pmoCost = round(phaseEffortCost * (transitionPmoByPersona[persona.key] || 0), 12);
        const value = round(phaseEffortCost + pmoCost, 12);
        return { key: persona.key, label: persona.label, value, isEditable: false };
      }),
    },
    {
      key: "transitionFee",
      rowNumber: 26,
      label: "TRANSITION FEE (TC x 1+markup)",
      format: "currency0",
      isTotal: true,
      values: P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => {
        const phaseEffortCost = phaseEffortCostForPersona(persona.key);
        const pmoCost = round(phaseEffortCost * (transitionPmoByPersona[persona.key] || 0), 12);
        const transitionCost = round(phaseEffortCost + pmoCost, 12);
        const value = round(transitionCost * (1 + transitionMarkup.value), 12);
        return { key: persona.key, label: persona.label, value, isEditable: false };
      }),
    },
  ];

  const componentSplitRows = BUILD_COMPONENT_DEFS.map((definition) => ({
    ...definition,
    split: {
      address: `H${definition.rowNumber}`,
      kind: "share",
      isEditable: true,
      value: readWorkbookNumericInput(transitionInputs, `H${definition.rowNumber}`, definition.splitDefault, "share"),
    },
  }));
  const componentSplitByKey = Object.fromEntries(componentSplitRows.map((row) => [row.key, row.split.value]));
  const componentSplitTotal = round(componentSplitRows.reduce((sum, row) => sum + row.split.value, 0), 12);

  const transformationRows = [
    {
      key: "buildIntensity",
      rowNumber: 31,
      label: "Build intensity (% of Y1 price)",
      format: "percent1",
      values: buildIntensityCells,
      split: null,
    },
    {
      key: "transformationBuild",
      rowNumber: 32,
      label: "TRANSFORMATION BUILD (TB)",
      format: "currency0",
      isTotal: true,
      values: P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: round((buildIntensityByPersona[persona.key] || 0) * (annualPriceByPersona[persona.key] || 0), 12),
        isEditable: false,
      })),
      split: null,
    },
    ...componentSplitRows.map((componentRow) => ({
      key: componentRow.key,
      rowNumber: componentRow.rowNumber,
      label: componentRow.label,
      format: "currency0",
      values: P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => {
        const transformationBuild = round((buildIntensityByPersona[persona.key] || 0) * (annualPriceByPersona[persona.key] || 0), 12);
        const value = round(transformationBuild * componentSplitByKey[componentRow.key], 12);
        return { key: persona.key, label: persona.label, value, isEditable: false };
      }),
      split: componentRow.split,
    })),
    {
      key: "customerTransitionEffort",
      rowNumber: 38,
      label: "Customer-side transition effort (info only)",
      format: "currency0",
      values: P2P_PERSONA_LIBRARY_COLUMNS.map((persona) => {
        const steadyFte = steadyFteByPersona[persona.key] || 0;
        const blendedCost = blendedCostPerFteByPersona[persona.key] || 0;
        const weeks = (phaseRowMap.knowledgeTransfer?.effectiveWeeks || 0) + (phaseRowMap.shadow?.effectiveWeeks || 0);
        const value = round(0.4 * weeks * steadyFte * blendedCost / 52, 12);
        return { key: persona.key, label: persona.label, value, isEditable: false };
      }),
      split: null,
    },
  ];

  const componentReconciliationStatus = Math.abs(componentSplitTotal - 1) > 0.001
    ? "FIX — build splits must total 100%"
    : "OK";

  return {
    ...P2P_TRANSITION_SNAPSHOT,
    revenueBandIndex,
    selectedPhaseBand,
    recommendedPersona: pricingView.recommendedPersona,
    personaHeaders: pricingView.personaHeaders || P2P_PERSONA_LIBRARY_COLUMNS,
    controls: {
      transitionMarkup,
    },
    complexityBand: complexityView.band,
    complexityCompositeScore: complexityView.compositeScore,
    phaseRows,
    weightedEffortWeeks,
    preCutoverWeeks,
    preCutoverBillingCreditWeeks,
    y1BillingFactor,
    billingFactorStatus,
    transitionDurationWeeks,
    complexityAdjustedDurationWeeks,
    transitionCostRows,
    transformationRows,
    componentSplitTotal,
    componentReconciliationStatus,
  };
}





