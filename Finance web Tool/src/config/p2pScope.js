import { P2P_SCOPE_L2_ROWS, P2P_SCOPE_L3_ROWS } from "./p2pCatalog";
import { clamp, formatPercent, trimText } from "./p2pMath";

const DEFAULT_SCOPE_ROW = Object.freeze({
  status: "Y",
  partialPct: "1",
  retainedToo: "N",
  disposition: "Transfer",
  locationIntent: "Follow model",
});

export const P2P_SCOPE_STATUS_OPTIONS = ["Y", "Partial", "N"];
export const P2P_SCOPE_RETAINED_OPTIONS = ["Y", "N"];
export const P2P_SCOPE_DISPOSITION_OPTIONS = ["Transfer", "Retain", "Review"];
export const P2P_SCOPE_LOCATION_OPTIONS = ["Follow model", "Retain onshore", "Nearshore first", "Offshore first"];

function cloneDefaultScopeRow() {
  return { ...DEFAULT_SCOPE_ROW };
}

function normalizeScopeRow(value = {}, fallback = cloneDefaultScopeRow()) {
  const candidate = value && typeof value === "object" ? value : {};
  return {
    status: trimText(candidate.status) || fallback.status,
    partialPct: trimText(candidate.partialPct) || fallback.partialPct,
    retainedToo: trimText(candidate.retainedToo) || fallback.retainedToo,
    disposition: trimText(candidate.disposition) || fallback.disposition,
    locationIntent: trimText(candidate.locationIntent) || fallback.locationIntent,
  };
}

export function createDefaultP2pScopeRows() {
  return Object.fromEntries(P2P_SCOPE_L3_ROWS.map((row) => [row.id, cloneDefaultScopeRow()]));
}

export function normalizeP2pScopeRows(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  const normalized = createDefaultP2pScopeRows();

  P2P_SCOPE_L3_ROWS.forEach((row) => {
    normalized[row.id] = normalizeScopeRow(incoming[row.id], normalized[row.id]);
  });

  return normalized;
}

export function deriveP2pScopeFinalPct(value = {}) {
  const normalized = normalizeScopeRow(value, cloneDefaultScopeRow());
  if (normalized.status === "N") {
    return 0;
  }
  if (normalized.status === "Y") {
    return 1;
  }
  const numeric = Number.parseFloat(normalized.partialPct);
  return Number.isFinite(numeric) ? clamp(numeric, 0, 1) : 0;
}

function matchesDefault(row = {}) {
  return row.status === DEFAULT_SCOPE_ROW.status
    && row.partialPct === DEFAULT_SCOPE_ROW.partialPct
    && row.retainedToo === DEFAULT_SCOPE_ROW.retainedToo
    && row.disposition === DEFAULT_SCOPE_ROW.disposition
    && row.locationIntent === DEFAULT_SCOPE_ROW.locationIntent;
}

export function countChangedP2pScopeRows(value = {}) {
  const normalized = normalizeP2pScopeRows(value);
  return Object.values(normalized).filter((row) => !matchesDefault(row)).length;
}

export function deriveP2pScopeMetrics(value = {}) {
  const scope = normalizeP2pScopeRows(value);

  const l3Rows = P2P_SCOPE_L3_ROWS.map((definition, index) => {
    const row = scope[definition.id] || cloneDefaultScopeRow();
    const previous = index > 0 ? P2P_SCOPE_L3_ROWS[index - 1] : null;
    const finalPct = deriveP2pScopeFinalPct(row);

    return {
      ...definition,
      ...row,
      finalPct,
      finalPctLabel: formatPercent(finalPct, 0),
      isLeadRow: !previous || previous.l2Id !== definition.l2Id,
      matchesWorkbookDefault: matchesDefault(row),
    };
  });

  const l2RollupRows = P2P_SCOPE_L2_ROWS.map((definition) => {
    const rows = l3Rows.filter((row) => row.l2Id === definition.id);
    const scopePct = rows.length ? rows.reduce((sum, row) => sum + row.finalPct, 0) / rows.length : 0;

    return {
      ...definition,
      scopePct,
      scopePctLabel: formatPercent(scopePct, 0),
      l3Count: rows.length,
    };
  });

  return {
    scope,
    l3Rows,
    l2RollupRows,
    selectedL2Count: l2RollupRows.filter((row) => row.scopePct > 0).length,
    partialL2Count: l2RollupRows.filter((row) => row.scopePct > 0 && row.scopePct < 1).length,
    selectedL3Count: l3Rows.filter((row) => row.finalPct > 0).length,
    partialL3Count: l3Rows.filter((row) => row.finalPct > 0 && row.finalPct < 1).length,
    changedRowCount: countChangedP2pScopeRows(scope),
  };
}

export function buildP2pScopeWorkbookInputs(scopeValue = {}) {
  const scope = normalizeP2pScopeRows(scopeValue);
  const inputs = {};

  P2P_SCOPE_L3_ROWS.forEach((definition) => {
    const row = scope[definition.id] || cloneDefaultScopeRow();
    inputs[`F${definition.rowNumber}`] = trimText(row.status);
    inputs[`G${definition.rowNumber}`] = trimText(row.partialPct);
    inputs[`I${definition.rowNumber}`] = trimText(row.retainedToo);
    inputs[`J${definition.rowNumber}`] = trimText(row.disposition);
    inputs[`K${definition.rowNumber}`] = trimText(row.locationIntent);
  });

  return inputs;
}
