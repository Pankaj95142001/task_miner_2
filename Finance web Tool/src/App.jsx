import { useEffect, useMemo, useRef, useState } from "react";
import {
  completionPercent,
  createDefaultDeal,
  duplicateDeal as duplicateLocalDeal,
  exportDeal,
  formatDateTime,
  nowIso,
  scopedTowerCount,
  sanitizeDeal,
  towerCompletionPercent,
} from "./utils/dealMaster";
import { downloadDealSummaryReport } from "./utils/dealSummaryReport";
import {
  createDefaultFpaWorkspace,
  deriveFpaWorkspaceStatus,
  FPA_TABS,
  FPA_TOTAL_FORMULAS,
  normalizeFpaWorkspace,
} from "./config/fpaWorkspace";
import {
  createDefaultP2pWorkspace,
  deriveP2pWorkspaceStatus,
  normalizeP2pWorkspace,
  P2P_TABS,
  syncP2pWorkbookInputsFromWorkspace,
} from "./config/p2pWorkspace";
import DealDocumentIntakeSection from "./components/DealDocumentIntakeSection";
import DealPortalCopilotSection from "./components/DealPortalCopilotSection";
import DealLogicBuilderSection from "./components/DealLogicBuilderSection";
import DealPortfolioDashboard from "./components/DealPortfolioDashboard";
import EmbeddedTrackerPage from "./components/EmbeddedTrackerPage";
import FpaWorkspacePage from "./components/FpaWorkspacePage";
import P2pWorkspacePage from "./components/P2pWorkspacePage";
import PortalCopilotWidget from "./components/PortalCopilotWidget";
import {
  createDeal as createDealRecord,
  deleteDeal as deleteDealRecord,
  deleteDealDocument as deleteDealDocumentRecord,
  duplicateDeal as duplicateDealRecord,
  extractDealDocuments as extractDealDocumentsRecord,
  fetchDealDocumentExtractionStatus as fetchDealDocumentExtractionStatusRecord,
  fetchDeals,
  fetchUsers,
  login as loginUser,
  setCurrentDeal as setCurrentDealRecord,
  signup as signupUser,
  updateDeal as updateDealRecord,
} from "./api/deals";

const VIEW_DEALS = "deals";
const VIEW_DEAL_MASTER = "dealMaster";
const VIEW_FPA = "fpa";
const VIEW_P2P = "p2p";
const VIEW_COLLABORATORS = "collaborators";
const VIEW_PRESALES_DASHBOARD = "presales-dashboard";
const VIEW_PMO_DASHBOARD = "pmo-deal-dashboard";
const VIEW_DEAL_REPOSITORY = "deal-repository";
const VIEW_NEW_DEAL_INTAKE = "new-deal-intake";
const WORKSPACE_VIEWS = [VIEW_DEAL_MASTER, VIEW_FPA, VIEW_P2P, VIEW_COLLABORATORS];
const DASHBOARD_VIEWS = [
  VIEW_PRESALES_DASHBOARD,
  VIEW_PMO_DASHBOARD,
  VIEW_DEAL_REPOSITORY,
  VIEW_NEW_DEAL_INTAKE,
];
const AUTH_STORAGE_KEY = "deal-master-user-id";
const AUTH_MODE_LOGIN = "login";
const AUTH_MODE_SIGNUP = "signup";
const EXTRACTION_STATUS_POLL_MS = 1600;
const AUTO_DISCOVERY_TARGET_PREFIX = 'fpaWorkspace.discovery.';
const COMPANY_OVERVIEW_AGENT_NAME = 'RFP Company Overview Agent';
const COMPANY_OVERVIEW_VISIBLE_FIELDS = 4;
const FALLBACK_USERS = [
  { id: "user-bid-owner", name: "Bid Owner", role: "Deal Owner", email: "bid.owner@hcltech.local" },
  { id: "user-fpa-lead", name: "FP&A Lead", role: "Tower Lead", email: "fpa.lead@hcltech.local" },
  { id: "user-rtr-lead", name: "RTR Lead", role: "Tower Lead", email: "rtr.lead@hcltech.local" },
  { id: "user-o2c-lead", name: "O2C Lead", role: "Tower Lead", email: "o2c.lead@hcltech.local" },
  { id: "user-p2p-lead", name: "P2P Lead", role: "Tower Lead", email: "p2p.lead@hcltech.local" },
  { id: "user-reviewer", name: "Finance Reviewer", role: "Reviewer", email: "reviewer@hcltech.local" },
];
const TERM_OPTIONS = ["3", "5", "7"];
const DEAL_STATUSES = [
  "Draft",
  "In Discovery",
  "Sizing",
  "In Review",
  "Approved for Submission",
  "Submitted",
  "Won",
  "Lost",
  "Archived",
];
const WATERMARKS = ["INDICATIVE", "READY WITH REVIEW ITEMS", "SUBMIT-READY", "NOT READY"];
const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AUD"];
const PRICING_CONSTRUCTS = ["FTE-based", "Fixed-fee", "Gainshare", "Outcome-based", "T&M"];
const TRANSITION_COMMERCIALS = ["Separate fee", "Provider-funded", "Amortised"];
const TRANSFORMATION_FUNDING = ["Provider-funded", "Customer-funded", "Amortised", "Gainshare-funded"];
const BENCHMARK_POLICIES = ["Auto", "P25", "P50", "P75"];
const DEFAULT_TOWER_OWNER_IDS = {
  FPA: "user-fpa-lead",
  RTR: "user-rtr-lead",
  O2C: "user-o2c-lead",
  P2P: "user-p2p-lead",
};
const TOWERS = [
  { code: "FPA", label: "FP&A" },
  { code: "RTR", label: "RTR" },
  { code: "O2C", label: "O2C" },
  { code: "P2P", label: "P2P" },
];
const COLLABORATOR_TOWERS = [{ code: "MASTER", label: "Deal Master" }, ...TOWERS];
const COLLABORATOR_TOWER_OPTIONS = COLLABORATOR_TOWERS.map((tower) => ({
  value: tower.code,
  label: tower.label,
}));
const AUTH_ROLE_OPTIONS = [
  { value: "", label: "Select your role" },
  { value: "Deal Owner", label: "Deal Owner" },
  { value: "FP&A Lead", label: "FP&A Lead" },
  { value: "RTR Lead", label: "RTR Lead" },
  { value: "O2C Lead", label: "O2C Lead" },
  { value: "P2P Lead", label: "P2P Lead" },
  { value: "Reviewer", label: "Reviewer" },
  { value: "FP&A Builder", label: "FP&A Builder" },
  { value: "RTR Builder", label: "RTR Builder" },
  { value: "O2C Builder", label: "O2C Builder" },
  { value: "P2P Builder", label: "P2P Builder" },
  { value: "Deal Collaborator", label: "Deal Collaborator" },
];
const PAGE_NAV = [
  { id: VIEW_DEALS, label: "All Deals" },
  { id: VIEW_PRESALES_DASHBOARD, label: "Presales Dashboard" },
  { id: VIEW_PMO_DASHBOARD, label: "PMO Deal Dashboard" },
  { id: VIEW_DEAL_REPOSITORY, label: "Deal Repo" },
  { id: VIEW_NEW_DEAL_INTAKE, label: "New Deal Intake" },
];
const SECTION_NAV = [
  { id: "overview", label: "Overview" },
  { id: "step-logic", label: "Upload Docs" },
  { id: "step-logic-builder", label: "Logic Builder" },
  { id: "step-0", label: "Deal Identity" },
  { id: "step-1", label: "Finance & Currency" },
  { id: "step-2", label: "Commercial Setup" },
  { id: "step-3", label: "Towers & Ownership" },
  { id: "step-4", label: "Review Snapshot" },
];
const FPA_SECTION_NAV = FPA_TABS.map((tab) => ({ id: tab.id, label: tab.sidebarLabel }));
const P2P_SECTION_NAV = P2P_TABS.map((tab) => ({ id: tab.id, label: tab.sidebarLabel }));

function parsePortalRoute(pathname) {
  const normalizedPath = String(pathname || "/").replace(/\/+$/, "") || "/";

  if (normalizedPath === "/" || normalizedPath === `/${VIEW_DEALS}`) {
    return { view: VIEW_DEALS, dealId: null };
  }

  if (normalizedPath === `/${VIEW_PRESALES_DASHBOARD}`) {
    return { view: VIEW_PRESALES_DASHBOARD, dealId: null };
  }

  if (normalizedPath === `/${VIEW_PMO_DASHBOARD}`) {
    return { view: VIEW_PMO_DASHBOARD, dealId: null };
  }

  if (normalizedPath === `/${VIEW_DEAL_REPOSITORY}`) {
    return { view: VIEW_DEAL_REPOSITORY, dealId: null };
  }

  if (normalizedPath === `/${VIEW_NEW_DEAL_INTAKE}`) {
    return { view: VIEW_NEW_DEAL_INTAKE, dealId: null };
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments[0] !== VIEW_DEALS) {
    return { view: VIEW_DEALS, dealId: null };
  }

  if (segments.length === 1) {
    return { view: VIEW_DEALS, dealId: null };
  }

  const dealId = decodeURIComponent(segments[1] || "");
  if (!dealId) {
    return { view: VIEW_DEALS, dealId: null };
  }

  if (segments[2] === VIEW_COLLABORATORS) {
    return { view: VIEW_COLLABORATORS, dealId };
  }

  if (segments[2] === VIEW_FPA) {
    return { view: VIEW_FPA, dealId };
  }

  if (segments[2] === VIEW_P2P) {
    return { view: VIEW_P2P, dealId };
  }

  return { view: VIEW_DEAL_MASTER, dealId };
}

function buildPortalPath(view, dealId = "") {
  if (view === VIEW_PRESALES_DASHBOARD) {
    return `/${VIEW_PRESALES_DASHBOARD}`;
  }

  if (view === VIEW_PMO_DASHBOARD) {
    return `/${VIEW_PMO_DASHBOARD}`;
  }

  if (view === VIEW_DEAL_REPOSITORY) {
    return `/${VIEW_DEAL_REPOSITORY}`;
  }

  if (view === VIEW_NEW_DEAL_INTAKE) {
    return `/${VIEW_NEW_DEAL_INTAKE}`;
  }

  if (view === VIEW_DEALS || !dealId) {
    return `/${VIEW_DEALS}`;
  }

  const encodedDealId = encodeURIComponent(dealId);
  if (view === VIEW_COLLABORATORS) {
    return `/${VIEW_DEALS}/${encodedDealId}/${VIEW_COLLABORATORS}`;
  }

  if (view === VIEW_FPA) {
    return `/${VIEW_DEALS}/${encodedDealId}/${VIEW_FPA}`;
  }

  if (view === VIEW_P2P) {
    return `/${VIEW_DEALS}/${encodedDealId}/${VIEW_P2P}`;
  }

  return `/${VIEW_DEALS}/${encodedDealId}`;
}

function buildProfileInitials(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function pillTone(watermark) {
  if (watermark === "SUBMIT-READY") {
    return "success";
  }

  if (watermark === "READY WITH REVIEW ITEMS") {
    return "info";
  }

  if (watermark === "NOT READY") {
    return "warning";
  }

  return "neutral";
}

function accessTone(role) {
  if (role === "owner") {
    return "success";
  }

  if (role === "tower_lead" || role === "collaborator") {
    return "info";
  }

  return "warning";
}

function accessLabel(role) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "tower_lead") {
    return "Assigned Tower Lead";
  }

  if (role === "collaborator") {
    return "Collaborator";
  }

  return "Viewer";
}

function towerLabelByCode(code) {
  return COLLABORATOR_TOWERS.find((tower) => tower.code === code)?.label || code || "Unassigned";
}

function dedupeValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function clonePlainDeal(value) {
  return JSON.parse(JSON.stringify(value));
}

function setValueAtPath(target, path, value) {
  if (!target || typeof target !== "object") {
    return;
  }

  const segments = String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return;
  }

  let cursor = target;
  segments.slice(0, -1).forEach((segment) => {
    if (!cursor[segment] || typeof cursor[segment] !== "object" || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  });

  cursor[segments[segments.length - 1]] = value;
}

function getValueAtPath(target, path) {
  if (!target || typeof target !== 'object') {
    return undefined;
  }

  const segments = String(path || '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return undefined;
  }

  let cursor = target;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = cursor[segment];
  }

  return cursor;
}

function normalizeSuggestionDisplayValue(rawValue) {
  if (rawValue == null) {
    return "";
  }

  if (typeof rawValue === "string") {
    return rawValue.trim();
  }

  if (typeof rawValue === "boolean") {
    return rawValue ? "Yes" : "No";
  }

  return String(rawValue).trim();
}

function isSuggestionValueEmpty(value) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  return false;
}

function suggestionConfidenceScore(confidence) {
  const normalized = String(confidence || '').trim().toLowerCase();
  if (normalized === 'very high') {
    return 5;
  }
  if (normalized === 'high') {
    return 4;
  }
  if (normalized === 'medium') {
    return 3;
  }
  if (normalized === 'low') {
    return 2;
  }
  if (normalized === 'very low') {
    return 1;
  }
  return 0;
}

function rankExtractionSuggestion(suggestion) {
  const agentName = String(suggestion?.agentName || '').trim();
  const targetPath = String(suggestion?.targetPath || '').trim();
  let score = suggestionConfidenceScore(suggestion?.confidence) * 100;

  if (agentName === COMPANY_OVERVIEW_AGENT_NAME && targetPath.startsWith(AUTO_DISCOVERY_TARGET_PREFIX)) {
    score += 20;
  }
  if (String(suggestion?.sourceLocation || '').trim()) {
    score += 8;
  }
  if (String(suggestion?.evidenceSnippet || '').trim()) {
    score += 5;
  }

  return score;
}

function collectBestRunSuggestions(run, predicate = () => true) {
  const byTargetPath = new Map();
  const distinctValuesByTarget = new Map();
  const documents = Array.isArray(run?.documents) ? run.documents : [];

  documents.forEach((document) => {
    const suggestions = Array.isArray(document?.preview?.fieldSuggestions) ? document.preview.fieldSuggestions : [];
    suggestions.forEach((suggestion) => {
      const targetPath = String(suggestion?.targetPath || '').trim();
      const displayValue = normalizeSuggestionDisplayValue(suggestion?.proposedValue);
      if (!targetPath || !displayValue || !predicate(suggestion, document)) {
        return;
      }

      if (!distinctValuesByTarget.has(targetPath)) {
        distinctValuesByTarget.set(targetPath, new Set());
      }
      distinctValuesByTarget.get(targetPath).add(displayValue);

      const candidate = {
        ...suggestion,
        sourceFile: suggestion?.sourceFile || document?.fileName || '',
      };
      const existing = byTargetPath.get(targetPath);
      if (!existing || rankExtractionSuggestion(candidate) > rankExtractionSuggestion(existing)) {
        byTargetPath.set(targetPath, candidate);
      }
    });
  });

  const conflictTargets = new Set(
    Array.from(distinctValuesByTarget.entries())
      .filter(([, values]) => values.size > 1)
      .map(([targetPath]) => targetPath),
  );

  return {
    suggestions: Array.from(byTargetPath.values()),
    conflictTargets,
  };
}

function summarizeFieldMemoryEntries(entries = []) {
  const statusCounts = {};
  const towerKeys = new Set();
  const sectionKeys = new Set();

  entries.forEach((entry) => {
    const tower = String(entry?.tower || "").trim();
    const section = String(entry?.section || "").trim();
    const status = String(entry?.status || "suggested").trim() || "suggested";
    if (tower) {
      towerKeys.add(tower);
    }
    if (tower && section) {
      sectionKeys.add(`${tower}::${section}`);
    }
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  return {
    fieldCount: entries.length,
    towerCount: towerKeys.size,
    sectionCount: sectionKeys.size,
    updatedFieldCount: 0,
    statusCounts,
  };
}

function summarizeReviewQueueFields(fields = []) {
  const statusCounts = {};
  const towerKeys = new Set();
  const sectionKeys = new Set();
  let conflictCount = 0;
  let highConfidenceCount = 0;

  fields.forEach((field) => {
    const tower = String(field?.tower || "").trim();
    const section = String(field?.section || "").trim();
    const status = String(field?.reviewStatus || "pending").trim() || "pending";
    const confidence = String(field?.resolvedConfidence || "").trim().toLowerCase();
    if (tower) {
      towerKeys.add(tower);
    }
    if (tower && section) {
      sectionKeys.add(`${tower}::${section}`);
    }
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (Number(field?.conflictCount || 0) > 0) {
      conflictCount += 1;
    }
    if (confidence === "high" || confidence === "very high") {
      highConfidenceCount += 1;
    }
  });

  return {
    fieldCount: fields.length,
    pendingCount: statusCounts.pending || 0,
    populatedCount: statusCounts.populated || 0,
    acceptedCount: (statusCounts.accepted || 0) + (statusCounts.locked || 0),
    conflictCount,
    highConfidenceCount,
    towerCount: towerKeys.size,
    sectionCount: sectionKeys.size,
    statusCounts,
  };
}

function normalizePopulatedSuggestionValue(suggestion) {
  const rawValue = suggestion?.resolvedValue ?? suggestion?.proposedValue;
  const controlType = String(suggestion?.controlType || "").trim().toLowerCase();

  if (rawValue == null) {
    return undefined;
  }

  if (controlType === "boolean_select") {
    const normalized = String(rawValue).trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (["yes", "y", "true", "1", "in scope", "approved", "complete", "completed", "ready"].includes(normalized)) {
      return true;
    }
    if (["no", "n", "false", "0", "out of scope"].includes(normalized)) {
      return false;
    }
    return undefined;
  }

  if (typeof rawValue === "string") {
    return rawValue.trim();
  }

  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue) ? String(rawValue) : "";
  }

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  return String(rawValue).trim();
}

function normalizeIdentityToken(value) {
  return String(value || "").trim().toLowerCase();
}

function findMatchingUserId(users, value) {
  const token = normalizeIdentityToken(value);
  if (!token) {
    return "";
  }

  const match = (users || []).find((user) => (
    [user?.id, user?.email, user?.name].some((candidate) => normalizeIdentityToken(candidate) === token)
  ));

  return match?.id || "";
}

function applySuggestedValueToDeal(nextDeal, suggestion, nextValue, users = []) {
  const targetPath = String(suggestion?.targetPath || "").trim();
  if (!targetPath) {
    return;
  }

  setValueAtPath(nextDeal, targetPath, nextValue);

  const towerLeadMatch = targetPath.match(/^towerLead_([A-Z0-9]+)$/);
  if (towerLeadMatch) {
    const towerCode = towerLeadMatch[1];
    const matchedUserId = findMatchingUserId(users, nextValue);
    if (matchedUserId) {
      nextDeal[`towerOwnerUserId_${towerCode}`] = matchedUserId;
      const matchedUser = users.find((user) => user.id === matchedUserId);
      nextDeal[`towerLead_${towerCode}`] = matchedUser?.name || normalizeSuggestionDisplayValue(nextValue);
    }
  }
}

function syncAcceptedExtractionState(nextIntake, suggestions, currentUser) {
  const reviewedSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const normalizedSuggestions = reviewedSuggestions
    .map((suggestion) => ({
      ...suggestion,
      targetPath: String(suggestion?.targetPath || "").trim(),
      fieldKey: String(suggestion?.fieldKey || "").trim(),
      displayValue: normalizeSuggestionDisplayValue(suggestion?.resolvedValue ?? suggestion?.proposedValue),
    }))
    .filter((suggestion) => suggestion.targetPath && suggestion.displayValue);

  if (!normalizedSuggestions.length || !nextIntake || typeof nextIntake !== "object") {
    return;
  }

  const populatedAt = nowIso();
  const byTargetPath = new Map();
  const byFieldKey = new Map();

  normalizedSuggestions.forEach((suggestion) => {
    if (!byTargetPath.has(suggestion.targetPath)) {
      byTargetPath.set(suggestion.targetPath, suggestion);
    }
    if (suggestion.fieldKey && !byFieldKey.has(suggestion.fieldKey)) {
      byFieldKey.set(suggestion.fieldKey, suggestion);
    }
  });

  if (nextIntake.fieldMemory && Array.isArray(nextIntake.fieldMemory.entries)) {
    nextIntake.fieldMemory.entries = nextIntake.fieldMemory.entries.map((entry) => {
      const match = byTargetPath.get(String(entry?.targetPath || "").trim()) || byFieldKey.get(String(entry?.fieldKey || "").trim());
      if (!match) {
        return entry;
      }

      return {
        ...entry,
        status: "accepted",
        currentValue: match.displayValue,
        currentConfidence: String(match?.confidence || entry?.currentConfidence || "High"),
        currentRationale: String(match?.rationale || entry?.currentRationale || ""),
        lastSourceFile: String(match?.sourceFile || entry?.lastSourceFile || ""),
        lastSourceLocation: String(match?.sourceLocation || entry?.lastSourceLocation || ""),
        lastEvidenceSnippet: String(match?.evidenceSnippet || entry?.lastEvidenceSnippet || ""),
        lastUpdatedAt: populatedAt,
        lastAcceptedAt: populatedAt,
        lastAcceptedByUserId: currentUser?.id || "",
        lastAcceptedByName: currentUser?.name || "",
      };
    });
    nextIntake.fieldMemory.updatedAt = populatedAt;
    nextIntake.fieldMemory.summary = summarizeFieldMemoryEntries(nextIntake.fieldMemory.entries);
  }

  if (nextIntake.logicBuilder && nextIntake.logicBuilder.reviewQueue && Array.isArray(nextIntake.logicBuilder.reviewQueue.fields)) {
    nextIntake.logicBuilder.reviewQueue.fields = nextIntake.logicBuilder.reviewQueue.fields.map((field) => {
      const match = byTargetPath.get(String(field?.targetPath || "").trim()) || byFieldKey.get(String(field?.fieldKey || "").trim());
      if (!match) {
        return field;
      }

      return {
        ...field,
        resolvedValue: match.displayValue,
        resolvedConfidence: String(match?.confidence || field?.resolvedConfidence || "High"),
        reviewStatus: "populated",
        primarySourceFile: String(match?.sourceFile || field?.primarySourceFile || ""),
        primarySourceLocation: String(match?.sourceLocation || field?.primarySourceLocation || ""),
        primaryEvidenceSnippet: String(match?.evidenceSnippet || field?.primaryEvidenceSnippet || ""),
        populatedAt,
        populatedByUserId: currentUser?.id || "",
        populatedByName: currentUser?.name || "",
      };
    });

    const queueFields = nextIntake.logicBuilder.reviewQueue.fields;
    const reviewSummary = summarizeReviewQueueFields(queueFields);
    nextIntake.logicBuilder.reviewQueue.summary = reviewSummary;
    nextIntake.logicBuilder.summary = {
      ...(nextIntake.logicBuilder.summary || {}),
      documentCount: Array.isArray(nextIntake.logicBuilder.documentRegister) ? nextIntake.logicBuilder.documentRegister.length : 0,
      chunkCount: Array.isArray(nextIntake.logicBuilder.chunkStore) ? nextIntake.logicBuilder.chunkStore.length : 0,
      factCount: Array.isArray(nextIntake.logicBuilder.factLedger) ? nextIntake.logicBuilder.factLedger.length : 0,
      reviewFieldCount: queueFields.length,
      conflictFieldCount: reviewSummary.conflictCount,
      highConfidenceFieldCount: reviewSummary.highConfidenceCount,
      towerCount: reviewSummary.towerCount,
      sectionCount: reviewSummary.sectionCount,
    };
    nextIntake.logicBuilder.updatedAt = populatedAt;
  }

  nextIntake.updatedAt = populatedAt;
}

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 18.5c1.7-2.9 4.1-4.3 6.5-4.3s4.8 1.4 6.5 4.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SummaryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4.5h7l3 3v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 4.5v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 12h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 16h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.5 7.5h15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.5 4.5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7.5 7.5v10.2a1.8 1.8 0 0 0 1.8 1.8h5.4a1.8 1.8 0 0 0 1.8-1.8V7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 10.5v5.5M14 10.5v5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DealsSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 4.5v15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11.5 9h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11.5 14h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PresalesSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.5 18.5V10.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 18.5V6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 18.5v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 18.5V8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3.5 19.5h18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PmoSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="5" width="16" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 3.5v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 11h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 15h5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RepoSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 6.5h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 17.5h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="3.5" y="4" width="17" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IntakeSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="4.5" width="16" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SidebarToggleIcon({ collapsed = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 5.5h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 18.5h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {collapsed ? (
        <path d="M10 8.5 13.5 12 10 15.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M14 8.5 10.5 12 14 15.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function SummaryList({ rows }) {
  return (
    <div className="summary-list">
      {rows.map((row) => (
        <div key={row.label} className="summary-item">
          <span className="summary-label">{row.label}</span>
          <span className={`summary-value ${row.muted ? "is-muted" : ""}`}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function buildCompanyOverviewRows(overview, limit = COMPANY_OVERVIEW_VISIBLE_FIELDS) {
  const fields = Array.isArray(overview?.fields) ? overview.fields : [];
  return fields
    .filter((field) => String(field?.value || "").trim())
    .slice(0, limit)
    .map((field) => ({
      label: field?.label || field?.fieldKey || "Field",
      value: field?.value || "?",
    }));
}

function TextField({ label, name, value, onChange, type = "text", min, max, step, placeholder, disabled = false }) {
  return (
    <label className="field-block">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}

function SelectField({ label, name, value, onChange, options, disabled = false }) {
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );

  return (
    <label className="field-block">
      <span>{label}</span>
      <select name={name} value={value} disabled={disabled} onChange={(event) => onChange(name, event.target.value)}>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TowerCard({ tower, deal, users, onScopeChange, onOwnerChange, disabled = false, sectionId = "" }) {
  const scopeName = `towerScope_${tower.code}`;
  const ownerName = `towerOwnerUserId_${tower.code}`;
  const assignedUser = users.find((user) => user.id === deal[ownerName]);
  const workspace = deal.towerWorkspaces?.find((item) => item.towerCode === tower.code);

  return (
    <article id={sectionId || undefined} className="tower-card">
      <div className="tower-card-header">
        <strong>{tower.label}</strong>
        <label className="toggle-line">
          <input
            type="checkbox"
            checked={Boolean(deal[scopeName])}
            disabled={disabled}
            onChange={(event) => onScopeChange(tower.code, event.target.checked)}
          />
          In scope
        </label>
      </div>
      <label className="field-block compact-field">
        <span>Workspace Owner</span>
        <select value={deal[ownerName] || ""} disabled={disabled} onChange={(event) => onOwnerChange(tower.code, event.target.value)}>
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} | {user.role}
            </option>
          ))}
        </select>
      </label>
      <div className="tower-meta">
        <span>{assignedUser ? assignedUser.email : "No assignee yet"}</span>
        <span>{workspace?.status || "Not Started"}</span>
      </div>
    </article>
  );
}

function SidebarLink({ item, active, onClick, disabled = false, collapsed = false }) {
  return (
    <button
      type="button"
      className={`sidebar-link ${active ? "active" : ""} ${disabled ? "is-disabled" : ""}`.trim()}
      onClick={onClick}
      disabled={disabled}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      data-link-id={item.id}
    >
      <span className={`sidebar-link-icon ${item.icon ? "has-icon" : "is-dot"}`.trim()} aria-hidden="true">
        {item.icon || <span className="sidebar-link-dot" />}
      </span>
      {!collapsed ? <span className="sidebar-link-label">{item.label}</span> : null}
      {!collapsed && item.meta ? <span className="sidebar-link-meta">{item.meta}</span> : null}
    </button>
  );
}

function SidebarGroup({ group, expanded, onToggle, collapsed = false }) {
  return (
    <section className={`workspace-sidebar-group ${group.active ? "is-active" : ""} ${expanded ? "is-expanded" : ""}`.trim()}>
      <button
        type="button"
        className={`workspace-sidebar-group-trigger ${expanded ? "is-expanded" : ""}`.trim()}
        onClick={onToggle}
        aria-expanded={expanded}
        title={collapsed ? [group.title, group.meta, group.progressMeta].filter(Boolean).join(" - ") : undefined}
      >
        <div className="workspace-sidebar-group-copy">
          <span className="workspace-sidebar-group-icon" aria-hidden="true">{group.shortLabel || group.title?.slice(0, 2) || "--"}</span>
          {!collapsed ? (
            <div className="workspace-sidebar-group-copy-text">
              <span className="summary-label">{group.kicker}</span>
              <strong>{group.title}</strong>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <div className="workspace-sidebar-group-meta">
            {group.meta ? <span className="section-chip">{group.meta}</span> : null}
            {group.progressMeta ? <span className="section-chip workspace-sidebar-progress-chip">{group.progressMeta}</span> : null}
            <span className="sidebar-panel-chevron" aria-hidden="true">
              {expanded ? "-" : "+"}
            </span>
          </div>
        ) : null}
      </button>

      {!collapsed ? (
        <div className={`workspace-sidebar-group-body ${expanded ? "is-expanded" : ""}`.trim()}>
          <div className={group.compact ? "sidebar-link-list sidebar-link-list-compact" : "sidebar-link-list"}>
            {group.items.map((item) => (
              <SidebarLink
                key={item.id}
                item={item}
                active={item.active}
                onClick={item.onClick}
                disabled={Boolean(item.disabled)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value, note }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

function WorkspaceSignalCard({ eyebrow, value, label, note, tone = "primary" }) {
  return (
    <article className={`compact-card workspace-signal-card ${tone}`}>
      <span className="section-kicker">{eyebrow}</span>
      <strong className="workspace-signal-value">{value}</strong>
      <span className="workspace-signal-label">{label}</span>
      <p className="workspace-signal-note">{note}</p>
    </article>
  );
}

function DealOverviewCard({
  deal,
  currentUserId,
  onOpen,
  onOpenCollaborators,
  onDownloadSummary,
  onDelete,
  isDeleting = false,
}) {
  const collaboratorCount = Array.isArray(deal.collaborators) ? deal.collaborators.length : 0;
  const scopeCount = scopedTowerCount(deal);
  const completion = completionPercent(deal);
  const progressWidth = completion > 0 ? Math.min(100, Math.max(completion, 10)) : 0;
  const isOwned = deal.dealOwnerUserId === currentUserId;
  const dealAccessRole = isOwned ? "owner" : deal.accessRole || "viewer";
  const title = deal.draftLabel || deal.dealId || "Untitled Deal";
  const clientLabel = deal.clientName || "<Client Name>";
  const commercialLabel = `${deal.pricingConstruct || "Pricing pending"} | ${deal.contractTerm || "-"}y`;
  return (
    <article className={`deal-overview-card deal-overview-row ${isOwned ? "is-owned" : "is-assigned"}`}>
      <div className="deal-overview-primary">
        <span className="deal-overview-avatar" aria-hidden="true">
          {buildProfileInitials(clientLabel === "<Client Name>" ? title : clientLabel)}
        </span>
        <div className="deal-overview-heading">
          <div className="deal-overview-id-row">
            <p className="section-kicker">{deal.dealId || "Pending Deal ID"}</p>
            <StatusPill tone={accessTone(dealAccessRole)}>{accessLabel(dealAccessRole)}</StatusPill>
          </div>
          <div className="deal-overview-name-row">
            <h3>{title}</h3>
            <p className="muted-copy">{clientLabel}</p>
          </div>
        </div>
      </div>

      <div className="deal-overview-meta-cluster">
        <span className="deal-overview-commercial">{commercialLabel}</span>
      </div>

      <div className="deal-overview-progress">
        <div className="deal-overview-progress-head">
          <span className="summary-label">Readiness</span>
          <strong>{completion}%</strong>
        </div>
        <div className="deal-overview-progress-track" aria-hidden="true">
          <span style={{ width: `${progressWidth}%` }} />
        </div>
      </div>

      <div className="deal-overview-kpis">
        <div className="deal-overview-kpi">
          <span className="summary-label">Towers</span>
          <strong>{scopeCount}</strong>
        </div>
        <div className="deal-overview-kpi">
          <span className="summary-label">Team</span>
          <strong>{collaboratorCount}</strong>
        </div>
      </div>

      <div className="deal-card-actions">
        {typeof onDownloadSummary === "function" ? (
          <button
            type="button"
            className="deal-summary-button"
            onClick={onDownloadSummary}
            aria-label={`Download summary for ${title}`}
            title="Download summary report"
          >
            <SummaryIcon />
            <span>Summary</span>
          </button>
        ) : null}
        <button type="button" className="deal-action-icon is-primary" onClick={onOpen} aria-label={`Open ${title}`} title="Open deal">
          <EyeIcon />
        </button>
        <button
          type="button"
          className="deal-action-icon"
          onClick={onOpenCollaborators}
          aria-label={`View collaborators for ${title}`}
          title="Collaborators"
        >
          <ProfileIcon />
        </button>
        {typeof onDelete === "function" ? (
          <button
            type="button"
            className="deal-action-icon is-danger"
            onClick={onDelete}
            aria-label={`Delete ${title}`}
            title="Delete deal"
            disabled={isDeleting}
          >
            <TrashIcon />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function CollaboratorCard({ collaborator, canEdit, onRemove }) {
  return (
    <article className="compact-card collaborator-card">
      <div className="collaborator-card-head">
        <div>
          <p className="section-kicker">{towerLabelByCode(collaborator.towerCode)}</p>
          <strong>{collaborator.name}</strong>
        </div>
        <StatusPill tone={collaborator.towerCode === "MASTER" ? "warning" : "info"}>
          {towerLabelByCode(collaborator.towerCode)}
        </StatusPill>
      </div>
      <p className="muted-copy">{collaborator.email}</p>
      <div className="collaborator-card-actions">
        <span className="summary-label">
          {collaborator.towerCode === "MASTER" ? "Deal-wide support" : "Tower support"}
        </span>
        {canEdit ? (
          <button type="button" className="btn btn-secondary" onClick={onRemove}>
            Remove
          </button>
        ) : (
          <span className="summary-value is-muted">View only</span>
        )}
      </div>
    </article>
  );
}

export default function App() {
  const initialRoute = parsePortalRoute(typeof window !== "undefined" ? window.location.pathname : "/");
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => window.localStorage.getItem(AUTH_STORAGE_KEY) || "");
  const [deals, setDeals] = useState([]);
  const [currentId, setCurrentId] = useState(initialRoute.dealId);
  const [currentView, setCurrentView] = useState(initialRoute.view);
  const [persistedDealIds, setPersistedDealIds] = useState(() => new Set());
  const [activeSection, setActiveSection] = useState("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedWorkspaceGroup, setExpandedWorkspaceGroup] = useState(initialRoute.view === VIEW_FPA ? "FPA" : initialRoute.view === VIEW_P2P ? "P2P" : "MASTER");
  const [dealListFilter, setDealListFilter] = useState("all");
  const [flash, setFlash] = useState({ text: "", tone: "success" });
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPopulatingDocumentSuggestions, setIsPopulatingDocumentSuggestions] = useState(false);
  const [activeExtractionJob, setActiveExtractionJob] = useState(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authMode, setAuthMode] = useState(AUTH_MODE_LOGIN);
  const [authForm, setAuthForm] = useState({
    name: "",
    role: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [profilePopoverStyle, setProfilePopoverStyle] = useState(null);
  const [collaboratorDraft, setCollaboratorDraft] = useState({
    name: "",
    email: "",
    towerCode: "MASTER",
  });
  const profileMenuRef = useRef(null);
  const profileTriggerRef = useRef(null);

  const usersById = useMemo(() => Object.fromEntries(users.map((user) => [user.id, user])), [users]);
  const currentUser = usersById[currentUserId] ?? null;
  const currentUserInitials = useMemo(
    () => buildProfileInitials(currentUser?.name || currentUser?.email || "User"),
    [currentUser?.email, currentUser?.name],
  );
  const towerOwnersByCode = useMemo(
    () =>
      Object.fromEntries(
        TOWERS.map((tower) => [tower.code, usersById[DEFAULT_TOWER_OWNER_IDS[tower.code]] ?? null]),
      ),
    [usersById],
  );
  const currentDeal = useMemo(
    () => deals.find((deal) => deal.id === currentId) ?? null,
    [currentId, deals],
  );
  const sortedDeals = useMemo(
    () => [...deals].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt)),
    [deals],
  );
  const ownedDeals = useMemo(
    () => sortedDeals.filter((deal) => deal.dealOwnerUserId === currentUserId),
    [currentUserId, sortedDeals],
  );
  const assignedDeals = useMemo(
    () => sortedDeals.filter((deal) => deal.dealOwnerUserId !== currentUserId),
    [currentUserId, sortedDeals],
  );

  const isLoading = isLoadingUsers || isLoadingDeals;
  const isBusy = isLoading || isSyncing || isAuthenticating;
  const isAuthenticated = Boolean(currentUserId && currentUser);
  const isWorkspaceView = WORKSPACE_VIEWS.includes(currentView);
  const isEmbeddedDashboardView = DASHBOARD_VIEWS.includes(currentView);

  const isCurrentDealPersisted = currentDeal ? persistedDealIds.has(currentDeal.id) : false;
  const isOwner = currentDeal ? !currentDeal.dealOwnerUserId || currentDeal.dealOwnerUserId === currentUserId : true;
  const accessRole = currentDeal?.accessRole || (isOwner ? "owner" : "viewer");
  const canEditDealMaster = Boolean(currentDeal) && isOwner;
  const collaboratorCount = currentDeal?.collaborators?.length ?? 0;
  const currentUserDealMembers = useMemo(
    () =>
      Array.isArray(currentDeal?.members)
        ? currentDeal.members.filter((member) => member?.userId === currentUserId)
        : [],
    [currentDeal, currentUserId],
  );
  const assignedTowerCodes = useMemo(() => {
    if (!currentDeal) {
      return [];
    }

    const memberCodes = currentUserDealMembers.map((member) => String(member?.towerCode || "").trim().toUpperCase());
    const ownerCodes = TOWERS.filter((tower) => currentDeal[`towerOwnerUserId_${tower.code}`] === currentUserId).map(
      (tower) => tower.code,
    );
    const collaboratorCodes = Array.isArray(currentDeal.collaborators) && currentUser?.email
      ? currentDeal.collaborators
          .filter((collaborator) => String(collaborator?.email || "").trim().toLowerCase() === currentUser.email.toLowerCase())
          .map((collaborator) => String(collaborator?.towerCode || "").trim().toUpperCase())
      : [];

    return dedupeValues([...memberCodes, ...ownerCodes, ...collaboratorCodes]);
  }, [currentDeal, currentUser?.email, currentUserDealMembers, currentUserId]);
  const canViewAllSections = isOwner || assignedTowerCodes.includes("MASTER");
  const visibleTowers = useMemo(() => {
    if (canViewAllSections) {
      return TOWERS;
    }

    return TOWERS.filter((tower) => assignedTowerCodes.includes(tower.code));
  }, [assignedTowerCodes, canViewAllSections]);
  const assignedTowerLabels = useMemo(() => visibleTowers.map((tower) => tower.label), [visibleTowers]);
  const canViewTowerSection = canViewAllSections || visibleTowers.length > 0;
  const canViewFpa = Boolean(currentDeal) && (canViewAllSections || assignedTowerCodes.includes("FPA"));
  const canEditFpa = Boolean(currentDeal) && (isOwner || assignedTowerCodes.includes("FPA"));
  const canViewP2p = Boolean(currentDeal) && (canViewAllSections || assignedTowerCodes.includes("P2P"));
  const canEditP2p = Boolean(currentDeal) && (isOwner || assignedTowerCodes.includes("P2P"));
  const visibleSectionNav = useMemo(() => {
    if (!currentDeal) {
      return [];
    }

    if (currentView === VIEW_FPA) {
      return canViewFpa ? FPA_SECTION_NAV : [];
    }

    if (currentView === VIEW_P2P) {
      return canViewP2p ? P2P_SECTION_NAV : [];
    }

    if (currentView !== VIEW_DEAL_MASTER) {
      return [];
    }

    if (canViewAllSections) {
      return SECTION_NAV;
    }

    return [
      { id: "overview", label: "Overview" },
      ...visibleTowers.map((tower) => ({ id: `tower-${tower.code}`, label: `${tower.label} Workspace` })),
    ];
  }, [canViewAllSections, canViewFpa, canViewP2p, currentDeal, currentView, visibleTowers]);
  const workspaceSidebarGroups = useMemo(() => {
    if (!currentDeal || !WORKSPACE_VIEWS.includes(currentView)) {
      return [];
    }

    const groups = [];
    const masterCompletion = completionPercent(currentDeal);

    if (canViewAllSections) {
      groups.push({
        id: "MASTER",
        shortLabel: "DM",
        kicker: "Shared Shell",
        title: "Deal Master",
        meta: `${SECTION_NAV.length} sections`,
        progressMeta: `${masterCompletion}% filled`,
        compact: false,
        active: [VIEW_DEAL_MASTER, VIEW_COLLABORATORS].includes(currentView),
        items: SECTION_NAV.map((item) => ({
          id: item.id,
          label: item.label,
          active: currentView === VIEW_DEAL_MASTER && activeSection === item.id,
          onClick: () => jumpToSection(item.id),
        })),
      });
    }

    visibleTowers.forEach((tower) => {
      const towerProgress = towerCompletionPercent(currentDeal, tower.code);

      if (tower.code === "FPA") {
        groups.push({
          id: tower.code,
          shortLabel: tower.code,
          kicker: "Tower",
          title: tower.label,
          meta: `${FPA_SECTION_NAV.length} tabs`,
          progressMeta: `${towerProgress}% filled`,
          compact: true,
          active: currentView === VIEW_FPA,
          items: FPA_SECTION_NAV.map((item) => ({
            id: item.id,
            label: item.label,
            active: currentView === VIEW_FPA && activeSection === item.id,
            onClick: () => openFpaTab(item.id),
          })),
        });
        return;
      }

      if (tower.code === "P2P") {
        groups.push({
          id: tower.code,
          shortLabel: tower.code,
          kicker: "Tower",
          title: tower.label,
          meta: `${P2P_SECTION_NAV.length} tabs`,
          progressMeta: `${towerProgress}% filled`,
          compact: true,
          active: currentView === VIEW_P2P,
          items: P2P_SECTION_NAV.map((item) => ({
            id: item.id,
            label: item.label,
            active: currentView === VIEW_P2P && activeSection === item.id,
            onClick: () => openP2pTab(item.id),
          })),
        });
        return;
      }

      groups.push({
        id: tower.code,
        shortLabel: tower.code,
        kicker: "Tower",
        title: tower.label,
        meta: currentDeal[`towerStatus_${tower.code}`] || "Coming soon",
        progressMeta: `${towerProgress}% filled`,
        compact: true,
        active: false,
        items: [
          {
            id: `${tower.code}-placeholder`,
            label: "Workspace tabs will appear here",
            active: false,
            disabled: true,
          },
        ],
      });
    });

    return groups;
  }, [activeSection, canViewAllSections, currentDeal, currentView, visibleTowers]);

  const storeNote = currentDeal
    ? isCurrentDealPersisted
      ? "JSON collaboration store"
      : "Draft not saved yet"
    : "Select a deal";
  const documentIntake = currentDeal?.documentIntake && typeof currentDeal.documentIntake === "object"
    ? currentDeal.documentIntake
    : {};
  const liveRunForCurrentDeal = activeExtractionJob && activeExtractionJob.dealId === currentDeal?.id ? activeExtractionJob : null;
  const storedCompanyOverview = documentIntake.companyOverview && typeof documentIntake.companyOverview === "object"
    ? documentIntake.companyOverview
    : null;
  const companyOverview = liveRunForCurrentDeal?.companyOverview && typeof liveRunForCurrentDeal.companyOverview === "object"
    ? liveRunForCurrentDeal.companyOverview
    : storedCompanyOverview;
  const discoveryAutofillCount = Number(documentIntake?.latestRun?.discoveryAutofillCount || 0);

  useEffect(() => {
    document.body.classList.toggle("auth-page-active", !isAuthenticated);

    return () => {
      document.body.classList.remove("auth-page-active");
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!profileMenuRef.current || profileMenuRef.current.contains(event.target)) {
        return;
      }

      setIsProfileMenuOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      setProfilePopoverStyle(null);
      return undefined;
    }

    const profileMenuElement = profileMenuRef.current;
    const profileTriggerElement = profileTriggerRef.current;
    const isDealsProfileMenu = Boolean(profileMenuElement?.classList.contains("deals-profile-menu"));

    if (!isDealsProfileMenu || !profileTriggerElement) {
      setProfilePopoverStyle(null);
      return undefined;
    }

    function updateProfilePopoverPosition() {
      const triggerBounds = profileTriggerElement.getBoundingClientRect();
      const popoverWidth = Math.min(312, Math.max(248, window.innerWidth - 32));
      const popoverLeft = Math.min(
        Math.max(16, window.innerWidth - popoverWidth - 16),
        Math.max(16, triggerBounds.right - popoverWidth),
      );

      setProfilePopoverStyle({
        position: "fixed",
        top: `${Math.max(16, triggerBounds.bottom + 12)}px`,
        left: `${popoverLeft}px`,
        width: `${popoverWidth}px`,
        right: "auto",
        zIndex: 1200,
      });
    }

    updateProfilePopoverPosition();
    window.addEventListener("resize", updateProfilePopoverPosition);
    window.addEventListener("scroll", updateProfilePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updateProfilePopoverPosition);
      window.removeEventListener("scroll", updateProfilePopoverPosition, true);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [currentId, currentUserId, currentView]);

  useEffect(() => {
    if (![VIEW_DEAL_MASTER, VIEW_FPA, VIEW_P2P].includes(currentView) || visibleSectionNav.length === 0) {
      return;
    }

    if (!visibleSectionNav.some((item) => item.id === activeSection)) {
      setActiveSection(visibleSectionNav[0].id);
    }
  }, [activeSection, currentView, visibleSectionNav]);
  useEffect(() => {
    if (!currentDeal) {
      return;
    }

    if (currentView === VIEW_FPA && canViewFpa) {
      setExpandedWorkspaceGroup("FPA");
      return;
    }

    if (currentView === VIEW_P2P && canViewP2p) {
      setExpandedWorkspaceGroup("P2P");
      return;
    }

    if (canViewAllSections && [VIEW_DEAL_MASTER, VIEW_COLLABORATORS].includes(currentView)) {
      setExpandedWorkspaceGroup("MASTER");
      return;
    }

    if (!canViewAllSections && visibleTowers.length > 0) {
      setExpandedWorkspaceGroup(visibleTowers[0].code);
    }
  }, [canViewAllSections, canViewFpa, canViewP2p, currentDeal, currentView, visibleTowers]);

  useEffect(() => {
    function handlePopState() {
      const nextRoute = parsePortalRoute(window.location.pathname);
      setCurrentView(nextRoute.view);
      if (nextRoute.dealId) {
        setCurrentId(nextRoute.dealId);
      }
      if (nextRoute.view === VIEW_FPA) {
        setActiveSection(FPA_TABS[0].id);
      } else if (nextRoute.view === VIEW_P2P) {
        setActiveSection(P2P_TABS[0].id);
      } else if (nextRoute.view !== VIEW_DEAL_MASTER) {
        setActiveSection("overview");
        setDealListFilter("all");
      }
      setCollaboratorDraft({ name: "", email: "", towerCode: "MASTER" });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function buildStarterDeal(seed = deals.length + 1) {
    return createDefaultDeal(seed, { currentUser: currentUser || FALLBACK_USERS[0], towerOwnersByCode });
  }

  function rememberPersistedDeal(dealId) {
    setPersistedDealIds((previous) => {
      const next = new Set(previous);
      next.add(dealId);
      return next;
    });
  }

  function applyCollection(collection, preferredDealId = null) {
    const nextDeals = Array.isArray(collection?.deals) ? collection.deals.map((deal) => sanitizeDeal(deal)) : [];
    const nextCurrentId = preferredDealId && nextDeals.some((deal) => deal.id === preferredDealId)
      ? preferredDealId
      : collection?.currentId || nextDeals[0]?.id || null;

    setDeals(nextDeals);
    setCurrentId(nextCurrentId);
    setPersistedDealIds(new Set(nextDeals.map((deal) => deal.id)));
  }

  function updateAuthForm(field, value) {
    setAuthForm((previous) => ({ ...previous, [field]: value }));
  }

  function updatePath(nextPath, options = {}) {
    const { replace = false } = options;
    if (window.location.pathname === nextPath) {
      return;
    }

    if (replace) {
      window.history.replaceState(null, "", nextPath);
      return;
    }

    window.history.pushState(null, "", nextPath);
  }

  function goToDeals(options = {}) {
    goToAppView(VIEW_DEALS, options);
  }

  function goToPresalesDashboard(options = {}) {
    goToAppView(VIEW_PRESALES_DASHBOARD, options);
  }

  function goToPmoDashboard(options = {}) {
    goToAppView(VIEW_PMO_DASHBOARD, options);
  }

  function goToDealRepository(options = {}) {
    goToAppView(VIEW_DEAL_REPOSITORY, options);
  }

  function goToNewDealIntake(options = {}) {
    goToAppView(VIEW_NEW_DEAL_INTAKE, options);
  }

  function goToAppView(nextView, options = {}) {
    updatePath(buildPortalPath(nextView), options);
    setCurrentView(nextView);
    setActiveSection("overview");
    setDealListFilter("all");
    setCollaboratorDraft({ name: "", email: "", towerCode: "MASTER" });
  }

  function goToDealPage(dealId, nextView = VIEW_DEAL_MASTER, options = {}) {
    if (!dealId) {
      goToDeals(options);
      return;
    }

    updatePath(buildPortalPath(nextView, dealId), options);
    setCurrentId(dealId);
    setCurrentView(nextView);
    if (nextView !== VIEW_DEAL_MASTER) {
      setActiveSection("overview");
    setDealListFilter("all");
    }
    setCollaboratorDraft({ name: "", email: "", towerCode: "MASTER" });
  }

  function completeAuthentication(user, successText) {
    const nextRoute = parsePortalRoute(window.location.pathname);

    window.localStorage.setItem(AUTH_STORAGE_KEY, user.id);
    updatePath(buildPortalPath(nextRoute.view, nextRoute.dealId), { replace: true });
    setUsers((previous) => {
      const nextUsers = previous.filter((item) => item.id !== user.id);
      return [...nextUsers, user].sort((left, right) => left.name.localeCompare(right.name));
    });
    setCurrentUserId(user.id);
    setCurrentId(nextRoute.dealId || null);
    setCurrentView(nextRoute.view);
    setActiveSection("overview");
    setDealListFilter("all");
    setAuthMode(AUTH_MODE_LOGIN);
    setAuthForm({
      name: "",
      role: "",
      email: user.email || "",
      password: "",
      confirmPassword: "",
    });
    setFlash({ text: successText, tone: "success" });
  }

  async function signIn(credentials = authForm) {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password;

    if (!email) {
      setFlash({ text: "Enter your email address first.", tone: "warning" });
      return;
    }

    if (!password) {
      setFlash({ text: "Enter your password to continue.", tone: "warning" });
      return;
    }

    setIsAuthenticating(true);

    try {
      const signedInUser = await loginUser(email, password);
      completeAuthentication(signedInUser, `Signed in as ${signedInUser.name}.`);
    } catch (error) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setCurrentUserId("");
      setFlash({ text: error.message || "Unable to sign in with that email and password.", tone: "warning" });
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function createAccount() {
    const name = authForm.name.trim();
    const role = authForm.role.trim();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;
    const confirmPassword = authForm.confirmPassword;

    if (!name || !role || !email || !password || !confirmPassword) {
      setFlash({ text: "Complete every account field first.", tone: "warning" });
      return;
    }

    if (password.length < 8) {
      setFlash({ text: "Password must be at least 8 characters long.", tone: "warning" });
      return;
    }

    if (password !== confirmPassword) {
      setFlash({ text: "Password and confirm password must match.", tone: "warning" });
      return;
    }

    setIsAuthenticating(true);

    try {
      const registeredUser = await signupUser({ name, role, email, password });
      completeAuthentication(registeredUser, `Account created for ${registeredUser.name}.`);
    } catch (error) {
      setFlash({ text: error.message || "Unable to create your account.", tone: "warning" });
    } finally {
      setIsAuthenticating(false);
    }
  }

  function handleAuthSubmit(event) {
    event.preventDefault();
    if (authMode === AUTH_MODE_SIGNUP) {
      void createAccount();
      return;
    }
    void signIn();
  }

  function logout() {
    const previousUserName = currentUser?.name || "Current user";
    setIsProfileMenuOpen(false);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    updatePath("/", { replace: true });
    setCurrentUserId("");
    setDeals([]);
    setCurrentId(null);
    setPersistedDealIds(new Set());
    setCurrentView(VIEW_DEALS);
    setActiveSection("overview");
    setDealListFilter("all");
    setAuthMode(AUTH_MODE_LOGIN);
    setAuthForm({
      name: "",
      role: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
    setCollaboratorDraft({ name: "", email: "", towerCode: "MASTER" });
    setFlash({ text: `${previousUserName} signed out.`, tone: "info" });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      setIsLoadingUsers(true);

      try {
        const loadedUsers = await fetchUsers();
        if (!isMounted) {
          return;
        }

        if (Array.isArray(loadedUsers) && loadedUsers.length > 0) {
          const storedUserId = window.localStorage.getItem(AUTH_STORAGE_KEY) || "";
          const nextUserId = loadedUsers.some((user) => user.id === storedUserId) ? storedUserId : "";
          setUsers(loadedUsers);
          setCurrentUserId(nextUserId);
          if (!nextUserId) {
            window.localStorage.removeItem(AUTH_STORAGE_KEY);
          }
          return;
        }

        setUsers([]);
        setCurrentUserId("");
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setFlash({ text: "No users are available yet. Create an account to continue.", tone: "info" });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setUsers([]);
        setCurrentUserId("");
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setFlash({ text: error.message || "Authentication service unavailable. Start the backend and try again.", tone: "warning" });
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false);
        }
      }
    }

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingUsers) {
      return undefined;
    }

    if (!currentUserId || !currentUser) {
      setDeals([]);
      setCurrentId(null);
      setPersistedDealIds(new Set());
      setIsLoadingDeals(false);
      return undefined;
    }

    const normalizedRoute = parsePortalRoute(window.location.pathname);
    updatePath(buildPortalPath(normalizedRoute.view, normalizedRoute.dealId), { replace: true });
    setCurrentView(normalizedRoute.view);
    if (normalizedRoute.dealId) {
      setCurrentId(normalizedRoute.dealId);
    }

    let isMounted = true;

    async function loadWorkspace() {
      setIsLoadingDeals(true);

      try {
        const collection = await fetchDeals(currentUserId);
        if (!isMounted) {
          return;
        }

        const requestedDealId = WORKSPACE_VIEWS.includes(normalizedRoute.view) ? normalizedRoute.dealId : null;
        const requestedDealExists = requestedDealId
          ? collection.deals.some((deal) => deal.id === requestedDealId)
          : false;

        applyCollection(collection, requestedDealId);

        if (requestedDealId && !requestedDealExists) {
          goToDeals({ replace: true });
          setFlash({ text: "That deal is not available in your workspace anymore.", tone: "warning" });
          return;
        }

        if (collection.deals.length > 0) {
          setFlash({
            text: `Loaded ${collection.deals.length} deal${collection.deals.length === 1 ? "" : "s"} for ${currentUser.name}.`,
            tone: "success",
          });
        } else {
          setFlash({ text: `No assigned or owned deals found for ${currentUser.name}. Create one to get started.`, tone: "info" });
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setDeals([]);
        setCurrentId(null);
        setPersistedDealIds(new Set());
        setFlash({ text: error.message || `API unavailable for ${currentUser.name}.`, tone: "warning" });
      } finally {
        if (isMounted) {
          setIsLoadingDeals(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.name, currentUserId, isLoadingUsers]);

  useEffect(() => {
    if (!flash.text) {
      return undefined;
    }

    const timer = window.setTimeout(() => setFlash({ text: "", tone: "success" }), 3200);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function changeView(view) {
    if (view === VIEW_DEALS) {
      goToDeals();
      return;
    }

    if (!currentDeal) {
      setFlash({ text: "Select or create a deal first.", tone: "info" });
      return;
    }

    if (view === VIEW_FPA && !canViewFpa) {
      setFlash({ text: "FP&A is not assigned to your login for this deal.", tone: "warning" });
      return;
    }

    if (view === VIEW_P2P && !canViewP2p) {
      setFlash({ text: "P2P is not assigned to your login for this deal.", tone: "warning" });
      return;
    }

    goToDealPage(currentDeal.id, view);
  }

  function jumpToSection(sectionId) {
    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return;
    }

    if ([VIEW_FPA, VIEW_P2P].includes(currentView)) {
      setActiveSection(sectionId);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    goToDealPage(currentDeal.id, VIEW_DEAL_MASTER);
    setActiveSection(sectionId);
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  }

  function openFpaTab(tabId = FPA_TABS[0]?.id) {
    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return;
    }

    if (!canViewFpa) {
      setFlash({ text: "FP&A is not assigned to your login for this deal.", tone: "warning" });
      return;
    }

    const nextTabId = tabId || FPA_TABS[0]?.id;
    if (!nextTabId) {
      return;
    }

    goToDealPage(currentDeal.id, VIEW_FPA);
    setActiveSection(nextTabId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openP2pTab(tabId = P2P_TABS[0]?.id) {
    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return;
    }

    if (!canViewP2p) {
      setFlash({ text: "P2P is not assigned to your login for this deal.", tone: "warning" });
      return;
    }

    const nextTabId = tabId || P2P_TABS[0]?.id;
    if (!nextTabId) {
      return;
    }

    goToDealPage(currentDeal.id, VIEW_P2P);
    setActiveSection(nextTabId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSidebarGroupToggle(groupId) {
    const wasCollapsed = isSidebarCollapsed;
    const isExpanded = expandedWorkspaceGroup === groupId && !wasCollapsed;

    if (wasCollapsed) {
      setIsSidebarCollapsed(false);
    }

    setExpandedWorkspaceGroup(isExpanded ? null : groupId);

    if (isExpanded || !currentDeal) {
      return;
    }

    if (groupId === "MASTER" && canViewAllSections) {
      goToDealPage(currentDeal.id, VIEW_DEAL_MASTER);
      setActiveSection("overview");
      return;
    }

    if (groupId === "FPA") {
      openFpaTab(FPA_SECTION_NAV.some((item) => item.id === activeSection) ? activeSection : FPA_TABS[0]?.id);
      return;
    }

    if (groupId === "P2P") {
      openP2pTab(P2P_SECTION_NAV.some((item) => item.id === activeSection) ? activeSection : P2P_TABS[0]?.id);
    }
  }

  function patchCurrentDealFields(fields, canEdit = false) {
    if (!currentDeal || !canEdit) {
      return;
    }

    setDeals((previous) =>
      previous.map((deal) =>
        deal.id === currentDeal.id
          ? {
              ...deal,
              ...fields,
              updatedAt: nowIso(),
            }
          : deal,
      ),
    );
  }

  function updateCurrentDeal(field, value) {
    patchCurrentDealFields({ [field]: value }, canEditDealMaster);
  }

  function updateCurrentDealFields(fields) {
    patchCurrentDealFields(fields, canEditDealMaster);
  }

  function updateTowerScope(code, value) {
    updateCurrentDeal(`towerScope_${code}`, value);
  }

  function updateTowerOwner(code, userId) {
    const nextUser = usersById[userId];
    updateCurrentDealFields({
      [`towerOwnerUserId_${code}`]: userId,
      [`towerLead_${code}`]: nextUser?.name || "",
    });
  }

  function updateCollaboratorDraft(field, value) {
    setCollaboratorDraft((previous) => ({ ...previous, [field]: value }));
  }

  function updateFpaWorkspace(nextWorkspace) {
    const normalized = normalizeFpaWorkspace(nextWorkspace);
    const status = deriveFpaWorkspaceStatus(normalized);

    patchCurrentDealFields(
      {
        fpaWorkspace: {
          ...normalized,
          status,
        },
        towerStatus_FPA: status,
      },
      canEditFpa,
    );
  }

  function updateFpaDiscoveryField(field, value) {
    const nextWorkspace = normalizeFpaWorkspace(currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
    nextWorkspace.discovery[field] = value;
    updateFpaWorkspace(nextWorkspace);
  }

  function updateFpaScopeItem(scopeId, checked) {
    const nextWorkspace = normalizeFpaWorkspace(currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
    nextWorkspace.scopeL3[scopeId] = checked;
    updateFpaWorkspace(nextWorkspace);
  }

  function updateFpaNotes(value) {
    const nextWorkspace = normalizeFpaWorkspace(currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
    nextWorkspace.notes = value;
    updateFpaWorkspace(nextWorkspace);
  }

  function updateFpaWorkbookCell(sheetName, cellAddress, value) {
    if (!currentDeal || !canEditFpa) {
      return;
    }

    const currentInputs = currentDeal.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
      ? currentDeal.fpaWorkbookInputs
      : {};
    const nextInputs = { ...currentInputs };
    const nextSheetInputs = { ...(nextInputs[sheetName] || {}) };

    nextSheetInputs[cellAddress] = value == null ? "" : String(value);

    if (Object.keys(nextSheetInputs).length) {
      nextInputs[sheetName] = nextSheetInputs;
    } else {
      delete nextInputs[sheetName];
    }

    patchCurrentDealFields(
      {
        fpaWorkbookInputs: nextInputs,
        towerStatus_FPA: currentDeal?.towerStatus_FPA || "In Progress",
      },
      canEditFpa,
    );
  }

  function updateP2pWorkspace(nextWorkspace) {
    const normalized = normalizeP2pWorkspace(nextWorkspace);
    const currentWorkbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
      ? currentDeal.p2pWorkbookInputs
      : {};
    const workbookInputs = syncP2pWorkbookInputsFromWorkspace(normalized, currentWorkbookInputs);
    const status = deriveP2pWorkspaceStatus(normalized, workbookInputs);

    patchCurrentDealFields(
      {
        p2pWorkbookInputs: workbookInputs,
        p2pWorkspace: {
          ...normalized,
          status,
        },
        towerStatus_P2P: status,
      },
      canEditP2p,
    );
  }

  function updateP2pWorkbookCell(sheetName, cellAddress, value) {
    if (!currentDeal || !canEditP2p) {
      return;
    }

    const currentInputs = currentDeal.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
      ? currentDeal.p2pWorkbookInputs
      : {};
    const nextInputs = { ...currentInputs };
    const nextSheetInputs = { ...(nextInputs[sheetName] || {}) };

    nextSheetInputs[cellAddress] = value == null ? "" : String(value);

    if (Object.keys(nextSheetInputs).length) {
      nextInputs[sheetName] = nextSheetInputs;
    } else {
      delete nextInputs[sheetName];
    }

    const normalizedWorkspace = normalizeP2pWorkspace(currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
    const status = deriveP2pWorkspaceStatus(normalizedWorkspace, nextInputs);

    patchCurrentDealFields(
      {
        p2pWorkbookInputs: nextInputs,
        p2pWorkspace: {
          ...normalizedWorkspace,
          status,
        },
        towerStatus_P2P: status,
      },
      canEditP2p,
    );
  }

  async function refreshUsersDirectory() {
    try {
      const loadedUsers = await fetchUsers();
      if (Array.isArray(loadedUsers)) {
        setUsers(loadedUsers);
      }
    } catch {
      
    }
  }

  function buildCollaboratorSyncPayload(nextCollaborators) {
    if (!currentDeal) {
      return null;
    }

    if (isCurrentDealPersisted) {
      return { collaborators: nextCollaborators };
    }

    return {
      ...currentDeal,
      collaborators: nextCollaborators,
      updatedAt: nowIso(),
    };
  }

  async function persistCollaborators(nextCollaborators, options = {}) {
    if (!currentDeal || !canEditDealMaster) {
      return null;
    }

    const {
      successText = "Collaborators saved to the deal.",
      warningText = "Unable to save collaborator changes.",
      rollbackDraft = null,
    } = options;

    const previousCollaborators = currentDeal.collaborators || [];
    updateCurrentDealFields({ collaborators: nextCollaborators });

    const savedDeal = await saveDeal({
      successText,
      warningText,
      dealPayload: buildCollaboratorSyncPayload(nextCollaborators),
      targetDealId: currentDeal.id,
      syncUsers: true,
    });

    if (!savedDeal) {
      updateCurrentDealFields({ collaborators: previousCollaborators });
      if (rollbackDraft) {
        setCollaboratorDraft(rollbackDraft);
      }
      return null;
    }

    return savedDeal;
  }

  async function addCollaborator() {
    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return;
    }

    if (!canEditDealMaster) {
      setFlash({ text: "Only the deal owner can add collaborators in this phase.", tone: "warning" });
      return;
    }

    const name = collaboratorDraft.name.trim();
    const email = collaboratorDraft.email.trim().toLowerCase();
    const towerCode = collaboratorDraft.towerCode;

    if (!name || !email) {
      setFlash({ text: "Enter collaborator name and email first.", tone: "warning" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFlash({ text: "Enter a valid collaborator email address.", tone: "warning" });
      return;
    }

    const hasDuplicate = (currentDeal.collaborators || []).some(
      (item) => item.email.toLowerCase() === email && item.towerCode === towerCode,
    );

    if (hasDuplicate) {
      setFlash({ text: "This collaborator already exists for the selected tower.", tone: "warning" });
      return;
    }

    const collaborator = {
      id: `collab-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name,
      email,
      towerCode,
    };
    const nextCollaborators = [...(currentDeal.collaborators || []), collaborator];

    setCollaboratorDraft({ name: "", email: "", towerCode: "MASTER" });
    await persistCollaborators(nextCollaborators, {
      successText: `${name} saved to the deal and synced to JSON.`,
      warningText: `${name} could not be saved to the backend.`,
      rollbackDraft: { name, email, towerCode },
    });
  }


  async function removeCollaborator(collaboratorId) {
    if (!currentDeal || !canEditDealMaster) {
      return;
    }

    const previousCollaborators = currentDeal.collaborators || [];
    const removedCollaborator = previousCollaborators.find((item) => item.id === collaboratorId);
    const nextCollaborators = previousCollaborators.filter((item) => item.id !== collaboratorId);

    await persistCollaborators(nextCollaborators, {
      successText: `${removedCollaborator?.name || "Collaborator"} removed from the deal.`,
      warningText: "Unable to update the collaborator list.",
    });
  }

  function upsertDeal(nextDeal) {
    setDeals((previous) => [nextDeal, ...previous.filter((deal) => deal.id !== nextDeal.id)]);
    setCurrentId(nextDeal.id);
    rememberPersistedDeal(nextDeal.id);
  }

  async function saveDeal(options = {}) {
    const {
      successText = `Deal saved for ${currentUser?.name || "current user"} in the database.`,
      warningText = "Unable to save the current deal.",
      dealPayload = currentDeal,
      targetDealId = currentDeal?.id || null,
      syncUsers = false,
      allowNonOwner = false,
      suppressFlash = false,
    } = options;

    const effectiveDeal = dealPayload || currentDeal;
    const effectiveDealId = targetDealId || effectiveDeal?.id || null;
    const shouldUpdatePersistedDeal = Boolean(effectiveDealId && persistedDealIds.has(effectiveDealId));

    if (!currentUser) {
      setFlash({ text: "Sign in first to save a deal.", tone: "warning" });
      return null;
    }

    if (!effectiveDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return null;
    }

    if (!isOwner && !allowNonOwner) {
      setFlash({ text: "Only the deal owner can save Deal Master changes in this phase.", tone: "warning" });
      return null;
    }

    setIsSyncing(true);

    try {
      const savedDeal = shouldUpdatePersistedDeal
        ? await updateDealRecord(effectiveDealId, effectiveDeal, currentUserId)
        : await createDealRecord(effectiveDeal, currentUserId);

      upsertDeal(savedDeal);
      if (suppressFlash) {
        if (syncUsers) {
          await refreshUsersDirectory();
        }
        return savedDeal;
      }
      if (syncUsers) {
        await refreshUsersDirectory();
      }
      setFlash({ text: successText, tone: "success" });
      return savedDeal;
    } catch (error) {
      setFlash({ text: error.message || warningText, tone: "warning" });
      return null;
    } finally {
      setIsSyncing(false);
    }
  }

  async function autoPopulateDiscoveryFromExtractionRun(run, dealToUpdate) {
    const baseDeal = dealToUpdate || currentDeal;
    if (!run || !baseDeal) {
      return { savedDeal: null, populatedCount: 0, conflictCount: 0, saveFailed: false };
    }

    const { suggestions, conflictTargets } = collectBestRunSuggestions(run, (suggestion) => {
      const targetPath = String(suggestion?.targetPath || '').trim();
      const controlType = String(suggestion?.controlType || '').trim().toLowerCase();
      return targetPath.startsWith(AUTO_DISCOVERY_TARGET_PREFIX) && controlType !== 'derived';
    });

    const nextSuggestions = suggestions.filter((suggestion) => {
      const targetPath = String(suggestion?.targetPath || '').trim();
      if (!targetPath || conflictTargets.has(targetPath)) {
        return false;
      }
      return isSuggestionValueEmpty(getValueAtPath(baseDeal, targetPath));
    });

    if (!nextSuggestions.length) {
      return { savedDeal: null, populatedCount: 0, conflictCount: conflictTargets.size, saveFailed: false };
    }

    const nextDeal = clonePlainDeal(baseDeal);
    const nextIntake = nextDeal.documentIntake && typeof nextDeal.documentIntake === 'object'
      ? nextDeal.documentIntake
      : { documents: [], latestRun: null, companyOverview: null, history: [], updatedAt: '' };
    let populatedCount = 0;

    nextSuggestions.forEach((suggestion) => {
      const nextValue = normalizePopulatedSuggestionValue({
        ...suggestion,
        resolvedValue: suggestion?.proposedValue,
      });
      if (isSuggestionValueEmpty(nextValue)) {
        return;
      }
      applySuggestedValueToDeal(nextDeal, suggestion, nextValue, users);
      populatedCount += 1;
    });

    if (!populatedCount) {
      return { savedDeal: null, populatedCount: 0, conflictCount: conflictTargets.size, saveFailed: false };
    }

    const updatedAt = nowIso();
    const nextCompanyOverview = run?.companyOverview && typeof run.companyOverview === 'object'
      ? clonePlainDeal(run.companyOverview)
      : nextIntake.companyOverview || null;

    nextDeal.documentIntake = {
      ...nextIntake,
      companyOverview: nextCompanyOverview,
      latestRun: {
        ...(nextIntake.latestRun && typeof nextIntake.latestRun === 'object'
          ? nextIntake.latestRun
          : clonePlainDeal(run)),
        ...(nextCompanyOverview ? { companyOverview: nextCompanyOverview } : {}),
        discoveryAutofillCount: populatedCount,
        discoveryAutofilledAt: updatedAt,
      },
      updatedAt,
    };

    const normalizedWorkspace = normalizeFpaWorkspace(nextDeal.fpaWorkspace || createDefaultFpaWorkspace());
    const nextFpaStatus = deriveFpaWorkspaceStatus(normalizedWorkspace);
    nextDeal.fpaWorkspace = {
      ...normalizedWorkspace,
      status: nextFpaStatus,
    };
    nextDeal.towerStatus_FPA = nextFpaStatus;
    nextDeal.updatedAt = updatedAt;

    const savedDeal = await saveDeal({
      successText: '',
      warningText: 'Unable to save auto-filled FP&A Discovery values.',
      dealPayload: nextDeal,
      targetDealId: baseDeal.id,
      suppressFlash: true,
    });

    return {
      savedDeal,
      populatedCount,
      conflictCount: conflictTargets.size,
      saveFailed: populatedCount > 0 && !savedDeal,
    };
  }

  async function handleExtractDealDocuments(files) {
    if (!currentUser) {
      setFlash({ text: "Sign in first to extract deal documents.", tone: "warning" });
      return null;
    }

    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return null;
    }

    if (!canEditDealMaster) {
      setFlash({ text: "Only the deal owner can run document extraction in this phase.", tone: "warning" });
      return null;
    }

    const uploadFiles = Array.from(files || []).filter(Boolean);
    if (!uploadFiles.length) {
      setFlash({ text: "Select at least one file before extracting.", tone: "info" });
      return null;
    }

    let effectiveDeal = currentDeal;
    if (!persistedDealIds.has(currentDeal.id)) {
      const savedDeal = await saveDeal({
        successText: "Draft saved before document extraction.",
        warningText: "Unable to save the draft before document extraction.",
      });

      if (!savedDeal) {
        return null;
      }

      effectiveDeal = savedDeal;
    }

    setIsSyncing(true);
    setActiveExtractionJob(null);

    try {
      const kickoff = await extractDealDocumentsRecord(effectiveDeal.id, uploadFiles, currentUserId);
      const kickoffRun = kickoff?.run;
      if (!kickoffRun?.id) {
        throw new Error("Unable to start document extraction.");
      }

      setActiveExtractionJob(kickoffRun);
      let response = kickoff;
      const finalStatuses = new Set(["completed", "partial", "failed"]);

      while (!finalStatuses.has(String(response?.run?.status || "").trim().toLowerCase())) {
        await new Promise((resolve) => window.setTimeout(resolve, EXTRACTION_STATUS_POLL_MS));
        response = await fetchDealDocumentExtractionStatusRecord(effectiveDeal.id, kickoffRun.id, currentUserId);
        if (response?.run) {
          setActiveExtractionJob(response.run);
        }
      }

      if (response?.deal) {
        upsertDeal(response.deal);
      }

      const runStatus = String(response?.run?.status || "").trim().toLowerCase();
      const autoPopulateResult = response?.run && response?.deal
        ? await autoPopulateDiscoveryFromExtractionRun(response.run, response.deal)
        : { savedDeal: null, populatedCount: 0, conflictCount: 0, saveFailed: false };
      const extractedCount = Number(response?.run?.documentCount || 0);
      const failureCount = Number(response?.run?.failureCount || 0);
      const memoryFieldCount = Number(response?.run?.memorySummary?.fieldCount || 0);
      const logicBuilderFieldCount = Number(response?.run?.logicBuilderSummary?.reviewFieldCount || 0);
      const companyOverviewFieldCount = Number(response?.run?.companyOverview?.fieldCount || response?.deal?.documentIntake?.companyOverview?.fieldCount || 0);
      const discoveryAutofillCount = Number(autoPopulateResult?.populatedCount || 0);
      const discoveryConflictCount = Number(autoPopulateResult?.conflictCount || 0);
      const runErrorMessage = String(response?.errorMessage || "").trim();
      let flashTone = "success";
      let flashText = `${extractedCount || uploadFiles.length} document(s) uploaded and previewed.`;

      if (runStatus === "failed" && extractedCount === 0) {
        flashTone = "warning";
        flashText = runErrorMessage || `${failureCount || uploadFiles.length} file(s) uploaded, but no structured extraction was saved. Review the latest run details in Deal Master.`;
      } else if (failureCount > 0 && extractedCount > 0) {
        flashTone = "warning";
        flashText = `${extractedCount} document(s) extracted, ${failureCount} file(s) need review. ${memoryFieldCount} field(s) are now stored in extraction memory.`;
      } else if (failureCount > 0) {
        flashTone = "warning";
        flashText = `${failureCount} file(s) uploaded, but no structured extraction was saved. Review the latest run details in Deal Master.`;
      } else if (memoryFieldCount > 0) {
        flashText = `${extractedCount || uploadFiles.length} document(s) uploaded and previewed. ${memoryFieldCount} field(s) are now stored in extraction memory.`;
      }

      if (logicBuilderFieldCount > 0) {
        flashText += ` ${logicBuilderFieldCount} field(s) are ready in Logic Builder for review.`;
      }

      if (companyOverviewFieldCount > 0) {
        flashText += ` Company overview is ready in Deal Master.`;
      }

      if (discoveryAutofillCount > 0) {
        flashText += ` ${discoveryAutofillCount} FP&A Discovery field(s) were synced automatically.`;
      }

      if (discoveryConflictCount > 0) {
        flashText += ` ${discoveryConflictCount} conflicting Discovery field(s) stayed in review.`;
      }

      if (autoPopulateResult?.saveFailed) {
        flashTone = 'warning';
        flashText += ' Discovery auto-fill could not be saved to JSON.';
      }

      setFlash({
        text: flashText,
        tone: flashTone,
      });
      return response;
    } catch (error) {
      setFlash({ text: error.message || "Unable to extract the uploaded documents.", tone: "warning" });
      return null;
    } finally {
      setActiveExtractionJob(null);
      setIsSyncing(false);
    }
  }

  async function handlePopulateDocumentSuggestions({ documentId, fileName = "", suggestions = [] } = {}) {
    if (!currentUser) {
      setFlash({ text: "Sign in first to populate extracted values.", tone: "warning" });
      return null;
    }

    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return null;
    }

    if (!canEditDealMaster) {
      setFlash({ text: "Only the deal owner can populate extracted values into the deal.", tone: "warning" });
      return null;
    }

    const reviewedSuggestions = Array.isArray(suggestions) ? suggestions : [];
    if (!reviewedSuggestions.length) {
      setFlash({ text: "No extracted suggestions are available to populate yet.", tone: "info" });
      return null;
    }

    let effectiveDeal = currentDeal;
    if (!persistedDealIds.has(currentDeal.id)) {
      const savedDeal = await saveDeal({
        successText: "Draft saved before populating extracted fields.",
        warningText: "Unable to save the draft before populating extracted fields.",
      });

      if (!savedDeal) {
        return null;
      }

      effectiveDeal = savedDeal;
    }

    const nextDeal = clonePlainDeal(effectiveDeal);
    const nextIntake = nextDeal.documentIntake && typeof nextDeal.documentIntake === "object"
      ? nextDeal.documentIntake
      : { documents: [], latestRun: null, history: [], updatedAt: "" };
    const nextDocuments = Array.isArray(nextIntake.documents) ? [...nextIntake.documents] : [];

    let populatedCount = 0;
    reviewedSuggestions.forEach((suggestion) => {
      const targetPath = String(suggestion?.targetPath || "").trim();
      const nextValue = normalizePopulatedSuggestionValue(suggestion);
      if (!targetPath || isSuggestionValueEmpty(nextValue)) {
        return;
      }

      applySuggestedValueToDeal(nextDeal, suggestion, nextValue, users);
      populatedCount += 1;
    });

    if (!populatedCount) {
      setFlash({
        text: "No values were populated. Leave at least one suggested value filled before clicking Populate.",
        tone: "info",
      });
      return null;
    }

    if (documentId) {
      const documentIndex = nextDocuments.findIndex((document) => document?.id === documentId);
      if (documentIndex >= 0) {
        const currentDocument = nextDocuments[documentIndex] && typeof nextDocuments[documentIndex] === "object"
          ? nextDocuments[documentIndex]
          : {};
        const currentPreview = currentDocument.preview && typeof currentDocument.preview === "object"
          ? currentDocument.preview
          : {};

        nextDocuments[documentIndex] = {
          ...currentDocument,
          fieldSuggestionCount: reviewedSuggestions.length,
          preview: {
            ...currentPreview,
            fieldSuggestions: reviewedSuggestions.map((suggestion) => ({
              ...suggestion,
              proposedValue: normalizeSuggestionDisplayValue(suggestion?.resolvedValue ?? suggestion?.proposedValue),
            })),
          },
        };
      }
    }

    nextIntake.documents = nextDocuments;
    syncAcceptedExtractionState(nextIntake, reviewedSuggestions, currentUser);
    nextDeal.documentIntake = nextIntake;

    const normalizedWorkspace = normalizeFpaWorkspace(nextDeal.fpaWorkspace || createDefaultFpaWorkspace());
    const nextFpaStatus = deriveFpaWorkspaceStatus(normalizedWorkspace);
    nextDeal.fpaWorkspace = {
      ...normalizedWorkspace,
      status: nextFpaStatus,
    };
    nextDeal.towerStatus_FPA = nextFpaStatus;
    nextDeal.updatedAt = nowIso();

    setIsPopulatingDocumentSuggestions(true);
    try {
      return await saveDeal({
        successText: `${populatedCount} field(s) populated${fileName ? ` from ${fileName}` : ""} into the deal workspace.`,
        warningText: "Unable to populate the extracted field suggestions.",
        dealPayload: nextDeal,
        targetDealId: effectiveDeal.id,
      });
    } finally {
      setIsPopulatingDocumentSuggestions(false);
    }
  }

  async function handlePopulateLogicBuilderFields({ fields = [] } = {}) {
    return handlePopulateDocumentSuggestions({
      documentId: "",
      fileName: "Logic Builder",
      suggestions: Array.isArray(fields) ? fields : [],
    });
  }


  function startNewDeal() {
    if (!currentUser) {
      setFlash({ text: "Sign in first to create a deal.", tone: "warning" });
      return;
    }

    const draft = buildStarterDeal(deals.length + 1);
    setDeals((previous) => [draft, ...previous.filter((deal) => deal.id !== draft.id)]);
    setCurrentId(draft.id);
    goToDealPage(draft.id, VIEW_DEAL_MASTER);
    setActiveSection("step-logic");
    setFlash({ text: "New draft opened. Fill the Deal Master and save when ready.", tone: "success" });
  }

  async function duplicateCurrentDraft() {
    if (!currentUser) {
      setFlash({ text: "Sign in first to duplicate a deal.", tone: "warning" });
      return;
    }

    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return;
    }

    setIsSyncing(true);

    try {
      if (isCurrentDealPersisted) {
        const savedDeal = await duplicateDealRecord(currentDeal.id, currentUserId);
        upsertDeal(savedDeal);
        goToDealPage(savedDeal.id, VIEW_DEAL_MASTER);
        setFlash({ text: `Deal duplicated into ${currentUser.name}'s workspace.`, tone: "success" });
      } else {
        const localCopy = duplicateLocalDeal(currentDeal, { currentUser: currentUser || FALLBACK_USERS[0] });
        setDeals((previous) => [localCopy, ...previous.filter((deal) => deal.id !== localCopy.id)]);
        setCurrentId(localCopy.id);
        goToDealPage(localCopy.id, VIEW_DEAL_MASTER);
        setFlash({ text: "Local draft duplicated.", tone: "success" });
      }

      setActiveSection("step-logic");
    } catch {
      const localCopy = duplicateLocalDeal(currentDeal, { currentUser: currentUser || FALLBACK_USERS[0] });
      setDeals((previous) => [localCopy, ...previous.filter((deal) => deal.id !== localCopy.id)]);
      setCurrentId(localCopy.id);
      goToDealPage(localCopy.id, VIEW_DEAL_MASTER);
      setFlash({ text: "Backend duplicate failed. A local copy is ready instead.", tone: "warning" });
    } finally {
      setIsSyncing(false);
    }
  }

  function exportCurrentDraft() {
    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return;
    }

    exportDeal(currentDeal);
    setFlash({ text: "Draft exported as JSON.", tone: "success" });
  }

  function handleDownloadDealSummary(deal) {
    if (!deal) {
      setFlash({ text: "Select a deal first.", tone: "info" });
      return;
    }

    const fileName = downloadDealSummaryReport(deal);
    setFlash({ text: `Summary report downloaded: ${fileName}`, tone: "success" });
  }

  async function handleDeleteDealDocument(document) {
    if (!currentUser) {
      setFlash({ text: "Sign in first to delete extracted documents.", tone: "warning" });
      return;
    }

    if (!currentDeal?.id) {
      setFlash({ text: "Open a deal first to manage extraction documents.", tone: "warning" });
      return;
    }

    if (!canEditDealMaster) {
      setFlash({ text: "Only the deal owner can delete extracted documents.", tone: "warning" });
      return;
    }

    const documentId = String(document?.id || document?.documentId || "").trim();
    const fileName = String(document?.fileName || "this document").trim() || "this document";
    if (!documentId) {
      setFlash({ text: "Unable to identify this document for deletion.", tone: "warning" });
      return;
    }

    const confirmed = window.confirm(`Delete ${fileName} from extraction memory? This removes it from the latest extraction review and document register.`);
    if (!confirmed) {
      return;
    }

    setDeletingDocumentId(documentId);
    setIsSyncing(true);

    try {
      const response = await deleteDealDocumentRecord(currentDeal.id, documentId, currentUserId);
      if (response?.deal) {
        upsertDeal(response.deal);
      }
      if (response?.run && currentDeal?.id) {
        setActiveExtractionJob({
          ...response.run,
          dealId: currentDeal.id,
        });
      } else {
        setActiveExtractionJob(null);
      }
      setFlash({ text: `${fileName} deleted from extraction memory.`, tone: "success" });
    } catch (error) {
      setFlash({ text: error.message || `Unable to delete ${fileName}.`, tone: "warning" });
    } finally {
      setDeletingDocumentId("");
      setIsSyncing(false);
    }
  }

  async function handleDeleteDeal(deal) {
    if (!currentUser) {
      setFlash({ text: "Sign in first to delete a deal.", tone: "warning" });
      return;
    }

    if (!deal?.id) {
      setFlash({ text: "Unable to delete this deal right now.", tone: "warning" });
      return;
    }

    const title = deal.draftLabel || deal.dealId || "this deal";
    const confirmed = window.confirm(`Delete ${title}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const isPersisted = persistedDealIds.has(deal.id);
    setIsSyncing(true);

    try {
      if (isPersisted) {
        const collection = await deleteDealRecord(deal.id, currentUserId);
        applyCollection(collection);
      } else {
        const nextDeals = deals.filter((item) => item.id !== deal.id);
        setDeals(nextDeals);
        setPersistedDealIds((previous) => {
          const next = new Set(previous);
          next.delete(deal.id);
          return next;
        });

        const nextCurrentId = currentId === deal.id ? (nextDeals[0]?.id || null) : currentId;
        setCurrentId(nextCurrentId);

        const currentRoute = parsePortalRoute(window.location.pathname);
        if (currentRoute.dealId === deal.id) {
          if (nextCurrentId && WORKSPACE_VIEWS.includes(currentRoute.view)) {
            goToDealPage(nextCurrentId, currentRoute.view, { replace: true });
          } else {
            goToDeals({ replace: true });
          }
        }
      }

      setFlash({ text: `${title} deleted.`, tone: "success" });
    } catch (error) {
      setFlash({ text: error.message || `Unable to delete ${title}.`, tone: "warning" });
    } finally {
      setIsSyncing(false);
    }
  }

  async function openDeal(dealId, nextView = VIEW_DEAL_MASTER) {
    if (!currentUser) {
      setFlash({ text: "Sign in first to open a deal.", tone: "warning" });
      return;
    }

    goToDealPage(dealId, nextView);
    if (nextView === VIEW_DEAL_MASTER) {
      setActiveSection("step-logic");
    } else if (nextView === VIEW_FPA) {
      setActiveSection(FPA_TABS[0]?.id || "overview");
    } else if (nextView === VIEW_P2P) {
      setActiveSection(P2P_TABS[0]?.id || "overview");
    }

    if (!persistedDealIds.has(dealId)) {
      setFlash({ text: nextView === VIEW_COLLABORATORS ? "Local draft collaborator page opened." : "Local draft loaded.", tone: "success" });
      return;
    }

    try {
      const collection = await setCurrentDealRecord(dealId, currentUserId);
      applyCollection(collection, dealId);
      setFlash({
        text: nextView === VIEW_COLLABORATORS ? "Collaborator page opened for the selected deal." : "Deal loaded from backend store.",
        tone: "success",
      });
    } catch (error) {
      setFlash({ text: error.message || "Unable to sync the current deal selection.", tone: "warning" });
    }
  }

  async function saveFpaWorkspace() {
    if (!currentUser) {
      setFlash({ text: "Sign in first to save FP&A.", tone: "warning" });
      return;
    }

    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return;
    }

    if (!canEditFpa) {
      setFlash({ text: "Only the deal owner or assigned FP&A users can save this workspace.", tone: "warning" });
      return;
    }

    const normalizedWorkspace = normalizeFpaWorkspace(currentDeal.fpaWorkspace || createDefaultFpaWorkspace());
    const status = deriveFpaWorkspaceStatus(normalizedWorkspace);
    const nextDeal = {
      ...currentDeal,
      fpaWorkspace: {
        ...normalizedWorkspace,
        status,
      },
      towerStatus_FPA: status,
    };

    await saveDeal({
      successText: `FP&A workspace saved for ${currentUser?.name || "current user"}.`,
      warningText: "Unable to save the FP&A workspace.",
      dealPayload: nextDeal,
      targetDealId: currentDeal.id,
      allowNonOwner: canEditFpa && !isOwner,
    });
  }

  async function saveP2pWorkspace() {
    if (!currentUser) {
      setFlash({ text: "Sign in first to save P2P.", tone: "warning" });
      return;
    }

    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return;
    }

    if (!canEditP2p) {
      setFlash({ text: "Only the deal owner or assigned P2P users can save this workspace.", tone: "warning" });
      return;
    }

    const normalizedWorkspace = normalizeP2pWorkspace(currentDeal.p2pWorkspace || createDefaultP2pWorkspace());
    const existingWorkbookInputs = currentDeal.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
      ? currentDeal.p2pWorkbookInputs
      : {};
    const workbookInputs = syncP2pWorkbookInputsFromWorkspace(normalizedWorkspace, existingWorkbookInputs);
    const status = deriveP2pWorkspaceStatus(normalizedWorkspace, workbookInputs);
    const nextDeal = {
      ...currentDeal,
      p2pWorkbookInputs: workbookInputs,
      p2pWorkspace: {
        ...normalizedWorkspace,
        status,
      },
      towerStatus_P2P: status,
    };

    await saveDeal({
      successText: `P2P workspace saved for ${currentUser?.name || "current user"}.`,
      warningText: "Unable to save the P2P workspace.",
      dealPayload: nextDeal,
      targetDealId: currentDeal.id,
      allowNonOwner: canEditP2p && !isOwner,
    });
  }

  async function saveCollaborators() {
    if (!currentUser) {
      setFlash({ text: "Sign in first to save collaborators.", tone: "warning" });
      return;
    }

    if (!currentDeal) {
      setFlash({ text: "Create or open a deal first.", tone: "info" });
      return;
    }

    if (!canEditDealMaster) {
      setFlash({ text: "Only the deal owner can save collaborators in this phase.", tone: "warning" });
      return;
    }

    await saveDeal({
      successText: "Collaborators saved to the deal.",
      warningText: "Unable to save collaborator changes.",
      syncUsers: true,
    });
  }

  const completion = currentDeal ? completionPercent(currentDeal) : 0;
  const scopeCount = currentDeal ? scopedTowerCount(currentDeal) : 0;
  const readOnlyMessage = currentDeal
    ? canViewAllSections && !isOwner
      ? `${currentUser?.name || "This user"} can review the full deal in read-only mode. Collaborator assignments and Deal Master edits stay owner-controlled in this phase.`
      : `${currentUser?.name || "This user"} is currently assigned to ${assignedTowerLabels.length ? assignedTowerLabels.join(", ") : "this deal"}. Only the matching tower workspace is visible here, and collaborator edits stay owner-controlled in this phase.`
    : "Create or open a deal first.";
  const dealSummary = currentDeal
    ? [
        { label: "Client", value: currentDeal.clientName || "-" },
        { label: "Deal ID", value: currentDeal.dealId || "-" },
        { label: "Owner", value: currentDeal.dealOwnerName || "-" },
        { label: "Access", value: accessLabel(accessRole) },
        { label: "Programme", value: currentDeal.programName || "-" },
        { label: "Term", value: `${currentDeal.contractTerm || "-"} years` },
        ...(currentDeal.sourceSummary
          ? [
              {
                label: "Source Pack",
                value: currentDeal.sourceSummary.sourcePackName || "Workbook-backed seed",
              },
            ]
          : []),
        { label: "Updated", value: formatDateTime(currentDeal.updatedAt), muted: true },
      ]
    : [];
  const scopeSummary = currentDeal
    ? TOWERS.map((tower) => {
        const scope = currentDeal[`towerScope_${tower.code}`];
        const lead = currentDeal[`towerLead_${tower.code}`];
        return {
          label: tower.label,
          value: scope ? lead || "Unassigned" : "Out of scope",
          muted: !scope,
        };
      })
    : [];
  const readinessSummary = currentDeal
    ? [
        { label: "Completion", value: `${completion}% complete across the shared Deal Master shell` },
        { label: "Collaborators", value: `${collaboratorCount} tagged to this deal` },
        { label: "Scope Count", value: `${scopeCount} tower${scopeCount === 1 ? "" : "s"} currently in scope` },
        {
          label: "Commercial Mode",
          value: `${currentDeal.pricingConstruct} / ${currentDeal.transitionCommercials} / ${currentDeal.transformationFunding}`,
        },
        {
          label: "Notes",
          value: currentDeal.reviewNotes || "No review notes added yet.",
          muted: !currentDeal.reviewNotes,
        },
        ...(currentDeal.sourceSummary
          ? [
              {
                label: "Source Coverage",
                value: `${currentDeal.sourceSummary.workbookCount || 0} workbook${currentDeal.sourceSummary.workbookCount === 1 ? "" : "s"} ? ${currentDeal.sourceSummary.pdfCount || 0} PDF${currentDeal.sourceSummary.pdfCount === 1 ? "" : "s"}`,
              },
            ]
          : []),
      ]
    : [];
  function renderPortalPageIcon(view) {
    if (view === VIEW_DEALS) {
      return <DealsSidebarIcon />;
    }

    if (view === VIEW_PRESALES_DASHBOARD) {
      return <PresalesSidebarIcon />;
    }

    if (view === VIEW_PMO_DASHBOARD) {
      return <PmoSidebarIcon />;
    }

    if (view === VIEW_DEAL_REPOSITORY) {
      return <RepoSidebarIcon />;
    }

    return <IntakeSidebarIcon />;
  }

  function getPortalPageAction(view) {
    if (view === VIEW_DEALS) {
      return () => goToDeals();
    }

    if (view === VIEW_PRESALES_DASHBOARD) {
      return () => goToPresalesDashboard();
    }

    if (view === VIEW_PMO_DASHBOARD) {
      return () => goToPmoDashboard();
    }

    if (view === VIEW_DEAL_REPOSITORY) {
      return () => goToDealRepository();
    }

    return () => goToNewDealIntake();
  }

  const appSidebarItems = PAGE_NAV.map((item) => ({
    ...item,
    active: currentView === item.id,
    icon: renderPortalPageIcon(item.id),
    onClick: getPortalPageAction(item.id),
  }));

  function renderEmptyDealState(title, copy) {
    return (
      <section className="compact-card empty-state">
        <div>
          <p className="section-kicker">Workspace</p>
          <h2>{title}</h2>
          <p className="muted-copy">{copy}</p>
        </div>
        <div className="deal-card-actions">
          <button type="button" className="btn btn-primary" onClick={startNewDeal} disabled={isBusy}>
            Create New Deal
          </button>
          {sortedDeals.length > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => goToDeals()}>
              Back to All Deals
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  function renderDealOverviewSection(title, copy, items) {
    return (
      <section className="compact-card deal-list-panel">
        <div className="deal-list-panel-head">
          <div>
            <p className="section-kicker">Workspace</p>
            <h3>{title}</h3>
            <p className="muted-copy">{copy}</p>
          </div>
          <span className="section-chip">{items.length}</span>
        </div>
        {items.length > 0 ? (
          <div className="deal-overview-grid">
            {items.map((deal) => (
              <DealOverviewCard
                key={deal.id}
                deal={deal}
                currentUserId={currentUserId}
                onOpen={() => {
                  void openDeal(deal.id, VIEW_DEAL_MASTER);
                }}
                onOpenCollaborators={() => {
                  void openDeal(deal.id, VIEW_COLLABORATORS);
                }}
                onDownloadSummary={() => {
                  handleDownloadDealSummary(deal);
                }}
                onDelete={deal.dealOwnerUserId === currentUserId ? () => {
                  void handleDeleteDeal(deal);
                } : undefined}
                isDeleting={isSyncing}
              />
            ))}
          </div>
        ) : (
          <p className="sidebar-empty">No deals in this section yet.</p>
        )}
      </section>
    );
  }

  function renderDealsPage() {
    const activeDealCount = sortedDeals.filter((deal) => !["Won", "Lost", "Archived"].includes(deal.dealStatus)).length;
    const reviewDeals = sortedDeals.filter(
      (deal) =>
        ["READY WITH REVIEW ITEMS", "SUBMIT-READY"].includes(deal.watermark) ||
        ["In Review", "Approved for Submission", "Submitted"].includes(deal.dealStatus),
    );
    const filterOptions = [
      {
        key: "all",
        label: "All Deals",
        count: sortedDeals.length,
        items: sortedDeals,
        copy: "Everything visible to you in one place.",
      },
      {
        key: "owned",
        label: "Owned",
        count: ownedDeals.length,
        items: ownedDeals,
        copy: "Deals you created and control.",
      },
      {
        key: "assigned",
        label: "Assigned",
        count: assignedDeals.length,
        items: assignedDeals,
        copy: "Deals where you are supporting a tower.",
      },
      {
        key: "review",
        label: "Review Queue",
        count: reviewDeals.length,
        items: reviewDeals,
        copy: "Deals that need review or submission attention.",
      },
    ];
    const activeFilter = filterOptions.find((filter) => filter.key === dealListFilter) || filterOptions[0];
    const visibleDeals = activeFilter.items;
    const heroStats = [
      {
        label: "Visible",
        value: sortedDeals.length,
        note: "Access scope",
        icon: "?",
      },
      {
        label: "Owned",
        value: ownedDeals.length,
        note: "Owner managed",
        icon: "?",
      },
      {
        label: "Assigned",
        value: assignedDeals.length,
        note: "Tower support",
        icon: "?",
      },
      {
        label: "Active",
        value: activeDealCount,
        note: "Live pipeline",
        icon: "?",
      },
    ];

    return sortedDeals.length > 0 ? (
      <div className="deals-page-layout">
        <section className="compact-card deals-showcase">
          <div className="deals-showcase-grid">
            <div className="deals-showcase-copy">
              <p className="section-kicker deals-showcase-kicker">Finance Workspace</p>
              <h2>All Deals</h2>
              <p className="page-copy">
                Track active pursuits, shared tower assignments, and commercial drafts from one finance-ready command view.
              </p>
            </div>

            <div className="deals-showcase-actions">
              <div className="deals-toolbar-actions deals-showcase-cta">
                <button type="button" className="btn btn-primary" onClick={startNewDeal} disabled={isBusy}>
                  Create New Deal
                </button>
                {renderProfileMenu("deals-profile-menu")}
              </div>
            </div>
          </div>

          <div className="deals-mini-stats deals-mini-stats-premium">
            {heroStats.map((stat) => (
              <article key={stat.label} className="deals-mini-stat">
                <span className="deals-mini-stat-icon" aria-hidden="true">
                  {stat.icon}
                </span>
                <div className="deals-mini-stat-copy">
                  <span className="summary-label">{stat.label}</span>
                  <span className="muted-copy">{stat.note}</span>
                </div>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="compact-card deal-list-panel deal-list-panel-premium deals-list-panel">
          <div className="deals-filter-bar deals-filter-bar-premium" role="tablist" aria-label="Deal filters">
            <div className="deals-filter-tabs">
              {filterOptions.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`deals-filter-chip ${dealListFilter === filter.key ? "is-active" : ""}`}
                  onClick={() => setDealListFilter(filter.key)}
                  aria-pressed={dealListFilter === filter.key}
                >
                  <span>{filter.label}</span>
                  <strong>{filter.count}</strong>
                </button>
              ))}
            </div>
            <div className="deals-filter-summary">
              <span className="section-chip">{visibleDeals.length} shown - {sortedDeals.length} total visible</span>
            </div>
          </div>

          <div className="deal-list-shell">
            <div className="deals-list-columns" aria-hidden="true">
              <span>Deal</span>
              <span>Commercial</span>
              <span>Readiness</span>
              <span>Coverage</span>
              <span>Actions</span>
            </div>

          {visibleDeals.length > 0 ? (
            <div className="deal-overview-grid deal-overview-grid-compact deal-overview-grid-rows">
              {visibleDeals.map((deal) => (
                <DealOverviewCard
                  key={deal.id}
                  deal={deal}
                  currentUserId={currentUserId}
                  onOpen={() => {
                    void openDeal(deal.id, VIEW_DEAL_MASTER);
                  }}
                  onOpenCollaborators={() => {
                    void openDeal(deal.id, VIEW_COLLABORATORS);
                  }}
                  onDownloadSummary={() => {
                    handleDownloadDealSummary(deal);
                  }}
                  onDelete={deal.dealOwnerUserId === currentUserId ? () => {
                    void handleDeleteDeal(deal);
                  } : undefined}
                  isDeleting={isSyncing}
                />
              ))}
            </div>
          ) : (
            <p className="sidebar-empty">No deals match this view right now.</p>
          )}
          </div>
        </section>
      </div>
    ) : (
      renderEmptyDealState(
        "No deals yet",
        "Create a deal to start shaping the commercial and tower plan.",
        "Your saved deals will appear here once created or assigned.",
        <button type="button" className="btn btn-primary" onClick={startNewDeal} disabled={isBusy}>
          Create New Deal
        </button>,
      )
    );
  }

  function renderLoginPage() {
    const isSignUp = authMode === AUTH_MODE_SIGNUP;

    return (
      <div className="auth-shell">
        <section className="auth-visual">
          <div className="auth-motion-layer" aria-hidden="true">
            <span className="auth-orb auth-orb-a" />
            <span className="auth-orb auth-orb-b" />
            <span className="auth-orb auth-orb-c" />
            <span className="auth-beam auth-beam-a" />
            <span className="auth-beam auth-beam-b" />
          </div>
          <div className="auth-visual-copy">
            <p className="eyebrow">HCLTech Finance</p>
            <h1>Every assigned deal, one secure login.</h1>
            <p>
              Create your account once, sign in with your email and password, and the platform shows the deals assigned to you with your exact deal role.
            </p>
            <div className="auth-feature-list">
              <article className="auth-feature-card">
                <strong>Assigned Visibility</strong>
                <span>See only the deals linked to your account, collaborator email, or tower assignment.</span>
              </article>
              <article className="auth-feature-card">
                <strong>Role-Aware Access</strong>
                <span>Each deal shows whether you are the owner, a tower lead, or a collaborator.</span>
              </article>
              <article className="auth-feature-card">
                <strong>Shared Delivery</strong>
                <span>Deal owners can build the master, while assigned users follow their own roles and access.</span>
              </article>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="compact-card auth-card">
            <div className="auth-tab-row">
              <button
                type="button"
                className={`auth-tab ${authMode === AUTH_MODE_LOGIN ? "active" : ""}`}
                onClick={() => setAuthMode(AUTH_MODE_LOGIN)}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === AUTH_MODE_SIGNUP ? "active" : ""}`}
                onClick={() => setAuthMode(AUTH_MODE_SIGNUP)}
              >
                Create Account
              </button>
            </div>

            <div className="auth-copy-block">
              <p className="eyebrow">{isSignUp ? "Create Your Access" : "Welcome Back"}</p>
              <h2>{isSignUp ? "Set up your workspace profile" : "Sign in to your deal workspace"}</h2>
              <p className="page-copy">
                {isSignUp
                  ? "Use your name, role, email, and password to create an account. If a deal is already assigned to your email, it will appear after sign-in."
                  : "Enter your email and password. Your assigned deals and your role on each deal will appear immediately after login."}
              </p>
            </div>

            <div className={`flash-message ${flash.text ? `is-${flash.tone}` : ""}`}>{flash.text}</div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {isSignUp ? (
                <div className="auth-form-split">
                  <TextField
                    label="Full Name"
                    name="name"
                    value={authForm.name}
                    placeholder="Enter your full name"
                    disabled={isAuthenticating}
                    onChange={updateAuthForm}
                  />
                  <SelectField
                    label="Your Role"
                    name="role"
                    value={authForm.role}
                    options={AUTH_ROLE_OPTIONS}
                    disabled={isAuthenticating}
                    onChange={updateAuthForm}
                  />
                </div>
              ) : null}

              <TextField
                label="Email Address"
                name="email"
                type="email"
                value={authForm.email}
                placeholder="name@company.com"
                disabled={isAuthenticating}
                onChange={updateAuthForm}
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                value={authForm.password}
                placeholder="Enter your password"
                disabled={isAuthenticating}
                onChange={updateAuthForm}
              />

              {isSignUp ? (
                <TextField
                  label="Confirm Password"
                  name="confirmPassword"
                  type="password"
                  value={authForm.confirmPassword}
                  placeholder="Re-enter your password"
                  disabled={isAuthenticating}
                  onChange={updateAuthForm}
                />
              ) : null}

              <button type="submit" className="btn btn-primary auth-submit" disabled={isAuthenticating}>
                {isAuthenticating
                  ? isSignUp
                    ? "Creating Account..."
                    : "Signing In..."
                  : isSignUp
                    ? "Create Account"
                    : "Sign In"}
              </button>
            </form>

            <p className="auth-caption">
              Deals assigned to your email, your tower ownership, or your collaborator role automatically appear in your workspace after authentication.
            </p>
          </div>
        </section>
      </div>
    );
  }


  function renderDealMasterPage() {
    if (!currentDeal) {
      return renderEmptyDealState(
        "No deal selected",
        "Create a new deal or open an existing one from All Deals to continue.",
      );
    }

    const overviewClientName = currentDeal.clientName || companyOverview?.companyName || "<Client Name>";

    return (
      <div className="deal-master-page">
         {/* <section id="overview" className="metrics-strip deal-master-summary-strip">
           <article className="overview-card compact-card overview-card-main deal-master-hero-card">
            <div className="deal-master-hero-copy">
              <div className="deal-master-hero-head">
                <div>
                  <p className="section-kicker">Active Deal</p>
                  <h3>{currentDeal.draftLabel || currentDeal.dealId}</h3>
                </div>
                <span className="deal-master-hero-id">{currentDeal.dealId || "Pending Deal ID"}</span>
              </div>

              <div className="deal-master-hero-meta">
                <div className="deal-master-hero-meta-item">
                  <span>Client</span>
                  <strong>{overviewClientName}</strong>
                </div>
                <div className="deal-master-hero-meta-item">
                  <span>Programme</span>
                  <strong>{currentDeal.programName || "Programme pending"}</strong>
                </div>
                <div className="deal-master-hero-meta-item">
                  <span>Owner</span>
                  <strong>{currentDeal.dealOwnerName || currentUser?.name || "Owner TBD"}</strong>
                </div>
                <div className="deal-master-hero-meta-item">
                  <span>Workspace</span>
                  <strong>{currentUser?.name || "Signed-in User"}</strong>
                </div>
              </div>

              <div className="deal-master-hero-pill-row">
                <StatusPill tone={pillTone(currentDeal.watermark)}>{currentDeal.watermark}</StatusPill>
                <StatusPill tone="info">{currentDeal.dealStatus}</StatusPill>
                <StatusPill tone={accessTone(accessRole)}>{accessLabel(accessRole)}</StatusPill>
                {discoveryAutofillCount > 0 ? <StatusPill tone="success">{discoveryAutofillCount} Discovery fields synced</StatusPill> : null}
              </div>
            </div>
          </article> 

          <MetricCard label="Completion" value={`${completion}%`} note="Shared deal master fill" />
          <MetricCard label="Collaborators" value={String(collaboratorCount)} note="Tagged to this deal" />
          <MetricCard label="Store" value={isCurrentDealPersisted ? "deals.json" : "Local draft"} note={storeNote} />
        </section>  */}

        {!canEditDealMaster ? (
          <section className="compact-card info-banner">
            <div>
              <p className="section-kicker">Access</p>
              <h3>Deal Master is read-only in this workspace</h3>
              <p className="muted-copy">{readOnlyMessage}</p>
            </div>
            <StatusPill tone={accessTone(accessRole)}>{accessLabel(accessRole)}</StatusPill>
          </section>
        ) : null}

        {canViewAllSections ? (
        <>
        <DealDocumentIntakeSection
          currentDeal={currentDeal}
          canEditDealMaster={canEditDealMaster}
          isBusy={isBusy}
          activeExtractionJob={activeExtractionJob && activeExtractionJob.dealId === currentDeal?.id ? activeExtractionJob : null}
          onExtractDocuments={handleExtractDealDocuments}
          onPopulateSuggestions={handlePopulateDocumentSuggestions}
          onPopulateReviewQueue={handlePopulateLogicBuilderFields}
          onDeleteDocument={handleDeleteDealDocument}
          deletingDocumentId={deletingDocumentId}
          isPopulating={isPopulatingDocumentSuggestions}
        />
        <DealPortalCopilotSection
          key={`${currentDeal.id}-${currentUser.id}`}
          currentDeal={currentDeal}
          currentUser={currentUser}
          isBusy={isBusy}
          isPersisted={persistedDealIds.has(currentDeal.id)}
        />
        <DealLogicBuilderSection
          currentDeal={currentDeal}
          canEditDealMaster={canEditDealMaster}
          isBusy={isBusy}
          onPopulateReviewQueue={handlePopulateLogicBuilderFields}
          onDeleteDocument={handleDeleteDealDocument}
          deletingDocumentId={deletingDocumentId}
          isPopulating={isPopulatingDocumentSuggestions}
        />
        <section id="step-0" className="compact-card step-card">
          <div className="step-header">
            <div>
              <span className="step-badge">Step 3</span>
              <h3>Deal identity</h3>
            </div>
            <StatusPill tone="info">Shared shell</StatusPill>
          </div>
          <div className="field-grid field-grid-4">
            <TextField label="Draft Label" name="draftLabel" value={currentDeal.draftLabel} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Client Name" name="clientName" value={currentDeal.clientName} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Deal ID" name="dealId" value={currentDeal.dealId} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Programme Name" name="programName" value={currentDeal.programName} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Deal Owner" name="dealOwnerName" value={currentDeal.dealOwnerName || currentUser?.name || ""} onChange={() => {}} disabled />
            <TextField label="Presales Lead" name="presalesLead" value={currentDeal.presalesLead} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Bid Date" name="bidDate" type="date" value={currentDeal.bidDate} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <SelectField label="Deal Status" name="dealStatus" value={currentDeal.dealStatus} onChange={updateCurrentDeal} options={DEAL_STATUSES} disabled={!canEditDealMaster || isBusy} />
            <SelectField label="Watermark / Stance" name="watermark" value={currentDeal.watermark} onChange={updateCurrentDeal} options={WATERMARKS} disabled={!canEditDealMaster || isBusy} />
          </div>
        </section>

        <section id="step-1" className="compact-card step-card">
          <div className="step-header">
            <div>
              <span className="step-badge">Step 4</span>
              <h3>Term, finance, and currency</h3>
            </div>
            <StatusPill tone="neutral">BRD 7.1 aligned</StatusPill>
          </div>
          <div className="field-grid field-grid-4">
            <SelectField label="Contract Term" name="contractTerm" value={currentDeal.contractTerm} onChange={updateCurrentDeal} options={TERM_OPTIONS} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Discount Rate %" name="discountRate" type="number" min="0" max="30" step="0.1" value={currentDeal.discountRate} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="COLA from Y2 %" name="colaRate" type="number" min="0" max="10" step="0.1" value={currentDeal.colaRate} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Corporate Overhead %" name="corporateOverhead" type="number" min="0" max="30" step="0.1" value={currentDeal.corporateOverhead} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <SelectField label="Display Currency" name="displayCurrency" value={currentDeal.displayCurrency} onChange={updateCurrentDeal} options={CURRENCIES} disabled={!canEditDealMaster || isBusy} />
            <TextField label="FX Rate" name="fxRate" type="number" min="0.0001" step="0.0001" value={currentDeal.fxRate} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Total Customer Finance FTE" name="customerFinanceFte" type="number" min="0" step="0.1" value={currentDeal.customerFinanceFte} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Finance Cost Baseline" name="financeCostBaseline" type="number" min="0" step="1000" value={currentDeal.financeCostBaseline} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
          </div>
        </section>

        <section id="step-2" className="compact-card step-card">
          <div className="step-header">
            <div>
              <span className="step-badge">Step 5</span>
              <h3>Commercial constructs and policies</h3>
            </div>
            <StatusPill tone="warning">Core commercial setup</StatusPill>
          </div>
          <div className="field-grid field-grid-4">
            <SelectField label="Pricing Construct" name="pricingConstruct" value={currentDeal.pricingConstruct} onChange={updateCurrentDeal} options={PRICING_CONSTRUCTS} disabled={!canEditDealMaster || isBusy} />
            <SelectField label="Transition Commercials" name="transitionCommercials" value={currentDeal.transitionCommercials} onChange={updateCurrentDeal} options={TRANSITION_COMMERCIALS} disabled={!canEditDealMaster || isBusy} />
            <SelectField label="Transformation Funding" name="transformationFunding" value={currentDeal.transformationFunding} onChange={updateCurrentDeal} options={TRANSFORMATION_FUNDING} disabled={!canEditDealMaster || isBusy} />
            <SelectField label="Benchmark Percentile Policy" name="benchmarkPolicy" value={currentDeal.benchmarkPolicy} onChange={updateCurrentDeal} options={BENCHMARK_POLICIES} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Committed Productivity Y2 %" name="committedProdY2" type="number" min="0" max="30" step="0.1" value={currentDeal.committedProdY2} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Committed Productivity Y3 %" name="committedProdY3" type="number" min="0" max="30" step="0.1" value={currentDeal.committedProdY3} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Committed Productivity Y4+ %" name="committedProdY4" type="number" min="0" max="30" step="0.1" value={currentDeal.committedProdY4} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
            <TextField label="Compact Notes Flag" name="notesTag" value={currentDeal.notesTag} onChange={updateCurrentDeal} disabled={!canEditDealMaster || isBusy} />
          </div>
        </section>

        </>
        ) : null}

        {canViewTowerSection ? (
        <section id="step-3" className="compact-card step-card">
          <div className="step-header">
            <div>
              <span className="step-badge">Step 6</span>
              <h3>Tower scope and ownership</h3>
            </div>
            <StatusPill tone={canViewAllSections ? "success" : "info"}>
              {canViewAllSections ? "Collaboration shell" : "Tower-scoped view"}
            </StatusPill>
          </div>
          <p className="section-note">
            {canEditDealMaster
              ? "Use this step for in-scope towers and workspace owners. Use Add Collaborators to capture names, emails, and tower contacts."
              : canViewAllSections
                ? "You can review every tower on this deal, but collaborator management remains owner-controlled."
                : `Only the ${assignedTowerLabels.join(", ") || "assigned"} tower workspace${assignedTowerLabels.length === 1 ? "" : "s"} is visible to your login.`}
          </p>
          {visibleTowers.length > 0 ? (
          <div className="tower-grid">
            {visibleTowers.map((tower) => (
              <TowerCard
                key={tower.code}
                sectionId={`tower-${tower.code}`}
                tower={tower}
                deal={currentDeal}
                users={users}
                onScopeChange={updateTowerScope}
                onOwnerChange={updateTowerOwner}
                disabled={!canEditDealMaster || isBusy}
              />
            ))}
          </div>
          ) : (
            <p className="sidebar-empty">No tower workspace is assigned to your login yet.</p>
          )}
          {canViewAllSections ? (
          <label className="field-block field-block-full">
            <span>Bid / Review Notes</span>
            <textarea
              rows="3"
              value={currentDeal.reviewNotes}
              disabled={!canEditDealMaster || isBusy}
              onChange={(event) => updateCurrentDeal("reviewNotes", event.target.value)}
            />
          </label>
          ) : null}
        </section>

        ) : null}

        {canViewAllSections ? (
        <section id="step-4" className="compact-card step-card">
          <div className="step-header">
            <div>
              <span className="step-badge">Step 7</span>
              <h3>Review snapshot</h3>
            </div>
            <StatusPill tone="info">Draft preview</StatusPill>
          </div>
          <div className="review-grid">
            <article className="review-panel">
              <h4>Deal Summary</h4>
              <SummaryList rows={dealSummary} />
            </article>
            <article className="review-panel">
              <h4>Scope &amp; Ownership</h4>
              <SummaryList rows={scopeSummary} />
            </article>
            <article className="review-panel review-panel-wide">
              <h4>Readiness Notes</h4>
              <SummaryList rows={readinessSummary} />
            </article>
          </div>
        </section>

        ) : null}
      </div>
    );
  }

  function renderFpaPage() {
    if (!currentDeal) {
      return renderEmptyDealState(
        "No deal selected",
        "Create a new deal or open an existing one from All Deals to continue.",
      );
    }

    if (!canViewFpa) {
      return renderEmptyDealState(
        "FP&A not assigned",
        "This FP&A workspace is visible only to the deal owner, Deal Master collaborators, or assigned FP&A users.",
      );
    }

    return (
      <FpaWorkspacePage
        currentDeal={currentDeal}
        accessRole={accessRole}
        accessLabel={accessLabel}
        accessTone={accessTone}
        canEditFpa={canEditFpa}
        isBusy={isBusy}
        isLoading={isLoading}
        isSyncing={isSyncing}
        currentUserId={currentUserId}
        currentUserName={currentUser?.name || ""}
        activeSection={activeSection}
        onSelectTab={setActiveSection}
        onSave={() => {
          void saveFpaWorkspace();
        }}
        onUpdateDiscoveryField={updateFpaDiscoveryField}
        onUpdateScopeItem={updateFpaScopeItem}
        onUpdateNotes={updateFpaNotes}
        onUpdateWorkbookCell={updateFpaWorkbookCell}
        onUpdateWorkspace={updateFpaWorkspace}
      />
    );
  }

  function renderP2pPage() {
    if (!currentDeal) {
      return renderEmptyDealState(
        "No deal selected",
        "Create a new deal or open an existing one from All Deals to continue.",
      );
    }

    if (!canViewP2p) {
      return renderEmptyDealState(
        "P2P not assigned",
        "This P2P workspace is visible only to the deal owner, Deal Master collaborators, or assigned P2P users.",
      );
    }

    return (
      <P2pWorkspacePage
        currentDeal={currentDeal}
        accessRole={accessRole}
        accessLabel={accessLabel}
        accessTone={accessTone}
        canEditP2p={canEditP2p}
        isBusy={isBusy}
        isLoading={isLoading}
        isSyncing={isSyncing}
        currentUserId={currentUserId}
        currentUserName={currentUser?.name || ""}
        activeSection={activeSection}
        onSelectTab={setActiveSection}
        onSave={() => {
          void saveP2pWorkspace();
        }}
        onUpdateCell={updateP2pWorkbookCell}
        onUpdateWorkspace={updateP2pWorkspace}
      />
    );
  }

  function renderCollaboratorsPage() {
    if (!currentDeal) {
      return renderEmptyDealState(
        "No deal selected",
        "Create a new deal or open an existing one before adding collaborators.",
      );
    }

    const collaborators = currentDeal.collaborators || [];

    return (
      <>

        <section className="compact-card collaborator-panel">
          <div className="step-header">
            <div>
              <span className="step-badge">Page</span>
              <h3>Collaborator Registry</h3>
            </div>
            <StatusPill tone="info">{collaborators.length} collaborators</StatusPill>
          </div>
          <p className="section-note">
            {canEditDealMaster
              ? "Capture the people working this deal across towers before building the detailed tower workspaces."
              : "This collaborator list is read-only in your workspace. The deal owner manages who is assigned to each tower."}
          </p>

          {!canEditDealMaster ? (
            <div className="info-banner">
              <div>
                <p className="section-kicker">Access</p>
                <h3>Collaborators are read-only in this workspace</h3>
                <p className="muted-copy">{readOnlyMessage}</p>
              </div>
              <StatusPill tone={accessTone(accessRole)}>{accessLabel(accessRole)}</StatusPill>
            </div>
          ) : null}

          {canEditDealMaster ? (
            <div className="field-grid field-grid-4 collaborator-form-grid">
              <TextField
                label="Collaborator Name"
                name="name"
                value={collaboratorDraft.name}
                onChange={updateCollaboratorDraft}
                placeholder="Enter collaborator name"
                disabled={isBusy}
              />
              <TextField
                label="Collaborator Email"
                name="email"
                value={collaboratorDraft.email}
                onChange={updateCollaboratorDraft}
                placeholder="name@company.com"
                disabled={isBusy}
              />
              <SelectField
                label="Tower"
                name="towerCode"
                value={collaboratorDraft.towerCode}
                onChange={updateCollaboratorDraft}
                options={COLLABORATOR_TOWER_OPTIONS}
                disabled={isBusy}
              />
              <div className="collaborator-form-actions">
                <button type="button" className="btn btn-primary" onClick={addCollaborator} disabled={isBusy}>
                  Add Collaborator
                </button>
              </div>
            </div>
          ) : null}

          {collaborators.length > 0 ? (
            <div className="collaborator-grid">
              {collaborators.map((collaborator) => (
                <CollaboratorCard
                  key={collaborator.id}
                  collaborator={collaborator}
                  canEdit={canEditDealMaster}
                  onRemove={() => removeCollaborator(collaborator.id)}
                />
              ))}
            </div>
          ) : (
            <p className="sidebar-empty">No collaborators added yet.</p>
          )}
        </section>
      </>
    );
  }

  function renderProfileMenu(className = "") {
    const isDealsProfileMenu = className.includes("deals-profile-menu");
    const popoverInlineStyle = isDealsProfileMenu
      ? profilePopoverStyle || { position: "fixed", visibility: "hidden", pointerEvents: "none" }
      : undefined;

    return (
      <div ref={profileMenuRef} className={`profile-menu ${className} ${isProfileMenuOpen ? "is-open" : ""}`.trim()}>
        <button
          ref={profileTriggerRef}
          type="button"
          className="profile-trigger"
          aria-label="Open profile details"
          aria-expanded={isProfileMenuOpen}
          aria-haspopup="dialog"
          onClick={() => setIsProfileMenuOpen((previous) => !previous)}
        >
          <span className="profile-avatar" aria-hidden="true">{currentUserInitials}</span>
        </button>

        {isProfileMenuOpen ? (
          <div
            className={`profile-popover ${isDealsProfileMenu ? "is-floating" : ""}`.trim()}
            style={popoverInlineStyle}
            role="dialog"
            aria-label="User profile"
          >
            <div className="profile-popover-head">
              <span className="profile-avatar profile-avatar-lg" aria-hidden="true">{currentUserInitials}</span>
              <div className="profile-popover-copy">
                <strong>{currentUser?.name || "User"}</strong>
                <span>{currentUser?.role || "Workspace User"}</span>
              </div>
            </div>

            <div className="profile-popover-list">
              <div className="profile-popover-row">
                <span className="summary-label">Email</span>
                <span className="profile-popover-value">{currentUser?.email || "No email assigned"}</span>
              </div>
              <div className="profile-popover-row">
                <span className="summary-label">Role</span>
                <span className="profile-popover-value">{currentUser?.role || "Workspace User"}</span>
              </div>
              <div className="profile-popover-row">
                <span className="summary-label">Visible Deals</span>
                <span className="profile-popover-value">{String(sortedDeals.length)}</span>
              </div>
            </div>

            <button type="button" className="btn btn-secondary profile-popover-action" onClick={logout} disabled={isSyncing}>
              Logout
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderPortalHeader() {
    const hasCurrentDeal = Boolean(currentDeal);
    const isDealsView = currentView === VIEW_DEALS;
    const isDealMasterView = currentView === VIEW_DEAL_MASTER;
    const isFpaView = currentView === VIEW_FPA;
    const isCollaboratorsView = currentView === VIEW_COLLABORATORS;
    const isP2pView = currentView === VIEW_P2P;
    const isTowerView = isFpaView || isP2pView;
    const pageEyebrow = isDealsView
      ? "Workspace"
      : isDealMasterView
        ? "Deal Builder"
        : isTowerView
          ? "Tower Workspace"
          : "Collaboration";
    const pageTitle = isDealsView
      ? "All Deals"
      : isFpaView
        ? "FP&A Workspace"
        : isP2pView
          ? "P2P Workspace"
          : currentDeal?.draftLabel || currentDeal?.dealId || (isCollaboratorsView ? "Collaborators" : "Deal Master");
    const pageCopy = isDealsView
      ? `See every deal visible to ${currentUser?.name || "your workspace"}. Deals are grouped by what you own and what is assigned to you.`
      : isDealMasterView
        ? currentDeal
          ? canEditDealMaster
            ? "Fill the shared Deal Master first, then use Add Collaborators to capture who will work this deal by tower."
            : canViewAllSections
              ? "You can review the full Deal Master for this deal. Editing and collaborator management stay with the deal owner."
              : `You can view only the ${assignedTowerLabels.join(", ") || "assigned"} tower workspace${assignedTowerLabels.length === 1 ? "" : "s"} tagged to your login.`
          : "Select a deal from All Deals to continue."
        : isFpaView
          ? currentDeal
            ? canEditFpa
              ? `Work through the workbook tabs in sequence. The source Excel contains ${FPA_TOTAL_FORMULAS.toLocaleString("en-IN")} formula cells across ${FPA_TABS.length} FP&A tabs, so this workspace starts with the real input tabs before the downstream engine port.`
              : `Review the FP&A workbook tabs assigned to your login. The source Excel contains ${FPA_TOTAL_FORMULAS.toLocaleString("en-IN")} formula cells across ${FPA_TABS.length} FP&A tabs.`
            : "Select a deal from All Deals to continue."
          : isP2pView
            ? currentDeal
              ? canEditP2p
                ? `Work through the workbook tabs in sequence. This P2P workspace now runs the first four tower tabs locally for instant load, while the remaining tabs can still fall back to workbook parity where needed.`
                : `Review the P2P workbook tabs assigned to your login. This workspace now mixes local-first tower tabs with workbook parity tabs while the rest of P2P is being ported.`
              : "Select a deal from All Deals to continue."
            : currentDeal
              ? canEditDealMaster
                ? "Add the people who will work this deal. Capture their name, email, and tower before moving into tower-specific workspaces."
                : "View the collaborators assigned to this deal. Only the deal owner can add, remove, or save collaborator assignments."
              : "Select a deal from All Deals to continue.";
    const pagePath = isDealsView
      ? buildPortalPath(VIEW_DEALS)
      : buildPortalPath(currentView, currentDeal?.id || currentId || "");

    return (
      <header id={isDealMasterView ? "overview" : undefined} className={`portal-header compact-card ${isDealMasterView ? "portal-header-deal-master" : ""}`.trim()}>
        <div className="portal-header-copy">
          <div className="portal-header-topline">
            <p className="eyebrow">{pageEyebrow}</p>
            <span className="section-chip">{pagePath}</span>
          </div>
          <h2>{pageTitle}</h2>
          <p className="page-copy">{pageCopy}</p>
        </div>

        <div className="portal-header-actions">
          <div className="portal-header-action-group">
            {isDealsView ? (
              <button type="button" className="btn btn-primary" onClick={startNewDeal} disabled={isBusy}>
                Create New Deal
              </button>
            ) : null}
            {!isDealsView ? (
              <button type="button" className="btn btn-secondary" onClick={() => goToDeals()}>
                Back to All Deals
              </button>
            ) : null}
            {hasCurrentDeal && isTowerView ? (
              <button type="button" className="btn btn-secondary" onClick={() => goToDealPage(currentDeal.id, VIEW_DEAL_MASTER)}>
                Deal Master
              </button>
            ) : null}
            {hasCurrentDeal && isTowerView && canEditDealMaster ? (
              <button type="button" className="btn btn-secondary" onClick={() => goToDealPage(currentDeal.id, VIEW_COLLABORATORS)} disabled={isBusy}>
                Collaborators
              </button>
            ) : null}
            {hasCurrentDeal && isDealMasterView && canEditDealMaster ? (
              <button type="button" className="btn btn-secondary" onClick={() => goToDealPage(currentDeal.id, VIEW_COLLABORATORS)} disabled={isBusy}>
                Add Collaborators
              </button>
            ) : null}
            {hasCurrentDeal && isDealMasterView ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void duplicateCurrentDraft();
                }}
                disabled={isBusy}
              >
                Duplicate Deal
              </button>
            ) : null}
            {hasCurrentDeal && isDealMasterView && canEditDealMaster ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  void saveDeal();
                }}
                disabled={isBusy}
              >
                {isSyncing && !isLoading ? "Saving..." : "Save Deal"}
              </button>
            ) : null}
            {hasCurrentDeal && isDealMasterView ? (
              <button type="button" className="btn btn-secondary" onClick={exportCurrentDraft} disabled={isLoading}>
                Export Deal JSON
              </button>
            ) : null}
            {hasCurrentDeal && isCollaboratorsView ? (
              <button type="button" className="btn btn-secondary" onClick={() => goToDealPage(currentDeal.id, VIEW_DEAL_MASTER)}>
                Deal Master
              </button>
            ) : null}
            {hasCurrentDeal && isCollaboratorsView && canEditDealMaster ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  void saveCollaborators();
                }}
                disabled={isBusy}
              >
                {isSyncing && !isLoading ? "Saving..." : "Save Collaborators"}
              </button>
            ) : null}
          </div>

          {renderProfileMenu()}
        </div>
      </header>
    );
  }

  function renderCurrentPage() {
    if (currentView === VIEW_DEALS) {
      return renderDealsPage();
    }

    if (currentView === VIEW_PRESALES_DASHBOARD) {
      return (
        <DealPortfolioDashboard
          deals={sortedDeals}
          allDeals={sortedDeals}
          currentUserId={currentUserId}
          title="Presales Dashboard"
          subtitle="Live dashboard generated from your portal deals instead of the static prototype. Metrics stay aligned to the same deal master, tower scope, collaborator, and readiness fields used across the portal."
          filterLabel="All Deals"
          isStandalone
          onOpenDeal={(dealId) => {
            void openDeal(dealId, VIEW_DEAL_MASTER);
          }}
        />
      );
    }

    if (currentView === VIEW_PMO_DASHBOARD) {
      return <EmbeddedTrackerPage key={VIEW_PMO_DASHBOARD} route="pmo" title="PMO Deal Dashboard" />;
    }

    if (currentView === VIEW_DEAL_REPOSITORY) {
      return <EmbeddedTrackerPage key={VIEW_DEAL_REPOSITORY} route="deals" title="Deal Repository" />;
    }

    if (currentView === VIEW_NEW_DEAL_INTAKE) {
      return (
        <EmbeddedTrackerPage
          key={VIEW_NEW_DEAL_INTAKE}
          route="deals"
          title="New Deal Intake"
          onReadyAction="open-new-deal-intake"
        />
      );
    }

    if (currentView === VIEW_FPA) {
      return renderFpaPage();
    }

    if (currentView === VIEW_P2P) {
      return renderP2pPage();
    }

    if (currentView === VIEW_COLLABORATORS) {
      return renderCollaboratorsPage();
    }

    return renderDealMasterPage();
  }

  const showSidebar = true;
  const showPortalHeader = isWorkspaceView;
  const showPortalPagesSidebar = !isWorkspaceView;

  if (!isAuthenticated) {
    return renderLoginPage();
  }

  return (
    <div className={`portal-shell ${showSidebar ? "" : "without-sidebar"} ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`.trim()}>
      {showSidebar ? (
        <aside className={`portal-sidebar ${isSidebarCollapsed ? "is-collapsed" : ""}`.trim()}>
          <div className="sidebar-brand">
            <div className="sidebar-brand-head">
              <div className="sidebar-brand-copy">
                <p className="eyebrow">HCLTech</p>
                {!isSidebarCollapsed ? <h1>Deal Workspace</h1> : null}
              </div>
              <button
                type="button"
                className="sidebar-collapse-toggle"
                onClick={() => setIsSidebarCollapsed((previous) => !previous)}
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <SidebarToggleIcon collapsed={isSidebarCollapsed} />
              </button>
            </div>
            {!isSidebarCollapsed ? (
              <p className="sidebar-copy">Browse all deals, then switch into the Presales, PMO, deal repo, or intake views from the same portal shell.</p>
            ) : null}
          </div>

          {showPortalPagesSidebar ? (
            <section className="compact-card sidebar-app-panel">
              {!isSidebarCollapsed ? <p className="sidebar-section-label">Portal Pages</p> : null}
              <div className="sidebar-link-list app-sidebar-links">
                {appSidebarItems.map((item) => (
                  <SidebarLink
                    key={item.id}
                    item={item}
                    active={item.active}
                    onClick={item.onClick}
                    collapsed={isSidebarCollapsed}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <div className="workspace-sidebar-groups">
            {workspaceSidebarGroups.length === 0 ? (
              !isSidebarCollapsed ? (
                <div className="compact-card workspace-sidebar-empty">
                  <p className="summary-label">Deal Workspace</p>
                  <p className="muted-copy">
                    {currentDeal
                      ? "Open a deal workspace tab to see the shared shell and assigned tower navigation here."
                      : "Open any deal from All Deals to unlock the shared shell and tower workspace tabs."}
                  </p>
                </div>
              ) : null
            ) : (
              workspaceSidebarGroups.map((group) => (
                <SidebarGroup
                  key={group.id}
                  group={group}
                  expanded={!isSidebarCollapsed && expandedWorkspaceGroup === group.id}
                  collapsed={isSidebarCollapsed}
                  onToggle={() => handleSidebarGroupToggle(group.id)}
                />
              ))
            )}
          </div>

          {isEmbeddedDashboardView ? <div className="sidebar-footer">{renderProfileMenu("sidebar-profile-menu")}</div> : null}
        </aside>
      ) : null}

      <main className={`portal-main ${isEmbeddedDashboardView ? "is-embedded-dashboard-view" : ""} ${currentView === VIEW_DEALS ? "is-deals-view" : ""}`.trim()}>
        {showPortalHeader ? renderPortalHeader() : null}
        <div className={`flash-message ${flash.text ? `is-${flash.tone}` : ""}`}>{flash.text}</div>
        {renderCurrentPage()}
        {currentView === VIEW_DEALS ? <PortalCopilotWidget currentUser={currentUser} deals={sortedDeals} isBusy={isBusy} /> : null}
      </main>
    </div>
  );
}





















