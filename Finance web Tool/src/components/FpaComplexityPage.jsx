import { useEffect, useMemo, useState } from "react";

import { buildFpaBenchmarkWorkbookView } from "../config/fpaBenchmarks";
import { deriveFpaDiscoveryMetrics } from "../config/fpaDiscovery";

const EMPTY_INPUTS = Object.freeze({});
const BENCHMARK_SHEET_NAME = "FPA_04 Benchmarks";
const SHEET_NAME = "FPA_06 Complexity";
const OVERVIEW = {
  title: "06. Complexity Engine — FP&A 9 dimensions, auto-scored (1-5)",
  note: "Override needs a rationale (else R19 RED). Composite drives persona fit, buffers guidance & transition duration — never a second multiplier on hours.",
};
const REGULATORY_LOAD_FALLBACK = {
  "BFSI": 4,
  "CPG & Retail": 3,
  "Technology & SaaS": 2,
  Manufacturing: 3,
  "Healthcare & Pharma": 5,
  "Energy & Utilities": 4,
  "Telecom & Media": 3,
  "Professional Services": 2,
};

function StatusPill({ tone = "neutral", children }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, note }) {
  const isPrimitive = typeof value === "string" || typeof value === "number";

  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      {isPrimitive ? <strong>{value}</strong> : <div className="metric-card-value">{value}</div>}
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

function trimValue(value) {
  return String(value ?? "").trim();
}

function trimTrailingZeros(text) {
  const normalized = String(text ?? "");
  if (!normalized.includes(".")) {
    return normalized;
  }

  return normalized.replace(/0+$/u, "").replace(/\.$/u, "");
}

function toNumberOrNull(value) {
  const normalized = trimValue(value).replace(/,/g, "");
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function thresholdScore(value, thresholds, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  for (const [limit, score] of thresholds) {
    if (numeric <= limit) {
      return score;
    }
  }

  return fallback;
}

function scoreMonthlyCloseComplexity(value) {
  if (value === "Simple (<=5 days)") {
    return 1;
  }
  if (value === "Standard (6-8 days)") {
    return 2;
  }
  if (value === "Complex (9-12 days)") {
    return 4;
  }
  return 5;
}

function scoreForecastCadence(value) {
  if (value === "Continuous (12-month rolling)") {
    return 5;
  }
  if (value === "Monthly Rolling") {
    return 4;
  }
  if (value === "Quarterly") {
    return 2;
  }
  return 1;
}

function scoreReportPackVolume(value) {
  return thresholdScore(value, [[20, 1], [40, 2], [80, 3], [150, 4]], 5);
}

function scoreLegalEntities(value) {
  return thresholdScore(value, [[5, 1], [10, 2], [20, 3], [35, 4]], 5);
}

function scoreBusinessUnits(value) {
  return thresholdScore(value, [[4, 1], [8, 2], [15, 3], [25, 4]], 5);
}

function scoreGeoCountries(value) {
  return thresholdScore(value, [[5, 1], [10, 2], [20, 3], [35, 4]], 5);
}

function scoreEpmPlatform(value) {
  if (value === "Excel-only / legacy") {
    return 5;
  }
  if (value === "Hyperion (on-prem)") {
    return 4;
  }
  if (["SAP (BPC/SAC)", "IBM Planning Analytics", "Board / Jedox / Other"].includes(value)) {
    return 3;
  }
  return 2;
}

function scoreDataSources(value) {
  return thresholdScore(value, [[3, 1], [6, 2], [10, 3], [15, 4]], 5);
}

function scoreAiMaturity(value) {
  if (value === "None") {
    return 5;
  }
  if (value === "Exploring") {
    return 4;
  }
  if (value === "Piloting") {
    return 2;
  }
  return 1;
}

function scoreProcessMaturity(value) {
  if (value === "Basic") {
    return 5;
  }
  if (value === "Developing") {
    return 4;
  }
  if (value === "Established") {
    return 2;
  }
  return 1;
}

function scoreIterationLoad(iterations, versions) {
  return thresholdScore(Number(iterations) + Number(versions), [[3, 1], [5, 2], [7, 3], [9, 4]], 5);
}

function scoreAutomationMaturity(value) {
  if (value === "None") {
    return 5;
  }
  if (value === "Low (<20%)") {
    return 4;
  }
  if (value === "Medium (20-40%)" || value === "Medium (20-50%)") {
    return 2;
  }
  return 1;
}

function scoreLanguages(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return 1;
  }
  if (numeric <= 2) {
    return 3;
  }
  return 5;
}

function scoreCurrentTowerStaff(value) {
  return thresholdScore(value, [[20, 1], [50, 2], [100, 3], [200, 4]], 5);
}

function formatWeight(value) {
  return `${Math.round(value * 100)}%`;
}

function formatScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "—";
}

function toBenchmarkCellMap(rows = []) {
  const cellMap = {};

  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      cellMap[cell.address] = cell;
    });
  });

  return cellMap;
}

function lookupRegulatoryLoad(benchmarkInputs, effectiveDiscovery) {
  const benchmarkView = buildFpaBenchmarkWorkbookView(benchmarkInputs, effectiveDiscovery);
  const cellMap = toBenchmarkCellMap(benchmarkView.rows);
  const industry = trimValue(effectiveDiscovery.industryVertical);

  for (let row = 6; row <= 13; row += 1) {
    const label = trimValue(cellMap[`B${row}`]?.text || cellMap[`B${row}`]?.raw);
    if (label === industry) {
      const numeric = toNumberOrNull(cellMap[`F${row}`]?.raw ?? cellMap[`F${row}`]?.text);
      if (numeric !== null) {
        return numeric;
      }
      break;
    }
  }

  return REGULATORY_LOAD_FALLBACK[industry] || REGULATORY_LOAD_FALLBACK.Manufacturing;
}
const DIMENSIONS = [
  {
    row: 6,
    label: "Process complexity",
    weight: 0.14,
    scoringBasis: "close + cadence + pack volume",
    logicSummary: "Close: Simple=1, Standard=2, Complex=4, else 5. Cadence: Continuous=5, Monthly Rolling=4, Quarterly=2, else 1. Packs/month: <=20/40/80/150 => 1/2/3/4, else 5. Average of the three.",
    computeAutoScore: ({ discovery }) => average([
      scoreMonthlyCloseComplexity(discovery.monthlyCloseComplexity),
      scoreForecastCadence(discovery.forecastCadence),
      scoreReportPackVolume(discovery.reportPacksPerMonth),
    ]),
  },
  {
    row: 7,
    label: "Organisational complexity",
    weight: 0.12,
    scoringBasis: "entities + BUs + countries",
    logicSummary: "Legal entities: <=5/10/20/35 => 1/2/3/4, else 5. Business units: <=4/8/15/25 => 1/2/3/4, else 5. Countries: <=5/10/20/35 => 1/2/3/4, else 5. Average of the three.",
    computeAutoScore: ({ discovery }) => average([
      scoreLegalEntities(discovery.legalEntities),
      scoreBusinessUnits(discovery.businessUnits),
      scoreGeoCountries(discovery.geoCountries),
    ]),
  },
  {
    row: 8,
    label: "Data & systems complexity",
    weight: 0.14,
    scoringBasis: "EPM stack + data sources",
    logicSummary: "EPM: Excel-only=5, Hyperion=4, SAP/IBM/Board-Jedox=3, all others=2. Data sources: <=3/6/10/15 => 1/2/3/4, else 5. Average of the two.",
    computeAutoScore: ({ discovery }) => average([
      scoreEpmPlatform(discovery.epmPlatform),
      scoreDataSources(discovery.dataSourcesCount),
    ]),
  },
  {
    row: 9,
    label: "Technology & AI readiness (inv.)",
    weight: 0.10,
    scoringBasis: "EPM + AI maturity",
    logicSummary: "EPM scoring is identical to row 8. AI maturity: None=5, Exploring=4, Piloting=2, else 1. Average of the two.",
    computeAutoScore: ({ discovery }) => average([
      scoreEpmPlatform(discovery.epmPlatform),
      scoreAiMaturity(discovery.aiMaturity),
    ]),
  },
  {
    row: 10,
    label: "Governance & planning maturity (inv.)",
    weight: 0.12,
    scoringBasis: "maturity + iterations/versions",
    logicSummary: "Planning maturity: Basic=5, Developing=4, Established=2, else 1. Iterations + versions: <=3/5/7/9 => 1/2/3/4, else 5. Average of the two.",
    computeAutoScore: ({ discovery }) => average([
      scoreProcessMaturity(discovery.processMaturity),
      scoreIterationLoad(discovery.planningIterationsPerBudget, discovery.forecastVersionsMaintained),
    ]),
  },
  {
    row: 11,
    label: "Automation maturity (inv.)",
    weight: 0.10,
    scoringBasis: "current automation level",
    logicSummary: "None=5, Low (<20%)=4, Medium (20-40%)=2, else 1. Portal Medium (20-50%) is mapped to the same workbook score of 2.",
    computeAutoScore: ({ discovery }) => scoreAutomationMaturity(discovery.automationMaturity),
  },
  {
    row: 12,
    label: "Geographic & language",
    weight: 0.08,
    scoringBasis: "countries + languages",
    logicSummary: "Countries: <=5/10/20/35 => 1/2/3/4, else 5. Languages beyond English: 0=1, <=2=3, else 5. Average of the two.",
    computeAutoScore: ({ discovery }) => average([
      scoreGeoCountries(discovery.geoCountries),
      scoreLanguages(discovery.languagesBeyondEnglish),
    ]),
  },
  {
    row: 13,
    label: "Regulatory intensity",
    weight: 0.10,
    scoringBasis: "industry reg load + statutory surface",
    logicSummary: "Industry regulatory load is looked up from Benchmarks section A. Legal entities: <=5/10/20/35 => 1/2/3/4, else 5. Average of the two.",
    computeAutoScore: ({ discovery, regulatoryLoad }) => average([
      regulatoryLoad,
      scoreLegalEntities(discovery.legalEntities),
    ]),
  },
  {
    row: 14,
    label: "Stakeholder & service delivery",
    weight: 0.10,
    scoringBasis: "BU interfaces + counterpart planners",
    logicSummary: "Business units: <=4/8/15/25 => 1/2/3/4, else 5. Current tower staff: <=20/50/100/200 => 1/2/3/4, else 5. Average of the two.",
    computeAutoScore: ({ discovery }) => average([
      scoreBusinessUnits(discovery.businessUnits),
      scoreCurrentTowerStaff(discovery.currentTowerStaff),
    ]),
  },
];

function readDraftValue(draftInputs, address, fallback = "") {
  return Object.prototype.hasOwnProperty.call(draftInputs, address)
    ? String(draftInputs[address] ?? "")
    : fallback;
}

function bandTone(value) {
  const normalized = trimValue(value).toUpperCase();

  if (normalized === "LOW") {
    return "success";
  }
  if (normalized === "MEDIUM") {
    return "info";
  }
  if (normalized === "HIGH") {
    return "warning";
  }
  if (normalized === "VERY HIGH") {
    return "danger";
  }
  return "neutral";
}

function statusTone(value) {
  return trimValue(value) === "Weights OK" ? "success" : "danger";
}

export function buildComplexityView(workbookInputs, benchmarkInputs, effectiveDiscovery) {
  const regulatoryLoad = lookupRegulatoryLoad(benchmarkInputs, effectiveDiscovery);

  const rows = DIMENSIONS.map((dimension) => {
    const overrideAddress = `E${dimension.row}`;
    const rationaleAddress = `F${dimension.row}`;
    const overrideRaw = readDraftValue(workbookInputs, overrideAddress, "");
    const rationaleRaw = readDraftValue(workbookInputs, rationaleAddress, "");
    const overrideValue = toNumberOrNull(overrideRaw);
    const rationaleText = trimValue(rationaleRaw);
    const autoScore = dimension.computeAutoScore({ discovery: effectiveDiscovery, regulatoryLoad });
    const finalScore = overrideValue === null ? autoScore : overrideValue;
    const weightedScore = dimension.weight * finalScore;
    const overrideApplied = overrideValue !== null;
    const hasMissingRationale = overrideApplied && !rationaleText;

    return {
      ...dimension,
      overrideAddress,
      rationaleAddress,
      overrideRaw,
      overrideApplied,
      rationaleRaw,
      rationaleText,
      hasMissingRationale,
      autoScore,
      finalScore,
      weightedScore,
      weightLabel: formatWeight(dimension.weight),
      autoScoreLabel: formatScore(autoScore),
      overrideLabel: overrideApplied ? trimTrailingZeros(overrideRaw) : "",
      finalScoreLabel: formatScore(finalScore),
      weightedScoreLabel: formatScore(weightedScore),
    };
  });

  const weightTotal = rows.reduce((sum, row) => sum + row.weight, 0);
  const compositeScore = rows.reduce((sum, row) => sum + row.weightedScore, 0);
  const overridesWithoutRationale = rows.filter((row) => row.hasMissingRationale).length;
  const weightStatus = Math.abs(weightTotal - 1) > 0.001 ? "FIX — weights must total 100%" : "Weights OK";
  const complexityBand = compositeScore < 2 ? "LOW" : compositeScore < 3 ? "MEDIUM" : compositeScore < 4 ? "HIGH" : "VERY HIGH";

  return {
    rows,
    regulatoryLoad,
    weightTotalLabel: formatWeight(weightTotal),
    weightStatus,
    compositeScoreLabel: formatScore(compositeScore),
    complexityBand,
    overridesWithoutRationale,
  };
}

export default function FpaComplexityPage({
  currentDeal,
  fpaWorkspace,
  canEditFpa,
  isBusy,
  onUpdateCell,
}) {
  const workbookInputs = currentDeal?.fpaWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.fpaWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.fpaWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;
  const benchmarkInputs = currentDeal?.fpaWorkbookInputs?.[BENCHMARK_SHEET_NAME] && typeof currentDeal.fpaWorkbookInputs[BENCHMARK_SHEET_NAME] === "object"
    ? currentDeal.fpaWorkbookInputs[BENCHMARK_SHEET_NAME]
    : EMPTY_INPUTS;
  const [draftInputs, setDraftInputs] = useState(() => ({ ...workbookInputs }));

  useEffect(() => {
    setDraftInputs({ ...workbookInputs });
  }, [workbookInputs]);

  const discoveryMetrics = useMemo(
    () => deriveFpaDiscoveryMetrics(fpaWorkspace || {}),
    [fpaWorkspace],
  );

  const complexityView = useMemo(
    () => buildComplexityView(draftInputs, benchmarkInputs, discoveryMetrics.effectiveDiscovery),
    [benchmarkInputs, discoveryMetrics.effectiveDiscovery, draftInputs],
  );

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function commitOverride(address, value) {
    const normalized = trimValue(value).replace(/,/g, "");
    const nextValue = normalized && Number.isFinite(Number(normalized)) ? trimTrailingZeros(normalized) : "";

    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextValue,
    }));

    onUpdateCell(SHEET_NAME, address, nextValue);
  }

  function commitRationale(address, value) {
    const nextValue = trimValue(value);

    setDraftInputs((previous) => ({
      ...previous,
      [address]: nextValue,
    }));

    onUpdateCell(SHEET_NAME, address, nextValue);
  }

  return (
    <div className="fpa-form-stack fpa-complexity-layout">
      <SectionCard
        badge="Workbook Complexity"
        title={OVERVIEW.title}
        note={OVERVIEW.note}
        className="fpa-complexity-hero"
        meta={(
          <div className="fpa-tab-meta">
            <StatusPill tone="info">32 workbook formulas</StatusPill>
            <span className="section-chip">18 manual input cells</span>
            <span className="section-chip">9 scored dimensions</span>
          </div>
        )}
      >
        <div className="fpa-kpi-grid">
          <MetricCard label="Composite Score" value={complexityView.compositeScoreLabel} note="Workbook H15 = SUM(H6:H14)" />
          <MetricCard
            label="Complexity Band"
            value={<StatusPill tone={bandTone(complexityView.complexityBand)}>{complexityView.complexityBand}</StatusPill>}
            note="Workbook D17 band logic"
          />
          <MetricCard
            label="Weight Check"
            value={<StatusPill tone={statusTone(complexityView.weightStatus)}>{complexityView.weightStatus}</StatusPill>}
            note={`Workbook I15 | weights total ${complexityView.weightTotalLabel}`}
          />
          <MetricCard
            label="Overrides Without Rationale"
            value={<StatusPill tone={complexityView.overridesWithoutRationale ? "danger" : "success"}>{complexityView.overridesWithoutRationale}</StatusPill>}
            note="Workbook C19 governance rule"
          />
        </div>
      </SectionCard>

      {complexityView.overridesWithoutRationale ? (
        <section className="compact-card info-banner">
          <div>
            <p className="section-kicker">Workbook Guard</p>
            <h3>Manual overrides need rationale</h3>
            <p className="muted-copy">
              The Excel sheet flags row 19 when a manual override exists without explanation. Add the rationale in the same row before you move forward.
            </p>
          </div>
          <StatusPill tone="danger">{complexityView.overridesWithoutRationale} open</StatusPill>
        </section>
      ) : null}

      <SectionCard
        badge="Scoring Matrix"
        title="Nine weighted complexity dimensions"
        note="This table mirrors workbook rows 6-19. Auto scores come from Discovery and Benchmarks; only the override and rationale columns are editable."
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table fpa-complexity-table">
            <thead>
              <tr>
                <th>Dimension</th>
                <th className="is-number">Weight</th>
                <th className="is-number">Auto Score</th>
                <th className="is-number">Override</th>
                <th>Override Rationale (req&apos;d)</th>
                <th className="is-number">Final</th>
                <th className="is-number">Weighted</th>
                <th>Scoring Basis</th>
              </tr>
            </thead>
            <tbody>
              {complexityView.rows.map((row) => (
                <tr key={row.row} className={row.hasMissingRationale ? "is-alert" : row.overrideApplied ? "is-override" : ""}>
                  <td>
                    <div className="fpa-complexity-dimension">
                      <strong>{row.label}</strong>
                      <span className="metric-note">Workbook row {row.row}</span>
                    </div>
                  </td>
                  <td className="is-number">{row.weightLabel}</td>
                  <td className="is-number">{row.autoScoreLabel}</td>
                  <td className="is-number">
                    <input
                      aria-label={`${row.label} override score`}
                      className="fpa-complexity-input is-number"
                      type="number"
                      min="1"
                      max="5"
                      step="0.01"
                      value={readDraftValue(draftInputs, row.overrideAddress, row.overrideLabel)}
                      disabled={!canEditFpa || isBusy}
                      onChange={(event) => handleDraftChange(row.overrideAddress, event.target.value)}
                      onBlur={(event) => commitOverride(row.overrideAddress, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${row.label} override rationale`}
                      className="fpa-complexity-input"
                      type="text"
                      value={readDraftValue(draftInputs, row.rationaleAddress, row.rationaleRaw)}
                      placeholder="Explain override"
                      disabled={!canEditFpa || isBusy}
                      onChange={(event) => handleDraftChange(row.rationaleAddress, event.target.value)}
                      onBlur={(event) => commitRationale(row.rationaleAddress, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    {row.hasMissingRationale ? <span className="fpa-complexity-inline-alert">Required when an override is entered.</span> : null}
                  </td>
                  <td className="is-number"><span className={["fpa-complexity-final", row.overrideApplied ? "is-manual" : ""].filter(Boolean).join(" ")}>{row.finalScoreLabel}</span></td>
                  <td className="is-number">{row.weightedScoreLabel}</td>
                  <td>
                    <div className="fpa-complexity-basis">
                      <strong>{row.scoringBasis}</strong>
                      <span>{row.logicSummary}</span>
                    </div>
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

