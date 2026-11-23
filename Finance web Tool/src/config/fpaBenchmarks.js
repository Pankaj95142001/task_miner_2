import workbookSnapshot from "./fpaBenchmarkWorkbookSnapshot";

const INPUT_STYLE_IDS = new Set([70, 71, 72, 73, 74, 75, 76, 77]);
const TEXT_KINDS = new Set([
  "input-text",
  "label",
  "total-label",
  "title",
  "note",
  "footnote",
  "section-title",
  "section-fill",
  "header",
]);
const SEASONALITY_COLUMNS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
const TOTAL_COLUMNS = ["C", "D", "E", "F"];
const BENCHMARK_TEXT_REPLACEMENTS = [
  ["04. Benchmarks & Driver Norms - FP&A ranges, adjustments, calibration tables", "04. Benchmarks & Driver Norms — FP&A ranges, adjustments, calibration tables"],
  ["ALL values directional [PA/BM/MKT] - calibrate before first live use (26 Calibration / 27 Benchmark Pack). Grey = benchmark placeholders.", "ALL values directional [PA/BM/MKT] — calibrate before first live use (26 Calibration / 27 Benchmark Pack). Grey = benchmark placeholders."],
  ["F. Primary Platform Adjustment - EPM Tool in Place", "F. Primary Platform Adjustment — EPM Tool in Place"],
  ["G. Driver Handling-Time Norms (P50) [PA - calibrate to delivery evidence]", "G. Driver Handling-Time Norms (P50) [PA — calibrate to delivery evidence]"],
  ["M. Technology-Stack Multipliers & Data-Readiness Scores (02 -D) [PA]", "M. Technology-Stack Multipliers & Data-Readiness Scores (02 §D) [PA]"],
  ["O. Customer-FTE Conversion & Variance Thresholds (05 -C)", "O. Customer-FTE Conversion & Variance Thresholds (05 §C)"],
  ["Method base - A (customer actuals)", "Method base — A (customer actuals)"],
  ["Method base - D (proxy-driver)", "Method base — D (proxy-driver)"],
  ["Method base - E (band seed)", "Method base — E (band seed)"],
];
const BENCHMARK_LABEL_NORMALIZATIONS = [
  ["Volume Mult", "Volume Multiplier"],
  ["Complexity Mult", "Complexity Multiplier"],
  ["VolMult", "Volume Multiplier"],
  ["CxMult", "Complexity Multiplier"],
  ["DataMult", "Data Multiplier"],
  ["Effort mult", "Effort multiplier"],
];
const MONTH_ALIASES = {
  jan: "Jan",
  january: "Jan",
  feb: "Feb",
  february: "Feb",
  mar: "Mar",
  march: "Mar",
  apr: "Apr",
  april: "Apr",
  may: "May",
  jun: "Jun",
  june: "Jun",
  jul: "Jul",
  july: "Jul",
  aug: "Aug",
  august: "Aug",
  sep: "Sep",
  sept: "Sep",
  september: "Sep",
  oct: "Oct",
  october: "Oct",
  nov: "Nov",
  november: "Nov",
  dec: "Dec",
  december: "Dec",
};

function trimTrailingZeros(text) {
  if (!text.includes(".")) {
    return text;
  }

  return text.replace(/0+$/u, "").replace(/\.$/u, "");
}

function sanitizeBenchmarkText(value) {
  if (typeof value !== "string" || !value) {
    return value;
  }

  return [...BENCHMARK_TEXT_REPLACEMENTS, ...BENCHMARK_LABEL_NORMALIZATIONS].reduce(
    (result, [from, to]) => result.replaceAll(from, to),
    value,
  );
}

function normalizeMonth(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return MONTH_ALIASES[normalized] || "";
}

function columnKeyToIndex(columnKey) {
  return workbookSnapshot.columns.findIndex((column) => column.key === columnKey);
}

function isTextualCell(cell) {
  return TEXT_KINDS.has(cell?.kind);
}

function isPercentCell(cell) {
  return cell?.kind === "input-percent" || cell?.numFmtId === 9;
}

function isNumericKind(kind) {
  return (kind.startsWith("input-") && kind !== "input-text")
    || kind === "formula-total"
    || kind === "formula-decimal"
    || kind === "formula-highlight";
}

function formatNumericByStyle(value, styleId) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  switch (styleId) {
    case 42:
    case 75:
      return Math.round(numeric).toLocaleString("en-US", { maximumFractionDigits: 0 });
    case 44:
    case 69:
    case 70:
      return numeric.toFixed(2);
    case 71:
      return `${Math.round(numeric * 100)}%`;
    case 72:
      return `${Math.round(numeric)}`;
    case 74:
      return numeric.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    case 76:
      return trimTrailingZeros(numeric.toFixed(3));
    case 77:
      return numeric.toFixed(1);
    default:
      return Number.isInteger(numeric) ? `${numeric}` : trimTrailingZeros(`${numeric}`);
  }
}

function parseCellNumber(cell, rawValue, fallback = 0) {
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
  return {
    ...cell,
    raw: sanitizeBenchmarkText(cell.raw),
    text: sanitizeBenchmarkText(cell.text),
  };
}

function createWorkingCellMap(workbookInputs = {}) {
  return Object.fromEntries(
    Object.entries(workbookSnapshot.cells).map(([address, cell]) => {
      const nextCell = {
        ...sanitizeCell(cell),
        isInput: INPUT_STYLE_IDS.has(cell.styleId),
      };

      if (nextCell.isInput && Object.prototype.hasOwnProperty.call(workbookInputs, address)) {
        const overrideValue = String(workbookInputs[address] ?? "");
        nextCell.raw = overrideValue;
        nextCell.text = overrideValue;
      }

      return [address, nextCell];
    }),
  );
}

function setFormulaValue(cellMap, address, value) {
  const currentCell = cellMap[address];
  if (!currentCell) {
    return;
  }

  cellMap[address] = {
    ...currentCell,
    raw: `${value}`,
    text: formatNumericByStyle(value, currentCell.styleId),
  };
}

function isSectionRow(row) {
  return row.cells.some((cell) => cell.column === "A" && cell.kind === "section-title");
}

function isBlankSectionRow(row) {
  return row.cells.every((cell) => cell.styleId === 0 && !String(cell.text || "").trim());
}

function applyBenchmarkFormulas(cellMap, discovery = {}) {
  TOTAL_COLUMNS.forEach((column) => {
    const total = Array.from({ length: 12 }, (_, index) => {
      const row = 24 + index;
      const address = `${column}${row}`;
      return parseCellNumber(cellMap[address], cellMap[address]?.raw, 0);
    }).reduce((sum, value) => sum + value, 0);

    setFormulaValue(cellMap, `${column}36`, total);
  });

  const uplift = parseCellNumber(cellMap.C113, cellMap.C113?.raw, 0);
  const peakMonths = new Set([
    normalizeMonth(discovery?.peakMonth1),
    normalizeMonth(discovery?.peakMonth2),
    normalizeMonth(discovery?.peakMonth3),
  ].filter(Boolean));

  const seasonalValues = SEASONALITY_COLUMNS.map((column) => {
    const monthLabel = normalizeMonth(cellMap[`${column}110`]?.text);
    const nextValue = 1 + (peakMonths.has(monthLabel) ? uplift : 0);
    setFormulaValue(cellMap, `${column}111`, nextValue);
    return nextValue;
  });

  setFormulaValue(cellMap, "C114", seasonalValues.length ? Math.max(...seasonalValues) : 0);
}

export function normalizeBenchmarkInputValue(cell, value) {
  const nextValue = String(value ?? "").trim();
  if (!nextValue) {
    return "";
  }

  if (isTextualCell(cell) || cell?.kind === "input-text") {
    return nextValue;
  }

  const numeric = parseCellNumber(cell, nextValue, Number.NaN);
  if (!Number.isFinite(numeric)) {
    return nextValue;
  }

  return formatNumericByStyle(numeric, cell?.styleId || 0);
}

export function buildFpaBenchmarkWorkbookView(workbookInputs = {}, discovery = {}) {
  const cellMap = createWorkingCellMap(workbookInputs);
  applyBenchmarkFormulas(cellMap, discovery);

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

export function getBenchmarkOverview() {
  return {
    title: sanitizeBenchmarkText(workbookSnapshot.cells.A1?.text || "Benchmarks"),
    note: sanitizeBenchmarkText(workbookSnapshot.cells.A2?.text || ""),
  };
}

export function getFpaBenchmarkSections(workbookView) {
  const sectionRows = workbookView.rows.filter(isSectionRow);

  return sectionRows.map((sectionRow, index) => {
    const titleCell = sectionRow.cells.find((cell) => cell.column === "A" && cell.kind === "section-title");
    const nextSectionStart = sectionRows[index + 1]?.index ?? workbookView.rowCount + 1;
    const contentRows = workbookView.rows.filter((row) => row.index > sectionRow.index && row.index < nextSectionStart);

    let minCellIndex = Number.POSITIVE_INFINITY;
    let maxCellIndex = Number.NEGATIVE_INFINITY;
    let editableCellCount = 0;
    let formulaCellCount = 0;

    contentRows.forEach((row) => {
      row.cells.forEach((cell, cellIndex) => {
        if (cell.isInput) {
          editableCellCount += 1;
        }

        if (cell.hasFormula) {
          formulaCellCount += 1;
        }

        if (cell.styleId !== 0 || String(cell.text || "").trim()) {
          minCellIndex = Math.min(minCellIndex, cellIndex);
          maxCellIndex = Math.max(maxCellIndex, cellIndex);
        }
      });
    });

    if (!Number.isFinite(minCellIndex) || !Number.isFinite(maxCellIndex)) {
      minCellIndex = columnKeyToIndex("B");
      maxCellIndex = columnKeyToIndex("C");
    }

    const trimmedRows = contentRows.map((row) => ({
      ...row,
      cells: row.cells.slice(minCellIndex, maxCellIndex + 1),
    }));

    while (trimmedRows.length && isBlankSectionRow(trimmedRows[0])) {
      trimmedRows.shift();
    }

    while (trimmedRows.length && isBlankSectionRow(trimmedRows[trimmedRows.length - 1])) {
      trimmedRows.pop();
    }

    const fullTitle = sanitizeBenchmarkText(titleCell?.text || "");
    const code = fullTitle.split(".")[0]?.trim() || `${index + 1}`;
    const displayTitle = fullTitle.replace(/^[A-Z]\.?\s*/u, "").trim();

    return {
      id: `benchmark-${code.toLowerCase()}`,
      code,
      fullTitle,
      displayTitle,
      startRow: sectionRow.index,
      contentStartRow: trimmedRows[0]?.index ?? (sectionRow.index + 1),
      endRow: trimmedRows[trimmedRows.length - 1]?.index ?? (nextSectionStart - 1),
      editableCellCount,
      formulaCellCount,
      columns: workbookView.columns.slice(minCellIndex, maxCellIndex + 1),
      rows: trimmedRows,
    };
  });
}

export function benchmarkCellWidthPx(width = 12) {
  return Math.max(44, Math.round(width * 8));
}

export function benchmarkRowHeightPx(height) {
  if (!height) {
    return null;
  }

  return Math.max(22, Math.round(height * 1.28));
}

export function isBenchmarkNumericCell(cell) {
  return isNumericKind(cell?.kind || "");
}

export { workbookSnapshot as FPA_BENCHMARK_WORKBOOK_SNAPSHOT };
