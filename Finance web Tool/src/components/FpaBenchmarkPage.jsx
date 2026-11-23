import { useEffect, useMemo, useState } from "react";

import {
  benchmarkCellWidthPx,
  benchmarkRowHeightPx,
  buildFpaBenchmarkWorkbookView,
  FPA_BENCHMARK_WORKBOOK_SNAPSHOT,
  getBenchmarkOverview,
  getFpaBenchmarkSections,
  isBenchmarkNumericCell,
  normalizeBenchmarkInputValue,
} from "../config/fpaBenchmarks";

const EMPTY_INPUTS = Object.freeze({});

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function BenchmarkCellEditor({ cell, canEditFpa, isBusy, value, onChange, onCommit }) {
  return (
    <input
      type="text"
      className={`fpa-benchmark-editor ${isBenchmarkNumericCell(cell) ? "is-numeric" : ""}`.trim()}
      value={value}
      disabled={!canEditFpa || isBusy}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
    />
  );
}

function BenchmarkTableRow({ row, canEditFpa, isBusy, draftInputs, onDraftChange, onDraftCommit }) {
  const rowHeight = benchmarkRowHeightPx(row.height);
  const isBlankRow = row.cells.every((cell) => cell.styleId === 0 && !String(cell.text || "").trim());

  if (isBlankRow) {
    return (
      <tr className="fpa-benchmark-row is-blank" style={rowHeight ? { height: `${rowHeight}px` } : undefined}>
        {row.cells.map((cell) => (
          <td key={cell.address} className="fpa-benchmark-spacer" />
        ))}
      </tr>
    );
  }

  return (
    <tr className="fpa-benchmark-row" style={rowHeight ? { height: `${rowHeight}px` } : undefined}>
      {row.cells.map((cell) => {
        const classes = ["fpa-benchmark-cell", `is-${cell.kind}`];
        const value = Object.prototype.hasOwnProperty.call(draftInputs, cell.address) ? String(draftInputs[cell.address] ?? "") : cell.text || "";

        if (cell.isInput) {
          classes.push("is-input");
        }

        if (cell.hasFormula) {
          classes.push("is-formula");
        }

        if (isBenchmarkNumericCell(cell)) {
          classes.push("is-numeric");
        }

        return (
          <td key={cell.address} className={classes.join(" ")}>
            {cell.isInput ? (
              <BenchmarkCellEditor
                cell={cell}
                canEditFpa={canEditFpa}
                isBusy={isBusy}
                value={value}
                onChange={(nextValue) => onDraftChange(cell.address, nextValue)}
                onCommit={(nextValue) => onDraftCommit(cell, nextValue)}
              />
            ) : (
              <span className="fpa-benchmark-readonly">{cell.text || " "}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export default function FpaBenchmarkPage({
  currentDeal,
  fpaWorkspace,
  canEditFpa,
  isBusy,
  onUpdateCell,
}) {
  const overview = getBenchmarkOverview();
  const sheetName = FPA_BENCHMARK_WORKBOOK_SNAPSHOT.sheetName;
  const workbookInputs = currentDeal?.fpaWorkbookInputs?.[sheetName] && typeof currentDeal.fpaWorkbookInputs[sheetName] === "object"
    ? currentDeal.fpaWorkbookInputs[sheetName]
    : EMPTY_INPUTS;
  const [draftInputs, setDraftInputs] = useState(() => ({ ...workbookInputs }));

  useEffect(() => {
    setDraftInputs({ ...workbookInputs });
  }, [workbookInputs]);

  const workbookView = useMemo(
    () => buildFpaBenchmarkWorkbookView(draftInputs, fpaWorkspace?.discovery || {}),
    [draftInputs, fpaWorkspace?.discovery],
  );

  const sections = useMemo(() => getFpaBenchmarkSections(workbookView), [workbookView]);
  const [activeSectionId, setActiveSectionId] = useState(() => sections[0]?.id || "");

  useEffect(() => {
    if (!sections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(sections[0]?.id || "");
    }
  }, [activeSectionId, sections]);

  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0] || null;
  const activeSectionIndex = activeSection ? sections.findIndex((section) => section.id === activeSection.id) : -1;
  const previousSection = activeSectionIndex > 0 ? sections[activeSectionIndex - 1] : null;
  const nextSection = activeSectionIndex >= 0 && activeSectionIndex < sections.length - 1 ? sections[activeSectionIndex + 1] : null;

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(cell, value) {
    const normalizedValue = normalizeBenchmarkInputValue(cell, value);

    setDraftInputs((previous) => ({
      ...previous,
      [cell.address]: normalizedValue,
    }));

    onUpdateCell(sheetName, cell.address, normalizedValue);
  }

  return (
    <div className="fpa-form-stack">
      <section className="compact-card fpa-benchmark-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Benchmarks</span>
            <h4>{overview.title}</h4>
            <p className="section-note">{overview.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="info">{sections.length} sections</StatusPill>
            <span className="section-chip">{FPA_BENCHMARK_WORKBOOK_SNAPSHOT.editableCellCount} editable cells</span>
            <span className="section-chip">{FPA_BENCHMARK_WORKBOOK_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        {activeSection ? (
          <div className="fpa-benchmark-toolbar">
            <label className="fpa-benchmark-picker">
              <span>Jump To Workbook Section</span>
              <select className="fpa-benchmark-select" value={activeSectionId} onChange={(event) => setActiveSectionId(event.target.value)}>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>{section.code} | {section.displayTitle}</option>
                ))}
              </select>
            </label>

            <div className="fpa-benchmark-toolbar-actions">
              <button type="button" className="btn btn-secondary" onClick={() => previousSection && setActiveSectionId(previousSection.id)} disabled={!previousSection}>
                Previous Section
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => nextSection && setActiveSectionId(nextSection.id)} disabled={!nextSection}>
                Next Section
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {activeSection ? (
        <section className="compact-card fpa-subpanel fpa-benchmark-panel">
          <div className="step-header">
            <div>
              <span className="step-badge">Section {activeSection.code}</span>
              <h4>{activeSection.displayTitle}</h4>
              <p className="section-note">Exact workbook rows rendered in a compact table. Grey cells are editable benchmark placeholders; calculated cells stay locked.</p>
            </div>
            <div className="fpa-tab-meta">
              <span className="section-chip">Rows {activeSection.contentStartRow}-{activeSection.endRow}</span>
              <span className="section-chip">{activeSection.editableCellCount} editable cells</span>
              {activeSection.formulaCellCount ? <span className="section-chip">{activeSection.formulaCellCount} formulas</span> : null}
            </div>
          </div>

          <div className="fpa-table-wrap fpa-benchmark-section-wrap">
            <table className="fpa-table fpa-benchmark-section-table">
              <colgroup>
                {activeSection.columns.map((column) => (
                  <col key={column.key} style={{ width: `${benchmarkCellWidthPx(column.width)}px` }} />
                ))}
              </colgroup>
              <tbody>
                {activeSection.rows.map((row) => (
                  <BenchmarkTableRow
                    key={`benchmark-section-row-${activeSection.id}-${row.index}`}
                    row={row}
                    canEditFpa={canEditFpa}
                    isBusy={isBusy}
                    draftInputs={draftInputs}
                    onDraftChange={handleDraftChange}
                    onDraftCommit={handleDraftCommit}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

