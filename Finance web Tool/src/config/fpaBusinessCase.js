import { buildFpaCostWorkbookView } from "./fpaCost";
import {
  FPA_PERSONA_LIBRARY_COLUMNS,
  FPA_PERSONA_LIBRARY_ROWS,
} from "./fpaPersonas";
import { buildFpaPricingWorkbookView } from "./fpaPricing";
import { buildFpaTransitionWorkbookView } from "./fpaTransition";
import {
  createDefaultFpaWorkspace,
  normalizeFpaWorkspace,
} from "./fpaWorkspace";

const EMPTY_INPUTS = Object.freeze({});
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const CURRENCY_ZERO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const CURRENCY_TWO_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERSONA_ROW_MAP = Object.freeze(
  Object.fromEntries(FPA_PERSONA_LIBRARY_ROWS.map((row) => [row.key, row])),
);

const YEAR_HEADERS = Object.freeze([
  { key: "y1", label: "Y1", yearNumber: 1, workbookColumn: "C" },
  { key: "y2", label: "Y2", yearNumber: 2, workbookColumn: "D" },
  { key: "y3", label: "Y3", yearNumber: 3, workbookColumn: "E" },
  { key: "y4", label: "Y4", yearNumber: 4, workbookColumn: "F" },
  { key: "y5", label: "Y5", yearNumber: 5, workbookColumn: "G" },
  { key: "y6", label: "Y6", yearNumber: 6, workbookColumn: "H" },
  { key: "y7", label: "Y7", yearNumber: 7, workbookColumn: "I" },
]);

const PRODUCTIVITY_YEAR_HEADERS = Object.freeze(YEAR_HEADERS.slice(1));

const TERM_SUMMARY_ROW_DEFS = Object.freeze([
  { key: "tcv", rowNumber: 64, label: "Total Contract Value (TCV)", format: "currency0" },
  { key: "acv", rowNumber: 65, label: "Average Contract Value (ACV)", format: "currency0" },
  { key: "grossMarginTerm", rowNumber: 66, label: "Gross Margin $ (term)", format: "currency0" },
  { key: "npvRevenue", rowNumber: 67, label: "NPV of Revenue", format: "currency0" },
  { key: "npvCost", rowNumber: 68, label: "NPV of Cost", format: "currency0" },
  { key: "npv", rowNumber: 69, label: "NPV (GM less investment)", format: "currency0" },
  { key: "payback", rowNumber: 70, label: "Payback (year)", format: "payback" },
  { key: "avgGmPct", rowNumber: 71, label: "Avg GM % (term)", format: "percent1" },
  { key: "cumulativeNetCashTerm", rowNumber: 72, label: "Cumulative net cash (term)", format: "currency0" },
]);

const DETAIL_ROW_DEFS = Object.freeze([
  { key: "revenue", rowNumber: 77, label: "Revenue", format: "currency0" },
  { key: "cost", rowNumber: 78, label: "Cost", format: "currency0" },
  { key: "grossMargin", rowNumber: 79, label: "Gross Margin $", format: "currency0" },
  { key: "grossMarginPct", rowNumber: 80, label: "GM %", format: "percent1" },
  { key: "cumulativeCash", rowNumber: 81, label: "Cumulative net cash", format: "currency0" },
]);

export const FPA_BUSINESS_CASE_INSPECT_AUTO = "__AUTO__";

export const FPA_BUSINESS_CASE_SNAPSHOT = Object.freeze({
  sheetName: "FPA_16 Business Case",
  title: "16. Multiyear Business Case - FP&A: annual escalation vs committed productivity",
  note: "Price glides down by committed productivity while cost carries run-state economics, a fixed 3% annual escalation, and the chosen transition/transformation funding logic.",
  formulaCount: 346,
  personaCount: 5,
  yearCount: 7,
  summaryMetricCount: TERM_SUMMARY_ROW_DEFS.length,
});

function trimValue(value) {
  return String(value ?? "").trim();
}

function round(value, digits = 12) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumericText(value, fallback = Number.NaN) {
  const text = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "");

  if (!text) {
    return fallback;
  }

  if (text.endsWith("%")) {
    const numericPercent = Number(text.slice(0, -1).trim());
    return Number.isFinite(numericPercent) ? numericPercent / 100 : fallback;
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parsePercentLikeInput(value, fallback = Number.NaN) {
  const text = trimValue(value)
    .replace(/,/g, "")
    .replace(/\$/g, "");

  if (!text) {
    return fallback;
  }

  const hasPercentSign = text.includes("%");
  const normalized = text.replace(/%/g, "");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (hasPercentSign) {
    return numeric / 100;
  }

  if (Math.abs(numeric) >= 2) {
    return numeric / 100;
  }

  return numeric;
}

function normalizePersonaId(value) {
  const normalized = trimValue(value);

  switch (normalized) {
    case "aggressive-ai-first":
      return "aggressiveAiFirst";
    case "autonomous-finance":
      return "autonomousFinance";
    default:
      return normalized || "standard";
  }
}

export function formatBusinessCaseValue(value, format = "currency0") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (format === "payback") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `Y${Math.round(numeric)}` : String(value);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  switch (format) {
    case "currency2":
      return CURRENCY_TWO_FORMATTER.format(numeric);
    case "currency0":
      return CURRENCY_ZERO_FORMATTER.format(Math.round(numeric));
    case "percent0":
      return `${Math.round(numeric * 100)}%`;
    case "percent1":
      return `${(numeric * 100).toFixed(1)}%`;
    case "factor4":
      return numeric.toFixed(4);
    case "number2":
      return DECIMAL_TWO_FORMATTER.format(numeric);
    case "whole":
    default:
      return INTEGER_FORMATTER.format(Math.round(numeric));
  }
}

function readPersonaMetric(personaInputs, persona, rowKey) {
  const row = PERSONA_ROW_MAP[rowKey];
  if (!row) {
    return 0;
  }

  const address = `${persona.workbookColumn}${row.workbookRow}`;
  if (!Object.prototype.hasOwnProperty.call(personaInputs, address)) {
    return Number(row.values[persona.key] || 0);
  }

  const numeric = parseNumericText(personaInputs[address], Number.NaN);
  return Number.isFinite(numeric) ? numeric : Number(row.values[persona.key] || 0);
}

function parseContractTermYears(value) {
  const numeric = parseNumericText(value, Number.NaN);
  return Number.isFinite(numeric) ? clamp(Math.round(numeric), 1, 7) : 5;
}

function readDealPercent(currentDeal, fieldName, fallback = 0) {
  const numeric = parsePercentLikeInput(currentDeal?.[fieldName], Number.NaN);
  return Number.isFinite(numeric) ? clamp(numeric, 0, 1) : fallback;
}

function readOptionalDealPercent(currentDeal, fieldName) {
  const numeric = parsePercentLikeInput(currentDeal?.[fieldName], Number.NaN);
  return Number.isFinite(numeric) ? clamp(numeric, 0, 1) : null;
}

function buildYearCells(values, format) {
  return YEAR_HEADERS.map((year, index) => {
    const value = Number(values[index] || 0);
    return {
      key: year.key,
      label: year.label,
      value,
      text: formatBusinessCaseValue(value, format),
    };
  });
}

function buildProductivityCells(values) {
  return PRODUCTIVITY_YEAR_HEADERS.map((year, index) => {
    const value = Number(values[index] || 0);
    return {
      key: year.key,
      label: year.label,
      value,
      text: formatBusinessCaseValue(value, "percent1"),
    };
  });
}

function buildPersonaSummaryCells(valueByPersona, personaHeaders, format) {
  return personaHeaders.map((persona) => {
    const value = valueByPersona[persona.key];
    return {
      key: persona.key,
      label: persona.label,
      value,
      text: formatBusinessCaseValue(value, format),
    };
  });
}

function getPricingRowPersonaMap(pricingView, rowKey) {
  const row = pricingView.summaryRows.find((item) => item.key === rowKey);
  return Object.fromEntries((row?.values || []).map((cell) => [cell.key, Number(cell.value || 0)]));
}

function getWorkbookRowPersonaMap(rows, rowKey) {
  const row = rows.find((item) => item.key === rowKey);
  return Object.fromEntries((row?.values || []).map((cell) => [cell.key, Number(cell.value || 0)]));
}

function getCostToServeByPersona(costView) {
  return Object.fromEntries(
    (costView.personaSections || []).map((persona) => {
      const costLine = persona.lines.find((line) => line.key === "costToServe");
      return [persona.key, (costLine?.values || []).map((cell) => Number(cell.value || 0))];
    }),
  );
}

function resolveSelectedPersonas(pricingView, inspectPersonaId) {
  const personaHeaders = Array.isArray(pricingView.personaHeaders) && pricingView.personaHeaders.length > 0
    ? pricingView.personaHeaders
    : FPA_PERSONA_LIBRARY_COLUMNS;
  const recommendedPersonaId = normalizePersonaId(pricingView.recommendedPersona?.key || "standard");
  const selectedPersonaId = normalizePersonaId(
    inspectPersonaId === FPA_BUSINESS_CASE_INSPECT_AUTO ? recommendedPersonaId : inspectPersonaId,
  );

  const recommendedIndex = personaHeaders.findIndex((persona) => persona.key === recommendedPersonaId);
  const selectedIndex = personaHeaders.findIndex((persona) => persona.key === selectedPersonaId);
  const recommendedHeader = personaHeaders[recommendedIndex >= 0 ? recommendedIndex : 1] || personaHeaders[0];
  const selectedHeader = personaHeaders[selectedIndex >= 0 ? selectedIndex : recommendedIndex >= 0 ? recommendedIndex : 1] || personaHeaders[0];

  return {
    personaHeaders,
    recommendedHeader: {
      ...recommendedHeader,
      index: Math.max(1, personaHeaders.findIndex((persona) => persona.key === recommendedHeader?.key) + 1),
    },
    selectedHeader: {
      ...selectedHeader,
      index: Math.max(1, personaHeaders.findIndex((persona) => persona.key === selectedHeader?.key) + 1),
    },
  };
}

export function buildFpaBusinessCaseWorkbookView({
  currentDeal = {},
  workspace: workspaceValue,
  inspectPersonaId = FPA_BUSINESS_CASE_INSPECT_AUTO,
} = {}) {
  const workspace = normalizeFpaWorkspace(workspaceValue || currentDeal?.fpaWorkspace || createDefaultFpaWorkspace());
  const workbookInputs = currentDeal?.fpaWorkbookInputs && typeof currentDeal.fpaWorkbookInputs === "object"
    ? currentDeal.fpaWorkbookInputs
    : EMPTY_INPUTS;
  const personaInputs = workbookInputs["FPA_07 Personas"] && typeof workbookInputs["FPA_07 Personas"] === "object"
    ? workbookInputs["FPA_07 Personas"]
    : EMPTY_INPUTS;

  const pricingView = buildFpaPricingWorkbookView({ currentDeal, workspace });
  const costView = buildFpaCostWorkbookView({ currentDeal, workspace });
  const transitionView = buildFpaTransitionWorkbookView({ currentDeal, workspace });
  const { personaHeaders, recommendedHeader, selectedHeader } = resolveSelectedPersonas(pricingView, inspectPersonaId);

  const contractTermYears = parseContractTermYears(currentDeal?.contractTerm);
  const discountRate = readDealPercent(currentDeal, "discountRate", 0.1);
  const annualEscalationRate = 0.03;
  const committedProdY2Override = readOptionalDealPercent(currentDeal, "committedProdY2");
  const committedProdY3Override = readOptionalDealPercent(currentDeal, "committedProdY3");
  const committedProdY4Override = readOptionalDealPercent(currentDeal, "committedProdY4");
  const transitionCommercials = trimValue(currentDeal?.transitionCommercials) || "Separate fee";
  const transformationFunding = trimValue(currentDeal?.transformationFunding) || "Provider-funded";
  const y1BillingFactor = Number(transitionView.y1BillingFactor || 0);

  const inTermMaskValues = YEAR_HEADERS.map((year) => (year.yearNumber <= contractTermYears ? 1 : 0));
  const discountFactorValues = YEAR_HEADERS.map((year) => round(1 / ((1 + discountRate) ** year.yearNumber), 12));
  const inTermMaskRow = {
    key: "inTermMask",
    rowNumber: 4,
    label: "In-term mask",
    values: buildYearCells(inTermMaskValues, "whole"),
  };
  const discountFactorRow = {
    key: "discountFactor",
    rowNumber: 5,
    label: "Discount factor",
    values: buildYearCells(discountFactorValues, "factor4"),
  };

  const annualPriceByPersona = getPricingRowPersonaMap(pricingView, "recommendedAnnualPrice");
  const transitionFeeByPersona = getWorkbookRowPersonaMap(transitionView.transitionCostRows, "transitionFee");
  const transitionCostByPersona = getWorkbookRowPersonaMap(transitionView.transitionCostRows, "transitionCost");
  const transformationBuildByPersona = getWorkbookRowPersonaMap(transitionView.transformationRows, "transformationBuild");
  const costToServeByPersona = getCostToServeByPersona(costView);

  const committedProductivityRows = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => {
    const priceDownPassThroughPct = readPersonaMetric(personaInputs, persona, "priceDownPassThroughPct");
    const y2Default = readPersonaMetric(personaInputs, persona, "productivityGlideY2Pct") * priceDownPassThroughPct;
    const y3Default = readPersonaMetric(personaInputs, persona, "productivityGlideY3Pct") * priceDownPassThroughPct;
    const y4Default = readPersonaMetric(personaInputs, persona, "steadyProductivityY4Pct") * priceDownPassThroughPct;
    const values = [
      committedProdY2Override ?? y2Default,
      committedProdY3Override ?? y3Default,
      committedProdY4Override ?? y4Default,
      committedProdY4Override ?? y4Default,
      committedProdY4Override ?? y4Default,
      committedProdY4Override ?? y4Default,
    ].map((value) => round(value, 12));

    return {
      ...persona,
      rowNumber: 9 + index,
      values: buildProductivityCells(values),
    };
  });

  const committedProductivityByPersona = Object.fromEntries(
    committedProductivityRows.map((row) => [row.key, row.values.map((cell) => Number(cell.value || 0))]),
  );

  const annualChargeRows = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => {
    const values = [round(annualPriceByPersona[persona.key] || 0, 12)];

    for (let yearIndex = 1; yearIndex < YEAR_HEADERS.length; yearIndex += 1) {
      const previousValue = values[yearIndex - 1] || 0;
      const committedProductivity = committedProductivityByPersona[persona.key]?.[yearIndex - 1] || 0;
      values[yearIndex] = round(previousValue * (1 - committedProductivity) * (1 + annualEscalationRate), 12);
    }

    return {
      ...persona,
      rowNumber: 15 + index,
      values: buildYearCells(values, "currency0"),
    };
  });

  const annualChargeByPersona = Object.fromEntries(
    annualChargeRows.map((row) => [row.key, row.values.map((cell) => Number(cell.value || 0))]),
  );

  const revenueRows = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => {
    const transitionFee = Number(transitionFeeByPersona[persona.key] || 0);
    const transformationBuild = Number(transformationBuildByPersona[persona.key] || 0);
    const amortizedTransitionAdder = transitionCommercials === "Amortised"
      ? round(transitionFee / contractTermYears, 12)
      : 0;
    const amortizedTransformationAdder = transformationFunding === "Amortised"
      ? round((transformationBuild * 1.15) / contractTermYears, 12)
      : 0;
    const annualChargeValues = annualChargeByPersona[persona.key] || YEAR_HEADERS.map(() => 0);

    const values = annualChargeValues.map((value, yearIndex) => {
      if (yearIndex === 0) {
        return round(
          (value * y1BillingFactor)
            + (transitionCommercials === "Separate fee" ? transitionFee : 0)
            + (transformationFunding === "Customer-funded" ? transformationBuild : 0)
            + amortizedTransitionAdder
            + amortizedTransformationAdder,
          12,
        );
      }

      return round(value + amortizedTransitionAdder + amortizedTransformationAdder, 12);
    });

    return {
      ...persona,
      rowNumber: 22 + index,
      values: buildYearCells(values, "currency0"),
    };
  });

  const revenueByPersona = Object.fromEntries(
    revenueRows.map((row) => [row.key, row.values.map((cell) => Number(cell.value || 0))]),
  );

  const costRows = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => {
    const transitionCost = Number(transitionCostByPersona[persona.key] || 0);
    const transformationBuild = Number(transformationBuildByPersona[persona.key] || 0);
    const runStateCostValues = costToServeByPersona[persona.key] || YEAR_HEADERS.map(() => 0);

    const values = runStateCostValues.map((value, yearIndex) => {
      if (yearIndex === 0) {
        return round(
          value
            + (transitionCommercials !== "Provider-funded" ? transitionCost : 0)
            + (["Customer-funded", "Amortised"].includes(transformationFunding) ? transformationBuild : 0),
          12,
        );
      }

      return round(value, 12);
    });

    return {
      ...persona,
      rowNumber: 29 + index,
      values: buildYearCells(values, "currency0"),
    };
  });

  const costByPersona = Object.fromEntries(
    costRows.map((row) => [row.key, row.values.map((cell) => Number(cell.value || 0))]),
  );

  const grossMarginRows = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => {
    const revenueValues = revenueByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
    const costValues = costByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
    const values = YEAR_HEADERS.map((_, yearIndex) => round(revenueValues[yearIndex] - costValues[yearIndex], 12));

    return {
      ...persona,
      rowNumber: 36 + index,
      values: buildYearCells(values, "currency0"),
    };
  });

  const grossMarginByPersona = Object.fromEntries(
    grossMarginRows.map((row) => [row.key, row.values.map((cell) => Number(cell.value || 0))]),
  );

  const grossMarginPctRows = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => {
    const revenueValues = revenueByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
    const grossMarginValues = grossMarginByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
    const values = YEAR_HEADERS.map((_, yearIndex) => {
      const revenueValue = revenueValues[yearIndex] || 0;
      return revenueValue > 0 ? round(grossMarginValues[yearIndex] / revenueValue, 12) : 0;
    });

    return {
      ...persona,
      rowNumber: 43 + index,
      values: buildYearCells(values, "percent1"),
    };
  });

  const grossMarginPctByPersona = Object.fromEntries(
    grossMarginPctRows.map((row) => [row.key, row.values.map((cell) => Number(cell.value || 0))]),
  );

  const investmentByPersona = Object.fromEntries(
    FPA_PERSONA_LIBRARY_COLUMNS.map((persona) => {
      const transitionCost = Number(transitionCostByPersona[persona.key] || 0);
      const transformationBuild = Number(transformationBuildByPersona[persona.key] || 0);
      const value = round(
        (transitionCommercials === "Provider-funded" ? transitionCost : 0)
          + (["Provider-funded", "Gainshare-funded"].includes(transformationFunding) ? transformationBuild : 0),
        12,
      );
      return [persona.key, value];
    }),
  );

  const investmentRow = {
    key: "investment",
    rowNumber: 51,
    label: "Investment (provider-carried)",
    values: buildPersonaSummaryCells(investmentByPersona, personaHeaders, "currency0"),
  };

  const cumulativeCashRows = FPA_PERSONA_LIBRARY_COLUMNS.map((persona, index) => {
    const grossMarginValues = grossMarginByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
    const investment = Number(investmentByPersona[persona.key] || 0);
    const values = [];

    for (let yearIndex = 0; yearIndex < YEAR_HEADERS.length; yearIndex += 1) {
      if (yearIndex === 0) {
        values[yearIndex] = round((grossMarginValues[0] * inTermMaskValues[0]) - investment, 12);
      } else {
        values[yearIndex] = round(
          (values[yearIndex - 1] || 0) + (grossMarginValues[yearIndex] * inTermMaskValues[yearIndex]),
          12,
        );
      }
    }

    return {
      ...persona,
      rowNumber: 53 + index,
      label: `${persona.label} - cumulative net cash`,
      values: buildYearCells(values, "currency0"),
    };
  });

  const cumulativeCashByPersona = Object.fromEntries(
    cumulativeCashRows.map((row) => [row.key, row.values.map((cell) => Number(cell.value || 0))]),
  );

  const minGmY2InTermByPersona = Object.fromEntries(
    FPA_PERSONA_LIBRARY_COLUMNS.map((persona) => {
      const gmPctValues = grossMarginPctByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
      const inTermY2Plus = gmPctValues.filter((_, yearIndex) => yearIndex > 0 && inTermMaskValues[yearIndex] === 1);
      return [persona.key, round(inTermY2Plus.length > 0 ? Math.min(...inTermY2Plus) : 0, 12)];
    }),
  );

  const minGmY2InTermRow = {
    key: "minGmY2InTerm",
    rowNumber: 60,
    label: "Min GM % (Y2+ in-term)",
    values: buildPersonaSummaryCells(minGmY2InTermByPersona, personaHeaders, "percent1"),
  };

  const termSummaryByPersona = Object.fromEntries(
    FPA_PERSONA_LIBRARY_COLUMNS.map((persona) => {
      const revenueValues = revenueByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
      const costValues = costByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
      const grossMarginValues = grossMarginByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
      const cumulativeCashValues = cumulativeCashByPersona[persona.key] || YEAR_HEADERS.map(() => 0);
      const investment = Number(investmentByPersona[persona.key] || 0);

      const tcv = round(
        revenueValues.reduce((sum, value, yearIndex) => sum + (value * inTermMaskValues[yearIndex]), 0),
        12,
      );
      const grossMarginTerm = round(
        grossMarginValues.reduce((sum, value, yearIndex) => sum + (value * inTermMaskValues[yearIndex]), 0),
        12,
      );
      const npvRevenue = round(
        revenueValues.reduce(
          (sum, value, yearIndex) => sum + (value * inTermMaskValues[yearIndex] * discountFactorValues[yearIndex]),
          0,
        ),
        12,
      );
      const npvCost = round(
        costValues.reduce(
          (sum, value, yearIndex) => sum + (value * inTermMaskValues[yearIndex] * discountFactorValues[yearIndex]),
          0,
        ),
        12,
      );
      const paybackYear = cumulativeCashValues.findIndex((value) => value > 0);

      return [persona.key, {
        tcv,
        acv: contractTermYears > 0 ? round(tcv / contractTermYears, 12) : 0,
        grossMarginTerm,
        npvRevenue,
        npvCost,
        npv: round(npvRevenue - npvCost - investment, 12),
        payback: paybackYear >= 0 ? paybackYear + 1 : ">term",
        avgGmPct: tcv > 0 ? round(grossMarginTerm / tcv, 12) : 0,
        cumulativeNetCashTerm: cumulativeCashValues[contractTermYears - 1] || 0,
        investment,
        minGmY2InTerm: Number(minGmY2InTermByPersona[persona.key] || 0),
      }];
    }),
  );

  const termSummaryRows = TERM_SUMMARY_ROW_DEFS.map((definition) => ({
    ...definition,
    values: buildPersonaSummaryCells(
      Object.fromEntries(
        personaHeaders.map((persona) => [persona.key, termSummaryByPersona[persona.key]?.[definition.key] ?? 0]),
      ),
      personaHeaders,
      definition.format,
    ),
  }));

  const selectedSummary = termSummaryByPersona[selectedHeader.key] || termSummaryByPersona.standard || termSummaryByPersona.conservative;
  const recommendedSummary = termSummaryByPersona[recommendedHeader.key] || selectedSummary;

  const selectedPersona = {
    ...selectedHeader,
    summary: selectedSummary,
    detailRows: DETAIL_ROW_DEFS.map((definition) => {
      const sourceValues = definition.key === "revenue"
        ? revenueByPersona[selectedHeader.key]
        : definition.key === "cost"
          ? costByPersona[selectedHeader.key]
          : definition.key === "grossMargin"
            ? grossMarginByPersona[selectedHeader.key]
            : definition.key === "grossMarginPct"
              ? grossMarginPctByPersona[selectedHeader.key]
              : cumulativeCashByPersona[selectedHeader.key];

      return {
        ...definition,
        values: buildYearCells(sourceValues || YEAR_HEADERS.map(() => 0), definition.format),
      };
    }),
  };

  const recommendedPersona = {
    ...recommendedHeader,
    summary: recommendedSummary,
  };

  const personaCards = personaHeaders.map((persona) => ({
    ...persona,
    summary: termSummaryByPersona[persona.key],
  }));

  return {
    ...FPA_BUSINESS_CASE_SNAPSHOT,
    personaHeaders,
    yearHeaders: YEAR_HEADERS,
    productivityHeaders: PRODUCTIVITY_YEAR_HEADERS,
    contractTermYears,
    discountRate,
    transitionCommercials,
    transformationFunding,
    y1BillingFactor,
    inTermMaskRow,
    discountFactorRow,
    committedProductivityRows,
    annualChargeRows,
    revenueRows,
    costRows,
    grossMarginRows,
    grossMarginPctRows,
    investmentSummaryRows: [investmentRow, minGmY2InTermRow],
    cumulativeCashRows,
    termSummaryRows,
    selectedPersona,
    recommendedPersona,
    personaCards,
  };
}

