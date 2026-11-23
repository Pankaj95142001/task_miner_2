import { buildP2pAiBenefitWorkbookView } from "./p2pAiBenefit";
import { buildP2pFteEngineWorkbookView } from "./p2pFteEngine";
import { buildP2pOpsModelWorkbookView } from "./p2pOpsModel";
import {
  P2P_PERSONA_LIBRARY_COLUMNS,
  P2P_PERSONA_LIBRARY_ROWS,
} from "./p2pPersonas";
import { buildP2pRateCardWorkbookView } from "./p2pRateCard";
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

export const P2P_COST_INSPECT_AUTO = "__AUTO__";

export const P2P_COST_SNAPSHOT = Object.freeze({
  sheetName: "P2P_12 Cost",
  title: "12. Cost-to-Serve - P2P annual by persona & year",
  note: "Labor carries layer wage inflation; attrition backfill, tech & AI run (incl. agent hours), governance pod, contingency. Y1 labor carries the learning-curve uplift.",
  formulaCount: 365,
  personaCount: 5,
  yearCount: 7,
  summaryMetricCount: 3,
  detailLineCount: 10,
});

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(P2P_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

const YEAR_HEADERS = Object.freeze([
  { key: "y1", label: "Y1" },
  { key: "y2", label: "Y2" },
  { key: "y3", label: "Y3" },
  { key: "y4", label: "Y4" },
  { key: "y5", label: "Y5" },
  { key: "y6", label: "Y6" },
  { key: "y7", label: "Y7" },
]);

const SUMMARY_ROW_DEFS = Object.freeze([
  {
    key: "costToServeY1",
    rowNumber: 7,
    label: "Cost-to-Serve Y1",
    format: "currency0",
    metricKey: "costToServeY1",
  },
  {
    key: "deliveryLaborY1",
    rowNumber: 8,
    label: "Delivery Labor Y1",
    format: "currency0",
    metricKey: "deliveryLaborY1",
  },
  {
    key: "blendedCostPerFteY1",
    rowNumber: 9,
    label: "Blended cost / FTE Y1",
    format: "currency2",
    metricKey: "blendedCostPerFteY1",
  },
]);

const DETAIL_LINE_DEFS = Object.freeze([
  { key: "totalFte", rowOffset: 0, label: "Total FTE", format: "number2" },
  { key: "blendedCostPerFte", rowOffset: 1, label: "Blended cost / FTE (wage-inflated)", format: "currency2" },
  { key: "deliveryLabor", rowOffset: 2, label: "Delivery labor", format: "currency0" },
  { key: "seatInfrastructure", rowOffset: 3, label: "Seat & infrastructure", format: "currency0" },
  { key: "attritionBackfill", rowOffset: 4, label: "Attrition & backfill", format: "currency0" },
  { key: "technologyAiRun", rowOffset: 5, label: "Technology & AI run", format: "currency0" },
  { key: "agentGovernancePod", rowOffset: 6, label: "Agent-governance pod", format: "currency0" },
  { key: "contingency", rowOffset: 7, label: "Contingency", format: "currency0" },
  { key: "overheadAllocation", rowOffset: 8, label: "Overhead allocation", format: "currency0" },
  { key: "costToServe", rowOffset: 9, label: "COST-TO-SERVE", format: "currency0", isTotal: true },
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

export function formatP2pCostValue(value, format = "currency0") {
  if (value === null || value === undefined || value === "") {
    return "-";
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
    case "number2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "whole":
    default:
      return INTEGER_FORMATTER.format(Math.round(numeric));
  }
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

  if (row.format === "text") {
    return trimValue(personaInputs[address]) || row.values[persona.key];
  }

  const numeric = parseNumericText(personaInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? numeric : row.values[persona.key];
}

function readDealMasterPercent(currentDeal, address, fieldName, fallback = 0) {
  const dealMasterInputs = currentDeal?.p2pWorkbookInputs?.["E2E Deal Master"]
    && typeof currentDeal.p2pWorkbookInputs["E2E Deal Master"] === "object"
    ? currentDeal.p2pWorkbookInputs["E2E Deal Master"]
    : EMPTY_INPUTS;

  const rawValue = Object.prototype.hasOwnProperty.call(dealMasterInputs, address)
    ? dealMasterInputs[address]
    : currentDeal?.[fieldName];

  const numeric = parseNumericText(rawValue, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, round(Math.abs(numeric) > 1 ? numeric / 100 : numeric, 12));
}

function buildPersonaAssumptions(personaInputs) {
  return P2P_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
    year1LearningCurvePct: readPersonaMetric(personaInputs, persona, "year1LearningCurvePct"),
    contingencyPct: readPersonaMetric(personaInputs, persona, "contingencyPct"),
    agentGovernancePodFte: readPersonaMetric(personaInputs, persona, "agentGovernancePodFte"),
  }));
}

function buildYearCells(values, format) {
  return YEAR_HEADERS.map((year, index) => {
    const value = values[index] || 0;
    return {
      key: year.key,
      label: year.label,
      value,
      text: formatP2pCostValue(value, format),
    };
  });
}

function buildFteYearTotalsByPersona(fteView) {
  return Object.fromEntries(
    P2P_PERSONA_LIBRARY_COLUMNS.map((persona, index) => {
      const totalRow = fteView.yearRows[(index * 2) + 1];
      return [
        persona.key,
        YEAR_HEADERS.map((_, yearIndex) => round(totalRow?.values?.[yearIndex]?.value || 0, 12)),
      ];
    }),
  );
}

function buildLayerFactorMap(opsView, groupId) {
  const factorGroup = opsView.layerFactorGroups.find((group) => group.id === groupId);
  return Object.fromEntries((factorGroup?.rows || []).map((row) => [row.layerId, row.value]));
}

function getPersonaFactorValue(opsView, rowId, personaId) {
  const row = opsView.personaFactorRows.find((item) => item.id === rowId);
  return round(Number(row?.values?.[personaId] || 0), 12);
}

function getPersonaLayerCost(opsView, layerId, personaId) {
  const row = opsView.personaLayerCostRows.find((item) => item.id === `${layerId}BlendedCost`);
  return round(Number(row?.values?.[personaId] || 0), 12);
}

function getTechnologyCostValue(rateCardView, rowId, personaId) {
  const row = rateCardView.technologyCostRows.find((item) => item.id === rowId);
  return round(Number(row?.values?.[personaId]?.value || 0), 12);
}

function buildPersonaSection({
  persona,
  personaIndex,
  totalFteByYear,
  aiPersona,
  opsView,
  rateCardView,
  corporateOverheadPct,
}) {
  const shoreMixByLayer = Object.fromEntries(
    opsView.shoreMixTable.rows.map((row) => [row.id, row.values[persona.key]?.value || 0]),
  );
  const wageInflationByLayer = buildLayerFactorMap(opsView, "wage");
  const blendedSeatCostPerFte = getPersonaFactorValue(opsView, "blendedSeatCostPerFte", persona.key);
  const blendedAttritionPct = getPersonaFactorValue(opsView, "blendedAttrition", persona.key);
  const nearshoreBlendedCost = getPersonaLayerCost(opsView, "nearshore", persona.key);
  const nearshoreWageInflationPct = wageInflationByLayer.nearshore || 0;
  const backfillMultiplier = Number(rateCardView.backfillMultiplier.value || 0);
  const agentRunCost = Number(rateCardView.agentRunCost.value || 0);
  const copilotLicense = getTechnologyCostValue(rateCardView, "copilotLicense", persona.key);
  const platformBase = getTechnologyCostValue(rateCardView, "platformBase", persona.key);
  const agentHoursAnnualisedByYear = YEAR_HEADERS.map((_, yearIndex) => (
    round(aiPersona?.summary?.agentHoursAnnualisedByYear?.[yearIndex] || 0, 12)
  ));

  const blendedCostPerFteByYear = YEAR_HEADERS.map((_, yearIndex) => round(
    opsView.layers.reduce((sum, layer) => {
      const shoreMix = shoreMixByLayer[layer.id] || 0;
      const baseLayerCost = getPersonaLayerCost(opsView, layer.id, persona.key);
      const wageInflation = wageInflationByLayer[layer.id] || 0;
      return sum + (shoreMix * baseLayerCost * ((1 + wageInflation) ** yearIndex));
    }, 0),
    12,
  ));

  const deliveryLaborByYear = totalFteByYear.map((totalFte, yearIndex) => round(
    totalFte
      * blendedCostPerFteByYear[yearIndex]
      * (yearIndex === 0 ? (1 + persona.year1LearningCurvePct) : 1),
    12,
  ));

  const seatInfrastructureByYear = totalFteByYear.map((totalFte) => round(
    totalFte * blendedSeatCostPerFte,
    12,
  ));

  const attritionBackfillByYear = totalFteByYear.map((totalFte, yearIndex) => round(
    totalFte * blendedAttritionPct * backfillMultiplier * blendedCostPerFteByYear[yearIndex],
    12,
  ));

  const technologyAiRunByYear = totalFteByYear.map((totalFte, yearIndex) => round(
    (copilotLicense * totalFte)
      + platformBase
      + (agentHoursAnnualisedByYear[yearIndex] * agentRunCost),
    12,
  ));

  const agentGovernancePodByYear = YEAR_HEADERS.map((_, yearIndex) => round(
    persona.agentGovernancePodFte * nearshoreBlendedCost * ((1 + nearshoreWageInflationPct) ** yearIndex),
    12,
  ));

  const preContingencySubtotalByYear = YEAR_HEADERS.map((_, yearIndex) => round(
    deliveryLaborByYear[yearIndex]
      + seatInfrastructureByYear[yearIndex]
      + attritionBackfillByYear[yearIndex]
      + technologyAiRunByYear[yearIndex]
      + agentGovernancePodByYear[yearIndex],
    12,
  ));

  const contingencyByYear = preContingencySubtotalByYear.map((value) => round(value * persona.contingencyPct, 12));
  const overheadAllocationByYear = preContingencySubtotalByYear.map((value) => round(value * corporateOverheadPct, 12));
  const costToServeByYear = YEAR_HEADERS.map((_, yearIndex) => round(
    preContingencySubtotalByYear[yearIndex]
      + contingencyByYear[yearIndex]
      + overheadAllocationByYear[yearIndex],
    12,
  ));

  const lineValuesByKey = {
    totalFte: totalFteByYear,
    blendedCostPerFte: blendedCostPerFteByYear,
    deliveryLabor: deliveryLaborByYear,
    seatInfrastructure: seatInfrastructureByYear,
    attritionBackfill: attritionBackfillByYear,
    technologyAiRun: technologyAiRunByYear,
    agentGovernancePod: agentGovernancePodByYear,
    contingency: contingencyByYear,
    overheadAllocation: overheadAllocationByYear,
    costToServe: costToServeByYear,
  };

  const detailStartRow = 13 + (personaIndex * 13);
  const sectionHeaderRow = 11 + (personaIndex * 13);
  const columnHeaderRow = 12 + (personaIndex * 13);
  const summaryRowNumber = 22 + (personaIndex * 13);

  const lines = DETAIL_LINE_DEFS.map((definition) => ({
    ...definition,
    rowNumber: detailStartRow + definition.rowOffset,
    values: buildYearCells(lineValuesByKey[definition.key], definition.format),
  }));

  return {
    key: persona.key,
    label: persona.label,
    workbookColumn: persona.workbookColumn,
    title: `Persona ${persona.index}: ${persona.label}`,
    sectionHeaderRow,
    columnHeaderRow,
    summaryRowNumber,
    lines,
    summary: {
      totalFteY1: totalFteByYear[0] || 0,
      blendedCostPerFteY1: blendedCostPerFteByYear[0] || 0,
      deliveryLaborY1: deliveryLaborByYear[0] || 0,
      technologyAiRunY1: technologyAiRunByYear[0] || 0,
      costToServeY1: costToServeByYear[0] || 0,
      costToServeY7: costToServeByYear[6] || 0,
    },
    drivers: {
      year1LearningCurvePct: persona.year1LearningCurvePct,
      contingencyPct: persona.contingencyPct,
      agentGovernancePodFte: persona.agentGovernancePodFte,
      corporateOverheadPct,
      backfillMultiplier,
      agentRunCost,
      copilotLicense,
      platformBase,
      blendedSeatCostPerFte,
      blendedAttritionPct,
      nearshoreBlendedCost,
      nearshoreWageInflationPct,
      rateCardConfirmed: rateCardView.confirmation.value,
    },
  };
}

export function buildP2pCostWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
  inspectPersonaId = P2P_COST_INSPECT_AUTO,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
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
  const aiWorkbookInputs = workbookInputs["P2P_08 AI Benefit"] && typeof workbookInputs["P2P_08 AI Benefit"] === "object"
    ? workbookInputs["P2P_08 AI Benefit"]
    : EMPTY_INPUTS;
  const opsWorkbookInputs = workbookInputs["P2P_09 Ops Model"] && typeof workbookInputs["P2P_09 Ops Model"] === "object"
    ? workbookInputs["P2P_09 Ops Model"]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs["P2P_10 Rate Card"] && typeof workbookInputs["P2P_10 Rate Card"] === "object"
    ? workbookInputs["P2P_10 Rate Card"]
    : EMPTY_INPUTS;

  const aiView = buildP2pAiBenefitWorkbookView({
    aiWorkbookInputs,
    benchmarkInputs,
    workloadInputs,
    personaInputs,
    workspace,
    currentDeal,
  });
  const fteView = buildP2pFteEngineWorkbookView({ currentDeal, workspace });
  const opsView = buildP2pOpsModelWorkbookView({
    opsWorkbookInputs,
    rateCardInputs,
  });
  const rateCardView = buildP2pRateCardWorkbookView({ workbookInputs: rateCardInputs });
  const personas = buildPersonaAssumptions(personaInputs);
  const aiPersonaMap = Object.fromEntries(aiView.personas.map((persona) => [persona.id, persona]));
  const fteYearTotalsByPersona = buildFteYearTotalsByPersona(fteView);
  const corporateOverheadPct = readDealMasterPercent(currentDeal, "D26", "corporateOverhead", 0);
  const recommendedPersonaId = normalizePersonaId(workspace?.opsModel?.selectedPersonaId || "standard");

  const personaSections = personas.map((persona, index) => buildPersonaSection({
    persona,
    personaIndex: index,
    totalFteByYear: fteYearTotalsByPersona[persona.key] || YEAR_HEADERS.map(() => 0),
    aiPersona: aiPersonaMap[persona.key],
    opsView,
    rateCardView,
    corporateOverheadPct,
  }));

  const selectedPersonaId = normalizePersonaId(
    inspectPersonaId === P2P_COST_INSPECT_AUTO ? recommendedPersonaId : inspectPersonaId,
  );
  const selectedPersona = personaSections.find((persona) => persona.key === selectedPersonaId) || personaSections[1] || personaSections[0];
  const recommendedPersona = personaSections.find((persona) => persona.key === recommendedPersonaId) || personaSections[1] || personaSections[0];

  const summaryRows = SUMMARY_ROW_DEFS.map((definition) => ({
    ...definition,
    values: personaSections.map((persona) => {
      const value = persona.summary[definition.metricKey] || 0;
      return {
        key: persona.key,
        label: persona.label,
        value,
        text: formatP2pCostValue(value, definition.format),
      };
    }),
  }));

  const personaCards = personaSections.map((persona) => ({
    key: persona.key,
    label: persona.label,
    value: persona.summary.costToServeY1,
    valueText: formatP2pCostValue(persona.summary.costToServeY1, "currency0"),
  }));

  return {
    ...P2P_COST_SNAPSHOT,
    corporateOverheadPct,
    rateCardConfirmation: rateCardView.confirmation.value,
    recommendedPersona,
    selectedPersona,
    personaHeaders: personaSections.map((persona) => ({
      key: persona.key,
      label: persona.label,
      workbookColumn: persona.workbookColumn,
    })),
    yearHeaders: YEAR_HEADERS,
    personaCards,
    summaryRows,
    personaSections,
  };
}

