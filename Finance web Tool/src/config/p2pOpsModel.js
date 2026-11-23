const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const EMPTY_INPUTS = Object.freeze({});

export const P2P_OPS_MODEL_SNAPSHOT = Object.freeze({
  sheetName: "P2P_09 Ops Model",
  title: "09. Ops Model & Locations - P2P shore mix, multi-location blend, pyramid",
  note: "Human layers only (agents costed on 12). Each layer blends up to two locations; persona tilt shifts the grade pyramid.",
  formulaCount: 0,
  editableCellCount: 83,
  personaCount: 5,
  layerCount: 3,
  gradeCount: 6,
  tiltCount: 3,
});

export const OPS_LOCATION_OPTIONS = Object.freeze([
  "Onshore - US",
  "Onshore - W.Europe",
  "Nearshore - E.Europe",
  "Nearshore - LatAm",
  "Offshore - India",
  "Offshore - Philippines",
]);

export const OPS_TILT_OPTIONS = Object.freeze(["Senior", "Standard", "Junior"]);
export const OPS_YES_NO_OPTIONS = Object.freeze(["Yes", "No"]);

export const P2P_OPS_MODEL_PERSONAS = Object.freeze([
  { id: "conservative", label: "Conservative", workbookColumn: "C" },
  { id: "standard", label: "Standard", workbookColumn: "D" },
  { id: "lean", label: "Lean", workbookColumn: "E" },
  { id: "aggressiveAiFirst", label: "Aggressive AI-First", workbookColumn: "F" },
  { id: "autonomousFinance", label: "Autonomous Finance", workbookColumn: "G" },
]);

export const P2P_OPS_MODEL_LAYERS = Object.freeze([
  {
    id: "onshore",
    label: "Onshore",
    shoreMixRow: 6,
    blendRow: 13,
    personaLayerCostRow: 57,
    factorRows: { wage: 62, seat: 66, attrition: 70 },
    shoreMixDefaults: {
      conservative: 0.15,
      standard: 0.12,
      lean: 0.1,
      aggressiveAiFirst: 0.07,
      autonomousFinance: 0.06,
    },
    blendDefaults: {
      location1: "Onshore - US",
      split1: 1,
      location2: "Onshore - W.Europe",
      split2: 0,
    },
  },
  {
    id: "nearshore",
    label: "Nearshore",
    shoreMixRow: 7,
    blendRow: 14,
    personaLayerCostRow: 58,
    factorRows: { wage: 63, seat: 67, attrition: 71 },
    shoreMixDefaults: {
      conservative: 0.15,
      standard: 0.13,
      lean: 0.1,
      aggressiveAiFirst: 0.08,
      autonomousFinance: 0.06,
    },
    blendDefaults: {
      location1: "Nearshore - E.Europe",
      split1: 1,
      location2: "Nearshore - LatAm",
      split2: 0,
    },
  },
  {
    id: "offshore",
    label: "Offshore",
    shoreMixRow: 8,
    blendRow: 15,
    personaLayerCostRow: 59,
    factorRows: { wage: 64, seat: 68, attrition: 72 },
    shoreMixDefaults: {
      conservative: 0.7,
      standard: 0.75,
      lean: 0.8,
      aggressiveAiFirst: 0.85,
      autonomousFinance: 0.88,
    },
    blendDefaults: {
      location1: "Offshore - India",
      split1: 0.75,
      location2: "Offshore - Philippines",
      split2: 0.25,
    },
  },
]);

export const P2P_OPS_MODEL_GRADES = Object.freeze([
  { id: "director", bandCode: "DIR", label: "Director", rateCardBaseRow: 6, loadedCostRow: 16 },
  { id: "seniorManager", bandCode: "SM", label: "Senior Manager", rateCardBaseRow: 7, loadedCostRow: 17 },
  { id: "manager", bandCode: "MGR", label: "Manager", rateCardBaseRow: 8, loadedCostRow: 18 },
  { id: "seniorAnalyst", bandCode: "SA", label: "Senior Analyst", rateCardBaseRow: 9, loadedCostRow: 19 },
  { id: "analyst", bandCode: "AN", label: "Analyst", rateCardBaseRow: 10, loadedCostRow: 20 },
  { id: "associateAnalyst", bandCode: "AA", label: "Associate Analyst", rateCardBaseRow: 11, loadedCostRow: 21 },
]);

const RATE_CARD_LOCATION_COLUMNS = Object.freeze([
  { label: "Onshore - US", column: "C" },
  { label: "Onshore - W.Europe", column: "D" },
  { label: "Nearshore - E.Europe", column: "E" },
  { label: "Nearshore - LatAm", column: "F" },
  { label: "Offshore - India", column: "G" },
  { label: "Offshore - Philippines", column: "H" },
]);

const RATE_CARD_DEFAULTS = Object.freeze({
  "Onshore - US": {
    baseCosts: {
      director: 235000,
      seniorManager: 185000,
      manager: 145000,
      seniorAnalyst: 110000,
      analyst: 85000,
      associateAnalyst: 65000,
    },
    benefitsLoadPct: 0.28,
    seatCost: 6500,
    wageInflationPct: 0.035,
    attritionPct: 0.1,
  },
  "Onshore - W.Europe": {
    baseCosts: {
      director: 205000,
      seniorManager: 160000,
      manager: 125000,
      seniorAnalyst: 95000,
      analyst: 72000,
      associateAnalyst: 55000,
    },
    benefitsLoadPct: 0.28,
    seatCost: 6000,
    wageInflationPct: 0.03,
    attritionPct: 0.08,
  },
  "Nearshore - E.Europe": {
    baseCosts: {
      director: 110000,
      seniorManager: 82000,
      manager: 60000,
      seniorAnalyst: 42000,
      analyst: 30000,
      associateAnalyst: 22000,
    },
    benefitsLoadPct: 0.25,
    seatCost: 4500,
    wageInflationPct: 0.05,
    attritionPct: 0.12,
  },
  "Nearshore - LatAm": {
    baseCosts: {
      director: 98000,
      seniorManager: 72000,
      manager: 52000,
      seniorAnalyst: 36000,
      analyst: 26000,
      associateAnalyst: 18000,
    },
    benefitsLoadPct: 0.25,
    seatCost: 4000,
    wageInflationPct: 0.04,
    attritionPct: 0.12,
  },
  "Offshore - India": {
    baseCosts: {
      director: 65000,
      seniorManager: 42000,
      manager: 28000,
      seniorAnalyst: 16500,
      analyst: 11000,
      associateAnalyst: 7500,
    },
    benefitsLoadPct: 0.22,
    seatCost: 3600,
    wageInflationPct: 0.07,
    attritionPct: 0.18,
  },
  "Offshore - Philippines": {
    baseCosts: {
      director: 66000,
      seniorManager: 43000,
      manager: 29000,
      seniorAnalyst: 17500,
      analyst: 12000,
      associateAnalyst: 8500,
    },
    benefitsLoadPct: 0.22,
    seatCost: 3400,
    wageInflationPct: 0.05,
    attritionPct: 0.15,
  },
});

export const P2P_OPS_MODEL_TILTS = Object.freeze([
  {
    id: "senior",
    label: "Senior",
    workbookLabel: "Senior",
    startRow: 27,
    totalRow: 46,
    blendedCostRow: 51,
    defaults: {
      director: { onshore: 0.2, nearshore: 0, offshore: 0 },
      seniorManager: { onshore: 0.25, nearshore: 0.05, offshore: 0 },
      manager: { onshore: 0.35, nearshore: 0.2, offshore: 0.13 },
      seniorAnalyst: { onshore: 0.2, nearshore: 0.45, offshore: 0.22 },
      analyst: { onshore: 0, nearshore: 0.3, offshore: 0.45 },
      associateAnalyst: { onshore: 0, nearshore: 0, offshore: 0.2 },
    },
  },
  {
    id: "standard",
    label: "Standard",
    workbookLabel: "Standard",
    startRow: 33,
    totalRow: 47,
    blendedCostRow: 52,
    defaults: {
      director: { onshore: 0.15, nearshore: 0, offshore: 0 },
      seniorManager: { onshore: 0.25, nearshore: 0, offshore: 0 },
      manager: { onshore: 0.35, nearshore: 0.2, offshore: 0.08 },
      seniorAnalyst: { onshore: 0.25, nearshore: 0.45, offshore: 0.22 },
      analyst: { onshore: 0, nearshore: 0.35, offshore: 0.45 },
      associateAnalyst: { onshore: 0, nearshore: 0, offshore: 0.25 },
    },
  },
  {
    id: "junior",
    label: "Junior",
    workbookLabel: "Junior",
    startRow: 39,
    totalRow: 48,
    blendedCostRow: 53,
    defaults: {
      director: { onshore: 0.1, nearshore: 0, offshore: 0 },
      seniorManager: { onshore: 0.25, nearshore: 0, offshore: 0 },
      manager: { onshore: 0.35, nearshore: 0.15, offshore: 0.05 },
      seniorAnalyst: { onshore: 0.3, nearshore: 0.45, offshore: 0.2 },
      analyst: { onshore: 0, nearshore: 0.4, offshore: 0.45 },
      associateAnalyst: { onshore: 0, nearshore: 0, offshore: 0.3 },
    },
  },
]);

const PERSONA_TILT_DEFAULTS = Object.freeze({
  conservative: "Senior",
  standard: "Standard",
  lean: "Junior",
  aggressiveAiFirst: "Junior",
  autonomousFinance: "Junior",
});

const PERSONA_FACTOR_ROW_DEFS = Object.freeze([
  { id: "blendedLoadedCostPerFte", label: "Blended loaded cost / FTE", rowNumber: 76, format: "whole" },
  { id: "blendedSeatCostPerFte", label: "Blended seat cost / FTE", rowNumber: 77, format: "whole" },
  { id: "blendedWageInflation", label: "Blended wage inflation", rowNumber: 78, format: "percent1" },
  { id: "blendedAttrition", label: "Blended attrition", rowNumber: 79, format: "percent1" },
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

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value).replace(/,/g, "");
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

function readWorkbookPercentInput(workbookInputs, address, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }
  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1);
}

function readWorkbookWholeNumberInput(workbookInputs, address, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }
  const numeric = parseNumericText(workbookInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readWorkbookChoiceInput(workbookInputs, address, validOptions, fallback) {
  if (!Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
    return fallback;
  }
  const text = trimValue(workbookInputs[address]);
  return validOptions.includes(text) ? text : fallback;
}

function weightedBlend(split1, value1, split2, value2) {
  return round((split1 * value1) + (split2 * value2), 12);
}

function buildRateCardProfiles(rateCardInputs = EMPTY_INPUTS) {
  return Object.fromEntries(
    RATE_CARD_LOCATION_COLUMNS.map(({ label, column }) => {
      const defaults = RATE_CARD_DEFAULTS[label];
      const benefitsLoadPct = readWorkbookPercentInput(rateCardInputs, `${column}13`, defaults.benefitsLoadPct);
      const seatCost = readWorkbookWholeNumberInput(rateCardInputs, `${column}24`, defaults.seatCost);
      const wageInflationPct = readWorkbookPercentInput(rateCardInputs, `${column}25`, defaults.wageInflationPct);
      const attritionPct = readWorkbookPercentInput(rateCardInputs, `${column}26`, defaults.attritionPct);

      const baseCosts = Object.fromEntries(
        P2P_OPS_MODEL_GRADES.map((grade) => [
          grade.id,
          readWorkbookWholeNumberInput(
            rateCardInputs,
            `${column}${grade.rateCardBaseRow}`,
            defaults.baseCosts[grade.id],
          ),
        ]),
      );

      const loadedCosts = Object.fromEntries(
        P2P_OPS_MODEL_GRADES.map((grade) => [
          grade.id,
          round(baseCosts[grade.id] * (1 + benefitsLoadPct), 12),
        ]),
      );

      return [
        label,
        {
          ...defaults,
          baseCosts,
          loadedCosts,
          benefitsLoadPct,
          seatCost,
          wageInflationPct,
          attritionPct,
        },
      ];
    }),
  );
}

function buildShoreMixRows(opsWorkbookInputs) {
  const rows = P2P_OPS_MODEL_LAYERS.map((layer) => ({
    ...layer,
    values: Object.fromEntries(
      P2P_OPS_MODEL_PERSONAS.map((persona) => {
        const address = `${persona.workbookColumn}${layer.shoreMixRow}`;
        return [
          persona.id,
          {
            address,
            value: readWorkbookPercentInput(opsWorkbookInputs, address, layer.shoreMixDefaults[persona.id]),
          },
        ];
      }),
    ),
  }));

  const totals = Object.fromEntries(
    P2P_OPS_MODEL_PERSONAS.map((persona) => [
      persona.id,
      round(rows.reduce((sum, row) => sum + row.values[persona.id].value, 0), 12),
    ]),
  );

  return { rows, totals, totalRowNumber: 9 };
}

function buildLocationBlendRows(opsWorkbookInputs) {
  return P2P_OPS_MODEL_LAYERS.map((layer) => {
    const location1 = {
      address: `C${layer.blendRow}`,
      value: readWorkbookChoiceInput(opsWorkbookInputs, `C${layer.blendRow}`, OPS_LOCATION_OPTIONS, layer.blendDefaults.location1),
    };
    const split1 = {
      address: `D${layer.blendRow}`,
      value: readWorkbookPercentInput(opsWorkbookInputs, `D${layer.blendRow}`, layer.blendDefaults.split1),
    };
    const location2 = {
      address: `E${layer.blendRow}`,
      value: readWorkbookChoiceInput(opsWorkbookInputs, `E${layer.blendRow}`, OPS_LOCATION_OPTIONS, layer.blendDefaults.location2),
    };
    const split2 = {
      address: `F${layer.blendRow}`,
      value: readWorkbookPercentInput(opsWorkbookInputs, `F${layer.blendRow}`, layer.blendDefaults.split2),
    };
    const totalSplit = split1.value + split2.value;
    const status = Math.abs(totalSplit - 1) <= 0.001 ? "OK" : "FIX - splits must total 100%";

    return {
      ...layer,
      rowNumber: layer.blendRow,
      location1,
      split1,
      location2,
      split2,
      status,
    };
  });
}

function buildLoadedCostRows(locationBlendRows, rateCardProfiles) {
  return P2P_OPS_MODEL_GRADES.map((grade) => ({
    ...grade,
    kind: "whole",
    values: Object.fromEntries(
      P2P_OPS_MODEL_LAYERS.map((layer) => {
        const blend = locationBlendRows.find((item) => item.id === layer.id);
        const profile1 = rateCardProfiles[blend.location1.value] || rateCardProfiles[OPS_LOCATION_OPTIONS[0]];
        const profile2 = rateCardProfiles[blend.location2.value] || rateCardProfiles[OPS_LOCATION_OPTIONS[0]];
        return [
          layer.id,
          weightedBlend(
            blend.split1.value,
            profile1.loadedCosts[grade.id],
            blend.split2.value,
            profile2.loadedCosts[grade.id],
          ),
        ];
      }),
    ),
  }));
}

function buildTiltTables(opsWorkbookInputs) {
  return P2P_OPS_MODEL_TILTS.map((tilt) => {
    const rows = P2P_OPS_MODEL_GRADES.map((grade, index) => {
      const rowNumber = tilt.startRow + index;
      return {
        id: `${tilt.id}-${grade.id}`,
        rowNumber,
        gradeId: grade.id,
        bandCode: grade.bandCode,
        label: grade.label,
        values: {
          onshore: {
            address: `C${rowNumber}`,
            value: readWorkbookPercentInput(opsWorkbookInputs, `C${rowNumber}`, tilt.defaults[grade.id].onshore),
          },
          nearshore: {
            address: `D${rowNumber}`,
            value: readWorkbookPercentInput(opsWorkbookInputs, `D${rowNumber}`, tilt.defaults[grade.id].nearshore),
          },
          offshore: {
            address: `E${rowNumber}`,
            value: readWorkbookPercentInput(opsWorkbookInputs, `E${rowNumber}`, tilt.defaults[grade.id].offshore),
          },
        },
      };
    });

    const totals = {
      onshore: round(rows.reduce((sum, row) => sum + row.values.onshore.value, 0), 12),
      nearshore: round(rows.reduce((sum, row) => sum + row.values.nearshore.value, 0), 12),
      offshore: round(rows.reduce((sum, row) => sum + row.values.offshore.value, 0), 12),
    };

    return {
      ...tilt,
      rows,
      totals,
    };
  });
}

function buildBlendedCostByTiltRows(tiltTables, loadedCostRows) {
  const loadedCostMap = Object.fromEntries(loadedCostRows.map((row) => [row.id, row]));

  return tiltTables.map((tiltTable) => ({
    id: tiltTable.id,
    label: tiltTable.label,
    workbookLabel: tiltTable.workbookLabel,
    rowNumber: tiltTable.blendedCostRow,
    values: Object.fromEntries(
      P2P_OPS_MODEL_LAYERS.map((layer) => {
        const weightedCost = tiltTable.rows.reduce((sum, row) => (
          sum + (row.values[layer.id].value * loadedCostMap[row.gradeId].values[layer.id])
        ), 0);
        return [layer.id, round(weightedCost, 12)];
      }),
    ),
  }));
}

function buildPersonaTiltRow(opsWorkbookInputs) {
  return {
    rowNumber: 56,
    values: Object.fromEntries(
      P2P_OPS_MODEL_PERSONAS.map((persona) => {
        const address = `${persona.workbookColumn}56`;
        return [
          persona.id,
          {
            address,
            value: readWorkbookChoiceInput(opsWorkbookInputs, address, OPS_TILT_OPTIONS, PERSONA_TILT_DEFAULTS[persona.id]),
          },
        ];
      }),
    ),
  };
}

function buildPersonaLayerCostRows(blendedCostByTiltRows, personaTiltRow) {
  const blendedCostByTiltLabel = Object.fromEntries(blendedCostByTiltRows.map((row) => [row.workbookLabel, row]));

  return P2P_OPS_MODEL_LAYERS.map((layer) => ({
    id: `${layer.id}BlendedCost`,
    label: `${layer.label} blended cost`,
    rowNumber: layer.personaLayerCostRow,
    values: Object.fromEntries(
      P2P_OPS_MODEL_PERSONAS.map((persona) => {
        const selectedTilt = personaTiltRow.values[persona.id].value;
        const blendedRow = blendedCostByTiltLabel[selectedTilt] || blendedCostByTiltRows[0];
        return [persona.id, blendedRow.values[layer.id]];
      }),
    ),
  }));
}

function buildLayerFactorGroups(locationBlendRows, rateCardProfiles) {
  const groupDefs = [
    { id: "wage", title: "Wage inflation", property: "wageInflationPct", format: "percent1" },
    { id: "seat", title: "Seat cost", property: "seatCost", format: "whole" },
    { id: "attrition", title: "Attrition", property: "attritionPct", format: "percent1" },
  ];

  const groups = groupDefs.map((groupDef) => ({
    ...groupDef,
    rows: locationBlendRows.map((layerRow) => {
      const profile1 = rateCardProfiles[layerRow.location1.value] || rateCardProfiles[OPS_LOCATION_OPTIONS[0]];
      const profile2 = rateCardProfiles[layerRow.location2.value] || rateCardProfiles[OPS_LOCATION_OPTIONS[0]];
      const value = weightedBlend(
        layerRow.split1.value,
        profile1[groupDef.property],
        layerRow.split2.value,
        profile2[groupDef.property],
      );

      return {
        id: `${groupDef.id}-${layerRow.id}`,
        layerId: layerRow.id,
        label: layerRow.label,
        workbookLabel: `${groupDef.title} - ${layerRow.label}`,
        rowNumber: layerRow.factorRows[groupDef.id],
        value,
      };
    }),
  }));

  const valuesByGroup = Object.fromEntries(
    groups.map((group) => [
      group.id,
      Object.fromEntries(group.rows.map((row) => [row.layerId, row.value])),
    ]),
  );

  return { groups, valuesByGroup };
}

function buildPersonaFactorRows(shoreMixTable, personaLayerCostRows, factorValuesByGroup) {
  const personaLayerCostMap = Object.fromEntries(personaLayerCostRows.map((row) => [row.label, row]));

  return PERSONA_FACTOR_ROW_DEFS.map((definition) => ({
    ...definition,
    values: Object.fromEntries(
      P2P_OPS_MODEL_PERSONAS.map((persona) => {
        const shoreMixValues = Object.fromEntries(shoreMixTable.rows.map((row) => [row.id, row.values[persona.id].value]));

        let value = 0;
        if (definition.id === "blendedLoadedCostPerFte") {
          value = P2P_OPS_MODEL_LAYERS.reduce((sum, layer) => (
            sum + (shoreMixValues[layer.id] * personaLayerCostMap[`${layer.label} blended cost`].values[persona.id])
          ), 0);
        } else if (definition.id === "blendedSeatCostPerFte") {
          value = P2P_OPS_MODEL_LAYERS.reduce((sum, layer) => sum + (shoreMixValues[layer.id] * factorValuesByGroup.seat[layer.id]), 0);
        } else if (definition.id === "blendedWageInflation") {
          value = P2P_OPS_MODEL_LAYERS.reduce((sum, layer) => sum + (shoreMixValues[layer.id] * factorValuesByGroup.wage[layer.id]), 0);
        } else if (definition.id === "blendedAttrition") {
          value = P2P_OPS_MODEL_LAYERS.reduce((sum, layer) => sum + (shoreMixValues[layer.id] * factorValuesByGroup.attrition[layer.id]), 0);
        }

        return [persona.id, round(value, 12)];
      }),
    ),
  }));
}

export function formatOpsModelValue(value, format = "percent1") {
  switch (format) {
    case "whole":
      return NUMBER_FORMATTER.format(Math.round(Number(value || 0)));
    case "percent1":
      return `${(Number(value || 0) * 100).toFixed(1)}%`;
    default:
      return String(value ?? "-");
  }
}

export function normalizeOpsModelInputValue(kind, value) {
  if (kind === "location") {
    return OPS_LOCATION_OPTIONS.includes(trimValue(value)) ? trimValue(value) : null;
  }
  if (kind === "tilt") {
    return OPS_TILT_OPTIONS.includes(trimValue(value)) ? trimValue(value) : null;
  }
  if (kind === "yesNo") {
    return OPS_YES_NO_OPTIONS.includes(trimValue(value)) ? trimValue(value) : null;
  }

  const numeric = parseNumericText(value, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return String(clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1));
}

export function formatOpsModelInputValue(kind, value) {
  if (value === "") {
    return "";
  }
  if (kind === "location" || kind === "tilt" || kind === "yesNo") {
    return trimValue(value);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return `${(numeric * 100).toFixed(1)}%`;
}

export function buildP2pOpsModelWorkbookView({
  opsWorkbookInputs = EMPTY_INPUTS,
  rateCardInputs = EMPTY_INPUTS,
} = {}) {
  const rateCardProfiles = buildRateCardProfiles(rateCardInputs);
  const shoreMixTable = buildShoreMixRows(opsWorkbookInputs);
  const locationBlendRows = buildLocationBlendRows(opsWorkbookInputs);
  const loadedCostRows = buildLoadedCostRows(locationBlendRows, rateCardProfiles);
  const tiltTables = buildTiltTables(opsWorkbookInputs);
  const blendedCostByTiltRows = buildBlendedCostByTiltRows(tiltTables, loadedCostRows);
  const personaTiltRow = buildPersonaTiltRow(opsWorkbookInputs);
  const personaLayerCostRows = buildPersonaLayerCostRows(blendedCostByTiltRows, personaTiltRow);
  const { groups: layerFactorGroups, valuesByGroup: layerFactorValues } = buildLayerFactorGroups(locationBlendRows, rateCardProfiles);
  const personaFactorRows = buildPersonaFactorRows(shoreMixTable, personaLayerCostRows, layerFactorValues);
  const languageCoverage = {
    rowNumber: 82,
    address: "C82",
    value: readWorkbookChoiceInput(opsWorkbookInputs, "C82", OPS_YES_NO_OPTIONS, "Yes"),
  };

  return {
    ...P2P_OPS_MODEL_SNAPSHOT,
    personas: P2P_OPS_MODEL_PERSONAS,
    layers: P2P_OPS_MODEL_LAYERS,
    grades: P2P_OPS_MODEL_GRADES,
    tilts: P2P_OPS_MODEL_TILTS,
    shoreMixTable,
    locationBlendRows,
    rateCardProfiles,
    loadedCostRows,
    tiltTables,
    blendedCostByTiltRows,
    personaTiltRow,
    personaLayerCostRows,
    layerFactorGroups,
    personaFactorRows,
    languageCoverage,
  };
}