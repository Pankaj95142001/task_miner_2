import { useEffect, useMemo, useState } from "react";

import { MONTH_OPTIONS } from "../config/fpaWorkspace";
import {
  deriveFpaDiscoveryMetrics,
  FPA_DISCOVERY_OPTIONS,
  FPA_DISCOVERY_PROXY_GROUPS,
  formatFpaDiscoveryValue,
} from "../config/fpaDiscovery";

const EMPTY_EVIDENCE = {
  source: "",
  confidence: "",
  owner: "",
  date: "",
  fileName: "",
  sheetName: "",
  cell: "",
  effectiveCell: "",
  effectiveValue: "",
  sourceClass: "",
  sourceClassCode: "",
  criticality: "",
  defaultSource: "",
  rawDateLabel: "",
  defaulted: false,
};

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function DiscoveryMetricCard({ label, value, note, tone = "neutral" }) {
  return (
    <article className="fpa-discovery-metric-card">
      <span className="section-kicker">{label}</span>
      <strong>{value}</strong>
      <div className="fpa-discovery-metric-note-row">
        <StatusPill tone={tone}>{note}</StatusPill>
      </div>
    </article>
  );
}

function fieldToneFromCriticality(criticality) {
  if (criticality >= 3) {
    return "warning";
  }

  if (criticality === 2) {
    return "info";
  }

  return "neutral";
}

function scoreTone(value, amberFloor = 50, greenFloor = 70) {
  if (value >= greenFloor) {
    return "success";
  }

  if (value >= amberFloor) {
    return "warning";
  }

  return "danger";
}

function withCurrentOption(options, value) {
  const baseOptions = (options || []).map((option) => (typeof option === "string" ? { value: option, label: option } : option));
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue || baseOptions.some((option) => option.value === normalizedValue)) {
    return baseOptions;
  }

  return [{ value: normalizedValue, label: normalizedValue }, ...baseOptions];
}

function DiscoveryFieldControl({ field, value, disabled, onChange }) {
  if (field.control === "derived") {
    return <div className="fpa-discovery-derived-value">{value}</div>;
  }

  if (field.control === "select" || field.control === "month") {
    const optionKey = field.control === "month" ? "month" : field.optionsKey;
    const options = optionKey === "month" ? MONTH_OPTIONS : FPA_DISCOVERY_OPTIONS[optionKey] || [];
    const normalizedOptions = withCurrentOption(options, value);

    return (
      <select className="fpa-discovery-control" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.control === "number") {
    return (
      <input
        className="fpa-discovery-control"
        type="number"
        step={field.step || "1"}
        value={value}
        disabled={disabled}
        placeholder={field.placeholder || "Enter value"}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      className="fpa-discovery-control"
      type="text"
      value={value}
      disabled={disabled}
      placeholder={field.placeholder || "Enter value"}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function EvidenceField({ label, type = "text", value, disabled, placeholder, onChange }) {
  return (
    <label className="field-block fpa-discovery-field-block is-compact">
      <span>{label}</span>
      <input type={type} value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function getEvidenceCount(evidence) {
  return [evidence?.source, evidence?.confidence, evidence?.owner, evidence?.date].filter((value) => String(value || "").trim()).length;
}

function ProxyTable({ group, canEdit, isBusy, onChange, onOpenEvidence }) {
  return (
    <div className="fpa-discovery-group-block">
      <div className="fpa-discovery-group-head">
        <h5>{group.label}</h5>
        <span className="section-chip">{group.rows.length} rows</span>
      </div>

      <div className="fpa-discovery-table-shell">
        <table className="fpa-discovery-table">
          <colgroup>
            <col style={{ width: "84px" }} />
            <col style={{ width: "29%" }} />
            <col style={{ width: "23%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "112px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Row</th>
              <th>Workbook Input</th>
              <th>Raw Value</th>
              <th>Effective</th>
              <th>Default Logic</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((field) => {
              const evidenceCount = getEvidenceCount(field.evidence);
              const rawValue = field.derived ? formatFpaDiscoveryValue(field.id, field.effectiveValue) : field.rawValue;

              return (
                <tr key={field.id} className={field.derived ? "is-derived" : ""}>
                  <td>
                    <span className="section-chip">{field.row}</span>
                  </td>
                  <td>
                    <div className="fpa-discovery-row-copy">
                      <strong>{field.label}</strong>
                      <div className="fpa-discovery-row-meta">
                        {field.criticality ? <StatusPill tone={fieldToneFromCriticality(field.criticality)}>Crit {field.criticality}</StatusPill> : null}
                        {field.derived ? (
                          <StatusPill tone="info">Auto</StatusPill>
                        ) : field.isDefaulted ? (
                          <StatusPill tone="warning">Defaulted</StatusPill>
                        ) : (
                          <StatusPill tone="success">Provided</StatusPill>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="fpa-discovery-table-control">
                      <DiscoveryFieldControl
                        field={field}
                        value={rawValue}
                        disabled={!canEdit || isBusy || field.derived}
                        onChange={(value) => onChange(field.id, value)}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="fpa-discovery-cell-value">
                      <strong>{formatFpaDiscoveryValue(field.id, field.effectiveValue)}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="fpa-discovery-table-note">{field.defaultSource}</span>
                  </td>
                  <td>
                    {field.derived ? (
                      <span className="fpa-discovery-count-chip is-static">Auto</span>
                    ) : (
                      <div className="fpa-discovery-evidence-cell">
                        <button
                          type="button"
                          className="fpa-discovery-evidence-trigger"
                          onClick={() => onOpenEvidence(field)}
                          aria-label={`Open evidence details for ${field.label}`}
                        >
                          <span aria-hidden="true">...</span>
                        </button>
                        <span className={`fpa-discovery-count-chip${evidenceCount ? "" : " is-empty"}`}>{evidenceCount}/4</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoverageTable({ rows, canEdit, isBusy, onChange }) {
  return (
    <div className="fpa-discovery-table-shell">
      <table className="fpa-discovery-table fpa-discovery-table-compact">
        <colgroup>
          <col style={{ width: "84px" }} />
          <col style={{ width: "46%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "88px" }} />
          <col style={{ width: "96px" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Row</th>
            <th>Checklist Item</th>
            <th>Evidence Captured</th>
            <th>Weight</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((field) => {
            const tone = field.response === "Yes" ? "success" : field.response === "No" ? "warning" : "neutral";

            return (
              <tr key={field.id}>
                <td>
                  <span className="section-chip">{field.row}</span>
                </td>
                <td>
                  <div className="fpa-discovery-row-copy is-single-line">
                    <strong>{field.label}</strong>
                  </div>
                </td>
                <td>
                  <select className="fpa-discovery-control" value={field.response} disabled={!canEdit || isBusy} onChange={(event) => onChange(field.id, event.target.value)}>
                    <option value="">Select</option>
                    {FPA_DISCOVERY_OPTIONS.yesNo.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <strong>{field.weight}</strong>
                </td>
                <td>
                  <StatusPill tone={tone}>{field.score}/{field.weight}</StatusPill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TechTable({ rows, canEdit, isBusy, onChange }) {
  return (
    <div className="fpa-discovery-table-shell">
      <table className="fpa-discovery-table fpa-discovery-table-compact">
        <colgroup>
          <col style={{ width: "84px" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "23%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "96px" }} />
          <col style={{ width: "96px" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Row</th>
            <th>Technology Signal</th>
            <th>Selected State</th>
            <th>Effective State</th>
            <th>Multiplier</th>
            <th>Readiness</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((field) => {
            const options = withCurrentOption(FPA_DISCOVERY_OPTIONS[field.optionsKey], field.rawValue);

            return (
              <tr key={field.id}>
                <td>
                  <span className="section-chip">{field.row}</span>
                </td>
                <td>
                  <div className="fpa-discovery-row-copy">
                    <strong>{field.label}</strong>
                    <div className="fpa-discovery-row-meta">
                      <StatusPill tone={field.defaulted ? "warning" : "success"}>{field.defaulted ? "Defaulted" : "Provided"}</StatusPill>
                    </div>
                  </div>
                </td>
                <td>
                  <select className="fpa-discovery-control" value={field.rawValue} disabled={!canEdit || isBusy} onChange={(event) => onChange(field.id, event.target.value)}>
                    <option value="">Select</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className="fpa-discovery-table-note">{field.effectiveValue}</span>
                </td>
                <td>
                  <strong>x{field.multiplier.toFixed(2)}</strong>
                </td>
                <td>
                  <strong>{field.readiness}/4</strong>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PainTable({ rows, canEdit, isBusy, onChange }) {
  return (
    <div className="fpa-discovery-table-shell">
      <table className="fpa-discovery-table fpa-discovery-table-compact">
        <colgroup>
          <col style={{ width: "84px" }} />
          <col style={{ width: "46%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "96px" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Row</th>
            <th>Pain Point</th>
            <th>Present?</th>
            <th>Severity</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((field) => {
            const tone = field.score >= 3 ? "danger" : field.score >= 2 ? "warning" : field.score >= 1 ? "info" : "neutral";

            return (
              <tr key={field.id}>
                <td>
                  <span className="section-chip">{field.row}</span>
                </td>
                <td>
                  <div className="fpa-discovery-row-copy is-single-line">
                    <strong>{field.label}</strong>
                  </div>
                </td>
                <td>
                  <select className="fpa-discovery-control" value={field.present} disabled={!canEdit || isBusy} onChange={(event) => onChange(field.id, "present", event.target.value)}>
                    <option value="">Select</option>
                    {FPA_DISCOVERY_OPTIONS.yesNo.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="fpa-discovery-control" value={field.severity} disabled={!canEdit || isBusy || field.present !== "Yes"} onChange={(event) => onChange(field.id, "severity", event.target.value)}>
                    <option value="">Select</option>
                    {FPA_DISCOVERY_OPTIONS.painSeverity.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <StatusPill tone={tone}>Score {field.score}</StatusPill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceModal({ field, evidenceDraft, canEdit, isBusy, onChange, onClose, onSave }) {
  if (!field) {
    return null;
  }

  const metadataItems = [
    { label: "File", value: evidenceDraft.fileName },
    { label: "Sheet", value: evidenceDraft.sheetName },
    { label: "Cell", value: evidenceDraft.cell },
  ].filter((item) => String(item.value || "").trim());

  return (
    <div className="fpa-discovery-modal-backdrop" onClick={onClose}>
      <div className="fpa-discovery-modal" role="dialog" aria-modal="true" aria-labelledby="discovery-evidence-title" onClick={(event) => event.stopPropagation()}>
        <div className="fpa-discovery-modal-head">
          <div>
            <span className="step-badge">Evidence</span>
            <h4 id="discovery-evidence-title">{field.label}</h4>
            <p className="section-note">Capture the workbook evidence columns for row {field.row}: source, confidence, owner, and date.</p>
          </div>
          <button type="button" className="fpa-discovery-modal-close" onClick={onClose} aria-label="Close evidence dialog">
            ×
          </button>
        </div>

        <div className="fpa-discovery-modal-grid">
          <EvidenceField label="Source" value={evidenceDraft.source} disabled={!canEdit || isBusy} placeholder="Client / benchmark / SME" onChange={(value) => onChange("source", value)} />
          <EvidenceField label="Confidence" value={evidenceDraft.confidence} disabled={!canEdit || isBusy} placeholder="High / Medium / Low" onChange={(value) => onChange("confidence", value)} />
          <EvidenceField label="Owner" value={evidenceDraft.owner} disabled={!canEdit || isBusy} placeholder="Owner name" onChange={(value) => onChange("owner", value)} />
          <EvidenceField label="Date" type="date" value={evidenceDraft.date} disabled={!canEdit || isBusy} onChange={(value) => onChange("date", value)} />
        </div>

        {metadataItems.length ? (
          <div className="fpa-discovery-modal-meta">
            {metadataItems.map((item) => (
              <div key={item.label} className="fpa-discovery-modal-meta-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        <div className="fpa-discovery-modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {canEdit ? "Cancel" : "Close"}
          </button>
          {canEdit ? (
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={isBusy}>
              Save Evidence
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function FpaDiscoveryPage({
  fpaWorkspace,
  canEditFpa,
  isBusy,
  onUpdateWorkspace,
}) {
  const metrics = deriveFpaDiscoveryMetrics(fpaWorkspace);
  const proxyGroups = useMemo(() => FPA_DISCOVERY_PROXY_GROUPS.map((group) => ({
    ...group,
    rows: metrics.proxyRows.filter((field) => field.groupId === group.id),
  })), [metrics.proxyRows]);

  const proxyRowMap = useMemo(() => Object.fromEntries(metrics.proxyRows.map((field) => [field.id, field])), [metrics.proxyRows]);
  const [activeEvidenceFieldId, setActiveEvidenceFieldId] = useState(null);
  const [evidenceDraft, setEvidenceDraft] = useState(EMPTY_EVIDENCE);

  const activeEvidenceField = activeEvidenceFieldId ? proxyRowMap[activeEvidenceFieldId] || null : null;

  useEffect(() => {
    if (!activeEvidenceFieldId) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setActiveEvidenceFieldId(null);
        setEvidenceDraft(EMPTY_EVIDENCE);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeEvidenceFieldId]);

  function cloneWorkspace() {
    return {
      ...fpaWorkspace,
      discovery: { ...fpaWorkspace.discovery },
      discoveryEvidence: Object.fromEntries(Object.entries(fpaWorkspace.discoveryEvidence || {}).map(([key, value]) => [key, { ...value }])),
      discoveryCoverage: { ...fpaWorkspace.discoveryCoverage },
      discoveryPainPoints: Object.fromEntries(Object.entries(fpaWorkspace.discoveryPainPoints || {}).map(([key, value]) => [key, { ...value }])),
    };
  }

  function updateDiscoveryField(fieldId, value) {
    const nextWorkspace = cloneWorkspace();
    nextWorkspace.discovery[fieldId] = value;
    onUpdateWorkspace(nextWorkspace);
  }

  function updateCoverageField(fieldId, value) {
    const nextWorkspace = cloneWorkspace();
    nextWorkspace.discoveryCoverage[fieldId] = value;
    onUpdateWorkspace(nextWorkspace);
  }

  function updatePainField(fieldId, key, value) {
    const nextWorkspace = cloneWorkspace();
    const nextPainPoint = {
      ...(nextWorkspace.discoveryPainPoints[fieldId] || {}),
      [key]: value,
    };

    if (key === "present" && value !== "Yes") {
      nextPainPoint.severity = "";
    }

    nextWorkspace.discoveryPainPoints[fieldId] = nextPainPoint;
    onUpdateWorkspace(nextWorkspace);
  }

  function updateNotes(value) {
    const nextWorkspace = cloneWorkspace();
    nextWorkspace.notes = value;
    onUpdateWorkspace(nextWorkspace);
  }

  function openEvidenceModal(field) {
    setActiveEvidenceFieldId(field.id);
    setEvidenceDraft({ ...EMPTY_EVIDENCE, ...(field.evidence || {}) });
  }

  function closeEvidenceModal() {
    setActiveEvidenceFieldId(null);
    setEvidenceDraft(EMPTY_EVIDENCE);
  }

  function updateEvidenceDraft(key, value) {
    setEvidenceDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveEvidenceDraft() {
    if (!activeEvidenceFieldId) {
      return;
    }

    const nextWorkspace = cloneWorkspace();
    nextWorkspace.discoveryEvidence[activeEvidenceFieldId] = { ...evidenceDraft };
    onUpdateWorkspace(nextWorkspace);
    closeEvidenceModal();
  }

  return (
    <div className="fpa-form-stack fpa-discovery-layout">
      <section className="compact-card fpa-discovery-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Discovery</span>
            <h4>Discovery workspace</h4>
            <p className="section-note">A compact workbook-style table for Discovery. Raw values stay editable, effective values keep the same default logic, and evidence moves into a small modal.</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={scoreTone(metrics.proxyWeightedCompletenessPct)}>{metrics.proxyCompletenessStatus}</StatusPill>
            <StatusPill tone={scoreTone(metrics.coverageScorePct, 30, 70)}>{metrics.coverageMode}</StatusPill>
            <StatusPill tone={metrics.techLandscape === "MODERN" ? "success" : metrics.techLandscape === "TRANSITIONAL" ? "warning" : "danger"}>{metrics.techLandscape}</StatusPill>
          </div>
        </div>

        <div className="fpa-discovery-metric-grid">
          <DiscoveryMetricCard label="Discovery Inputs" value={`${metrics.discoveryCount}/${metrics.discoveryFieldCount}`} note={`${metrics.rawDiscoveryFillPct}% raw capture`} tone={scoreTone(metrics.rawDiscoveryFillPct)} />
          <DiscoveryMetricCard label="Proxy Completeness" value={`${metrics.proxyWeightedCompletenessPct}%`} note={metrics.proxyCompletenessStatus} tone={scoreTone(metrics.proxyWeightedCompletenessPct)} />
          <DiscoveryMetricCard label="Coverage Score" value={`${metrics.coverageScorePct}%`} note={`${metrics.coverageAnsweredCount}/${metrics.coverageRows.length} checklist rows answered`} tone={scoreTone(metrics.coverageScorePct, 30, 70)} />
          <DiscoveryMetricCard label="Tech Readiness" value={`${metrics.techReadinessScore}/4`} note={`x${metrics.techEffortMultiplier.toFixed(2)} effort | ${metrics.techDefaultedCount} defaulted`} tone={metrics.techLandscape === "MODERN" ? "success" : metrics.techLandscape === "TRANSITIONAL" ? "warning" : "danger"} />
          <DiscoveryMetricCard label="Pain Pressure" value={`${metrics.painPressurePct}%`} note={metrics.painMotion} tone={metrics.painPressurePct >= 60 ? "danger" : metrics.painPressurePct >= 35 ? "warning" : "success"} />
        </div>
      </section>

      <section className="compact-card fpa-subpanel">
        <div className="step-header">
          <div>
            <span className="step-badge">Section B</span>
            <h4>Business and volume proxy set</h4>
            <p className="section-note">Rows are now table-based. Use the three-dot button in the Evidence column to capture source, confidence, owner, and date.</p>
          </div>
          <span className="section-chip">{metrics.proxyFilledCount}/{metrics.proxyInputCount} raw proxy rows captured</span>
        </div>

        <div className="fpa-discovery-group-stack">
          {proxyGroups.map((group) => (
            <ProxyTable key={group.id} group={group} canEdit={canEditFpa} isBusy={isBusy} onChange={updateDiscoveryField} onOpenEvidence={openEvidenceModal} />
          ))}
        </div>
      </section>

      <div className="fpa-discovery-two-column">
        <section className="compact-card fpa-subpanel">
          <div className="step-header">
            <div>
              <span className="step-badge">Section C</span>
              <h4>Discovery coverage checklist</h4>
              <p className="section-note">This still drives the workbook sizing mode: pure blind, hybrid, or discovery-confirmed.</p>
            </div>
            <span className="section-chip">{metrics.coverageAnsweredCount}/{metrics.coverageRows.length} answered</span>
          </div>
          <CoverageTable rows={metrics.coverageRows} canEdit={canEditFpa} isBusy={isBusy} onChange={updateCoverageField} />
        </section>

        <section className="compact-card fpa-subpanel">
          <div className="step-header">
            <div>
              <span className="step-badge">Section D</span>
              <h4>Technology stack normalisation</h4>
              <p className="section-note">The workbook-style tech signals still feed readiness and effort multiplier.</p>
            </div>
            <span className="section-chip">Gate {metrics.techModernizationGate} | Norm {metrics.techMaturityNormalization}</span>
          </div>
          <TechTable rows={metrics.techRows} canEdit={canEditFpa} isBusy={isBusy} onChange={updateDiscoveryField} />
        </section>
      </div>

      <section className="compact-card fpa-subpanel">
        <div className="step-header">
          <div>
            <span className="step-badge">Section E</span>
            <h4>Pain points and priorities</h4>
            <p className="section-note">Severity stays active only when a pain point is marked present, matching the workbook logic.</p>
          </div>
          <span className="section-chip">{metrics.painAnsweredCount}/{metrics.painRows.length} pain rows answered</span>
        </div>
        <PainTable rows={metrics.painRows} canEdit={canEditFpa} isBusy={isBusy} onChange={updatePainField} />
      </section>

      <section className="compact-card fpa-subpanel">
        <div className="step-header">
          <div>
            <span className="step-badge">Notes</span>
            <h4>Workspace notes</h4>
            <p className="section-note">Use this for assumptions that need to stay visible while the rest of the workbook is built out.</p>
          </div>
          <span className="section-chip">Shared with deal JSON</span>
        </div>
        <label className="field-block field-block-full">
          <span>FP&A workspace notes</span>
          <textarea value={fpaWorkspace.notes} disabled={!canEditFpa || isBusy} onChange={(event) => updateNotes(event.target.value)} />
        </label>
      </section>

      <EvidenceModal
        field={activeEvidenceField}
        evidenceDraft={evidenceDraft}
        canEdit={canEditFpa}
        isBusy={isBusy}
        onChange={updateEvidenceDraft}
        onClose={closeEvidenceModal}
        onSave={saveEvidenceDraft}
      />
    </div>
  );
}
