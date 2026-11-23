import { buildComplexityView } from "../components/FpaComplexityPage";
import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";
import { buildFpaWorkloadWorkbookView } from "./fpaWorkload";
import { createDefaultFpaWorkspace, normalizeFpaWorkspace } from "./fpaWorkspace";

const EMPTY_INPUTS = Object.freeze({});

const WORKLOAD_SHEET_NAME = "FPA_05 Workload";
const COMPLEXITY_SHEET_NAME = "FPA_06 Complexity";
export const TRACE_LOG_SHEET_NAME = "FPA_23 Trace Log";
export const TRACE_LOG_TITLE = "23. Traceability Log — FP&A: every override must land here";
export const TRACE_LOG_NOTE = "R19 turns RED if an override on 05/06 lacks a note; this log is the audit trail for deal review.";
export const TRACE_LOG_ENTRY_ROWS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const SHEET_ALIASES = {
  "05 workload": WORKLOAD_SHEET_NAME,
  workload: WORKLOAD_SHEET_NAME,
  "fpa 05 workload": WORKLOAD_SHEET_NAME,
  "fpa_05 workload": WORKLOAD_SHEET_NAME,
  "06 complexity": COMPLEXITY_SHEET_NAME,
  complexity: COMPLEXITY_SHEET_NAME,
  "fpa 06 complexity": COMPLEXITY_SHEET_NAME,
  "fpa_06 complexity": COMPLEXITY_SHEET_NAME,
};

function trimValue(value) {
  return String(value ?? "").trim();
}

function toNumberOrNaN(value) {
  const normalized = trimValue(value).replace(/,/g, "");
  if (!normalized) {
    return Number.NaN;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function trimTrailingZeros(value) {
  const text = String(value ?? "");

  if (!text.includes(".")) {
    return text;
  }

  return text.replace(/0+$/u, "").replace(/\.$/u, "");
}

function formatTraceNumber(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return trimTrailingZeros(numeric.toFixed(digits));
}

function toWorkbookCellMap(rows = []) {
  const cellMap = {};

  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      cellMap[cell.address] = cell;
    });
  });

  return cellMap;
}

function readWorkbookText(cellMap, address, fallback = "") {
  const cell = cellMap[address];
  const text = trimValue(cell?.text ?? cell?.raw ?? "");
  return text || fallback;
}

function canonicalSheetName(value) {
  const token = trimValue(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  return SHEET_ALIASES[token] || trimValue(value);
}

function normalizeLogKey(sheetName, cellAddress) {
  const sheetToken = canonicalSheetName(sheetName).toLowerCase();
  const cellToken = trimValue(cellAddress).toUpperCase();
  return `${sheetToken}|${cellToken}`;
}

function buildTraceRows(traceLogInputs = EMPTY_INPUTS) {
  return TRACE_LOG_ENTRY_ROWS.map((rowNumber) => {
    const row = {
      rowNumber,
      dateValue: trimValue(traceLogInputs[`B${rowNumber}`]),
      sheetValue: trimValue(traceLogInputs[`C${rowNumber}`]),
      cellValue: trimValue(traceLogInputs[`D${rowNumber}`]),
      originalValue: trimValue(traceLogInputs[`E${rowNumber}`]),
      overrideValue: trimValue(traceLogInputs[`F${rowNumber}`]),
      rationaleValue: trimValue(traceLogInputs[`G${rowNumber}`]),
      ownerValue: trimValue(traceLogInputs[`H${rowNumber}`]),
      approverValue: trimValue(traceLogInputs[`I${rowNumber}`]),
    };

    row.isBlank = !row.dateValue
      && !row.sheetValue
      && !row.cellValue
      && !row.originalValue
      && !row.overrideValue
      && !row.rationaleValue
      && !row.ownerValue
      && !row.approverValue;
    row.isCounted = row.overrideValue !== "";
    row.normalizedKey = row.sheetValue && row.cellValue ? normalizeLogKey(row.sheetValue, row.cellValue) : "";

    return row;
  });
}

function buildWorkloadOverrides({ currentDeal = {}, workspace, workbookInputs }) {
  const benchmarkInputs = workbookInputs["FPA_04 Benchmarks"] && typeof workbookInputs["FPA_04 Benchmarks"] === "object"
    ? workbookInputs["FPA_04 Benchmarks"]
    : EMPTY_INPUTS;
  const workloadInputs = workbookInputs[WORKLOAD_SHEET_NAME] && typeof workbookInputs[WORKLOAD_SHEET_NAME] === "object"
    ? workbookInputs[WORKLOAD_SHEET_NAME]
    : EMPTY_INPUTS;

  const workloadView = buildFpaWorkloadWorkbookView(workloadInputs, benchmarkInputs, workspace, currentDeal);
  const cellMap = toWorkbookCellMap(workloadView.rows);

  return Array.from({ length: 12 }, (_, index) => index + 14)
    .map((rowNumber) => {
      const overrideRaw = trimValue(workloadInputs[`I${rowNumber}`]);
      const overrideValue = toNumberOrNaN(overrideRaw);

      if (!Number.isFinite(overrideValue)) {
        return null;
      }

      return {
        key: normalizeLogKey(WORKLOAD_SHEET_NAME, `I${rowNumber}`),
        sheetName: WORKLOAD_SHEET_NAME,
        sheetLabel: "05 Workload",
        cellAddress: `I${rowNumber}`,
        workbookRow: rowNumber,
        sourceLabel: readWorkbookText(cellMap, `B${rowNumber}`, `Workload row ${rowNumber}`),
        originalValue: readWorkbookText(cellMap, `H${rowNumber}`),
        overrideValue: trimTrailingZeros(overrideRaw),
        rationaleValue: trimValue(workloadInputs[`J${rowNumber}`]),
        area: "Workload",
        typeLabel: "Hours override",
      };
    })
    .filter(Boolean);
}

function buildComplexityOverrides({ effectiveDiscovery, workbookInputs }) {
  const benchmarkInputs = workbookInputs["FPA_04 Benchmarks"] && typeof workbookInputs["FPA_04 Benchmarks"] === "object"
    ? workbookInputs["FPA_04 Benchmarks"]
    : EMPTY_INPUTS;
  const complexityInputs = workbookInputs[COMPLEXITY_SHEET_NAME] && typeof workbookInputs[COMPLEXITY_SHEET_NAME] === "object"
    ? workbookInputs[COMPLEXITY_SHEET_NAME]
    : EMPTY_INPUTS;
  const complexityView = buildComplexityView(complexityInputs, benchmarkInputs, effectiveDiscovery);

  return complexityView.rows
    .filter((row) => row.overrideApplied)
    .map((row) => ({
      key: normalizeLogKey(COMPLEXITY_SHEET_NAME, row.overrideAddress),
      sheetName: COMPLEXITY_SHEET_NAME,
      sheetLabel: "06 Complexity",
      cellAddress: row.overrideAddress,
      workbookRow: row.row,
      sourceLabel: row.label,
      originalValue: row.autoScoreLabel,
      overrideValue: row.overrideLabel || formatTraceNumber(row.finalScore),
      rationaleValue: row.rationaleText,
      area: "Complexity",
      typeLabel: "Score override",
    }));
}

export function buildFpaTraceLogWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
  traceLogInputsOverride = null,
} = {}) {
  const workspace = normalizeFpaWorkspace(workspaceValue || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const workbookInputs = currentDeal?.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
    ? currentDeal.fpaWorkbookInputs
    : EMPTY_INPUTS;
  const traceLogInputs = traceLogInputsOverride && typeof traceLogInputsOverride === "object"
    ? traceLogInputsOverride
    : workbookInputs[TRACE_LOG_SHEET_NAME] && typeof workbookInputs[TRACE_LOG_SHEET_NAME] === "object"
      ? workbookInputs[TRACE_LOG_SHEET_NAME]
      : EMPTY_INPUTS;

  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const detectedOverrides = [
    ...buildWorkloadOverrides({ currentDeal, workspace, workbookInputs }),
    ...buildComplexityOverrides({ effectiveDiscovery: discoveryMetrics.effectiveDiscovery, workbookInputs }),
  ];

  const logRows = buildTraceRows(traceLogInputs);
  const loggedRowMap = new Map();

  logRows.forEach((row) => {
    if (!row.normalizedKey) {
      return;
    }

    const entries = loggedRowMap.get(row.normalizedKey) || [];
    entries.push(row.rowNumber);
    loggedRowMap.set(row.normalizedKey, entries);
  });

  const normalizedOverrideKeys = new Set(detectedOverrides.map((item) => item.key));
  const overrides = detectedOverrides.map((item) => {
    const loggedRowNumbers = loggedRowMap.get(item.key) || [];

    return {
      ...item,
      isLogged: loggedRowNumbers.length > 0,
      loggedRowNumbers,
      sourceRationaleMissing: !item.rationaleValue,
    };
  });

  const matchedLoggedCount = overrides.filter((item) => item.isLogged).length;
  const sourceRationaleMissingCount = overrides.filter((item) => item.sourceRationaleMissing).length;
  const rowsLoggedAbove = logRows.filter((row) => row.isCounted).length;
  const overridesPresentCount = overrides.length;
  const unloggedOverrideCount = Math.max(0, overridesPresentCount - rowsLoggedAbove);
  const blankRowCount = logRows.filter((row) => row.isBlank).length;
  const firstEmptyRowNumber = logRows.find((row) => row.isBlank)?.rowNumber || null;
  const status = unloggedOverrideCount > 0 ? "AMBER — log every override before deal review" : "OK";

  const enrichedLogRows = logRows.map((row) => ({
    ...row,
    matchesActiveOverride: row.normalizedKey ? normalizedOverrideKeys.has(row.normalizedKey) : false,
  }));

  return {
    title: TRACE_LOG_TITLE,
    note: TRACE_LOG_NOTE,
    entryRowLimit: TRACE_LOG_ENTRY_ROWS.length,
    logRows: enrichedLogRows,
    overrides,
    overridesPresentCount,
    rowsLoggedAbove,
    unloggedOverrideCount,
    matchedLoggedCount,
    sourceRationaleMissingCount,
    blankRowCount,
    firstEmptyRowNumber,
    status,
  };
}
