import { useEffect, useMemo, useState } from "react";

import { formatDateTime } from "../utils/dealMaster";

function StatPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`.trim()}>{children}</span>;
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

function toneForConfidence(confidence) {
  const normalized = String(confidence || "").trim().toLowerCase();
  if (normalized === "very high" || normalized === "high") {
    return "success";
  }
  if (normalized === "medium") {
    return "info";
  }
  if (normalized === "low" || normalized === "very low") {
    return "warning";
  }
  return "neutral";
}

function toneForReviewStatus(status) {
  const normalized = String(status || "pending").trim().toLowerCase();
  if (["populated", "accepted", "locked"].includes(normalized)) {
    return "success";
  }
  if (normalized === "conflict") {
    return "danger";
  }
  if (normalized === "pending") {
    return "warning";
  }
  return "neutral";
}

function isVisibleReviewField(field) {
  const targetPath = String(field?.targetPath || field?.id || "").trim();
  const fieldKey = String(field?.fieldKey || "").trim();
  return targetPath !== "colaRate" && fieldKey !== "colaRate";
}

function buildFieldEditKey(field, index) {
  return [field?.id || field?.targetPath || field?.fieldKey || "field", index]
    .map((part) => String(part || "").trim())
    .join("::");
}

function joinValues(values, fallback = "—") {
  return Array.isArray(values) && values.filter(Boolean).length ? values.filter(Boolean).join(", ") : fallback;
}

function groupReviewFields(fields) {
  const groups = new Map();
  (fields || []).forEach((field) => {
    const tower = field?.tower || "Deal Master";
    const section = field?.section || "General";
    const key = `${tower}::${section}`;
    if (!groups.has(key)) {
      groups.set(key, { key, tower, section, rows: [] });
    }
    groups.get(key).rows.push(field);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((left, right) => {
        const leftKey = `${left?.subsection || ""} ${left?.fieldLabel || left?.fieldKey || ""}`.trim();
        const rightKey = `${right?.subsection || ""} ${right?.fieldLabel || right?.fieldKey || ""}`.trim();
        return leftKey.localeCompare(rightKey);
      }),
    }))
    .sort((left, right) => `${left.tower} ${left.section}`.localeCompare(`${right.tower} ${right.section}`));
}

function buildReviewFieldSignature(fields) {
  return (fields || [])
    .map((field) => [field?.id, field?.resolvedValue, field?.reviewStatus, field?.primarySourceFile, field?.primarySourceLocation].join("::"))
    .join("|");
}

export default function DealLogicBuilderSection({
  currentDeal,
  canEditDealMaster,
  isBusy,
  onPopulateReviewQueue,
  onDeleteDocument,
  deletingDocumentId = "",
  isPopulating = false,
}) {
  const documentIntake = currentDeal?.documentIntake && typeof currentDeal.documentIntake === "object"
    ? currentDeal.documentIntake
    : {};
  const logicBuilder = documentIntake?.logicBuilder && typeof documentIntake.logicBuilder === "object"
    ? documentIntake.logicBuilder
    : {};
  const documentRegister = Array.isArray(logicBuilder.documentRegister) ? logicBuilder.documentRegister : [];
  const chunkStore = Array.isArray(logicBuilder.chunkStore) ? logicBuilder.chunkStore : [];
  const factLedger = Array.isArray(logicBuilder.factLedger) ? logicBuilder.factLedger.filter(isVisibleReviewField) : [];
  const reviewQueue = logicBuilder?.reviewQueue && typeof logicBuilder.reviewQueue === "object"
    ? logicBuilder.reviewQueue
    : {};
  const reviewFields = Array.isArray(reviewQueue.fields) ? reviewQueue.fields.filter(isVisibleReviewField) : [];

  const groupedFields = useMemo(() => groupReviewFields(reviewFields), [reviewFields]);
  const [editedValues, setEditedValues] = useState({});
  const reviewFieldSignature = useMemo(() => buildReviewFieldSignature(reviewFields), [reviewFields]);

  useEffect(() => {
    const nextValues = {};
    reviewFields.forEach((field, index) => {
      nextValues[buildFieldEditKey(field, index)] = field?.resolvedValue == null ? "" : String(field.resolvedValue);
    });
    setEditedValues(nextValues);
  }, [currentDeal?.id, reviewFieldSignature]);

  function valueForField(field, index) {
    const key = buildFieldEditKey(field, index);
    if (Object.prototype.hasOwnProperty.call(editedValues, key)) {
      return editedValues[key];
    }
    return field?.resolvedValue == null ? "" : String(field.resolvedValue);
  }

  function updateFieldValue(field, index, value) {
    const key = buildFieldEditKey(field, index);
    setEditedValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function renderValueEditor(field, index) {
    const currentValue = valueForField(field, index);
    const allowedValues = Array.isArray(field?.allowedValues) ? field.allowedValues.filter(Boolean) : [];
    const controlType = String(field?.controlType || "text").trim().toLowerCase();

    if (allowedValues.length) {
      return (
        <select
          className="document-intake-suggestion-select"
          value={currentValue}
          disabled={!canEditDealMaster || isBusy || isPopulating}
          onChange={(event) => updateFieldValue(field, index, event.target.value)}
        >
          <option value="">Select value</option>
          {allowedValues.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (controlType === "textarea" || currentValue.length > 90) {
      return (
        <textarea
          className="document-intake-suggestion-input logic-builder-value-textarea"
          rows="3"
          value={currentValue}
          disabled={!canEditDealMaster || isBusy || isPopulating}
          onChange={(event) => updateFieldValue(field, index, event.target.value)}
        />
      );
    }

    return (
      <input
        className="document-intake-suggestion-input"
        type="text"
        value={currentValue}
        disabled={!canEditDealMaster || isBusy || isPopulating}
        onChange={(event) => updateFieldValue(field, index, event.target.value)}
      />
    );
  }

  async function handlePopulate() {
    if (typeof onPopulateReviewQueue !== "function" || !reviewFields.length) {
      return;
    }

    const nextFields = reviewFields.map((field, index) => ({
      ...field,
      resolvedValue: valueForField(field, index),
    }));

    await onPopulateReviewQueue({ fields: nextFields });
  }

  const hasPopulatableFields = reviewFields.some((field) => String(field?.targetPath || "").trim());
  const canPopulate = canEditDealMaster
    && !isBusy
    && !isPopulating
    && typeof onPopulateReviewQueue === "function"
    && hasPopulatableFields;
  const conflictCount = reviewFields.filter((field) => Number(field?.conflictCount || 0) > 0).length;
  const highConfidenceCount = reviewFields.filter((field) => ["very high", "high"].includes(String(field?.resolvedConfidence || "").trim().toLowerCase())).length;

  return (
    <section id="step-logic-builder" className="compact-card step-card">
      <div className="step-header">
        <div>
          <span className="step-badge">Step 2</span>
          <h3>Logic Builder &amp; review prep</h3>
        </div>
        <div className="document-intake-header-actions">
          <StatPill tone="info">{reviewFields.length} fields</StatPill>
          <StatPill tone={conflictCount ? "warning" : "success"}>{conflictCount} conflicts</StatPill>
        </div>
      </div>

      <p className="section-note">
        This layer consolidates all uploaded documents into one field-by-field review queue. It keeps the document register,
        parsed chunk store, extracted evidence ledger, and source precedence before you populate Deal Master or FP&amp;A.
      </p>

      {!canEditDealMaster ? (
        <div className="info-banner document-intake-banner">
          <div>
            <p className="section-kicker">Access</p>
            <h3>Logic Builder is visible but read-only</h3>
            <p className="muted-copy">
              Only the deal owner can validate and populate reviewed values into the live workspace.
            </p>
          </div>
          <StatPill tone="warning">Read-only</StatPill>
        </div>
      ) : null}

      <div className="logic-builder-summary-grid">
        <MetricCard label="Documents" value={String(documentRegister.length)} note="Registered source files" />
        <MetricCard label="Chunks" value={String(chunkStore.length)} note="Parsed sections / windows" />
        <MetricCard label="Field Ledger" value={String(factLedger.length)} note="Reviewable extracted records" />
        <MetricCard label="Resolved Queue" value={String(reviewFields.length)} note="Consolidated portal fields" />
        <MetricCard label="High Confidence" value={String(highConfidenceCount)} note="Ready-to-validate suggestions" />
      </div>

      <div className="document-intake-summary logic-builder-helper-copy">
        <strong>Saved architecture for this deal</strong>
        <p>Document register &rarr; parser / chunk store &rarr; extracted field ledger &rarr; consolidated review queue &rarr; populate into towers.</p>
      </div>

      <section className="document-intake-section-card">
        <div className="document-intake-section-head">
          <div className="document-intake-section-title">
            <h5>Document register</h5>
            <span className="summary-label">All files included in the deal extraction memory</span>
          </div>
          <StatPill tone="neutral">{documentRegister.length} registered</StatPill>
        </div>

        {documentRegister.length ? (
          <div className="document-intake-fact-wrap">
            <table className="document-intake-fact-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Source Tier</th>
                  <th>Reliability</th>
                  <th>Coverage</th>
                  <th>Parser</th>
                  <th>Uploaded</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documentRegister.map((document) => (
                  <tr key={document.documentId || document.fileName}>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{document.fileName || "Document"}</strong>
                        <span>{document.summary || "No summary captured yet."}</span>
                      </div>
                    </td>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{document.sourceTier || "Client source"}</strong>
                        <span>{joinValues(document.towerHints, "No tower hint")}</span>
                      </div>
                    </td>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{document.reliability || "Review"}</strong>
                        <span>{document.documentType || "File"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{document.fieldSuggestionCount || 0} fields</strong>
                        <span>{document.sectionCount || 0} section(s)</span>
                      </div>
                    </td>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{document.contentPrep || "raw file"}</strong>
                        <span>{document.chunkCount || 0} chunk(s) · {document.preparedTextChars || 0} chars</span>
                      </div>
                    </td>
                    <td>
                      <div className="document-intake-table-stack">
                        <strong>{formatDateTime(document.uploadedAt)}</strong>
                        <span>{document.uploadedByName || "Unknown uploader"}</span>
                      </div>
                    </td>
                    <td className="document-intake-action-cell">
                      <div className="document-intake-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => typeof onDeleteDocument === "function" && onDeleteDocument({ id: document.documentId, fileName: document.fileName })}
                          disabled={!document.documentId || !canEditDealMaster || isBusy || isPopulating || String(deletingDocumentId || "") === String(document.documentId || "")}
                        >
                          {String(deletingDocumentId || "") === String(document.documentId || "") ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="sidebar-empty">Upload documents in Step 1 to build the document register and review queue.</p>
        )}
      </section>

      <div className="logic-builder-toolbar">
        <div className="logic-builder-toolbar-copy">
          <span className="summary-label">Review flow</span>
          <strong>Tab-by-tab review now happens from Upload Docs</strong>
          <p className="muted-copy">Open the latest review from Step 1, validate one portal tab at a time, populate it, then move to the next tab.</p>
        </div>
        <div className="document-intake-run-badges">
          <StatPill tone="info">{groupedFields.length} portal section(s)</StatPill>
          <StatPill tone={conflictCount ? "warning" : "success"}>{conflictCount} conflict field(s)</StatPill>
        </div>
      </div>

      {groupedFields.length ? (
        <section className="document-intake-section-card">
          <div className="document-intake-section-head">
            <div className="document-intake-section-title">
              <h5>Resolved portal sections</h5>
              <span className="summary-label">Use Upload Docs ? Open Latest Review to populate these sections in order</span>
            </div>
            <StatPill tone="neutral">{groupedFields.length} sections</StatPill>
          </div>

          <div className="document-intake-fact-wrap">
            <table className="document-intake-fact-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Tower</th>
                  <th>Fields</th>
                  <th>Conflicts</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groupedFields.map((group) => {
                  const groupConflictCount = group.rows.filter((field) => Number(field?.conflictCount || 0) > 0).length;
                  const populatedCount = group.rows.filter((field) => String(field?.reviewStatus || "").trim().toLowerCase() === "populated").length;
                  const statusTone = populatedCount === group.rows.length
                    ? "success"
                    : groupConflictCount > 0
                      ? "warning"
                      : "info";
                  const statusLabel = populatedCount === group.rows.length
                    ? "Populated"
                    : populatedCount > 0
                      ? "Partially populated"
                      : "Pending review";

                  return (
                    <tr key={group.key}>
                      <td>
                        <div className="document-intake-table-stack">
                          <strong>{group.section}</strong>
                          <span>{group.rows[0]?.subsection || "Portal section"}</span>
                        </div>
                      </td>
                      <td>{group.tower}</td>
                      <td>{group.rows.length}</td>
                      <td>{groupConflictCount}</td>
                      <td>
                        <StatPill tone={statusTone}>{statusLabel}</StatPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="document-intake-section-card">
          <p className="sidebar-empty">No consolidated review fields are available yet. Run extraction from Step 1 to build the tab-by-tab review flow.</p>
        </section>
      )}</section>
  );
}



