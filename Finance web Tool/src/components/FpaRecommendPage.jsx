import { useEffect, useMemo, useState } from "react";

import {
  buildFpaRecommendWorkbookView,
  formatRecommendInputValue,
  formatRecommendValue,
  FPA_RECOMMEND_SNAPSHOT,
  normalizeRecommendInputValue,
} from "../config/fpaRecommend";

const EMPTY_INPUTS = Object.freeze({});
const SHEET_NAME = FPA_RECOMMEND_SNAPSHOT.sheetName;

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

function RowLabel({ primary, secondary = "" }) {
  return (
    <div className="fpa-cost-row-label">
      <strong>{primary}</strong>
      {secondary ? <span>{secondary}</span> : null}
    </div>
  );
}

function getWeightStatusTone(value) {
  return String(value || "").trim() === "Weights OK" ? "success" : "danger";
}

function buildDraftInputs(workbookView) {
  return Object.fromEntries(
    (workbookView.criterionRows || []).map((row) => [
      row.weightAddress,
      formatRecommendInputValue("weight", row.weightValue),
    ]),
  );
}

function WeightInput({
  value,
  canEditFpa,
  isBusy,
  onChange,
  onCommit,
}) {
  if (!canEditFpa) {
    return <strong>{value ? `${value}%` : "-"}</strong>;
  }

  return (
    <div className="fpa-recommend-weight-input-wrap">
      <input
        className="fpa-recommend-weight-input"
        type="text"
        inputMode="decimal"
        value={value}
        disabled={isBusy}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onCommit(value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(value);
            event.currentTarget.blur();
          }
        }}
      />
      <span>%</span>
    </div>
  );
}

export default function FpaRecommendPage({
  currentDeal,
  canEditFpa,
  isBusy,
  onUpdateCell,
}) {
  const recommendInputs = currentDeal?.fpaWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.fpaWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.fpaWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;

  const workbookView = useMemo(
    () => buildFpaRecommendWorkbookView({ currentDeal }),
    [currentDeal],
  );

  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(workbookView));

  useEffect(() => {
    setDraftInputs(buildDraftInputs(workbookView));
  }, [currentDeal?.dealId, recommendInputs, workbookView.weightTotal]);

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(row, nextValue) {
    const normalizedValue = normalizeRecommendInputValue("weight", nextValue);

    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [row.weightAddress]: formatRecommendInputValue("weight", row.weightValue),
      }));
      return;
    }

    setDraftInputs((previous) => ({
      ...previous,
      [row.weightAddress]: normalizedValue === "" ? "" : formatRecommendInputValue("weight", normalizedValue),
    }));

    if (typeof onUpdateCell === "function") {
      onUpdateCell(SHEET_NAME, row.weightAddress, normalizedValue);
    }
  }

  return (
    <div className="fpa-form-stack fpa-cost-layout">
      <section className="compact-card fpa-subpanel fpa-cost-hero">
        <div className="step-header">
          <div>
            <span className="step-badge">Workbook Recommend</span>
            <h4>{FPA_RECOMMEND_SNAPSHOT.title}</h4>
            <p className="section-note">{FPA_RECOMMEND_SNAPSHOT.note}</p>
          </div>
          <div className="fpa-tab-meta">
            <StatusPill tone="success">Instant calc</StatusPill>
            <StatusPill tone="info">Recommended {workbookView.recommendedPersona?.label || "-"}</StatusPill>
            <StatusPill tone={getWeightStatusTone(workbookView.weightStatus)}>{workbookView.weightStatus}</StatusPill>
            <span className="section-chip">{FPA_RECOMMEND_SNAPSHOT.formulaCount} formulas</span>
            <span className="section-chip">{FPA_RECOMMEND_SNAPSHOT.editableCellCount} editable weights</span>
          </div>
        </div>

        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Recommended Persona"
            value={workbookView.recommendedPersona?.label || "-"}
            note="Workbook row 27"
          />
          <MetricCard
            label="Runner-up"
            value={workbookView.runnerUpPersona?.label || "-"}
            note="Workbook row 28"
          />
          <MetricCard
            label="Persona Index"
            value={formatRecommendValue(workbookView.recommendedPersonaIndex, "whole")}
            note="Workbook row 29"
          />
          <MetricCard
            label="Adjusted Score"
            value={formatRecommendValue(workbookView.recommendedPersona?.adjustedScore || 0, "score1")}
            note="Workbook row 24"
          />
          <MetricCard
            label="RED Validations"
            value={formatRecommendValue(workbookView.recommendedPersona?.redValidations || 0, "whole")}
            note="Workbook row 23"
          />
          <MetricCard
            label="Discovery Coverage"
            value={formatRecommendValue(workbookView.context.discoveryCoverageShare, "percent1")}
            note="Workbook row 8"
          />
        </div>
      </section>

      <SectionCard
        badge="Workbook Rows 6-11"
        title="Deal context"
        note="These six workbook signals feed the persona-fit scoring engine for the recommendation."
      >
        <div className="fpa-cost-kpi-grid fpa-deal-risk-context-grid">
          {workbookView.contextRows.map((row) => (
            <MetricCard
              key={`recommend-context-${row.key}`}
              label={row.label}
              value={formatRecommendValue(row.value, row.format)}
              note={`Workbook row ${row.rowNumber}`}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 16-25"
        title="Persona fit scoring matrix"
        note="The portal mirrors the workbook logic: criterion scores by persona, editable weights, then weighted fit, RED disqualification, adjusted score, and rank."
        meta={
          <div className="fpa-tab-meta">
            <span className="section-chip">Weights total {workbookView.weightTotalText}</span>
            <StatusPill tone={getWeightStatusTone(workbookView.weightStatus)}>{workbookView.weightStatus}</StatusPill>
          </div>
        }
      >
        <div className="fpa-table-wrap fpa-cost-table-wrap">
          <table className="fpa-table fpa-cost-table fpa-recommend-table">
            <thead>
              <tr>
                <th>Criterion</th>
                {workbookView.personaHeaders.map((persona) => (
                  <th
                    key={`recommend-head-${persona.key}`}
                    className={persona.key === workbookView.recommendedPersona?.key ? "is-selected" : ""}
                  >
                    <span>{persona.label}</span>
                    {persona.key === workbookView.recommendedPersona?.key ? (
                      <small className="fpa-recommend-column-note">Selected</small>
                    ) : null}
                  </th>
                ))}
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {workbookView.criterionRows.map((row) => (
                <tr key={`recommend-criterion-${row.key}`}>
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.scores.map((cell) => (
                    <td
                      key={`recommend-score-${row.key}-${cell.key}`}
                      className={[
                        "fpa-cost-value-cell",
                        "fpa-recommend-score-cell",
                        cell.key === workbookView.recommendedPersona?.key ? "is-selected" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {cell.text}
                    </td>
                  ))}
                  <td className="fpa-recommend-weight-cell">
                    <WeightInput
                      value={draftInputs[row.weightAddress] ?? formatRecommendInputValue("weight", row.weightValue)}
                      canEditFpa={canEditFpa}
                      isBusy={isBusy}
                      onChange={(value) => handleDraftChange(row.weightAddress, value)}
                      onCommit={(value) => handleDraftCommit(row, value)}
                    />
                  </td>
                </tr>
              ))}

              {workbookView.summaryRows.map((row) => (
                <tr key={`recommend-summary-${row.key}`} className="fpa-cost-total-row">
                  <td className="fpa-cost-label-cell">
                    <RowLabel primary={row.label} secondary={`Workbook row ${row.rowNumber}`} />
                  </td>
                  {row.values.map((cell) => (
                    <td
                      key={`recommend-summary-${row.key}-${cell.key}`}
                      className={[
                        "fpa-cost-value-cell",
                        "fpa-recommend-score-cell",
                        cell.key === workbookView.recommendedPersona?.key ? "is-selected" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {row.key === "rank" ? `#${cell.text}` : cell.text}
                    </td>
                  ))}
                  <td className="fpa-recommend-summary-side-cell">
                    {row.sideValue || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        badge="Workbook Rows 27-30"
        title="Recommendation summary"
        note="The recommendation is selected from the highest adjusted score after risk RED penalties are applied."
      >
        <div className="fpa-cost-kpi-grid">
          <MetricCard
            label="Recommended Persona"
            value={workbookView.recommendedPersona?.label || "-"}
            note="Workbook row 27"
          />
          <MetricCard
            label="Runner-up Fallback"
            value={workbookView.runnerUpPersona?.label || "-"}
            note="Workbook row 28"
          />
          <MetricCard
            label="Weighted Fit"
            value={formatRecommendValue(workbookView.recommendedPersona?.weightedFit || 0, "score1")}
            note="Workbook row 22"
          />
          <MetricCard
            label="Adjusted Score"
            value={formatRecommendValue(workbookView.recommendedPersona?.adjustedScore || 0, "score1")}
            note="Workbook row 24"
          />
        </div>

        <div className="fpa-deal-risk-rationale fpa-recommend-rationale">
          <span className="section-kicker">Rationale · Workbook row 30</span>
          <strong>{workbookView.recommendationRationale}</strong>
        </div>
      </SectionCard>

      <div className="review-grid">
        <SectionCard
          badge="Workbook Rows 33-36"
          title="Conditions for success"
          note="These workbook-generated conditions tell the deal team what must be true to defend the recommended persona."
        >
          <div className="fpa-recommend-list">
            {workbookView.conditionsRows.map((row) => (
              <article key={`recommend-condition-${row.key}`} className="fpa-recommend-list-item">
                <span>Workbook row {row.rowNumber}</span>
                <strong>{row.text}</strong>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          badge="Workbook Rows 39-43"
          title="Customer enablers and fallback"
          note="The enablers stay fixed from the workbook, while the fallback persona follows the second-ranked adjusted score."
        >
          <div className="fpa-recommend-list">
            {workbookView.customerEnablerRows.map((row) => (
              <article key={`recommend-enabler-${row.key}`} className="fpa-recommend-list-item">
                <span>Workbook row {row.rowNumber}</span>
                <strong>{row.text}</strong>
              </article>
            ))}
          </div>

          <div className="fpa-deal-risk-rationale fpa-recommend-rationale fpa-recommend-fallback">
            <span className="section-kicker">Fallback logic · Workbook row 43</span>
            <strong>{workbookView.fallbackLogic}</strong>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}