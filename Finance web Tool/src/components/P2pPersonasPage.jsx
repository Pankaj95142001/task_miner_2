import { useEffect, useMemo, useState } from "react";

import {
  buildP2pPersonaWorkbookView,
  P2P_PERSONA_LIBRARY_SNAPSHOT,
  formatPersonaValue,
  getPersonaRiskTone,
} from "../config/p2pPersonas";

const EMPTY_INPUTS = Object.freeze({});
const PERCENT_FORMATS = new Set(["percent0", "percent1"]);

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function SectionCard({ badge, title, note, meta = null, children, className = "" }) {
  return (
    <section className={["compact-card", "fpa-subpanel", className].filter(Boolean).join(" ")}>
      <div className="step-header">
        <div>
          <span className="step-badge">{badge}</span>
          <h4>{title}</h4>
          {note ? <p className="section-note">{note}</p> : null}
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}

function toCellAddress(row, persona) {
  return `${persona.workbookColumn}${row.workbookRow}`;
}

function hasWorkbookOverride(workbookInputs, address) {
  return Object.prototype.hasOwnProperty.call(workbookInputs, address);
}

function readStoredPersonaValue(workbookInputs, row, persona) {
  const address = toCellAddress(row, persona);

  if (hasWorkbookOverride(workbookInputs, address)) {
    return workbookInputs[address];
  }

  return row.values[persona.key];
}

function formatPersonaEditorValue(row, rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return "";
  }

  if (row.format === "text") {
    return String(rawValue);
  }

  const numeric = Number(rawValue);
  return Number.isFinite(numeric) ? formatPersonaValue(numeric, row.format) : String(rawValue);
}

function buildDraftInputs(workbookView, workbookInputs) {
  const nextDraftInputs = {};

  workbookView.sections.forEach((section) => {
    section.rows.forEach((row) => {
      workbookView.personas.forEach((persona) => {
        const address = toCellAddress(row, persona);
        nextDraftInputs[address] = formatPersonaEditorValue(row, readStoredPersonaValue(workbookInputs, row, persona));
      });
    });
  });

  return nextDraftInputs;
}

function normalizePersonaInputValue(row, value) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  if (row.format === "text") {
    return trimmed.toUpperCase();
  }

  const isPercentInput = trimmed.includes("%");
  const sanitized = trimmed.replace(/,/g, "").replace(/%/g, "");
  const numeric = Number(sanitized);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (PERCENT_FORMATS.has(row.format)) {
    const normalizedPercent = isPercentInput || Math.abs(numeric) > 1 ? numeric / 100 : numeric;
    return String(normalizedPercent);
  }

  if (row.format === "integer") {
    return String(Math.round(numeric));
  }

  if (row.format === "decimal1") {
    return String(Number(numeric.toFixed(1)));
  }

  if (row.format === "decimal2") {
    return String(Number(numeric.toFixed(2)));
  }

  return String(numeric);
}

function PersonaHighlights({ items }) {
  return (
    <div className="fpa-persona-library-summary">
      {items.map((item) => (
        <div key={item.label} className="fpa-persona-library-stat">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function PersonaCellEditor({
  row,
  persona,
  workbookInputs,
  canEditP2p,
  isBusy,
  draftValue,
  onDraftChange,
  onDraftCommit,
}) {
  const address = toCellAddress(row, persona);
  const disabled = !canEditP2p || isBusy;

  if (disabled) {
    const rawValue = readStoredPersonaValue(workbookInputs, row, persona);
    const text = formatPersonaEditorValue(row, rawValue) || "—";

    if (row.key === "deliveryRiskRating") {
      return <StatusPill tone={getPersonaRiskTone(rawValue)}>{text}</StatusPill>;
    }

    return <span className="fpa-persona-library-readonly">{text}</span>;
  }

  return (
    <input
      type="text"
      className={`fpa-persona-library-input ${row.format === "text" ? "is-text" : "is-numeric"}`.trim()}
      value={draftValue}
      autoComplete="off"
      onChange={(event) => onDraftChange(address, event.target.value)}
      onBlur={(event) => onDraftCommit(row, persona, event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function PersonaTableSection({
  section,
  personas,
  workbookInputs,
  canEditP2p,
  isBusy,
  draftInputs,
  onDraftChange,
  onDraftCommit,
}) {
  return (
    <SectionCard
      badge={`Workbook Rows ${section.startRow}-${section.endRow}`}
      title={section.title}
      note={section.note}
      meta={(
        <div className="fpa-tab-meta">
          <span className="section-chip">{section.rows.length} levers</span>
          <span className="section-chip">{personas.length} personas</span>
        </div>
      )}
    >
      <div className="fpa-table-wrap fpa-persona-library-table-wrap">
        <table className="fpa-table fpa-persona-library-table">
          <colgroup>
            <col className="fpa-persona-library-col-lever" />
            {personas.map((persona) => (
              <col key={`persona-col-${persona.key}`} className="fpa-persona-library-col-value" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>Assumption Lever</th>
              {personas.map((persona) => (
                <th key={`persona-header-${persona.key}`}>{persona.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.key}>
                <td className="fpa-persona-library-lever-cell">
                  <div className="fpa-persona-library-lever">
                    <div className="fpa-persona-library-lever-main">
                      <strong>{row.label}</strong>
                      {row.note ? <span className="fpa-persona-library-note-pill">{row.note}</span> : null}
                    </div>
                    <span>Workbook row {row.workbookRow}</span>
                  </div>
                </td>
                {personas.map((persona) => {
                  const address = toCellAddress(row, persona);
                  return (
                    <td key={`${row.key}-${persona.key}`} className="fpa-persona-library-value">
                      <PersonaCellEditor
                        row={row}
                        persona={persona}
                        workbookInputs={workbookInputs}
                        canEditP2p={canEditP2p}
                        isBusy={isBusy}
                        draftValue={draftInputs[address] ?? ""}
                        onDraftChange={onDraftChange}
                        onDraftCommit={onDraftCommit}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export default function P2pPersonasPage({
  currentDeal,
  canEditP2p,
  isBusy,
  onUpdateCell,
}) {
  const workbookView = useMemo(() => buildP2pPersonaWorkbookView(), []);
  const sheetName = P2P_PERSONA_LIBRARY_SNAPSHOT.sheetName;
  const workbookInputs = currentDeal?.p2pWorkbookInputs?.[sheetName] && typeof currentDeal.p2pWorkbookInputs[sheetName] === "object"
    ? currentDeal.p2pWorkbookInputs[sheetName]
    : EMPTY_INPUTS;
  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(workbookView, workbookInputs));

  useEffect(() => {
    setDraftInputs(buildDraftInputs(workbookView, workbookInputs));
  }, [workbookInputs, workbookView]);

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(row, persona, value) {
    const address = toCellAddress(row, persona);
    const normalizedValue = normalizePersonaInputValue(row, value);

    if (normalizedValue === null) {
      const fallbackValue = formatPersonaEditorValue(row, readStoredPersonaValue(workbookInputs, row, persona));
      setDraftInputs((previous) => ({
        ...previous,
        [address]: fallbackValue,
      }));
      return;
    }

    const nextDisplayValue = normalizedValue === "" ? "" : formatPersonaEditorValue(row, normalizedValue);
    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextDisplayValue,
    }));

    onUpdateCell(sheetName, address, normalizedValue);
  }

  return (
    <div className="fpa-form-stack fpa-persona-library-layout">
      <section className="compact-card fpa-subpanel fpa-persona-library-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local Personas</span>
            <h4>{workbookView.title}</h4>
            <p className="section-note">The values below now resolve locally for P2P. The 22 leverage rows across columns C:G remain editable workbook-style assumptions.</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="info">{workbookView.personaCount} personas</StatusPill>
            <span className="section-chip">{workbookView.leverCount} workbook levers</span>
            <span className="section-chip">{workbookView.formulaCount} formula cells</span>
            <span className="section-chip">{workbookView.editableCellCount} editable cells</span>
          </div>
        </div>
      </section>

      <SectionCard
        badge="Workbook Row 6"
        title="Positioning across the five personas"
        note="This row is descriptive context in the workbook. The editable assumption matrix starts from row 7 underneath."
      >
        <div className="fpa-persona-library-grid">
          {workbookView.personas.map((persona) => (
            <article key={persona.key} className="fpa-persona-library-card">
              <div className="step-header fpa-persona-library-card-header">
                <div>
                  <span className="step-badge">Column {persona.workbookColumn}</span>
                  <h4>{persona.label}</h4>
                </div>
                <StatusPill tone={persona.riskTone}>{persona.riskRating}</StatusPill>
              </div>

              <div className="fpa-persona-library-positioning">
                <span>Positioning</span>
                <p>{persona.positioning}</p>
              </div>

              <PersonaHighlights items={persona.highlights} />
            </article>
          ))}
        </div>
      </SectionCard>

      {workbookView.sections.map((section) => (
        <PersonaTableSection
          key={section.id}
          section={section}
          personas={workbookView.personas}
          workbookInputs={workbookInputs}
          canEditP2p={canEditP2p}
          isBusy={isBusy}
          draftInputs={draftInputs}
          onDraftChange={handleDraftChange}
          onDraftCommit={handleDraftCommit}
        />
      ))}
    </div>
  );
}
