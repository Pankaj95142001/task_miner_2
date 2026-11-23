const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const FPA_PERSONA_LIBRARY_SNAPSHOT = Object.freeze({
  sheetName: "FPA_07 Personas",
  title: "07. Persona Library — 5 solution archetypes for FP&A (all levers calibratable)",
  note: "One base size, five commercial personalities. Ambition Scalar x Addressability (08) drives the AI/automation benefit. Fixed column order C:G.",
  personaCount: 5,
  leverCount: 22,
  formulaCount: 0,
  editableCellCount: 110,
});

export const FPA_PERSONA_LIBRARY_COLUMNS = Object.freeze([
  { key: "conservative", label: "Conservative", workbookColumn: "C" },
  { key: "standard", label: "Standard", workbookColumn: "D" },
  { key: "lean", label: "Lean", workbookColumn: "E" },
  { key: "aggressiveAiFirst", label: "Aggressive AI-First", workbookColumn: "F" },
  { key: "autonomousFinance", label: "Autonomous Finance", workbookColumn: "G" },
]);

export const FPA_PERSONA_LIBRARY_POSITIONING = Object.freeze({
  conservative: "Continuity-first; prove stability before optimising",
  standard: "Balanced transformation at industry pace",
  lean: "Productivity-led; disciplined automation day one",
  aggressiveAiFirst: "AI copilots + automation front-loaded; leaner pyramid",
  autonomousFinance: "Agentic operations; humans on exceptions & judgement",
});

export const FPA_PERSONA_LIBRARY_ROWS = Object.freeze([
  {
    key: "workingDaysPerMonth",
    workbookRow: 7,
    label: "Working Days / Month",
    note: "",
    format: "integer",
    values: { conservative: 22, standard: 22, lean: 22, aggressiveAiFirst: 22, autonomousFinance: 22 },
  },
  {
    key: "workingHoursPerDay",
    workbookRow: 8,
    label: "Working Hours / Day",
    note: "",
    format: "decimal1",
    values: { conservative: 9, standard: 9.5, lean: 9.5, aggressiveAiFirst: 9.5, autonomousFinance: 9.5 },
  },
  {
    key: "utilisationPct",
    workbookRow: 9,
    label: "Utilisation %",
    note: "Defendable 60-95%",
    format: "percent0",
    values: { conservative: 0.82, standard: 0.85, lean: 0.88, aggressiveAiFirst: 0.9, autonomousFinance: 0.92 },
  },
  {
    key: "shrinkagePct",
    workbookRow: 10,
    label: "Shrinkage %",
    note: "Sanity 5-20%",
    format: "percent0",
    values: { conservative: 0.14, standard: 0.12, lean: 0.1, aggressiveAiFirst: 0.08, autonomousFinance: 0.07 },
  },
  {
    key: "trainingRampOverheadPct",
    workbookRow: 11,
    label: "Training & Ramp Overhead %",
    note: "",
    format: "percent0",
    values: { conservative: 0.04, standard: 0.03, lean: 0.03, aggressiveAiFirst: 0.02, autonomousFinance: 0.02 },
  },
  {
    key: "managementBufferPct",
    workbookRow: 12,
    label: "Management Buffer %",
    note: ">= 3%",
    format: "percent0",
    values: { conservative: 0.15, standard: 0.1, lean: 0.08, aggressiveAiFirst: 0.05, autonomousFinance: 0.03 },
  },
  {
    key: "backupCrossSkillingPct",
    workbookRow: 13,
    label: "Backup / Cross-skilling %",
    note: "",
    format: "percent0",
    values: { conservative: 0.1, standard: 0.08, lean: 0.06, aggressiveAiFirst: 0.05, autonomousFinance: 0.03 },
  },
  {
    key: "peakUpliftPct",
    workbookRow: 14,
    label: "Peak Uplift % (peak season)",
    note: "5-30%",
    format: "percent0",
    values: { conservative: 0.25, standard: 0.2, lean: 0.15, aggressiveAiFirst: 0.12, autonomousFinance: 0.1 },
  },
  {
    key: "peakMonthsPerYear",
    workbookRow: 15,
    label: "Peak Months / yr",
    note: "",
    format: "integer",
    values: { conservative: 3, standard: 3, lean: 3, aggressiveAiFirst: 3, autonomousFinance: 3 },
  },
  {
    key: "spanOfControl",
    workbookRow: 16,
    label: "Span of Control",
    note: "Band 5-15",
    format: "integer",
    values: { conservative: 6, standard: 8, lean: 9, aggressiveAiFirst: 10, autonomousFinance: 12 },
  },
  {
    key: "ambitionScalar",
    workbookRow: 17,
    label: "Ambition Scalar (x lever potential)",
    note: "",
    format: "decimal2",
    values: { conservative: 0.4, standard: 0.65, lean: 0.8, aggressiveAiFirst: 1, autonomousFinance: 1 },
  },
  {
    key: "year1LearningCurvePct",
    workbookRow: 18,
    label: "Yr-1 Learning Curve % (cost uplift)",
    note: "",
    format: "percent0",
    values: { conservative: 0.15, standard: 0.1, lean: 0.08, aggressiveAiFirst: 0.05, autonomousFinance: 0.05 },
  },
  {
    key: "productivityGlideY2Pct",
    workbookRow: 19,
    label: "Productivity Glide Y2 %",
    note: "",
    format: "percent0",
    values: { conservative: 0.03, standard: 0.05, lean: 0.07, aggressiveAiFirst: 0.08, autonomousFinance: 0.1 },
  },
  {
    key: "productivityGlideY3Pct",
    workbookRow: 20,
    label: "Productivity Glide Y3 %",
    note: "",
    format: "percent0",
    values: { conservative: 0.05, standard: 0.08, lean: 0.1, aggressiveAiFirst: 0.12, autonomousFinance: 0.15 },
  },
  {
    key: "steadyProductivityY4Pct",
    workbookRow: 21,
    label: "Steady Productivity Y4+ %",
    note: "",
    format: "percent0",
    values: { conservative: 0.02, standard: 0.03, lean: 0.04, aggressiveAiFirst: 0.04, autonomousFinance: 0.05 },
  },
  {
    key: "priceDownPassThroughPct",
    workbookRow: 22,
    label: "Price-Down Pass-Through %",
    note: "",
    format: "percent0",
    values: { conservative: 0.3, standard: 0.5, lean: 0.6, aggressiveAiFirst: 0.7, autonomousFinance: 0.7 },
  },
  {
    key: "targetGrossMarginPct",
    workbookRow: 23,
    label: "Target Gross Margin %",
    note: "",
    format: "percent0",
    values: { conservative: 0.3, standard: 0.24, lean: 0.2, aggressiveAiFirst: 0.16, autonomousFinance: 0.18 },
  },
  {
    key: "markupOnCostPct",
    workbookRow: 24,
    label: "Markup on Cost %",
    note: "",
    format: "percent0",
    values: { conservative: 0.5, standard: 0.32, lean: 0.25, aggressiveAiFirst: 0.19, autonomousFinance: 0.22 },
  },
  {
    key: "riskPremiumPct",
    workbookRow: 25,
    label: "Risk Premium %",
    note: "",
    format: "percent0",
    values: { conservative: 0.03, standard: 0.02, lean: 0.02, aggressiveAiFirst: 0.01, autonomousFinance: 0.02 },
  },
  {
    key: "contingencyPct",
    workbookRow: 26,
    label: "Contingency % on cost [PA]",
    note: "",
    format: "percent1",
    values: { conservative: 0.05, standard: 0.03, lean: 0.025, aggressiveAiFirst: 0.02, autonomousFinance: 0.02 },
  },
  {
    key: "agentGovernancePodFte",
    workbookRow: 27,
    label: "Agent-Governance Pod (FTE)",
    note: "",
    format: "decimal1",
    values: { conservative: 0, standard: 0, lean: 0, aggressiveAiFirst: 0.5, autonomousFinance: 1 },
  },
  {
    key: "deliveryRiskRating",
    workbookRow: 28,
    label: "Delivery Risk Rating",
    note: "",
    format: "text",
    values: {
      conservative: "LOW",
      standard: "LOW-MEDIUM",
      lean: "MEDIUM",
      aggressiveAiFirst: "MEDIUM-HIGH",
      autonomousFinance: "HIGH",
    },
  },
]);

export const FPA_PERSONA_LIBRARY_SECTIONS = Object.freeze([
  {
    id: "capacity",
    title: "Capacity baseline",
    note: "Workbook rows 7-10 set the raw time and shrinkage assumptions before leadership and peak overlays are added.",
    rowKeys: ["workingDaysPerMonth", "workingHoursPerDay", "utilisationPct", "shrinkagePct"],
  },
  {
    id: "buffers",
    title: "Buffers and resilience",
    note: "Workbook rows 11-16 hold ramp, leadership, coverage, seasonality, and management span assumptions.",
    rowKeys: ["trainingRampOverheadPct", "managementBufferPct", "backupCrossSkillingPct", "peakUpliftPct", "peakMonthsPerYear", "spanOfControl"],
  },
  {
    id: "transformation",
    title: "Transformation curve",
    note: "Workbook rows 17-21 capture ambition plus the learning and productivity glide built into each persona.",
    rowKeys: ["ambitionScalar", "year1LearningCurvePct", "productivityGlideY2Pct", "productivityGlideY3Pct", "steadyProductivityY4Pct"],
  },
  {
    id: "commercial",
    title: "Commercial guardrails",
    note: "Workbook rows 22-27 define pricing pressure, margin posture, contingency, and governance overlay by persona.",
    rowKeys: ["priceDownPassThroughPct", "targetGrossMarginPct", "markupOnCostPct", "riskPremiumPct", "contingencyPct", "agentGovernancePodFte"],
  },
  {
    id: "risk",
    title: "Risk posture",
    note: "Workbook row 28 closes the persona library with the fixed delivery risk rating per archetype.",
    rowKeys: ["deliveryRiskRating"],
  },
]);

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

export function formatPersonaValue(value, format = "text") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numeric = Number(value);

  switch (format) {
    case "integer":
      return Number.isFinite(numeric) ? INTEGER_FORMATTER.format(Math.round(numeric)) : String(value);
    case "decimal1":
      return Number.isFinite(numeric) ? numeric.toFixed(1) : String(value);
    case "decimal2":
      return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
    case "percent0":
      return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : String(value);
    case "percent1":
      return Number.isFinite(numeric) ? `${(numeric * 100).toFixed(1)}%` : String(value);
    default:
      return String(value);
  }
}

export function getPersonaRiskTone(value) {
  switch (String(value ?? "").trim().toUpperCase()) {
    case "LOW":
      return "success";
    case "LOW-MEDIUM":
      return "info";
    case "MEDIUM":
      return "warning";
    case "MEDIUM-HIGH":
      return "warning";
    case "HIGH":
      return "danger";
    default:
      return "neutral";
  }
}

function buildPersonaHighlights(columnKey) {
  return [
    { label: "Utilisation", value: formatPersonaValue(PERSONA_ROW_MAP.utilisationPct.values[columnKey], PERSONA_ROW_MAP.utilisationPct.format) },
    { label: "Ambition Scalar", value: formatPersonaValue(PERSONA_ROW_MAP.ambitionScalar.values[columnKey], PERSONA_ROW_MAP.ambitionScalar.format) },
    { label: "Target Margin", value: formatPersonaValue(PERSONA_ROW_MAP.targetGrossMarginPct.values[columnKey], PERSONA_ROW_MAP.targetGrossMarginPct.format) },
    { label: "Markup", value: formatPersonaValue(PERSONA_ROW_MAP.markupOnCostPct.values[columnKey], PERSONA_ROW_MAP.markupOnCostPct.format) },
    { label: "Contingency", value: formatPersonaValue(PERSONA_ROW_MAP.contingencyPct.values[columnKey], PERSONA_ROW_MAP.contingencyPct.format) },
    { label: "Gov Pod", value: formatPersonaValue(PERSONA_ROW_MAP.agentGovernancePodFte.values[columnKey], PERSONA_ROW_MAP.agentGovernancePodFte.format) },
  ];
}

export function buildFpaPersonaWorkbookView() {
  const personas = FPA_PERSONA_LIBRARY_COLUMNS.map((column) => {
    const riskRating = PERSONA_ROW_MAP.deliveryRiskRating.values[column.key];

    return {
      ...column,
      positioning: FPA_PERSONA_LIBRARY_POSITIONING[column.key],
      riskRating,
      riskTone: getPersonaRiskTone(riskRating),
      highlights: buildPersonaHighlights(column.key),
    };
  });

  const sections = FPA_PERSONA_LIBRARY_SECTIONS.map((section) => {
    const rows = section.rowKeys.map((rowKey) => PERSONA_ROW_MAP[rowKey]).filter(Boolean);

    return {
      ...section,
      startRow: rows[0]?.workbookRow || 0,
      endRow: rows[rows.length - 1]?.workbookRow || 0,
      rows,
    };
  });

  return {
    ...FPA_PERSONA_LIBRARY_SNAPSHOT,
    personas,
    sections,
  };
}

