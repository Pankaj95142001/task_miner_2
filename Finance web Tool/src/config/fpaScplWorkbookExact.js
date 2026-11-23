import { FPA_PERSONA_LIBRARY_COLUMNS, FPA_PERSONA_LIBRARY_ROWS } from "./fpaPersonas";
import { buildFpaRateCardWorkbookView } from "./fpaRateCard";

const EMPTY_INPUTS = Object.freeze({});
const YEAR_HEADERS = Object.freeze([
  { key: "y1", label: "Y1", yearNumber: 1 },
  { key: "y2", label: "Y2", yearNumber: 2 },
  { key: "y3", label: "Y3", yearNumber: 3 },
  { key: "y4", label: "Y4", yearNumber: 4 },
  { key: "y5", label: "Y5", yearNumber: 5 },
  { key: "y6", label: "Y6", yearNumber: 6 },
  { key: "y7", label: "Y7", yearNumber: 7 },
]);
const SCPL_CONFIRM_OPTIONS = Object.freeze(["Yes", "No"]);
const SCPL_BAND_DEFINITIONS = Object.freeze([
  { id: "associate", rowNumber: 47, bandCode: "E0.1", label: "Associate" },
  { id: "srAssociate", rowNumber: 48, bandCode: "E0.2", label: "Sr Associate" },
  { id: "analyst", rowNumber: 49, bandCode: "E0.3", label: "Analyst" },
  { id: "leadAnalyst", rowNumber: 50, bandCode: "E1", label: "Lead Analyst" },
  { id: "assistantManager", rowNumber: 51, bandCode: "E2", label: "Assistant Manager/Deputy Manager" },
  { id: "manager", rowNumber: 52, bandCode: "E3", label: "Manager/Senior Manager" },
  { id: "groupManager", rowNumber: 53, bandCode: "E4", label: "Group Manager/ Assistant Manager" },
  { id: "deputyGeneralManager", rowNumber: 54, bandCode: "E5", label: "Deputy General Manager/ General Manager" },
]);
const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
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

function readWorkbookTextInput(workbookInputs, address, fallback = "") {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }
  const text = trimValue(workbookInputs[address]);
  return text || fallback;
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

function getPersonaFromLabel(personas, label, fallbackPersona) {
  const normalized = trimValue(label);
  if (!normalized) {
    return fallbackPersona;
  }
  return personas.find((persona) => persona.label === normalized) || fallbackPersona;
}

function makeCell(column, rowNumber) {
  return `${column}${rowNumber}`;
}

function percentageOrBlankValue(workbookInputs, address, fallback) {
  return readWorkbookTextInput(workbookInputs, address, "") ? readWorkbookPercentInput(workbookInputs, address, fallback) : "";
}

function workbookBadgeMap(rowNumber) {
  if (rowNumber === 107) return "§C";
  if (rowNumber === 108) return "§D";
  if (rowNumber === 109) return "§B";
  if (rowNumber === 110) return "§A";
  if (rowNumber === 111) return "§B";
  if (rowNumber === 112) return "§A vs Discovery";
  if (rowNumber === 113) return "§A vs 06";
  if (rowNumber === 114) return "§A";
  if (rowNumber === 115) return "§A";
  if (rowNumber === 116) return "§A / 31";
  if (rowNumber === 117) return "Overall";
  return "";
}

export function isWorkbookExactScplLayout(scplInputs = {}) {
  return trimValue(scplInputs.B21) === "Line"
    && trimValue(scplInputs.B46) === "HCL band"
    && trimValue(scplInputs.B86) === "Delivery center";
}

export function buildExactWorkbookScplView({ currentDeal = {}, workbookInputs = {}, scplInputs = {} } = {}) {
  const personaInputs = workbookInputs["FPA_07 Personas"] && typeof workbookInputs["FPA_07 Personas"] === "object"
    ? workbookInputs["FPA_07 Personas"]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs["FPA_10 Rate Card"] && typeof workbookInputs["FPA_10 Rate Card"] === "object"
    ? workbookInputs["FPA_10 Rate Card"]
    : EMPTY_INPUTS;
  const sizingInputs = workbookInputs["FPA_31 Sizing & Band Mix"] && typeof workbookInputs["FPA_31 Sizing & Band Mix"] === "object"
    ? workbookInputs["FPA_31 Sizing & Band Mix"]
    : EMPTY_INPUTS;
  const personas = buildPersonaModels(personaInputs);
  const fallbackPersona = personas.find((persona) => persona.label === "Standard") || personas[1] || personas[0];
  const recommendedPersona = getPersonaFromLabel(personas, readWorkbookTextInput(scplInputs, "C11", "Standard"), fallbackPersona);
  const selectedPersona = getPersonaFromLabel(personas, readWorkbookTextInput(scplInputs, "C9", recommendedPersona.label), recommendedPersona);
  const selectedColumn = selectedPersona.workbookColumn || "D";
  const contractTermYears = readWorkbookWholeNumberInput(scplInputs, "C18", Number(currentDeal?.contractTerm || 7));
  const selectedTiltLabel = readWorkbookTextInput(
    sizingInputs,
    makeCell(selectedColumn, 21),
    selectedPersona.label === "Conservative" ? "Senior" : (selectedPersona.label === "Standard" ? "Standard" : "Junior"),
  );
  const offshoreShareDefault = readWorkbookPercentInput(scplInputs, makeCell(selectedColumn, 23), 0);
  const offshoreShare = readWorkbookPercentInput(scplInputs, "C12", offshoreShareDefault);
  const totalFteSteady = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 22), 0);
  const baseIndiaFte = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 24), 0);
  const onshoreResidualFte = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 25), 0);
  const discoveryHeadroomHours = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 26), 0);
  const headroomFteEquivalent = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 27), 0);
  const discoveryAdjustment = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 28), 0);
  const recommendedIndiaFte = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 29), 0);
  const manualAdjustment = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 30), 0);
  const finalIndiaFte = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 31), recommendedIndiaFte + manualAdjustment);
  const staffingIndiaFte = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 33), ceilHalf(finalIndiaFte));
  const arcLoadingPct = readWorkbookPercentInput(scplInputs, "C14", 0);
  const fxReference = readWorkbookWholeNumberInput(scplInputs, "C15", 90);
  const pricingGrossMarginPct = readWorkbookPercentInput(
    scplInputs,
    "C16",
    readWorkbookPercentInput(scplInputs, makeCell(selectedColumn, 77), selectedPersona.targetGrossMarginPct),
  );
  const rateCardConfirmed = readWorkbookChoiceInput(scplInputs, "C17", SCPL_CONFIRM_OPTIONS, "No");
  const minSecondaryCenterFte = readWorkbookWholeNumberInput(scplInputs, "C92", 10);
  const locationFactorsConfirmed = readWorkbookChoiceInput(scplInputs, "C93", SCPL_CONFIRM_OPTIONS, "No");
  const rateCardView = buildFpaRateCardWorkbookView({ workbookInputs: rateCardInputs });
  const wageInflationIndia = Number(rateCardView?.ratesByGeo?.offshoreIndia?.inflationPct || 0);

  const bandRows = SCPL_BAND_DEFINITIONS.map((definition, index) => {
    const steadyFte = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, definition.rowNumber), 0);
    const standardArcUsd = readWorkbookDecimalInput(scplInputs, makeCell("D", 65 + index), 0);
    const blendedArcUsd = readWorkbookDecimalInput(scplInputs, makeCell("F", 65 + index), standardArcUsd * (1 + arcLoadingPct));
    const mixPct = finalIndiaFte > 0 ? round(steadyFte / finalIndiaFte, 12) : 0;
    const annualCostSteady = round(steadyFte * blendedArcUsd, 12);
    const billRatePerFte = pricingGrossMarginPct < 1 ? round(blendedArcUsd / (1 - pricingGrossMarginPct), 12) : 0;
    const annualPriceSteady = round(steadyFte * billRatePerFte, 12);
    return {
      ...definition,
      mixInput: {
        address: makeCell("I", definition.rowNumber),
        kind: "percent",
        value: mixPct,
        defaultValue: mixPct,
        readOnly: true,
      },
      standardArcUsd,
      standardArcInr: round(standardArcUsd * fxReference, 12),
      blendedArcUsd,
      steadyFte,
      staffingView: ceilHalf(steadyFte),
      yearValues: YEAR_HEADERS.map(() => 0),
      annualCostSteady,
      billRatePerFte,
      annualPriceSteady,
      monthlyBillRatePerFte: round(billRatePerFte / 12, 12),
      seedNote: `Workbook row ${definition.rowNumber}`,
    };
  });

  const annualCostSteady = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 75), round(bandRows.reduce((sum, row) => sum + row.annualCostSteady, 0), 12));
  const blendedArcPerFte = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 76), finalIndiaFte > 0 ? round(annualCostSteady / finalIndiaFte, 12) : 0);
  const annualPriceSteady = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 78), pricingGrossMarginPct < 1 ? round(annualCostSteady / (1 - pricingGrossMarginPct), 12) : 0);
  const grossMarginSteady = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 79), round(annualPriceSteady - annualCostSteady, 12));
  const monthlyInvoiceSteady = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 80), round(annualPriceSteady / 12, 12));
  const monthlyBillRatePerIndiaFte = readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 81), finalIndiaFte > 0 ? round(monthlyInvoiceSteady / finalIndiaFte, 12) : 0);
  const billRatePerIndiaFte = round(monthlyBillRatePerIndiaFte * 12, 12);
  const blendedLocationFactor = readWorkbookDecimalInput(scplInputs, "C90", 1);

  const yearGridHeaders = YEAR_HEADERS.map((header, index) => ({
    ...header,
    label: readWorkbookTextInput(scplInputs, makeCell(String.fromCharCode("C".charCodeAt(0) + index), 37), header.label),
  }));
  const selectedPersonaYearValues = YEAR_HEADERS.map((_, index) => readWorkbookDecimalInput(scplInputs, makeCell(String.fromCharCode("C".charCodeAt(0) + index), 37 + selectedPersona.index), 0));
  const totalFteByYear = selectedPersonaYearValues.map((value) => offshoreShare > 0 ? round(value / offshoreShare, 12) : 0);
  const inTermMask = YEAR_HEADERS.map((_, index) => (index + 1 <= contractTermYears ? 1 : 0));

  const locationRows = [
    { id: "noida", rowNumber: 87, region: "NCR (North)" },
    { id: "chennai", rowNumber: 88, region: "Tamil Nadu (South)" },
    { id: "hyderabad", rowNumber: 89, region: "Telangana (South)" },
  ].map((definition) => {
    const allocation = readWorkbookPercentInput(scplInputs, makeCell("C", definition.rowNumber), 0);
    const factor = readWorkbookDecimalInput(scplInputs, makeCell("D", definition.rowNumber), 1);
    const steadyFte = readWorkbookDecimalInput(scplInputs, makeCell("E", definition.rowNumber), round(finalIndiaFte * allocation, 12));
    const annualCost = readWorkbookDecimalInput(
      scplInputs,
      makeCell("G", definition.rowNumber),
      blendedLocationFactor > 0 ? round(annualCostSteady * allocation * factor / blendedLocationFactor, 12) : 0,
    );
    return {
      ...definition,
      name: readWorkbookTextInput(scplInputs, makeCell("B", definition.rowNumber), definition.id),
      allocationInput: {
        address: makeCell("C", definition.rowNumber),
        kind: "percent",
        value: allocation,
      },
      factorInput: {
        address: makeCell("D", definition.rowNumber),
        kind: "decimal",
        value: factor,
      },
      steadyFte,
      staffingView: readWorkbookDecimalInput(scplInputs, makeCell("F", definition.rowNumber), ceilHalf(steadyFte)),
      annualCost,
      statusText: readWorkbookTextInput(scplInputs, makeCell("H", definition.rowNumber), ""),
    };
  });

  const locationAllocationTotal = round(locationRows.reduce((sum, row) => sum + Number(row.allocationInput.value || 0), 0), 12);
  const locationTotalFte = round(locationRows.reduce((sum, row) => sum + row.steadyFte, 0), 12);
  const locationTotalStaffing = round(locationRows.reduce((sum, row) => sum + row.staffingView, 0), 12);
  const locationTotalCost = round(locationRows.reduce((sum, row) => sum + row.annualCost, 0), 12);
  const allocationStatus = readWorkbookTextInput(scplInputs, "C91", Math.abs(locationAllocationTotal - 1) > 0.001 ? "FIX" : "OK");
  const locationFactorStatus = locationFactorsConfirmed === "Yes" ? "GREEN — confirmed" : "AMBER — deal desk confirmation pending";
  const subScaleCenterStatus = readWorkbookTextInput(scplInputs, "E92", "OK");

  const contextCostBase = readWorkbookDecimalInput(scplInputs, "D102", 0);
  const contextPriceBase = readWorkbookDecimalInput(scplInputs, "D103", 0);
  const modelLoadedCostPerFte = readWorkbookDecimalInput(scplInputs, "D98", 0);
  const modelOffshoreLaborSteady = readWorkbookDecimalInput(scplInputs, "D99", 0);
  const modelRunRateGmPct = readWorkbookDecimalInput(scplInputs, "D100", 0);
  const modelBillRatePerFte = readWorkbookDecimalInput(scplInputs, "D101", 0);

  const reconciliationRows = [
    {
      rowNumber: 97,
      label: readWorkbookTextInput(scplInputs, "B97", "India FTE — FINAL vs system base"),
      scplValue: finalIndiaFte,
      modelValue: baseIndiaFte,
      delta: round(finalIndiaFte - baseIndiaFte, 12),
      deltaPct: baseIndiaFte !== 0 ? round((finalIndiaFte - baseIndiaFte) / baseIndiaFte, 12) : 0,
      format: "fte2",
      deltaFormat: "fte2",
      deltaPctFormat: "percent1",
      read: "Workbook exact selected-persona tie-out",
    },
    {
      rowNumber: 98,
      label: readWorkbookTextInput(scplInputs, "B98", "Loaded cost / FTE"),
      scplValue: blendedArcPerFte,
      modelValue: modelLoadedCostPerFte,
      delta: round(blendedArcPerFte - modelLoadedCostPerFte, 12),
      deltaPct: modelLoadedCostPerFte !== 0 ? round((blendedArcPerFte - modelLoadedCostPerFte) / modelLoadedCostPerFte, 12) : 0,
      format: "currency2",
      deltaFormat: "currency2",
      deltaPctFormat: "percent1",
      read: "Workbook exact selected-persona tie-out",
    },
    {
      rowNumber: 99,
      label: readWorkbookTextInput(scplInputs, "B99", "Offshore labour cost (annual)"),
      scplValue: annualCostSteady,
      modelValue: modelOffshoreLaborSteady,
      delta: round(annualCostSteady - modelOffshoreLaborSteady, 12),
      deltaPct: modelOffshoreLaborSteady !== 0 ? round((annualCostSteady - modelOffshoreLaborSteady) / modelOffshoreLaborSteady, 12) : 0,
      format: "currency0",
      deltaFormat: "currency0",
      deltaPctFormat: "percent1",
      read: "Workbook exact selected-persona tie-out",
    },
    {
      rowNumber: 100,
      label: readWorkbookTextInput(scplInputs, "B100", "Gross margin %"),
      scplValue: pricingGrossMarginPct,
      modelValue: modelRunRateGmPct,
      delta: round(pricingGrossMarginPct - modelRunRateGmPct, 12),
      deltaPct: null,
      format: "percent1",
      deltaFormat: "pp1",
      deltaPctFormat: "text",
      read: "Workbook exact selected-persona tie-out",
    },
    {
      rowNumber: 101,
      label: readWorkbookTextInput(scplInputs, "B101", "Bill rate / FTE / yr"),
      scplValue: billRatePerIndiaFte,
      modelValue: modelBillRatePerFte,
      delta: round(billRatePerIndiaFte - modelBillRatePerFte, 12),
      deltaPct: modelBillRatePerFte !== 0 ? round((billRatePerIndiaFte - modelBillRatePerFte) / modelBillRatePerFte, 12) : 0,
      format: "currency2",
      deltaFormat: "currency2",
      deltaPctFormat: "percent1",
      read: "Workbook exact selected-persona tie-out",
    },
    {
      rowNumber: 102,
      label: readWorkbookTextInput(scplInputs, "B102", "SCPL India cost as share of model cost-to-serve Y1"),
      scplValue: annualCostSteady,
      modelValue: contextCostBase,
      delta: null,
      deltaPct: contextCostBase > 0 ? round(annualCostSteady / contextCostBase, 12) : 0,
      format: "currency0",
      deltaFormat: "text",
      deltaPctFormat: "percent1",
      read: "Context ratio from workbook",
    },
    {
      rowNumber: 103,
      label: readWorkbookTextInput(scplInputs, "B103", "SCPL India price as share of model annual price"),
      scplValue: annualPriceSteady,
      modelValue: contextPriceBase,
      delta: null,
      deltaPct: contextPriceBase > 0 ? round(annualPriceSteady / contextPriceBase, 12) : 0,
      format: "currency0",
      deltaFormat: "text",
      deltaPctFormat: "percent1",
      read: "Context ratio from workbook",
    },
  ];

  const checkRows = Array.from({ length: 11 }, (_, index) => {
    const rowNumber = 107 + index;
    const status = readWorkbookTextInput(scplInputs, makeCell("C", rowNumber), "");
    return {
      rowNumber,
      label: readWorkbookTextInput(scplInputs, makeCell("B", rowNumber), `Check ${index + 1}`),
      status,
      note: workbookBadgeMap(rowNumber),
      tone: statusToneFromValue(status),
    };
  });

  const overallStatus = readWorkbookTextInput(scplInputs, "C117", checkRows.some((row) => String(row.status || "").toUpperCase().startsWith("RED"))
    ? "RED — review required"
    : (checkRows.some((row) => String(row.status || "").toUpperCase().startsWith("AMBER")) ? "AMBER — caution" : "GREEN — OK"));

  return {
    layoutMode: "workbook-v62",
    recommendedPersona,
    selectedPersona,
    selectedTiltLabel,
    isAutoPersona: false,
    yearHeaders: [
      { key: "conservative", label: readWorkbookTextInput(scplInputs, "C74", "Conservative") },
      { key: "standard", label: readWorkbookTextInput(scplInputs, "D74", "Standard") },
      { key: "lean", label: readWorkbookTextInput(scplInputs, "E74", "Lean") },
      { key: "aggressiveAiFirst", label: readWorkbookTextInput(scplInputs, "F74", "Aggressive AI-First") },
      { key: "autonomousFinance", label: readWorkbookTextInput(scplInputs, "G74", "Autonomous Finance") },
      { key: "selected", label: readWorkbookTextInput(scplInputs, "H74", "Selected") },
    ],
    controls: {
      personaOverride: {
        address: "C9",
        label: "Persona",
        rowNumber: 9,
        kind: "persona",
        value: selectedPersona.label,
        autoLabel: recommendedPersona.label,
        options: FPA_PERSONA_LIBRARY_COLUMNS.map((persona) => persona.label),
      },
      offshoreShare: {
        address: "C12",
        label: "India offshore share of tower FTE",
        rowNumber: 12,
        kind: "percent",
        value: percentageOrBlankValue(scplInputs, "C12", offshoreShareDefault),
        defaultValue: offshoreShareDefault,
      },
      arcLoading: {
        address: "C14",
        label: "ARC loading %",
        rowNumber: 14,
        kind: "percent",
        value: arcLoadingPct,
      },
      fxReference: {
        address: "C15",
        label: "FX reference (INR per USD)",
        rowNumber: 15,
        kind: "whole",
        value: fxReference,
      },
      pricingGrossMargin: {
        address: "C16",
        label: "Pricing GM %",
        rowNumber: 16,
        kind: "percent",
        value: percentageOrBlankValue(scplInputs, "C16", pricingGrossMarginPct),
        defaultValue: readWorkbookPercentInput(scplInputs, makeCell(selectedColumn, 77), selectedPersona.targetGrossMarginPct),
      },
      rateCardConfirmed: {
        address: "C17",
        label: "Rate card confirmed by deal desk?",
        rowNumber: 17,
        kind: "choice",
        value: rateCardConfirmed,
        options: SCPL_CONFIRM_OPTIONS,
      },
      locationFactorsConfirmed: {
        address: "C93",
        label: "Location factors confirmed by deal desk?",
        rowNumber: 93,
        kind: "choice",
        value: locationFactorsConfirmed,
        options: SCPL_CONFIRM_OPTIONS,
      },
      minSecondaryCenterFte: {
        address: "C92",
        label: "Minimum viable secondary-center size (FTE)",
        rowNumber: 92,
        kind: "whole",
        value: minSecondaryCenterFte,
      },
    },
    sizingRows: [
      { rowNumber: 9, label: readWorkbookTextInput(scplInputs, "B9", "Selected persona"), value: selectedPersona.label, valueFormat: "text", note: "Workbook exact control" },
      { rowNumber: 10, label: readWorkbookTextInput(scplInputs, "B10", "Persona index"), value: selectedPersona.index, valueFormat: "whole", note: "Workbook exact control" },
      { rowNumber: 11, label: readWorkbookTextInput(scplInputs, "B11", "Recommended persona"), value: recommendedPersona.label, valueFormat: "text", note: "Workbook exact control" },
      { rowNumber: 23, label: readWorkbookTextInput(scplInputs, "B23", "India offshore share"), value: offshoreShare, valueFormat: "percent1", note: "Workbook exact selected-persona value" },
      { rowNumber: 24, label: readWorkbookTextInput(scplInputs, "B24", "Base India FTE — system"), value: baseIndiaFte, valueFormat: "fte2", note: "Workbook exact selected-persona value" },
      { rowNumber: 25, label: readWorkbookTextInput(scplInputs, "B25", "Onshore / nearshore residual FTE"), value: onshoreResidualFte, valueFormat: "fte2", note: "Workbook exact selected-persona value" },
      { rowNumber: 26, label: readWorkbookTextInput(scplInputs, "B26", "Discovery automation headroom"), value: discoveryHeadroomHours, valueFormat: "number2", note: "Workbook exact selected-persona value" },
      { rowNumber: 27, label: readWorkbookTextInput(scplInputs, "B27", "Headroom FTE-equivalent"), value: headroomFteEquivalent, valueFormat: "fte2", note: "Workbook exact selected-persona value" },
      { rowNumber: 28, label: readWorkbookTextInput(scplInputs, "B28", "Discovery adjustment applied"), value: discoveryAdjustment, valueFormat: "fte2", note: "Workbook exact selected-persona value" },
      { rowNumber: 29, label: readWorkbookTextInput(scplInputs, "B29", "SCPL recommended India FTE"), value: recommendedIndiaFte, valueFormat: "fte2", note: "Workbook exact selected-persona value" },
      { rowNumber: 30, label: readWorkbookTextInput(scplInputs, "B30", "Manual adjustment"), value: manualAdjustment, valueFormat: "fte2", note: "Workbook exact selected-persona value" },
      { rowNumber: 31, label: readWorkbookTextInput(scplInputs, "B31", "FINAL India FTE"), value: finalIndiaFte, valueFormat: "fte2", note: "Workbook exact selected-persona value" },
      { rowNumber: 33, label: readWorkbookTextInput(scplInputs, "B33", "Staffing view"), value: staffingIndiaFte, valueFormat: "number2", note: "Workbook exact selected-persona value" },
    ],
    yearGrid: {
      mode: "personaRows",
      rowNumber: 37,
      headers: yearGridHeaders,
      rows: [38, 39, 40, 41, 42, 43].map((rowNumber) => ({
        rowNumber,
        label: readWorkbookTextInput(scplInputs, makeCell("B", rowNumber), `Row ${rowNumber}`),
        values: YEAR_HEADERS.map((_, index) => readWorkbookDecimalInput(scplInputs, makeCell(String.fromCharCode("C".charCodeAt(0) + index), rowNumber), 0)),
        format: "fte2",
      })),
      totalFteByYear,
      offshoreFteByYear: selectedPersonaYearValues,
      inTermMask,
    },
    yearGridSection: {
      badge: "Workbook Rows 37-43",
      title: "A2. Persona / year view",
      note: "Workbook exact yearly FTE outputs by persona and selected scenario.",
    },
    bandSection: {
      badge: "Workbook Rows 46-61",
      title: "B. Band mix, staffing and pricing by band",
      note: "Workbook exact selected-persona band composition and cost roll-up.",
    },
    bandRows,
    compositionChecks: {
      bandMixTotal: round(bandRows.reduce((sum, row) => sum + Number(row.mixInput.value || 0), 0), 12),
      juniorShare: readWorkbookPercentInput(scplInputs, makeCell(selectedColumn, 56), 0),
      seniorShare: readWorkbookPercentInput(scplInputs, makeCell(selectedColumn, 57), 0),
      impliedSpan: readWorkbookDecimalInput(scplInputs, makeCell(selectedColumn, 59), 0),
      expectedSpan: selectedPersona.spanOfControl,
      bandMixStatus: readWorkbookTextInput(scplInputs, makeCell(selectedColumn, 61), "OK"),
      leadershipSpanStatus: readWorkbookTextInput(scplInputs, makeCell(selectedColumn, 60), "OK"),
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
    locationSection: {
      badge: "Workbook Rows 86-93",
      title: "D. Delivery-center split",
      note: "Workbook exact selected-persona center split and confirmation checks.",
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
    yearViewSection: {
      badge: "Workbook Rows 74-83",
      title: "E. Commercials by persona",
      note: "Workbook exact persona-level commercial outputs and selected readout.",
      showTotalColumn: false,
    },
    yearViewRows: [75, 76, 77, 78, 79, 80, 81, 82, 83].map((rowNumber) => ({
      rowNumber,
      label: readWorkbookTextInput(scplInputs, makeCell("B", rowNumber), `Row ${rowNumber}`),
      format: rowNumber === 77 || rowNumber === 83 ? "percent1" : (rowNumber === 76 || rowNumber === 81 ? "currency2" : "currency0"),
      values: ["C", "D", "E", "F", "G", "H"].map((column) => readWorkbookDecimalInput(scplInputs, makeCell(column, rowNumber), 0)),
      termTotal: null,
    })),
    yearViewSummary: {
      wageInflationIndia,
      contractTermYears,
    },
    reconciliationSection: {
      badge: "Workbook Rows 96-103",
      title: "F. Reconciliation to the main model",
      note: "Workbook exact selected-persona tie-out versus the seed model.",
    },
    reconciliationRows,
    checkSection: {
      badge: "Workbook Rows 107-117",
      title: "G. Quality checks",
      note: "Workbook exact SCPL validation and submission readiness checks.",
    },
    checkRows,
    status: {
      overallStatus,
      overallTone: statusToneFromValue(overallStatus),
    },
  };
}
