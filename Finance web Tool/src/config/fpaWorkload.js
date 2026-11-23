import { buildFpaBenchmarkWorkbookView } from "./fpaBenchmarks";
import { deriveFpaDiscoveryMetrics } from "./fpaDiscovery";
import { deriveFpaScopeMetrics } from "./fpaScope";
import workbookSnapshot from "./fpaWorkloadWorkbookSnapshot";

const INPUT_STYLE_IDS = new Set([22, 27, 30, 60, 63, 80]);
const TEXT_STYLE_IDS = new Set([1, 2, 3, 5, 6, 15]);
const PERCENT_STYLE_IDS = new Set([31, 34, 63]);
const WORKLOAD_TEXT_REPLACEMENTS = [
  ["05. Workload Engine €” FP&A driver-based sizing with method auto-selection & customer-FTE reconciliation", "05. Workload Engine — FP&A driver-based sizing with method auto-selection & customer-FTE reconciliation"],
  ["Data / integration multiplier (02 €°D)", "Data / integration multiplier (02 §D)"],
  ["D €” proxy-driver", "D — proxy-driver"],
  ["A €” customer", "A — customer"],
  ["E €” band", "E — band"],
  ["TOTAL €” In-Scope Monthly Hours", "TOTAL — In-Scope Monthly Hours"],
  ["C. Customer-FTE Reconciliation €” decompose shared FTE into transferred hours (Method A source)", "C. Customer-FTE Reconciliation — decompose shared FTE into transferred hours (Method A source)"],
  ["AMBER €” outside typical 10-35% outsourced share", "AMBER — outside typical 10-35% outsourced share"],
  ["GREEN €” plausible share", "GREEN — plausible share"],
  ["Σ decomposition FTE", "Σ decomposition FTE"],
  ["n/a €” no typed total", "n/a — no typed total"],
  ["OK €” ties", "OK — ties"],
  ["AMBER €” decomposition differs from total by >5%", "AMBER — decomposition differs from total by >5%"],
  ["RED €” A vs D >40%", "RED — A vs D >40%"],
  ["AMBER €” A vs D >30%", "AMBER — A vs D >30%"],
  ["RED €” investigate A-vs-D variances before pricing", "RED — investigate A-vs-D variances before pricing"],
  ["AMBER €” tie-out gap; confirm decomposition", "AMBER — tie-out gap; confirm decomposition"],
  ["GREEN €” customer actuals reconcile", "GREEN — customer actuals reconcile"],
  ["NOT APPLICABLE €” no customer FTE shared", "NOT APPLICABLE — no customer FTE shared"],
  ["-", "—"],
];
const BAND_COLUMNS = ["C", "D", "E", "F"];
const MATRIX_COLUMNS = ["C", "D", "E", "F", "G"];
const WORKLOAD_PROCESS_ROWS = [
  {
    row: 14,
    reconciliationRow: 44,
    l2Id: "strategicLongRangePlanning",
    benchmarkBandRow: 24,
    benchmarkMatrixRow: 96,
    rawDriverField: "businessUnits",
    computeDriver: ({ benchmark, discovery, percentileFactor }) => (benchmark("C68") + (benchmark("D68") * discovery.businessUnits)) * percentileFactor,
  },
  {
    row: 15,
    reconciliationRow: 45,
    l2Id: "budgetingPlanning",
    benchmarkBandRow: 25,
    benchmarkMatrixRow: 97,
    rawDriverField: "businessUnits",
    computeDriver: ({ benchmark, discovery, percentileFactor }) => (((discovery.businessUnits * discovery.planningIterationsPerBudget * benchmark("C69")) / 12) * benchmark("D69")) * percentileFactor,
  },
  {
    row: 16,
    reconciliationRow: 46,
    l2Id: "rollingForecastingIbp",
    benchmarkBandRow: 26,
    benchmarkMatrixRow: 98,
    rawDriverField: "businessUnits",
    computeDriver: ({ benchmark, discovery, percentileFactor, forecastCyclesPerYear }) => ((discovery.businessUnits * (forecastCyclesPerYear / 12) * benchmark("C70")) * (1 + (benchmark("D70") * (discovery.forecastVersionsMaintained - 1)))) * percentileFactor,
  },
  {
    row: 17,
    reconciliationRow: 47,
    l2Id: "commercialForecasting",
    benchmarkBandRow: 27,
    benchmarkMatrixRow: 99,
    rawDriverField: "businessUnits",
    computeDriver: ({ benchmark, discovery, percentileFactor }) => discovery.businessUnits * benchmark("C71") * percentileFactor,
  },
  {
    row: 18,
    reconciliationRow: 48,
    l2Id: "costProductivityMarginManagement",
    benchmarkBandRow: 28,
    benchmarkMatrixRow: 100,
    rawDriverField: "costCentres",
    computeDriver: ({ benchmark, discovery, percentileFactor }) => (benchmark("C72") + (benchmark("D72") * discovery.costCentres)) * percentileFactor,
  },
  {
    row: 19,
    reconciliationRow: 49,
    l2Id: "workforceCapacityPlanning",
    benchmarkBandRow: 29,
    benchmarkMatrixRow: 101,
    rawDriverField: "employeeCount000",
    computeDriver: ({ benchmark, discovery, percentileFactor }) => benchmark("C73") * discovery.employeeCount000 * percentileFactor,
  },
  {
    row: 20,
    reconciliationRow: 50,
    l2Id: "cashFlowCapitalPlanning",
    benchmarkBandRow: 30,
    benchmarkMatrixRow: 102,
    rawDriverField: "geoCountries",
    computeDriver: ({ benchmark, discovery, percentileFactor }) => ((benchmark("C74") * discovery.geoCountries) + benchmark("D74")) * percentileFactor,
  },
  {
    row: 21,
    reconciliationRow: 51,
    l2Id: "variancePerformanceManagement",
    benchmarkBandRow: 31,
    benchmarkMatrixRow: 103,
    rawDriverField: "businessUnits",
    computeDriver: ({ benchmark, discovery, percentileFactor }) => discovery.businessUnits * benchmark("C75") * percentileFactor,
  },
  {
    row: 22,
    reconciliationRow: 52,
    l2Id: "managementReportingDecisionSupport",
    benchmarkBandRow: 32,
    benchmarkMatrixRow: 104,
    rawDriverField: "reportPacksPerMonth",
    computeDriver: ({ benchmark, discovery, percentileFactor, complexityMultiplier, adhocAllowancePct }) => discovery.reportPacksPerMonth * benchmark("C76") * complexityMultiplier * (1 + adhocAllowancePct) * percentileFactor,
  },
  {
    row: 23,
    reconciliationRow: 53,
    l2Id: "scenarioRiskModeling",
    benchmarkBandRow: 33,
    benchmarkMatrixRow: 105,
    rawDriverField: "",
    computeDriver: () => Number.NaN,
  },
  {
    row: 24,
    reconciliationRow: 54,
    l2Id: "profitabilityPricingBusinessCases",
    benchmarkBandRow: 34,
    benchmarkMatrixRow: 106,
    rawDriverField: "productServiceLines",
    computeDriver: ({ benchmark, discovery, percentileFactor }) => (benchmark("C78") + (benchmark("D78") * discovery.productServiceLines)) * percentileFactor,
  },
  {
    row: 25,
    reconciliationRow: 55,
    l2Id: "governanceMasterDataBusinessPartnering",
    benchmarkBandRow: 35,
    benchmarkMatrixRow: 107,
    rawDriverField: "businessUnits",
    computeDriver: ({ benchmark, discovery, percentileFactor }) => ((benchmark("C79") * discovery.businessUnits) + (benchmark("D79") * discovery.geoCountries) + benchmark("E79")) * percentileFactor,
  },
];

function trimTrailingZeros(text) {
  if (!text.includes(".")) {
    return text;
  }

  return text.replace(/0+$/u, "").replace(/\.$/u, "");
}

function sanitizeWorkloadText(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  return WORKLOAD_TEXT_REPLACEMENTS.reduce(
    (result, [from, to]) => result.replaceAll(from, to),
    value,
  );
}

function deriveRevenueBand(annualRevenueUsdB) {
  const safeRevenueBillions = Number.isFinite(annualRevenueUsdB) && annualRevenueUsdB > 0 ? annualRevenueUsdB : 5;

  if (safeRevenueBillions < 5) {
    return "Small ($1-5B)";
  }

  if (safeRevenueBillions < 10) {
    return "Mid ($5-10B)";
  }

  if (safeRevenueBillions < 25) {
    return "Large ($10-25B)";
  }

  return "Mega ($25B+)";
}

function getBandIndex(revenueBand) {
  switch (revenueBand) {
    case "Small ($1-5B)":
      return 1;
    case "Mid ($5-10B)":
      return 2;
    case "Large ($10-25B)":
      return 3;
    default:
      return 4;
  }
}

function isPercentCell(cell) {
  return PERCENT_STYLE_IDS.has(cell?.styleId) || [9, 164].includes(cell?.numFmtId);
}

function isTextualCell(cell) {
  return TEXT_STYLE_IDS.has(cell?.styleId) || cell?.kind === "input-text" || cell?.kind === "input-select";
}

function isNumericKind(kind) {
  return kind.startsWith("input-") && kind !== "input-text" && kind !== "input-select"
    || kind.startsWith("formula-");
}

function inferCellKind(cell) {
  switch (cell.styleId) {
    case 1:
      return "title";
    case 2:
      return "note";
    case 3:
      return "section-title";
    case 4:
      return "section-fill";
    case 5:
      return "header";
    case 6:
      return "total-label";
    case 22:
      return cell.column === "J" ? "input-text" : "input-override";
    case 27:
      return "input-select";
    case 30:
      return "input-whole";
    case 60:
      return "input-one-decimal";
    case 63:
      return "input-percent";
    case 80:
      return "input-decimal";
    case 31:
      return "formula-percent-one";
    case 32:
      return "formula-one-decimal";
    case 33:
      return "formula-whole";
    case 34:
      return "formula-percent";
    case 37:
      return "formula-highlight-whole";
    case 39:
      return "formula-highlight-text";
    case 44:
      return "formula-decimal";
    case 45:
      return "formula-three-decimal";
    case 78:
      return "formula-one-decimal-grouped";
    case 79:
      return "formula-highlight-decimal";
    default:
      return cell.hasFormula ? "formula-text" : cell.styleId === 0 ? "blank" : "label";
  }
}

function formatNumericByStyle(value, styleId, numFmtId) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  switch (numFmtId) {
    case 164:
      return `${trimTrailingZeros((numeric * 100).toFixed(1))}%`;
    case 173:
      return numeric.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case 168:
      return trimTrailingZeros(numeric.toFixed(3));
    case 166:
      return trimTrailingZeros(numeric.toFixed(1));
    case 9:
      return `${Math.round(numeric * 100)}%`;
    case 3:
      return Math.round(numeric).toLocaleString("en-US", { maximumFractionDigits: 0 });
    case 2:
      return trimTrailingZeros(numeric.toFixed(2));
    case 1:
      return `${Math.round(numeric)}`;
    default:
      if (styleId === 22) {
        return trimTrailingZeros(`${numeric}`);
      }
      return Number.isInteger(numeric) ? `${numeric}` : trimTrailingZeros(`${numeric}`);
  }
}

function parseCellNumber(cell, rawValue, fallback = Number.NaN) {
  const text = String(rawValue ?? "").trim();
  if (!text) {
    return fallback;
  }

  if (text.endsWith("%")) {
    const numericPercent = Number(text.slice(0, -1).replace(/,/g, "").trim());
    return Number.isFinite(numericPercent) ? numericPercent / 100 : fallback;
  }

  const numeric = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (isPercentCell(cell) && Math.abs(numeric) > 1) {
    return numeric / 100;
  }

  return numeric;
}

function hasNumericValue(value) {
  return Number.isFinite(Number(String(value ?? "").replace(/,/g, "")));
}

function normalizeYesNo(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (["yes", "y", "true"].includes(normalized)) {
    return "Yes";
  }
  if (["no", "n", "false"].includes(normalized)) {
    return "No";
  }
  return String(value ?? "").trim();
}

function createBlankCell(address, column, row) {
  return {
    address,
    column,
    row,
    styleId: 0,
    numFmtId: 0,
    kind: "blank",
    raw: "",
    text: "",
    formula: null,
    hasFormula: false,
    isInput: false,
  };
}

function sanitizeCell(cell) {
  const kind = inferCellKind(cell);
  const nextCell = {
    ...cell,
    kind,
    raw: sanitizeWorkloadText(cell.raw),
    text: sanitizeWorkloadText(cell.text),
  };

  if (!isTextualCell(nextCell)) {
    const numeric = parseCellNumber(nextCell, nextCell.raw, Number.NaN);
    if (Number.isFinite(numeric)) {
      nextCell.text = formatNumericByStyle(numeric, nextCell.styleId, nextCell.numFmtId);
    }
  }

  return nextCell;
}

function createWorkingCellMap(workbookInputs = {}) {
  return Object.fromEntries(
    Object.entries(workbookSnapshot.cells).map(([address, cell]) => {
      const nextCell = sanitizeCell({
        ...cell,
        isInput: INPUT_STYLE_IDS.has(cell.styleId),
      });

      if (nextCell.isInput && Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
        const overrideValue = String(workbookInputs[address] ?? "");
        nextCell.raw = sanitizeWorkloadText(overrideValue);
        nextCell.text = sanitizeWorkloadText(overrideValue);

        if (!isTextualCell(nextCell)) {
          const numericOverride = parseCellNumber(nextCell, overrideValue, Number.NaN);
          nextCell.text = Number.isFinite(numericOverride)
            ? formatNumericByStyle(numericOverride, nextCell.styleId, nextCell.numFmtId)
            : sanitizeWorkloadText(overrideValue);
        }
      }

      return [address, nextCell];
    }),
  );
}

function createAddressMapFromRows(rows = []) {
  return Object.fromEntries(rows.flatMap((row) => row.cells.map((cell) => [cell.address, cell])));
}

function setCellValue(cellMap, address, value) {
  const currentCell = cellMap[address];
  if (!currentCell) {
    return;
  }

  if (value === null || value === undefined || Number.isNaN(value)) {
    cellMap[address] = {
      ...currentCell,
      raw: "",
      text: "",
    };
    return;
  }

  if (typeof value === "number") {
    cellMap[address] = {
      ...currentCell,
      raw: `${value}`,
      text: formatNumericByStyle(value, currentCell.styleId, currentCell.numFmtId),
    };
    return;
  }

  const nextText = sanitizeWorkloadText(String(value));
  cellMap[address] = {
    ...currentCell,
    raw: nextText,
    text: nextText,
  };
}

function getCellNumber(cellMap, address, fallback = 0) {
  const cell = cellMap[address];
  if (!cell) {
    return fallback;
  }
  const numeric = parseCellNumber(cell, cell.raw ?? cell.text, Number.NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getCellText(cellMap, address, fallback = "") {
  const cell = cellMap[address];
  if (!cell) {
    return fallback;
  }
  return sanitizeWorkloadText(String(cell.raw ?? cell.text ?? "").trim()) || fallback;
}

function lookupBenchmarkNumber(addressMap, { startRow, endRow, keyColumn = "B", valueColumn = "C", lookupValue, fallback = 0 }) {
  const needle = String(lookupValue ?? "").trim();
  if (!needle) {
    return fallback;
  }

  for (let row = startRow; row <= endRow; row += 1) {
    if (getCellText(addressMap, `${keyColumn}${row}`) === needle) {
      return getCellNumber(addressMap, `${valueColumn}${row}`, fallback);
    }
  }

  return fallback;
}

function benchmarkBandSeed(addressMap, benchmarkBandRow, bandIndex) {
  const column = BAND_COLUMNS[Math.max(0, Math.min(BAND_COLUMNS.length - 1, bandIndex - 1))] || "C";
  return getCellNumber(addressMap, `${column}${benchmarkBandRow}`, 0);
}

function benchmarkMatrixExponent(addressMap, benchmarkMatrixRow, exponentIndex) {
  const column = MATRIX_COLUMNS[Math.max(0, Math.min(MATRIX_COLUMNS.length - 1, exponentIndex - 1))] || "C";
  return getCellNumber(addressMap, `${column}${benchmarkMatrixRow}`, 0);
}

function round(value, digits = 10) {
  if (!Number.isFinite(value)) {
    return value;
  }
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeWorkloadInputValue(cell, value) {
  const nextValue = String(value ?? "").trim();
  if (!nextValue) {
    return "";
  }

  if (cell?.kind === "input-select") {
    return normalizeYesNo(nextValue);
  }

  if (isTextualCell(cell)) {
    return sanitizeWorkloadText(nextValue);
  }

  const numeric = parseCellNumber(cell, nextValue, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return sanitizeWorkloadText(nextValue);
  }

  return formatNumericByStyle(numeric, cell?.styleId || 0, cell?.numFmtId || 0);
}

export function buildFpaWorkloadWorkbookView(workbookInputs = {}, benchmarkInputs = {}, workspace = {}, currentDeal = {}) {
  const cellMap = createWorkingCellMap(workbookInputs);
  const discoveryMetrics = deriveFpaDiscoveryMetrics(workspace);
  const discovery = discoveryMetrics.discovery;
  const effectiveDiscovery = discoveryMetrics.effectiveDiscovery;
  const scopeMetrics = deriveFpaScopeMetrics(workspace?.scopeL3, workspace?.scopeL2);
  const scopePctByL2Id = Object.fromEntries(scopeMetrics.l2RollupRows.map((row) => [row.id, row.scopePct]));
  const benchmarkView = buildFpaBenchmarkWorkbookView(benchmarkInputs, effectiveDiscovery);
  const benchmarkCellMap = createAddressMapFromRows(benchmarkView.rows);

  const revenueBand = deriveRevenueBand(Number(effectiveDiscovery.annualRevenueUsdM || 0));
  const bandIndex = getBandIndex(revenueBand);
  const benchmarkPercentilePolicy = String(currentDeal?.benchmarkPolicy || "Auto").trim();

  const complexityMultiplier = lookupBenchmarkNumber(benchmarkCellMap, { startRow: 6, endRow: 13, valueColumn: "D", lookupValue: effectiveDiscovery.industryVertical, fallback: 1 });
  const volumeMultiplier = lookupBenchmarkNumber(benchmarkCellMap, { startRow: 6, endRow: 13, valueColumn: "C", lookupValue: effectiveDiscovery.industryVertical, fallback: 1 });
  const primaryPlatformAdjustment = lookupBenchmarkNumber(benchmarkCellMap, { startRow: 56, endRow: 64, lookupValue: effectiveDiscovery.epmPlatform, fallback: 1 });
  const closeAdjustment = lookupBenchmarkNumber(benchmarkCellMap, { startRow: 48, endRow: 51, lookupValue: effectiveDiscovery.monthlyCloseComplexity, fallback: 1 });
  const percentileFactor = benchmarkPercentilePolicy === "P25"
    ? getCellNumber(benchmarkCellMap, "C81", 1)
    : benchmarkPercentilePolicy === "P75"
      ? getCellNumber(benchmarkCellMap, "D81", 1)
      : 1;
  const forecastCyclesPerYear = lookupBenchmarkNumber(benchmarkCellMap, { startRow: 84, endRow: 87, lookupValue: effectiveDiscovery.forecastCadence, fallback: 12 });
  const adhocAllowancePct = lookupBenchmarkNumber(benchmarkCellMap, { startRow: 90, endRow: 92, lookupValue: effectiveDiscovery.adhocAnalysisIntensity, fallback: 0.25 });
  const dataIntegrationMultiplier = Number(discoveryMetrics.techEffortMultiplier || 1);
  const normalizationFactor = Number(discoveryMetrics.techMaturityNormalization || 1);
  const customerHoursPerFte = getCellNumber(benchmarkCellMap, "C159", 147);
  const peakMonthFactor = getCellNumber(benchmarkCellMap, "C114", 1);
  const productiveHoursProxy = getCellNumber(benchmarkCellMap, "C120", 147);
  const redVarianceThreshold = getCellNumber(benchmarkCellMap, "C160", 0.4);
  const amberVarianceThreshold = getCellNumber(benchmarkCellMap, "C161", 0.3);
  const driverBandThreshold = getCellNumber(benchmarkCellMap, "C162", 0.4);

  setCellValue(cellMap, "C5", revenueBand);
  setCellValue(cellMap, "F5", bandIndex);
  setCellValue(cellMap, "C6", complexityMultiplier);
  setCellValue(cellMap, "F6", volumeMultiplier);
  setCellValue(cellMap, "C7", primaryPlatformAdjustment);
  setCellValue(cellMap, "F7", closeAdjustment);
  setCellValue(cellMap, "C8", percentileFactor);
  setCellValue(cellMap, "C9", forecastCyclesPerYear);
  setCellValue(cellMap, "C10", adhocAllowancePct);
  setCellValue(cellMap, "C11", dataIntegrationMultiplier);
  setCellValue(cellMap, "F11", normalizationFactor);

  const sharedCustomerFte = normalizeYesNo(getCellText(cellMap, "C40", "Yes"));
  const typedTotalCustomerFte = parseCellNumber(cellMap.C41, cellMap.C41?.raw ?? cellMap.C41?.text, Number.NaN);
  const defaultRetainedShare = parseCellNumber(cellMap.C42, cellMap.C42?.raw ?? cellMap.C42?.text, 0);

  const processRows = WORKLOAD_PROCESS_ROWS.map((definition) => {
    const driverHours = round(definition.computeDriver({
      benchmark: (address, fallback = 0) => getCellNumber(benchmarkCellMap, address, fallback),
      discovery: effectiveDiscovery,
      percentileFactor,
      forecastCyclesPerYear,
      complexityMultiplier,
      adhocAllowancePct,
    }), 12);
    const bandSeed = benchmarkBandSeed(benchmarkCellMap, definition.benchmarkBandRow, bandIndex);
    const rawDriverPresent = definition.rawDriverField ? hasNumericValue(discovery[definition.rawDriverField]) : false;
    const customerFteInput = parseCellNumber(cellMap[`C${definition.reconciliationRow}`], cellMap[`C${definition.reconciliationRow}`]?.raw ?? cellMap[`C${definition.reconciliationRow}`]?.text, Number.NaN);
    const directHoursInput = parseCellNumber(cellMap[`D${definition.reconciliationRow}`], cellMap[`D${definition.reconciliationRow}`]?.raw ?? cellMap[`D${definition.reconciliationRow}`]?.text, Number.NaN);
    const retainedShareInput = parseCellNumber(cellMap[`E${definition.reconciliationRow}`], cellMap[`E${definition.reconciliationRow}`]?.raw ?? cellMap[`E${definition.reconciliationRow}`]?.text, Number.NaN);
    const retainedShare = Number.isFinite(retainedShareInput) ? retainedShareInput : defaultRetainedShare;
    const hoursFromFte = Number.isFinite(customerFteInput) ? round(customerFteInput * customerHoursPerFte, 12) : Number.NaN;
    const driverHoursForReconciliation = Number.isFinite(driverHours) ? driverHours : bandSeed;
    const transferredHours = sharedCustomerFte !== "Yes"
      ? Number.NaN
      : Number.isFinite(directHoursInput)
        ? round(directHoursInput * (1 - retainedShare), 12)
        : Number.isFinite(hoursFromFte)
          ? round(hoursFromFte * (1 - retainedShare), 12)
          : Number.NaN;
    const methodCustomerHours = Number.isFinite(transferredHours) ? transferredHours : Number.NaN;
    const methodLabel = Number.isFinite(methodCustomerHours)
      ? "A — customer"
      : rawDriverPresent
        ? "D — proxy-driver"
        : "E — band";
    const selectedPreAdjustment = Number.isFinite(methodCustomerHours)
      ? methodCustomerHours
      : rawDriverPresent
        ? driverHours
        : bandSeed;
    const confidenceLabel = Number.isFinite(methodCustomerHours)
      ? "CC/CE"
      : rawDriverPresent
        ? "CE-driver"
        : "BM-band";
    const driverVsBand = Number.isFinite(driverHours) && Number.isFinite(bandSeed) && bandSeed > 0
      ? Math.abs(driverHours - bandSeed) / bandSeed > driverBandThreshold
        ? "AMBER >40%"
        : "OK"
      : "—";
    const complexityExponent = benchmarkMatrixExponent(benchmarkCellMap, definition.benchmarkMatrixRow, 4);
    const platformExponent = benchmarkMatrixExponent(benchmarkCellMap, definition.benchmarkMatrixRow, 1);
    const closeExponent = benchmarkMatrixExponent(benchmarkCellMap, definition.benchmarkMatrixRow, 2);
    const volumeExponent = benchmarkMatrixExponent(benchmarkCellMap, definition.benchmarkMatrixRow, 3);
    const dataExponent = benchmarkMatrixExponent(benchmarkCellMap, definition.benchmarkMatrixRow, 5);
    const adjustedHours = Number.isFinite(methodCustomerHours)
      ? round(selectedPreAdjustment * normalizationFactor, 12)
      : round(
          selectedPreAdjustment
          * (complexityMultiplier ** complexityExponent)
          * (primaryPlatformAdjustment ** platformExponent)
          * (closeAdjustment ** closeExponent)
          * (volumeMultiplier ** volumeExponent)
          * (dataIntegrationMultiplier ** dataExponent),
          12,
        );
    const scopedHours = round(adjustedHours * (scopePctByL2Id[definition.l2Id] || 0), 12);
    const overrideValue = parseCellNumber(cellMap[`I${definition.row}`], cellMap[`I${definition.row}`]?.raw ?? cellMap[`I${definition.row}`]?.text, Number.NaN);
    const finalHours = Number.isFinite(overrideValue) ? overrideValue : scopedHours;
    const variancePct = Number.isFinite(transferredHours) && driverHoursForReconciliation > 0
      ? round((transferredHours / driverHoursForReconciliation) - 1, 12)
      : Number.NaN;
    const varianceFlag = Number.isFinite(variancePct)
      ? Math.abs(variancePct) > redVarianceThreshold
        ? "RED — A vs D >40%"
        : Math.abs(variancePct) > amberVarianceThreshold
          ? "AMBER — A vs D >30%"
          : "OK"
      : "—";

    return {
      ...definition,
      driverHours,
      bandSeed,
      rawDriverPresent,
      customerFteInput,
      directHoursInput,
      retainedShare,
      hoursFromFte,
      transferredHours,
      methodLabel,
      selectedPreAdjustment,
      confidenceLabel,
      driverVsBand,
      adjustedHours,
      scopedHours,
      overrideValue,
      finalHours,
      driverHoursForReconciliation,
      variancePct,
      varianceFlag,
      noteText: getCellText(cellMap, `J${definition.row}`, ""),
    };
  });

  processRows.forEach((row) => {
    setCellValue(cellMap, `C${row.row}`, Number.isFinite(row.driverHours) ? row.driverHours : null);
    setCellValue(cellMap, `D${row.row}`, Number.isFinite(row.bandSeed) ? row.bandSeed : null);
    setCellValue(cellMap, `E${row.row}`, Number.isFinite(row.transferredHours) ? row.transferredHours : null);
    setCellValue(cellMap, `F${row.row}`, row.methodLabel);
    setCellValue(cellMap, `G${row.row}`, Number.isFinite(row.adjustedHours) ? row.adjustedHours : null);
    setCellValue(cellMap, `H${row.row}`, Number.isFinite(row.scopedHours) ? row.scopedHours : null);
    setCellValue(cellMap, `K${row.row}`, Number.isFinite(row.finalHours) ? row.finalHours : null);
    setCellValue(cellMap, `L${row.row}`, row.confidenceLabel);
    setCellValue(cellMap, `M${row.row}`, row.driverVsBand);
    setCellValue(cellMap, `N${row.row}`, Number.isFinite(row.selectedPreAdjustment) ? row.selectedPreAdjustment : null);

    setCellValue(cellMap, `F${row.reconciliationRow}`, Number.isFinite(row.hoursFromFte) ? row.hoursFromFte : null);
    setCellValue(cellMap, `G${row.reconciliationRow}`, Number.isFinite(row.transferredHours) ? row.transferredHours : null);
    setCellValue(cellMap, `H${row.reconciliationRow}`, Number.isFinite(row.driverHoursForReconciliation) ? row.driverHoursForReconciliation : null);
    setCellValue(cellMap, `I${row.reconciliationRow}`, Number.isFinite(row.variancePct) ? row.variancePct : null);
    setCellValue(cellMap, `M${row.reconciliationRow}`, row.varianceFlag);
  });

  const methodCounts = {
    A: processRows.filter((row) => row.methodLabel.startsWith("A")).length,
    D: processRows.filter((row) => row.methodLabel.startsWith("D")).length,
    E: processRows.filter((row) => row.methodLabel.startsWith("E")).length,
  };
  const overrideWithoutNoteCount = processRows.filter((row) => Number.isFinite(row.overrideValue) && !String(row.noteText || "").trim()).length;
  const totalMonthlyHours = round(processRows.reduce((sum, row) => sum + (Number.isFinite(row.finalHours) ? row.finalHours : 0), 0), 12);
  const annualHours = round(totalMonthlyHours * 12, 12);
  const peakMonthHours = round(totalMonthlyHours * peakMonthFactor, 12);
  const impliedBlindFte = productiveHoursProxy > 0 ? round(totalMonthlyHours / productiveHoursProxy, 12) : 0;
  const customerTowerStaff = Number(effectiveDiscovery.currentTowerStaff || 0);
  const impliedShareOfOrg = customerTowerStaff > 0 ? round(impliedBlindFte / customerTowerStaff, 12) : 0;
  const decompositionFte = round(processRows.reduce((sum, row) => sum + (Number.isFinite(row.customerFteInput) ? row.customerFteInput : 0), 0), 12);
  const tieOutMessage = !Number.isFinite(typedTotalCustomerFte)
    ? "n/a — no typed total"
    : Math.abs(decompositionFte - typedTotalCustomerFte) / Math.max(0.1, typedTotalCustomerFte) > 0.05
      ? "AMBER — decomposition differs from total by >5%"
      : "OK — ties";
  const redVarianceCount = processRows.filter((row) => row.varianceFlag.startsWith("RED")).length;
  const transferredMethodATotal = round(processRows.reduce((sum, row) => sum + (Number.isFinite(row.transferredHours) ? row.transferredHours : 0), 0), 12);
  const reconciliationVerdict = sharedCustomerFte !== "Yes"
    ? "NOT APPLICABLE — no customer FTE shared"
    : redVarianceCount > 0
      ? "RED — investigate A-vs-D variances before pricing"
      : tieOutMessage.startsWith("AMBER")
        ? "AMBER — tie-out gap; confirm decomposition"
        : "GREEN — customer actuals reconcile";
  const shareStatus = impliedShareOfOrg < 0.1 || impliedShareOfOrg > 0.35
    ? "AMBER — outside typical 10-35% outsourced share"
    : "GREEN — plausible share";

  setCellValue(cellMap, "I11", methodCounts.A > 0 ? "YES" : "NO");
  setCellValue(cellMap, "K26", totalMonthlyHours);
  setCellValue(cellMap, "K27", annualHours);
  setCellValue(cellMap, "K28", peakMonthHours);
  setCellValue(cellMap, "C31", impliedBlindFte);
  setCellValue(cellMap, "C32", customerTowerStaff);
  setCellValue(cellMap, "C33", impliedShareOfOrg);
  setCellValue(cellMap, "D33", shareStatus);
  setCellValue(cellMap, "C35", `${methodCounts.A} A / ${methodCounts.D} D / ${methodCounts.E} E`);
  setCellValue(cellMap, "C36", overrideWithoutNoteCount);
  setCellValue(cellMap, "C56", decompositionFte);
  setCellValue(cellMap, "C57", tieOutMessage);
  setCellValue(cellMap, "C58", redVarianceCount);
  setCellValue(cellMap, "C59", transferredMethodATotal);
  setCellValue(cellMap, "C60", reconciliationVerdict);

  const rows = Array.from({ length: workbookSnapshot.rowCount }, (_, index) => {
    const rowNumber = index + 1;
    const cells = workbookSnapshot.columns.map((column) => {
      const address = `${column.key}${rowNumber}`;
      return cellMap[address] || createBlankCell(address, column.key, rowNumber);
    });

    return {
      index: rowNumber,
      height: workbookSnapshot.rowHeights[String(rowNumber)] || null,
      cells,
    };
  });

  return {
    ...workbookSnapshot,
    rows,
  };
}

export function getWorkloadOverview() {
  return {
    title: sanitizeWorkloadText(workbookSnapshot.cells.A1?.text || "Workload"),
    note: sanitizeWorkloadText(workbookSnapshot.cells.A2?.text || ""),
  };
}

export function workloadCellWidthPx(width = 12) {
  return Math.max(44, Math.round(width * 8));
}

export function workloadRowHeightPx(height) {
  if (!height) {
    return null;
  }

  return Math.max(22, Math.round(height * 1.28));
}

export function isWorkloadNumericCell(cell) {
  return isNumericKind(cell?.kind || "");
}

export { workbookSnapshot as FPA_WORKLOAD_WORKBOOK_SNAPSHOT };
