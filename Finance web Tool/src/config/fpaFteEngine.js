import { buildFpaAiBenefitWorkbookView, FPA_AI_BENEFIT_MATRIX_ROWS } from "./fpaAiBenefit";
import { buildFpaBenchmarkWorkbookView } from "./fpaBenchmarks";
import {
  buildFpaOpsModelWorkbookView,
  FPA_OPS_MODEL_GRADES,
} from "./fpaOpsModel";
import {
  FPA_PERSONA_LIBRARY_COLUMNS,
  FPA_PERSONA_LIBRARY_ROWS,
} from "./fpaPersonas";
import { FPA_SCOPE_L2_ROWS } from "./fpaScope";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";
import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";

const EMPTY_INPUTS = Object.freeze({});
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_ONE_FORMATTER = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DECIMAL_TWO_FORMATTER = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const FPA_FTE_ENGINE_INSPECT_AUTO = "__AUTO__";

export const FPA_FTE_ENGINE_SNAPSHOT = Object.freeze({
  sheetName: "FPA_11 FTE Engine",
  title: "11. FTE Engine — FP&A steady state (all personas) & year grid (ramped)",
  note: "FTE = Hours × (1 - Net Reduction) ÷ Productive Capacity ÷ (1 - Shrinkage) × (1 + Buffer) × (1 + Backup); plus peak flex, supervision, and governance pod.",
  formulaCount: 285,
  processCount: 12,
  personaCount: 5,
  yearCount: 7,
  gradeCount: 8,
});

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);
const PERSONA_COLUMN_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => [persona.key, { ...persona, index: index + 1 }])),
);
const L2_SCOPE_MAP = Object.freeze(
  Object.fromEntries(FPA_SCOPE_L2_ROWS.map((row) => [row.id, row])),
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
const LAYER_HEADERS = Object.freeze([
  { key: "onshore", label: "Onshore" },
  { key: "nearshore", label: "Nearshore" },
  { key: "offshore", label: "Offshore" },
  { key: "total", label: "Total" },
  { key: "staffingView", label: "Staffing view (0.5 steps)" },
]);
const TILT_INDEX_MAP = Object.freeze({ Senior: 1, Standard: 2, Junior: 3 });
const CAPACITY_ROW_DEFS = Object.freeze([
  { key: "productiveCapacity", rowNumber: 6, label: "Productive Capacity (hrs/mo)", format: "decimal1" },
  { key: "shrinkagePct", rowNumber: 7, label: "Shrinkage %", format: "percent0" },
  { key: "managementBufferPct", rowNumber: 8, label: "Mgmt Buffer %", format: "percent0" },
  { key: "backupCrossSkillingPct", rowNumber: 9, label: "Backup %", format: "percent0" },
  { key: "peakUpliftPct", rowNumber: 10, label: "Peak Uplift %", format: "percent0" },
  { key: "peakMonthsPerYear", rowNumber: 11, label: "Peak Months", format: "whole" },
  { key: "spanOfControl", rowNumber: 12, label: "Span of Control", format: "whole" },
  { key: "agentGovernancePodFte", rowNumber: 13, label: "Governance Pod FTE", format: "decimal1" },
]);
const CLUSTER_ROW_DEFS = Object.freeze([
  { key: "P&F", rowNumber: 75, label: "P&F — Planning & Forecasting (min 2)" },
  { key: "R&A", rowNumber: 76, label: "R&A — Reporting & Analytics (min 2)" },
  { key: "BP&DS", rowNumber: 77, label: "BP&DS — Business Partnering & Decision Support (min 0.5, advisory)" },
  { key: "D&G", rowNumber: 78, label: "D&G — Data & Governance (min 0.5, advisory)" },
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

function createAddressMap(rows = []) {
  const cellMap = {};

  rows.forEach((row) => {
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    cells.forEach((cell) => {
      if (cell?.address) {
        cellMap[cell.address] = cell;
      }
    });
  });

  return cellMap;
}

function getCellNumber(cellMap, address, fallback = 0) {
  const numeric = parseNumericText(cellMap[address]?.text, Number.NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function formatFteValue(value, format = "whole") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  switch (format) {
    case "percent0":
      return `${Math.round(numeric * 100)}%`;
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    case "decimal1":
      return DECIMAL_ONE_FORMATTER.format(numeric);
    case "fte2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "whole":
    default:
      return INTEGER_FORMATTER.format(Math.round(numeric));
  }
}

function ceilToStep(value, step = 0.5) {
  if (!Number.isFinite(value) || step <= 0) {
    return 0;
  }

  return Math.ceil(value / step) * step;
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

function buildPersonaModels(personaInputs) {
  return FPA_PERSONA_LIBRARY_COLUMNS.map((persona) => {
    const workingDaysPerMonth = readPersonaMetric(personaInputs, persona, "workingDaysPerMonth");
    const workingHoursPerDay = readPersonaMetric(personaInputs, persona, "workingHoursPerDay");
    const utilisationPct = readPersonaMetric(personaInputs, persona, "utilisationPct");
    const trainingRampOverheadPct = readPersonaMetric(personaInputs, persona, "trainingRampOverheadPct");
    const shrinkagePct = readPersonaMetric(personaInputs, persona, "shrinkagePct");
    const managementBufferPct = readPersonaMetric(personaInputs, persona, "managementBufferPct");
    const backupCrossSkillingPct = readPersonaMetric(personaInputs, persona, "backupCrossSkillingPct");
    const peakUpliftPct = readPersonaMetric(personaInputs, persona, "peakUpliftPct");
    const peakMonthsPerYear = readPersonaMetric(personaInputs, persona, "peakMonthsPerYear");
    const spanOfControl = readPersonaMetric(personaInputs, persona, "spanOfControl");
    const agentGovernancePodFte = readPersonaMetric(personaInputs, persona, "agentGovernancePodFte");
    const productiveCapacity = workingDaysPerMonth * workingHoursPerDay * utilisationPct * (1 - trainingRampOverheadPct);
    const peakFlexFactor = peakUpliftPct * peakMonthsPerYear / 12;

    return {
      ...persona,
      index: PERSONA_COLUMN_MAP[persona.key].index,
      workingDaysPerMonth,
      workingHoursPerDay,
      utilisationPct,
      trainingRampOverheadPct,
      shrinkagePct,
      managementBufferPct,
      backupCrossSkillingPct,
      peakUpliftPct,
      peakMonthsPerYear,
      spanOfControl,
      agentGovernancePodFte,
      productiveCapacity,
      peakFlexFactor,
    };
  });
}

function buildPersonaCells(personas, format, getValue) {
  return personas.map((persona) => {
    const value = getValue(persona);
    return {
      key: persona.key,
      label: persona.label,
      workbookColumn: persona.workbookColumn,
      value,
      text: formatFteValue(value, format),
    };
  });
}

function calcDeliveryFte(monthlyHoursRemaining, persona) {
  if (!Number.isFinite(monthlyHoursRemaining) || monthlyHoursRemaining <= 0 || persona.productiveCapacity <= 0 || persona.spanOfControl <= 0) {
    return 0;
  }

  return round(
    monthlyHoursRemaining
      / persona.productiveCapacity
      / Math.max(0.0001, (1 - persona.shrinkagePct))
      * (1 + persona.managementBufferPct)
      * (1 + persona.backupCrossSkillingPct),
    12,
  );
}

function findAiProcessRow(aiPersona, processId) {
  return aiPersona?.processRows?.find((row) => row.id === processId) || null;
}

function buildHeadcountRows(selectedPersona, selectedTiltLabel, opsView, totalSteadyFte) {
  const shoreMixValues = Object.fromEntries(
    opsView.shoreMixTable.rows.map((row) => [row.id, row.values[selectedPersona.key]?.value || 0]),
  );
  const selectedTiltTable = opsView.tiltTables.find((tilt) => tilt.workbookLabel === selectedTiltLabel) || opsView.tiltTables[1] || opsView.tiltTables[0];

  const gradeRows = FPA_OPS_MODEL_GRADES.map((grade, index) => {
    const tiltRow = selectedTiltTable?.rows?.[index];
    const onshore = round(totalSteadyFte * shoreMixValues.onshore * (tiltRow?.values?.onshore?.value || 0), 12);
    const nearshore = round(totalSteadyFte * shoreMixValues.nearshore * (tiltRow?.values?.nearshore?.value || 0), 12);
    const offshore = round(totalSteadyFte * shoreMixValues.offshore * (tiltRow?.values?.offshore?.value || 0), 12);
    const total = round(onshore + nearshore + offshore, 12);
    const staffingView = ceilToStep(total, 0.5);

    return {
      rowNumber: 65 + index,
      label: grade.label,
      values: [
        { key: "onshore", label: "Onshore", value: onshore, text: formatFteValue(onshore, "fte2") },
        { key: "nearshore", label: "Nearshore", value: nearshore, text: formatFteValue(nearshore, "fte2") },
        { key: "offshore", label: "Offshore", value: offshore, text: formatFteValue(offshore, "fte2") },
        { key: "total", label: "Total", value: total, text: formatFteValue(total, "fte2") },
        { key: "staffingView", label: "Staffing view (0.5 steps)", value: staffingView, text: formatFteValue(staffingView, "decimal1") },
      ],
    };
  });

  const totalRow = {
    rowNumber: 71,
    label: "Total",
    isTotal: true,
    values: LAYER_HEADERS.map((header) => {
      const value = round(gradeRows.reduce((sum, row) => sum + (row.values.find((cell) => cell.key === header.key)?.value || 0), 0), 12);
      const format = header.key === "staffingView" ? "decimal1" : "fte2";
      return {
        key: header.key,
        label: header.label,
        value,
        text: formatFteValue(value, format),
      };
    }),
  };

  return gradeRows.concat(totalRow);
}

function buildStatusRows(personas, steadyTotalsByPersona, clusterTotalsByPersona, yearOneTotalsByPersona, peakMonthFactor) {
  return [
    {
      rowNumber: 80,
      label: "Floor check",
      values: personas.map((persona) => {
        const total = steadyTotalsByPersona[persona.key]?.totalSteady || 0;
        const pf = clusterTotalsByPersona[persona.key]?.["P&F"] || 0;
        const ra = clusterTotalsByPersona[persona.key]?.["R&A"] || 0;
        const bpds = clusterTotalsByPersona[persona.key]?.["BP&DS"] || 0;
        const dg = clusterTotalsByPersona[persona.key]?.["D&G"] || 0;
        const value = total < 5 || pf < 2 || ra < 2 ? "RED" : (bpds < 0.5 || dg < 0.5 ? "AMBER" : "OK");
        return { key: persona.key, label: persona.label, value, text: value };
      }),
    },
    {
      rowNumber: 81,
      label: "Peak coverage",
      values: personas.map((persona) => {
        const threshold = 1 + persona.peakUpliftPct;
        const value = peakMonthFactor > threshold + 0.1 ? "RED" : (peakMonthFactor > threshold + 0.001 ? "AMBER" : "OK");
        return { key: persona.key, label: persona.label, value, text: value };
      }),
    },
    {
      rowNumber: 82,
      label: "Y1 >= steady",
      values: personas.map((persona) => {
        const totalSteady = steadyTotalsByPersona[persona.key]?.totalSteady || 0;
        const totalY1 = yearOneTotalsByPersona[persona.key] || 0;
        const value = totalY1 >= totalSteady - 0.01 ? "OK" : "CHECK";
        return { key: persona.key, label: persona.label, value, text: value };
      }),
    },
  ];
}

export function buildFpaFteEngineWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
  inspectPersonaId = FPA_FTE_ENGINE_INSPECT_AUTO,
} = {}) {
  const workspace = normalizeFpaWorkspace(workspaceValue || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const workbookInputs = currentDeal?.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
    ? currentDeal.fpaWorkbookInputs
    : {};
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
  const benchmarkView = buildFpaBenchmarkWorkbookView(benchmarkInputs, discoveryMetrics.effectiveDiscovery);
  const benchmarkCellMap = createAddressMap(benchmarkView.rows);
  const aiView = buildFpaAiBenefitWorkbookView({
    aiWorkbookInputs,
    benchmarkInputs,
    workloadInputs,
    personaInputs,
    workspace,
    currentDeal,
  });
  const opsView = buildFpaOpsModelWorkbookView({
    opsWorkbookInputs,
    rateCardInputs,
  });
  const personas = buildPersonaModels(personaInputs);
  const aiPersonaMap = Object.fromEntries(aiView.personas.map((persona) => [persona.id, persona]));
  const recommendedPersonaId = normalizePersonaId(workspace?.opsModel?.selectedPersonaId || "standard");
  const selectedPersonaId = normalizePersonaId(inspectPersonaId === FPA_FTE_ENGINE_INSPECT_AUTO ? recommendedPersonaId : inspectPersonaId);
  const selectedPersona = personas.find((persona) => persona.key === selectedPersonaId) || personas[1] || personas[0];
  const peakMonthFactor = getCellNumber(benchmarkCellMap, "C114", 1);

  const capacityRows = CAPACITY_ROW_DEFS.map((definition) => ({
    ...definition,
    values: buildPersonaCells(personas, definition.format, (persona) => persona[definition.key]),
  }));

  const steadyTotalsByPersona = Object.fromEntries(personas.map((persona) => [persona.key, {
    deliverySteady: 0,
    peakFlex: 0,
    supervision: 0,
    governancePod: persona.agentGovernancePodFte,
    totalSteady: 0,
  }]));

  const clusterTotalsByPersona = Object.fromEntries(personas.map((persona) => [persona.key, { "P&F": 0, "R&A": 0, "BP&DS": 0, "D&G": 0 }]));

  const processRows = FPA_AI_BENEFIT_MATRIX_ROWS.map((definition, index) => {
    const scopeRow = L2_SCOPE_MAP[definition.id] || {};
    const monthlyHours = aiPersonaMap.conservative ? (findAiProcessRow(aiPersonaMap.conservative, definition.id)?.monthlyHours || 0) : 0;

    const values = personas.map((persona) => {
      const aiProcess = findAiProcessRow(aiPersonaMap[persona.key], definition.id);
      const remainingHours = monthlyHours * (1 - (aiProcess?.steady || 0));
      const value = calcDeliveryFte(remainingHours, persona);
      steadyTotalsByPersona[persona.key].deliverySteady = round(steadyTotalsByPersona[persona.key].deliverySteady + value, 12);
      clusterTotalsByPersona[persona.key][scopeRow.cluster || "P&F"] = round((clusterTotalsByPersona[persona.key][scopeRow.cluster || "P&F"] || 0) + value, 12);
      return {
        key: persona.key,
        label: persona.label,
        value,
        text: formatFteValue(value, "fte2"),
      };
    });

    return {
      id: definition.id,
      rowNumber: 20 + index,
      label: definition.label,
      cluster: scopeRow.cluster || "P&F",
      hours: monthlyHours,
      hoursText: formatFteValue(monthlyHours, "whole"),
      values,
    };
  });

  personas.forEach((persona) => {
    const summary = steadyTotalsByPersona[persona.key];
    summary.peakFlex = round(summary.deliverySteady * persona.peakFlexFactor, 12);
    summary.supervision = round(persona.spanOfControl > 0 ? summary.deliverySteady / persona.spanOfControl : 0, 12);
    summary.totalSteady = round(summary.deliverySteady + summary.peakFlex + summary.supervision + summary.governancePod, 12);
  });

  const summaryRows = [
    {
      rowNumber: 33,
      label: "Delivery FTE (steady)",
      values: buildPersonaCells(personas, "fte2", (persona) => steadyTotalsByPersona[persona.key].deliverySteady),
    },
    {
      rowNumber: 34,
      label: "Peak Flex FTE",
      values: buildPersonaCells(personas, "fte2", (persona) => steadyTotalsByPersona[persona.key].peakFlex),
    },
    {
      rowNumber: 35,
      label: "Supervision (span)",
      values: buildPersonaCells(personas, "fte2", (persona) => steadyTotalsByPersona[persona.key].supervision),
    },
    {
      rowNumber: 36,
      label: "Governance Pod",
      values: buildPersonaCells(personas, "fte2", (persona) => steadyTotalsByPersona[persona.key].governancePod),
    },
    {
      rowNumber: 37,
      label: "TOTAL FTE — steady",
      isTotal: true,
      values: buildPersonaCells(personas, "fte2", (persona) => steadyTotalsByPersona[persona.key].totalSteady),
    },
  ];

  const yearRows = [];
  const yearOneTotalsByPersona = {};

  personas.forEach((persona, index) => {
    const aiPersona = aiPersonaMap[persona.key];
    const deliveryByYear = YEAR_HEADERS.map((_, yearIndex) => {
      const remainingHours = aiPersona?.summary?.reducedHoursByYear?.[yearIndex] || 0;
      return calcDeliveryFte(remainingHours, persona);
    });
    const totalByYear = deliveryByYear.map((delivery) => round(
      delivery * (1 + persona.peakFlexFactor) + (persona.spanOfControl > 0 ? delivery / persona.spanOfControl : 0) + persona.agentGovernancePodFte,
      12,
    ));

    yearOneTotalsByPersona[persona.key] = totalByYear[0] || 0;

    yearRows.push({
      rowNumber: 42 + (index * 3),
      label: `${persona.label} — Delivery`,
      values: YEAR_HEADERS.map((year, yearIndex) => ({ key: year.key, label: year.label, value: deliveryByYear[yearIndex], text: formatFteValue(deliveryByYear[yearIndex], "fte2") })),
    });
    yearRows.push({
      rowNumber: 43 + (index * 3),
      label: `${persona.label} — TOTAL`,
      isTotal: true,
      values: YEAR_HEADERS.map((year, yearIndex) => ({ key: year.key, label: year.label, value: totalByYear[yearIndex], text: formatFteValue(totalByYear[yearIndex], "fte2") })),
    });
  });

  const selectedTiltLabel = opsView.personaTiltRow.values[selectedPersona.key]?.value || "Standard";
  const selectedTiltIndex = TILT_INDEX_MAP[selectedTiltLabel] || 2;
  const headcountRows = buildHeadcountRows(selectedPersona, selectedTiltLabel, opsView, steadyTotalsByPersona[selectedPersona.key].totalSteady);

  const clusterRows = CLUSTER_ROW_DEFS.map((definition) => ({
    ...definition,
    values: buildPersonaCells(personas, "fte2", (persona) => clusterTotalsByPersona[persona.key][definition.key] || 0),
  }));

  const statusRows = buildStatusRows(personas, steadyTotalsByPersona, clusterTotalsByPersona, yearOneTotalsByPersona, peakMonthFactor);

  return {
    ...FPA_FTE_ENGINE_SNAPSHOT,
    personas,
    recommendedPersona: personas.find((persona) => persona.key === recommendedPersonaId) || personas[1] || personas[0],
    selectedPersona: {
      ...selectedPersona,
      tiltLabel: selectedTiltLabel,
      tiltIndex: selectedTiltIndex,
      steadyTotal: steadyTotalsByPersona[selectedPersona.key].totalSteady,
      yearOneTotal: yearOneTotalsByPersona[selectedPersona.key] || 0,
      peakFlex: steadyTotalsByPersona[selectedPersona.key].peakFlex,
      supervision: steadyTotalsByPersona[selectedPersona.key].supervision,
      governancePod: steadyTotalsByPersona[selectedPersona.key].governancePod,
    },
    peakMonthFactor,
    peakMonthFactorText: formatFteValue(peakMonthFactor, "decimal1"),
    personaHeaders: personas.map((persona) => ({ key: persona.key, label: persona.label, workbookColumn: persona.workbookColumn })),
    yearHeaders: YEAR_HEADERS,
    layerHeaders: LAYER_HEADERS,
    capacityRows,
    processRows,
    summaryRows,
    yearRows,
    yearOneSummary: personas.map((persona) => ({
      key: persona.key,
      label: persona.label,
      value: yearOneTotalsByPersona[persona.key] || 0,
      text: formatFteValue(yearOneTotalsByPersona[persona.key] || 0, "fte2"),
    })),
    headcountRows,
    clusterRows,
    statusRows,
  };
}

