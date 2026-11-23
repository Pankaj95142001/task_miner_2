import { buildFpaAiBenefitWorkbookView } from "./fpaAiBenefit";
import { buildFpaBusinessCaseWorkbookView } from "./fpaBusinessCase";
import { buildFpaClientValueWorkbookView } from "./fpaClientValue";
import { buildFpaCostWorkbookView } from "./fpaCost";
import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";
import { buildFpaDealRisksWorkbookView } from "./fpaDealRisks";
import { buildFpaFteEngineWorkbookView } from "./fpaFteEngine";
import { buildFpaOpsModelWorkbookView } from "./fpaOpsModel";
import {
  FPA_PERSONA_LIBRARY_COLUMNS,
  FPA_PERSONA_LIBRARY_ROWS,
} from "./fpaPersonas";
import { buildFpaPricingWorkbookView } from "./fpaPricing";
import { buildFpaRateCardWorkbookView } from "./fpaRateCard";
import { buildFpaRecommendWorkbookView } from "./fpaRecommend";
import { buildFpaRiskWorkbookView } from "./fpaRisk";
import { buildFpaSensitivityWorkbookView } from "./fpaSensitivity";
import { buildFpaTraceLogWorkbookView } from "./fpaTraceLog";
import { buildFpaTransitionWorkbookView } from "./fpaTransition";
import { buildFpaWorkloadWorkbookView } from "./fpaWorkload";
import { buildFpaOutcomeWorkbookView } from "./fpaOutcome";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";

const EMPTY_INPUTS = Object.freeze({});
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
const CURRENCY_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERSONA_HEADERS = Object.freeze(
  FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
  })),
);

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

const PERSONA_COLUMN_MAP = Object.freeze(
  Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, persona])),
);

const CALIBRATION_LEVER_DEFS = Object.freeze([
  { key: "utilisationPct", rowNumber: 21, label: "Utilisation %", low: 0.75, high: 0.92, mode: "normal" },
  { key: "shrinkagePct", rowNumber: 22, label: "Shrinkage %", low: 0.06, high: 0.16, mode: "inverse" },
  { key: "managementBufferPct", rowNumber: 23, label: "Management Buffer %", low: 0.03, high: 0.15, mode: "inverse" },
  { key: "backupCrossSkillingPct", rowNumber: 24, label: "Backup / Cross-skilling %", low: 0.03, high: 0.12, mode: "inverse" },
  { key: "peakUpliftPct", rowNumber: 25, label: "Peak Uplift % (peak season)", low: 0.08, high: 0.3, mode: "inverse" },
  { key: "spanOfControl", rowNumber: 26, label: "Span of Control", low: 6, high: 12, mode: "normal" },
  { key: "ambitionScalar", rowNumber: 27, label: "Ambition Scalar (x lever potential)", low: 0.3, high: 1, mode: "normal" },
  { key: "productivityGlideY2Pct", rowNumber: 28, label: "Productivity Glide Y2 %", low: 0.02, high: 0.1, mode: "normal" },
  { key: "targetGrossMarginPct", rowNumber: 29, label: "Target Gross Margin %", low: 0.15, high: 0.32, mode: "inverse" },
  { key: "markupOnCostPct", rowNumber: 30, label: "Markup on Cost %", low: 0.18, high: 0.55, mode: "inverse" },
  { key: "contingencyPct", rowNumber: 31, label: "Contingency % on cost [PA]", low: 0.02, high: 0.06, mode: "inverse" },
  { key: "year1LearningCurvePct", rowNumber: 32, label: "Yr-1 Learning Curve % (cost uplift)", low: 0.03, high: 0.15, mode: "inverse" },
]);

const LOGIC_CHECK_DEFS = Object.freeze([
  { id: 1, rowNumber: 26, label: "Client name set on E2E Deal Master" },
  { id: 2, rowNumber: 27, label: "Constructs complete (01)" },
  { id: 3, rowNumber: 28, label: "Input completeness >= 50%" },
  { id: 4, rowNumber: 29, label: "Weights total 100% (06 / 20)" },
  { id: 5, rowNumber: 30, label: "Shore mixes total 100% (09)" },
  { id: 6, rowNumber: 31, label: "Location splits OK (09)" },
  { id: 7, rowNumber: 32, label: "Outcome allocation reconciles (14)" },
  { id: 8, rowNumber: 33, label: "Recommended persona has 0 RED (18)" },
  { id: 9, rowNumber: 34, label: "No unlogged overrides (23)" },
  { id: 10, rowNumber: 35, label: "Customer-FTE reconciliation not RED (05 §C)" },
  { id: 11, rowNumber: 36, label: "Rate card confirmed (10)" },
  { id: 12, rowNumber: 37, label: "Calibration verdict not RED (26)" },
  { id: 13, rowNumber: 38, label: "Deal-risk verdict not RED (19)" },
  { id: 14, rowNumber: 39, label: "Tower in scope on E2E Deal Master" },
]);

export const FPA_DASHBOARD_SNAPSHOT = Object.freeze({
  sheetName: "FPA_22 Dashboard",
  title: "22. Executive Dashboard — FP&A (Financial Planning & Analysis)",
  note: "All values flow from the engines — nothing is typed here. Machine-readable surface for the HTML cockpit (label contract).",
  formulaCount: 220,
  personaCount: PERSONA_HEADERS.length,
  logicCheckCount: LOGIC_CHECK_DEFS.length,
  readinessMetricCount: 21,
});

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

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .replace(/x$/iu, "");

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

function normalizePersonaId(value) {
  const normalized = trimValue(value);

  switch (normalized) {
    case "aggressive-ai-first":
      return "aggressiveAiFirst";
    case "autonomous-finance":
      return "autonomousFinance";
    default:
      return normalized || "standard";
  }
}

function isYesLike(value) {
  const normalized = trimValue(value).toLowerCase();
  return value === true || normalized === "yes" || normalized === "true" || normalized === "1";
}

function toWorkbookCellMap(rows = []) {
  const cellMap = {};

  rows.forEach((row) => {
    (row?.cells || []).forEach((cell) => {
      if (cell?.address) {
        cellMap[cell.address] = cell;
      }
    });
  });

  return cellMap;
}

function getCellText(cellMap, address, fallback = "") {
  const cell = cellMap[address];
  return trimValue(cell?.text ?? cell?.raw ?? cell?.value ?? fallback);
}

function getCellNumber(cellMap, address, fallback = 0) {
  const cell = cellMap[address];
  const rawValue = cell?.raw ?? cell?.value ?? cell?.text;
  const parsed = parseNumericText(rawValue, Number.NaN);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPersonaMetricMaps(rows = []) {
  return Object.fromEntries(
    rows
      .filter((row) => row?.key)
      .map((row) => [
        row.key,
        Object.fromEntries(
          (row.values || []).map((cell) => [cell.key, {
            value: cell.value,
            text: cell.text,
          }]),
        ),
      ]),
  );
}

function getPersonaMetricValue(metricMap, rowKey, personaKey, fallback = 0) {
  const value = metricMap?.[rowKey]?.[personaKey]?.value;
  return value === undefined || value === null || value === "" ? fallback : value;
}

function getPersonaMetricText(metricMap, rowKey, personaKey, fallback = "") {
  const text = metricMap?.[rowKey]?.[personaKey]?.text;
  return trimValue(text || fallback);
}

function formatDashboardValue(value, format = "text") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (["status", "text"].includes(format)) {
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
    case "percent0":
      return `${Math.round(numeric * 100)}%`;
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    case "score1":
    case "number1":
      return DECIMAL_ONE_FORMATTER.format(numeric);
    case "number2":
    case "fte2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "factor2":
      return `${DECIMAL_TWO_FORMATTER.format(numeric)}x`;
    case "whole":
      return INTEGER_FORMATTER.format(Math.round(numeric));
    default:
      return DECIMAL_TWO_FORMATTER.format(numeric);
  }
}

export { formatDashboardValue };

function createMetricRow(rowNumber, label, value, format = "text") {
  return {
    rowNumber,
    label,
    value,
    format,
    text: formatDashboardValue(value, format),
  };
}

function createPersonaCells(valuesByPersona, format = "text") {
  return PERSONA_HEADERS.map((persona) => ({
    key: persona.key,
    label: persona.label,
    value: valuesByPersona[persona.key],
    text: formatDashboardValue(valuesByPersona[persona.key], format),
  }));
}

function createPersonaRow(rowNumber, key, label, valuesByPersona, format = "text") {
  return {
    rowNumber,
    key,
    label,
    format,
    values: createPersonaCells(valuesByPersona, format),
  };
}

function readPersonaMetric(currentDeal, metricKey, personaKey) {
  const persona = PERSONA_COLUMN_MAP[normalizePersonaId(personaKey)] || PERSONA_COLUMN_MAP.standard;
  const definition = PERSONA_ROW_MAP[metricKey];
  const workbookInputs = currentDeal?.fpaWorkbookInputs?.["FPA_07 Personas"]
    && typeof currentDeal.fpaWorkbookInputs["FPA_07 Personas"] === "object"
    ? currentDeal.fpaWorkbookInputs["FPA_07 Personas"]
    : EMPTY_INPUTS;

  if (!persona || !definition) {
    return "";
  }

  const address = `${persona.workbookColumn}${definition.workbookRow}`;
  const rawValue = Object.prototype.hasOwnProperty.call(workbookInputs, address)
    ? workbookInputs[address]
    : definition.values[persona.key];

  if (definition.format === "text") {
    return trimValue(rawValue) || String(definition.values[persona.key] ?? "");
  }

  const numeric = Number(rawValue);
  return Number.isFinite(numeric) ? numeric : Number(definition.values[persona.key] || 0);
}

function evaluateCalibrationLever(value, low, high, mode) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "Over-conservative";
  }

  if (mode === "inverse") {
    if (numeric < low) {
      return "AGGRESSIVE";
    }
    if (numeric > high) {
      return "Over-conservative";
    }
    return "Defendable";
  }

  if (numeric > high) {
    return "AGGRESSIVE";
  }
  if (numeric < low) {
    return "Over-conservative";
  }
  return "Defendable";
}

function buildCalibrationSummary(currentDeal, aiView, pricingView, riskView, transitionView, opsView, businessCaseView, clientValueView, workloadCellMap, discoveryMetrics, rateCardView) {
  const pricingSummaryMap = buildPersonaMetricMaps(pricingView.summaryRows);
  const annualChargeY1ByPersona = Object.fromEntries(
    (businessCaseView.annualChargeRows || []).map((row) => [row.key, Number(row.values?.[0]?.value || 0)]),
  );
  const riskPersonaMap = Object.fromEntries((riskView.personaVerdicts || []).map((persona) => [persona.key, persona]));
  const aiPersonaMap = Object.fromEntries((aiView.personas || []).map((persona) => [normalizePersonaId(persona.id || persona.key), persona]));
  const pricePerFteByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(pricingSummaryMap, "blendedBillRatePerDeliveredFteY1", persona.key, 0))]),
  );
  const gmPctByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(pricingSummaryMap, "grossMarginPct", persona.key, 0))]),
  );
  const offshoreMixRow = opsView.shoreMixTable?.rows?.find((row) => row.id === "offshore") || null;
  const offshoreMixByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, Number(offshoreMixRow?.values?.[persona.key]?.value || 0)]),
  );
  const clientBaselineY1 = Number(clientValueView.contextRows?.find((row) => row.key === "clientBaselineY1")?.value || 0);
  const effectiveCeiling = Number(aiView.gateDrivers?.effectiveCeiling || 0);
  const outsourcedShare = getCellNumber(workloadCellMap, "C33", 0);
  const blindFte = getCellNumber(workloadCellMap, "C31", 0);
  const annualRevenueUsdB = Number(discoveryMetrics.effectiveDiscovery?.annualRevenueUsdM || 0);
  const transitionWeeks = Number(transitionView.complexityAdjustedDurationWeeks || 0);
  const lowerBlindBand = annualRevenueUsdB * 0.1 * 0.75;
  const upperBlindBand = annualRevenueUsdB * 0.35 * 1.35;

  const corroborationStatuses = {
    outsourcedShare: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, outsourcedShare >= 0.1 && outsourcedShare <= 0.35 ? "GREEN" : "AMBER"])),
    pricePerFte: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, pricePerFteByPersona[persona.key] >= 60000 && pricePerFteByPersona[persona.key] <= 140000 ? "GREEN" : "AMBER"])),
    grossMargin: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, gmPctByPersona[persona.key] >= 0.15 && gmPctByPersona[persona.key] <= 0.35 ? "GREEN" : "AMBER"])),
    offshoreMix: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, offshoreMixByPersona[persona.key] >= 0.4 && offshoreMixByPersona[persona.key] <= 0.9 ? "GREEN" : "AMBER"])),
    automation: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(aiPersonaMap[persona.key]?.summary?.impliedAutomationPct || 0) <= effectiveCeiling ? "GREEN" : "AMBER"])),
    transitionWeeks: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, transitionWeeks >= 8 && transitionWeeks <= 30 ? "GREEN" : "AMBER"])),
    clientSavingsY1: Object.fromEntries(PERSONA_HEADERS.map((persona) => {
      const annualChargeY1 = annualChargeY1ByPersona[persona.key] || 0;
      const savingsPct = clientBaselineY1 > 0 ? (clientBaselineY1 - annualChargeY1) / clientBaselineY1 : 0;
      return [persona.key, savingsPct >= 0.05 && savingsPct <= 0.4 ? "GREEN" : "AMBER"];
    })),
    blindFteBand: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, blindFte >= lowerBlindBand && blindFte <= upperBlindBand ? "GREEN" : "AMBER"])),
  };

  const calibrationLeverStatuses = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [
      persona.key,
      CALIBRATION_LEVER_DEFS.map((definition) => evaluateCalibrationLever(
        readPersonaMetric(currentDeal, definition.key, persona.key),
        definition.low,
        definition.high,
        definition.mode,
      )),
    ]),
  );

  const defendableCountByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, calibrationLeverStatuses[persona.key].filter((status) => status === "Defendable").length]),
  );
  const aggressiveCountByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, calibrationLeverStatuses[persona.key].filter((status) => status === "AGGRESSIVE").length]),
  );
  const conservativeCountByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, calibrationLeverStatuses[persona.key].filter((status) => status === "Over-conservative").length]),
  );
  const benchmarkCorroborationByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => {
      const greenCount = Object.values(corroborationStatuses).filter((statusByPersona) => statusByPersona[persona.key] === "GREEN").length;
      return [persona.key, round(greenCount / 8, 12)];
    }),
  );

  const rateCardConfirmed = trimValue(rateCardView.confirmation?.value) === "Yes";
  const coverageShare = round(Number(discoveryMetrics.coverageScorePct || 0) / 100, 12);
  const coverageAdjustment = Math.min(0.15, Math.max(0, (coverageShare - 0.3) / 0.1) * 0.05);
  const totalMonthlyHours = Math.max(0.01, getCellNumber(workloadCellMap, "K26", Number(aiView.totalMonthlyHours || 0)));

  const sizingConfidence = round(
    Array.from({ length: 12 }, (_, index) => 14 + index).reduce((sum, rowNumber) => {
      const methodLetter = getCellText(workloadCellMap, `F${rowNumber}`).charAt(0).toUpperCase();
      const baseConfidence = methodLetter === "A" ? 0.9 : methodLetter === "D" ? 0.6 : 0.35;
      const driverVarianceStatus = getCellText(workloadCellMap, `M${rowNumber}`).toUpperCase();
      const reconciliationStatus = getCellText(workloadCellMap, `M${rowNumber + 30}`).toUpperCase();
      const variancePenalty = driverVarianceStatus.startsWith("AMBER") || reconciliationStatus.startsWith("RED") || reconciliationStatus.startsWith("AMBER")
        ? 0.9
        : 1;
      const confidence = (baseConfidence + coverageAdjustment) * variancePenalty;
      const weight = getCellNumber(workloadCellMap, `K${rowNumber}`, 0) / totalMonthlyHours;
      return sum + (confidence * weight);
    }, 0),
    12,
  );

  const confidenceScoresByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => {
      const biasClampOk = trimValue(getPersonaMetricText(pricingSummaryMap, "biasClampFlag", persona.key, "OK")) === "OK";
      const commercialConfidence = (rateCardConfirmed ? 0.9 : 0.65) - (biasClampOk ? 0 : 0.1);
      const aiConfidence = Math.max(
        0.3,
        1
          - ((Number(aiPersonaMap[persona.key]?.summary?.weightedNetReductionSteady || 0) / Math.max(0.01, effectiveCeiling)) * 0.6)
          - (Number(aiView.gateDrivers?.agenticDataGate || 0) === 0 ? 0.05 : 0),
      );
      const validationConfidence = Math.max(
        0.3,
        1
          - (0.15 * Number(riskPersonaMap[persona.key]?.redCount || 0))
          - (0.05 * Number(riskPersonaMap[persona.key]?.amberCount || 0)),
      );

      const score = round(
        (sizingConfidence * 0.4)
          + (aiConfidence * 0.25)
          + (commercialConfidence * 0.2)
          + (validationConfidence * 0.15),
        12,
      );

      return [persona.key, score];
    }),
  );

  const calibrationVerdictByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => {
      const aggressiveFlags = aggressiveCountByPersona[persona.key] || 0;
      const verdict = aggressiveFlags >= 3
        ? "RED — re-base aggressive levers"
        : aggressiveFlags > 0
          ? "AMBER — justify aggressive levers"
          : "GREEN — defendable";
      return [persona.key, verdict];
    }),
  );

  return {
    defendableCountByPersona,
    aggressiveCountByPersona,
    conservativeCountByPersona,
    benchmarkCorroborationByPersona,
    confidenceScoresByPersona,
    calibrationVerdictByPersona,
  };
}

function buildLogicChecks({
  currentDeal,
  discoveryMetrics,
  recommendView,
  riskView,
  rateCardView,
  opsView,
  workloadCellMap,
  calibrationVerdict,
  dealRisksView,
  outcomeView,
  unloggedOverrideCount,
}) {
  const clientName = trimValue(currentDeal?.clientName);
  const placeholderClientName = !clientName || clientName === "<Client Name>";
  const constructsMissing = [currentDeal?.pricingConstruct, currentDeal?.transitionCommercials, currentDeal?.transformationFunding]
    .some((value) => !trimValue(value));
  const weightsOk = trimValue(recommendView.weightStatus) === "Weights OK";
  const shoreMixOk = PERSONA_HEADERS.every((persona) => Math.abs(Number(opsView.shoreMixTable?.totals?.[persona.key] || 0) - 1) <= 0.001);
  const locationSplitOk = (opsView.locationBlendRows || []).every((row) => trimValue(row.status?.value) === "OK");
  const outcomeOk = trimValue(outcomeView.reconciliationMessage).toUpperCase().startsWith("RECONCILES");
  const recommendedRisk = (riskView.personaVerdicts || []).find((persona) => persona.key === recommendView.recommendedPersona?.key) || null;
  const towerInScope = isYesLike(currentDeal?.towerScope_FPA);

  const statusByRow = {
    26: placeholderClientName ? "REVIEW — placeholder client name" : "OK",
    27: !placeholderClientName && constructsMissing ? "RED — constructs missing" : "OK",
    28: Number(discoveryMetrics.proxyWeightedCompletenessPct || 0) >= 50 ? "OK" : "REVIEW — thin discovery inputs",
    29: weightsOk ? "OK" : "RED — fix weights",
    30: shoreMixOk ? "OK" : "RED — shore mix",
    31: locationSplitOk ? "OK" : "RED — location split",
    32: outcomeOk ? "OK" : "REVIEW — outcome allocation",
    33: Number(recommendedRisk?.redCount || 0) === 0 ? "OK" : "RED — recommended persona disqualified",
    34: Number(unloggedOverrideCount || 0) === 0 ? "OK" : "REVIEW — log overrides",
    35: Number(getCellNumber(workloadCellMap, "C58", 0)) === 0 ? "OK" : "REVIEW — A vs D variances",
    36: trimValue(rateCardView.confirmation?.value) === "Yes" ? "OK" : "REVIEW — rate card unconfirmed [MKT]",
    37: trimValue(calibrationVerdict).startsWith("RED") ? "RED — aggressive levers" : "OK",
    38: trimValue(dealRisksView.dealRiskVerdict) === "RED" ? "RED — deal risk" : "OK",
    39: towerInScope ? "OK" : "REVIEW — tower not in scope",
  };

  const checks = LOGIC_CHECK_DEFS.map((definition) => ({
    ...definition,
    status: statusByRow[definition.rowNumber] || "OK",
  }));

  const redCount = checks.filter((check) => trimValue(check.status).startsWith("RED")).length;
  const reviewCount = checks.filter((check) => trimValue(check.status).startsWith("REVIEW")).length;
  const uploadReadiness = redCount > 0
    ? `NOT READY — ${redCount} RED`
    : reviewCount > 0
      ? `READY WITH ${reviewCount} REVIEW ITEMS`
      : "READY";

  return {
    checks,
    redCount,
    reviewCount,
    uploadReadiness,
  };
}

export function buildFpaDashboardWorkbookView({
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
  const personaInputs = workbookInputs["FPA_07 Personas"] && typeof workbookInputs["FPA_07 Personas"] === "object"
    ? workbookInputs["FPA_07 Personas"]
    : EMPTY_INPUTS;
  const aiWorkbookInputs = workbookInputs["FPA_08 AI Benefit"] && typeof workbookInputs["FPA_08 AI Benefit"] === "object"
    ? workbookInputs["FPA_08 AI Benefit"]
    : EMPTY_INPUTS;
  const opsWorkbookInputs = workbookInputs["FPA_09 Ops Model"] && typeof workbookInputs["FPA_09 Ops Model"] === "object"
    ? workbookInputs["FPA_09 Ops Model"]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs["FPA_10 Rate Card"] && typeof workbookInputs["FPA_10 Rate Card"] === "object"
    ? workbookInputs["FPA_10 Rate Card"]
    : EMPTY_INPUTS;
  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const workloadView = buildFpaWorkloadWorkbookView(workloadInputs, benchmarkInputs, workspace, currentDeal);
  const workloadCellMap = toWorkbookCellMap(workloadView.rows);
  const traceLogView = buildFpaTraceLogWorkbookView({ currentDeal, workspace });
  const aiView = buildFpaAiBenefitWorkbookView({
    aiWorkbookInputs,
    benchmarkInputs,
    workloadInputs,
    personaInputs,
    workspace,
    currentDeal,
  });
  const fteView = buildFpaFteEngineWorkbookView({ currentDeal, workspace });
  const costView = buildFpaCostWorkbookView({ currentDeal, workspace });
  const pricingView = buildFpaPricingWorkbookView({ currentDeal, workspace });
  const businessCaseView = buildFpaBusinessCaseWorkbookView({ currentDeal, workspace });
  const recommendView = buildFpaRecommendWorkbookView({ currentDeal, workspace });
  const riskView = buildFpaRiskWorkbookView({ currentDeal, workspace });
  const sensitivityView = buildFpaSensitivityWorkbookView({
    currentDeal,
    workspace,
    inspectPersonaId: recommendView.recommendedPersona?.key || "standard",
  });
  const transitionView = buildFpaTransitionWorkbookView({ currentDeal, workspace });
  const clientValueView = buildFpaClientValueWorkbookView({ currentDeal, workspace });
  const opsView = buildFpaOpsModelWorkbookView({ opsWorkbookInputs, rateCardInputs });
  const dealRisksView = buildFpaDealRisksWorkbookView({ currentDeal, workspace });
  const outcomeView = buildFpaOutcomeWorkbookView({ currentDeal, workspace });
  const rateCardView = buildFpaRateCardWorkbookView({ workbookInputs: rateCardInputs });

  const recommendedPersona = recommendView.recommendedPersona || PERSONA_HEADERS[1] || PERSONA_HEADERS[0];
  const runnerUpPersona = recommendView.runnerUpPersona || recommendedPersona;
  const riskPersonaMap = Object.fromEntries((riskView.personaVerdicts || []).map((persona) => [persona.key, persona]));
  const aiPersonaMap = Object.fromEntries((aiView.personas || []).map((persona) => [normalizePersonaId(persona.id || persona.key), persona]));
  const businessCasePersonaMap = Object.fromEntries((businessCaseView.personaCards || []).map((persona) => [persona.key, persona.summary || EMPTY_INPUTS]));
  const pricingSummaryMap = buildPersonaMetricMaps(pricingView.summaryRows);
  const costSummaryMap = buildPersonaMetricMaps(costView.summaryRows);
  const recommendSummaryMap = buildPersonaMetricMaps(recommendView.summaryRows);
  const transitionCostMap = buildPersonaMetricMaps(transitionView.transitionCostRows);
  const transitionBuildMap = buildPersonaMetricMaps(transitionView.transformationRows);
  const fteSummaryMap = buildPersonaMetricMaps(fteView.summaryRows);
  const fteYearOneByPersona = Object.fromEntries((fteView.yearOneSummary || []).map((item) => [item.key, Number(item.value || 0)]));
  const scenarioMap = Object.fromEntries((sensitivityView.scenarioCaseRows || []).map((row) => [row.key, row]));

  const annualPriceByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(pricingSummaryMap, "recommendedAnnualPrice", persona.key, 0))]),
  );
  const costToServeByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(costSummaryMap, "costToServeY1", persona.key, 0))]),
  );
  const deliveryLaborByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(costSummaryMap, "deliveryLaborY1", persona.key, 0))]),
  );
  const businessCaseSummaryMap = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, businessCasePersonaMap[persona.key] || EMPTY_INPUTS]),
  );
  const recommendedPrice = annualPriceByPersona[recommendedPersona.key] || 0;
  const recommendedCostToServe = costToServeByPersona[recommendedPersona.key] || 0;
  const recommendedDeliveryLabor = deliveryLaborByPersona[recommendedPersona.key] || 0;
  const recommendedOtherCostToServe = round(recommendedCostToServe - recommendedDeliveryLabor, 12);
  const recommendedGrossMargin = round(recommendedPrice - recommendedCostToServe, 12);

  const calibrationSummary = buildCalibrationSummary(
    currentDeal,
    aiView,
    pricingView,
    riskView,
    transitionView,
    opsView,
    businessCaseView,
    clientValueView,
    workloadCellMap,
    discoveryMetrics,
    rateCardView,
  );

  const logicSummary = buildLogicChecks({
    currentDeal,
    discoveryMetrics,
    recommendView,
    riskView,
    rateCardView,
    opsView,
    workloadCellMap,
    calibrationVerdict: calibrationSummary.calibrationVerdictByPersona[recommendedPersona.key] || "GREEN — defendable",
    dealRisksView,
    outcomeView,
    unloggedOverrideCount: traceLogView.unloggedOverrideCount,
  });

  const revenueBand = discoveryMetrics.proxyRows?.find((row) => row.id === "revenueBand")?.effectiveValue || "—";
  const riskVerdict = riskPersonaMap[recommendedPersona.key]?.verdict || "GREEN";
  const clientBaselineY1 = Number(clientValueView.contextRows?.find((row) => row.key === "clientBaselineY1")?.value || 0);
  const painIndex = discoveryMetrics.painRows?.length
    ? round(discoveryMetrics.painRows.reduce((sum, row) => sum + Number(row.score || 0), 0) / (discoveryMetrics.painRows.length * 4), 12)
    : 0;

  const overviewFacts = [
    createMetricRow(4, "Tower", "FPA", "status"),
    createMetricRow(4, "Tower name", "Financial Planning & Analysis", "text"),
    createMetricRow(4, "In scope", isYesLike(currentDeal?.towerScope_FPA) ? "Yes" : "No", "status"),
    createMetricRow(6, "Sizing mode", discoveryMetrics.coverageMode, "status"),
    createMetricRow(6, "Complexity band", transitionView.complexityBand, "status"),
    createMetricRow(6, "Discovery coverage", Number(discoveryMetrics.coverageScorePct || 0) / 100, "percent1"),
    createMetricRow(6, "Input completeness", Number(discoveryMetrics.proxyWeightedCompletenessPct || 0) / 100, "percent1"),
  ];

  const personaComparisonRows = [
    createPersonaRow(14, "steadyStateFte", "Steady-state FTE", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(fteSummaryMap, "TOTAL FTE — steady", persona.key, 0))])), "fte2"),
    createPersonaRow(15, "costToServeY1", "Cost-to-Serve Y1", costToServeByPersona, "currency0"),
    createPersonaRow(16, "recommendedPrice", "Recommended price", annualPriceByPersona, "currency0"),
    createPersonaRow(17, "runRateGmPct", "GM % (run-rate)", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(pricingSummaryMap, "grossMarginPct", persona.key, 0))])), "percent1"),
    createPersonaRow(18, "npv", "NPV (term)", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(businessCaseSummaryMap[persona.key]?.npv || 0)])), "currency0"),
    createPersonaRow(19, "payback", "Payback", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(businessCaseSummaryMap[persona.key]?.payback || 0)])), "whole"),
    createPersonaRow(20, "tcv", "TCV", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(businessCaseSummaryMap[persona.key]?.tcv || 0)])), "currency0"),
    createPersonaRow(21, "avgGmPct", "Avg GM % (term)", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(businessCaseSummaryMap[persona.key]?.avgGmPct || 0)])), "percent1"),
    createPersonaRow(22, "riskVerdict", "Risk verdict", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, riskPersonaMap[persona.key]?.verdict || "GREEN"])), "status"),
    createPersonaRow(23, "redCount", "RED count", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(riskPersonaMap[persona.key]?.redCount || 0)])), "whole"),
  ];

  const assumptionRows = [
    createMetricRow(27, "Implied automation %", Number(aiPersonaMap[recommendedPersona.key]?.summary?.impliedAutomationPct || 0), "percent1"),
    createMetricRow(28, "Implied AI %", Number(aiPersonaMap[recommendedPersona.key]?.summary?.impliedAiPct || 0), "percent1"),
    createMetricRow(29, "Utilisation", readPersonaMetric(currentDeal, "utilisationPct", recommendedPersona.key), "percent1"),
    createMetricRow(30, "Shrinkage", readPersonaMetric(currentDeal, "shrinkagePct", recommendedPersona.key), "percent1"),
    createMetricRow(31, "Span of control", readPersonaMetric(currentDeal, "spanOfControl", recommendedPersona.key), "whole"),
    createMetricRow(32, "Markup on cost", readPersonaMetric(currentDeal, "markupOnCostPct", recommendedPersona.key), "percent1"),
    createMetricRow(33, "Committed productivity Y2", Number((businessCaseView.committedProductivityRows || []).find((row) => row.key === recommendedPersona.key)?.values?.[0]?.value || 0), "percent1"),
    createMetricRow(34, "Net reduction Y1", Number(aiPersonaMap[recommendedPersona.key]?.summary?.weightedNetReductionY1 || 0), "percent1"),
  ];

  const commercialTiles = [
    createMetricRow(38, "TCV (recommended)", Number(businessCaseSummaryMap[recommendedPersona.key]?.tcv || 0), "currency0"),
    createMetricRow(38, "ACV", Number(businessCaseSummaryMap[recommendedPersona.key]?.acv || 0), "currency0"),
    createMetricRow(38, "Client savings Y1 %", Number(clientValueView.yearRows?.[0]?.savingsPct || 0), "percent1"),
    createMetricRow(38, "Price per FTE", Number(getPersonaMetricValue(pricingSummaryMap, "blendedBillRatePerDeliveredFteY1", recommendedPersona.key, 0)), "currency0"),
    createMetricRow(38, "Reference band [PA]", "$60-120k / FTE blended, mix-dependent", "text"),
    createMetricRow(40, "Base GM %", Number(scenarioMap.base?.grossMarginScenarioPct || 0), "percent1"),
    createMetricRow(40, "Best GM %", Number(scenarioMap.best?.grossMarginScenarioPct || 0), "percent1"),
    createMetricRow(40, "Downside GM %", Number(scenarioMap.downside?.grossMarginScenarioPct || 0), "percent1"),
  ];

  const waterfallRows = [
    { rowNumber: 46, key: "revenue", label: "Revenue", base: 0, fall: 0, rise: recommendedPrice },
    { rowNumber: 47, key: "deliveryLabor", label: "Delivery labor", base: round(recommendedPrice - recommendedDeliveryLabor, 12), fall: recommendedDeliveryLabor, rise: 0 },
    { rowNumber: 48, key: "otherCostToServe", label: "Other cost-to-serve", base: recommendedGrossMargin, fall: recommendedOtherCostToServe, rise: 0 },
    { rowNumber: 49, key: "grossMargin", label: "Gross margin", base: 0, fall: 0, rise: recommendedGrossMargin },
  ].map((row) => ({
    ...row,
    baseText: formatDashboardValue(row.base, "currency0"),
    fallText: formatDashboardValue(row.fall, "currency0"),
    riseText: formatDashboardValue(row.rise, "currency0"),
  }));

  const matrixRows = [
    createPersonaRow(56, "floorPrice", "FLOOR price", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(pricingSummaryMap, "floorPrice", persona.key, 0))])), "currency0"),
    createPersonaRow(57, "targetPrice", "TARGET price", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(pricingSummaryMap, "targetPrice", persona.key, 0))])), "currency0"),
    createPersonaRow(58, "markupPrice", "MARKUP price", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(pricingSummaryMap, "markupPrice", persona.key, 0))])), "currency0"),
    createPersonaRow(59, "recommendedAnnualPrice", "RECOMMENDED ANNUAL price", annualPriceByPersona, "currency0"),
    createPersonaRow(60, "weightedFit", "Weighted fit", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(recommendSummaryMap, "weightedFit", persona.key, 0))])), "score1"),
    createPersonaRow(61, "adjustedScore", "ADJUSTED SCORE", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(recommendSummaryMap, "adjustedScore", persona.key, 0))])), "score1"),
    createPersonaRow(62, "rank", "Rank", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(recommendSummaryMap, "rank", persona.key, 0))])), "whole"),
    createPersonaRow(63, "defendableCount", "Defendable count", calibrationSummary.defendableCountByPersona, "whole"),
    createPersonaRow(64, "aggressiveFlags", "AGGRESSIVE flags", calibrationSummary.aggressiveCountByPersona, "whole"),
    createPersonaRow(65, "conservativeFlags", "Over-conservative flags", calibrationSummary.conservativeCountByPersona, "whole"),
    createPersonaRow(66, "benchmarkCorroboration", "Benchmark corroboration score", calibrationSummary.benchmarkCorroborationByPersona, "percent1"),
    createPersonaRow(67, "confidenceScore", "Confidence score", calibrationSummary.confidenceScoresByPersona, "percent1"),
    createPersonaRow(68, "amberCount", "AMBER count", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(riskPersonaMap[persona.key]?.amberCount || 0)])), "whole"),
    createPersonaRow(69, "calibrationVerdict", "Calibration verdict", calibrationSummary.calibrationVerdictByPersona, "status"),
    createPersonaRow(70, "totalFteY1", "Total FTE Y1", fteYearOneByPersona, "fte2"),
    createPersonaRow(71, "hoursRemoved", "Hours removed / month", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(aiPersonaMap[persona.key]?.summary?.hoursRemovedPerMonthSteady || 0)])), "whole"),
    createPersonaRow(72, "aiNetReductionSteady", "AI net reduction (steady)", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(aiPersonaMap[persona.key]?.summary?.weightedNetReductionSteady || 0)])), "percent1"),
    createPersonaRow(73, "transitionFee", "Transition fee", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(transitionCostMap, "transitionFee", persona.key, 0))])), "currency0"),
    createPersonaRow(74, "transformationBuild", "Transformation build", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(getPersonaMetricValue(transitionBuildMap, "transformationBuild", persona.key, 0))])), "currency0"),
    createPersonaRow(75, "cumulativeCash", "Cumulative net cash (term)", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(businessCaseSummaryMap[persona.key]?.cumulativeNetCashTerm || 0)])), "currency0"),
    createPersonaRow(76, "acv", "ACV", Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(businessCaseSummaryMap[persona.key]?.acv || 0)])), "currency0"),
  ];

  const readinessRows = [
    createMetricRow(80, "Method-A available", getCellText(workloadCellMap, "I11", "NO") || "NO", "status"),
    createMetricRow(81, "Method mix", getCellText(workloadCellMap, "C35", "0 A / 0 D / 0 E"), "text"),
    createMetricRow(82, "Reconciliation verdict", getCellText(workloadCellMap, "C60", "NOT APPLICABLE — no customer FTE shared"), "status"),
    createMetricRow(83, "Transferred hours (Method A)", getCellNumber(workloadCellMap, "C59", 0), "number1"),
    createMetricRow(84, "Tech stack class", discoveryMetrics.techLandscape, "status"),
    createMetricRow(85, "Data multiplier", Number(discoveryMetrics.techEffortMultiplier || 0), "factor2"),
    createMetricRow(86, "Data readiness", Number(discoveryMetrics.techReadinessScore || 0), "number1"),
    createMetricRow(87, "Agentic data gate", Number(discoveryMetrics.techModernizationGate || 0), "whole"),
    createMetricRow(88, "Upload readiness", logicSummary.uploadReadiness, "status"),
    createMetricRow(89, "Pain-point index", painIndex, "percent1"),
    createMetricRow(90, "Transformation urgency", discoveryMetrics.painMotion, "status"),
    createMetricRow(91, "Transition weeks", Number(transitionView.complexityAdjustedDurationWeeks || 0), "number1"),
    createMetricRow(92, "Deal-risk verdict", dealRisksView.dealRiskVerdict || "GREEN", "status"),
    createMetricRow(93, "In-scope hours / month", getCellNumber(workloadCellMap, "K26", 0), "whole"),
    createMetricRow(94, "Blind FTE (pre-AI)", getCellNumber(workloadCellMap, "C31", 0), "fte2"),
    createMetricRow(95, "Client baseline Y1", clientBaselineY1, "currency0"),
    createMetricRow(96, "Term savings % (client)", Number(clientValueView.termSavingsPct || 0), "percent1"),
    createMetricRow(97, "Effective automation ceiling", Number(aiView.gateDrivers?.effectiveCeiling || 0), "percent1"),
    createMetricRow(98, "Platform", discoveryMetrics.effectiveDiscovery?.epmPlatform || "—", "text"),
    createMetricRow(99, "Industry", discoveryMetrics.effectiveDiscovery?.industryVertical || "—", "text"),
    createMetricRow(100, "Revenue band", revenueBand, "text"),
  ];

  return {
    ...FPA_DASHBOARD_SNAPSHOT,
    personaHeaders: PERSONA_HEADERS,
    recommendedPersona,
    runnerUpPersona,
    contextLine: `${currentDeal?.clientName || "<Client Name>"}  |  ${currentDeal?.dealId || "PRE-2026-E2E-001"}  |  Term: ${currentDeal?.contractTerm || "5"} yrs  |  Construct: ${currentDeal?.pricingConstruct || "FTE-based"}  |  Tower: FP&A`,
    overviewFacts,
    recommendation: {
      rowNumber: 9,
      riskVerdict,
      rationaleRowNumber: 10,
      rationale: recommendView.recommendationRationale,
    },
    personaComparisonRows,
    assumptionRows,
    commercialTiles,
    waterfallRows,
    matrixRows,
    logicChecks: logicSummary.checks,
    uploadReadiness: {
      rowNumber: 40,
      value: logicSummary.uploadReadiness,
      redCount: logicSummary.redCount,
      reviewCount: logicSummary.reviewCount,
      text: logicSummary.uploadReadiness,
    },
    readinessRows,
  };
}





