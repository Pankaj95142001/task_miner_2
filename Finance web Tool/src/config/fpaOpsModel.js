const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const EMPTY_INPUTS = Object.freeze({});

export const FPA_OPS_MODEL_SNAPSHOT = Object.freeze({
  sheetName: "FPA_09 Ops Model",
  title: "09. Ops Model & Locations — FP&A shore mix, multi-location blend, pyramid",
  note: "Human layers only (agents costed on 12). Each layer blends up to two locations; persona tilt shifts the grade pyramid.",
  formulaCount: 88,
  editableCellCount: 105,
  personaCount: 5,
  layerCount: 3,
  gradeCount: 8,
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

export const FPA_OPS_MODEL_PERSONAS = Object.freeze([
  { id: "conservative", label: "Conservative", workbookColumn: "C" },
  { id: "standard", label: "Standard", workbookColumn: "D" },
  { id: "lean", label: "Lean", workbookColumn: "E" },
  { id: "aggressiveAiFirst", label: "Aggressive AI-First", workbookColumn: "F" },
  { id: "autonomousFinance", label: "Autonomous Finance", workbookColumn: "G" },
]);

export const FPA_OPS_MODEL_LAYERS = Object.freeze([
  {
    id: "onshore",
    label: "Onshore",
    shoreMixRow: 6,
    blendRow: 13,
    personaLayerCostRow: 57,
    factorRows: { wage: 62, seat: 66, attrition: 70 },
    shoreMixDefaults: {
      conservative: 0.3,
      standard: 0.22,
      lean: 0.17,
      aggressiveAiFirst: 0.13,
      autonomousFinance: 0.12,
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
      conservative: 0.25,
      standard: 0.2,
      lean: 0.15,
      aggressiveAiFirst: 0.12,
      autonomousFinance: 0.1,
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
      conservative: 0.45,
      standard: 0.58,
      lean: 0.68,
      aggressiveAiFirst: 0.75,
      autonomousFinance: 0.78,
    },
    blendDefaults: {
      location1: "Offshore - India",
      split1: 0.75,
      location2: "Offshore - Philippines",
      split2: 0.25,
    },
  },
]);

export const FPA_OPS_MODEL_GRADES = Object.freeze([
  { id: "associate", bandCode: "E0.1", label: "Associate", rateCardBaseRow: 6, loadedCostRow: 17 },
  { id: "srAssociate", bandCode: "E0.2", label: "Sr Associate", rateCardBaseRow: 7, loadedCostRow: 18 },
  { id: "analyst", bandCode: "E0.3", label: "Analyst", rateCardBaseRow: 8, loadedCostRow: 19 },
  { id: "leadAnalyst", bandCode: "E1", label: "Lead Analyst", rateCardBaseRow: 9, loadedCostRow: 20 },
  { id: "assistantManager", bandCode: "E2", label: "Assistant Manager/Deputy Manager", rateCardBaseRow: 10, loadedCostRow: 21 },
  { id: "manager", bandCode: "E3", label: "Manager/Senior Manager", rateCardBaseRow: 11, loadedCostRow: 22 },
  { id: "groupManager", bandCode: "E4", label: "Group Manager/ Assistant Manager", rateCardBaseRow: 12, loadedCostRow: 23 },
  { id: "deputyGeneralManager", bandCode: "E5", label: "Deputy General Manager/ General Manager", rateCardBaseRow: 13, loadedCostRow: 24 },
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
      associate: 5667,
      srAssociate: 8333,
      analyst: 13333,
      leadAnalyst: 22222,
      assistantManager: 33333,
      manager: 55556,
      groupManager: 77778,
      deputyGeneralManager: 111111,
    },
    benefitsLoadPct: 0.28,
    seatCost: 6500,
    wageInflationPct: 0.035,
    attritionPct: 0.1,
  },
  "Onshore - W.Europe": {
    baseCosts: {
      associate: 4250,
      srAssociate: 6250,
      analyst: 10000,
      leadAnalyst: 16667,
      assistantManager: 25000,
      manager: 41667,
      groupManager: 58333,
      deputyGeneralManager: 83333,
    },
    benefitsLoadPct: 0.28,
    seatCost: 6000,
    wageInflationPct: 0.03,
    attritionPct: 0.08,
  },
  "Nearshore - E.Europe": {
    baseCosts: {
      associate: 2338,
      srAssociate: 3438,
      analyst: 5500,
      leadAnalyst: 9167,
      assistantManager: 13750,
      manager: 22917,
      groupManager: 32083,
      deputyGeneralManager: 45833,
    },
    benefitsLoadPct: 0.25,
    seatCost: 4500,
    wageInflationPct: 0.05,
    attritionPct: 0.12,
  },
  "Nearshore - LatAm": {
    baseCosts: {
      associate: 2550,
      srAssociate: 3750,
      analyst: 6000,
      leadAnalyst: 10000,
      assistantManager: 15000,
      manager: 25000,
      groupManager: 35000,
      deputyGeneralManager: 50000,
    },
    benefitsLoadPct: 0.25,
    seatCost: 4000,
    wageInflationPct: 0.04,
    attritionPct: 0.12,
  },
  "Offshore - India": {
    baseCosts: {
      associate: 2833,
      srAssociate: 4167,
      analyst: 6667,
      leadAnalyst: 11111,
      assistantManager: 16667,
      manager: 27778,
      groupManager: 38889,
      deputyGeneralManager: 55556,
    },
    benefitsLoadPct: 0.22,
    seatCost: 3600,
    wageInflationPct: 0.07,
    attritionPct: 0.18,
  },
  "Offshore - Philippines": {
    baseCosts: {
      associate: 3060,
      srAssociate: 4500,
      analyst: 7200,
      leadAnalyst: 12000,
      assistantManager: 18000,
      manager: 30000,
      groupManager: 42000,
      deputyGeneralManager: 60000,
    },
    benefitsLoadPct: 0.22,
    seatCost: 3400,
    wageInflationPct: 0.05,
    attritionPct: 0.15,
  },
});

export const FPA_OPS_MODEL_TILTS = Object.freeze([
  {
    id: "senior",
    label: "Senior",
    workbookLabel: "Senior",
    startRow: 27,
    totalRow: 35,
    blendedCostRow: 73,
    defaults: {
      deputyGeneralManager: { onshore: 0.08, nearshore: 0, offshore: 0 },
      groupManager: { onshore: 0.12, nearshore: 0.03, offshore: 0 },
      manager: { onshore: 0.18, nearshore: 0.09, offshore: 0.06 },
      assistantManager: { onshore: 0.22, nearshore: 0.18, offshore: 0.12 },
      leadAnalyst: { onshore: 0.22, nearshore: 0.3, offshore: 0.22 },
      analyst: { onshore: 0.12, nearshore: 0.22, offshore: 0.28 },
      srAssociate: { onshore: 0.06, nearshore: 0.13, offshore: 0.2 },
      associate: { onshore: 0, nearshore: 0.05, offshore: 0.12 },
    },
  },
  {
    id: "standard",
    label: "Standard",
    workbookLabel: "Standard",
    startRow: 36,
    totalRow: 44,
    blendedCostRow: 74,
    defaults: {
      deputyGeneralManager: { onshore: 0.05, nearshore: 0, offshore: 0 },
      groupManager: { onshore: 0.1, nearshore: 0.02, offshore: 0 },
      manager: { onshore: 0.18, nearshore: 0.08, offshore: 0.04 },
      assistantManager: { onshore: 0.22, nearshore: 0.15, offshore: 0.08 },
      leadAnalyst: { onshore: 0.25, nearshore: 0.25, offshore: 0.18 },
      analyst: { onshore: 0.12, nearshore: 0.25, offshore: 0.26 },
      srAssociate: { onshore: 0.08, nearshore: 0.15, offshore: 0.24 },
      associate: { onshore: 0, nearshore: 0.1, offshore: 0.2 },
    },
  },
  {
    id: "junior",
    label: "Junior",
    workbookLabel: "Junior",
    startRow: 45,
    totalRow: 53,
    blendedCostRow: 75,
    defaults: {
      deputyGeneralManager: { onshore: 0.03, nearshore: 0, offshore: 0 },
      groupManager: { onshore: 0.07, nearshore: 0.01, offshore: 0 },
      manager: { onshore: 0.16, nearshore: 0.05, offshore: 0.02 },
      assistantManager: { onshore: 0.22, nearshore: 0.12, offshore: 0.05 },
      leadAnalyst: { onshore: 0.27, nearshore: 0.2, offshore: 0.13 },
      analyst: { onshore: 0.15, nearshore: 0.27, offshore: 0.22 },
      srAssociate: { onshore: 0.1, nearshore: 0.2, offshore: 0.28 },
      associate: { onshore: 0, nearshore: 0.15, offshore: 0.3 },
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
      const benefitsLoadPct = readWorkbookPercentInput(rateCardInputs, `${column}15`, defaults.benefitsLoadPct);
      const seatCost = readWorkbookWholeNumberInput(rateCardInputs, `${column}26`, defaults.seatCost);
      const wageInflationPct = readWorkbookPercentInput(rateCardInputs, `${column}27`, defaults.wageInflationPct);
      const attritionPct = readWorkbookPercentInput(rateCardInputs, `${column}28`, defaults.attritionPct);

      const baseCosts = Object.fromEntries(
        FPA_OPS_MODEL_GRADES.map((grade) => [
          grade.id,
          readWorkbookWholeNumberInput(
            rateCardInputs,
            `${column}${grade.rateCardBaseRow}`,
            defaults.baseCosts[grade.id],
          ),
        ]),
      );

      const loadedCosts = Object.fromEntries(
        FPA_OPS_MODEL_GRADES.map((grade) => [
          grade.id,
          round(baseCosts[grade.id] * (1 + benefitsLoadPct), 12),
        ]),
      );

      return [
        label,
        {
          label,
          column,
          baseCosts,
          benefitsLoadPct,
          loadedCosts,
          seatCost,
          wageInflationPct,
          attritionPct,
        },
      ];
    }),
  );
}

function buildShoreMixRows(opsWorkbookInputs) {
  const rows = FPA_OPS_MODEL_LAYERS.map((layer) => ({
    ...layer,
    values: Object.fromEntries(
      FPA_OPS_MODEL_PERSONAS.map((persona) => {
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
    FPA_OPS_MODEL_PERSONAS.map((persona) => [
      persona.id,
      round(rows.reduce((sum, row) => sum + row.values[persona.id].value, 0), 12),
    ]),
  );

  return { rows, totals, totalRowNumber: 9 };
}

function buildLocationBlendRows(opsWorkbookInputs) {
  return FPA_OPS_MODEL_LAYERS.map((layer) => {
    const rowNumber = layer.blendRow;
    const location1 = readWorkbookChoiceInput(opsWorkbookInputs, `C${rowNumber}`, OPS_LOCATION_OPTIONS, layer.blendDefaults.location1);
    const split1 = readWorkbookPercentInput(opsWorkbookInputs, `D${rowNumber}`, layer.blendDefaults.split1);
    const location2 = readWorkbookChoiceInput(opsWorkbookInputs, `E${rowNumber}`, OPS_LOCATION_OPTIONS, layer.blendDefaults.location2);
    const split2 = readWorkbookPercentInput(opsWorkbookInputs, `F${rowNumber}`, layer.blendDefaults.split2);
    const status = Math.abs((split1 + split2) - 1) > 0.001 ? "FIX — splits must total 100%" : "OK";

    return {
      ...layer,
      rowNumber,
      location1: { address: `C${rowNumber}`, value: location1 },
      split1: { address: `D${rowNumber}`, value: split1 },
      location2: { address: `E${rowNumber}`, value: location2 },
      split2: { address: `F${rowNumber}`, value: split2 },
      status: { address: `G${rowNumber}`, value: status },
    };
  });
}

function buildLoadedCostRows(locationBlendRows, rateCardProfiles) {
  return FPA_OPS_MODEL_GRADES.map((grade) => ({
    ...grade,
    values: Object.fromEntries(
      locationBlendRows.map((layerRow) => {
        const profile1 = rateCardProfiles[layerRow.location1.value] || rateCardProfiles[layerRow.blendDefaults?.location1] || rateCardProfiles[OPS_LOCATION_OPTIONS[0]];
        const profile2 = rateCardProfiles[layerRow.location2.value] || rateCardProfiles[layerRow.blendDefaults?.location2] || rateCardProfiles[OPS_LOCATION_OPTIONS[0]];
        const weightedCost = weightedBlend(
          layerRow.split1.value,
          profile1.loadedCosts[grade.id],
          layerRow.split2.value,
          profile2.loadedCosts[grade.id],
        );

        return [layerRow.id, weightedCost];
      }),
    ),
  }));
}

function buildTiltTables(opsWorkbookInputs) {
  return FPA_OPS_MODEL_TILTS.map((tilt) => {
    const rows = FPA_OPS_MODEL_GRADES.map((grade, index) => {
      const rowNumber = tilt.startRow + index;
      return {
        gradeId: grade.id,
        label: grade.label,
        rowNumber,
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
      FPA_OPS_MODEL_LAYERS.map((layer) => {
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
      FPA_OPS_MODEL_PERSONAS.map((persona) => {
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

  return FPA_OPS_MODEL_LAYERS.map((layer) => ({
    id: `${layer.id}BlendedCost`,
    label: `${layer.label} blended cost`,
    rowNumber: layer.personaLayerCostRow,
    values: Object.fromEntries(
      FPA_OPS_MODEL_PERSONAS.map((persona) => {
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
        workbookLabel: `${groupDef.title} — ${layerRow.label}`,
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
      FPA_OPS_MODEL_PERSONAS.map((persona) => {
        const shoreMixValues = Object.fromEntries(shoreMixTable.rows.map((row) => [row.id, row.values[persona.id].value]));

        let value = 0;

        if (definition.id === "blendedLoadedCostPerFte") {
          value = FPA_OPS_MODEL_LAYERS.reduce((sum, layer) => (
            sum + (shoreMixValues[layer.id] * personaLayerCostMap[`${layer.label} blended cost`].values[persona.id])
          ), 0);
        } else if (definition.id === "blendedSeatCostPerFte") {
          value = FPA_OPS_MODEL_LAYERS.reduce((sum, layer) => (
            sum + (shoreMixValues[layer.id] * factorValuesByGroup.seat[layer.id])
          ), 0);
        } else if (definition.id === "blendedWageInflation") {
          value = FPA_OPS_MODEL_LAYERS.reduce((sum, layer) => (
            sum + (shoreMixValues[layer.id] * factorValuesByGroup.wage[layer.id])
          ), 0);
        } else if (definition.id === "blendedAttrition") {
          value = FPA_OPS_MODEL_LAYERS.reduce((sum, layer) => (
            sum + (shoreMixValues[layer.id] * factorValuesByGroup.attrition[layer.id])
          ), 0);
        }

        return [persona.id, round(value, 12)];
      }),
    ),
  }));
}

export function formatOpsModelValue(value, format = "percent1") {
  if (format === "whole") {
    return NUMBER_FORMATTER.format(Math.round(Number(value || 0)));
  }

  if (format === "percent0") {
    return `${(Number(value || 0) * 100).toFixed(0)}%`;
  }

  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export function normalizeOpsModelInputValue(kind, value) {
  const text = trimValue(value);

  if (!text) {
    return "";
  }

  if (kind === "location") {
    return OPS_LOCATION_OPTIONS.includes(text) ? text : null;
  }

  if (kind === "tilt") {
    return OPS_TILT_OPTIONS.includes(text) ? text : null;
  }

  if (kind === "yesNo") {
    return OPS_YES_NO_OPTIONS.includes(text) ? text : null;
  }

  const numeric = parseNumericText(text, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const normalized = clamp(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 0, 1);
  return String(normalized);
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

export function buildFpaOpsModelWorkbookView({
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
    ...FPA_OPS_MODEL_SNAPSHOT,
    personas: FPA_OPS_MODEL_PERSONAS,
    layers: FPA_OPS_MODEL_LAYERS,
    grades: FPA_OPS_MODEL_GRADES,
    tilts: FPA_OPS_MODEL_TILTS,
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
