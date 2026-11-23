import { buildP2pAiBenefitWorkbookView } from "./p2pAiBenefit";
import { buildP2pBusinessCaseWorkbookView } from "./p2pBusinessCase";
import { buildP2pClientValueWorkbookView } from "./p2pClientValue";
import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { buildP2pOpsModelWorkbookView } from "./p2pOpsModel";
import {
  P2P_PERSONA_LIBRARY_COLUMNS,
  P2P_PERSONA_LIBRARY_ROWS,
} from "./p2pPersonas";
import { buildP2pPricingWorkbookView } from "./p2pPricing";
import { buildP2pRecommendWorkbookView } from "./p2pRecommend";
import { buildP2pTransitionWorkbookView } from "./p2pTransition";
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
const DECIMAL_THREE_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const CURRENCY_ZERO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const PERSONA_HEADERS = Object.freeze(
  P2P_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
  })),
);

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(P2P_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

const CALIBRATION_LEVER_DEFS = Object.freeze([
  { key: "utilisationPct", rowNumber: 6, classificationRowNumber: 21, label: "Utilisation %", low: 0.75, high: 0.92, mode: "normal" },
  { key: "shrinkagePct", rowNumber: 7, classificationRowNumber: 22, label: "Shrinkage %", low: 0.06, high: 0.16, mode: "inverse" },
  { key: "managementBufferPct", rowNumber: 8, classificationRowNumber: 23, label: "Management Buffer %", low: 0.03, high: 0.15, mode: "inverse" },
  { key: "backupCrossSkillingPct", rowNumber: 9, classificationRowNumber: 24, label: "Backup / cross-skilling %", low: 0.03, high: 0.12, mode: "inverse" },
  { key: "peakUpliftPct", rowNumber: 10, classificationRowNumber: 25, label: "Peak uplift %", low: 0.08, high: 0.3, mode: "inverse" },
  { key: "spanOfControl", rowNumber: 11, classificationRowNumber: 26, label: "Span of control", low: 6, high: 12, mode: "normal" },
  { key: "ambitionScalar", rowNumber: 12, classificationRowNumber: 27, label: "Ambition scalar", low: 0.3, high: 1, mode: "normal" },
  { key: "productivityGlideY2Pct", rowNumber: 13, classificationRowNumber: 28, label: "Productivity glide Y2 %", low: 0.02, high: 0.1, mode: "normal" },
  { key: "targetGrossMarginPct", rowNumber: 14, classificationRowNumber: 29, label: "Target gross margin %", low: 0.15, high: 0.32, mode: "inverse" },
  { key: "markupOnCostPct", rowNumber: 15, classificationRowNumber: 30, label: "Markup on cost %", low: 0.18, high: 0.55, mode: "inverse" },
  { key: "contingencyPct", rowNumber: 16, classificationRowNumber: 31, label: "Contingency % on cost", low: 0.02, high: 0.06, mode: "inverse" },
  { key: "year1LearningCurvePct", rowNumber: 17, classificationRowNumber: 32, label: "Year-1 learning curve %", low: 0.03, high: 0.15, mode: "inverse" },
]);

const CORROBORATION_CHECK_DEFS = Object.freeze([
  { key: "outsourcedShare", rowNumber: 42, label: "Transferred share of client P2P org 15-75%", band: "15-75%" },
  { key: "pricePerFte", rowNumber: 43, label: "Price per delivered FTE $45-130k", band: "$45-130k" },
  { key: "grossMargin", rowNumber: 44, label: "Run-rate GM within 15-35%", band: "15-35%" },
  { key: "offshoreMix", rowNumber: 45, label: "Offshore mix 30-85%", band: "30-85%" },
  { key: "automation", rowNumber: 46, label: "Implied automation within ceiling", band: "<= ceiling" },
  { key: "transitionWeeks", rowNumber: 47, label: "Transition duration 8-24 weeks", band: "8-24 wks" },
  { key: "clientSavingsY1", rowNumber: 48, label: "Client savings Y1 within 5-35%", band: "5-35%" },
  { key: "blindFteBand", rowNumber: 49, label: "Blind FTE vs industry FTE/$1B scoped band (P25-P75)", band: "P25-P75" },
]);

const REGISTER_ROW_DEFS = Object.freeze([
  { rowNumber: 57, closureRowNumber: 13, item: "Rate card (salary, load, seat, inflation, attrition)", tab: "10", tag: "[MKT]", defaultStatus: "Open", defaultOwner: "Deal desk", defaultTargetDate: 46288, defaultEvidenceIds: "0" },
  { rowNumber: 58, closureRowNumber: 14, item: "Volume baseline (PO, invoice, vendor, T&E drivers)", tab: "02/04", tag: "[CC]", defaultStatus: "Open", defaultOwner: "Tower SME", defaultTargetDate: 46292, defaultEvidenceIds: "0" },
  { rowNumber: 59, closureRowNumber: 15, item: "Driver handling-time norms", tab: "04", tag: "[PA]", defaultStatus: "Open", defaultOwner: "Delivery excellence", defaultTargetDate: 46292, defaultEvidenceIds: "0" },
  { rowNumber: 60, closureRowNumber: 16, item: "Addressability matrix", tab: "08", tag: "[PA]", defaultStatus: "Evidence attached", defaultOwner: "Automation CoE", defaultTargetDate: 46292, defaultEvidenceIds: "EV-12;EV-13" },
  { rowNumber: 61, closureRowNumber: 17, item: "Technology multipliers and readiness", tab: "04", tag: "[PA]", defaultStatus: "Open", defaultOwner: "Enterprise architecture", defaultTargetDate: 46295, defaultEvidenceIds: "0" },
  { rowNumber: 62, closureRowNumber: 18, item: "Shore mix and location blend", tab: "09", tag: "[PA]", defaultStatus: "Open", defaultOwner: "Global delivery", defaultTargetDate: 46295, defaultEvidenceIds: "0" },
  { rowNumber: 63, closureRowNumber: 19, item: "Transition duration and build split", tab: "15", tag: "[PA]", defaultStatus: "Open", defaultOwner: "Transition lead", defaultTargetDate: 46298, defaultEvidenceIds: "0" },
  { rowNumber: 64, closureRowNumber: 20, item: "GM floor, target margin, and markup corridor", tab: "13", tag: "[PA]", defaultStatus: "Open", defaultOwner: "Commercial lead", defaultTargetDate: 46298, defaultEvidenceIds: "0" },
  { rowNumber: 65, closureRowNumber: 21, item: "Client baseline cost and transferred share", tab: "21", tag: "[CC]", defaultStatus: "Evidence attached", defaultOwner: "Client finance", defaultTargetDate: 46302, defaultEvidenceIds: "EV-21" },
  { rowNumber: 66, closureRowNumber: 22, item: "Business-case benefits and year-1 savings", tab: "16/21", tag: "[PA]", defaultStatus: "Open", defaultOwner: "Solution architect", defaultTargetDate: 46302, defaultEvidenceIds: "0" },
  { rowNumber: 67, closureRowNumber: 23, item: "Scope exclusions, retained org, and governance", tab: "03/24", tag: "[CC]", defaultStatus: "Open", defaultOwner: "Tower lead", defaultTargetDate: 46305, defaultEvidenceIds: "0" },
  { rowNumber: 68, closureRowNumber: 24, item: "Submission sign-off and pricing lock", tab: "24", tag: "[CC]", defaultStatus: "Open", defaultOwner: "Pursuit lead", defaultTargetDate: 46305, defaultEvidenceIds: "0" },
]);

export const P2P_CALIBRATION_SNAPSHOT = Object.freeze({
  sheetName: "P2P_26 Calibration",
  title: "26. Calibration - P2P lever defendability, benchmark corroboration & calibration register",
  note: "Each persona lever is classified Defendable / AGGRESSIVE / Over-conservative against the defendable range; 8 corroboration checks test the outputs against external sanity bands.",
  formulaCount: 0,
  leverCount: CALIBRATION_LEVER_DEFS.length,
  corroborationCheckCount: CORROBORATION_CHECK_DEFS.length,
  registerItemCount: REGISTER_ROW_DEFS.length,
});

function trimValue(value) {
  return String(value ?? "").trim();
}

function round(value, digits = 12) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "");

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

function trimTrailingZeros(value) {
  return String(value)
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "");
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

function readPersonaMetric(currentDeal, metricKey, personaKey) {
  const persona = PERSONA_HEADERS.find((item) => item.key === normalizePersonaId(personaKey)) || PERSONA_HEADERS[1] || PERSONA_HEADERS[0];
  const definition = PERSONA_ROW_MAP[metricKey];
  const workbookInputs = currentDeal?.p2pWorkbookInputs?.["P2P_07 Personas"]
    && typeof currentDeal.p2pWorkbookInputs["P2P_07 Personas"] === "object"
    ? currentDeal.p2pWorkbookInputs["P2P_07 Personas"]
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

function excelSerialToDateText(value) {
  const numeric = parseNumericText(value, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return trimValue(value) || "-";
  }

  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + (Math.round(numeric) * 86400000));
  return DATE_FORMATTER.format(date);
}

export function formatP2pCalibrationValue(value, format = "text") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (["text", "status", "band"].includes(format)) {
    return String(value);
  }

  if (format === "date") {
    return excelSerialToDateText(value);
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
    case "decimal3":
      return DECIMAL_THREE_FORMATTER.format(numeric);
    case "decimal2":
      return trimTrailingZeros(numeric.toFixed(2));
    case "whole":
      return INTEGER_FORMATTER.format(Math.round(numeric));
    default:
      return DECIMAL_TWO_FORMATTER.format(numeric);
  }
}

function createPersonaCells(valuesByPersona, format) {
  return PERSONA_HEADERS.map((persona) => ({
    key: persona.key,
    label: persona.label,
    value: valuesByPersona[persona.key],
    text: formatP2pCalibrationValue(valuesByPersona[persona.key], format),
  }));
}

function createStatusCells(valuesByPersona) {
  return PERSONA_HEADERS.map((persona) => ({
    key: persona.key,
    label: persona.label,
    value: valuesByPersona[persona.key],
    text: trimValue(valuesByPersona[persona.key]),
  }));
}

function buildRegisterRows(registerInputs) {
  return REGISTER_ROW_DEFS.map((definition) => {
    const rowNumber = definition.closureRowNumber;
    const status = trimValue(registerInputs[`F${rowNumber}`]) || definition.defaultStatus;
    const evidenceIds = trimValue(registerInputs[`G${rowNumber}`]) || definition.defaultEvidenceIds;
    const owner = trimValue(registerInputs[`H${rowNumber}`]) || definition.defaultOwner;
    const targetDateRaw = Object.prototype.hasOwnProperty.call(registerInputs, `I${rowNumber}`)
      ? registerInputs[`I${rowNumber}`]
      : definition.defaultTargetDate;

    return {
      rowNumber: definition.rowNumber,
      closureRowNumber: rowNumber,
      item: definition.item,
      tab: definition.tab,
      tag: definition.tag,
      status,
      owner,
      targetDateRaw,
      targetDateText: formatP2pCalibrationValue(targetDateRaw, "date"),
      evidenceIds,
    };
  });
}

function findSummaryRowValue(summaryRows = [], key, fallback = 0) {
  const row = (summaryRows || []).find((item) => item.key === key);
  return row ? Number(row.value || 0) : fallback;
}

export function buildP2pCalibrationWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : EMPTY_INPUTS;
  const e2eCalibrationClosureInputs = workbookInputs["E2E Calibration Closure"] && typeof workbookInputs["E2E Calibration Closure"] === "object"
    ? workbookInputs["E2E Calibration Closure"]
    : EMPTY_INPUTS;

  const aiWorkbookInputs = workbookInputs["P2P_08 AI Benefit"] && typeof workbookInputs["P2P_08 AI Benefit"] === "object"
    ? workbookInputs["P2P_08 AI Benefit"]
    : EMPTY_INPUTS;
  const benchmarkInputs = workbookInputs["P2P_04 Benchmarks"] && typeof workbookInputs["P2P_04 Benchmarks"] === "object"
    ? workbookInputs["P2P_04 Benchmarks"]
    : EMPTY_INPUTS;
  const workloadInputs = workbookInputs["P2P_05 Workload"] && typeof workbookInputs["P2P_05 Workload"] === "object"
    ? workbookInputs["P2P_05 Workload"]
    : EMPTY_INPUTS;
  const personaInputs = workbookInputs["P2P_07 Personas"] && typeof workbookInputs["P2P_07 Personas"] === "object"
    ? workbookInputs["P2P_07 Personas"]
    : EMPTY_INPUTS;
  const opsInputs = workbookInputs["P2P_09 Ops Model"] && typeof workbookInputs["P2P_09 Ops Model"] === "object"
    ? workbookInputs["P2P_09 Ops Model"]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs["P2P_10 Rate Card"] && typeof workbookInputs["P2P_10 Rate Card"] === "object"
    ? workbookInputs["P2P_10 Rate Card"]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const workloadView = buildP2pWorkloadModel(workspace, currentDeal);
  const aiView = buildP2pAiBenefitWorkbookView({ aiWorkbookInputs, benchmarkInputs, workloadInputs, personaInputs, workspace, currentDeal });
  const pricingView = buildP2pPricingWorkbookView({ currentDeal, workspace });
  const opsView = buildP2pOpsModelWorkbookView({ opsWorkbookInputs: opsInputs, rateCardInputs });
  const transitionView = buildP2pTransitionWorkbookView({ currentDeal, workspace });
  const businessCaseView = buildP2pBusinessCaseWorkbookView({ currentDeal, workspace });
  const clientValueView = buildP2pClientValueWorkbookView({ currentDeal, workspace });
  const recommendView = buildP2pRecommendWorkbookView({ currentDeal, workspace });

  const pricingSummaryMap = buildPersonaMetricMaps(pricingView.summaryRows);
  const aiPersonaMap = Object.fromEntries(
    (aiView.personas || []).map((persona) => [normalizePersonaId(persona.id || persona.key), persona]),
  );

  const leverRows = CALIBRATION_LEVER_DEFS.map((definition) => {
    const format = PERSONA_ROW_MAP[definition.key]?.format === "integer"
      ? "whole"
      : PERSONA_ROW_MAP[definition.key]?.format || "decimal2";
    const valuesByPersona = Object.fromEntries(
      PERSONA_HEADERS.map((persona) => [persona.key, Number(readPersonaMetric(currentDeal, definition.key, persona.key) || 0)]),
    );

    return {
      ...definition,
      format,
      values: createPersonaCells(valuesByPersona, format),
      rangeLowText: formatP2pCalibrationValue(definition.low, format),
      rangeHighText: formatP2pCalibrationValue(definition.high, format),
    };
  });

  const classificationRows = leverRows.map((row) => {
    const valuesByPersona = Object.fromEntries(
      PERSONA_HEADERS.map((persona) => {
        const leverValue = row.values.find((cell) => cell.key === persona.key)?.value;
        return [persona.key, evaluateCalibrationLever(leverValue, row.low, row.high, row.mode)];
      }),
    );

    return {
      key: row.key,
      rowNumber: row.classificationRowNumber,
      label: row.label,
      values: createStatusCells(valuesByPersona),
    };
  });

  const defendableCountByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, classificationRows.filter((row) => row.values.find((cell) => cell.key === persona.key)?.value === "Defendable").length]),
  );
  const aggressiveCountByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, classificationRows.filter((row) => row.values.find((cell) => cell.key === persona.key)?.value === "AGGRESSIVE").length]),
  );
  const conservativeCountByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => [persona.key, classificationRows.filter((row) => row.values.find((cell) => cell.key === persona.key)?.value === "Over-conservative").length]),
  );
  const calibrationVerdictByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => {
      const aggressiveFlags = aggressiveCountByPersona[persona.key] || 0;
      const verdict = aggressiveFlags >= 3
        ? "RED - re-base aggressive levers"
        : aggressiveFlags > 0
          ? "AMBER - justify aggressive levers"
          : "GREEN - defendable";
      return [persona.key, verdict];
    }),
  );

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
  const effectiveCeiling = Number(aiView.gateDrivers?.effectiveCeiling || 0);
  const annualRevenueUsdB = Number(discoveryMetrics.effectiveDiscovery?.annualRevenueUsdB || 0);
  const outsourcedShare = Number(workloadView.impliedShare || 0);
  const blindFte = Number(workloadView.blindFte || 0);
  const transitionWeeks = Number(transitionView.complexityAdjustedDurationWeeks || transitionView.transitionDurationWeeks || 0);
  const benchmarkFtePerRevenueB = Number(workloadView.benchmarkModel?.currentClientFtePerRevenueB || 0);
  const scopedShare = Number.isFinite(workloadView.impliedShare) && Number(workloadView.impliedShare) > 0
    ? Number(workloadView.impliedShare)
    : 1;
  const expectedBlindFte = annualRevenueUsdB > 0 && benchmarkFtePerRevenueB > 0
    ? round(annualRevenueUsdB * benchmarkFtePerRevenueB * scopedShare, 12)
    : 0;
  const lowerBlindBand = expectedBlindFte > 0 ? expectedBlindFte * 0.75 : 0;
  const upperBlindBand = expectedBlindFte > 0 ? expectedBlindFte * 1.35 : 0;
  const clientBaselineY1 = findSummaryRowValue(clientValueView.summaryRows, "clientBaselineY1", 0);
  const annualChargeY1ByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => {
      const row = (businessCaseView.annualChargeRows || []).find((item) => item.key === persona.key);
      return [persona.key, Number(row?.values?.[0]?.value || 0)];
    }),
  );

  const corroborationStatuses = {
    outsourcedShare: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, outsourcedShare >= 0.15 && outsourcedShare <= 0.75 ? "GREEN" : "AMBER"])),
    pricePerFte: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, pricePerFteByPersona[persona.key] >= 45000 && pricePerFteByPersona[persona.key] <= 130000 ? "GREEN" : "AMBER"])),
    grossMargin: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, gmPctByPersona[persona.key] >= 0.15 && gmPctByPersona[persona.key] <= 0.35 ? "GREEN" : "AMBER"])),
    offshoreMix: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, offshoreMixByPersona[persona.key] >= 0.3 && offshoreMixByPersona[persona.key] <= 0.85 ? "GREEN" : "AMBER"])),
    automation: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, Number(aiPersonaMap[persona.key]?.summary?.impliedAutomationPct || 0) <= effectiveCeiling ? "GREEN" : "AMBER"])),
    transitionWeeks: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, transitionWeeks >= 8 && transitionWeeks <= 24 ? "GREEN" : "AMBER"])),
    clientSavingsY1: Object.fromEntries(PERSONA_HEADERS.map((persona) => {
      const annualChargeY1 = annualChargeY1ByPersona[persona.key] || 0;
      const savingsPct = clientBaselineY1 > 0 ? (clientBaselineY1 - annualChargeY1) / clientBaselineY1 : 0;
      return [persona.key, savingsPct >= 0.05 && savingsPct <= 0.35 ? "GREEN" : "AMBER"];
    })),
    blindFteBand: Object.fromEntries(PERSONA_HEADERS.map((persona) => [persona.key, expectedBlindFte > 0 && blindFte >= lowerBlindBand && blindFte <= upperBlindBand ? "GREEN" : "AMBER"])),
  };

  const corroborationRows = CORROBORATION_CHECK_DEFS.map((definition) => ({
    ...definition,
    values: createStatusCells(corroborationStatuses[definition.key] || {}),
  }));

  const benchmarkCorroborationByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => {
      const greenCount = corroborationRows.filter((row) => row.values.find((cell) => cell.key === persona.key)?.value === "GREEN").length;
      return [persona.key, round(greenCount / CORROBORATION_CHECK_DEFS.length, 12)];
    }),
  );
  const corroborationBandByPersona = Object.fromEntries(
    PERSONA_HEADERS.map((persona) => {
      const score = benchmarkCorroborationByPersona[persona.key] || 0;
      const band = score >= 0.75 ? "STRONG" : score >= 0.5 ? "MODERATE" : "WEAK";
      return [persona.key, band];
    }),
  );

  const registerRows = buildRegisterRows(e2eCalibrationClosureInputs);
  const registerConfirmedCount = registerRows.filter((row) => ["CONFIRMED", "LOCKED"].includes(row.status.toUpperCase())).length;
  const registerEvidenceAttachedCount = registerRows.filter((row) => row.status.toUpperCase() === "EVIDENCE ATTACHED").length;
  const registerOpenCount = registerRows.filter((row) => row.status.toUpperCase() === "OPEN").length;
  const registerSummaryText = `${registerConfirmedCount} / ${REGISTER_ROW_DEFS.length} confirmed - ${registerEvidenceAttachedCount} evidence attached`;
  const registerSourceMode = Object.keys(e2eCalibrationClosureInputs).length > 0 ? "Linked E2E register" : "Workbook default snapshot";

  const recommendedPersona = recommendView.recommendedPersona
    ? PERSONA_HEADERS.find((persona) => persona.key === recommendView.recommendedPersona.key)
    : PERSONA_HEADERS.find((persona) => persona.key === "standard") || PERSONA_HEADERS[0];
  const recommendedKey = recommendedPersona?.key || "standard";
  const recommendedSummary = {
    key: recommendedKey,
    label: recommendedPersona?.label || "Standard",
    index: recommendedPersona?.index || 2,
    defendableCount: defendableCountByPersona[recommendedKey] || 0,
    aggressiveCount: aggressiveCountByPersona[recommendedKey] || 0,
    conservativeCount: conservativeCountByPersona[recommendedKey] || 0,
    verdict: calibrationVerdictByPersona[recommendedKey] || "GREEN - defendable",
    corroborationScore: benchmarkCorroborationByPersona[recommendedKey] || 0,
    corroborationScoreText: formatP2pCalibrationValue(benchmarkCorroborationByPersona[recommendedKey] || 0, "percent1"),
    corroborationBand: corroborationBandByPersona[recommendedKey] || "WEAK",
  };

  return {
    ...P2P_CALIBRATION_SNAPSHOT,
    personaHeaders: PERSONA_HEADERS,
    leverRows,
    classificationRows,
    defendableCountRow: {
      rowNumber: 34,
      label: "Defendable count",
      values: createPersonaCells(defendableCountByPersona, "whole"),
    },
    aggressiveCountRow: {
      rowNumber: 35,
      label: "AGGRESSIVE flags",
      values: createPersonaCells(aggressiveCountByPersona, "whole"),
    },
    conservativeCountRow: {
      rowNumber: 36,
      label: "Over-conservative flags",
      values: createPersonaCells(conservativeCountByPersona, "whole"),
    },
    verdictRow: {
      rowNumber: 37,
      label: "Calibration verdict",
      values: createStatusCells(calibrationVerdictByPersona),
    },
    corroborationRows,
    corroborationScoreRow: {
      rowNumber: 51,
      label: "Benchmark corroboration score",
      values: createPersonaCells(benchmarkCorroborationByPersona, "percent1"),
    },
    corroborationBandRow: {
      rowNumber: 52,
      label: "Corroboration band",
      values: createStatusCells(corroborationBandByPersona),
    },
    registerRows,
    registerConfirmedCount,
    registerEvidenceAttachedCount,
    registerOpenCount,
    registerSummaryText,
    registerSourceMode,
    recommendedSummary,
  };
}
