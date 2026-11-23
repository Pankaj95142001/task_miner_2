import { buildP2pAiBenefitWorkbookView } from "./p2pAiBenefit";
import { buildP2pBusinessCaseWorkbookView } from "./p2pBusinessCase";
import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { buildP2pFteEngineWorkbookView } from "./p2pFteEngine";
import { buildP2pOpsModelWorkbookView } from "./p2pOpsModel";
import {
  P2P_PERSONA_LIBRARY_COLUMNS,
  P2P_PERSONA_LIBRARY_ROWS,
} from "./p2pPersonas";
import { buildP2pPricingWorkbookView } from "./p2pPricing";
import { buildP2pTransitionWorkbookView } from "./p2pTransition";
import { buildP2pWorkloadModel } from "./p2pWorkload";
import {
  createDefaultP2pWorkspace,
  normalizeP2pWorkspace,
} from "./p2pWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const PERCENT_ONE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(P2P_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

const RISK_RULE_DEFS = Object.freeze([
  { id: "R1", rowNumber: 7, label: "GM >= commercial floor", severity: "RED", basis: "13 GM% vs floor" },
  { id: "R2", rowNumber: 8, label: "GM >= persona target", severity: "AMBER", basis: "13 GM% vs 07 target" },
  { id: "R3", rowNumber: 9, label: "Utilisation 60-95%", severity: "RED", basis: "07 utilisation band" },
  { id: "R4", rowNumber: 10, label: "Shrinkage 5-20%", severity: "AMBER", basis: "07 shrinkage band" },
  { id: "R5", rowNumber: 11, label: "Mgmt buffer >= 3%", severity: "AMBER", basis: "07 buffer" },
  { id: "R6", rowNumber: 12, label: "Peak uplift 5-30%", severity: "AMBER", basis: "07 peak uplift" },
  { id: "R7", rowNumber: 13, label: "Span of control 5-15", severity: "AMBER", basis: "07 span" },
  { id: "R8", rowNumber: 14, label: "Implied automation <= effective ceiling", severity: "RED", basis: "08 implied auto vs ceiling" },
  { id: "R9", rowNumber: 15, label: "Implied AI <= maturity ceiling", severity: "RED", basis: "08 implied AI vs maturity" },
  { id: "R10", rowNumber: 16, label: "Persona fits complexity band", severity: "AMBER", basis: "06 band vs persona" },
  { id: "R11", rowNumber: 17, label: "Coverage >= 30% for aggressive personas", severity: "RED", basis: "02 coverage" },
  { id: "R12", rowNumber: 18, label: "Shore mix totals 100%", severity: "RED", basis: "09 shore mix" },
  { id: "R13", rowNumber: 19, label: "Weighted completeness >= 60%", severity: "AMBER", basis: "02 completeness" },
  { id: "R14", rowNumber: 20, label: "NPV positive over term", severity: "RED", basis: "16 NPV" },
  { id: "R15", rowNumber: 21, label: "Peak-month coverage (profile vs flex)", severity: "AMBER/RED", basis: "11 peak coverage" },
  { id: "R16", rowNumber: 22, label: "Minimum-team floors (5 total; pods)", severity: "RED", basis: "11 pods & floors" },
  { id: "R17", rowNumber: 23, label: "Out-year GM erosion (Y2+ >= floor)", severity: "RED/AMBER", basis: "16 min GM Y2+" },
  { id: "R18", rowNumber: 24, label: "Language coverage in near/onshore", severity: "AMBER", basis: "02 languages / 09 coverage" },
  { id: "R19", rowNumber: 25, label: "No unjustified overrides (05/06)", severity: "RED", basis: "05/06 overrides" },
  { id: "R20", rowNumber: 26, label: "Ramp does not outpace build funding", severity: "AMBER", basis: "08 ramp vs 15 build" },
]);

const COMPLEXITY_OVERRIDE_ROWS = Object.freeze([6, 7, 8, 9, 10, 11, 12, 13, 14]);

export const P2P_RISK_SNAPSHOT = Object.freeze({
  sheetName: "P2P_18 Risk",
  title: "18. Risk Validation - P2P 20 hard-stop & sign-off checks per persona",
  note: "Any RED disqualifies a persona in Recommend. Identical rule-set across towers; thresholds are policy inputs.",
  formulaCount: 115,
  ruleCount: RISK_RULE_DEFS.length,
  personaCount: P2P_PERSONA_LIBRARY_COLUMNS.length,
});

function trimValue(value) {
  return String(value ?? "").trim();
}

function parseNumericText(value, fallback = Number.NaN) {
  const normalized = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "");

  if (!normalized) {
    return fallback;
  }

  if (normalized.endsWith("%")) {
    const numericPercent = Number(normalized.slice(0, -1).trim());
    return Number.isFinite(numericPercent) ? numericPercent / 100 : fallback;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatDisplayPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0.0%";
  }

  return `${numeric.toFixed(1)}%`;
}

export function formatP2pRiskValue(value, format = "status") {
  if (format === "status") {
    return trimValue(value) || "—";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  switch (format) {
    case "percent1":
      return PERCENT_ONE_FORMATTER.format(numeric);
    case "whole":
      return INTEGER_FORMATTER.format(Math.round(numeric));
    default:
      return String(value ?? "—");
  }
}

function readPersonaMetric(personaInputs, persona, rowKey) {
  const row = PERSONA_ROW_MAP[rowKey];
  if (!row) {
    return 0;
  }

  const address = `${persona.workbookColumn}${row.workbookRow}`;
  if (!Object.prototype.hasOwnProperty.call(personaInputs, address)) {
    return row.values[persona.key];
  }

  if (row.format === "text") {
    return trimValue(personaInputs[address]) || row.values[persona.key];
  }

  const numeric = parseNumericText(personaInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? numeric : row.values[persona.key];
}

function toWorkbookCellMap(rows = []) {
  const cellMap = {};

  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      cellMap[cell.address] = cell;
    });
  });

  return cellMap;
}

function getRowValueMap(rows = [], rowKey = "") {
  const targetRow = rows.find((row) => row.key === rowKey);
  if (!targetRow?.values) {
    return {};
  }

  return Object.fromEntries(
    targetRow.values.map((cell) => [cell.key, Number(cell.value || 0)]),
  );
}

function getStatusRowMap(rows = [], rowNumber = 0) {
  const targetRow = rows.find((row) => row.rowNumber === rowNumber);
  if (!targetRow?.values) {
    return {};
  }

  return Object.fromEntries(
    targetRow.values.map((cell) => [cell.key, trimValue(cell.text || cell.value || "")]),
  );
}

function countComplexityOverridesWithoutRationale(complexityInputs = EMPTY_INPUTS) {
  return COMPLEXITY_OVERRIDE_ROWS.filter((rowNumber) => {
    const overrideValue = parseNumericText(complexityInputs[`E${rowNumber}`], Number.NaN);
    const rationaleText = trimValue(complexityInputs[`F${rowNumber}`]);
    return Number.isFinite(overrideValue) && !rationaleText;
  }).length;
}

function buildStatusCell(persona, status) {
  return {
    key: persona.key,
    label: persona.label,
    index: persona.index,
    value: status,
    text: status,
  };
}

export function buildP2pRiskWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
} = {}) {
  const workspace = normalizeP2pWorkspace(workspaceValue || currentDeal?.p2pWorkspace || createDefaultP2pWorkspace());
  const workbookInputs = currentDeal?.p2pWorkbookInputs && typeof currentDeal.p2pWorkbookInputs === "object"
    ? currentDeal.p2pWorkbookInputs
    : EMPTY_INPUTS;

  const benchmarkInputs = workbookInputs["P2P_04 Benchmarks"] && typeof workbookInputs["P2P_04 Benchmarks"] === "object"
    ? workbookInputs["P2P_04 Benchmarks"]
    : EMPTY_INPUTS;
  const workloadInputs = workbookInputs["P2P_05 Workload"] && typeof workbookInputs["P2P_05 Workload"] === "object"
    ? workbookInputs["P2P_05 Workload"]
    : EMPTY_INPUTS;
  const complexityInputs = workbookInputs["P2P_06 Complexity"] && typeof workbookInputs["P2P_06 Complexity"] === "object"
    ? workbookInputs["P2P_06 Complexity"]
    : EMPTY_INPUTS;
  const personaInputs = workbookInputs["P2P_07 Personas"] && typeof workbookInputs["P2P_07 Personas"] === "object"
    ? workbookInputs["P2P_07 Personas"]
    : EMPTY_INPUTS;
  const aiWorkbookInputs = workbookInputs["P2P_08 AI Benefit"] && typeof workbookInputs["P2P_08 AI Benefit"] === "object"
    ? workbookInputs["P2P_08 AI Benefit"]
    : EMPTY_INPUTS;
  const opsWorkbookInputs = workbookInputs["P2P_09 Ops Model"] && typeof workbookInputs["P2P_09 Ops Model"] === "object"
    ? workbookInputs["P2P_09 Ops Model"]
    : EMPTY_INPUTS;
  const rateCardInputs = workbookInputs["P2P_10 Rate Card"] && typeof workbookInputs["P2P_10 Rate Card"] === "object"
    ? workbookInputs["P2P_10 Rate Card"]
    : EMPTY_INPUTS;

  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const workloadView = buildP2pWorkloadModel(workspace, currentDeal);
  const pricingView = buildP2pPricingWorkbookView({ currentDeal, workspace });
  const aiView = buildP2pAiBenefitWorkbookView({
    aiWorkbookInputs,
    benchmarkInputs,
    workloadInputs,
    personaInputs,
    workspace,
    currentDeal,
  });
  const opsView = buildP2pOpsModelWorkbookView({ opsWorkbookInputs, rateCardInputs });
  const fteView = buildP2pFteEngineWorkbookView({ currentDeal, workspace });
  const transitionView = buildP2pTransitionWorkbookView({ currentDeal, workspace });
  const businessCaseView = buildP2pBusinessCaseWorkbookView({ currentDeal, workspace });

  const personas = P2P_PERSONA_LIBRARY_COLUMNS.map((persona, index) => ({
    ...persona,
    index: index + 1,
    utilisationPct: readPersonaMetric(personaInputs, persona, "utilisationPct"),
    shrinkagePct: readPersonaMetric(personaInputs, persona, "shrinkagePct"),
    managementBufferPct: readPersonaMetric(personaInputs, persona, "managementBufferPct"),
    peakUpliftPct: readPersonaMetric(personaInputs, persona, "peakUpliftPct"),
    spanOfControl: readPersonaMetric(personaInputs, persona, "spanOfControl"),
    targetGrossMarginPct: readPersonaMetric(personaInputs, persona, "targetGrossMarginPct"),
  }));

  const grossMarginPctByPersona = getRowValueMap(pricingView.summaryRows, "grossMarginPct");
  const impliedAutomationPctByPersona = Object.fromEntries(
    (aiView.personas || []).map((persona) => [persona.id, Number(persona.summary?.impliedAutomationPct || 0)]),
  );
  const impliedAiPctByPersona = Object.fromEntries(
    (aiView.personas || []).map((persona) => [persona.id, Number(persona.summary?.impliedAiPct || 0)]),
  );
  const weightedNetReductionSteadyByPersona = Object.fromEntries(
    (aiView.personas || []).map((persona) => [persona.id, Number(persona.summary?.weightedNetReductionSteady || 0)]),
  );
  const weightedNetReductionY1ByPersona = Object.fromEntries(
    (aiView.personas || []).map((persona) => [persona.id, Number(persona.summary?.weightedNetReductionY1 || 0)]),
  );
  const floorCheckStatusByPersona = getStatusRowMap(fteView.statusRows || [], 80);
  const peakCoverageStatusByPersona = getStatusRowMap(fteView.statusRows || [], 81);
  const buildIntensityByPersona = getRowValueMap(transitionView.transformationRows, "buildIntensity");
  const businessCaseByPersona = Object.fromEntries(
    (businessCaseView.personaCards || []).map((persona) => [persona.key, persona.summary || EMPTY_INPUTS]),
  );

  const commercialGmFloorPct = Number(pricingView.controls?.commercialGmFloor?.value || 0);
  const discoveryCoveragePct = Number(discoveryMetrics.coveragePct || 0) * 100;
  const weightedCompletenessPct = Number(discoveryMetrics.weightedCompleteness || 0) * 100;
  const languagesBeyondEnglish = Number(discoveryMetrics.effectiveDiscovery?.languagesBeyondEnglish || 0);
  const opsLanguageCoverage = trimValue(opsView.languageCoverage?.value || "");
  const complexityBand = trimValue(transitionView.complexityBand || "LOW").toUpperCase();
  const workloadOverridesWithoutRationale = Number(workloadView.overridesWithoutNote || 0);
  const complexityOverridesWithoutRationale = countComplexityOverridesWithoutRationale(complexityInputs);
  const governanceOverrideIssueCount = workloadOverridesWithoutRationale + complexityOverridesWithoutRationale;

  const ruleRows = RISK_RULE_DEFS.map((definition) => ({
    ...definition,
    values: personas.map((persona) => {
      const grossMarginPct = Number(grossMarginPctByPersona[persona.key] || 0);
      const npv = Number(businessCaseByPersona[persona.key]?.npv || 0);
      const minGmY2InTerm = Number(businessCaseByPersona[persona.key]?.minGmY2InTerm || 0);
      const steadyNetReduction = Number(weightedNetReductionSteadyByPersona[persona.key] || 0);
      const y1NetReduction = Number(weightedNetReductionY1ByPersona[persona.key] || 0);
      const buildIntensity = Number(buildIntensityByPersona[persona.key] || 0);

      let status = "GREEN";

      switch (definition.id) {
        case "R1":
          status = grossMarginPct < commercialGmFloorPct ? "RED" : "GREEN";
          break;
        case "R2":
          status = grossMarginPct < persona.targetGrossMarginPct ? "AMBER" : "GREEN";
          break;
        case "R3":
          status = persona.utilisationPct < 0.6 || persona.utilisationPct > 0.95 ? "RED" : "GREEN";
          break;
        case "R4":
          status = persona.shrinkagePct < 0.05 || persona.shrinkagePct > 0.2 ? "AMBER" : "GREEN";
          break;
        case "R5":
          status = persona.managementBufferPct < 0.03 ? "AMBER" : "GREEN";
          break;
        case "R6":
          status = persona.peakUpliftPct < 0.05 || persona.peakUpliftPct > 0.3 ? "AMBER" : "GREEN";
          break;
        case "R7":
          status = persona.spanOfControl < 5 || persona.spanOfControl > 15 ? "AMBER" : "GREEN";
          break;
        case "R8":
          status = Number(impliedAutomationPctByPersona[persona.key] || 0) > Number(aiView.gateDrivers?.effectiveCeiling || 0) ? "RED" : "GREEN";
          break;
        case "R9":
          status = Number(impliedAiPctByPersona[persona.key] || 0) > Number(aiView.gateDrivers?.aiMaturityCeiling || 0) ? "RED" : "GREEN";
          break;
        case "R10":
          status = complexityBand === "VERY HIGH" && persona.index >= 4 ? "AMBER" : "GREEN";
          break;
        case "R11":
          status = discoveryCoveragePct < 30 && persona.index >= 4 ? "RED" : "GREEN";
          break;
        case "R12":
          status = Math.abs((opsView.shoreMixTable?.totals?.[persona.key] || 0) - 1) > 0.001 ? "RED" : "GREEN";
          break;
        case "R13":
          status = weightedCompletenessPct < 60 ? "AMBER" : "GREEN";
          break;
        case "R14":
          status = npv < 0 ? "RED" : "GREEN";
          break;
        case "R15":
          status = peakCoverageStatusByPersona[persona.key] || "OK";
          break;
        case "R16":
          status = floorCheckStatusByPersona[persona.key] || "OK";
          break;
        case "R17":
          status = minGmY2InTerm < commercialGmFloorPct
            ? "RED"
            : minGmY2InTerm < persona.targetGrossMarginPct
              ? "AMBER"
              : "GREEN";
          break;
        case "R18":
          status = languagesBeyondEnglish > 0 && opsLanguageCoverage.toUpperCase() !== "YES" ? "AMBER" : "GREEN";
          break;
        case "R19":
          status = governanceOverrideIssueCount > 0 ? "RED" : "GREEN";
          break;
        case "R20":
          status = steadyNetReduction <= 0
            ? "GREEN"
            : (y1NetReduction / steadyNetReduction) > 0.6 && buildIntensity < 0.15
              ? "AMBER"
              : "GREEN";
          break;
        default:
          status = "GREEN";
      }

      return buildStatusCell(persona, status);
    }),
  }));

  const personaVerdicts = personas.map((persona) => {
    const statuses = ruleRows.map((row) => trimValue(row.values.find((cell) => cell.key === persona.key)?.value));
    const redCount = statuses.filter((value) => value === "RED").length;
    const amberCount = statuses.filter((value) => value === "AMBER").length;
    const verdict = redCount > 0 ? "RED" : amberCount > 0 ? "AMBER" : "GREEN";

    return {
      key: persona.key,
      label: persona.label,
      index: persona.index,
      redCount,
      amberCount,
      verdict,
      openCheckCount: redCount + amberCount,
    };
  });

  const summaryRows = [
    {
      key: "redCount",
      rowNumber: 28,
      label: "RED count",
      format: "whole",
      values: personaVerdicts.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: persona.redCount,
        text: formatP2pRiskValue(persona.redCount, "whole"),
      })),
    },
    {
      key: "amberCount",
      rowNumber: 29,
      label: "AMBER count",
      format: "whole",
      values: personaVerdicts.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: persona.amberCount,
        text: formatP2pRiskValue(persona.amberCount, "whole"),
      })),
    },
    {
      key: "verdict",
      rowNumber: 30,
      label: "VERDICT",
      format: "status",
      values: personaVerdicts.map((persona) => ({
        key: persona.key,
        label: persona.label,
        value: persona.verdict,
        text: persona.verdict,
      })),
    },
  ];

  const recommendedPersona = pricingView.recommendedPersona
    ? personaVerdicts.find((persona) => persona.key === pricingView.recommendedPersona.key)
    : personaVerdicts.find((persona) => persona.key === "standard") || personaVerdicts[0];

  return {
    ...P2P_RISK_SNAPSHOT,
    personaHeaders: personas.map((persona) => ({
      key: persona.key,
      label: persona.label,
      workbookColumn: persona.workbookColumn,
      index: persona.index,
    })),
    recommendedPersona,
    ruleRows,
    summaryRows,
    personaVerdicts,
    commercialGmFloorPct,
    complexityBand,
    discoveryCoveragePct,
    discoveryCoverageLabel: formatDisplayPercent(discoveryCoveragePct),
    weightedCompletenessPct,
    weightedCompletenessLabel: formatDisplayPercent(weightedCompletenessPct),
    languageCoverage: opsLanguageCoverage || "—",
    governanceOverrideIssueCount,
    workloadOverridesWithoutRationale,
    complexityOverridesWithoutRationale,
  };
}



