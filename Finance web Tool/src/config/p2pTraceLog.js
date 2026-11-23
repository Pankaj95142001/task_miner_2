import { buildP2pComplexityView, P2P_COMPLEXITY_SHEET_NAME } from "../components/P2pComplexityPage";
import { buildP2pWorkloadModel } from "./p2pWorkload";
import { createDefaultP2pWorkspace, normalizeP2pWorkspace } from "./p2pWorkspace";

const EMPTY_INPUTS = Object.freeze({});

const WORKLOAD_SHEET_NAME = "P2P_05 Workload";
export const P2P_TRACE_LOG_SHEET_NAME = "P2P_23 Trace Log";
export const P2P_TRACE_LOG_TITLE = "23. Traceability Log - P2P: every override must land here";
export const P2P_TRACE_LOG_NOTE = "R19 turns RED if an override on 05/06 lacks a note; this log is the audit trail for deal review.";
export const P2P_TRACE_LOG_ENTRY_ROWS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const SHEET_ALIASES = {
  "05 workload": WORKLOAD_SHEET_NAME,
  workload: WORKLOAD_SHEET_NAME,
  "p2p 05 workload": WORKLOAD_SHEET_NAME,
  "p2p_05 workload": WORKLOAD_SHEET_NAME,
  "06 complexity": P2P_COMPLEXITY_SHEET_NAME,
  complexity: P2P_COMPLEXITY_SHEET_NAME,
  "p2p 06 complexity": P2P_COMPLEXITY_SHEET_NAME,
  "p2p_06 complexity": P2P_COMPLEXITY_SHEET_NAME,
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

function formatTraceNumber(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return trimTrailingZeros(numeric.toFixed(digits));
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
  return P2P_TRACE_LOG_ENTRY_ROWS.map((rowNumber) => {
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

function buildWorkloadOverrides({ currentDeal = {}, workspace }) {
  const workloadView = buildP2pWorkloadModel(workspace, currentDeal);

  return (workloadView.processRows || [])
    .map((row) => {
      if (row.overrideHours === null || row.overrideHours === undefined) {
        return null;
      }

      const workbookRow = 13 + Number(row.number || 0);

      return {
        key: normalizeLogKey(WORKLOAD_SHEET_NAME, `I${workbookRow}`),
        sheetName: WORKLOAD_SHEET_NAME,
        sheetLabel: "05 Workload",
        cellAddress: `I${workbookRow}`,
        workbookRow,
        sourceLabel: row.label,
        originalValue: formatTraceNumber(row.scopedHours, 1),
        overrideValue: formatTraceNumber(row.overrideHours, 1),
        rationaleValue: trimValue(row.overrideNote),
        area: "Workload",
        typeLabel: "Hours override",
      };
    })
    .filter(Boolean);
}

function buildComplexityOverrides({ workbookInputs, workspace }) {
  const complexityInputs = workbookInputs[P2P_COMPLEXITY_SHEET_NAME] && typeof workbookInputs[P2P_COMPLEXITY_SHEET_NAME] === "object"
    ? workbookInputs[P2P_COMPLEXITY_SHEET_NAME]
    : EMPTY_INPUTS;
  const complexityView = buildP2pComplexityView(complexityInputs, workspace);

  return (complexityView.rows || [])
    .filter((row) => row.overrideApplied)
    .map((row) => ({
      key: normalizeLogKey(P2P_COMPLEXITY_SHEET_NAME, row.overrideAddress),
      sheetName: P2P_COMPLEXITY_SHEET_NAME,
      sheetLabel: "06 Complexity",
      cellAddress: row.overrideAddress,
      workbookRow: row.row,
      sourceLabel: row.label,
      originalValue: row.autoScoreLabel,
      overrideValue: row.overrideLabel || formatTraceNumber(row.finalScore, 1),
      rationaleValue: row.rationaleText,
      area: "Complexity",
      typeLabel: "Score override",
    }));
}

export function buildP2pTraceLogWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
  traceLogInputsOverride = null,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : EMPTY_INPUTS;
  const traceLogInputs = traceLogInputsOverride && typeof traceLogInputsOverride === "object"
    ? traceLogInputsOverride
    : workbookInputs[P2P_TRACE_LOG_SHEET_NAME] && typeof workbookInputs[P2P_TRACE_LOG_SHEET_NAME] === "object"
      ? workbookInputs[P2P_TRACE_LOG_SHEET_NAME]
      : EMPTY_INPUTS;

  const detectedOverrides = [
    ...buildWorkloadOverrides({ currentDeal, workspace }),
    ...buildComplexityOverrides({ workbookInputs, workspace }),
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
  const status = unloggedOverrideCount > 0 ? "AMBER - log every override before deal review" : "OK";

  const enrichedLogRows = logRows.map((row) => ({
    ...row,
    matchesActiveOverride: row.normalizedKey ? normalizedOverrideKeys.has(row.normalizedKey) : false,
  }));

  return {
    title: P2P_TRACE_LOG_TITLE,
    note: P2P_TRACE_LOG_NOTE,
    entryRowLimit: P2P_TRACE_LOG_ENTRY_ROWS.length,
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
