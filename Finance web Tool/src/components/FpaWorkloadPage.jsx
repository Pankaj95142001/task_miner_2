import { useEffect, useMemo, useState } from "react";

import {
  buildFpaWorkloadWorkbookView,
  FPA_WORKLOAD_WORKBOOK_SNAPSHOT,
  getWorkloadOverview,
  isWorkloadNumericCell,
  normalizeWorkloadInputValue,
} from "../config/fpaWorkload";

const EMPTY_INPUTS = Object.freeze({});
const BENCHMARK_SHEET_NAME = "FPA_04 Benchmarks";
const PROCESS_ROW_DEFS = [
  { row: 14, reconciliationRow: 44 },
  { row: 15, reconciliationRow: 45 },
  { row: 16, reconciliationRow: 46 },
  { row: 17, reconciliationRow: 47 },
  { row: 18, reconciliationRow: 48 },
  { row: 19, reconciliationRow: 49 },
  { row: 20, reconciliationRow: 50 },
  { row: 21, reconciliationRow: 51 },
  { row: 22, reconciliationRow: 52 },
  { row: 23, reconciliationRow: 53 },
  { row: 24, reconciliationRow: 54 },
  { row: 25, reconciliationRow: 55 },
];

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
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

function buildAddressMap(rows) {
  const addressMap = {};

  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      addressMap[cell.address] = cell;
    });
  });

  return addressMap;
}

function readCellText(addressMap, address, fallback = "—") {
  const text = String(addressMap[address]?.text ?? "").trim();
  return text || fallback;
}

function readDraftValue(draftInputs, cell) {
  if (!cell) {
    return "";
  }

  return Object.prototype.hasOwnProperty.call(draftInputs, cell.address)
    ? String(draftInputs[cell.address] ?? "")
    : String(cell.text ?? "");
}

function workbookTone(value) {
  const text = String(value ?? "").trim().toUpperCase();

  if (!text || text === "—" || text === "-") {
    return "neutral";
  }

  if (text.includes("RED")) {
    return "danger";
  }

  if (text.includes("AMBER")) {
    return "warning";
  }

  if (text.includes("GREEN") || text === "OK" || text.startsWith("OK ")) {
    return "success";
  }

  return "info";
}

function methodTone(value) {
  const text = String(value ?? "").trim().toUpperCase();

  if (text.startsWith("A")) {
    return "success";
  }

  if (text.startsWith("D")) {
    return "info";
  }

  if (text.startsWith("E")) {
    return "warning";
  }

  return "neutral";
}

function confidenceTone(value) {
  const text = String(value ?? "").trim().toUpperCase();

  if (text.includes("CC/CE")) {
    return "success";
  }

  if (text.includes("CE-DRIVER")) {
    return "info";
  }

  if (text.includes("BM-BAND")) {
    return "warning";
  }

  return "neutral";
}

function WorkloadField({
  cell,
  label,
  placeholder,
  canEditFpa,
  isBusy,
  draftInputs,
  onDraftChange,
  onDraftCommit,
  className = "",
}) {
  if (!cell) {
    return <span className="fpa-workload-static">—</span>;
  }

  const value = readDraftValue(draftInputs, cell);
  const classes = [
    cell.kind === "input-select" ? "fpa-workload-select" : "fpa-workload-input",
    isWorkloadNumericCell(cell) ? "is-numeric" : "",
    className,
  ].filter(Boolean).join(" ");

  if (cell.kind === "input-select") {
    return (
      <select
        aria-label={label}
        className={classes}
        value={value}
        disabled={!canEditFpa || isBusy}
        onChange={(event) => {
          onDraftChange(cell.address, event.target.value);
          onDraftCommit(cell, event.target.value);
        }}
      >
        <option value="">Select</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }

  return (
    <input
      aria-label={label}
      type="text"
      className={classes}
      value={value}
      placeholder={placeholder}
      disabled={!canEditFpa || isBusy}
      onChange={(event) => onDraftChange(cell.address, event.target.value)}
      onBlur={(event) => onDraftCommit(cell, event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export default function FpaWorkloadPage({
  currentDeal,
  fpaWorkspace,
  canEditFpa,
  isBusy,
  onUpdateCell,
}) {
  const overview = getWorkloadOverview();
  const sheetName = FPA_WORKLOAD_WORKBOOK_SNAPSHOT.sheetName;
  const workbookInputs = currentDeal?.fpaWorkbookInputs?.[sheetName] && typeof currentDeal.fpaWorkbookInputs[sheetName] === "object"
    ? currentDeal.fpaWorkbookInputs[sheetName]
    : EMPTY_INPUTS;
  const benchmarkInputs = currentDeal?.fpaWorkbookInputs?.[BENCHMARK_SHEET_NAME] && typeof currentDeal.fpaWorkbookInputs[BENCHMARK_SHEET_NAME] === "object"
    ? currentDeal.fpaWorkbookInputs[BENCHMARK_SHEET_NAME]
    : EMPTY_INPUTS;
  const [draftInputs, setDraftInputs] = useState(() => ({ ...workbookInputs }));

  useEffect(() => {
    setDraftInputs({ ...workbookInputs });
  }, [workbookInputs]);

  const workbookView = useMemo(
    () => buildFpaWorkloadWorkbookView(draftInputs, benchmarkInputs, fpaWorkspace || {}, currentDeal || {}),
    [benchmarkInputs, currentDeal, draftInputs, fpaWorkspace],
  );

  const addressMap = useMemo(() => buildAddressMap(workbookView.rows), [workbookView.rows]);

  const factorItems = useMemo(() => ([
    { label: "Revenue band", value: readCellText(addressMap, "C5"), note: `Band index ${readCellText(addressMap, "F5")}` },
    { label: "Complexity multiplier", value: readCellText(addressMap, "C6"), note: "Industry benchmark complexity factor" },
    { label: "Volume multiplier", value: readCellText(addressMap, "F6"), note: "Industry benchmark volume factor" },
    { label: "Primary platform adjustment", value: readCellText(addressMap, "C7"), note: "Lookup from EPM platform" },
    { label: "Close adjustment", value: readCellText(addressMap, "F7"), note: "Lookup from monthly close complexity" },
    { label: "Percentile factor", value: readCellText(addressMap, "C8"), note: "Benchmark policy percent selection" },
    { label: "Forecast cycles / year", value: readCellText(addressMap, "C9"), note: "Discovery cadence lookup" },
    { label: "Ad-hoc allowance", value: readCellText(addressMap, "C10"), note: "Discovery intensity lookup" },
    { label: "Data / integration multiplier", value: readCellText(addressMap, "C11"), note: "Technology-stack effort factor" },
    { label: "Normalisation factor", value: readCellText(addressMap, "F11"), note: "Applied when Method A is used" },
  ]), [addressMap]);

  const topKpis = useMemo(() => ([
    { label: "Total Monthly Hours", value: readCellText(addressMap, "K26"), note: "Final in-scope hours / month" },
    { label: "Annual Hours", value: readCellText(addressMap, "K27"), note: "Workbook monthly total × 12" },
    { label: "Peak Month Hours", value: readCellText(addressMap, "K28"), note: "Applies workbook peak-month factor" },
    { label: "Method Mix", value: readCellText(addressMap, "C35"), note: "A customer / D driver / E band" },
  ]), [addressMap]);

  const governanceMetrics = useMemo(() => ([
    { label: "Implied Blind FTE", value: readCellText(addressMap, "C31"), note: "Monthly hours ÷ productive-hours proxy" },
    { label: "Customer Tower Staff", value: readCellText(addressMap, "C32"), note: "Current FP&A team from Discovery" },
    { label: "Implied Outsourced Share", value: readCellText(addressMap, "C33"), note: "Blind FTE vs current tower staff" },
    { label: "Override Rows Without Note", value: readCellText(addressMap, "C36"), note: "Governance exception count" },
  ]), [addressMap]);

  const processRows = useMemo(
    () => PROCESS_ROW_DEFS.map(({ row, reconciliationRow }, index) => ({
      id: `workload-${row}`,
      row,
      reconciliationRow,
      number: readCellText(addressMap, `A${row}`, String(index + 1)),
      processLabel: readCellText(addressMap, `B${row}`, `Process ${index + 1}`),
      driverHours: readCellText(addressMap, `C${row}`),
      bandSeed: readCellText(addressMap, `D${row}`),
      customerHours: readCellText(addressMap, `E${row}`),
      method: readCellText(addressMap, `F${row}`),
      adjustedHours: readCellText(addressMap, `G${row}`),
      scopedHours: readCellText(addressMap, `H${row}`),
      overrideCell: addressMap[`I${row}`],
      noteCell: addressMap[`J${row}`],
      finalHours: readCellText(addressMap, `K${row}`),
      confidence: readCellText(addressMap, `L${row}`),
      driverVsBand: readCellText(addressMap, `M${row}`),
      selectedBase: readCellText(addressMap, `N${row}`),
      reconciliationLabel: readCellText(addressMap, `B${reconciliationRow}`, readCellText(addressMap, `B${row}`, `Process ${index + 1}`)),
      customerFteCell: addressMap[`C${reconciliationRow}`],
      directHoursCell: addressMap[`D${reconciliationRow}`],
      retainedShareCell: addressMap[`E${reconciliationRow}`],
      hoursFromFte: readCellText(addressMap, `F${reconciliationRow}`),
      transferredHours: readCellText(addressMap, `G${reconciliationRow}`),
      driverHoursForRecon: readCellText(addressMap, `H${reconciliationRow}`),
      variancePct: readCellText(addressMap, `I${reconciliationRow}`),
      varianceFlag: readCellText(addressMap, `M${reconciliationRow}`),
    })),
    [addressMap],
  );

  const reconciliationControlCells = useMemo(() => ({
    sharedCustomerFte: addressMap.C40,
    typedTotalCustomerFte: addressMap.C41,
    defaultRetainedShare: addressMap.C42,
  }), [addressMap]);

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(cell, value) {
    const normalizedValue = normalizeWorkloadInputValue(cell, value);

    setDraftInputs((previous) => ({
      ...previous,
      [cell.address]: normalizedValue,
    }));

    onUpdateCell(sheetName, cell.address, normalizedValue);
  }

  return (
    <div className="fpa-form-stack fpa-workload-layout">
      <SectionCard
        badge="Workbook Workload"
        title={overview.title}
        note={overview.note}
        className="fpa-workload-hero"
        meta={(
          <div className="fpa-tab-meta">
            <StatusPill tone="info">{FPA_WORKLOAD_WORKBOOK_SNAPSHOT.formulaCount} workbook formulas</StatusPill>
            <span className="section-chip">{FPA_WORKLOAD_WORKBOOK_SNAPSHOT.editableCellCount} manual input cells</span>
          </div>
        )}
      >
        <div className="fpa-kpi-grid">
          {topKpis.map((item) => (
            <MetricCard key={item.label} label={item.label} value={item.value} note={item.note} />
          ))}
        </div>
      </SectionCard>

      <div className="fpa-workload-two-column">
        <SectionCard
          badge="Factor Chain"
          title="Workbook adjustment drivers"
          note="These are workbook-derived lookups from Discovery and Benchmarks. They stay read-only here and feed the exact Workload formulas."
          className="fpa-workload-panel"
        >
          <div className="fpa-workload-fact-grid">
            {factorItems.map((item) => (
              <article key={item.label} className="fpa-workload-fact-card">
                <span className="metric-label">{item.label}</span>
                <strong>{item.value}</strong>
                <span className="metric-note">{item.note}</span>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          badge="Sanity & Governance"
          title="Sizing checks before pricing"
          note="These workbook checks confirm the blind size, current organisation view, and whether overrides are properly explained."
          className="fpa-workload-panel"
        >
          <div className="fpa-kpi-grid fpa-workload-mini-kpis">
            {governanceMetrics.map((item) => (
              <MetricCard key={item.label} label={item.label} value={item.value} note={item.note} />
            ))}
          </div>

          <div className="fpa-workload-status-grid">
            <article className="review-panel">
              <span className="summary-label">Share Status</span>
              <StatusPill tone={workbookTone(readCellText(addressMap, "D33"))}>{readCellText(addressMap, "D33")}</StatusPill>
            </article>
            <article className="review-panel">
              <span className="summary-label">Tie-out Status</span>
              <StatusPill tone={workbookTone(readCellText(addressMap, "C57"))}>{readCellText(addressMap, "C57")}</StatusPill>
            </article>
            <article className="review-panel">
              <span className="summary-label">Reconciliation Verdict</span>
              <StatusPill tone={workbookTone(readCellText(addressMap, "C60"))}>{readCellText(addressMap, "C60")}</StatusPill>
            </article>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        badge="Process Workload"
        title="A / D / E method selection and workload chain"
        note="Every row below is workbook-backed. Method A uses customer actuals, Method D uses proxy drivers, and Method E falls back to the benchmark band seed."
        className="fpa-workload-panel"
        meta={(
          <div className="fpa-tab-meta">
            <StatusPill tone="success">A = Customer</StatusPill>
            <StatusPill tone="info">D = Proxy Driver</StatusPill>
            <StatusPill tone="warning">E = Band Seed</StatusPill>
          </div>
        )}
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-workload-process-table">
            <thead>
              <tr>
                <th>Process</th>
                <th className="is-number">Driver (D)</th>
                <th className="is-number">Band (E)</th>
                <th className="is-number">Customer (A)</th>
                <th>Method</th>
                <th className="is-number">Selected Base</th>
                <th className="is-number">Adjusted</th>
                <th className="is-number">Scoped</th>
                <th className="is-number">Override</th>
                <th className="is-number">Final Hrs / Mo</th>
                <th>Confidence</th>
                <th>Driver vs Band</th>
                <th>Override Note</th>
              </tr>
            </thead>
            <tbody>
              {processRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="fpa-workload-process-name">
                      <span className="fpa-workload-process-code">{row.number}</span>
                      <strong>{row.processLabel}</strong>
                    </div>
                  </td>
                  <td className="is-number">{row.driverHours}</td>
                  <td className="is-number">{row.bandSeed}</td>
                  <td className="is-number">{row.customerHours}</td>
                  <td>
                    <StatusPill tone={methodTone(row.method)}>{row.method}</StatusPill>
                  </td>
                  <td className="is-number">{row.selectedBase}</td>
                  <td className="is-number">{row.adjustedHours}</td>
                  <td className="is-number">{row.scopedHours}</td>
                  <td className="is-number">
                    <WorkloadField
                      cell={row.overrideCell}
                      label={`${row.processLabel} override hours`}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      draftInputs={draftInputs}
                      onDraftChange={handleDraftChange}
                      onDraftCommit={handleDraftCommit}
                      className="fpa-workload-input-cell"
                    />
                  </td>
                  <td className="is-number fpa-workload-final-cell">{row.finalHours}</td>
                  <td>
                    <StatusPill tone={confidenceTone(row.confidence)}>{row.confidence}</StatusPill>
                  </td>
                  <td>
                    <StatusPill tone={workbookTone(row.driverVsBand)}>{row.driverVsBand}</StatusPill>
                  </td>
                  <td>
                    <WorkloadField
                      cell={row.noteCell}
                      label={`${row.processLabel} override note`}
                      placeholder="Explain manual override"
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      draftInputs={draftInputs}
                      onDraftChange={handleDraftChange}
                      onDraftCommit={handleDraftCommit}
                      className="fpa-workload-note-input"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Customer-FTE Reconciliation"
        title="Method A decomposition and tie-out"
        note="Use this section only when the client has shared current FP&A staffing or direct effort hours. The workbook then compares customer actuals against the proxy-driver path."
        className="fpa-workload-panel"
      >
        <div className="fpa-workload-control-grid">
          <label className="fpa-workload-control-card">
            <span className="summary-label">Customer shared current FTE?</span>
            <WorkloadField
              cell={reconciliationControlCells.sharedCustomerFte}
              label="Customer shared current FTE"
              canEditFpa={canEditFpa}
              isBusy={isBusy}
              draftInputs={draftInputs}
              onDraftChange={handleDraftChange}
              onDraftCommit={handleDraftCommit}
            />
            <span className="metric-note">Controls whether Method A is available.</span>
          </label>

          <label className="fpa-workload-control-card">
            <span className="summary-label">Typed Total Customer FTE</span>
            <WorkloadField
              cell={reconciliationControlCells.typedTotalCustomerFte}
              label="Typed total customer FTE"
              canEditFpa={canEditFpa}
              isBusy={isBusy}
              draftInputs={draftInputs}
              onDraftChange={handleDraftChange}
              onDraftCommit={handleDraftCommit}
            />
            <span className="metric-note">Top-down total used for tie-out validation.</span>
          </label>

          <label className="fpa-workload-control-card">
            <span className="summary-label">Default Retained Share</span>
            <WorkloadField
              cell={reconciliationControlCells.defaultRetainedShare}
              label="Default retained share"
              canEditFpa={canEditFpa}
              isBusy={isBusy}
              draftInputs={draftInputs}
              onDraftChange={handleDraftChange}
              onDraftCommit={handleDraftCommit}
            />
            <span className="metric-note">Used when a process row keeps its retained % blank.</span>
          </label>
        </div>

        {readCellText(addressMap, "C40", "Yes") !== "Yes" ? (
          <div className="info-banner fpa-workload-banner">
            <h3>Method A is currently inactive</h3>
            <p>The reconciliation inputs remain available, but the workbook ignores them until <strong>Customer shared current FTE?</strong> is set to <strong>Yes</strong>.</p>
          </div>
        ) : null}

        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-workload-process-table">
            <thead>
              <tr>
                <th>Process</th>
                <th className="is-number">Customer FTE</th>
                <th className="is-number">Direct Hrs / Mo</th>
                <th className="is-number">Retained %</th>
                <th className="is-number">Hours From FTE</th>
                <th className="is-number">Transferred (A)</th>
                <th className="is-number">Driver / Band</th>
                <th className="is-number">Variance %</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {processRows.map((row) => (
                <tr key={`reconciliation-${row.id}`}>
                  <td>
                    <div className="fpa-workload-process-name">
                      <span className="fpa-workload-process-code">{row.number}</span>
                      <strong>{row.reconciliationLabel}</strong>
                    </div>
                  </td>
                  <td className="is-number">
                    <WorkloadField
                      cell={row.customerFteCell}
                      label={`${row.reconciliationLabel} customer FTE`}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      draftInputs={draftInputs}
                      onDraftChange={handleDraftChange}
                      onDraftCommit={handleDraftCommit}
                      className="fpa-workload-input-cell"
                    />
                  </td>
                  <td className="is-number">
                    <WorkloadField
                      cell={row.directHoursCell}
                      label={`${row.reconciliationLabel} direct hours per month`}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      draftInputs={draftInputs}
                      onDraftChange={handleDraftChange}
                      onDraftCommit={handleDraftCommit}
                      className="fpa-workload-input-cell"
                    />
                  </td>
                  <td className="is-number">
                    <WorkloadField
                      cell={row.retainedShareCell}
                      label={`${row.reconciliationLabel} retained share`}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      draftInputs={draftInputs}
                      onDraftChange={handleDraftChange}
                      onDraftCommit={handleDraftCommit}
                      className="fpa-workload-input-cell"
                    />
                  </td>
                  <td className="is-number">{row.hoursFromFte}</td>
                  <td className="is-number">{row.transferredHours}</td>
                  <td className="is-number">{row.driverHoursForRecon}</td>
                  <td className="is-number">{row.variancePct}</td>
                  <td>
                    <StatusPill tone={workbookTone(row.varianceFlag)}>{row.varianceFlag}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fpa-kpi-grid fpa-workload-mini-kpis">
          <MetricCard label="Decomposition FTE" value={readCellText(addressMap, "C56")} note="Process-level customer FTE sum" />
          <MetricCard label="Red Variances" value={readCellText(addressMap, "C58")} note="Rows above the red A-vs-D threshold" />
          <MetricCard label="Transferred Hrs / Mo" value={readCellText(addressMap, "C59")} note="Total Method A transferred workload" />
          <MetricCard label="Typed Total FTE" value={readCellText(addressMap, "C41")} note="Top-down total entered above" />
        </div>

        <div className="fpa-workload-status-grid">
          <article className="review-panel">
            <span className="summary-label">Tie-out Status</span>
            <StatusPill tone={workbookTone(readCellText(addressMap, "C57"))}>{readCellText(addressMap, "C57")}</StatusPill>
          </article>
          <article className="review-panel">
            <span className="summary-label">Reconciliation Verdict</span>
            <StatusPill tone={workbookTone(readCellText(addressMap, "C60"))}>{readCellText(addressMap, "C60")}</StatusPill>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
