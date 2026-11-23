import {
  countCompletedFpaGovernanceChecks,
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "../config/fpaWorkspace";
import {
  countPopulatedP2pLocalFields,
  countPopulatedP2pSheets,
  countPopulatedP2pWorkbookCells,
  createDefaultP2pWorkspace,
  deriveP2pWorkspaceStatus,
} from "../config/p2pWorkspace";
import { deriveFpaDiscoveryMetrics } from "../config/fpaDiscovery";
import { deriveFpaScopeMetrics } from "../config/fpaScope";
import { FPA_AI_BENEFIT_SNAPSHOT } from "../config/fpaAiBenefit";
import { FPA_BENCHMARK_WORKBOOK_SNAPSHOT } from "../config/fpaBenchmarks";
import { FPA_CLIENT_VALUE_SNAPSHOT } from "../config/fpaClientValue";
import { FPA_OPS_MODEL_SNAPSHOT } from "../config/fpaOpsModel";
import { FPA_OUTCOME_SNAPSHOT } from "../config/fpaOutcome";
import { FPA_PERSONA_LIBRARY_SNAPSHOT } from "../config/fpaPersonas";
import { FPA_PRICING_SNAPSHOT } from "../config/fpaPricing";
import { FPA_RATE_CARD_SNAPSHOT } from "../config/fpaRateCard";
import { FPA_RECOMMEND_SNAPSHOT } from "../config/fpaRecommend";
import { FPA_TRANSITION_SNAPSHOT } from "../config/fpaTransition";
import FPA_WORKLOAD_WORKBOOK_SNAPSHOT from "../config/fpaWorkloadWorkbookSnapshot";

const FPA_PROGRESS_SNAPSHOTS = [
  FPA_BENCHMARK_WORKBOOK_SNAPSHOT,
  FPA_WORKLOAD_WORKBOOK_SNAPSHOT,
  FPA_PERSONA_LIBRARY_SNAPSHOT,
  FPA_AI_BENEFIT_SNAPSHOT,
  FPA_OPS_MODEL_SNAPSHOT,
  FPA_RATE_CARD_SNAPSHOT,
  FPA_PRICING_SNAPSHOT,
  FPA_OUTCOME_SNAPSHOT,
  FPA_TRANSITION_SNAPSHOT,
  FPA_RECOMMEND_SNAPSHOT,
  FPA_CLIENT_VALUE_SNAPSHOT,
];

const FPA_PROGRESS_SHEETS = Array.from(
  new Map(
    FPA_PROGRESS_SNAPSHOTS
      .filter((snapshot) => snapshot?.sheetName)
      .map((snapshot) => [snapshot.sheetName, snapshot]),
  ).values(),
).filter((snapshot) => Number.isFinite(snapshot?.editableCellCount) && snapshot.editableCellCount > 0);

const TOWER_STATUS_PROGRESS = {
  "not started": 0,
  "discovery complete": 20,
  "in progress": 40,
  "ready for engine": 60,
  "in review": 80,
  "approved for submission": 90,
  submitted: 100,
  complete: 100,
  completed: 100,
  won: 100,
  lost: 100,
  archived: 100,
};

const FPA_SIDEBAR_PROGRESS_WEIGHTS = Object.freeze({
  dealSetup: 0.1,
  discovery: 0.3,
  scope: 0.3,
  workbook: 0.2,
  governance: 0.1,
});

function clampPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function countFilledRecordValues(record = {}) {
  if (!record || typeof record !== "object") {
    return 0;
  }

  return Object.values(record).filter((value) => {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === "boolean") {
      return value;
    }

    return String(value).trim() !== "";
  }).length;
}

function inferTowerStatusProgress(status) {
  return TOWER_STATUS_PROGRESS[String(status || "").trim().toLowerCase()] ?? 0;
}

function completionRatio(filled, total) {
  const numericFilled = Number(filled);
  const numericTotal = Number(total);

  if (!Number.isFinite(numericFilled) || !Number.isFinite(numericTotal) || numericTotal <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, numericFilled / numericTotal));
}

function workbookInputProgress(workbookInputs = {}) {
  return FPA_PROGRESS_SHEETS.reduce(
    (summary, snapshot) => {
      const total = summary.total + snapshot.editableCellCount;
      const sheetInputs = workbookInputs?.[snapshot.sheetName];
      const filled = sheetInputs && typeof sheetInputs === "object"
        ? Math.min(snapshot.editableCellCount, countFilledRecordValues(sheetInputs))
        : 0;

      return {
        total,
        filled: summary.filled + filled,
      };
    },
    { filled: 0, total: 0 },
  );
}

function workbookSheetProgressRatios(workbookInputs = {}) {
  return FPA_PROGRESS_SHEETS.map((snapshot) => {
    const sheetInputs = workbookInputs?.[snapshot.sheetName];
    const filled = sheetInputs && typeof sheetInputs === "object"
      ? Math.min(snapshot.editableCellCount, countFilledRecordValues(sheetInputs))
      : 0;

    return completionRatio(filled, snapshot.editableCellCount);
  });
}

export const STORAGE_KEY = "e2e-finance-portal.deal-master.v1";

export function nowIso() {
  return new Date().toISOString();
}

export function sanitizeDeal(deal) {
  if (!deal || typeof deal !== "object") {
    return deal;
  }

  const { colaRate: _deprecatedColaRate, ...nextDeal } = deal;
  return nextDeal;
}

export function createDefaultDeal(seed = 1, { currentUser = null, towerOwnersByCode = {} } = {}) {
  const stamp = Date.now() + seed;
  const ownerName = currentUser?.name || "Bid Owner";
  const ownerId = currentUser?.id || "user-bid-owner";
  const towerOwner = (code, fallbackName) => towerOwnersByCode[code] || { id: "", name: fallbackName };
  const fpaOwner = towerOwner("FPA", "FP&A Lead");
  const rtrOwner = towerOwner("RTR", "RTR Lead");
  const o2cOwner = towerOwner("O2C", "O2C Lead");
  const p2pOwner = towerOwner("P2P", "P2P Lead");

  return {
    id: `deal-${stamp}`,
    draftLabel: `Draft ${seed}`,
    clientName: "<Client Name>",
    dealId: `PRE-2026-E2E-${String(seed).padStart(3, "0")}`,
    programName: "Finance Transformation and Managed Services",
    presalesLead: ownerName,
    bidDate: "2026-09-30",
    dealStatus: "Draft",
    watermark: "INDICATIVE",
    contractTerm: "5",
    discountRate: "10",
    corporateOverhead: "0",
    displayCurrency: "USD",
    fxRate: "1",
    customerFinanceFte: "",
    financeCostBaseline: "",
    pricingConstruct: "FTE-based",
    transitionCommercials: "Separate fee",
    transformationFunding: "Provider-funded",
    benchmarkPolicy: "Auto",
    committedProdY2: "",
    committedProdY3: "",
    committedProdY4: "",
    notesTag: "Internal",
    towerScope_FPA: true,
    towerScope_RTR: true,
    towerScope_O2C: true,
    towerScope_P2P: true,
    towerLead_FPA: fpaOwner.name,
    towerLead_RTR: rtrOwner.name,
    towerLead_O2C: o2cOwner.name,
    towerLead_P2P: p2pOwner.name,
    towerOwnerUserId_FPA: fpaOwner.id,
    towerOwnerUserId_RTR: rtrOwner.id,
    towerOwnerUserId_O2C: o2cOwner.id,
    towerOwnerUserId_P2P: p2pOwner.id,
    towerStatus_FPA: "Not Started",
    towerStatus_RTR: "Not Started",
    towerStatus_O2C: "Not Started",
    towerStatus_P2P: "Not Started",
    fpaWorkspace: createDefaultFpaWorkspace(),
    fpaWorkbookInputs: {},
    p2pWorkspace: createDefaultP2pWorkspace(),
    p2pWorkbookInputs: {},
    dealOwnerUserId: ownerId,
    dealOwnerName: ownerName,
    documentIntake: {
      documents: [],
      latestRun: null,
      companyOverview: null,
      companyResearch: null,
      history: [],
      updatedAt: "",
      fieldMemory: {
        version: "v1",
        updatedAt: "",
        lastRunId: "",
        entries: [],
        summary: {
          fieldCount: 0,
          towerCount: 0,
          sectionCount: 0,
          updatedFieldCount: 0,
          statusCounts: {},
        },
      },
      logicBuilder: {
        version: "logic_builder_v2",
        updatedAt: "",
        lastRunId: "",
        documentRegister: [],
        chunkStore: [],
        factLedger: [],
        reviewQueue: {
          version: "logic_builder_v2",
          updatedAt: "",
          lastRunId: "",
          fields: [],
          summary: {
            fieldCount: 0,
            pendingCount: 0,
            populatedCount: 0,
            acceptedCount: 0,
            conflictCount: 0,
            highConfidenceCount: 0,
            towerCount: 0,
            sectionCount: 0,
            statusCounts: {},
          },
        },
        summary: {
          documentCount: 0,
          chunkCount: 0,
          factCount: 0,
          reviewFieldCount: 0,
          conflictFieldCount: 0,
          highConfidenceFieldCount: 0,
          towerCount: 0,
          sectionCount: 0,
        },
      },
    },
    collaborators: [],
    reviewNotes: "Compact starter draft created from the BRD-aligned Deal Master shell.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    accessRole: "owner",
    version: 1,
    members: [],
    towerWorkspaces: [],
  };
}

export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const starter = createDefaultDeal(1);
      return { deals: [starter], currentId: starter.id };
    }

    const parsed = JSON.parse(raw);
    const rawDeals = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.deals) ? parsed.deals : [];
    const deals = rawDeals.map((deal) => sanitizeDeal(deal));
    const currentId = Array.isArray(parsed) ? deals[0]?.id : parsed?.currentId || deals[0]?.id;

    if (!Array.isArray(deals) || deals.length === 0) {
      const starter = createDefaultDeal(1);
      return { deals: [starter], currentId: starter.id };
    }

    return { deals, currentId: currentId || deals[0].id };
  } catch {
    const starter = createDefaultDeal(1);
    return { deals: [starter], currentId: starter.id };
  }
}

export function saveState(deals, currentId) {
  const payload = {
    savedAt: nowIso(),
    currentId: currentId || deals[0]?.id || null,
    deals: deals.map((deal) => sanitizeDeal(deal)),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function completionPercent(deal) {
  const requiredFields = [
    "draftLabel",
    "clientName",
    "dealId",
    "programName",
    "presalesLead",
    "bidDate",
    "dealStatus",
    "watermark",
    "contractTerm",
    "discountRate",
    "displayCurrency",
    "fxRate",
    "pricingConstruct",
    "transitionCommercials",
    "transformationFunding",
    "benchmarkPolicy",
    "towerLead_FPA",
    "towerLead_RTR",
    "towerLead_O2C",
    "towerLead_P2P",
  ];

  const done = requiredFields.filter((key) => String(deal[key] ?? "").trim()).length;
  return Math.round((done / requiredFields.length) * 100);
}

export function fpaCompletionPercent(deal) {
  if (!deal || !deal.towerScope_FPA) {
    return 0;
  }

  const workspace = normalizeFpaWorkspace(deal.fpaWorkspace || createDefaultFpaWorkspace());
  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const scopeMetrics = deriveFpaScopeMetrics(workspace.scopeL3, workspace.scopeL2);
  const governanceCompleted = countCompletedFpaGovernanceChecks(workspace);
  const touchedScopeRows = scopeMetrics.l3Rows.filter((row) => !row.matchesWorkbookDefault).length;
  const workbookInputs = deal.fpaWorkbookInputs && typeof deal.fpaWorkbookInputs === "object"
    ? deal.fpaWorkbookInputs
    : {};
  const workbookProgress = workbookInputProgress(workbookInputs);
  const workbookRatios = workbookSheetProgressRatios(workbookInputs);
  const workbookRatio = workbookRatios.length
    ? workbookRatios.reduce((sum, value) => sum + value, 0) / workbookRatios.length
    : completionRatio(workbookProgress.filled, workbookProgress.total);

  const discoveryRatio = completionRatio(
    discoveryMetrics.discoveryCount + discoveryMetrics.coverageAnsweredCount + discoveryMetrics.painAnsweredCount,
    discoveryMetrics.discoveryFieldCount + discoveryMetrics.coverageRows.length + discoveryMetrics.painRows.length,
  );
  const l3ScopeRatio = completionRatio(touchedScopeRows, scopeMetrics.l3Rows.length);
  const l2ScopeRatio = completionRatio(scopeMetrics.selectedL2Count, scopeMetrics.l2RollupRows.length);
  const scopeRatio = Math.max(l3ScopeRatio, l2ScopeRatio);
  const governanceRatio = completionRatio(governanceCompleted, 5);
  const dealSetupRatio = completionRatio(completionPercent(deal), 100);

  const weightedRatio = (dealSetupRatio * FPA_SIDEBAR_PROGRESS_WEIGHTS.dealSetup)
    + (discoveryRatio * FPA_SIDEBAR_PROGRESS_WEIGHTS.discovery)
    + (scopeRatio * FPA_SIDEBAR_PROGRESS_WEIGHTS.scope)
    + (workbookRatio * FPA_SIDEBAR_PROGRESS_WEIGHTS.workbook)
    + (governanceRatio * FPA_SIDEBAR_PROGRESS_WEIGHTS.governance);

  return clampPercent(weightedRatio * 100);
}

export function p2pCompletionPercent(deal) {
  if (!deal || !deal.towerScope_P2P) {
    return 0;
  }

  const workspace = deal.p2pWorkspace || createDefaultP2pWorkspace();
  const workbookInputs = deal.p2pWorkbookInputs && typeof deal.p2pWorkbookInputs === "object"
    ? deal.p2pWorkbookInputs
    : {};
  const populatedSheets = countPopulatedP2pSheets(workbookInputs);
  const populatedCells = countPopulatedP2pWorkbookCells(workbookInputs);
  const localFields = countPopulatedP2pLocalFields(workspace);
  const status = deriveP2pWorkspaceStatus(workspace, workbookInputs);
  const statusRatio = completionRatio(inferTowerStatusProgress(status), 100);
  const localRatio = completionRatio(localFields, 40);
  const sheetRatio = completionRatio(populatedSheets, 10);
  const cellRatio = completionRatio(populatedCells, 60);
  const weightedRatio = (localRatio * 0.55) + (sheetRatio * 0.2) + (cellRatio * 0.1) + (statusRatio * 0.15);

  return clampPercent(weightedRatio * 100);
}

export function towerCompletionPercent(deal, towerCode) {
  if (!deal || !towerCode) {
    return 0;
  }

  if (towerCode === "FPA") {
    return fpaCompletionPercent(deal);
  }

  if (towerCode === "P2P") {
    return p2pCompletionPercent(deal);
  }

  if (deal[`towerScope_${towerCode}`] === false) {
    return 0;
  }

  const workspace = Array.isArray(deal.towerWorkspaces)
    ? deal.towerWorkspaces.find((item) => item?.towerCode === towerCode)
    : null;

  const explicitPercent = Number.parseFloat(
    workspace?.completionPct
    ?? workspace?.completionPercent
    ?? workspace?.progressPct
    ?? workspace?.filledPct
    ?? "",
  );

  if (Number.isFinite(explicitPercent)) {
    return clampPercent(explicitPercent);
  }

  return inferTowerStatusProgress(workspace?.status || deal[`towerStatus_${towerCode}`]);
}

export function scopedTowerCount(deal) {
  return ["FPA", "RTR", "O2C", "P2P"].filter((code) => deal[`towerScope_${code}`]).length;
}

export function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function duplicateDeal(source, { currentUser = null } = {}) {
  const ownerName = currentUser?.name || source.dealOwnerName || source.presalesLead || "Bid Owner";
  const ownerId = currentUser?.id || source.dealOwnerUserId || "user-bid-owner";

  return {
    ...sanitizeDeal(source),
    id: `deal-${Date.now()}`,
    draftLabel: `${source.draftLabel || source.dealId} Copy`,
    dealId: `${source.dealId || "PRE-2026-E2E"}-COPY`,
    dealOwnerUserId: ownerId,
    dealOwnerName: ownerName,
    presalesLead: ownerName,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    accessRole: "owner",
    version: 1,
  };
}

export function exportDeal(deal) {
  const blob = new Blob([JSON.stringify(sanitizeDeal(deal), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${deal.dealId || "deal-master"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}









