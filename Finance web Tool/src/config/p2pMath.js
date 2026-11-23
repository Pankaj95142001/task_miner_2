const WHOLE_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ONE_DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const CURRENCY_WHOLE_FORMATTER = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const CURRENCY_ONE_DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function trimText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

export function toNumberOrNull(value) {
  const text = trimText(value).replace(/,/g, "");
  if (!text) {
    return null;
  }

  if (text.endsWith("%")) {
    const numericPercent = Number.parseFloat(text.slice(0, -1));
    return Number.isFinite(numericPercent) ? numericPercent / 100 : null;
  }

  const numeric = Number.parseFloat(text);
  return Number.isFinite(numeric) ? numeric : null;
}

export function toNumber(value, fallback = 0) {
  const numeric = toNumberOrNull(value);
  return numeric === null ? fallback : numeric;
}

export function formatWhole(value) {
  const numeric = toNumberOrNull(value);
  return numeric === null ? "-" : WHOLE_FORMATTER.format(numeric);
}

export function formatOneDecimal(value) {
  const numeric = toNumberOrNull(value);
  return numeric === null ? "-" : ONE_DECIMAL_FORMATTER.format(numeric);
}

export function formatPercent(value, digits = 0) {
  const numeric = toNumberOrNull(value);
  return numeric === null ? "-" : `${(numeric * 100).toFixed(digits)}%`;
}

export function formatCurrency(value, digits = 0) {
  const numeric = toNumberOrNull(value);
  if (numeric === null) {
    return "-";
  }

  return digits > 0 ? CURRENCY_ONE_DECIMAL_FORMATTER.format(numeric) : CURRENCY_WHOLE_FORMATTER.format(numeric);
}

export function average(values = []) {
  const numerics = values
    .map((value) => toNumberOrNull(value))
    .filter((value) => value !== null);

  if (!numerics.length) {
    return 0;
  }

  return numerics.reduce((sum, value) => sum + value, 0) / numerics.length;
}

export function sum(values = []) {
  return values.reduce((total, value) => total + toNumber(value, 0), 0);
}

export function completionRatio(filled, total) {
  if (!total) {
    return 0;
  }

  return clamp(filled / total, 0, 1);
}
