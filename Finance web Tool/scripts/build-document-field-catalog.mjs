import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = process.cwd();
const CONFIG_DIR = path.join(ROOT, "src", "config");

function normalizeSpace(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function slugify(value) {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^-|-$/gu, "") || "field";
}

function sectionFromSheetName(sheetName) {
  return normalizeSpace(String(sheetName || "").replace(/^FPA_/u, ""));
}

function targetPathFor(sheetName, address) {
  return "fpaWorkbookInputs." + sheetName + "." + address;
}

function controlTypeFromKind(kind) {
  const normalized = normalizeSpace(kind).toLowerCase();
  if (!normalized) {
    return "text";
  }
  if (["choice", "location", "tilt", "yesno", "gate", "persona", "input-select"].includes(normalized)) {
    return "select";
  }
  if (normalized.includes("text")) {
    return "text";
  }
  return "number";
}

function createCatalogBuilder() {
  const seen = new Set();
  const fields = [];

  function addField(args) {
    const cleanSheetName = normalizeSpace(args.sheetName);
    const cleanAddress = normalizeSpace(args.address).toUpperCase();
    const cleanLabel = normalizeSpace(args.fieldLabel);
    if (!cleanSheetName || !cleanAddress || !cleanLabel) {
      return;
    }

    const targetPath = targetPathFor(cleanSheetName, cleanAddress);
    if (seen.has(targetPath)) {
      return;
    }

    seen.add(targetPath);
    fields.push({
      tower: "FP&A",
      section: sectionFromSheetName(cleanSheetName),
      subsection: normalizeSpace(args.subsection) || "Workbook inputs",
      fieldKey: slugify(cleanSheetName + "-" + cleanAddress),
      fieldLabel: cleanLabel,
      targetPath,
      controlType: args.controlType || "text",
      allowedValues: Array.isArray(args.allowedValues)
        ? args.allowedValues.map((value) => normalizeSpace(value)).filter(Boolean)
        : [],
    });
  }

  return { addField, fields };
}

function prepareTempConfigDirectory() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "portal-field-catalog-"));
  const outDir = path.join(tmpRoot, "config");
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of fs.readdirSync(CONFIG_DIR)) {
    if (!name.endsWith(".js")) {
      continue;
    }

    const sourcePath = path.join(CONFIG_DIR, name);
    let text = fs.readFileSync(sourcePath, "utf8");
    text = text.replace(/from\s+(["'])(\.{1,2}\/[^"'.][^"']*)(\1)/gu, function (_match, quote, specifier) {
      return "from " + quote + specifier + ".js" + quote;
    });
    fs.writeFileSync(path.join(outDir, name), text, "utf8");
  }

  return { tmpRoot, outDir };
}

async function importConfigModule(outDir, moduleName) {
  return import(pathToFileURL(path.join(outDir, moduleName)).href);
}

function extractBenchmarkCatalog(addField, mod) {
  const sheetName = "FPA_04 Benchmarks";
  const workbookView = mod.buildFpaBenchmarkWorkbookView({}, {});
  const sections = mod.getFpaBenchmarkSections(workbookView);

  sections.forEach(function (section) {
    const subsection = normalizeSpace([section.code, section.displayTitle].filter(Boolean).join(" | "));
    const headerByColumn = {};

    section.rows.forEach(function (row) {
      row.cells
        .filter(function (cell) { return cell.kind === "header" && normalizeSpace(cell.text); })
        .forEach(function (cell) {
          headerByColumn[cell.column] = normalizeSpace(cell.text);
        });

      const labelCell = row.cells.find(function (cell) {
        return !cell.isInput && cell.kind !== "header" && normalizeSpace(cell.text);
      });
      const rowLabel = normalizeSpace(labelCell ? labelCell.text : "");

      row.cells.filter(function (cell) { return cell.isInput; }).forEach(function (cell) {
        const columnLabel = headerByColumn[cell.column] || ("Column " + cell.column);
        addField({
          sheetName,
          subsection,
          fieldLabel: rowLabel ? rowLabel + " - " + columnLabel : columnLabel,
          address: cell.address,
          controlType: controlTypeFromKind(cell.kind),
        });
      });
    });
  });
}

function extractWorkloadCatalog(addField, mod) {
  const sheetName = "FPA_05 Workload";
  const workbookView = mod.buildFpaWorkloadWorkbookView({}, {}, {}, {});
  const rowMap = Object.fromEntries(workbookView.rows.map(function (row) { return [row.index, row]; }));
  const getRowLabel = function (rowNumber) {
    const row = rowMap[rowNumber];
    const cell = row && row.cells ? row.cells.find(function (item) {
      return item.column === "B" && normalizeSpace(item.text);
    }) : null;
    return normalizeSpace(cell ? cell.text : "");
  };

  [40, 41, 42].forEach(function (rowNumber) {
    const row = rowMap[rowNumber];
    const label = getRowLabel(rowNumber);
    (row && row.cells ? row.cells : []).filter(function (cell) {
      return cell.isInput;
    }).forEach(function (cell) {
      addField({
        sheetName,
        subsection: "Customer actuals",
        fieldLabel: label,
        address: cell.address,
        controlType: controlTypeFromKind(cell.kind),
        allowedValues: cell.address === "C40" ? ["Yes", "No"] : [],
      });
    });
  });

  const reconciliationColumnLabels = {
    C: "Customer FTE in scope",
    D: "Customer hours / month",
    E: "Retained share",
  };

  for (let rowNumber = 44; rowNumber <= 55; rowNumber += 1) {
    const row = rowMap[rowNumber];
    const rowLabel = getRowLabel(rowNumber);
    ["C", "D", "E"].forEach(function (column) {
      const cell = row && row.cells ? row.cells.find(function (item) {
        return item.address === (column + rowNumber) && item.isInput;
      }) : null;
      if (!cell) {
        return;
      }
      addField({
        sheetName,
        subsection: "Customer-FTE reconciliation",
        fieldLabel: rowLabel + " - " + reconciliationColumnLabels[column],
        address: cell.address,
        controlType: controlTypeFromKind(cell.kind),
      });
    });
  }
}

function extractPersonaCatalog(addField, mod) {
  const sheetName = "FPA_07 Personas";
  const workbookView = mod.buildFpaPersonaWorkbookView({});
  const personas = Array.isArray(workbookView.personas) ? workbookView.personas : (mod.FPA_PERSONA_LIBRARY_COLUMNS || []);

  workbookView.sections.forEach(function (section) {
    section.rows.forEach(function (row) {
      personas.forEach(function (persona) {
        addField({
          sheetName,
          subsection: section.title,
          fieldLabel: row.label + " - " + persona.label,
          address: persona.workbookColumn + row.workbookRow,
          controlType: row.format === "text" ? "text" : "number",
        });
      });
    });
  });
}
function extractAiBenefitCatalog(addField, mod, buildContext) {
  const sheetName = "FPA_08 AI Benefit";
  const workbookView = mod.buildFpaAiBenefitWorkbookView(buildContext);
  const matrixFieldLabels = [
    ["autoAddr", "Automation addressability %"],
    ["autoRed", "Automation reduction %"],
    ["autoRes", "Automation residual %"],
    ["copAddr", "Copilot addressability %"],
    ["copRed", "Copilot reduction %"],
    ["copRes", "Copilot residual %"],
    ["agtAddr", "Agent addressability %"],
    ["agtRed", "Agent reduction %"],
    ["agtRes", "Agent residual %"],
    ["gate", "Agent gate"],
  ];

  workbookView.matrixRows.forEach(function (row) {
    matrixFieldLabels.forEach(function (mapping) {
      const fieldName = mapping[0];
      const suffix = mapping[1];
      const cell = row[fieldName];
      if (!cell || !cell.address) {
        return;
      }
      addField({
        sheetName,
        subsection: "Process levers",
        fieldLabel: row.label + " - " + suffix,
        address: cell.address,
        controlType: fieldName === "gate" ? "select" : "number",
        allowedValues: fieldName === "gate" ? (mod.AI_GATE_OPTIONS || []) : [],
      });
    });
  });

  Object.values(workbookView.rampProfiles || {}).forEach(function (profile) {
    (profile.rows || []).forEach(function (row) {
      (row.years || []).forEach(function (year) {
        addField({
          sheetName,
          subsection: profile.label,
          fieldLabel: row.label + " - " + year.label,
          address: year.address,
          controlType: "number",
        });
      });
    });
  });

  (workbookView.personas || []).forEach(function (persona) {
    if (persona && persona.ambitionScalar && persona.ambitionScalar.address) {
      addField({
        sheetName,
        subsection: "Persona ambition",
        fieldLabel: persona.label + " - Ambition scalar",
        address: persona.ambitionScalar.address,
        controlType: "number",
      });
    }
  });
}

function extractOpsModelCatalog(addField, mod) {
  const sheetName = "FPA_09 Ops Model";
  const workbookView = mod.buildFpaOpsModelWorkbookView({});
  const personaLabels = Object.fromEntries((workbookView.personas || []).map(function (persona) {
    return [persona.id, persona.label];
  }));
  const layerLabels = Object.fromEntries((workbookView.layers || []).map(function (layer) {
    return [layer.id, layer.label];
  }));

  (workbookView.shoreMixTable && workbookView.shoreMixTable.rows ? workbookView.shoreMixTable.rows : []).forEach(function (row) {
    Object.entries(row.values || {}).forEach(function (entry) {
      const personaId = entry[0];
      const cell = entry[1];
      addField({
        sheetName,
        subsection: "Shore mix by persona",
        fieldLabel: row.label + " - " + (personaLabels[personaId] || personaId) + " share",
        address: cell.address,
        controlType: "number",
      });
    });
  });

  (workbookView.locationBlendRows || []).forEach(function (row) {
    [
      [row.location1, "Primary location", "select", mod.OPS_LOCATION_OPTIONS || []],
      [row.split1, "Primary split %", "number", []],
      [row.location2, "Secondary location", "select", mod.OPS_LOCATION_OPTIONS || []],
      [row.split2, "Secondary split %", "number", []],
    ].forEach(function (mapping) {
      const cell = mapping[0];
      const suffix = mapping[1];
      const controlType = mapping[2];
      const allowedValues = mapping[3];
      if (!cell || !cell.address) {
        return;
      }
      addField({
        sheetName,
        subsection: "Location blend",
        fieldLabel: row.label + " - " + suffix,
        address: cell.address,
        controlType,
        allowedValues,
      });
    });
  });

  (workbookView.tiltTables || []).forEach(function (table) {
    (table.rows || []).forEach(function (row) {
      Object.entries(row.values || {}).forEach(function (entry) {
        const layerId = entry[0];
        const cell = entry[1];
        addField({
          sheetName,
          subsection: table.label + " tilt pyramid",
          fieldLabel: row.label + " - " + (layerLabels[layerId] || layerId) + " mix",
          address: cell.address,
          controlType: "number",
        });
      });
    });
  });

  Object.entries((workbookView.personaTiltRow && workbookView.personaTiltRow.values) || {}).forEach(function (entry) {
    const personaId = entry[0];
    const cell = entry[1];
    addField({
      sheetName,
      subsection: "Persona tilt",
      fieldLabel: (personaLabels[personaId] || personaId) + " - Grade tilt",
      address: cell.address,
      controlType: "select",
      allowedValues: mod.OPS_TILT_OPTIONS || [],
    });
  });

  if (workbookView.languageCoverage && workbookView.languageCoverage.address) {
    addField({
      sheetName,
      subsection: "Coverage check",
      fieldLabel: "Language coverage",
      address: workbookView.languageCoverage.address,
      controlType: "select",
      allowedValues: mod.OPS_YES_NO_OPTIONS || [],
    });
  }
}

function extractRateCardCatalog(addField, mod) {
  const sheetName = "FPA_10 Rate Card";
  const workbookView = mod.buildFpaRateCardWorkbookView({});
  const locationLabels = Object.fromEntries((workbookView.locations || []).map(function (location) {
    return [location.id, location.label];
  }));
  const personaLabels = Object.fromEntries((workbookView.personas || []).map(function (persona) {
    return [persona.id, persona.label];
  }));

  (workbookView.baseSalaryRows || []).forEach(function (row) {
    Object.entries(row.values || {}).forEach(function (entry) {
      const locationId = entry[0];
      const cell = entry[1];
      addField({
        sheetName,
        subsection: "Base salary",
        fieldLabel: row.label + " - " + (locationLabels[locationId] || locationId),
        address: cell.address,
        controlType: "number",
      });
    });
  });

  Object.entries((workbookView.benefitsLoadRow && workbookView.benefitsLoadRow.values) || {}).forEach(function (entry) {
    const locationId = entry[0];
    const cell = entry[1];
    addField({
      sheetName,
      subsection: "Benefits load",
      fieldLabel: workbookView.benefitsLoadRow.label + " - " + (locationLabels[locationId] || locationId),
      address: cell.address,
      controlType: "number",
    });
  });

  (workbookView.locationFactorRows || []).forEach(function (row) {
    Object.entries(row.values || {}).forEach(function (entry) {
      const locationId = entry[0];
      const cell = entry[1];
      addField({
        sheetName,
        subsection: "Location factors",
        fieldLabel: row.label + " - " + (locationLabels[locationId] || locationId),
        address: cell.address,
        controlType: "number",
      });
    });
  });

  (workbookView.technologyCostRows || []).forEach(function (row) {
    Object.entries(row.values || {}).forEach(function (entry) {
      const personaId = entry[0];
      const cell = entry[1];
      addField({
        sheetName,
        subsection: "Technology cost",
        fieldLabel: row.label + " - " + (personaLabels[personaId] || personaId),
        address: cell.address,
        controlType: "number",
      });
    });
  });

  [
    [workbookView.backfillMultiplier, "Shared controls", []],
    [workbookView.agentRunCost, "Shared controls", []],
    [workbookView.consumptionCost, "Shared controls", []],
    [workbookView.confirmation, "Shared controls", mod.RATE_CARD_CONFIRM_OPTIONS || []],
  ].forEach(function (mapping) {
    const control = mapping[0];
    const subsection = mapping[1];
    const allowedValues = mapping[2];
    if (!control || !control.address) {
      return;
    }
    addField({
      sheetName,
      subsection,
      fieldLabel: control.label,
      address: control.address,
      controlType: allowedValues.length ? "select" : "number",
      allowedValues,
    });
  });
}
function extractPricingCatalog(addField, mod, buildContext) {
  const sheetName = "FPA_13 Pricing";
  const workbookView = mod.buildFpaPricingWorkbookView(buildContext);
  [workbookView.controls && workbookView.controls.commercialGmFloor, workbookView.controls && workbookView.controls.gainshareProviderShare]
    .filter(function (control) { return control && control.address; })
    .forEach(function (control) {
      addField({
        sheetName,
        subsection: "Commercial controls",
        fieldLabel: control.label,
        address: control.address,
        controlType: "number",
      });
    });
}

function extractOutcomeCatalog(addField, mod, buildContext) {
  const sheetName = "FPA_14 Outcome";
  const workbookView = mod.buildFpaOutcomeWorkbookView(buildContext);
  (workbookView.unitRows || []).forEach(function (row) {
    addField({
      sheetName,
      subsection: "Unit pricing allocation",
      fieldLabel: row.label + " - Allocation %",
      address: row.allocationAddress,
      controlType: "number",
    });
  });
}

function extractTransitionCatalog(addField, mod, buildContext) {
  const sheetName = "FPA_15 Transition";
  const workbookView = mod.buildFpaTransitionWorkbookView(buildContext);

  if (workbookView.controls && workbookView.controls.transitionMarkup && workbookView.controls.transitionMarkup.address) {
    addField({
      sheetName,
      subsection: "Commercial controls",
      fieldLabel: "Transition markup %",
      address: workbookView.controls.transitionMarkup.address,
      controlType: "number",
    });
  }

  (workbookView.phaseRows || []).forEach(function (row) {
    (row.weekCells || []).forEach(function (cell) {
      addField({
        sheetName,
        subsection: "Phase calendar",
        fieldLabel: row.label + " - " + cell.label,
        address: cell.address,
        controlType: "number",
      });
    });

    [
      [row.providerRamp, "Provider ramp share"],
      [row.billingPct, "Billing % during phase"],
      [row.preCutover, "Pre-cutover flag (1/0)"],
    ].forEach(function (mapping) {
      const cell = mapping[0];
      const suffix = mapping[1];
      if (!cell || !cell.address) {
        return;
      }
      addField({
        sheetName,
        subsection: "Phase calendar",
        fieldLabel: row.label + " - " + suffix,
        address: cell.address,
        controlType: "number",
      });
    });
  });

  (workbookView.transitionCostRows || []).filter(function (row) {
    return Array.isArray(row.values) && row.values.some(function (cell) { return cell && cell.isEditable; });
  }).forEach(function (row) {
    row.values.filter(function (cell) {
      return cell && cell.address && cell.isEditable;
    }).forEach(function (cell) {
      addField({
        sheetName,
        subsection: "Transition cost",
        fieldLabel: row.label + " - " + cell.label,
        address: cell.address,
        controlType: "number",
      });
    });
  });

  (workbookView.transformationRows || []).forEach(function (row) {
    (row.values || []).filter(function (cell) {
      return cell && cell.address && cell.isEditable;
    }).forEach(function (cell) {
      addField({
        sheetName,
        subsection: "Transformation build",
        fieldLabel: row.label + " - " + cell.label,
        address: cell.address,
        controlType: "number",
      });
    });

    if (row.split && row.split.address && row.split.isEditable) {
      addField({
        sheetName,
        subsection: "Transformation build",
        fieldLabel: row.label + " - Split %",
        address: row.split.address,
        controlType: "number",
      });
    }
  });
}

function extractRecommendCatalog(addField, mod, buildContext) {
  const sheetName = "FPA_20 Recommend";
  const workbookView = mod.buildFpaRecommendWorkbookView(buildContext);
  (workbookView.criterionRows || []).forEach(function (row) {
    addField({
      sheetName,
      subsection: "Criteria weights",
      fieldLabel: row.label + " - Weight %",
      address: row.weightAddress,
      controlType: "number",
    });
  });
}

function extractClientValueCatalog(addField, mod, buildContext) {
  const sheetName = "FPA_21 Client Value";
  const workbookView = mod.buildFpaClientValueWorkbookView(buildContext);
  const control = workbookView.controls && workbookView.controls.baselineOverheadUplift;
  if (control && control.address) {
    addField({
      sheetName,
      subsection: "Baseline uplift",
      fieldLabel: control.label,
      address: control.address,
      controlType: "number",
    });
  }
}

async function main() {
  const catalogBuilder = createCatalogBuilder();
  const addField = catalogBuilder.addField;
  const fields = catalogBuilder.fields;
  const prepared = prepareTempConfigDirectory();

  try {
    const workspaceMod = await importConfigModule(prepared.outDir, "fpaWorkspace.js");
    const defaultWorkspace = typeof workspaceMod.createDefaultFpaWorkspace === "function"
      ? workspaceMod.createDefaultFpaWorkspace()
      : {};
    const buildContext = {
      currentDeal: {
        fpaWorkspace: defaultWorkspace,
        fpaWorkbookInputs: {},
      },
      workspace: defaultWorkspace,
    };

    const runners = [
      ["benchmarks", async function () { extractBenchmarkCatalog(addField, await importConfigModule(prepared.outDir, "fpaBenchmarks.js")); }],
      ["workload", async function () { extractWorkloadCatalog(addField, await importConfigModule(prepared.outDir, "fpaWorkload.js")); }],
      ["personas", async function () { extractPersonaCatalog(addField, await importConfigModule(prepared.outDir, "fpaPersonas.js")); }],
      ["ai-benefit", async function () { extractAiBenefitCatalog(addField, await importConfigModule(prepared.outDir, "fpaAiBenefit.js"), buildContext); }],
      ["ops-model", async function () { extractOpsModelCatalog(addField, await importConfigModule(prepared.outDir, "fpaOpsModel.js")); }],
      ["rate-card", async function () { extractRateCardCatalog(addField, await importConfigModule(prepared.outDir, "fpaRateCard.js")); }],
      ["pricing", async function () { extractPricingCatalog(addField, await importConfigModule(prepared.outDir, "fpaPricing.js"), buildContext); }],
      ["outcome", async function () { extractOutcomeCatalog(addField, await importConfigModule(prepared.outDir, "fpaOutcome.js"), buildContext); }],
      ["transition", async function () { extractTransitionCatalog(addField, await importConfigModule(prepared.outDir, "fpaTransition.js"), buildContext); }],
      ["recommend", async function () { extractRecommendCatalog(addField, await importConfigModule(prepared.outDir, "fpaRecommend.js"), buildContext); }],
      ["client-value", async function () { extractClientValueCatalog(addField, await importConfigModule(prepared.outDir, "fpaClientValue.js"), buildContext); }],
    ];

    for (const runner of runners) {
      const name = runner[0];
      const run = runner[1];
      try {
        await run();
      } catch (error) {
        console.error("[document-field-catalog] " + name + " failed: " + (error && error.stack ? error.stack : String(error)));
      }
    }

    process.stdout.write(JSON.stringify(fields));
  } finally {
    fs.rmSync(prepared.tmpRoot, { recursive: true, force: true });
  }
}

await main();


