import { buildFpaCostWorkbookView } from "./fpaCost";
import { buildFpaFteEngineWorkbookView } from "./fpaFteEngine";
import { buildFpaOpsModelWorkbookView } from "./fpaOpsModel";
import { buildExactWorkbookScplView, isWorkbookExactScplLayout } from "./fpaScplWorkbookExact";
import {
  FPA_PERSONA_LIBRARY_COLUMNS,
  FPA_PERSONA_LIBRARY_ROWS,
} from "./fpaPersonas";
import { buildFpaPricingWorkbookView } from "./fpaPricing";
import { buildFpaRateCardWorkbookView } from "./fpaRateCard";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";

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
const INR_ZERO_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const FPA_SCPL_AUTO_PERSONA = "__AUTO__";
export const SCPL_CONFIRM_OPTIONS = Object.freeze(["Yes", "No"]);
export const FPA_SCPL_SNAPSHOT = Object.freeze({
  sheetName: "FPA_30 SCPL",
  title: "30. SCPL - Sizing · Composition · Pricing · Location - FP&A (HCL India offshore delivery view)",
  note: "Parallel commercial view on the HCL standard rate card. FTE flows in from 11 FTE Engine; band mix and delivery-center split are inputs; cost, bill rate and year view are outputs.",
  formulaCount: 300,
  editableCellCount: 20,
  yearCount: 7,
  bandCount: 8,
  centerCount: 3,
});

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

const PERSONA_LABEL_TO_KEY = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_COLUMNS.map((persona) => [persona.label, persona.key])),
);

const PERSONA_KEY_TO_LABEL = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_COLUMNS.map((persona) => [persona.key, persona.label])),
);

const YEAR_HEADERS = Object.freeze([
  { key: "y1", label: "Y1", yearNumber: 1 },
  { key: "y2", label: "Y2", yearNumber: 2 },
  { key: "y3", label: "Y3", yearNumber: 3 },
  { key: "y4", label: "Y4", yearNumber: 4 },
  { key: "y5", label: "Y5", yearNumber: 5 },
  { key: "y6", label: "Y6", yearNumber: 6 },
  { key: "y7", label: "Y7", yearNumber: 7 },
]);

const SCPL_BAND_DEFINITIONS = Object.freeze([
  {
    id: "associate",
    rowNumber: 21,
    bandCode: "E0.1",
    label: "Associate",
    seedNote: (tiltLabel) => `${tiltLabel} tilt · Associate Analyst (50%)`,
  },
  {
    id: "srAssociate",
    rowNumber: 22,
    bandCode: "E0.2",
    label: "Sr Associate",
    seedNote: (tiltLabel) => `${tiltLabel} tilt · Associate Analyst (50%)`,
  },
  {
    id: "analyst",
    rowNumber: 23,
    bandCode: "E0.3",
    label: "Analyst",
    seedNote: (tiltLabel) => `${tiltLabel} tilt · Analyst`,
  },
  {
    id: "leadAnalyst",
    rowNumber: 24,
    bandCode: "E1",
    label: "Lead Analyst",
    seedNote: (tiltLabel) => `${tiltLabel} tilt · Senior Analyst`,
  },
  {
    id: "assistantManager",
    rowNumber: 25,
    bandCode: "E2",
    label: "Assistant Manager/Deputy Manager",
    seedNote: (tiltLabel) => `${tiltLabel} tilt · Manager (60% - team-lead layer)`,
  },
  {
    id: "manager",
    rowNumber: 26,
    bandCode: "E3",
    label: "Manager/Senior Manager",
    seedNote: (tiltLabel) => `${tiltLabel} tilt · Manager (40%)`,
  },
  {
    id: "groupManager",
    rowNumber: 27,
    bandCode: "E4",
    label: "Group Manager/ Assistant Manager",
    seedNote: (tiltLabel) => `${tiltLabel} tilt · Senior Manager - engagement leadership, usually shared across towers`,
  },
  {
    id: "deputyGeneralManager",
    rowNumber: 28,
    bandCode: "E5",
    label: "Deputy General Manager/ General Manager",
    seedNote: (tiltLabel) => `${tiltLabel} tilt · Director - engagement leadership, usually shared across towers`,
  },
]);

const SCPL_CENTER_DEFINITIONS = Object.freeze([
  {
    id: "noida",
    rowNumber: 56,
    name: "HCL Noida (base)",
    region: "NCR (North)",
    defaultAllocationPct: 1,
    defaultFactor: 1,
    baseStatus: "Base - rate card as supplied",
  },
  {
    id: "chennai",
    rowNumber: 57,
    name: "HCL Chennai",
    region: "Tamil Nadu (South)",
    defaultAllocationPct: 0,
    defaultFactor: 1,
  },
  {
    id: "hyderabad",
    rowNumber: 58,
    name: "HCL Hyderabad",
    region: "Telangana (South)",
    defaultAllocationPct: 0,
    defaultFactor: 1,
  },
]);

const SCPL_TILT_SEEDS = Object.freeze({
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
    .replace(/₹/g, "")
    .replace(/x$/i, "");

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

function parseContractTermYears(value) {
  const numeric = parseNumericText(value, Number.NaN);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 7;
  }

  return Math.max(1, Math.min(7, Math.round(numeric)));
}

function readWorkbookChoiceInput(workbookInputs, address, options, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const normalized = trimValue(workbookInputs[address]);
  return options.includes(normalized) ? normalized : fallback;
}

function readWorkbookPercentInput(workbookInputs, address, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.abs(numeric) > 1 ? numeric / 100 : numeric;
}

function readWorkbookWholeNumberInput(workbookInputs, address, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
}

function readWorkbookDecimalInput(workbookInputs, address, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readPersonaMetric(personaInputs, persona, rowKey) {
  const row = PERSONA_ROW_MAP[rowKey];
  if (!row) {
    return 0;
  }

  const address = `${persona.workbookColumn}${row.workbookRow}`;
  if (!Object.prototype.hasOwnProperty.call(personaInputs, address)) {
    return row.values[persona.key];
  }

  const numeric = parseNumericText(personaInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? numeric : row.values[persona.key];
}

function buildPersonaModels(personaInputs) {
  return FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
    targetGrossMarginPct: readPersonaMetric(personaInputs, persona, "targetGrossMarginPct"),
    spanOfControl: readPersonaMetric(personaInputs, persona, "spanOfControl"),
  }));
}

function getSelectedYearTotals(fteView, selectedPersona) {
  const totalRow = Array.isArray(fteView?.yearRows)
    ? fteView.yearRows.find((row) => row?.label === `${selectedPersona.label} - TOTAL` || row?.label === `${selectedPersona.label} — TOTAL`)
    : null;

  return YEAR_HEADERS.map((_, index) => Number(totalRow?.values?.[index]?.value || 0));
}

function buildDefaultBandMixByTilt(tiltLabel) {
  const tiltSeed = SCPL_TILT_SEEDS[tiltLabel] || SCPL_TILT_SEEDS.Standard;

  return {
    associate: round(tiltSeed.associateAnalyst * 0.5, 12),
    srAssociate: round(tiltSeed.associateAnalyst * 0.5, 12),
    analyst: tiltSeed.analyst,
    leadAnalyst: tiltSeed.seniorAnalyst,
    assistantManager: round(tiltSeed.manager * 0.6, 12),
    manager: round(tiltSeed.manager * 0.4, 12),
    groupManager: tiltSeed.seniorManager,
    deputyGeneralManager: tiltSeed.director,
  };
}

function getOpsOffshoreBlendedCost(opsView, personaKey) {
  const row = Array.isArray(opsView?.personaLayerCostRows)
    ? opsView.personaLayerCostRows.find((item) => item?.id === "offshoreBlendedCost")
    : null;
  return Number(row?.values?.[personaKey] || 0);
}

function getOpsOffshoreSeatCost(opsView) {
  const seatGroup = Array.isArray(opsView?.layerFactorGroups)
    ? opsView.layerFactorGroups.find((group) => group?.id === "seat")
    : null;
  const row = Array.isArray(seatGroup?.rows)
    ? seatGroup.rows.find((item) => item?.layerId === "offshore")
    : null;
  return Number(row?.value || 0);
}

export function formatScplValue(value, format = "whole") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (format === "status" || format === "text") {
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
    case "currencyInr0":
      return INR_ZERO_FORMATTER.format(Math.round(numeric));
    case "percent0":
      return `${Math.round(numeric * 100)}%`;
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    case "pp1": {
      const sign = numeric > 0 ? "+" : "";
      return `${sign}${(numeric * 100).toFixed(1)} pp`;
    }
    case "fte2":
    case "number2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "whole":
    default:
      return INTEGER_FORMATTER.format(Math.round(numeric));
  }
}

export function formatScplInputValue(kind, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (kind === "choice" || kind === "persona") {
    return String(value);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  if (kind === "percent") {
    return `${(numeric * 100).toFixed(1)}%`;
  }

  if (kind === "whole") {
    return String(Math.round(numeric));
  }

  return String(numeric);
}

export function normalizeScplInputValue(kind, value) {
  const trimmed = trimValue(value);

  if (kind === "persona") {
    if (!trimmed || trimmed === FPA_SCPL_AUTO_PERSONA) {
      return "";
    }

    return Object.prototype.hasOwnProperty.call(PERSONA_LABEL_TO_KEY, trimmed) ? trimmed : null;
  }

  if (kind === "choice") {
    return SCPL_CONFIRM_OPTIONS.includes(trimmed) ? trimmed : null;
  }

  if (!trimmed) {
    return "";
  }

  const numeric = parseNumericText(trimmed, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (kind === "percent") {
    return String(Math.abs(numeric) > 1 ? numeric / 100 : numeric);
  }

  if (kind === "whole") {
    return String(Math.max(0, Math.round(numeric)));
  }

  return String(numeric);
}

function statusToneFromValue(value) {
  const normalized = trimValue(value).toUpperCase();

  if (normalized === "OK" || normalized.startsWith("GREEN")) {
    return "success";
  }

  if (normalized.startsWith("AMBER") || normalized === "N/A") {
    return "warning";
  }

  if (normalized.startsWith("FIX") || normalized.startsWith("RED")) {
    return "danger";
  }

  return "neutral";
}

export function buildFpaScplWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeFpaWorkspace(workspaceValue || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const workbookInputs = currentDeal?.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
    ? currentDeal.fpaWorkbookInputs
    : EMPTY_INPUTS;
  const scplInputs = workbookInputs[FPA_SCPL_SNAPSHOT.sheetName] && typeof workbookInputs[FPA_SCPL_SNAPSHOT.sheetName] === "object"
    ? workbookInputs[FPA_SCPL_SNAPSHOT.sheetName]
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
  const dealSetupInputs = workbookInputs["FPA_01 Deal Setup"] && typeof workbookInputs["FPA_01 Deal Setup"] === "object"
    ? workbookInputs["FPA_01 Deal Setup"]
    : EMPTY_INPUTS;

  if (isWorkbookExactScplLayout(scplInputs)) {
    return {
      ...FPA_SCPL_SNAPSHOT,
      ...buildExactWorkbookScplView({
        currentDeal,
        workbookInputs,
        scplInputs,
      }),
    };
  }

  const personas = buildPersonaModels(personaInputs);
  const recommendedPersonaId = normalizePersonaId(workspace?.opsModel?.selectedPersonaId || "standard");
  const recommendedPersona = personas.find((persona) => persona.key === recommendedPersonaId) || personas[1] || personas[0];

  const personaOverrideLabel = trimValue(scplInputs.C6);
  const personaOverrideKey = PERSONA_LABEL_TO_KEY[personaOverrideLabel] || normalizePersonaId(personaOverrideLabel);
  const selectedPersona = personas.find((persona) => persona.key === (personaOverrideLabel ? personaOverrideKey : recommendedPersonaId)) || recommendedPersona;
  const isAutoPersona = !personaOverrideLabel;

  const fteView = buildFpaFteEngineWorkbookView({ currentDeal, workspace, inspectPersonaId: selectedPersona.key });
  const opsView = buildFpaOpsModelWorkbookView({ opsWorkbookInputs, rateCardInputs });
  const rateCardView = buildFpaRateCardWorkbookView({ workbookInputs: rateCardInputs });
  const pricingView = buildFpaPricingWorkbookView({ currentDeal, workspace, inspectPersonaId: selectedPersona.key });
  const costView = buildFpaCostWorkbookView({ currentDeal, workspace, inspectPersonaId: selectedPersona.key });

  const selectedPricingPersona = pricingView.selectedPersona || pricingView.recommendedPersona;
  const selectedCostPersona = costView.selectedPersona || costView.recommendedPersona;
  const selectedTiltLabel = opsView?.personaTiltRow?.values?.[selectedPersona.key]?.value || "Standard";
  const offshoreShareDefault = Number(
    opsView?.shoreMixTable?.rows?.find((row) => row?.id === "offshore")?.values?.[selectedPersona.key]?.value || 0,
  );

  const offshoreShare = readWorkbookPercentInput(scplInputs, "C9", offshoreShareDefault);
  const totalFteSteady = Number(fteView?.selectedPersona?.steadyTotal || 0);
  const offshoreFteSteady = round(totalFteSteady * offshoreShare, 12);
  const staffingIndiaFte = ceilHalf(offshoreFteSteady);

  const totalFteByYear = getSelectedYearTotals(fteView, selectedPersona);
  const offshoreFteByYear = totalFteByYear.map((value) => round(value * offshoreShare, 12));
  const contractTermYears = parseContractTermYears(dealSetupInputs.D11 || currentDeal?.contractTerm || 7);
  const inTermMask = YEAR_HEADERS.map((year) => (year.yearNumber <= contractTermYears ? 1 : 0));

  const rateCardConfirmed = readWorkbookChoiceInput(scplInputs, "C39", SCPL_CONFIRM_OPTIONS, "No");
  const locationFactorsConfirmed = readWorkbookChoiceInput(scplInputs, "C62", SCPL_CONFIRM_OPTIONS, "No");
  const arcLoadingPct = readWorkbookPercentInput(scplInputs, "C36", 0);
  const fxReference = readWorkbookWholeNumberInput(scplInputs, "C37", 90);
  const pricingGrossMarginPct = readWorkbookPercentInput(scplInputs, "C38", selectedPersona.targetGrossMarginPct);
  const minSecondaryCenterFte = readWorkbookWholeNumberInput(scplInputs, "C63", 10);

  const locationRowsBase = SCPL_CENTER_DEFINITIONS.map((definition) => ({
    ...definition,
    allocationInput: {
      address: `D${definition.rowNumber}`,
      kind: "percent",
      value: readWorkbookPercentInput(scplInputs, `D${definition.rowNumber}`, definition.defaultAllocationPct),
    },
    factorInput: {
      address: `E${definition.rowNumber}`,
      kind: "decimal",
      value: readWorkbookDecimalInput(scplInputs, `E${definition.rowNumber}`, definition.defaultFactor),
    },
  }));

  const locationAllocationTotal = round(
    locationRowsBase.reduce((sum, row) => sum + Number(row.allocationInput.value || 0), 0),
    12,
  );
  const blendedLocationFactor = round(
    locationRowsBase.reduce(
      (sum, row) => sum + (Number(row.allocationInput.value || 0) * Number(row.factorInput.value || 0)),
      0,
    ),
    12,
  );

  const defaultBandMixByTilt = buildDefaultBandMixByTilt(selectedTiltLabel);
  const rateCardBaseRowsById = Object.fromEntries((rateCardView.baseSalaryRows || []).map((row) => [row.id, row]));

  const bandRows = SCPL_BAND_DEFINITIONS.map((definition) => {
    const mixPct = readWorkbookPercentInput(scplInputs, `D${definition.rowNumber}`, defaultBandMixByTilt[definition.id] || 0);
    const standardArcUsd = Number(rateCardBaseRowsById[definition.id]?.values?.offshoreIndia?.value || 0);
    const standardArcInr = round(standardArcUsd * fxReference, 12);
    const blendedArcUsd = round(standardArcUsd * (1 + arcLoadingPct) * blendedLocationFactor, 12);
    const steadyFte = round(offshoreFteSteady * mixPct, 12);
    const staffingView = ceilHalf(steadyFte);
    const yearValues = offshoreFteByYear.map((value) => round(value * mixPct, 12));
    const annualCostSteady = round(steadyFte * blendedArcUsd, 12);
    const billRatePerFte = pricingGrossMarginPct < 1 ? round(blendedArcUsd / (1 - pricingGrossMarginPct), 12) : 0;
    const annualPriceSteady = round(steadyFte * billRatePerFte, 12);
    const monthlyBillRatePerFte = round(billRatePerFte / 12, 12);

    return {
      ...definition,
      mixInput: {
        address: `D${definition.rowNumber}`,
        kind: "percent",
        value: mixPct,
        defaultValue: defaultBandMixByTilt[definition.id] || 0,
      },
      standardArcUsd,
      standardArcInr,
      blendedArcUsd,
      steadyFte,
      staffingView,
      yearValues,
      annualCostSteady,
      billRatePerFte,
      annualPriceSteady,
      monthlyBillRatePerFte,
      seedNote: definition.seedNote(selectedTiltLabel),
    };
  });

  const bandMixTotal = round(bandRows.reduce((sum, row) => sum + Number(row.mixInput.value || 0), 0), 12);
  const bandedIndiaFteSteady = round(bandRows.reduce((sum, row) => sum + row.steadyFte, 0), 12);
  const bandedStaffingView = round(bandRows.reduce((sum, row) => sum + row.staffingView, 0), 12);
  const bandedYearTotals = YEAR_HEADERS.map((_, yearIndex) => round(
    bandRows.reduce((sum, row) => sum + Number(row.yearValues[yearIndex] || 0), 0),
    12,
  ));

  const annualCostSteady = round(bandRows.reduce((sum, row) => sum + row.annualCostSteady, 0), 12);
  const annualPriceSteady = round(bandRows.reduce((sum, row) => sum + row.annualPriceSteady, 0), 12);
  const billRatePerIndiaFte = bandedIndiaFteSteady > 0 ? round(annualPriceSteady / bandedIndiaFteSteady, 12) : 0;
  const monthlyBillRatePerIndiaFte = round(billRatePerIndiaFte / 12, 12);
  const blendedArcPerFte = bandedIndiaFteSteady > 0 ? round(annualCostSteady / bandedIndiaFteSteady, 12) : 0;
  const grossMarginSteady = round(annualPriceSteady - annualCostSteady, 12);
  const monthlyInvoiceSteady = round(annualPriceSteady / 12, 12);

  const juniorShare = round(
    bandRows
      .filter((row) => [21, 22, 23].includes(row.rowNumber))
      .reduce((sum, row) => sum + Number(row.mixInput.value || 0), 0),
    12,
  );
  const seniorShare = round(
    bandRows
      .filter((row) => [25, 26, 27, 28].includes(row.rowNumber))
      .reduce((sum, row) => sum + Number(row.mixInput.value || 0), 0),
    12,
  );
  const leadershipDenominator = bandRows
    .filter((row) => [25, 26, 27, 28].includes(row.rowNumber))
    .reduce((sum, row) => sum + row.steadyFte, 0);
  const leadershipNumerator = bandRows
    .filter((row) => [21, 22, 23, 24].includes(row.rowNumber))
    .reduce((sum, row) => sum + row.steadyFte, 0);
  const impliedSpan = leadershipDenominator > 0 ? round(leadershipNumerator / leadershipDenominator, 12) : "n/a";
  const expectedSpan = selectedPersona.spanOfControl;
  const leadershipSpanStatus = typeof impliedSpan === "number"
    ? (impliedSpan > expectedSpan * 1.5
        ? "AMBER - thin leadership layer"
        : (impliedSpan < expectedSpan * 0.5 ? "AMBER - top-heavy pyramid" : "OK"))
    : "n/a";

  const locationRows = locationRowsBase.map((row) => {
    const steadyFte = round(bandedIndiaFteSteady * Number(row.allocationInput.value || 0), 12);
    const staffingView = ceilHalf(steadyFte);
    const annualCost = blendedLocationFactor > 0
      ? round(annualCostSteady * Number(row.allocationInput.value || 0) * Number(row.factorInput.value || 0) / blendedLocationFactor, 12)
      : 0;

    let statusText = row.baseStatus || "";
    if (!statusText) {
      statusText = Number(row.factorInput.value || 0) === 1
        ? "Parity with Noida assumed - confirm [PA]"
        : "Differential applied - confirm with deal desk";
    }

    return {
      ...row,
      steadyFte,
      staffingView,
      annualCost,
      statusText,
    };
  });

  const locationTotalFte = round(locationRows.reduce((sum, row) => sum + row.steadyFte, 0), 12);
  const locationTotalStaffing = round(locationRows.reduce((sum, row) => sum + row.staffingView, 0), 12);
  const locationTotalCost = round(locationRows.reduce((sum, row) => sum + row.annualCost, 0), 12);

  const allocationStatus = Math.abs(locationAllocationTotal - 1) > 0.001
    ? "FIX - allocation must total 100%"
    : "OK";
  const bandMixStatus = Math.abs(bandMixTotal - 1) > 0.001
    ? "FIX - band mix must total 100%"
    : "OK";
  const offshoreShareStatus = offshoreShare < 0 || offshoreShare > 1
    ? "FIX - share must be 0-100%"
    : "OK";
  const rateCardStatus = rateCardConfirmed === "Yes"
    ? "OK"
    : "AMBER - standard card, unconfirmed";
  const nonNoidaAllocationPct = locationRows
    .filter((row) => row.id !== "noida")
    .reduce((sum, row) => sum + Number(row.allocationInput.value || 0), 0);
  const locationFactorStatus = locationFactorsConfirmed === "Yes"
    ? "OK"
    : (nonNoidaAllocationPct > 0 ? "AMBER - non-Noida FTE priced on parity factors" : "OK - Noida only");
  const gmFloorPct = Number(pricingView?.controls?.commercialGmFloor?.value || 0);
  const gmFloorStatus = pricingGrossMarginPct < gmFloorPct
    ? "RED - below GM floor"
    : "OK";
  const activeCenters = locationRows.filter((row) => row.steadyFte > 0);
  const subScaleCenterStatus = activeCenters.length > 1 && activeCenters.some((row) => row.steadyFte < minSecondaryCenterFte)
    ? "AMBER - a split center is below the minimum (consolidate or pool across towers)"
    : "OK";

  const overallStatus = [
    bandMixStatus,
    allocationStatus,
    offshoreShareStatus,
    rateCardStatus,
    locationFactorStatus,
    gmFloorStatus,
    leadershipSpanStatus,
    subScaleCenterStatus,
  ].some((value) => trimValue(value).startsWith("FIX") || trimValue(value).startsWith("RED"))
    ? "RED"
    : ([bandMixStatus, allocationStatus, offshoreShareStatus, rateCardStatus, locationFactorStatus, gmFloorStatus, leadershipSpanStatus, subScaleCenterStatus]
        .some((value) => trimValue(value).startsWith("AMBER"))
        ? "AMBER"
        : "GREEN");

  const wageInflationIndia = Number(
    rateCardView?.locationFactorRows?.find((row) => row?.id === "wageInflation")?.values?.offshoreIndia?.value || 0,
  );

  const yearViewRows = [
    {
      rowNumber: 67,
      label: "India offshore FTE",
      format: "fte2",
      values: offshoreFteByYear,
      termTotal: null,
    },
    {
      rowNumber: 69,
      label: "Blended ARC per India FTE (inflated, USD/yr)",
      format: "currency2",
      values: YEAR_HEADERS.map((year) => round(blendedArcPerFte * ((1 + wageInflationIndia) ** (year.yearNumber - 1)), 12)),
      termTotal: null,
    },
  ];

  const inflatedArcByYear = yearViewRows[1].values;
  const annualCostByYear = YEAR_HEADERS.map((_, index) => round(offshoreFteByYear[index] * inflatedArcByYear[index], 12));
  const annualPriceByYear = YEAR_HEADERS.map((_, index) => (
    pricingGrossMarginPct < 1 ? round(annualCostByYear[index] / (1 - pricingGrossMarginPct), 12) : 0
  ));
  const grossMarginByYear = YEAR_HEADERS.map((_, index) => round(annualPriceByYear[index] - annualCostByYear[index], 12));
  const billRateByYear = YEAR_HEADERS.map((_, index) => (
    offshoreFteByYear[index] > 0 ? round(annualPriceByYear[index] / offshoreFteByYear[index], 12) : 0
  ));

  yearViewRows.push(
    {
      rowNumber: 70,
      label: "Annual cost - India scope (USD)",
      format: "currency0",
      values: annualCostByYear,
      termTotal: round(annualCostByYear.reduce((sum, value, index) => sum + (value * inTermMask[index]), 0), 12),
    },
    {
      rowNumber: 71,
      label: "Annual price - India scope (USD)",
      format: "currency0",
      values: annualPriceByYear,
      termTotal: round(annualPriceByYear.reduce((sum, value, index) => sum + (value * inTermMask[index]), 0), 12),
    },
    {
      rowNumber: 72,
      label: "Gross margin (USD)",
      format: "currency0",
      values: grossMarginByYear,
      termTotal: round(grossMarginByYear.reduce((sum, value, index) => sum + (value * inTermMask[index]), 0), 12),
    },
    {
      rowNumber: 73,
      label: "Bill rate per India FTE (USD/yr)",
      format: "currency2",
      values: billRateByYear,
      termTotal: null,
    },
  );

  const modelOffshoreLoadedCostPerFte = round(
    getOpsOffshoreBlendedCost(opsView, selectedPersona.key) + getOpsOffshoreSeatCost(opsView),
    12,
  );
  const modelOffshoreLaborSteady = round(offshoreFteSteady * modelOffshoreLoadedCostPerFte, 12);
  const modelRunRateGmPct = Number(selectedPricingPersona?.metrics?.grossMarginPct || 0);
  const modelBillRatePerFte = modelRunRateGmPct < 1
    ? round(modelOffshoreLoadedCostPerFte / (1 - modelRunRateGmPct), 12)
    : 0;
  const modelCostToServeY1 = Number(selectedCostPersona?.summary?.costToServeY1 || 0);
  const modelRecommendedAnnualPrice = Number(selectedPricingPersona?.metrics?.recommendedAnnualPrice || 0);

  const reconciliationRows = [
    {
      rowNumber: 77,
      label: "India / offshore FTE - steady",
      scplValue: bandedIndiaFteSteady,
      modelValue: offshoreFteSteady,
      delta: round(bandedIndiaFteSteady - offshoreFteSteady, 12),
      deltaPct: offshoreFteSteady !== 0 ? round((bandedIndiaFteSteady - offshoreFteSteady) / offshoreFteSteady, 12) : 0,
      format: "fte2",
      deltaFormat: "fte2",
      deltaPctFormat: "percent1",
      read: "Same by construction - SCPL re-prices the model's offshore layer",
    },
    {
      rowNumber: 78,
      label: "Loaded cost per offshore FTE incl. seat (USD/yr)",
      scplValue: blendedArcPerFte,
      modelValue: modelOffshoreLoadedCostPerFte,
      delta: round(blendedArcPerFte - modelOffshoreLoadedCostPerFte, 12),
      deltaPct: modelOffshoreLoadedCostPerFte !== 0 ? round((blendedArcPerFte - modelOffshoreLoadedCostPerFte) / modelOffshoreLoadedCostPerFte, 12) : 0,
      format: "currency2",
      deltaFormat: "currency2",
      deltaPctFormat: "percent1",
      read: Math.abs(modelOffshoreLoadedCostPerFte !== 0 ? (blendedArcPerFte - modelOffshoreLoadedCostPerFte) / modelOffshoreLoadedCostPerFte : 0) <= 0.1
        ? "GREEN - within ±10% of the seed"
        : ((blendedArcPerFte - modelOffshoreLoadedCostPerFte) > 0
            ? "AMBER - HCL card above seed: check band mix / tower premium"
            : "AMBER - HCL card below seed: margin headroom or seed too rich"),
    },
    {
      rowNumber: 79,
      label: "Offshore labour cost - steady (USD/yr)",
      scplValue: annualCostSteady,
      modelValue: modelOffshoreLaborSteady,
      delta: round(annualCostSteady - modelOffshoreLaborSteady, 12),
      deltaPct: modelOffshoreLaborSteady !== 0 ? round((annualCostSteady - modelOffshoreLaborSteady) / modelOffshoreLaborSteady, 12) : 0,
      format: "currency0",
      deltaFormat: "currency0",
      deltaPctFormat: "percent1",
      read: "Model side = offshore FTE × (09 blended offshore loaded cost + offshore seat)",
    },
    {
      rowNumber: 80,
      label: "Pricing GM % (SCPL input vs 13 Pricing run-rate GM)",
      scplValue: pricingGrossMarginPct,
      modelValue: modelRunRateGmPct,
      delta: round(pricingGrossMarginPct - modelRunRateGmPct, 12),
      deltaPct: null,
      format: "percent1",
      deltaFormat: "pp1",
      deltaPctFormat: "text",
      read: "Model GM % is run-rate after floor / target / markup / competition-bias logic",
    },
    {
      rowNumber: 81,
      label: "Bill rate per offshore FTE (USD/yr)",
      scplValue: billRatePerIndiaFte,
      modelValue: modelBillRatePerFte,
      delta: round(billRatePerIndiaFte - modelBillRatePerFte, 12),
      deltaPct: modelBillRatePerFte !== 0 ? round((billRatePerIndiaFte - modelBillRatePerFte) / modelBillRatePerFte, 12) : 0,
      format: "currency2",
      deltaFormat: "currency2",
      deltaPctFormat: "percent1",
      read: "Model value derived: seed cost ÷ (1 - model GM) - directional",
    },
    {
      rowNumber: 82,
      label: "Context - SCPL India cost vs model cost-to-serve Y1, all layers (12 Cost)",
      scplValue: annualCostSteady,
      modelValue: modelCostToServeY1,
      delta: null,
      deltaPct: modelCostToServeY1 > 0 ? round(annualCostSteady / modelCostToServeY1, 12) : 0,
      format: "currency0",
      deltaFormat: "text",
      deltaPctFormat: "percent1",
      read: "F = SCPL India share of the model total (not a delta) - model total includes onshore / nearshore, tech & AI run, contingency",
    },
    {
      rowNumber: 83,
      label: "Context - SCPL India price vs model recommended annual price, all layers (13 Pricing)",
      scplValue: annualPriceSteady,
      modelValue: modelRecommendedAnnualPrice,
      delta: null,
      deltaPct: modelRecommendedAnnualPrice > 0 ? round(annualPriceSteady / modelRecommendedAnnualPrice, 12) : 0,
      format: "currency0",
      deltaFormat: "text",
      deltaPctFormat: "percent1",
      read: "F = share of the bid price carried by the India delivery layer on the HCL card (not a delta)",
    },
  ];

  const checkRows = [
    { rowNumber: 87, label: "Band mix totals 100%", status: bandMixStatus, note: "§B" },
    { rowNumber: 88, label: "Delivery-center allocation totals 100%", status: allocationStatus, note: "§D" },
    { rowNumber: 89, label: "India share within 0–100%", status: offshoreShareStatus, note: "§A" },
    { rowNumber: 90, label: "Rate card confirmed by deal desk", status: rateCardStatus, note: "§C" },
    { rowNumber: 91, label: "Location factors confirmed", status: locationFactorStatus, note: "§D" },
    { rowNumber: 92, label: "Pricing GM at or above commercial GM floor (13 Pricing)", status: gmFloorStatus, note: "§C vs 13" },
    { rowNumber: 93, label: "Leadership span sanity", status: leadershipSpanStatus, note: "§B" },
    { rowNumber: 94, label: "Sub-scale center", status: subScaleCenterStatus, note: "§D" },
    { rowNumber: 95, label: "SCPL STATUS", status: overallStatus, note: "RED = fix inputs · AMBER = usable, unconfirmed assumptions · GREEN = confirmed" },
  ].map((row) => ({
    ...row,
    tone: statusToneFromValue(row.status),
  }));

  return {
    ...FPA_SCPL_SNAPSHOT,
    recommendedPersona,
    selectedPersona,
    selectedTiltLabel,
    isAutoPersona,
    yearHeaders: YEAR_HEADERS,
    controls: {
      personaOverride: {
        address: "C6",
        label: "Persona",
        rowNumber: 6,
        kind: "persona",
        value: personaOverrideLabel,
        autoLabel: recommendedPersona.label,
        options: FPA_PERSONA_LIBRARY_COLUMNS.map((persona) => persona.label),
      },
      offshoreShare: {
        address: "C9",
        label: "India offshore share of tower FTE",
        rowNumber: 9,
        kind: "percent",
        value: offshoreShare,
        defaultValue: offshoreShareDefault,
      },
      arcLoading: {
        address: "C36",
        label: "ARC loading %",
        rowNumber: 36,
        kind: "percent",
        value: arcLoadingPct,
      },
      fxReference: {
        address: "C37",
        label: "FX reference (INR per USD)",
        rowNumber: 37,
        kind: "whole",
        value: fxReference,
      },
      pricingGrossMargin: {
        address: "C38",
        label: "Pricing GM %",
        rowNumber: 38,
        kind: "percent",
        value: pricingGrossMarginPct,
        defaultValue: selectedPersona.targetGrossMarginPct,
      },
      rateCardConfirmed: {
        address: "C39",
        label: "Rate card confirmed by deal desk?",
        rowNumber: 39,
        kind: "choice",
        value: rateCardConfirmed,
        options: SCPL_CONFIRM_OPTIONS,
      },
      locationFactorsConfirmed: {
        address: "C62",
        label: "Location factors confirmed by deal desk?",
        rowNumber: 62,
        kind: "choice",
        value: locationFactorsConfirmed,
        options: SCPL_CONFIRM_OPTIONS,
      },
      minSecondaryCenterFte: {
        address: "C63",
        label: "Minimum viable secondary-center size (FTE)",
        rowNumber: 63,
        kind: "whole",
        value: minSecondaryCenterFte,
      },
    },
    sizingRows: [
      {
        rowNumber: 6,
        label: "Persona (auto = 11 FTE Engine selection; overwrite to inspect)",
        value: selectedPersona.label,
        valueFormat: "text",
        note: "Drives FTE, offshore share and target GM. Dropdown: 5 personas.",
      },
      {
        rowNumber: 7,
        label: "Persona index",
        value: selectedPersona.index,
        valueFormat: "whole",
        note: "1 Conservative · 2 Standard · 3 Lean · 4 Aggressive AI-First · 5 Autonomous Finance",
      },
      {
        rowNumber: 8,
        label: "Tower total FTE - steady state (all layers)",
        value: totalFteSteady,
        valueFormat: "fte2",
        note: "11 §B TOTAL FTE — steady for the selected persona",
      },
      {
        rowNumber: 9,
        label: "India offshore share of tower FTE",
        value: offshoreShare,
        valueFormat: "percent1",
        note: "09 §A offshore row for the persona. Type 100% to size the whole tower from India.",
      },
      {
        rowNumber: 10,
        label: "India offshore FTE - steady state (SCPL scope)",
        value: offshoreFteSteady,
        valueFormat: "fte2",
        note: "Sized by band in §B, costed in §C, located in §D",
      },
      {
        rowNumber: 11,
        label: "Onshore / nearshore FTE - outside SCPL scope",
        value: round(totalFteSteady - offshoreFteSteady, 12),
        valueFormat: "fte2",
        note: "Priced on 10 Rate Card",
      },
      {
        rowNumber: 12,
        label: "Staffing view - India FTE (0.5 steps)",
        value: staffingIndiaFte,
        valueFormat: "number2",
        note: "Rounded from row 10 using workbook 0.5-step staffing logic",
      },
    ],
    yearGrid: {
      rowNumber: 15,
      headers: YEAR_HEADERS,
      totalFteByYear,
      offshoreFteByYear,
      inTermMask,
    },
    bandRows,
    compositionChecks: {
      bandMixTotal,
      juniorShare,
      seniorShare,
      impliedSpan,
      expectedSpan,
      bandMixStatus,
      leadershipSpanStatus,
    },
    pricingRows: bandRows,
    pricingTotals: {
      annualCostSteady,
      annualPriceSteady,
      billRatePerIndiaFte,
      monthlyBillRatePerIndiaFte,
      blendedArcPerFte,
      grossMarginSteady,
      monthlyInvoiceSteady,
      blendedLocationFactor,
    },
    locationRows,
    locationSummary: {
      allocationTotal: locationAllocationTotal,
      blendedLocationFactor,
      totalFte: locationTotalFte,
      totalStaffing: locationTotalStaffing,
      totalCost: locationTotalCost,
      allocationStatus,
      locationFactorStatus,
      minSecondaryCenterFte,
      subScaleCenterStatus,
    },
    yearViewRows,
    yearViewSummary: {
      wageInflationIndia,
      contractTermYears,
    },
    reconciliationRows,
    checkRows,
    status: {
      overallStatus,
      overallTone: statusToneFromValue(overallStatus),
    },
  };
}
