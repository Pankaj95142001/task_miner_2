import { useEffect, useMemo, useState } from "react";

import { buildP2pBenchmarkModel } from "../config/p2pBenchmarks";
import { deriveP2pDiscoveryMetrics } from "../config/p2pDiscovery";
import { formatOneDecimal, formatPercent, toNumber, toNumberOrNull, trimText } from "../config/p2pMath";
import { MetricCard, SectionCard, StatusPill } from "./TowerWorkspacePrimitives";

const EMPTY_INPUTS = Object.freeze({});
export const P2P_COMPLEXITY_SHEET_NAME = "P2P_06 Complexity";
const SHEET_NAME = P2P_COMPLEXITY_SHEET_NAME;

const P2P_COMPLEXITY_SNAPSHOT = Object.freeze({
  title: "06. Complexity Engine - P2P 9 dimensions, auto-scored (1-5)",
  note: "Override needs a rationale. Composite complexity shapes downstream persona fit, ops posture, and transition intensity - not a second multiplier on workload hours.",
  dimensionCount: 9,
  editableCellCount: 18,
  formulaCount: 0,
});

function roundScore(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function thresholdScore(value, thresholds, fallback = 5) {
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

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreSupplierInvoices(value) {
  return thresholdScore(value, [[250, 1], [600, 2], [1400, 3], [3000, 4]], 5);
}

function scoreExceptionRate(value) {
  return thresholdScore(value, [[0.05, 1], [0.1, 2], [0.2, 3], [0.3, 4]], 5);
}

function scorePoComplianceInverse(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 4;
  }
  if (numeric >= 0.8) {
    return 1;
  }
  if (numeric >= 0.65) {
    return 2;
  }
  if (numeric >= 0.5) {
    return 3;
  }
  if (numeric >= 0.35) {
    return 4;
  }
  return 5;
}

function scoreLegalEntities(value) {
  return thresholdScore(value, [[5, 1], [10, 2], [20, 3], [35, 4]], 5);
}

function scoreBusinessUnits(value) {
  return thresholdScore(value, [[4, 1], [8, 2], [15, 3], [25, 4]], 5);
}

function scoreCountries(value) {
  return thresholdScore(value, [[5, 1], [10, 2], [20, 3], [35, 4]], 5);
}

function scoreP2pPlatform(value) {
  switch (trimText(value)) {
    case "ERP AP module only (manual)":
      return 5;
    case "Other / mixed":
      return 4;
    case "SAP S/4 MM/AP + partial workflow":
    case "Tungsten / Kofax (IDP) + ERP":
      return 3;
    case "Oracle Fusion Procurement":
    case "Basware":
      return 2;
    case "SAP Ariba":
    case "Coupa":
      return 1;
    default:
      return 4;
  }
}

function scoreDataSources(value) {
  return thresholdScore(value, [[3, 1], [6, 2], [10, 3], [15, 4]], 5);
}

function scoreAiMaturity(value) {
  switch (trimText(value)) {
    case "None":
      return 5;
    case "Exploring":
      return 4;
    case "Piloting":
      return 2;
    case "Scaled":
      return 1;
    default:
      return 4;
  }
}

function scoreProcessMaturity(value) {
  switch (trimText(value)) {
    case "Basic":
      return 5;
    case "Developing":
      return 4;
    case "Established":
      return 2;
    case "Leading":
      return 1;
    default:
      return 4;
  }
}

function scorePaymentRuns(value) {
  return thresholdScore(value, [[4, 1], [8, 2], [15, 3], [25, 4]], 5);
}

function scoreAutomationMaturity(value) {
  switch (trimText(value)) {
    case "Low (<20%)":
      return 4;
    case "Medium (20-40%)":
      return 3;
    case "High (40-60%)":
      return 2;
    case "Very High (>60%)":
      return 1;
    default:
      return 4;
  }
}

function scoreLanguages(value) {
  return thresholdScore(value, [[0, 1], [2, 3]], 5);
}

function scoreActiveVendors(value) {
  return thresholdScore(value, [[10, 1], [25, 2], [55, 3], [120, 4]], 5);
}

function scoreCurrentTowerStaff(value) {
  return thresholdScore(value, [[20, 1], [50, 2], [100, 3], [200, 4]], 5);
}

const DIMENSIONS = Object.freeze([
  {
    row: 6,
    label: "Process complexity",
    weight: 0.14,
    scoringBasis: "invoices + exception rate + PO compliance",
    logicSummary: "Scores annual invoice volume, invoice exception rate, and PO-backed compliance, then averages the three.",
    computeAutoScore: ({ discovery }) => average([
      scoreSupplierInvoices(toNumber(discovery.supplierInvoices000, 0)),
      scoreExceptionRate(toNumber(discovery.invoiceExceptionRate, 0.18)),
      scorePoComplianceInverse(toNumber(discovery.poBackedSpendShare, 0.6)),
    ]),
  },
  {
    row: 7,
    label: "Organisational complexity",
    weight: 0.12,
    scoringBasis: "entities + BUs + countries",
    logicSummary: "Uses legal entities, business units, and delivery countries to score organisational spread.",
    computeAutoScore: ({ discovery }) => average([
      scoreLegalEntities(toNumber(discovery.legalEntities, 0)),
      scoreBusinessUnits(toNumber(discovery.businessUnits, 0)),
      scoreCountries(toNumber(discovery.geoCountries, 0)),
    ]),
  },
  {
    row: 8,
    label: "Data & systems complexity",
    weight: 0.14,
    scoringBasis: "P2P platform + data sources",
    logicSummary: "Blends the AP/P2P platform maturity with the number of data sources feeding the process.",
    computeAutoScore: ({ discovery }) => average([
      scoreP2pPlatform(discovery.p2pPlatform),
      scoreDataSources(toNumber(discovery.dataSourcesCount, 0)),
    ]),
  },
  {
    row: 9,
    label: "Technology & AI readiness (inv.)",
    weight: 0.1,
    scoringBasis: "platform + AI maturity",
    logicSummary: "Inverse readiness score: older platforms and lower AI maturity push the score upward.",
    computeAutoScore: ({ discovery }) => average([
      scoreP2pPlatform(discovery.p2pPlatform),
      scoreAiMaturity(discovery.aiMaturity),
    ]),
  },
  {
    row: 10,
    label: "Governance & process maturity (inv.)",
    weight: 0.12,
    scoringBasis: "maturity + payment cadence",
    logicSummary: "Inverse score using stated P2P maturity and the operational intensity of payment runs per month.",
    computeAutoScore: ({ discovery }) => average([
      scoreProcessMaturity(discovery.processMaturity),
      scorePaymentRuns(toNumber(discovery.paymentRunsPerMonth, 0)),
    ]),
  },
  {
    row: 11,
    label: "Automation maturity (inv.)",
    weight: 0.1,
    scoringBasis: "current automation level",
    logicSummary: "Inverse score where higher existing automation reduces complexity.",
    computeAutoScore: ({ discovery }) => scoreAutomationMaturity(discovery.automationMaturity),
  },
  {
    row: 12,
    label: "Geographic & language",
    weight: 0.08,
    scoringBasis: "countries + languages",
    logicSummary: "Scores the service footprint using countries supported and non-English language breadth.",
    computeAutoScore: ({ discovery }) => average([
      scoreCountries(toNumber(discovery.geoCountries, 0)),
      scoreLanguages(toNumber(discovery.languagesBeyondEnglish, 0)),
    ]),
  },
  {
    row: 13,
    label: "Regulatory & fraud-control intensity",
    weight: 0.1,
    scoringBasis: "industry reg load + active vendors",
    logicSummary: "Uses benchmark regulatory load and supplier-base intensity as a proxy for control complexity.",
    computeAutoScore: ({ discovery, benchmarkModel }) => average([
      benchmarkModel.regulatoryLoad,
      scoreActiveVendors(toNumber(discovery.activeVendors000, 0)),
    ]),
  },
  {
    row: 14,
    label: "Stakeholder & supplier intensity",
    weight: 0.1,
    scoringBasis: "active vendors + current staff",
    logicSummary: "Blends supplier ecosystem size with current tower staffing to reflect service and stakeholder touchpoints.",
    computeAutoScore: ({ discovery }) => average([
      scoreActiveVendors(toNumber(discovery.activeVendors000, 0)),
      scoreCurrentTowerStaff(toNumber(discovery.currentTowerStaff, 0)),
    ]),
  },
]);

function buildDraftInputs(workbookInputs) {
  const nextDraftInputs = {};

  DIMENSIONS.forEach((dimension) => {
    nextDraftInputs[`E${dimension.row}`] = trimText(workbookInputs[`E${dimension.row}`]);
    nextDraftInputs[`F${dimension.row}`] = trimText(workbookInputs[`F${dimension.row}`]);
  });

  return nextDraftInputs;
}

function normalizeCommitValue(kind, value) {
  const text = trimText(value);
  if (!text) {
    return "";
  }

  if (kind === "text") {
    return text;
  }

  const numeric = toNumberOrNull(text);
  if (numeric === null) {
    return null;
  }

  const clamped = Math.min(5, Math.max(1, numeric));
  return String(roundScore(clamped));
}

function formatInputValue(kind, value) {
  if (kind === "text") {
    return trimText(value);
  }

  const numeric = toNumberOrNull(value);
  return numeric === null ? "" : String(roundScore(numeric));
}

function bandTone(value) {
  if (value === "LOW") {
    return "success";
  }
  if (value === "MEDIUM") {
    return "info";
  }
  if (value === "HIGH") {
    return "warning";
  }
  return "danger";
}

function deriveBand(score) {
  if (score < 2) {
    return "LOW";
  }
  if (score < 3) {
    return "MEDIUM";
  }
  if (score < 4) {
    return "HIGH";
  }
  return "VERY HIGH";
}

export function buildP2pComplexityView(workbookInputs = EMPTY_INPUTS, workspace = {}) {
  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const benchmarkModel = buildP2pBenchmarkModel(discoveryMetrics.effectiveDiscovery, workspace.benchmarks || {});

  const rows = DIMENSIONS.map((dimension) => {
    const autoScore = roundScore(dimension.computeAutoScore({
      discovery: discoveryMetrics.effectiveDiscovery,
      benchmarkModel,
    }));
    const overrideRaw = trimText(workbookInputs[`E${dimension.row}`]);
    const rationaleRaw = trimText(workbookInputs[`F${dimension.row}`]);
    const overrideValue = toNumberOrNull(overrideRaw);
    const overrideApplied = overrideValue !== null;
    const finalScore = roundScore(overrideApplied ? overrideValue : autoScore);
    const weightedScore = finalScore * dimension.weight;
    const hasMissingRationale = overrideApplied && !rationaleRaw;

    return {
      ...dimension,
      autoScore,
      finalScore,
      weightedScore,
      overrideRaw,
      overrideValue,
      overrideApplied,
      rationaleRaw,
      rationaleText: rationaleRaw,
      hasMissingRationale,
      overrideAddress: `E${dimension.row}`,
      rationaleAddress: `F${dimension.row}`,
      weightLabel: formatPercent(dimension.weight, 0),
      autoScoreLabel: formatOneDecimal(autoScore),
      overrideLabel: overrideApplied ? formatOneDecimal(overrideValue) : "",
      finalScoreLabel: formatOneDecimal(finalScore),
    };
  });

  const compositeScore = rows.reduce((sum, row) => sum + row.weightedScore, 0);
  const overrideCount = rows.filter((row) => row.overrideApplied).length;
  const missingRationaleCount = rows.filter((row) => row.hasMissingRationale).length;

  return {
    rows,
    compositeScore,
    complexityBand: deriveBand(compositeScore),
    overrideCount,
    missingRationaleCount,
    benchmarkModel,
    discoveryMetrics,
  };
}

export default function P2pComplexityPage({ currentDeal, canEditP2p, isBusy, onUpdateCell }) {
  const workbookInputs = currentDeal?.p2pWorkbookInputs?.[SHEET_NAME] && typeof currentDeal.p2pWorkbookInputs[SHEET_NAME] === "object"
    ? currentDeal.p2pWorkbookInputs[SHEET_NAME]
    : EMPTY_INPUTS;

  const workspace = currentDeal?.p2pWorkspace || {};
  const [draftInputs, setDraftInputs] = useState(() => buildDraftInputs(workbookInputs));

  useEffect(() => {
    setDraftInputs(buildDraftInputs(workbookInputs));
  }, [workbookInputs]);

  const complexityView = useMemo(
    () => buildP2pComplexityView({ ...workbookInputs, ...draftInputs }, workspace),
    [draftInputs, workbookInputs, workspace],
  );
  const previewRows = complexityView.rows;
  const compositeScore = complexityView.compositeScore;
  const complexityBand = complexityView.complexityBand;
  const overrideCount = complexityView.overrideCount;
  const missingRationaleCount = complexityView.missingRationaleCount;
  const benchmarkModel = complexityView.benchmarkModel;

  function handleDraftChange(address, value) {
    setDraftInputs((previous) => ({
      ...previous,
      [address]: value,
    }));
  }

  function handleDraftCommit(kind, address, value) {
    const normalizedValue = normalizeCommitValue(kind, value);
    if (normalizedValue === null) {
      setDraftInputs((previous) => ({
        ...previous,
        [address]: formatInputValue(kind, workbookInputs[address]),
      }));
      return;
    }

    setDraftInputs((previous) => ({
      ...previous,
      [address]: formatInputValue(kind, normalizedValue),
    }));
    onUpdateCell(SHEET_NAME, address, normalizedValue);
  }

  return (
    <div className="fpa-form-stack">
      <SectionCard
        badge="Workbook Complexity"
        title={P2P_COMPLEXITY_SNAPSHOT.title}
        note={P2P_COMPLEXITY_SNAPSHOT.note}
        meta={(
          <div className="fpa-tab-meta">
            <StatusPill tone={bandTone(complexityBand)}>{complexityBand}</StatusPill>
            <span className="section-chip">{P2P_COMPLEXITY_SNAPSHOT.dimensionCount} dimensions</span>
            <span className="section-chip">{P2P_COMPLEXITY_SNAPSHOT.editableCellCount} editable cells</span>
          </div>
        )}
      >
        <div className="fpa-kpi-grid">
          <MetricCard label="Composite Score" value={formatOneDecimal(compositeScore)} note="Weighted average across 9 dimensions" />
          <MetricCard label="Complexity Band" value={complexityBand} note="Workbook-style banding" />
          <MetricCard label="Overrides" value={String(overrideCount)} note="Manual score overrides typed" />
          <MetricCard label="Missing Rationale" value={String(missingRationaleCount)} note="Overrides requiring explanation" />
          <MetricCard label="AI Ceiling" value={formatPercent(benchmarkModel.aiBenefitCeiling, 0)} note="From benchmarks + AI maturity" />
        </div>
      </SectionCard>

      <SectionCard
        badge="Dimension Table"
        title="Auto-score and override matrix"
        note="Auto-scores are driven by P2P Discovery and Benchmarks. You can override any dimension, but every override should carry a rationale."
      >
        <div className="fpa-table-wrap">
          <table className="fpa-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Dimension</th>
                <th>Scoring Basis</th>
                <th className="is-number">Weight</th>
                <th className="is-number">Auto</th>
                <th className="is-number">Override</th>
                <th className="is-number">Final</th>
                <th className="is-number">Weighted</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.row}>
                  <td>{row.row}</td>
                  <td>
                    <div className="fpa-rate-card-row-label">
                      <strong>{row.label}</strong>
                      <span>{row.logicSummary}</span>
                    </div>
                  </td>
                  <td>{row.scoringBasis}</td>
                  <td className="is-number">{formatPercent(row.weight, 0)}</td>
                  <td className="is-number">{formatOneDecimal(row.autoScore)}</td>
                  <td className="is-number">
                    <input
                      type="text"
                      className="fpa-rate-card-input is-numeric"
                      value={draftInputs[`E${row.row}`] ?? ""}
                      disabled={!canEditP2p || isBusy}
                      onChange={(event) => handleDraftChange(`E${row.row}`, event.target.value)}
                      onBlur={(event) => handleDraftCommit("number", `E${row.row}`, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </td>
                  <td className="is-number">{formatOneDecimal(row.finalScore)}</td>
                  <td className="is-number">{formatOneDecimal(row.weightedScore)}</td>
                  <td>
                    <input
                      type="text"
                      className="fpa-workload-note-input"
                      value={draftInputs[`F${row.row}`] ?? ""}
                      disabled={!canEditP2p || isBusy}
                      onChange={(event) => handleDraftChange(`F${row.row}`, event.target.value)}
                      onBlur={(event) => handleDraftCommit("text", `F${row.row}`, event.target.value)}
                    />
                    {row.hasMissingRationale ? (
                      <div className="overview-pills" style={{ marginTop: "0.35rem" }}>
                        <StatusPill tone="warning">Rationale required</StatusPill>
                      </div>
                    ) : null}
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