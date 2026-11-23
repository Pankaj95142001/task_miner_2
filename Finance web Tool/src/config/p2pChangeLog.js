import { buildP2pCalibrationWorkbookView } from "./p2pCalibration";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "./p2pWorkspace";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const VERSION_HISTORY_ROWS = Object.freeze([
  {
    rowNumber: 5,
    version: "1.0",
    date: "16-Oct-2026",
    area: "P2P",
    change: "Discovery, scope L2, benchmark model, workload engine, complexity, personas, AI benefit",
    impact: "Baseline P2P sizing framework",
    owner: "SA",
  },
  {
    rowNumber: 6,
    version: "2.0",
    date: "22-Oct-2026",
    area: "P2P",
    change: "Ops model, rate card, FTE engine, cost, pricing, outcome, transition, business case, sensitivity, risk",
    impact: "Commercially usable tower",
    owner: "SA",
  },
  {
    rowNumber: 7,
    version: "3.0",
    date: "01-Nov-2026",
    area: "P2P",
    change: "Deal risks, recommend, client value, dashboard, trace log, governance, confidence, calibration",
    impact: "Audit-ready operating model",
    owner: "SA",
  },
  {
    rowNumber: 8,
    version: "4.0",
    date: "03-Nov-2026",
    area: "P2P",
    change: "Benchmark Pack and local-first portal parity for tabs 02-28",
    impact: "Instant-load tower workspace",
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
    action: "Calibrate volume baseline and driver norms [CC/PA]",
    tab: "02/04",
    registerRows: [58, 59],
  },
  {
    rowNumber: 14,
    action: "Validate addressability matrix and technology multipliers [PA]",
    tab: "08/04",
    registerRows: [60, 61],
  },
  {
    rowNumber: 15,
    action: "Lock shore mix, location blend, and transition build [PA]",
    tab: "09/15",
    registerRows: [62, 63],
  },
  {
    rowNumber: 16,
    action: "Confirm GM corridor, client baseline, and year-1 savings [PA/CC]",
    tab: "13/16/21",
    registerRows: [64, 65, 66],
  },
  {
    rowNumber: 17,
    action: "Approve scope exclusions, governance, and pricing lock [CC]",
    tab: "03/24",
    registerRows: [67, 68],
  },
]);

export const P2P_CHANGE_LOG_SNAPSHOT = Object.freeze({
  sheetName: "P2P_28 Change Log",
  title: "28. Change Log & Open Calibration Actions - P2P",
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
        : "Mirror of 26 rows pending",
      evidenceIds: aggregateText(linkedRows.map((row) => row.evidenceIds), ""),
    };
  });
}

function fallbackOwnerName(currentDeal) {
  return trimValue(currentDeal?.dealOwnerName) || trimValue(currentDeal?.presalesLead) || "Workspace Owner";
}

export function buildP2pChangeLogWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const calibrationView = buildP2pCalibrationWorkbookView({ currentDeal, workspace });
  const openActionRows = buildOpenActionRows(calibrationView.registerRows || []);
  const latestWorkbookRow = VERSION_HISTORY_ROWS[VERSION_HISTORY_ROWS.length - 1] || VERSION_HISTORY_ROWS[0];
  const latestSavedDecision = trimValue(workspace.changeLog?.lastDecision) || "Working draft";
  const latestSavedSummary = trimValue(workspace.changeLog?.latestChangeSummary) || "Current saved workspace version";
  const latestReviewer = trimValue(workspace.changeLog?.lastReviewer) || fallbackOwnerName(currentDeal);
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
      summary: trimValue(workspace.changeLog?.versionNote) || "Workspace initialized from the shared Deal Master shell.",
      decision: "Version 1 baseline",
    },
  ];

  return {
    ...P2P_CHANGE_LOG_SNAPSHOT,
    versionHistoryRows: VERSION_HISTORY_ROWS,
    latestWorkbookVersion: latestWorkbookRow?.version || "4.0",
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

