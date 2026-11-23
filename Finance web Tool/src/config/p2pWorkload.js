import { P2P_SCOPE_L2_ROWS } from "./p2pCatalog";
import {
  buildP2pBenchmarkModel,
  createDefaultP2pBenchmarkSettings,
  getP2pBandSeedHours,
  normalizeP2pBenchmarkSettings,
} from "./p2pBenchmarks";
import { deriveP2pDiscoveryMetrics } from "./p2pDiscovery";
import { deriveP2pScopeMetrics } from "./p2pScope";
import { clamp, completionRatio, formatOneDecimal, formatPercent, trimText, toNumber, toNumberOrNull } from "./p2pMath";

const DEFAULT_SHARED_CUSTOMER_FTE = "No";
const DEFAULT_RETAINED_SHARE = "0.1";
const ADHOC_ELIGIBLE_L2_IDS = new Set(["exceptionQueryHandling", "reportingControlsGovernance"]);

function blankMap() {
  return Object.fromEntries(P2P_SCOPE_L2_ROWS.map((row) => [row.id, ""]));
}

export function createDefaultP2pWorkload() {
  return {
    sharedCustomerFte: DEFAULT_SHARED_CUSTOMER_FTE,
    typedTotalCustomerFte: "",
    defaultRetainedShare: DEFAULT_RETAINED_SHARE,
    customerFteByL2: blankMap(),
    retainedShareByL2: blankMap(),
    overrideHoursByL2: blankMap(),
    overrideNotesByL2: blankMap(),
  };
}

function normalizeStringMap(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const defaults = blankMap();
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, trimText(source[key])])) ;
}

export function normalizeP2pWorkload(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  const defaults = createDefaultP2pWorkload();
  return {
    sharedCustomerFte: trimText(incoming.sharedCustomerFte) || defaults.sharedCustomerFte,
    typedTotalCustomerFte: trimText(incoming.typedTotalCustomerFte),
    defaultRetainedShare: trimText(incoming.defaultRetainedShare) || defaults.defaultRetainedShare,
    customerFteByL2: normalizeStringMap(incoming.customerFteByL2),
    retainedShareByL2: normalizeStringMap(incoming.retainedShareByL2),
    overrideHoursByL2: normalizeStringMap(incoming.overrideHoursByL2),
    overrideNotesByL2: normalizeStringMap(incoming.overrideNotesByL2),
  };
}

export function countTouchedP2pWorkloadInputs(value = {}) {
  const workload = normalizeP2pWorkload(value);
  let count = 0;

  if (workload.sharedCustomerFte !== DEFAULT_SHARED_CUSTOMER_FTE) {
    count += 1;
  }

  if (workload.typedTotalCustomerFte) {
    count += 1;
  }

  if (workload.defaultRetainedShare !== DEFAULT_RETAINED_SHARE) {
    count += 1;
  }

  [workload.customerFteByL2, workload.retainedShareByL2, workload.overrideHoursByL2, workload.overrideNotesByL2].forEach((map) => {
    count += Object.values(map).filter((value) => trimText(value)).length;
  });

  return count;
}

function monthlyFromAnnual000(value) {
  const numeric = toNumberOrNull(value);
  return numeric === null ? 0 : (numeric * 1000) / 12;
}

function driverHoursForProcess(l2Id, discovery, benchmarkModel) {
  const legalEntities = toNumber(discovery.legalEntities, 0);
  const businessUnits = toNumber(discovery.businessUnits, 0);
  const activeVendors000 = toNumber(discovery.activeVendors000, 0);
  const paymentRunsPerMonth = toNumber(discovery.paymentRunsPerMonth, 0);
  const invoiceExceptionRate = toNumber(discovery.invoiceExceptionRate, 0.18);
  const poBackedSpendShare = toNumber(discovery.poBackedSpendShare, 0.6);
  const cyclesFactor = benchmarkModel.cyclesPerYear / 12;
  const adHocFactor = 1 + benchmarkModel.adHocAllowance;

  switch (l2Id) {
    case "requisitionSourcingSupport":
      return (monthlyFromAnnual000(discovery.requisitions000) * 0.05) + 20;
    case "poManagement":
      return (monthlyFromAnnual000(discovery.purchaseOrders000) * 0.04) + 15;
    case "vendorMaster":
      return (activeVendors000 * 8) + 15;
    case "invoiceProcessing":
      return monthlyFromAnnual000(discovery.supplierInvoices000) * 0.03;
    case "threeWayMatch":
      return monthlyFromAnnual000(discovery.supplierInvoices000) * poBackedSpendShare * 0.012;
    case "exceptionQueryHandling":
      return monthlyFromAnnual000(discovery.supplierInvoices000) * invoiceExceptionRate * 0.15 * adHocFactor;
    case "paymentsDisbursement":
      return (paymentRunsPerMonth * 6) + (activeVendors000 * 2);
    case "travelExpense":
      return monthlyFromAnnual000(discovery.tneClaims000) * 0.05;
    case "supplierReconciliationStatements":
      return (activeVendors000 * 10) + 10;
    case "reportingControlsGovernance":
      return ((30 + (legalEntities * 4) + (businessUnits * 2)) * cyclesFactor) * adHocFactor;
    default:
      return 0;
  }
}

function flagFromVariance(variance, amberThreshold, redThreshold) {
  if (variance === null) {
    return "—";
  }
  if (variance >= redThreshold) {
    return "RED >40%";
  }
  if (variance >= amberThreshold) {
    return "AMBER >30%";
  }
  return "OK";
}

function driverVsBandFlag(variance, threshold) {
  if (variance >= threshold) {
    return "AMBER >40%";
  }
  return "OK";
}

function methodConfidence(method) {
  if (method.startsWith("A")) {
    return "CC/CE";
  }
  if (method.startsWith("D")) {
    return "CE / PA";
  }
  return "PA / BM";
}

export function buildP2pWorkloadModel(workspace = {}, currentDeal = {}) {
  const discoveryMetrics = deriveP2pDiscoveryMetrics(workspace);
  const scopeMetrics = deriveP2pScopeMetrics(workspace.scopeL3 || {});
  const benchmarkSettings = normalizeP2pBenchmarkSettings(workspace.benchmarks || createDefaultP2pBenchmarkSettings());
  const workload = normalizeP2pWorkload(workspace.workload || {});
  const effectiveDiscovery = discoveryMetrics.effectiveDiscovery;
  const benchmarkModel = buildP2pBenchmarkModel(effectiveDiscovery, benchmarkSettings);
  const sharedCustomerFte = workload.sharedCustomerFte === "Yes";
  const defaultRetainedShare = clamp(toNumber(workload.defaultRetainedShare, 0.1), 0, 1);
  const thresholds = benchmarkModel.varianceThresholds;

  const processRows = P2P_SCOPE_L2_ROWS.map((row) => {
    const scopeRollup = scopeMetrics.l2RollupRows.find((item) => item.id === row.id);
    const scopePct = scopeRollup?.scopePct || 0;
    const customerFte = toNumberOrNull(workload.customerFteByL2[row.id]);
    const retainedShareRaw = toNumberOrNull(workload.retainedShareByL2[row.id]);
    const retainedShare = retainedShareRaw === null ? defaultRetainedShare : clamp(retainedShareRaw, 0, 1);
    const hoursFromFte = customerFte === null ? null : customerFte * benchmarkModel.productiveHoursPerFteMonth;
    const transferredHours = hoursFromFte === null ? null : hoursFromFte * (1 - retainedShare);
    const driverHours = driverHoursForProcess(row.id, effectiveDiscovery, benchmarkModel);
    const bandSeed = getP2pBandSeedHours(row.id, benchmarkModel.revenueBand);
    const customerHours = sharedCustomerFte ? transferredHours : null;

    let method = "E — band";
    let selectedBase = bandSeed;
    if (customerHours !== null && customerHours > 0) {
      method = "A — customer";
      selectedBase = customerHours;
    } else if (driverHours > 0) {
      method = "D — driver";
      selectedBase = driverHours;
    }

    const matrix = benchmarkModel.applicabilityByL2[row.id] || { platform: 0, close: 0, volume: 0, complexity: 0, data: 0 };
    const multiplierChain = benchmarkModel.percentileFactor
      * (matrix.platform ? benchmarkModel.primaryPlatformAdjustment : 1)
      * (matrix.close ? benchmarkModel.closeAdjustment : 1)
      * (matrix.volume ? benchmarkModel.volumeMultiplier : 1)
      * (matrix.complexity ? benchmarkModel.complexityMultiplier : 1)
      * (matrix.data ? benchmarkModel.dataIntegrationMultiplier : 1);
    const adjustedHours = method.startsWith("A")
      ? selectedBase * benchmarkModel.normalisationFactor
      : selectedBase * multiplierChain;
    const scopedHours = adjustedHours * scopePct;
    const overrideHours = toNumberOrNull(workload.overrideHoursByL2[row.id]);
    const finalHours = overrideHours === null ? scopedHours : overrideHours;
    const overrideNote = trimText(workload.overrideNotesByL2[row.id]);
    const overrideNeedsNote = overrideHours !== null && !overrideNote;
    const avsDVariance = customerHours === null || driverHours <= 0 ? null : Math.abs(customerHours - driverHours) / driverHours;
    const driverVsBandVariance = bandSeed <= 0 ? 0 : Math.abs(driverHours - bandSeed) / bandSeed;

    return {
      ...row,
      scopePct,
      scopePctLabel: formatPercent(scopePct, 0),
      customerFte,
      retainedShare,
      hoursFromFte,
      transferredHours,
      driverHours,
      bandSeed,
      customerHours,
      method,
      selectedBase,
      adjustedHours,
      scopedHours,
      overrideHours,
      overrideNote,
      overrideNeedsNote,
      finalHours,
      confidence: methodConfidence(method),
      avsDVariance,
      avsDFlag: flagFromVariance(avsDVariance, thresholds.avsDAmber, thresholds.avsDRed),
      driverVsBandVariance,
      driverVsBandFlag: driverVsBandFlag(driverVsBandVariance, thresholds.driverVsBandAmber),
    };
  });

  const totalMonthlyHours = processRows.reduce((sum, row) => sum + row.finalHours, 0);
  const annualHours = totalMonthlyHours * 12;
  const peakMonths = [effectiveDiscovery.peakMonth1, effectiveDiscovery.peakMonth2, effectiveDiscovery.peakMonth3].filter(Boolean);
  const peakMonthFactor = peakMonths.length
    ? Math.max(...peakMonths.map((month) => benchmarkModel.seasonalityFactors[month] || 1))
    : 1;
  const peakMonthHours = totalMonthlyHours * peakMonthFactor;
  const blindFte = totalMonthlyHours / benchmarkModel.productiveHoursPerFteMonth;
  const currentTowerStaff = toNumberOrNull(effectiveDiscovery.currentTowerStaff);
  const impliedShare = currentTowerStaff && currentTowerStaff > 0 ? blindFte / currentTowerStaff : null;
  const typedTotalCustomerFte = toNumberOrNull(workload.typedTotalCustomerFte);
  const decompositionFte = processRows.reduce((sum, row) => sum + (row.customerFte || 0), 0);
  const typedTieOut = typedTotalCustomerFte === null
    ? "Awaiting typed total"
    : Math.abs(decompositionFte - typedTotalCustomerFte) <= 0.05
      ? "OK — ties"
      : "Check — mismatch";
  const redVarianceCount = processRows.filter((row) => row.avsDFlag.startsWith("RED")).length;
  const overridesWithoutNote = processRows.filter((row) => row.overrideNeedsNote).length;
  const methodMix = {
    A: processRows.filter((row) => row.method.startsWith("A")).length,
    D: processRows.filter((row) => row.method.startsWith("D")).length,
    E: processRows.filter((row) => row.method.startsWith("E")).length,
  };

  return {
    currentDeal,
    discoveryMetrics,
    scopeMetrics,
    benchmarkSettings,
    benchmarkModel,
    workload,
    processRows,
    totalMonthlyHours,
    annualHours,
    peakMonthHours,
    peakMonthFactor,
    blindFte,
    currentTowerStaff,
    impliedShare,
    typedTotalCustomerFte,
    decompositionFte,
    typedTieOut,
    redVarianceCount,
    overridesWithoutNote,
    methodMix,
    completionRatio: completionRatio(
      countTouchedP2pWorkloadInputs(workload),
      (P2P_SCOPE_L2_ROWS.length * 4) + 3,
    ),
  };
}

export function buildP2pWorkloadWorkbookInputs(value = {}) {
  const workload = normalizeP2pWorkload(value);
  const inputs = {
    C38: workload.sharedCustomerFte,
    C39: workload.typedTotalCustomerFte,
    C40: workload.defaultRetainedShare,
  };

  P2P_SCOPE_L2_ROWS.forEach((row, index) => {
    const processRow = 14 + index;
    const reconciliationRow = 42 + index;
    inputs[`C${reconciliationRow}`] = trimText(workload.customerFteByL2[row.id]);
    inputs[`E${reconciliationRow}`] = trimText(workload.retainedShareByL2[row.id]);
    inputs[`I${processRow}`] = trimText(workload.overrideHoursByL2[row.id]);
    inputs[`J${processRow}`] = trimText(workload.overrideNotesByL2[row.id]);
  });

  return inputs;
}

export function formatP2pWorkloadHours(value) {
  return formatOneDecimal(value);
}
