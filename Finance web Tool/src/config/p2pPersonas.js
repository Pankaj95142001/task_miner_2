import {
  FPA_PERSONA_LIBRARY_COLUMNS,
  FPA_PERSONA_LIBRARY_ROWS,
  FPA_PERSONA_LIBRARY_SECTIONS,
  formatPersonaValue,
  getPersonaRiskTone,
} from "./fpaPersonas";

export const P2P_PERSONA_LIBRARY_SNAPSHOT = Object.freeze({
  sheetName: "P2P_07 Personas",
  title: "07. Persona Library - 5 solution archetypes for P2P (all levers calibratable)",
  note: "One base P2P size, five commercial personalities. Ambition Scalar x Addressability (08) drives the AI / automation benefit. Fixed column order C:G.",
  personaCount: 5,
  leverCount: 22,
  formulaCount: 0,
  editableCellCount: 110,
});

const P2P_PERSONA_LIBRARY_POSITIONING = Object.freeze({
  conservative: "Continuity-first; stabilise controls and service before aggressive optimisation",
  standard: "Balanced P2P transformation at a defendable market pace",
  lean: "Productivity-led P2P with disciplined automation from day one",
  aggressiveAiFirst: "AI-led P2P operations with faster pyramid compression",
  autonomousFinance: "Agentic P2P delivery with humans focused on exceptions, controls, and judgement",
});

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

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

export function buildP2pPersonaWorkbookView() {
  const personas = FPA_PERSONA_LIBRARY_COLUMNS.map((column) => {
    const riskRating = PERSONA_ROW_MAP.deliveryRiskRating.values[column.key];

    return {
      ...column,
      positioning: P2P_PERSONA_LIBRARY_POSITIONING[column.key],
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
    ...P2P_PERSONA_LIBRARY_SNAPSHOT,
    personas,
    sections,
  };
}

export const P2P_PERSONA_LIBRARY_COLUMNS = FPA_PERSONA_LIBRARY_COLUMNS;
export const P2P_PERSONA_LIBRARY_ROWS = FPA_PERSONA_LIBRARY_ROWS;

export { formatPersonaValue, getPersonaRiskTone };