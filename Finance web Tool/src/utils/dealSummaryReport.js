import {
  completionPercent,
  formatDateTime,
  fpaCompletionPercent,
  scopedTowerCount,
  towerCompletionPercent,
} from "./dealMaster";
import { deriveFpaDiscoveryMetrics } from "../config/fpaDiscovery";
import { deriveFpaScopeMetrics } from "../config/fpaScope";
import {
  countCompletedFpaGovernanceChecks,
  createDefaultFpaWorkspace,
  FPA_TOTAL_FORMULAS,
  normalizeFpaWorkspace,
} from "../config/fpaWorkspace";

const TOWERS = [
  { code: "FPA", label: "FP&A" },
  { code: "RTR", label: "RTR" },
  { code: "O2C", label: "O2C" },
  { code: "P2P", label: "P2P" },
];

const DEAL_FIELDS = [
  ["Draft label", "draftLabel"],
  ["Deal ID", "dealId"],
  ["Client name", "clientName"],
  ["Program name", "programName"],
  ["Presales lead", "presalesLead"],
  ["Deal owner", "dealOwnerName"],
  ["Deal status", "dealStatus"],
  ["Watermark", "watermark"],
];

const COMMERCIAL_FIELDS = [
  ["Pricing construct", "pricingConstruct"],
  ["Contract term (years)", "contractTerm"],
  ["Display currency", "displayCurrency"],
  ["FX rate", "fxRate"],
  ["Discount rate %", "discountRate"],
  ["Corporate overhead %", "corporateOverhead"],
  ["Transition commercials", "transitionCommercials"],
  ["Transformation funding", "transformationFunding"],
  ["Benchmark percentile policy", "benchmarkPolicy"],
  ["Customer finance FTE", "customerFinanceFte"],
  ["Finance cost baseline", "financeCostBaseline"],
  ["Committed productivity Y2 %", "committedProdY2"],
  ["Committed productivity Y3 %", "committedProdY3"],
  ["Committed productivity Y4+ %", "committedProdY4"],
  ["Notes tag", "notesTag"],
];

function text(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function hasValue(value) {
  if (typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return text(value) !== "";
}

function shortDate(value) {
  if (!text(value)) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return text(value);
  }

  return parsed.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatValue(value) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.filter(hasValue).map((item) => formatValue(item)).join(", ");
  }

  if (value && typeof value === "object") {
    return "";
  }

  return text(value);
}

function fieldLines(fields, source) {
  return fields.reduce((lines, [label, key]) => {
    const value = source?.[key];
    if (hasValue(value)) {
      lines.push(`- ${label}: ${formatValue(value)}`);
    }
    return lines;
  }, []);
}

function countFilled(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? 1 : 0;
  }

  if (typeof value === "string") {
    return value.trim() ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countFilled(item), 0);
  }

  if (value && typeof value === "object") {
    return Object.values(value).reduce((sum, item) => sum + countFilled(item), 0);
  }

  return 0;
}

function workbookSummary(workbookInputs = {}) {
  const sheets = Object.entries(workbookInputs || {}).filter(([, value]) => value && typeof value === "object");
  return {
    totalSheets: sheets.length,
    touchedSheets: sheets.filter(([, value]) => countFilled(value) > 0).length,
    filledCells: sheets.reduce((sum, [, value]) => sum + countFilled(value), 0),
  };
}

function section(title, lines) {
  if (!Array.isArray(lines) || !lines.length) {
    return "";
  }

  return [`## ${title}`, "", ...lines].join("\n");
}

function fileSafe(value) {
  return (text(value) || "deal-summary")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function towerLines(deal) {
  return TOWERS.reduce((lines, tower) => {
    const scoped = Boolean(deal?.[`towerScope_${tower.code}`]);
    const lead = text(deal?.[`towerLead_${tower.code}`]);
    const status = text(deal?.[`towerStatus_${tower.code}`]);
    const completion = towerCompletionPercent(deal, tower.code);

    if (!scoped && !lead && !status && completion <= 0) {
      return lines;
    }

    const parts = [`${tower.label}: ${scoped ? "In scope" : "Out of scope"}`];
    if (lead) {
      parts.push(`Lead ${lead}`);
    }
    if (status) {
      parts.push(`Status ${status}`);
    }
    if (scoped || completion > 0) {
      parts.push(`Filled ${completion}%`);
    }

    lines.push(`- ${parts.join(" | ")}`);
    return lines;
  }, []);
}

function collaboratorLines(deal) {
  const collaborators = Array.isArray(deal?.collaborators) ? deal.collaborators : [];

  return collaborators.map((collaborator) => {
    const parts = [text(collaborator.name) || "Unnamed collaborator"];
    if (text(collaborator.email)) {
      parts.push(collaborator.email.trim());
    }
    if (text(collaborator.towerCode)) {
      parts.push(collaborator.towerCode.trim());
    }
    return `- ${parts.join(" | ")}`;
  });
}

function sourceLines(deal) {
  const lines = [];
  const sourceSummary = deal?.sourceSummary || {};
  const sourceDocuments = deal?.sourceDocuments || {};

  if (text(sourceSummary.sourcePackName)) {
    lines.push(`- Source pack: ${sourceSummary.sourcePackName}`);
  }

  if (text(sourceSummary.seedMode)) {
    lines.push(`- Seed mode: ${sourceSummary.seedMode}`);
  }

  if (text(sourceSummary.clientAlias)) {
    lines.push(`- Client alias: ${sourceSummary.clientAlias}`);
  }

  if (Number.isFinite(sourceSummary.workbookCount) || Number.isFinite(sourceSummary.pdfCount)) {
    lines.push(`- Source files scanned: ${sourceSummary.workbookCount || 0} workbooks | ${sourceSummary.pdfCount || 0} PDFs`);
  }

  if (Array.isArray(sourceSummary.mappingRules) && sourceSummary.mappingRules.length) {
    lines.push(`- Mapping rules: ${sourceSummary.mappingRules.join(" | ")}`);
  }

  if (Array.isArray(sourceSummary.keyPlatforms) && sourceSummary.keyPlatforms.length) {
    lines.push(`- Key platforms: ${sourceSummary.keyPlatforms.join(", ")}`);
  }

  if (sourceDocuments?.managerWorkbook?.file) {
    lines.push(`- Manager workbook: ${sourceDocuments.managerWorkbook.file}`);
  }

  if (text(sourceDocuments.rawExtractReference)) {
    lines.push(`- Raw extract reference: ${sourceDocuments.rawExtractReference}`);
  }

  if (text(sourceDocuments.mappingReference)) {
    lines.push(`- Mapping reference: ${sourceDocuments.mappingReference}`);
  }

  if (text(sourceDocuments.schemaReference)) {
    lines.push(`- Schema reference: ${sourceDocuments.schemaReference}`);
  }

  if (Array.isArray(sourceSummary.generatedSources) && sourceSummary.generatedSources.length) {
    sourceSummary.generatedSources.forEach((entry) => {
      lines.push(`- Generated source: ${entry}`);
    });
  }

  if (text(deal?.importReport?.markdown)) {
    lines.push(`- Import report: ${deal.importReport.markdown}`);
  } else if (text(sourceSummary.importReport)) {
    lines.push(`- Import report: ${sourceSummary.importReport}`);
  }

  if (Array.isArray(sourceDocuments.workbooks) && sourceDocuments.workbooks.length) {
    sourceDocuments.workbooks.forEach((workbook) => {
      lines.push(`- Workbook evidence: ${workbook.relativePath || workbook.file}`);
    });
  }

  if (Array.isArray(sourceDocuments.pdfBaselinePacks) && sourceDocuments.pdfBaselinePacks.length) {
    sourceDocuments.pdfBaselinePacks.forEach((pdf) => {
      lines.push(`- PDF baseline pack: ${pdf.relativePath || pdf.file}`);
    });
  }

  return lines;
}

function fpaLines(deal) {
  if (!deal?.towerScope_FPA) {
    return [];
  }

  const workspace = normalizeFpaWorkspace(deal.fpaWorkspace || createDefaultFpaWorkspace());
  const discovery = deriveFpaDiscoveryMetrics(workspace);
  const scope = deriveFpaScopeMetrics(workspace.scopeL3, workspace.scopeL2);
  const governanceCompleted = countCompletedFpaGovernanceChecks(workspace);
  const workbook = workbookSummary(deal.fpaWorkbookInputs);
  const lines = [
    `- Workspace status: ${text(workspace.status) || text(deal.towerStatus_FPA) || "Not Started"}`,
    `- FP&A completion: ${fpaCompletionPercent(deal)}%`,
    `- Discovery fill: ${discovery.discoveryCount}/${discovery.discoveryFieldCount} (${discovery.rawDiscoveryFillPct}%)`,
    `- Coverage answered: ${discovery.coverageAnsweredCount}/${discovery.coverageRows.length} (${discovery.coverageScorePct}%)`,
    `- Pain points answered: ${discovery.painAnsweredCount}/${discovery.painRows.length} (${discovery.painPressurePct}% pressure)`,
    `- Sizing motion: ${discovery.sizingMotion}`,
    `- Coverage mode: ${discovery.coverageMode}`,
    `- Tech landscape: ${discovery.techLandscape}`,
    `- Scope selected: ${scope.selectedL2Count}/${scope.l2RollupRows.length} L2 processes | ${scope.selectedL3Count}/${scope.l3Rows.length} L3 activities`,
    `- Scope driver basis: ${scope.l2DrivenCount} L2-driven | ${scope.l3DrivenCount} L3-driven`,
    `- Governance checks complete: ${governanceCompleted}/5`,
    `- Workbook inputs captured: ${workbook.filledCells} filled cells across ${workbook.touchedSheets}/${workbook.totalSheets} workbook tabs`,
    `- Portal formulas represented: ${FPA_TOTAL_FORMULAS}`,
  ];

  if (text(workspace.notes)) {
    lines.push(`- Workspace notes: ${workspace.notes}`);
  }

  if (workspace.scopeSeedMethod?.rule) {
    lines.push(`- Scope rule: ${workspace.scopeSeedMethod.rule}`);
  }

  if (Array.isArray(workspace.scopeSeedMethod?.l2BackedProcesses) && workspace.scopeSeedMethod.l2BackedProcesses.length) {
    lines.push(`- L2-backed processes: ${workspace.scopeSeedMethod.l2BackedProcesses.join(", ")}`);
  }

  if (Array.isArray(workspace.scopeSeedMethod?.l3BackedActivities) && workspace.scopeSeedMethod.l3BackedActivities.length) {
    lines.push(`- L3-backed activities: ${workspace.scopeSeedMethod.l3BackedActivities.join(", ")}`);
  }

  return lines;
}

export function buildDealSummaryReport(deal) {
  const title = text(deal?.draftLabel) || text(deal?.dealId) || "Untitled Deal";
  const collaborators = Array.isArray(deal?.collaborators) ? deal.collaborators : [];
  const sections = [
    section("Snapshot", [
      `- Generated at: ${formatDateTime(new Date().toISOString())}`,
      `- Deal: ${title}`,
      `- Bid date: ${shortDate(deal?.bidDate) || "-"}`,
      `- Overall deal readiness: ${completionPercent(deal)}%`,
      `- Towers in scope: ${scopedTowerCount(deal)}`,
      `- Collaborators saved: ${collaborators.length}`,
      deal?.towerScope_FPA ? `- FP&A workspace completion: ${fpaCompletionPercent(deal)}%` : "",
    ].filter(Boolean)),
    section("Deal Master", [
      ...fieldLines(DEAL_FIELDS, deal),
      ...(text(deal?.createdAt) ? [`- Created: ${formatDateTime(deal.createdAt)}`] : []),
      ...(text(deal?.updatedAt) ? [`- Updated: ${formatDateTime(deal.updatedAt)}`] : []),
    ]),
    section("Commercial Setup", COMMERCIAL_FIELDS.length ? fieldLines(COMMERCIAL_FIELDS, deal) : []),
    section("Tower Coverage", towerLines(deal)),
    section("Collaborators", collaboratorLines(deal)),
    section("FP&A Summary", fpaLines(deal)),
    section("Source References", sourceLines(deal)),
  ].filter(Boolean);

  return ["# Deal Summary Report", "", `## ${title}`, "", ...sections].join("\n\n");
}

function sanitizePdfText(value) {
  return text(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfString(value) {
  return sanitizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapPdfText(value, maxChars) {
  const input = sanitizePdfText(value);
  if (!input) {
    return [];
  }

  const words = input.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  const pushChunkedWord = (word) => {
    let remaining = word;
    while (remaining.length > maxChars) {
      lines.push(remaining.slice(0, maxChars));
      remaining = remaining.slice(maxChars);
    }
    current = remaining;
  };

  words.forEach((word) => {
    if (!current) {
      if (word.length > maxChars) {
        pushChunkedWord(word);
      } else {
        current = word;
      }
      return;
    }

    const next = `${current} ${word}`;
    if (next.length <= maxChars) {
      current = next;
      return;
    }

    lines.push(current);
    if (word.length > maxChars) {
      pushChunkedWord(word);
    } else {
      current = word;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildPdfLineEntries(markdown) {
  const entries = [];
  const lines = String(markdown || "").split(/\r?\n/);

  lines.forEach((rawLine) => {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      entries.push({ type: "spacer", height: 8 });
      return;
    }

    if (trimmed.startsWith("# ")) {
      wrapPdfText(trimmed.slice(2), 34).forEach((line) => {
        entries.push({ text: line, font: "F2", size: 18, lineHeight: 22, color: [0.07, 0.2, 0.33], indent: 0 });
      });
      return;
    }

    if (trimmed.startsWith("## ")) {
      wrapPdfText(trimmed.slice(3), 50).forEach((line) => {
        entries.push({ text: line, font: "F2", size: 12, lineHeight: 17, color: [0.12, 0.31, 0.55], indent: 0 });
      });
      return;
    }

    if (trimmed.startsWith("- ")) {
      const wrapped = wrapPdfText(trimmed.slice(2), 78);
      wrapped.forEach((line, index) => {
        entries.push({
          text: `${index === 0 ? "-" : " "} ${line}`,
          font: "F1",
          size: 10,
          lineHeight: 13,
          color: [0.18, 0.23, 0.28],
          indent: index === 0 ? 0 : 10,
        });
      });
      return;
    }

    wrapPdfText(trimmed, 82).forEach((line) => {
      entries.push({ text: line, font: "F1", size: 10, lineHeight: 13, color: [0.18, 0.23, 0.28], indent: 0 });
    });
  });

  return entries;
}

function paginatePdfEntries(entries) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 42;
  const marginTop = 52;
  const marginBottom = 42;
  const pages = [[]];
  let pageIndex = 0;
  let y = pageHeight - marginTop;

  const nextPage = () => {
    pages.push([]);
    pageIndex += 1;
    y = pageHeight - marginTop;
  };

  entries.forEach((entry) => {
    if (entry.type === "spacer") {
      if (y - entry.height < marginBottom) {
        nextPage();
      } else {
        y -= entry.height;
      }
      return;
    }

    if (y - entry.lineHeight < marginBottom) {
      nextPage();
    }

    pages[pageIndex].push({
      ...entry,
      x: marginLeft + (entry.indent || 0),
      y,
    });
    y -= entry.lineHeight;
  });

  return { pages, pageWidth, pageHeight, marginLeft, marginBottom };
}

function buildPdfStream(pageEntries, pageNumber, pageCount, pageWidth, marginLeft, marginBottom) {
  const operations = ["q"];

  pageEntries.forEach((entry) => {
    operations.push("BT");
    operations.push(`${entry.color[0].toFixed(3)} ${entry.color[1].toFixed(3)} ${entry.color[2].toFixed(3)} rg`);
    operations.push(`/${entry.font} ${entry.size} Tf`);
    operations.push(`1 0 0 1 ${entry.x.toFixed(2)} ${entry.y.toFixed(2)} Tm`);
    operations.push(`(${escapePdfString(entry.text)}) Tj`);
    operations.push("ET");
  });

  operations.push("BT");
  operations.push("0.500 0.560 0.640 rg");
  operations.push("/F1 9 Tf");
  operations.push(`1 0 0 1 ${(pageWidth - marginLeft - 70).toFixed(2)} ${marginBottom.toFixed(2)} Tm`);
  operations.push(`(${escapePdfString(`Page ${pageNumber} of ${pageCount}`)}) Tj`);
  operations.push("ET");
  operations.push("Q");

  return operations.join("\n");
}

function buildPdfDocument(markdown) {
  const { pages, pageWidth, pageHeight, marginLeft, marginBottom } = paginatePdfEntries(buildPdfLineEntries(markdown));
  const objects = [null];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const pageObjectNumbers = pages.map((_, index) => 5 + (index * 2));
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>";

  pages.forEach((pageEntries, index) => {
    const pageObjectNumber = 5 + (index * 2);
    const contentObjectNumber = pageObjectNumber + 1;
    const contentStream = buildPdfStream(pageEntries, index + 1, pages.length, pageWidth, marginLeft, marginBottom);

    objects[pageObjectNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber] = `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function downloadDealSummaryReport(deal) {
  const report = buildDealSummaryReport(deal);
  const fileName = `${fileSafe(deal?.dealId || deal?.draftLabel || deal?.clientName || "deal-summary")}-summary-report.pdf`;
  const blob = new Blob([buildPdfDocument(report)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);

  return fileName;
}
