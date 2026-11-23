import { useEffect, useMemo, useState } from "react";

import {
  buildP2pOpsModelWorkbookView,
  P2P_OPS_MODEL_SNAPSHOT,
  formatOpsModelInputValue,
  formatOpsModelValue,
  normalizeOpsModelInputValue,
  OPS_LOCATION_OPTIONS,
  OPS_TILT_OPTIONS,
  OPS_YES_NO_OPTIONS,
} from "../config/p2pOpsModel";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = P2P_OPS_MODEL_SNAPSHOT.sheetName;

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, note }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      {note ? <span className="metric-note">{note}</span> : null}
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

function readDraftValue(draftInputs, address, fallback = "") {
  return Object.prototype.hasOwnProperty.call(draftInputs, address)
    ? String(draftInputs[address] ?? "")
    : fallback;
}

function blendStatusTone(value) {
  return String(value || "").startsWith("FIX") ? "danger" : "success";
}

function buildDraftInputs(workbookView) {
  const nextDraftInputs = {};

  workbookView.shoreMixTable.rows.forEach((row) => {
    Object.values(row.values).forEach((cell) => {
      nextDraftInputs[cell.address] = formatOpsModelInputValue("percent", cell.value);
    });
  });

  workbookView.locationBlendRows.forEach((row) => {
    nextDraftInputs[row.location1.address] = formatOpsModelInputValue("location", row.location1.value);
    nextDraftInputs[row.split1.address] = formatOpsModelInputValue("percent", row.split1.value);
    nextDraftInputs[row.location2.address] = formatOpsModelInputValue("location", row.location2.value);
    nextDraftInputs[row.split2.address] = formatOpsModelInputValue("percent", row.split2.value);
  });

  workbookView.tiltTables.forEach((tilt) => {
    tilt.rows.forEach((row) => {
      Object.values(row.values).forEach((cell) => {
        nextDraftInputs[cell.address] = formatOpsModelInputValue("percent", cell.value);
      });
    });
  });

  Object.values(workbookView.personaTiltRow.values).forEach((cell) => {
    nextDraftInputs[cell.address] = formatOpsModelInputValue("tilt", cell.value);
  });

  nextDraftInputs[workbookView.languageCoverage.address] = formatOpsModelInputValue("yesNo", workbookView.languageCoverage.value);

  return nextDraftInputs;
}

function buildDisplayMap(workbookView) {
  return buildDraftInputs(workbookView);
}

function OpsInputCell({
  kind,
  address,
  label,
  value,
  canEditP2p,
  isBusy,
  onChange,
  onCommit,
}) {
  const isSelect = kind === "location" || kind === "tilt" || kind === "yesNo";

  if (isSelect) {
    const options = kind === "location"
      ? OPS_LOCATION_OPTIONS
      : kind === "tilt"
        ? OPS_TILT_OPTIONS
        : OPS_YES_NO_OPTIONS;

    return (
      <select
        aria-label={label}
        className="fpa-ops-model-select"
        value={value}
        disabled={!canEditP2p || isBusy}
        onChange={(event) => onCommit(event.target.value)}
      >
        {options.map((option) => (
          <option key={`${address}-${option}`} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (!canEditP2p) {
    return <span className="fpa-ops-model-readonly">{value || "—"}</span>;
  }

  return (
    <input
      aria-label={label}
      type="text"
      className="fpa-ops-model-input is-numeric"
      value={value}
      autoComplete="off"
      disabled={isBusy}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function RowLabel({ primary, secondary = "" }) {
  return (
    <div className="fpa-ops-model-row-label">
      <strong>{primary}</strong>
      {secondary ? <span>{secondary}</span> : null}
    </div>
  );
}

export default function P2pOpsModelPage({
  currentDeal,
  canEditP2p,
  isBusy,
  onUpdateCell,
}) {
  const opsWorkbookInputs = currentDeal?.p2pWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.p2pWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.p2pWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;
  const rateCardInputs = currentDeal?.p2pWorkbookInputs?.["P2P_10 Rate Card"] && typeof currentDeal.p2pWorkbookInputs["P2P_10 Rate Card"] === "object"
    ? currentDeal.p2pWorkbookInputs["P2P_10 Rate Card"]
    : EMPTY_INPUTS;

  const committedWorkbookView = useMemo(
    () => buildP2pOpsModelWorkbookView({ opsWorkbookInputs, rateCardInputs }),
    [opsWorkbookInputs, rateCardInputs],
  );

  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(committedWorkbookView));

  useEffect(() => {
    setDraftInputs(buildDraftInputs(committedWorkbookView));
  }, [committedWorkbookView]);

  const previewWorkbookView = useMemo(
    () => buildP2pOpsModelWorkbookView({
      opsWorkbookInputs: {
        ...opsWorkbookInputs,
        ...draftInputs,
      },
      rateCardInputs,
    }),
    [draftInputs, opsWorkbookInputs, rateCardInputs],
  );

  const persistedDisplayMap = useMemo(() => buildDisplayMap(committedWorkbookView), [committedWorkbookView]);

  const summaryCostRow = previewWorkbookView.personaFactorRows.find((row) => row.id === "blendedLoadedCostPerFte") || previewWorkbookView.personaFactorRows[0];

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(kind, address, value) {
    const normalizedValue = normalizeOpsModelInputValue(kind, value);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [address]: persistedDisplayMap[address] ?? "",
      }));
      return;
    }

    const nextDisplayValue = normalizedValue === "" ? "" : formatOpsModelInputValue(kind, normalizedValue);

    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextDisplayValue,
    }));

    onUpdateCell(SHEET_NAME, address, normalizedValue);
  }

  return (
    <div className="fpa-form-stack fpa-ops-model-layout">
      <section className="compact-card fpa-subpanel fpa-ops-model-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Local Ops Model</span>
            <h4>{P2P_OPS_MODEL_SNAPSHOT.title}</h4>
            <p className="section-note">{P2P_OPS_MODEL_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone={previewWorkbookView.languageCoverage.value === "Yes" ? "success" : "warning"}>Language Coverage {previewWorkbookView.languageCoverage.value}</StatusPill>
            <span className="section-chip">{P2P_OPS_MODEL_SNAPSHOT.editableCellCount} editable cells</span>
            <span className="section-chip">{P2P_OPS_MODEL_SNAPSHOT.formulaCount} formulas</span>
          </div>
        </div>

        <div className="fpa-ops-model-kpi-grid">
          {previewWorkbookView.personas.map((persona) => (
            <MetricCard
              key={persona.id}
              label={persona.label}
              value={formatOpsModelValue(summaryCostRow.values[persona.id], "whole")}
              note="Blended loaded cost / FTE"
            />
          ))}
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 4-9"
        title="Shore mix by persona"
        note="Each persona column must total 100% across Onshore, Nearshore, and Offshore. This matches the workbook section A exactly."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone="info">5 persona columns</StatusPill>
            <span className="section-chip">15 editable cells</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-ops-model-table-wrap">
          <table className="fpa-table fpa-ops-model-table">
            <thead>
              <tr>
                <th>Layer</th>
                {previewWorkbookView.personas.map((persona) => (
                  <th key={persona.id}>{persona.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewWorkbookView.shoreMixTable.rows.map((row) => (
                <tr key={row.id}>
                  <td className="fpa-ops-model-label-cell"><RowLabel primary={row.label} secondary={`Workbook row ${row.shoreMixRow}`} /></td>
                  {previewWorkbookView.personas.map((persona) => (
                    <td key={`${row.id}-${persona.id}`} className="fpa-ops-model-value-cell">
                      <OpsInputCell
                        kind="percent"
                        address={row.values[persona.id].address}
                        label={`${row.label} ${persona.label}`}
                        value={readDraftValue(draftInputs, row.values[persona.id].address, formatOpsModelInputValue("percent", row.values[persona.id].value))}
                        canEditP2p={canEditP2p}
                        isBusy={isBusy}
                        onChange={(nextValue) => handleDraftChange(row.values[persona.id].address, nextValue)}
                        onCommit={(nextValue) => handleDraftCommit("percent", row.values[persona.id].address, nextValue)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="fpa-ops-model-label-cell"><RowLabel primary="Total" secondary="Workbook row 9" /></td>
                {previewWorkbookView.personas.map((persona) => (
                  <td key={`total-${persona.id}`} className="fpa-ops-model-value-cell is-emphasis">
                    {formatOpsModelValue(previewWorkbookView.shoreMixTable.totals[persona.id], "percent1")}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 11-15"
        title="Location blend per layer"
        note="Each layer blends up to two locations. The split check mirrors the Excel formula in column G and must total 100%."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">12 editable cells</span>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-ops-model-table-wrap">
          <table className="fpa-table fpa-ops-model-table">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Location 1</th>
                <th>Split 1</th>
                <th>Location 2</th>
                <th>Split 2</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {previewWorkbookView.locationBlendRows.map((row) => (
                <tr key={row.id}>
                  <td className="fpa-ops-model-label-cell"><RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} /></td>
                  <td className="fpa-ops-model-value-cell">
                    <OpsInputCell
                      kind="location"
                      address={row.location1.address}
                      label={`${row.label} location 1`}
                      value={readDraftValue(draftInputs, row.location1.address, row.location1.value)}
                      canEditP2p={canEditP2p}
                      isBusy={isBusy}
                      onChange={() => {}}
                      onCommit={(nextValue) => handleDraftCommit("location", row.location1.address, nextValue)}
                    />
                  </td>
                  <td className="fpa-ops-model-value-cell">
                    <OpsInputCell
                      kind="percent"
                      address={row.split1.address}
                      label={`${row.label} split 1`}
                      value={readDraftValue(draftInputs, row.split1.address, formatOpsModelInputValue("percent", row.split1.value))}
                      canEditP2p={canEditP2p}
                      isBusy={isBusy}
                      onChange={(nextValue) => handleDraftChange(row.split1.address, nextValue)}
                      onCommit={(nextValue) => handleDraftCommit("percent", row.split1.address, nextValue)}
                    />
                  </td>
                  <td className="fpa-ops-model-value-cell">
                    <OpsInputCell
                      kind="location"
                      address={row.location2.address}
                      label={`${row.label} location 2`}
                      value={readDraftValue(draftInputs, row.location2.address, row.location2.value)}
                      canEditP2p={canEditP2p}
                      isBusy={isBusy}
                      onChange={() => {}}
                      onCommit={(nextValue) => handleDraftCommit("location", row.location2.address, nextValue)}
                    />
                  </td>
                  <td className="fpa-ops-model-value-cell">
                    <OpsInputCell
                      kind="percent"
                      address={row.split2.address}
                      label={`${row.label} split 2`}
                      value={readDraftValue(draftInputs, row.split2.address, formatOpsModelInputValue("percent", row.split2.value))}
                      canEditP2p={canEditP2p}
                      isBusy={isBusy}
                      onChange={(nextValue) => handleDraftChange(row.split2.address, nextValue)}
                      onCommit={(nextValue) => handleDraftCommit("percent", row.split2.address, nextValue)}
                    />
                  </td>
                  <td className="fpa-ops-model-value-cell is-status"><StatusPill tone={blendStatusTone(row.status.value)}>{row.status.value}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="fpa-ops-model-split-grid">
        <SectionCard
          badge="Workbook Rows 17-24"
          title="Loaded cost per grade per layer"
          note="This section blends the selected locations against the Rate Card fully-loaded cost grid in tab 10."
        >
          <div className="fpa-table-wrap fpa-ops-model-table-wrap">
            <table className="fpa-table fpa-ops-model-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Onshore</th>
                  <th>Nearshore</th>
                  <th>Offshore</th>
                </tr>
              </thead>
              <tbody>
                {previewWorkbookView.loadedCostRows.map((row) => (
                  <tr key={row.id}>
                    <td className="fpa-ops-model-label-cell"><RowLabel primary={row.label} secondary={`Workbook row ${row.loadedCostRow}`} /></td>
                    <td className="fpa-ops-model-value-cell">{formatOpsModelValue(row.values.onshore, "whole")}</td>
                    <td className="fpa-ops-model-value-cell">{formatOpsModelValue(row.values.nearshore, "whole")}</td>
                    <td className="fpa-ops-model-value-cell">{formatOpsModelValue(row.values.offshore, "whole")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          badge="Workbook Rows 61-72"
          title="Layer cost factors"
          note="These factors are location-blended and persona-independent. They feed the downstream cost and staffing tabs."
        >
          <div className="fpa-ops-model-factor-grid">
            {previewWorkbookView.layerFactorGroups.map((group) => (
              <article key={group.id} className="fpa-ops-model-factor-card">
                <div className="step-header fpa-ops-model-factor-header">
                  <div>
                    <span className="step-badge">{group.title}</span>
                    <h5>{group.title} by layer</h5>
                  </div>
                </div>
                <div className="fpa-table-wrap fpa-ops-model-table-wrap">
                  <table className="fpa-table fpa-ops-model-mini-table">
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="fpa-ops-model-label-cell"><RowLabel primary={row.label} secondary={`Row ${row.rowNumber}`} /></td>
                          <td className="fpa-ops-model-value-cell">{formatOpsModelValue(row.value, group.format)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        badge="Workbook Rows 26-48"
        title="Grade pyramids by tilt"
        note="Senior, Standard, and Junior tilts each carry a full grade pyramid across Onshore, Nearshore, and Offshore. The portal keeps the same editable matrix and totals."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">54 editable cells</span>
          </div>
        }
      >
        <div className="fpa-ops-model-tilt-grid">
          {previewWorkbookView.tiltTables.map((tilt) => (
            <article key={tilt.id} className="fpa-ops-model-tilt-card">
              <div className="step-header fpa-ops-model-tilt-header">
                <div>
                  <span className="step-badge">Rows {tilt.startRow}-{tilt.totalRow}</span>
                  <h5>{tilt.label}</h5>
                </div>
              </div>
              <div className="fpa-table-wrap fpa-ops-model-table-wrap">
                <table className="fpa-table fpa-ops-model-mini-table">
                  <thead>
                    <tr>
                      <th>Grade</th>
                      <th>Onshore</th>
                      <th>Nearshore</th>
                      <th>Offshore</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tilt.rows.map((row) => (
                      <tr key={`${tilt.id}-${row.gradeId}`}>
                        <td className="fpa-ops-model-label-cell"><RowLabel primary={row.label} secondary={`Row ${row.rowNumber}`} /></td>
                        {Object.entries(row.values).map(([layerId, cell]) => (
                          <td key={cell.address} className="fpa-ops-model-value-cell">
                            <OpsInputCell
                              kind="percent"
                              address={cell.address}
                              label={`${tilt.label} ${row.label} ${layerId}`}
                              value={readDraftValue(draftInputs, cell.address, formatOpsModelInputValue("percent", cell.value))}
                              canEditP2p={canEditP2p}
                              isBusy={isBusy}
                              onChange={(nextValue) => handleDraftChange(cell.address, nextValue)}
                              onCommit={(nextValue) => handleDraftCommit("percent", cell.address, nextValue)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="fpa-ops-model-label-cell"><RowLabel primary="Mix Check" secondary={`Workbook row ${tilt.totalRow}`} /></td>
                      <td className="fpa-ops-model-value-cell is-emphasis">{formatOpsModelValue(tilt.totals.onshore, "percent1")}</td>
                      <td className="fpa-ops-model-value-cell is-emphasis">{formatOpsModelValue(tilt.totals.nearshore, "percent1")}</td>
                      <td className="fpa-ops-model-value-cell is-emphasis">{formatOpsModelValue(tilt.totals.offshore, "percent1")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="fpa-ops-model-split-grid">
        <SectionCard
          badge="Workbook Rows 50-53"
          title="Blended loaded cost by tilt"
          note="Each tilt converts the grade pyramids into one blended loaded cost per layer."
        >
          <div className="fpa-table-wrap fpa-ops-model-table-wrap">
            <table className="fpa-table fpa-ops-model-table">
              <thead>
                <tr>
                  <th>Tilt</th>
                  <th>Onshore</th>
                  <th>Nearshore</th>
                  <th>Offshore</th>
                </tr>
              </thead>
              <tbody>
                {previewWorkbookView.blendedCostByTiltRows.map((row) => (
                  <tr key={row.id}>
                    <td className="fpa-ops-model-label-cell"><RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} /></td>
                    <td className="fpa-ops-model-value-cell">{formatOpsModelValue(row.values.onshore, "whole")}</td>
                    <td className="fpa-ops-model-value-cell">{formatOpsModelValue(row.values.nearshore, "whole")}</td>
                    <td className="fpa-ops-model-value-cell">{formatOpsModelValue(row.values.offshore, "whole")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          badge="Workbook Rows 55-59"
          title="Persona to tilt map and layer costs"
          note="Each persona selects one pyramid tilt. The layer cost rows below use the same INDEX/MATCH lookup pattern as the workbook."
          meta={
            <div className="fpa-tab-meta">
              <span className="section-chip">5 editable cells</span>
            </div>
          }
        >
          <div className="fpa-table-wrap fpa-ops-model-table-wrap">
            <table className="fpa-table fpa-ops-model-table">
              <thead>
                <tr>
                  <th>Row</th>
                  {previewWorkbookView.personas.map((persona) => (
                    <th key={persona.id}>{persona.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="fpa-ops-model-label-cell"><RowLabel primary="Pyramid tilt" secondary="Workbook row 56" /></td>
                  {previewWorkbookView.personas.map((persona) => {
                    const cell = previewWorkbookView.personaTiltRow.values[persona.id];
                    return (
                      <td key={`tilt-${persona.id}`} className="fpa-ops-model-value-cell">
                        <OpsInputCell
                          kind="tilt"
                          address={cell.address}
                          label={`${persona.label} pyramid tilt`}
                          value={readDraftValue(draftInputs, cell.address, cell.value)}
                          canEditP2p={canEditP2p}
                          isBusy={isBusy}
                          onChange={() => {}}
                          onCommit={(nextValue) => handleDraftCommit("tilt", cell.address, nextValue)}
                        />
                      </td>
                    );
                  })}
                </tr>
                {previewWorkbookView.personaLayerCostRows.map((row) => (
                  <tr key={row.id}>
                    <td className="fpa-ops-model-label-cell"><RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} /></td>
                    {previewWorkbookView.personas.map((persona) => (
                      <td key={`${row.id}-${persona.id}`} className="fpa-ops-model-value-cell">{formatOpsModelValue(row.values[persona.id], "whole")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        badge="Workbook Rows 75-82"
        title="Persona blended factors"
        note="These are the mix-weighted outputs that roll the selected layer factors back to each persona. Row 82 remains an explicit Yes/No workbook control."
        meta={
          <div className="fpa-tab-meta">
            <StatusPill tone={previewWorkbookView.languageCoverage.value === "Yes" ? "success" : "warning"}>Language Coverage {previewWorkbookView.languageCoverage.value}</StatusPill>
          </div>
        }
      >
        <div className="fpa-ops-model-summary-stack">
          <div className="fpa-table-wrap fpa-ops-model-table-wrap">
            <table className="fpa-table fpa-ops-model-table">
              <thead>
                <tr>
                  <th>Output</th>
                  {previewWorkbookView.personas.map((persona) => (
                    <th key={persona.id}>{persona.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewWorkbookView.personaFactorRows.map((row) => (
                  <tr key={row.id}>
                    <td className="fpa-ops-model-label-cell"><RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} /></td>
                    {previewWorkbookView.personas.map((persona) => (
                      <td key={`${row.id}-${persona.id}`} className="fpa-ops-model-value-cell">{formatOpsModelValue(row.values[persona.id], row.format)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <article className="fpa-ops-model-language-card">
            <div>
              <span className="step-badge">Workbook Row 82</span>
              <h5>Near/onshore language coverage confirmed?</h5>
              <p className="section-note">Keep this aligned with the delivery story before moving into Rate Card and FTE Engine.</p>
            </div>
            <OpsInputCell
              kind="yesNo"
              address={previewWorkbookView.languageCoverage.address}
              label="Near/onshore language coverage confirmed"
              value={readDraftValue(draftInputs, previewWorkbookView.languageCoverage.address, previewWorkbookView.languageCoverage.value)}
              canEditP2p={canEditP2p}
              isBusy={isBusy}
              onChange={() => {}}
              onCommit={(nextValue) => handleDraftCommit("yesNo", previewWorkbookView.languageCoverage.address, nextValue)}
            />
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
