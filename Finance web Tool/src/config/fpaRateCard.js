const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const EMPTY_INPUTS = Object.freeze({});

export const FPA_RATE_CARD_SNAPSHOT = Object.freeze({
  sheetName: "FPA_10 Rate Card",
  title: "10. Rate Card & Cost Factors — provider-neutral USD [MKT directional FY26] — FP&A",
  note: "Calibrate to your cost book before first live use. Loaded = base x (1 + benefits load). Identical seed across towers; tower-specific premiums may be applied here.",
  formulaCount: 48,
  editableCellCount: 86,
  gradeCount: 8,
  locationCount: 6,
  personaCount: 5,
});

export const RATE_CARD_CONFIRM_OPTIONS = Object.freeze(["Yes", "No"]);

export const RATE_CARD_LOCATIONS = Object.freeze([
  { id: "onshoreUs", label: "Onshore - US", column: "C" },
  { id: "onshoreWEurope", label: "Onshore - W.Europe", column: "D" },
  { id: "nearshoreEEurope", label: "Nearshore - E.Europe", column: "E" },
  { id: "nearshoreLatAm", label: "Nearshore - LatAm", column: "F" },
  { id: "offshoreIndia", label: "Offshore - India", column: "G" },
  { id: "offshorePhilippines", label: "Offshore - Philippines", column: "H" },
]);

export const RATE_CARD_GRADES = Object.freeze([
  { id: "associate", bandCode: "E0.1", label: "Associate", baseRow: 6, loadedRow: 17 },
  { id: "srAssociate", bandCode: "E0.2", label: "Sr Associate", baseRow: 7, loadedRow: 18 },
  { id: "analyst", bandCode: "E0.3", label: "Analyst", baseRow: 8, loadedRow: 19 },
  { id: "leadAnalyst", bandCode: "E1", label: "Lead Analyst", baseRow: 9, loadedRow: 20 },
  { id: "assistantManager", bandCode: "E2", label: "Assistant Manager/Deputy Manager", baseRow: 10, loadedRow: 21 },
  { id: "manager", bandCode: "E3", label: "Manager/Senior Manager", baseRow: 11, loadedRow: 22 },
  { id: "groupManager", bandCode: "E4", label: "Group Manager/ Assistant Manager", baseRow: 12, loadedRow: 23 },
  { id: "deputyGeneralManager", bandCode: "E5", label: "Deputy General Manager/ General Manager", baseRow: 13, loadedRow: 24 },
]);

export const RATE_CARD_PERSONAS = Object.freeze([
  { id: "conservative", label: "Conservative", column: "C" },
  { id: "standard", label: "Standard", column: "D" },
  { id: "lean", label: "Lean", column: "E" },
  { id: "aggressiveAiFirst", label: "Aggressive AI-First", column: "F" },
  { id: "autonomousFinance", label: "Autonomous Finance", column: "G" },
]);

const BASE_SALARY_DEFAULTS = Object.freeze({
  associate: Object.freeze({
    onshoreUs: 5667,
    onshoreWEurope: 4250,
    nearshoreEEurope: 2338,
    nearshoreLatAm: 2550,
    offshoreIndia: 2833,
    offshorePhilippines: 3060,
  }),
  srAssociate: Object.freeze({
    onshoreUs: 8333,
    onshoreWEurope: 6250,
    nearshoreEEurope: 3438,
    nearshoreLatAm: 3750,
    offshoreIndia: 4167,
    offshorePhilippines: 4500,
  }),
  analyst: Object.freeze({
    onshoreUs: 13333,
    onshoreWEurope: 10000,
    nearshoreEEurope: 5500,
    nearshoreLatAm: 6000,
    offshoreIndia: 6667,
    offshorePhilippines: 7200,
  }),
  leadAnalyst: Object.freeze({
    onshoreUs: 22222,
    onshoreWEurope: 16667,
    nearshoreEEurope: 9167,
    nearshoreLatAm: 10000,
    offshoreIndia: 11111,
    offshorePhilippines: 12000,
  }),
  assistantManager: Object.freeze({
    onshoreUs: 33333,
    onshoreWEurope: 25000,
    nearshoreEEurope: 13750,
    nearshoreLatAm: 15000,
    offshoreIndia: 16667,
    offshorePhilippines: 18000,
  }),
  manager: Object.freeze({
    onshoreUs: 55556,
    onshoreWEurope: 41667,
    nearshoreEEurope: 22917,
    nearshoreLatAm: 25000,
    offshoreIndia: 27778,
    offshorePhilippines: 30000,
  }),
  groupManager: Object.freeze({
    onshoreUs: 77778,
    onshoreWEurope: 58333,
    nearshoreEEurope: 32083,
    nearshoreLatAm: 35000,
    offshoreIndia: 38889,
    offshorePhilippines: 42000,
  }),
  deputyGeneralManager: Object.freeze({
    onshoreUs: 111111,
    onshoreWEurope: 83333,
    nearshoreEEurope: 45833,
    nearshoreLatAm: 50000,
    offshoreIndia: 55556,
    offshorePhilippines: 60000,
  }),
});

const BENEFITS_LOAD_DEFAULTS = Object.freeze({
  onshoreUs: 0.28,
  onshoreWEurope: 0.28,
  nearshoreEEurope: 0.25,
  nearshoreLatAm: 0.25,
  offshoreIndia: 0.22,
  offshorePhilippines: 0.22,
});

const LOCATION_FACTOR_DEFINITIONS = Object.freeze([
  {
    id: "seatInfra",
    rowNumber: 26,
    kind: "whole",
    label: "Seat & infra (USD/FTE/yr) [PA]",
    defaults: Object.freeze({
      onshoreUs: 6500,
      onshoreWEurope: 6000,
      nearshoreEEurope: 4500,
      nearshoreLatAm: 4000,
      offshoreIndia: 3600,
      offshorePhilippines: 3400,
    }),
  },
  {
    id: "wageInflation",
    rowNumber: 27,
    kind: "percent",
    label: "Wage inflation % / yr [MKT]",
    defaults: Object.freeze({
      onshoreUs: 0.035,
      onshoreWEurope: 0.03,
      nearshoreEEurope: 0.05,
      nearshoreLatAm: 0.04,
      offshoreIndia: 0.07,
      offshorePhilippines: 0.05,
    }),
  },
  {
    id: "attrition",
    rowNumber: 28,
    kind: "percent",
    label: "Attrition % [MKT]",
    defaults: Object.freeze({
      onshoreUs: 0.1,
      onshoreWEurope: 0.08,
      nearshoreEEurope: 0.12,
      nearshoreLatAm: 0.12,
      offshoreIndia: 0.18,
      offshorePhilippines: 0.15,
    }),
  },
]);

const TECHNOLOGY_COST_DEFINITIONS = Object.freeze([
  {
    id: "copilotLicense",
    rowNumber: 31,
    kind: "whole",
    label: "AI Copilot & Licence / user (USD/yr)",
    defaults: Object.freeze({
      conservative: 0,
      standard: 360,
      lean: 720,
      aggressiveAiFirst: 900,
      autonomousFinance: 1200,
    }),
  },
  {
    id: "platformBase",
    rowNumber: 32,
    kind: "whole",
    label: "Platform / Orchestration base (USD/yr)",
    defaults: Object.freeze({
      conservative: 0,
      standard: 10000,
      lean: 20000,
      aggressiveAiFirst: 35000,
      autonomousFinance: 60000,
    }),
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

function readWorkbookWholeNumberInput(workbookInputs, address, fallback = 0) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : fallback;
}
function readWorkbookDecimalInput(workbookInputs, address, fallback = 0) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? Math.max(0, round(numeric, 4)) : fallback;
}

function readWorkbookPercentInput(workbookInputs, address, fallback = 0) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.abs(numeric) > 1 ? numeric / 100 : numeric);
}

function readWorkbookChoiceInput(workbookInputs, address, options, fallback = "") {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }

  const text = trimValue(workbookInputs[address]);
  return options.includes(text) ? text : fallback;
}

function formatDecimalInput(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return Number.isInteger(numeric) ? String(numeric) : DECIMAL_FORMATTER.format(numeric);
}

function formatPercentValue(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

export function formatRateCardValue(value, format = "whole") {
  if (format === "percent0") {
    return formatPercentValue(value, 0);
  }

  if (format === "percent1") {
    return formatPercentValue(value, 1);
  }

  if (format === "decimal") {
    return formatDecimalInput(value);
  }

  return NUMBER_FORMATTER.format(Math.round(Number(value || 0)));
}

export function normalizeRateCardInputValue(kind, value) {
  const text = trimValue(value);

  if (!text) {
    return "";
  }

  if (kind === "choice") {
    return RATE_CARD_CONFIRM_OPTIONS.includes(text) ? text : null;
  }

  const numeric = parseNumericText(text, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (kind === "percent") {
    const normalized = Math.max(0, Math.abs(numeric) > 1 ? numeric / 100 : numeric);
    return String(round(normalized, 12));
  }

  if (kind === "decimal") {
    return String(round(Math.max(0, numeric), 4));
  }

  return String(Math.max(0, Math.round(numeric)));
}

export function formatRateCardInputValue(kind, value) {
  if (value === "") {
    return "";
  }

  if (kind === "choice") {
    return trimValue(value);
  }

  if (kind === "percent") {
    return formatRateCardValue(value, "percent1");
  }

  if (kind === "decimal") {
    return formatRateCardValue(value, "decimal");
  }

  return formatRateCardValue(value, "whole");
}

function buildBaseSalaryRows(workbookInputs) {
  return RATE_CARD_GRADES.map((grade) => ({
    ...grade,
    kind: "whole",
    values: Object.fromEntries(
      RATE_CARD_LOCATIONS.map((location) => {
        const address = `${location.column}${grade.baseRow}`;
        const fallback = BASE_SALARY_DEFAULTS[grade.id][location.id];
        return [location.id, { address, value: readWorkbookWholeNumberInput(workbookInputs, address, fallback) }];
      }),
    ),
  }));
}

function buildBenefitsLoadRow(workbookInputs) {
  return {
    id: "benefitsLoad",
    label: "Benefits & statutory load %",
    rowNumber: 15,
    kind: "percent",
    values: Object.fromEntries(
      RATE_CARD_LOCATIONS.map((location) => {
        const address = `${location.column}15`;
        return [location.id, { address, value: readWorkbookPercentInput(workbookInputs, address, BENEFITS_LOAD_DEFAULTS[location.id]) }];
      }),
    ),
  };
}

function buildLoadedCostRows(baseSalaryRows, benefitsLoadRow) {
  return baseSalaryRows.map((row) => ({
    id: row.id,
    bandCode: row.bandCode,
    label: row.label,
    rowNumber: row.loadedRow,
    kind: "whole",
    values: Object.fromEntries(
      RATE_CARD_LOCATIONS.map((location) => {
        const baseValue = row.values[location.id].value;
        const loadValue = benefitsLoadRow.values[location.id].value;
        const address = `${location.column}${row.loadedRow}`;
        return [location.id, { address, value: round(baseValue * (1 + loadValue), 12) }];
      }),
    ),
  }));
}
function buildLocationFactorRows(workbookInputs) {
  return LOCATION_FACTOR_DEFINITIONS.map((definition) => ({
    ...definition,
    values: Object.fromEntries(
      RATE_CARD_LOCATIONS.map((location) => {
        const address = `${location.column}${definition.rowNumber}`;
        const reader = definition.kind === "percent" ? readWorkbookPercentInput : readWorkbookWholeNumberInput;
        return [location.id, { address, value: reader(workbookInputs, address, definition.defaults[location.id]) }];
      }),
    ),
  }));
}

function buildTechnologyCostRows(workbookInputs) {
  return TECHNOLOGY_COST_DEFINITIONS.map((definition) => ({
    ...definition,
    values: Object.fromEntries(
      RATE_CARD_PERSONAS.map((persona) => {
        const address = `${persona.column}${definition.rowNumber}`;
        return [persona.id, { address, value: readWorkbookWholeNumberInput(workbookInputs, address, definition.defaults[persona.id]) }];
      }),
    ),
  }));
}

function buildSharedControls(workbookInputs) {
  return {
    backfillMultiplier: {
      id: "backfillMultiplier",
      label: "Backfill cost per leaver (x loaded annual) [PA]",
      rowNumber: 29,
      address: "C29",
      kind: "percent",
      value: readWorkbookPercentInput(workbookInputs, "C29", 0.25),
    },
    agentRunCost: {
      id: "agentRunCost",
      label: "Agent run cost (USD / agent-hour-equivalent) [PA]",
      rowNumber: 34,
      address: "C34",
      kind: "decimal",
      value: readWorkbookDecimalInput(workbookInputs, "C34", 6),
    },
    consumptionCost: {
      id: "consumptionCost",
      label: "Consumption (USD / 1k transactions; 0 = off)",
      rowNumber: 35,
      address: "C35",
      kind: "decimal",
      value: readWorkbookDecimalInput(workbookInputs, "C35", 0),
    },
    confirmation: {
      id: "confirmation",
      label: "Rate card confirmed by deal desk? (feeds 25/26)",
      rowNumber: 37,
      address: "C37",
      kind: "choice",
      value: readWorkbookChoiceInput(workbookInputs, "C37", RATE_CARD_CONFIRM_OPTIONS, "No"),
    },
  };
}

export function buildFpaRateCardWorkbookView({ workbookInputs = EMPTY_INPUTS } = {}) {
  const baseSalaryRows = buildBaseSalaryRows(workbookInputs);
  const benefitsLoadRow = buildBenefitsLoadRow(workbookInputs);
  const loadedCostRows = buildLoadedCostRows(baseSalaryRows, benefitsLoadRow);
  const locationFactorRows = buildLocationFactorRows(workbookInputs);
  const technologyCostRows = buildTechnologyCostRows(workbookInputs);
  const sharedControls = buildSharedControls(workbookInputs);

  return {
    ...FPA_RATE_CARD_SNAPSHOT,
    locations: RATE_CARD_LOCATIONS,
    grades: RATE_CARD_GRADES,
    personas: RATE_CARD_PERSONAS,
    baseSalaryRows,
    benefitsLoadRow,
    loadedCostRows,
    locationFactorRows,
    technologyCostRows,
    ...sharedControls,
  };
}
