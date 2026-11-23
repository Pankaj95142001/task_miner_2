import { useEffect, useMemo, useState } from "react";

import {
  buildP2pTraceLogWorkbookView,
  P2P_TRACE_LOG_SHEET_NAME,
} from "../config/p2pTraceLog";
import { MetricCard, SectionCard, StatusPill } from "./TowerWorkspacePrimitives";

const EMPTY_INPUTS = Object.freeze({});
const TRACE_LOG_COLUMNS = [
  { key: "date", addressColumn: "B", label: "Date", type: "date", placeholder: "" },
  { key: "sheet", addressColumn: "C", label: "Sheet", type: "text", placeholder: "P2P_05 Workload" },
  { key: "cell", addressColumn: "D", label: "Cell", type: "text", placeholder: "I14" },
  { key: "original", addressColumn: "E", label: "Original value", type: "text", placeholder: "252.15" },
  { key: "override", addressColumn: "F", label: "Override value", type: "text", placeholder: "240" },
  { key: "rationale", addressColumn: "G", label: "Rationale / evidence", type: "text", placeholder: "Explain the override" },
  { key: "owner", addressColumn: "H", label: "Owner", type: "text", placeholder: "Analyst name" },
  { key: "approver", addressColumn: "I", label: "Approver", type: "text", placeholder: "Reviewer" },
];

function trimValue(value) {
  return String(value ?? "").trim();
}

function buildDraftInputs(traceLogInputs = EMPTY_INPUTS) {
  return { ...traceLogInputs };
}

function todayInputValue() {
  const now = new Date();
  const localTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  return localTime.toISOString().slice(0, 10);
}

function fallbackOwnerName(currentUserName, currentDeal) {
  return trimValue(currentUserName) || trimValue(currentDeal?.dealOwnerName) || trimValue(currentDeal?.towerLead_P2P);
}

function readDraftValue(draftInputs, address, fallback = "") {
  return Object.prototype.hasOwnProperty.call(draftInputs, address)
    ? String(draftInputs[address] ?? "")
    : fallback;
}

function commitNormalizedValue(value) {
  return trimValue(value);
}

function overrideTone(count) {
  return count > 0 ? "warning" : "success";
}

function ruleTone(count) {
  return count > 0 ? "danger" : "success";
}

function rowStatusTone(row) {
  if (row.matchesActiveOverride) {
    return "success";
  }
  if (row.overrideValue) {
    return "warning";
  }
  return "neutral";
}

export default function P2pTraceLogPage({
  currentDeal,
  p2pWorkspace,
  currentUserName = "",
  canEditP2p,
  isBusy,
  onUpdateCell,
}) {
  const traceLogInputs = currentDeal?.p2pWorkbookInputs?.[P2P_TRACE_LOG_SHEET_NAME] && typeof currentDeal.p2pWorkbookInputs[P2P_TRACE_LOG_SHEET_NAME] === "object"
    ? currentDeal.p2pWorkbookInputs[P2P_TRACE_LOG_SHEET_NAME]
    : EMPTY_INPUTS;
  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(traceLogInputs));

  useEffect(() => {
    setDraftInputs(buildDraftInputs(traceLogInputs));
  }, [currentDeal?.dealId, traceLogInputs]);

  const mergedTraceInputs = useMemo(
    () => ({ ...traceLogInputs, ...draftInputs }),
    [draftInputs, traceLogInputs],
  );

  const traceView = useMemo(
    () => buildP2pTraceLogWorkbookView({
      currentDeal,
      workspace: p2pWorkspace,
      traceLogInputsOverride: mergedTraceInputs,
    }),
    [currentDeal, p2pWorkspace, mergedTraceInputs],
  );

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(address, value) {
    const nextValue = commitNormalizedValue(value);

    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextValue,
    }));

    if (typeof onUpdateCell === "function") {
      onUpdateCell(P2P_TRACE_LOG_SHEET_NAME, address, nextValue);
    }
  }

  function handleAutofillOverride(override) {
    if (!traceView.firstEmptyRowNumber || typeof onUpdateCell !== "function") {
      return;
    }

    const rowNumber = traceView.firstEmptyRowNumber;
    const patch = {
      [`B${rowNumber}`]: todayInputValue(),
      [`C${rowNumber}`]: override.sheetName,
      [`D${rowNumber}`]: override.cellAddress,
      [`E${rowNumber}`]: override.originalValue,
      [`F${rowNumber}`]: override.overrideValue,
      [`G${rowNumber}`]: override.rationaleValue,
      [`H${rowNumber}`]: fallbackOwnerName(currentUserName, currentDeal),
      [`I${rowNumber}`]: "",
    };

    setDraftInputs((previous) => ({
      ...previous,
      ...patch,
    }));

    Object.entries(patch).forEach(([address, value]) => {
      onUpdateCell(P2P_TRACE_LOG_SHEET_NAME, address, value);
    });
  }

  function handleClearRow(rowNumber) {
    if (typeof onUpdateCell !== "function") {
      return;
    }

    const patch = Object.fromEntries(
      TRACE_LOG_COLUMNS.map((column) => [`${column.addressColumn}${rowNumber}`, ""]),
    );

    setDraftInputs((previous) => ({
      ...previous,
      ...patch,
    }));

    Object.entries(patch).forEach(([address, value]) => {
      onUpdateCell(P2P_TRACE_LOG_SHEET_NAME, address, value);
    });
  }

  return (
    <div className="fpa-form-stack fpa-trace-layout">
      <section className="compact-card fpa-subpanel fpa-trace-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Trace Log</span>
            <h4>{traceView.title}</h4>
            <p className="section-note">{traceView.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="info">Exact rows 18-20 logic</StatusPill>
            <StatusPill tone={overrideTone(traceView.unloggedOverrideCount)}>{traceView.status}</StatusPill>
            <span className="section-chip">{traceView.entryRowLimit} workbook log rows</span>
          </div>
        </div>

        <div className="fpa-kpi-grid">
          <MetricCard
            label="Overrides present in model"
            value={traceView.overridesPresentCount}
            note="Workbook row 18 | numeric overrides in 05 Workload and 06 Complexity."
          />
          <MetricCard
            label="Rows logged above"
            value={traceView.rowsLoggedAbove}
            note="Workbook row 19 | counts filled override values in F6:F15."
          />
          <MetricCard
            label="Unlogged overrides"
            value={<StatusPill tone={overrideTone(traceView.unloggedOverrideCount)}>{traceView.unloggedOverrideCount}</StatusPill>}
            note="Workbook row 20 | MAX(0, row18 - row19)."
          />
          <MetricCard
            label="Source notes missing"
            value={<StatusPill tone={ruleTone(traceView.sourceRationaleMissingCount)}>{traceView.sourceRationaleMissingCount}</StatusPill>}
            note="R19 still depends on the note staying on 05/06, not just in this log."
          />
        </div>
      </section>

      {traceView.unloggedOverrideCount > 0 ? (
        <section className="compact-card info-banner fpa-trace-banner">
          <div>
            <p className="section-kicker">Workbook Row 20</p>
            <h3>{traceView.status}</h3>
            <p className="muted-copy">
              The Excel logic stays AMBER until every active override counted in row 18 is covered by a filled override-value entry in rows 6-15.
            </p>
          </div>
          <StatusPill tone="warning">{traceView.blankRowCount} blank log rows left</StatusPill>
        </section>
      ) : null}

      <div className="fpa-trace-two-column">
        <SectionCard
          badge="Detected Overrides"
          title="Active source-sheet overrides"
          note="These are the exact override cells counted by the Excel row-18 formula. Use Add to Log to copy them into the audit trail rows."
          meta={(
            <div className="fpa-tab-meta">
              <span className="section-chip">{traceView.matchedLoggedCount}/{traceView.overridesPresentCount} matched</span>
              <span className="section-chip">{traceView.blankRowCount} blank log rows</span>
            </div>
          )}
        >
          {traceView.overrides.length ? (
            <div className="fpa-table-wrap">
              <table className="fpa-table fpa-trace-source-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Cell</th>
                    <th>Original</th>
                    <th>Override</th>
                    <th>Source Note</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {traceView.overrides.map((item) => (
                    <tr key={item.key}>
                      <td>
                        <div className="fpa-trace-source-label">
                          <strong>{item.sourceLabel}</strong>
                          <span>{item.sheetLabel} · {item.typeLabel}</span>
                        </div>
                      </td>
                      <td><code>{item.cellAddress}</code></td>
                      <td>{item.originalValue || "-"}</td>
                      <td>{item.overrideValue || "-"}</td>
                      <td>
                        <StatusPill tone={item.sourceRationaleMissing ? "danger" : "success"}>
                          {item.sourceRationaleMissing ? "Missing on 05/06" : "Present on 05/06"}
                        </StatusPill>
                      </td>
                      <td>
                        {item.isLogged ? (
                          <StatusPill tone="success">Logged in row {item.loggedRowNumbers.join(", ")}</StatusPill>
                        ) : (
                          <StatusPill tone="warning">Not logged</StatusPill>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary fpa-trace-inline-button"
                          onClick={() => handleAutofillOverride(item)}
                          disabled={!canEditP2p || isBusy || !traceView.firstEmptyRowNumber}
                        >
                          {item.isLogged ? "Copy Again" : "Add to Log"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <article className="review-panel">
              <h4>No active overrides</h4>
              <p className="section-note">No numeric overrides currently exist on 05 Workload or 06 Complexity, so the trace log can remain empty.</p>
            </article>
          )}
        </SectionCard>

        <SectionCard
          badge="Workbook Rules"
          title="What this tab must preserve"
          note="The portal keeps the Excel logic exact, while making the log easier to maintain."
        >
          <div className="summary-list">
            <div className="summary-item">
              <span className="summary-label">Row 18</span>
              <span className="summary-value">Counts numeric overrides in `P2P_05 Workload!I14:I23` and `P2P_06 Complexity!E6:E14`.</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Row 19</span>
              <span className="summary-value">Counts filled override values in `F6:F15` only.</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Row 20</span>
              <span className="summary-value">Subtracts row 19 from row 18 and turns AMBER until the gap is zero.</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">R19 dependency</span>
              <span className="summary-value">The source rationale must still exist on 05/06; logging here does not replace that source note.</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        badge="Workbook Rows 6-15"
        title="Traceability log"
        note="Excel provides 10 manual log rows. Each filled override-value cell in column F counts toward the workbook logged-row total."
        meta={(
          <div className="fpa-tab-meta">
            <span className="section-chip">{traceView.blankRowCount} blank rows</span>
            <span className="section-chip">{traceView.entryRowLimit - traceView.blankRowCount} rows used</span>
          </div>
        )}
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-trace-log-table">
            <thead>
              <tr>
                <th>Row</th>
                {TRACE_LOG_COLUMNS.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {traceView.logRows.map((row) => (
                <tr key={row.rowNumber} className={row.matchesActiveOverride ? "is-logged" : row.overrideValue ? "is-review" : ""}>
                  <td>
                    <strong>#{row.rowNumber}</strong>
                  </td>
                  {TRACE_LOG_COLUMNS.map((column) => {
                    const address = `${column.addressColumn}${row.rowNumber}`;
                    const value = readDraftValue(draftInputs, address, row[`${column.key}Value`] || "");

                    return (
                      <td key={address}>
                        <input
                          aria-label={`${column.label} row ${row.rowNumber}`}
                          type={column.type}
                          className={[
                            "fpa-trace-input",
                            `is-${column.key}`,
                          ].join(" ")}
                          value={value}
                          placeholder={column.placeholder}
                          disabled={!canEditP2p || isBusy}
                          onChange={(event) => handleDraftChange(address, event.target.value)}
                          onBlur={(event) => handleDraftCommit(address, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                  <td>
                    <StatusPill tone={rowStatusTone(row)}>
                      {row.matchesActiveOverride ? "Matches active override" : row.overrideValue ? "Manual / unmatched" : "Empty"}
                    </StatusPill>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary fpa-trace-inline-button"
                      onClick={() => handleClearRow(row.rowNumber)}
                      disabled={!canEditP2p || isBusy || row.isBlank}
                    >
                      Clear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
