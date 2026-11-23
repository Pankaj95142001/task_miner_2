const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const EMPTY_INPUTS = Object.freeze({});

export const P2P_RATE_CARD_SNAPSHOT = Object.freeze({
  sheetName: "P2P_10 Rate Card",
  title: "10. Rate Card & Cost Factors - provider-neutral USD [MKT directional FY26] - P2P",
  note: "Calibrate to your cost book before first live use. Loaded = base x (1 + benefits load). The local P2P rate card mirrors the workbook rows directly.",
  formulaCount: 0,
  editableCellCount: 68,
  gradeCount: 6,
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
  { id: "director", bandCode: "DIR", label: "Director", baseRow: 6, loadedRow: 16 },
  { id: "seniorManager", bandCode: "SM", label: "Senior Manager", baseRow: 7, loadedRow: 17 },
  { id: "manager", bandCode: "MGR", label: "Manager", baseRow: 8, loadedRow: 18 },
  { id: "seniorAnalyst", bandCode: "SA", label: "Senior Analyst", baseRow: 9, loadedRow: 19 },
  { id: "analyst", bandCode: "AN", label: "Analyst", baseRow: 10, loadedRow: 20 },
  { id: "associateAnalyst", bandCode: "AA", label: "Associate Analyst", baseRow: 11, loadedRow: 21 },
]);

export const RATE_CARD_PERSONAS = Object.freeze([
  { id: "conservative", label: "Conservative", column: "C" },
  { id: "standard", label: "Standard", column: "D" },
  { id: "lean", label: "Lean", column: "E" },
  { id: "aggressiveAiFirst", label: "Aggressive AI-First", column: "F" },
  { id: "autonomousFinance", label: "Autonomous Finance", column: "G" },
]);

const BASE_SALARY_DEFAULTS = Object.freeze({
  director: Object.freeze({
    onshoreUs: 235000,
    onshoreWEurope: 205000,
    nearshoreEEurope: 110000,
    nearshoreLatAm: 98000,
    offshoreIndia: 65000,
    offshorePhilippines: 66000,
  }),
  seniorManager: Object.freeze({
    onshoreUs: 185000,
    onshoreWEurope: 160000,
    nearshoreEEurope: 82000,
    nearshoreLatAm: 72000,
    offshoreIndia: 42000,
    offshorePhilippines: 43000,
  }),
  manager: Object.freeze({
    onshoreUs: 145000,
    onshoreWEurope: 125000,
    nearshoreEEurope: 60000,
    nearshoreLatAm: 52000,
    offshoreIndia: 28000,
    offshorePhilippines: 29000,
  }),
  seniorAnalyst: Object.freeze({
    onshoreUs: 110000,
    onshoreWEurope: 95000,
    nearshoreEEurope: 42000,
    nearshoreLatAm: 36000,
    offshoreIndia: 16500,
    offshorePhilippines: 17500,
  }),
  analyst: Object.freeze({
    onshoreUs: 85000,
    onshoreWEurope: 72000,
    nearshoreEEurope: 30000,
    nearshoreLatAm: 26000,
    offshoreIndia: 11000,
    offshorePhilippines: 12000,
  }),
  associateAnalyst: Object.freeze({
    onshoreUs: 65000,
    onshoreWEurope: 55000,
    nearshoreEEurope: 22000,
    nearshoreLatAm: 18000,
    offshoreIndia: 7500,
    offshorePhilippines: 8500,
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
    rowNumber: 24,
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
    rowNumber: 25,
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
    rowNumber: 26,
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
  const text = trimValue(value).replace(/,/g, "").replace(/\$/g, "");
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
  return Number.isFinite(numeric) ? round(numeric, 4) : fallback;
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

export function formatRateCardValue(value, format = "whole") {
  const numeric = parseNumericText(value, Number.NaN);

  switch (format) {
    case "percent1":
      return Number.isFinite(numeric) ? `${(numeric * 100).toFixed(1)}%` : "-";
    case "decimal":
      return Number.isFinite(numeric) ? DECIMAL_FORMATTER.format(numeric) : "-";
    default:
      return Number.isFinite(numeric) ? NUMBER_FORMATTER.format(Math.round(numeric)) : "-";
  }
}

export function normalizeRateCardInputValue(kind, value) {
  if (kind === "choice") {
    const normalized = trimValue(value);
    return RATE_CARD_CONFIRM_OPTIONS.includes(normalized) ? normalized : null;
  }

  const numeric = parseNumericText(value, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (kind === "percent") {
    return String(Math.max(0, Math.abs(numeric) > 1 ? numeric / 100 : numeric));
  }

  if (kind === "decimal") {
    return String(round(numeric, 4));
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
    rowNumber: 13,
    kind: "percent",
    values: Object.fromEntries(
      RATE_CARD_LOCATIONS.map((location) => {
        const address = `${location.column}13`;
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
      rowNumber: 27,
      address: "C27",
      kind: "percent",
      value: readWorkbookPercentInput(workbookInputs, "C27", 0.25),
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

export function buildP2pRateCardWorkbookView({ workbookInputs = EMPTY_INPUTS } = {}) {
  const baseSalaryRows = buildBaseSalaryRows(workbookInputs);
  const benefitsLoadRow = buildBenefitsLoadRow(workbookInputs);
  const loadedCostRows = buildLoadedCostRows(baseSalaryRows, benefitsLoadRow);
  const locationFactorRows = buildLocationFactorRows(workbookInputs);
  const technologyCostRows = buildTechnologyCostRows(workbookInputs);
  const sharedControls = buildSharedControls(workbookInputs);

  return {
    ...P2P_RATE_CARD_SNAPSHOT,
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