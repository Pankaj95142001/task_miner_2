import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "../utils/dealMaster";

const ACCEPTED_FILE_TYPES = ".pdf,.ppt,.pptx,.xls,.xlsx,.xlsm,.csv,.txt,.md,.json,.doc,.docx";
const REVIEW_ORDER = [
  "Deal Identity",
  "Finance & Currency",
  "Commercial Setup",
  "Towers & Ownership",
  "02 Discovery",
  "03 Scope L3",
  "04 Benchmarks",
  "05 Workload",
  "06 Complexity",
  "07 Personas",
  "08 AI Benefit",
  "09 Ops Model",
  "10 Rate Card",
  "13 Pricing",
  "14 Outcome",
  "15 Transition",
  "20 Recommend",
  "21 Client Value",
  "24 Governance",
  "28 Change Log",
  "30 SCPL",
  "31 Sizing & Band Mix",
];
const TOWER_ORDER = { "Deal Master": 0, "FP&A": 1, RTR: 2, O2C: 3, P2P: 4 };
const VISUAL_STEPS = ["Reading docs", "Running AI agents", "Syncing results"];

function rankSection(section) {
  const index = REVIEW_ORDER.indexOf(String(section || "").trim());
  return index >= 0 ? index : REVIEW_ORDER.length + 10;
}

function compareGroups(left, right) {
  const leftTower = String(left?.tower || "Deal Master").trim();
  const rightTower = String(right?.tower || "Deal Master").trim();
  const towerDiff = (TOWER_ORDER[leftTower] ?? 99) - (TOWER_ORDER[rightTower] ?? 99);
  if (towerDiff !== 0) return towerDiff;
  const sectionDiff = rankSection(left?.section) - rankSection(right?.section);
  if (sectionDiff !== 0) return sectionDiff;
  return `${leftTower} ${left?.section || ""}`.localeCompare(`${rightTower} ${right?.section || ""}`);
}

function formatBytes(sizeBytes) {
  const numericSize = Number(sizeBytes);
  if (!Number.isFinite(numericSize) || numericSize <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = numericSize;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : value >= 100 ? 0 : 1)} ${units[index]}`;
}

function formatStatusLabel(status) {
  return String(status || "Preview").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function toneForStatus(status) {
  if (["completed", "ai_extracted", "accepted", "locked", "populated"].includes(String(status || "").trim().toLowerCase())) return "success";
  if (["partial", "failed", "warning", "conflict", "low", "very low"].includes(String(status || "").trim().toLowerCase())) return "warning";
  if (["pending", "medium", "info", "running"].includes(String(status || "").trim().toLowerCase())) return "info";
  return "neutral";
}

function normalizeValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}

function isVisiblePortalField(item) {
  const targetPath = normalizeValue(item?.targetPath || item?.id);
  const fieldKey = normalizeValue(item?.fieldKey);
  return targetPath !== "colaRate" && fieldKey !== "colaRate";
}

function countFieldSuggestions(document) {
  if (Array.isArray(document?.preview?.fieldSuggestions)) {
    return document.preview.fieldSuggestions.filter(isVisiblePortalField).length;
  }
  if (Number.isFinite(Number(document?.fieldSuggestionCount))) return Number(document.fieldSuggestionCount);
  return 0;
}

function countSections(document) {
  const suggestions = Array.isArray(document?.preview?.fieldSuggestions)
    ? document.preview.fieldSuggestions.filter(isVisiblePortalField)
    : [];
  if (suggestions.length || Array.isArray(document?.preview?.fieldSuggestions)) {
    return new Set(suggestions.map((item) => `${item.tower || ""}::${item.section || ""}`).filter(Boolean)).size;
  }
  if (Number.isFinite(Number(document?.sectionCount))) return Number(document.sectionCount);
  return 0;
}

function groupRows(rows) {
  const groups = new Map();
  (Array.isArray(rows) ? rows : []).forEach((item) => {
    const tower = item?.tower || "Deal Master";
    const section = item?.section || "General";
    const key = `${tower}::${section}`;
    if (!groups.has(key)) groups.set(key, { key, tower, section, rows: [] });
    groups.get(key).rows.push(item);
  });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    rows: [...group.rows].sort((left, right) => `${left?.subsection || ""} ${left?.fieldLabel || left?.fieldKey || ""}`.localeCompare(`${right?.subsection || ""} ${right?.fieldLabel || right?.fieldKey || ""}`)),
  })).sort(compareGroups);
}

function suggestionKey(documentId, suggestion, index) {
  return [documentId || "document", suggestion?.targetPath || suggestion?.fieldKey || "field", index].join("::");
}

function reviewFieldKey(field) {
  return [field?.id || field?.targetPath || field?.fieldKey || "field"].join("::");
}

function mergeUniqueFiles(currentFiles, nextFiles) {
  const merged = new Map();
  [...currentFiles, ...nextFiles].forEach((file) => {
    if (file) merged.set([file?.name || "", file?.size || 0, file?.lastModified || 0].join("::"), file);
  });
  return Array.from(merged.values());
}

function StatPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`.trim()}>{children}</span>;
}

function MetaCard({ label, value }) {
  return (
    <div className="fpa-discovery-modal-meta-item">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function SummaryGrid({ rows = [] }) {
  return (
    <div className="summary-list">
      {rows.map((row) => (
        <div key={row.label} className="summary-item">
          <span className="summary-label">{row.label}</span>
          <span className="summary-value">{row.value || "-"}</span>
        </div>
      ))}
    </div>
  );
}

function ColumnTable({ rows = [], showNote = false }) {
  const visibleRows = (Array.isArray(rows) ? rows : []).filter((row) => normalizeValue(row?.label) || normalizeValue(row?.value) || normalizeValue(row?.note));
  if (!visibleRows.length) {
    return null;
  }

  return (
    <div className="document-intake-column-table-wrap">
      <table className="document-intake-column-table">
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={`${row.label || "field"}-${index}`}>
              <th scope="row">{row.label || "Field"}</th>
              <td>
                <strong>{row.value || "-"}</strong>
                {showNote && row.note ? <small>{row.note}</small> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildCompanyOverviewRows(overview, limit = 4) {
  return (Array.isArray(overview?.fields) ? overview.fields : [])
    .filter((field) => normalizeValue(field?.value))
    .slice(0, limit)
    .map((field) => ({ label: field?.label || field?.fieldKey || "Field", value: field?.value || "-" }));
}

function normalizeResearchRows(rows, limit = 4) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => normalizeValue(row?.label) || normalizeValue(row?.value))
    .slice(0, limit)
    .map((row) => ({ label: row?.label || "Field", value: row?.value || "-", note: row?.note || "" }));
}

function normalizeResearchRisks(rows, limit = 4) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => normalizeValue(row?.risk) || normalizeValue(row?.implication))
    .slice(0, limit)
    .map((row) => ({ risk: row?.risk || "Risk", severity: row?.severity || "Review", implication: row?.implication || "", source: row?.source || "" }));
}

function normalizeResearchSources(rows, limit = 6) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => normalizeValue(row?.title) || normalizeValue(row?.domain))
    .slice(0, limit)
    .map((row) => ({ title: row?.title || row?.domain || "Source", domain: row?.domain || "", asOfDate: row?.asOfDate || "", note: row?.note || "" }));
}

function InlineEditor({ value, onChange, controlType = "text", allowedValues = [], disabled = false }) {
  const safeValue = normalizeValue(value);
  if (Array.isArray(allowedValues) && allowedValues.length) {
    return (
      <select value={allowedValues.includes(safeValue) ? safeValue : (safeValue || allowedValues[0])} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {allowedValues.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  return <input type={String(controlType || "").toLowerCase() === "number" ? "number" : "text"} value={safeValue} onChange={(event) => onChange(event.target.value)} disabled={disabled} />;
}

export default function DealDocumentIntakeSection({
  currentDeal,
  canEditDealMaster,
  isBusy,
  activeExtractionJob = null,
  onExtractDocuments,
  onPopulateSuggestions,
  onPopulateReviewQueue,
  onDeleteDocument,
  deletingDocumentId = "",
  isPopulating = false,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isCompanyResearchModalOpen, setIsCompanyResearchModalOpen] = useState(false);
  const [activeReviewGroupKey, setActiveReviewGroupKey] = useState("");
  const [editedSuggestionValues, setEditedSuggestionValues] = useState({});
  const [editedReviewValues, setEditedReviewValues] = useState({});
  const [editedResearchValues, setEditedResearchValues] = useState({});
  const [uploadSnapshot, setUploadSnapshot] = useState({ fileCount: 0, totalSizeBytes: 0 });
  const fileInputRef = useRef(null);

  const documentIntake = currentDeal?.documentIntake && typeof currentDeal.documentIntake === "object"
    ? currentDeal.documentIntake
    : {};
  const storedLatestRun = documentIntake?.latestRun && typeof documentIntake.latestRun === "object"
    ? documentIntake.latestRun
    : null;
  const liveRun = activeExtractionJob && typeof activeExtractionJob === "object"
    ? activeExtractionJob
    : null;
  const latestRun = liveRun || storedLatestRun;
  const storedDocuments = Array.isArray(documentIntake.documents) ? documentIntake.documents : [];
  const liveDocuments = Array.isArray(liveRun?.documents) ? liveRun.documents : [];
  const documents = useMemo(() => {
    if (!liveDocuments.length) {
      return storedDocuments;
    }
    const seenIds = new Set(liveDocuments.map((item) => item?.id).filter(Boolean));
    return [...liveDocuments, ...storedDocuments.filter((item) => !seenIds.has(item?.id))];
  }, [liveDocuments, storedDocuments]);

  const companyOverview = latestRun?.companyOverview && typeof latestRun.companyOverview === "object"
    ? latestRun.companyOverview
    : documentIntake?.companyOverview || null;
  const companyResearch = latestRun?.companyResearch && typeof latestRun.companyResearch === "object"
    ? latestRun.companyResearch
    : documentIntake?.companyResearch || null;
  const companyOverviewRows = useMemo(() => buildCompanyOverviewRows(companyOverview, 4), [companyOverview]);
  const companyOverviewSourceFiles = useMemo(
    () => (Array.isArray(companyOverview?.sourceFiles) ? companyOverview.sourceFiles.filter(Boolean).slice(0, 4) : []),
    [companyOverview],
  );
  const companyResearchMetrics = useMemo(() => normalizeResearchRows(companyResearch?.headlineMetrics, 4), [companyResearch]);
  const companyResearchBusiness = useMemo(() => normalizeResearchRows(companyResearch?.businessOverview, 6), [companyResearch]);
  const companyResearchFinancial = useMemo(() => normalizeResearchRows(companyResearch?.financialOverview, 6), [companyResearch]);
  const companyResearchDeal = useMemo(() => normalizeResearchRows(companyResearch?.dealImplications, 6), [companyResearch]);
  const companyResearchRisks = useMemo(() => normalizeResearchRisks(companyResearch?.keyRisks, 6), [companyResearch]);
  const companyResearchSources = useMemo(() => normalizeResearchSources(companyResearch?.sources, 8), [companyResearch]);
  const companyResearchOverviewFields = useMemo(
    () => (Array.isArray(companyResearch?.overviewFields) ? companyResearch.overviewFields : []),
    [companyResearch],
  );
  const companyResearchPreviewRows = useMemo(() => {
    const mergedRows = [
      ...companyResearchMetrics,
      ...companyResearchBusiness,
      ...companyResearchFinancial,
    ];
    const seenLabels = new Set();

    return mergedRows.filter((row) => {
      const label = normalizeValue(row?.label);
      if (!label || seenLabels.has(label)) {
        return false;
      }
      seenLabels.add(label);
      return true;
    }).slice(0, 6);
  }, [companyResearchMetrics, companyResearchBusiness, companyResearchFinancial]);
  const companyModalQuickRows = useMemo(
    () => (companyOverviewRows.length ? companyOverviewRows : companyResearchPreviewRows.slice(0, 4)),
    [companyOverviewRows, companyResearchPreviewRows],
  );

  const reviewFields = Array.isArray(documentIntake?.logicBuilder?.reviewQueue?.fields)
    ? documentIntake.logicBuilder.reviewQueue.fields.filter(isVisiblePortalField)
    : [];
  const groupedReviewFields = useMemo(() => groupRows(reviewFields), [reviewFields]);
  const activeReviewGroup = useMemo(
    () => groupedReviewFields.find((group) => group.key === activeReviewGroupKey) || groupedReviewFields[0] || null,
    [groupedReviewFields, activeReviewGroupKey],
  );
  const activeReviewIndex = Math.max(0, groupedReviewFields.findIndex((group) => group.key === activeReviewGroup?.key));

  const activeDocument = useMemo(
    () => documents.find((item) => item?.id === activeDocumentId) || null,
    [documents, activeDocumentId],
  );
  const activeDocumentSuggestions = useMemo(
    () => (activeDocument ? reviewedSuggestions(activeDocument) : []),
    [activeDocument, editedSuggestionValues],
  );
  const activeDocumentGroups = useMemo(() => groupRows(activeDocumentSuggestions), [activeDocumentSuggestions]);
  const activeDocumentWarnings = Array.isArray(activeDocument?.preview?.warnings)
    ? activeDocument.preview.warnings
    : [];

  useEffect(() => {
    if (activeDocumentId && !documents.some((item) => item?.id === activeDocumentId)) {
      setActiveDocumentId("");
    }
  }, [documents, activeDocumentId]);

  const reviewedCompanyResearchFields = useMemo(
    () => companyResearchOverviewFields.map((field, index) => {
      const key = suggestionKey("company-research", field, index);
      const value = Object.prototype.hasOwnProperty.call(editedResearchValues, key)
        ? editedResearchValues[key]
        : field?.resolvedValue ?? field?.proposedValue;
      return {
        ...field,
        resolvedValue: normalizeValue(value),
      };
    }),
    [companyResearchOverviewFields, editedResearchValues],
  );

  const canPopulate = canEditDealMaster && !isBusy && !isPopulating;
  const isRunActive = !!liveRun && !["completed", "partial", "failed"].includes(String(liveRun?.status || "").trim().toLowerCase());
  const isLoading = isUploading || isRunActive;
  const phase = String(liveRun?.phase || latestRun?.phase || "").trim().toLowerCase();
  const stageIndex = phase === "company-overview"
    ? 1
    : phase === "review-prep" || phase === "completed"
      ? 2
      : 0;
  const progressWidth = Number(latestRun?.progressPct || 0) || Math.round(((stageIndex + 1) / 3) * 100);
  const loadingTitle = phase === "company-overview"
    ? "Researching company extraction"
    : phase === "review-prep"
      ? "Building review-ready output"
      : "Extracting deal data with AI";
  const loadingLine = liveRun?.currentFileName
    ? `${loadingTitle} - ${liveRun.currentFileName}${Number(liveRun?.currentChunkCount || 0) > 1 ? ` - ${liveRun.currentChunkCount} chunks` : ""}`
    : loadingTitle;

  useEffect(() => {
    setSelectedFiles([]);
    setIsUploading(false);
    setIsDragActive(false);
    setActiveDocumentId("");
    setIsReviewModalOpen(false);
    setIsCompanyResearchModalOpen(false);
    setActiveReviewGroupKey("");
    setEditedSuggestionValues({});
    setEditedReviewValues({});
    setEditedResearchValues({});
    setUploadSnapshot({ fileCount: 0, totalSizeBytes: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [currentDeal?.id]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    document.body.classList.toggle("document-intake-uploading", isLoading);
    return () => document.body.classList.remove("document-intake-uploading");
  }, [isLoading]);

  function addFiles(fileList) {
    const nextFiles = Array.from(fileList || []).filter(Boolean);
    if (!nextFiles.length) {
      return;
    }
    setSelectedFiles((currentFiles) => mergeUniqueFiles(currentFiles, nextFiles));
    setIsDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearSelectedFiles() {
    setSelectedFiles([]);
    setIsDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openFilePicker() {
    if (!canEditDealMaster || isBusy || isLoading) {
      return;
    }
    fileInputRef.current?.click();
  }

  function openLatestReview() {
    if (groupedReviewFields.length) {
      setActiveReviewGroupKey((current) => current || groupedReviewFields[0].key);
      setIsReviewModalOpen(true);
      return;
    }
    if (documents[0]?.id) {
      setActiveDocumentId(documents[0].id);
    }
  }

  async function handleUpload() {
    if (!selectedFiles.length || !canEditDealMaster || isBusy || isLoading || typeof onExtractDocuments !== "function") {
      return;
    }
    setUploadSnapshot({
      fileCount: selectedFiles.length,
      totalSizeBytes: selectedFiles.reduce((sum, file) => sum + Number(file?.size || 0), 0),
    });
    setIsUploading(true);
    try {
      await onExtractDocuments(selectedFiles);
      clearSelectedFiles();
    } finally {
      setIsUploading(false);
    }
  }

  function reviewedSuggestions(documentPayload) {
    const suggestions = Array.isArray(documentPayload?.preview?.fieldSuggestions)
      ? documentPayload.preview.fieldSuggestions.filter(isVisiblePortalField)
      : [];
    return suggestions.map((suggestion, index) => {
      const key = suggestionKey(documentPayload?.id || "document", suggestion, index);
      const value = Object.prototype.hasOwnProperty.call(editedSuggestionValues, key)
        ? editedSuggestionValues[key]
        : suggestion?.resolvedValue ?? suggestion?.proposedValue;
      return {
        ...suggestion,
        resolvedValue: normalizeValue(value),
      };
    });
  }

  function reviewedFields(group) {
    return (group?.rows || []).map((field) => {
      const key = reviewFieldKey(field);
      const value = Object.prototype.hasOwnProperty.call(editedReviewValues, key)
        ? editedReviewValues[key]
        : field?.resolvedValue ?? field?.currentValue ?? field?.proposedValue;
      return {
        ...field,
        resolvedValue: normalizeValue(value),
      };
    });
  }

  async function populateDocument() {
    if (!activeDocument || typeof onPopulateSuggestions !== "function") {
      return;
    }
    const saved = await onPopulateSuggestions({
      documentId: activeDocument.id,
      fileName: activeDocument.fileName,
      suggestions: reviewedSuggestions(activeDocument),
    });
    if (saved) {
      setActiveDocumentId("");
    }
  }

  async function populateReviewGroup() {
    if (!activeReviewGroup || typeof onPopulateReviewQueue !== "function") {
      return;
    }
    const saved = await onPopulateReviewQueue({
      fields: reviewedFields(activeReviewGroup),
    });
    if (!saved) {
      return;
    }
    if (activeReviewIndex < groupedReviewFields.length - 1) {
      setActiveReviewGroupKey(groupedReviewFields[activeReviewIndex + 1].key);
      return;
    }
    setIsReviewModalOpen(false);
  }

  async function populateCompanyResearchFields() {
    if (!reviewedCompanyResearchFields.length || typeof onPopulateSuggestions !== "function") {
      return;
    }
    const saved = await onPopulateSuggestions({
      documentId: "",
      fileName: companyResearch?.companyName ? `${companyResearch.companyName} company extraction` : "Company extraction",
      suggestions: reviewedCompanyResearchFields,
    });
    if (saved) {
      setIsCompanyResearchModalOpen(false);
    }
  }
  const workflowSteps = [
    {
      key: "upload",
      number: "01",
      title: "Upload docs",
      note: selectedFiles.length ? `${selectedFiles.length} file(s) ready for one extraction run.` : "Add multiple client files in one run.",
      state: selectedFiles.length ? "active" : documents.length ? "completed" : "pending",
    },
    {
      key: "extract",
      number: "02",
      title: "Run 2 agents",
      note: "Agent 1 maps portal fields. Agent 2 researches the client company and prepares Discovery-safe overview fields.",
      state: isLoading ? "active" : documents.length ? "completed" : "pending",
    },
    {
      key: "company",
      number: "03",
      title: "Show company extraction",
      note: companyResearch
        ? `${Math.max(reviewedCompanyResearchFields.length, companyResearchPreviewRows.length)} company detail(s) ready from ${companyResearchSources.length || companyOverviewSourceFiles.length || 0} source(s).`
        : (companyOverviewRows.length ? `${companyOverviewRows.length} company fields are ready.` : "Deal Master overview appears when the research agent finishes."),
      state: companyResearch || companyOverviewRows.length ? (isLoading ? "active" : "completed") : "pending",
    },
    {
      key: "review",
      number: "04",
      title: "Review and populate",
      note: groupedReviewFields.length ? `${groupedReviewFields.length} portal tab(s) are ready for validation.` : "Open the latest review and populate one tab at a time.",
      state: groupedReviewFields.length ? "completed" : documents.length ? "active" : "pending",
    },
  ];

  const selectedFileNames = selectedFiles.map((file) => file?.name).filter(Boolean);
  const sourceSummary = companyResearchSources.length
    ? `${companyResearchSources.length} public source(s)`
    : companyOverviewSourceFiles.length
      ? `${companyOverviewSourceFiles.length} source file(s)`
      : "Company profile";
  const activeReviewConflictCount = activeReviewGroup
    ? activeReviewGroup.rows.filter((field) => Number(field?.conflictCount || 0) > 0).length
    : 0;

  return (
    <>
      {isLoading ? (
        <div className="document-intake-loading-overlay" role="status" aria-live="polite">
          <div className="document-intake-loading-card">
            <div className="document-intake-loader-hero" aria-hidden="true">
              <span className="document-intake-loader-connector is-left-top" />
              <span className="document-intake-loader-connector is-left-bottom" />
              <span className="document-intake-loader-connector is-right-top" />
              <span className="document-intake-loader-connector is-right-bottom" />
              <span className="document-intake-loader-doc is-left-top"><span /><span /><span /></span>
              <span className="document-intake-loader-doc is-left-bottom"><span /><span /><span /></span>
              <span className="document-intake-loader-doc is-right-top"><span /><span /><span /></span>
              <span className="document-intake-loader-doc is-right-bottom"><span /><span /><span /></span>
              <div className="document-intake-ai-mark document-intake-ai-mark-overlay">
                <span className="document-intake-ai-ring ring-one" />
                <span className="document-intake-ai-ring ring-two" />
                <span className="document-intake-ai-ring ring-three" />
                <span className="document-intake-ai-core" />
                <span className="document-intake-ai-core-label">AI</span>
              </div>
            </div>

            <div className="document-intake-loading-stage-copy">
              <strong className="document-intake-loading-stage-title">Extracting deal data with AI</strong>
              <p className="document-intake-loading-stage-description">{loadingLine}</p>
              <span className="document-intake-loading-stage-caption">
                {Number(latestRun?.processedFiles || 0)} of {Number(latestRun?.totalFiles || uploadSnapshot.fileCount || selectedFiles.length || 0)} files processed
              </span>
            </div>

            {companyOverviewRows.length ? (
              <div className="document-intake-loading-live-overview">
                <span className="summary-label">Deal Master overview ready</span>
                <strong>{companyOverview?.companyName || companyResearch?.companyName || "Detected company profile"}</strong>
                <SummaryGrid rows={companyOverviewRows.slice(0, 4)} />
              </div>
            ) : null}

            <div className="document-intake-live-progress-bar document-intake-live-progress-bar-hero" aria-hidden="true">
              <span style={{ width: `${Math.max(10, Math.min(100, progressWidth))}%` }} />
            </div>

            <div className="document-intake-loading-progress-steps" aria-hidden="true">
              {VISUAL_STEPS.map((step, index) => {
                const state = index < stageIndex ? "completed" : index === stageIndex ? "active" : "pending";
                return (
                  <div key={step} className={`document-intake-loading-step-light is-${state}`}>
                    <span className="document-intake-loading-step-node">{state === "completed" ? "OK" : ""}</span>
                    <span>{step}</span>
                    {index < VISUAL_STEPS.length - 1 ? <span className="document-intake-loading-step-divider" /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      <section id="step-logic" className="compact-card step-card">
        <div className="step-header">
          <div>
            <span className="step-badge">Step 1</span>
            <h3>Upload docs &amp; run AI</h3>
          </div>
          <div className="document-intake-header-actions">
            <StatPill tone={latestRun?.usedOpenAi ? "success" : "neutral"}>{latestRun?.usedOpenAi ? "AI extraction" : "Legacy preview"}</StatPill>
            <StatPill tone="info">{documents.length} documents</StatPill>
          </div>
        </div>

        <p className="section-note">
          Upload multiple client files in one run. Agent 1 extracts portal-ready fields. Agent 2 builds a richer company extraction for Deal Master overview and FP&amp;A Discovery.
        </p>

        <div className="document-intake-flow-grid">
          {workflowSteps.map((step) => (
            <article key={step.key} className={`document-intake-flow-step is-${step.state}`}>
              <span className="document-intake-flow-step-number">{step.number}</span>
              <strong>{step.title}</strong>
              <p>{step.note}</p>
            </article>
          ))}
        </div>

        {companyResearch ? (
          <div className="document-intake-company-preview-grid is-single">
            <div className="document-intake-company-preview document-intake-company-research-card">
              <div className="document-intake-company-preview-head">
                <div>
                  <span className="summary-label">AI company extraction ready</span>
                  <strong>{companyResearch.companyName || "Company research"}</strong>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCompanyResearchModalOpen(true)}>Open Extraction</button>
              </div>
              <p className="muted-copy document-intake-company-preview-note">
                {reviewedCompanyResearchFields.length
                  ? `${reviewedCompanyResearchFields.length} populate-ready Discovery field(s)`
                  : "Company extraction is ready for review."}
              </p>
              <ColumnTable rows={companyResearchPreviewRows} showNote />
              {companyOverviewSourceFiles.length ? (
                <p className="muted-copy document-intake-company-preview-note">Sources: {companyOverviewSourceFiles.join(", ")}</p>
              ) : sourceSummary ? (
                <p className="muted-copy document-intake-company-preview-note">{sourceSummary}</p>
              ) : null}
            </div>
          </div>
        ) : companyOverviewRows.length ? (
          <div className="document-intake-company-preview-grid is-single">
            <div className="document-intake-company-preview">
              <div className="document-intake-company-preview-head">
                <div>
                  <span className="summary-label">Deal Master overview ready</span>
                  <strong>{companyOverview?.companyName || "Detected company profile"}</strong>
                </div>
                <StatPill tone="success">{sourceSummary}</StatPill>
              </div>
              <ColumnTable rows={companyOverviewRows} />
              {companyOverviewSourceFiles.length ? (
                <p className="muted-copy document-intake-company-preview-note">Sources: {companyOverviewSourceFiles.join(", ")}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="document-intake-toolbar">
          <input
            ref={fileInputRef}
            className="document-intake-hidden-input"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            disabled={!canEditDealMaster || isBusy || isLoading}
            onChange={(event) => addFiles(event.target.files)}
          />

          <div
            className={`document-intake-dropzone${isDragActive ? " is-active" : ""}${isLoading ? " is-processing" : ""}${!canEditDealMaster || isBusy || isLoading ? " is-disabled" : ""}`.trim()}
            role="button"
            tabIndex={!canEditDealMaster || isBusy || isLoading ? -1 : 0}
            aria-disabled={!canEditDealMaster || isBusy || isLoading}
            onClick={openFilePicker}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openFilePicker();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!isLoading) {
                setIsDragActive(true);
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isLoading) {
                setIsDragActive(true);
              }
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!isLoading) {
                addFiles(event.dataTransfer?.files);
              }
              setIsDragActive(false);
            }}
          >
            <div className="document-intake-dropzone-copy">
              <span className="summary-label">First step</span>
              <strong>{isLoading ? "AI is extracting your uploaded documents" : "Drag & drop multiple documents here"}</strong>
              <p>
                {isLoading
                  ? "Reading pages, sheets, slides, and text content before mapping evidence into portal-ready fields."
                  : "or click to browse PDF, PowerPoint, Excel, Word, CSV, TXT, JSON, and Markdown files."}
              </p>
            </div>
            <div className="document-intake-dropzone-meta">
              <StatPill tone={isLoading ? "success" : selectedFiles.length ? "info" : "neutral"}>
                {isLoading ? "AI working" : `${selectedFiles.length} selected`}
              </StatPill>
              <span className="document-intake-dropzone-hint">
                {isLoading
                  ? "Large Excel workbooks and dense PDFs can take a little longer to process."
                  : "Files are attached together in one extraction run."}
              </span>
            </div>
          </div>

          <div className="document-intake-toolbar-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleUpload()}
              disabled={!canEditDealMaster || isBusy || isLoading || selectedFiles.length === 0}
            >
              {isLoading ? "AI Extracting..." : "Upload & Extract"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openLatestReview}
              disabled={!documents.length && !groupedReviewFields.length}
            >
              Open Latest Review
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearSelectedFiles}
              disabled={!selectedFiles.length || isLoading}
            >
              Clear
            </button>
          </div>
        </div>

        {selectedFileNames.length ? (
          <div className="document-intake-selected">
            {selectedFileNames.map((name) => <span key={name} className="document-intake-chip">{name}</span>)}
          </div>
        ) : null}

        {latestRun ? (
          <div className="document-intake-run-summary">
            <div className="document-intake-run-copy">
              <span className="summary-label">Latest extraction run</span>
              <strong>{latestRun.createdAt ? formatDateTime(latestRun.createdAt) : "In progress"}</strong>
              <p>
                {Number(latestRun.documentCount || 0)} file(s) extracted into {Number(latestRun.fieldSuggestionCount || 0)} field suggestion(s) across {Number(latestRun.sectionCount || 0)} section(s)
              </p>
            </div>
            <div className="document-intake-run-badges">
              <StatPill tone={toneForStatus(latestRun.status)}>{formatStatusLabel(latestRun.status)}</StatPill>
              {companyResearchSources.length ? <StatPill tone="info">{companyResearchSources.length} company sources</StatPill> : null}
            </div>
          </div>
        ) : null}

        <div className="document-intake-fact-wrap">
          {documents.length ? (
            <table className="document-intake-fact-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Signals</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id || document.fileName}>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{document.fileName || "Document"}</strong>
                        <span>{document.summary || document.preview?.summary || "No summary captured yet."}</span>
                      </div>
                    </td>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{document.documentType || document.preview?.documentType || "File"}</strong>
                        <span>{formatBytes(document.sizeBytes)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{countFieldSuggestions(document)} fields</strong>
                        <span>{countSections(document)} section(s)</span>
                      </div>
                    </td>
                    <td><StatPill tone={toneForStatus(document.status)}>{formatStatusLabel(document.status)}</StatPill></td>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{document.uploadedAt ? formatDateTime(document.uploadedAt) : "-"}</strong>
                        <span>{document.uploadedByName || "Unknown uploader"}</span>
                      </div>
                    </td>
                    <td className="document-intake-action-cell">
                      <div className="document-intake-row-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setActiveDocumentId(document.id)} disabled={!document.id || isLoading}>Review</button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => typeof onDeleteDocument === "function" && onDeleteDocument(document)}
                          disabled={!document.id || !canEditDealMaster || isLoading || isPopulating || String(deletingDocumentId || "") === String(document.id || "")}
                        >
                          {String(deletingDocumentId || "") === String(document.id || "") ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="sidebar-empty document-intake-empty">
              No documents uploaded yet. Add client evidence here to extract reviewable Deal Master and FP&amp;A field suggestions.
            </div>
          )}
        </div>
      </section>

      {isCompanyResearchModalOpen && companyResearch ? (
        <div className="fpa-discovery-modal-backdrop" role="presentation" onClick={() => setIsCompanyResearchModalOpen(false)}>
          <div className="fpa-discovery-modal document-intake-modal document-intake-review-modal document-intake-company-modal" role="dialog" aria-label="Company extraction research" onClick={(event) => event.stopPropagation()}>
            <div className="fpa-discovery-modal-head document-intake-company-modal-head">
              <div className="document-intake-modal-head-copy document-intake-company-modal-copy">
                <span className="section-kicker">AI company extraction</span>
                <h4>{companyResearch.companyName || companyOverview?.companyName || "Company research"}</h4>
                <p className="muted-copy">Public company research shaped for finance diligence and FP&amp;A Discovery.</p>
              </div>
              <button type="button" className="fpa-discovery-modal-close" onClick={() => setIsCompanyResearchModalOpen(false)}>{"\u00D7"}</button>
            </div>

            <div className="document-intake-company-highlight-grid">
              <article className="document-intake-company-highlight document-intake-company-highlight-wide">
                <span>Lens</span>
                <strong>{companyResearch.analysisLens || "Finance diligence"}</strong>
                <small>How this research is framed for Deal Master and FP&amp;A Discovery.</small>
              </article>
              <article className="document-intake-company-highlight">
                <span>Overview fields</span>
                <strong>{String(reviewedCompanyResearchFields.length || companyOverviewRows.length || 0)}</strong>
                <small>Populate-ready portal values</small>
              </article>
              <article className="document-intake-company-highlight">
                <span>Sources</span>
                <strong>{String(companyResearchSources.length || companyResearch?.sourceCount || 0)}</strong>
                <small>Public references used by the agent</small>
              </article>
              <article className="document-intake-company-highlight">
                <span>Updated</span>
                <strong>{companyResearch.updatedAt ? formatDateTime(companyResearch.updatedAt) : (latestRun?.createdAt ? formatDateTime(latestRun.createdAt) : "Current run")}</strong>
                <small>Latest extraction refresh</small>
              </article>
            </div>

            {companyModalQuickRows.length ? (
              <section className="document-intake-section-card document-intake-company-quickview">
                <div className="document-intake-section-head">
                  <div className="document-intake-section-title">
                    <h5>Overview snapshot</h5>
                    <span className="summary-label">Fast read before you populate fields into the portal</span>
                  </div>
                </div>
                <SummaryGrid rows={companyModalQuickRows} />
              </section>
            ) : null}

            <div className="document-intake-modal-sections document-intake-company-sections">
              {companyResearch.executiveSummary ? (
                <section className="document-intake-section-card document-intake-company-summary-card">
                  <div className="document-intake-summary">
                    <strong>Executive summary</strong>
                    <p>{companyResearch.executiveSummary}</p>
                  </div>
                </section>
              ) : null}

              {companyResearchMetrics.length ? (
                <section className="document-intake-section-card">
                  <div className="document-intake-section-head">
                    <div className="document-intake-section-title">
                      <h5>Headline metrics</h5>
                      <span className="summary-label">Public size and scale signals</span>
                    </div>
                  </div>
                  <ColumnTable rows={companyResearchMetrics} showNote />
                </section>
              ) : null}

              {companyResearchBusiness.length ? (
                <section className="document-intake-section-card">
                  <div className="document-intake-section-head">
                    <div className="document-intake-section-title">
                      <h5>Business overview</h5>
                      <span className="summary-label">Operating footprint and company shape</span>
                    </div>
                  </div>
                  <ColumnTable rows={companyResearchBusiness} showNote />
                </section>
              ) : null}

              {companyResearchFinancial.length ? (
                <section className="document-intake-section-card">
                  <div className="document-intake-section-head">
                    <div className="document-intake-section-title">
                      <h5>Financial overview</h5>
                      <span className="summary-label">Public finance signals relevant for deal analysis</span>
                    </div>
                  </div>
                  <ColumnTable rows={companyResearchFinancial} showNote />
                </section>
              ) : null}

              {companyResearchDeal.length ? (
                <section className="document-intake-section-card">
                  <div className="document-intake-section-head">
                    <div className="document-intake-section-title">
                      <h5>Deal implications</h5>
                      <span className="summary-label">What this means for FP&amp;A discovery and scoping</span>
                    </div>
                  </div>
                  <ColumnTable rows={companyResearchDeal} showNote />
                </section>
              ) : null}

              {companyResearchRisks.length ? (
                <section className="document-intake-section-card">
                  <div className="document-intake-section-head">
                    <div className="document-intake-section-title">
                      <h5>Key risks</h5>
                      <span className="summary-label">Public watch-outs to validate in discovery</span>
                    </div>
                  </div>
                  <ColumnTable
                    rows={companyResearchRisks.map((risk) => ({
                      label: risk.risk,
                      value: risk.severity || "Review",
                      note: [risk.implication, risk.source ? `Source: ${risk.source}` : ""].filter(Boolean).join(" | "),
                    }))}
                    showNote
                  />
                </section>
              ) : null}

              {reviewedCompanyResearchFields.length ? (
                <section className="document-intake-section-card document-intake-company-fields-card">
                  <div className="document-intake-section-head">
                    <div className="document-intake-section-title">
                      <h5>Discovery overview fields</h5>
                      <span className="summary-label">These values can populate Deal Master and FP&amp;A Discovery</span>
                    </div>
                    <StatPill tone="info">{reviewedCompanyResearchFields.length} fields</StatPill>
                  </div>
                  <div className="document-intake-fact-wrap">
                    <table className="document-intake-fact-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Suggested value</th>
                          <th>Evidence</th>
                          <th>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewedCompanyResearchFields.map((field, index) => {
                          const key = suggestionKey("company-research", field, index);
                          return (
                            <tr key={key}>
                              <td>
                                <div className="document-intake-table-stack">
                                  <strong>{field.fieldLabel || field.fieldKey || "Field"}</strong>
                                  <span>{field.targetPath || "Portal field"}</span>
                                </div>
                              </td>
                              <td>
                                <InlineEditor
                                  value={field.resolvedValue}
                                  onChange={(value) => setEditedResearchValues((current) => ({ ...current, [key]: value }))}
                                  controlType={field.controlType}
                                  allowedValues={field.allowedValues}
                                  disabled={!canPopulate}
                                />
                              </td>
                              <td>
                                <div className="document-intake-table-stack">
                                  <strong>{field.sourceFile || "OpenAI web research"}</strong>
                                  <span>{field.sourceLocation || "Public company research"}</span>
                                  {field.evidenceSnippet ? <small>{field.evidenceSnippet}</small> : null}
                                </div>
                              </td>
                              <td><StatPill tone={toneForStatus(field.confidence)}>{field.confidence || "Review"}</StatPill></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {companyResearchSources.length ? (
                <section className="document-intake-section-card document-intake-company-source-card">
                  <div className="document-intake-section-head">
                    <div className="document-intake-section-title">
                      <h5>Source pack</h5>
                      <span className="summary-label">Public sources used by the company research agent</span>
                    </div>
                  </div>
                  <ColumnTable
                    rows={companyResearchSources.map((source) => ({
                      label: source.title,
                      value: [source.domain, source.asOfDate].filter(Boolean).join(" | ") || "Public source",
                      note: source.note || "",
                    }))}
                    showNote
                  />
                </section>
              ) : null}
            </div>

            <div className="document-intake-suggestion-actions document-intake-company-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsCompanyResearchModalOpen(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={() => void populateCompanyResearchFields()} disabled={!canPopulate || reviewedCompanyResearchFields.length === 0}>Populate Overview Fields</button>
            </div>
          </div>
        </div>
      ) : null}

      {isReviewModalOpen && activeReviewGroup ? (
        <div className="fpa-discovery-modal-backdrop" role="presentation" onClick={() => setIsReviewModalOpen(false)}>
          <div className="fpa-discovery-modal document-intake-modal document-intake-review-modal" role="dialog" aria-label="Review extracted fields by tab" onClick={(event) => event.stopPropagation()}>
            <div className="fpa-discovery-modal-head">
              <div className="document-intake-modal-head-copy">
                <span className="section-kicker">Review queue</span>
                <h4>{activeReviewGroup.tower} | {activeReviewGroup.section}</h4>
                <p className="muted-copy">Validate one portal tab at a time, then populate it into the live deal.</p>
              </div>
              <button type="button" className="fpa-discovery-modal-close" onClick={() => setIsReviewModalOpen(false)}>{"\u00D7"}</button>
            </div>

            <div className="fpa-discovery-modal-meta document-intake-meta-grid">
              <MetaCard label="Tower" value={activeReviewGroup.tower} />
              <MetaCard label="Section" value={activeReviewGroup.section} />
              <MetaCard label="Fields" value={String(activeReviewGroup.rows.length)} />
              <MetaCard label="Conflicts" value={String(activeReviewConflictCount)} />
            </div>

            <div className="document-intake-review-tabs">
              {groupedReviewFields.map((group) => {
                const conflictCount = group.rows.filter((field) => Number(field?.conflictCount || 0) > 0).length;
                const isActive = group.key === activeReviewGroup.key;
                return (
                  <button key={group.key} type="button" className={`document-intake-review-tab${isActive ? " is-active" : ""}`} onClick={() => setActiveReviewGroupKey(group.key)}>
                    <strong>{group.section}</strong>
                    <span>{group.tower}</span>
                    <small>{group.rows.length} field(s){conflictCount ? ` | ${conflictCount} conflict(s)` : ""}</small>
                  </button>
                );
              })}
            </div>

            <div className="document-intake-modal-sections">
              <section className="document-intake-section-card">
                <div className="document-intake-section-head">
                  <div className="document-intake-section-title">
                    <h5>Populate current tab</h5>
                    <span className="summary-label">Only this tab section will be updated when you click Populate</span>
                  </div>
                  <div className="document-intake-review-status-copy">
                    <StatPill tone={activeReviewConflictCount ? "warning" : "success"}>{activeReviewConflictCount ? "Needs review" : "Ready to populate"}</StatPill>
                    <small>{activeReviewIndex + 1} of {groupedReviewFields.length}</small>
                  </div>
                </div>
                <div className="document-intake-fact-wrap">
                  <table className="document-intake-fact-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Current / evidence</th>
                        <th>Suggested value</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeReviewGroup.rows.map((field) => {
                        const key = reviewFieldKey(field);
                        const currentValue = Object.prototype.hasOwnProperty.call(editedReviewValues, key)
                          ? editedReviewValues[key]
                          : field?.resolvedValue ?? field?.currentValue ?? field?.proposedValue ?? "";
                        return (
                          <tr key={key}>
                            <td>
                              <div className="document-intake-table-stack">
                                <strong>{field.fieldLabel || field.fieldKey || "Field"}</strong>
                                <span>{field.subsection || field.targetPath || "Portal value"}</span>
                              </div>
                            </td>
                            <td>
                              <div className="document-intake-table-stack">
                                <strong>{normalizeValue(field.currentValue) || "Blank in portal"}</strong>
                                <span>{field.primarySourceFile || field.sourceFile || "Uploaded evidence"}</span>
                                <small>{field.primarySourceLocation || field.sourceLocation || "Review source"}</small>
                                {field.evidenceSnippet ? <small>{field.evidenceSnippet}</small> : null}
                              </div>
                            </td>
                            <td>
                              <InlineEditor value={currentValue} onChange={(value) => setEditedReviewValues((previous) => ({ ...previous, [key]: value }))} controlType={field.controlType} allowedValues={field.allowedValues} disabled={!canPopulate} />
                            </td>
                            <td>
                              <div className="document-intake-table-stack">
                                <StatPill tone={toneForStatus(field.reviewStatus || field.confidence)}>{formatStatusLabel(field.reviewStatus || field.confidence || "Review")}</StatPill>
                                {Number(field?.conflictCount || 0) > 0 ? <small>{field.conflictCount} conflict source(s)</small> : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="document-intake-suggestion-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsReviewModalOpen(false)}>Close</button>
              <button type="button" className="btn btn-secondary" onClick={() => { if (activeReviewIndex < groupedReviewFields.length - 1) { setActiveReviewGroupKey(groupedReviewFields[activeReviewIndex + 1].key); } }} disabled={activeReviewIndex >= groupedReviewFields.length - 1}>Next</button>
              <button type="button" className="btn btn-primary" onClick={() => void populateReviewGroup()} disabled={!canPopulate}>Populate</button>
            </div>
          </div>
        </div>

      ) : null}
      {activeDocument ? (
        <div className="fpa-discovery-modal-backdrop" role="presentation" onClick={() => setActiveDocumentId("")}>
          <div className="fpa-discovery-modal document-intake-modal document-intake-review-modal" role="dialog" aria-label="Review extracted document" onClick={(event) => event.stopPropagation()}>
            <div className="fpa-discovery-modal-head">
              <div className="document-intake-modal-head-copy">
                <span className="section-kicker">Document review</span>
                <h4>{activeDocument.fileName || "Document"}</h4>
                <p className="muted-copy">Review extracted suggestions from this file before populating them into the deal.</p>
              </div>
              <button type="button" className="fpa-discovery-modal-close" onClick={() => setActiveDocumentId("")}>{"\u00D7"}</button>
            </div>

            <div className="fpa-discovery-modal-meta document-intake-meta-grid">
              <MetaCard label="Type" value={activeDocument.documentType || activeDocument.preview?.documentType || "File"} />
              <MetaCard label="Fields" value={String(activeDocumentSuggestions.length)} />
              <MetaCard label="Sections" value={String(activeDocumentGroups.length)} />
              <MetaCard label="Status" value={formatStatusLabel(activeDocument.status || "Preview")} />
            </div>

            <div className="document-intake-modal-sections">
              <section className="document-intake-section-card">
                <div className="document-intake-summary">
                  <strong>Document summary</strong>
                  <p>{activeDocument.summary || activeDocument.preview?.summary || "No document summary captured yet."}</p>
                </div>
                {activeDocument.preview?.sourcePreview ? <pre className="document-intake-source-preview">{activeDocument.preview.sourcePreview}</pre> : null}
              </section>

              {activeDocumentWarnings.length ? (
                <section className="document-intake-section-card">
                  <div className="document-intake-section-head">
                    <div className="document-intake-section-title">
                      <h5>Warnings</h5>
                      <span className="summary-label">Items that may need manual review</span>
                    </div>
                  </div>
                  <ul className="document-intake-bullet-list">
                    {activeDocumentWarnings.map((warning, index) => <li key={`warning-${index}`}>{warning}</li>)}
                  </ul>
                </section>
              ) : null}

              {activeDocumentGroups.map((group) => (
                <section key={group.key} className="document-intake-section-card">
                  <div className="document-intake-section-head">
                    <div className="document-intake-section-title">
                      <h5>{group.section}</h5>
                      <span className="summary-label">{group.tower}</span>
                    </div>
                    <StatPill tone="info">{group.rows.length} field(s)</StatPill>
                  </div>
                  <div className="document-intake-fact-wrap">
                    <table className="document-intake-fact-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Source</th>
                          <th>Suggested value</th>
                          <th>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((suggestion, index) => {
                          const key = suggestionKey(activeDocument.id, suggestion, index);
                          return (
                            <tr key={key}>
                              <td>
                                <div className="document-intake-table-stack">
                                  <strong>{suggestion.fieldLabel || suggestion.fieldKey || "Field"}</strong>
                                  <span>{suggestion.subsection || suggestion.targetPath || "Portal field"}</span>
                                </div>
                              </td>
                              <td>
                                <div className="document-intake-table-stack">
                                  <strong>{suggestion.sourceFile || activeDocument.fileName || "Uploaded file"}</strong>
                                  <span>{suggestion.sourceLocation || "Extracted evidence"}</span>
                                  {suggestion.evidenceSnippet ? <small>{suggestion.evidenceSnippet}</small> : null}
                                </div>
                              </td>
                              <td>
                                <InlineEditor value={suggestion.resolvedValue ?? suggestion.proposedValue} onChange={(value) => setEditedSuggestionValues((previous) => ({ ...previous, [key]: value }))} controlType={suggestion.controlType} allowedValues={suggestion.allowedValues} disabled={!canPopulate} />
                              </td>
                              <td><StatPill tone={toneForStatus(suggestion.confidence)}>{suggestion.confidence || "Review"}</StatPill></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>

            <div className="document-intake-suggestion-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveDocumentId("")}>Close</button>
              <button type="button" className="btn btn-primary" onClick={() => void populateDocument()} disabled={!canPopulate || activeDocumentSuggestions.length === 0}>Populate</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}







