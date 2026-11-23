import { buildFpaCalibrationWorkbookView } from "./fpaCalibration";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const VERSION_HISTORY_ROWS = Object.freeze([
  {
    rowNumber: 5,
    version: "3.0",
    date: "18-Jul-2026",
    area: "FP&A",
    change: "Driver sizing, addressability engine, multiyear economics, FAO constructs",
    impact: "Baseline framework",
    owner: "SA",
  },
  {
    rowNumber: 6,
    version: "4.0",
    date: "10-Sep-2026",
    area: "FP&A",
    change: "Tech-stack discovery D, customer-FTE reconciliation, confidence / calibration / benchmark pack, L3 business view, dashboard matrix, LOGIC & DICT",
    impact: "Audit-grade FP&A",
    owner: "SA",
  },
  {
    rowNumber: 7,
    version: "5.0",
    date: "11-Sep-2026",
    area: "E2E",
    change: "Framework replicated to RTR / O2C / P2P (FP&A tower instance) with shared E2E Deal Master and Finance-wide consolidation layer",
    impact: "Four towers + Finance",
    owner: "SA",
  },
  {
    rowNumber: 8,
    version: "6.0",
    date: "14-Sep-2026",
    area: "E2E v6",
    change: "Gap closure layer: Evidence Register, Calibration Closure, Value Classes, Override Lifecycle, SLA Exposure, Tax/FX/Entity, Shared Platform, Transition",
    impact: "Ten gaps baked in",
    owner: "SA",
  },
]);

const OPEN_ACTION_ROW_DEFS = Object.freeze([
  {
    rowNumber: 12,
    action: "Confirm rate card with deal desk [MKT]",
    tab: "10",
    registerRows: [57],
  },
  {
    rowNumber: 13,
    action: "Calibrate driver norms & band seeds to delivery evidence [PA]",
    tab: "04",
    registerRows: [58, 59],
  },
  {
    rowNumber: 14,
    action: "Validate addressability matrix with automation CoE [PA]",
    tab: "08",
    registerRows: [60],
  },
  {
    rowNumber: 15,
    action: "Confirm technology multipliers with architecture [PA]",
    tab: "04",
    registerRows: [61],
  },
  {
    rowNumber: 16,
    action: "Attach licensed sources to 27 Benchmark Pack [BM]",
    tab: "27",
    registerRows: [62, 66],
  },
  {
    rowNumber: 17,
    action: "Agree lever defendable ranges with delivery head [PA]",
    tab: "26",
    registerRows: [63],
  },
]);

export const FPA_CHANGE_LOG_SNAPSHOT = Object.freeze({
  sheetName: "FPA_28 Change Log",
  title: "28. Change Log & Open Calibration Actions  FP&A",
  note: "Workbook rows 5-8 preserve the framework release history; rows 12-17 track the open calibration actions that mirror the calibration closure register.",
  formulaCount: 0,
  versionHistoryCount: VERSION_HISTORY_ROWS.length,
  openActionCount: OPEN_ACTION_ROW_DEFS.length,
});

function trimValue(value) {
  return String(value ?? "").trim();
}

function normalizeStatusToken(value) {
  return trimValue(value).toUpperCase();
}

function formatIsoDate(value) {
  const text = trimValue(value);
  if (!text) {
    return "";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return DATE_FORMATTER.format(parsed);
}

function aggregateActionStatus(rows) {
  const tokens = rows
    .map((row) => normalizeStatusToken(row.status))
    .filter(Boolean);

  if (!tokens.length) {
    return "Open";
  }

  if (tokens.every((token) => ["CONFIRMED", "LOCKED"].includes(token))) {
    return "Confirmed";
  }

  if (tokens.some((token) => token === "OPEN")) {
    return "Open";
  }

  if (tokens.some((token) => token === "EVIDENCE ATTACHED")) {
    return "Evidence attached";
  }

  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length === 1) {
    const [token] = uniqueTokens;
    return token.charAt(0) + token.slice(1).toLowerCase();
  }

  return uniqueTokens.join(" / ");
}

function aggregateText(values, fallback = "") {
  const unique = [...new Set(values.map((value) => trimValue(value)).filter(Boolean))];

  if (!unique.length) {
    return fallback;
  }

  return unique.join(" / ");
}

function buildOpenActionRows(registerRows = []) {
  return OPEN_ACTION_ROW_DEFS.map((definition) => {
    const linkedRows = definition.registerRows
      .map((rowNumber) => registerRows.find((row) => row.rowNumber === rowNumber))
      .filter(Boolean);
    const status = aggregateActionStatus(linkedRows);

    return {
      ...definition,
      linkedRows,
      status,
      owner: aggregateText(linkedRows.map((row) => row.owner), ""),
      due: aggregateText(linkedRows.map((row) => row.targetDateText), ""),
      linkedRowText: linkedRows.length
        ? `Mirror of 26 rows ${linkedRows.map((row) => row.rowNumber).join(", ")}`
        : "Mirror of 26 D",
      evidenceIds: aggregateText(linkedRows.map((row) => row.evidenceIds), ""),
    };
  });
}

function fallbackOwnerName(currentDeal) {
  return trimValue(currentDeal?.dealOwnerName) || trimValue(currentDeal?.presalesLead) || "Workspace Owner";
}

export function formatChangeLogValue(value, format = "text") {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (format === "date") {
    return formatIsoDate(value);
  }

  return String(value);
}

export function buildFpaChangeLogWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeFpaWorkspace(workspaceValue || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const calibrationView = buildFpaCalibrationWorkbookView({ currentDeal, workspace });
  const openActionRows = buildOpenActionRows(calibrationView.registerRows || []);
  const latestWorkbookRow = VERSION_HISTORY_ROWS[VERSION_HISTORY_ROWS.length - 1] || VERSION_HISTORY_ROWS[0];
  const latestSavedDecision = trimValue(workspace.changeLog.lastDecision) || "Working draft";
  const latestSavedSummary = trimValue(workspace.changeLog.latestChangeSummary) || "Current saved workspace version";
  const latestReviewer = trimValue(workspace.changeLog.lastReviewer) || fallbackOwnerName(currentDeal);
  const openActionOpenCount = openActionRows.filter((row) => normalizeStatusToken(row.status) === "OPEN").length;
  const openActionEvidenceCount = openActionRows.filter((row) => normalizeStatusToken(row.status) === "EVIDENCE ATTACHED").length;
  const openActionConfirmedCount = openActionRows.filter((row) => ["CONFIRMED", "LOCKED"].includes(normalizeStatusToken(row.status))).length;

  const savedHistoryRows = [
    {
      key: "latest-save",
      when: currentDeal.updatedAt || currentDeal.createdAt || "",
      whenText: formatIsoDate(currentDeal.updatedAt || currentDeal.createdAt || ""),
      actor: latestReviewer,
      summary: latestSavedSummary,
      decision: latestSavedDecision,
    },
    {
      key: "baseline-save",
      when: currentDeal.createdAt || "",
      whenText: formatIsoDate(currentDeal.createdAt || ""),
      actor: fallbackOwnerName(currentDeal),
      summary: trimValue(workspace.changeLog.versionNote) || "Workspace initialized from the shared Deal Master shell.",
      decision: "Version 1 baseline",
    },
  ];

  return {
    ...FPA_CHANGE_LOG_SNAPSHOT,
    versionHistoryRows: VERSION_HISTORY_ROWS,
    latestWorkbookVersion: latestWorkbookRow?.version || "6.0",
    linkedRegisterMode: calibrationView.registerSourceMode,
    openActionRows,
    openActionOpenCount,
    openActionEvidenceCount,
    openActionConfirmedCount,
    latestSavedDecision,
    latestSavedSummary,
    latestReviewer,
    workspaceVersion: currentDeal?.version || 1,
    lastUpdatedText: formatIsoDate(currentDeal.updatedAt || currentDeal.createdAt || ""),
    savedHistoryRows,
  };
}
