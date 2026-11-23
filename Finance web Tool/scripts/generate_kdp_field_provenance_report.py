# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEALS_PATH = ROOT / "backend" / "data" / "deals.json"
USERS_PATH = ROOT / "backend" / "data" / "users.json"
DISCOVERY_CONFIG_PATH = ROOT / "src" / "config" / "fpaDiscovery.js"
SCOPE_CONFIG_PATH = ROOT / "src" / "config" / "fpaScope.js"
WORKSPACE_CONFIG_PATH = ROOT / "src" / "config" / "fpaWorkspace.js"
REPORT_JSON_PATH = ROOT / "docs" / "Gaurav" / "kdp-field-provenance.generated.json"
REPORT_MD_PATH = ROOT / "docs" / "Gaurav" / "kdp-field-provenance.generated.md"

TARGET_DEAL_ID = "KDP-DVE-RFP-2026"
SEED_DEAL_ID = "deal-1791790303303"
MANAGER_WORKBOOK = "KDP_E2E_Finance_Solution_Model_v6.xlsx"

DEFAULT_SCOPE_ROW = {
    "status": "Y",
    "partialPct": "1",
    "retainedToo": "N",
    "disposition": "Transfer",
    "locationIntent": "Follow model",
}

DEAL_MASTER_FIELDS = [
    ("clientName", "Client Name"),
    ("dealId", "Deal ID"),
    ("presalesLead", "Presales Lead"),
    ("bidDate", "Bid Date"),
    ("contractTerm", "Contract Term (Years)"),
    ("discountRate", "Discount Rate (%)"),
    ("colaRate", "COLA Rate (%)"),
    ("displayCurrency", "Display Currency"),
    ("fxRate", "FX Rate"),
    ("pricingConstruct", "Pricing Construct"),
    ("transitionCommercials", "Transition Commercials"),
    ("transformationFunding", "Transformation Funding"),
    ("benchmarkPolicy", "Benchmark Policy"),
    ("corporateOverhead", "Corporate Overhead (%)"),
    ("customerFinanceFte", "Customer Finance FTE"),
    ("programName", "Program Name"),
]

WORKFLOW_FIELDS = [
    "dealStatus",
    "watermark",
    "notesTag",
    "towerStatus_FPA",
    "towerStatus_RTR",
    "towerStatus_O2C",
    "towerStatus_P2P",
    "reviewNotes",
]

WORKFLOW_LABELS = {
    "dealStatus": "Deal Status",
    "watermark": "Watermark",
    "notesTag": "Notes Tag",
    "towerStatus_FPA": "Tower Status FP&A",
    "towerStatus_RTR": "Tower Status RTR",
    "towerStatus_O2C": "Tower Status O2C",
    "towerStatus_P2P": "Tower Status P2P",
    "reviewNotes": "Review Notes",
}

SECTION_META = {
    "scopeL3": ("FP&A 03 Scope L3", "src/config/fpaScope.js + src/config/fpaWorkload.js"),
    "benchmarks": ("FP&A 04 Benchmarks", "src/config/fpaBenchmarks.js / buildFpaBenchmarkWorkbookView"),
    "aiBenefit": ("FP&A 08 AI Benefit", "src/config/fpaAiBenefit.js / buildFpaAiBenefitWorkbookView"),
    "opsModel": ("FP&A 09 Ops Model", "src/config/fpaOpsModel.js / buildFpaOpsModelWorkbookView"),
    "rateCard": ("FP&A 10 Rate Card", "src/config/fpaRateCard.js / buildFpaRateCardWorkbookView"),
    "pricing": ("FP&A 13 Pricing", "src/config/fpaPricing.js / buildFpaPricingWorkbookView"),
    "transition": ("FP&A 15 Transition", "src/config/fpaTransition.js / buildFpaTransitionWorkbookView"),
    "governance": ("FP&A 24 Governance", "Portal governance state + governance stack"),
    "changeLog": ("FP&A 28 Change Log", "src/config/fpaChangeLog.js / buildFpaChangeLogWorkbookView"),
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def is_blank(value) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0
    return False


def format_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def md(value) -> str:
    return format_value(value).replace("|", "\\|").replace("\n", " ").strip()


def norm(value):
    return value.strip() if isinstance(value, str) else value


def humanize(value: str) -> str:
    text = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    text = text.replace("_", " ").replace("Pct", "%").replace("Usd", "USD").replace("Id", "ID")
    return text.strip().title().replace("Fp&A", "FP&A").replace("Ai", "AI").replace("Gen AI", "GenAI")


def add_row(rows, field, portal_path, portal_value, provenance, reference, logic):
    if is_blank(portal_value):
        return
    rows.append({"field": field, "portalPath": portal_path, "portalValue": format_value(portal_value), "provenance": provenance, "reference": reference, "logic": logic})


def split_block(source: str, name: str) -> str:
    match = re.search(re.escape(name) + r"\s*=\s*\{(.*?)\n\};", source, re.S)
    if not match:
        raise ValueError(name)
    return match.group(1)


def parse_simple_object(block: str):
    result = {}
    for line in block.splitlines():
        match = re.match(r'^\s*([A-Za-z0-9_]+):\s*(.+?),\s*$', line.rstrip())
        if not match:
            continue
        key, raw = match.group(1), match.group(2).strip()
        if raw in {"true", "false"}:
            result[key] = raw == "true"
        elif raw.startswith('"') and raw.endswith('"'):
            result[key] = raw[1:-1]
        else:
            result[key] = raw
    return result


def parse_workspace_defaults():
    source = WORKSPACE_CONFIG_PATH.read_text(encoding="utf-8")
    names = {"benchmarks": "DEFAULT_BENCHMARKS", "aiBenefit": "DEFAULT_AI_BENEFIT", "opsModel": "DEFAULT_OPS_MODEL", "rateCard": "DEFAULT_RATE_CARD", "pricing": "DEFAULT_PRICING", "transition": "DEFAULT_TRANSITION", "governance": "DEFAULT_GOVERNANCE", "changeLog": "DEFAULT_CHANGE_LOG"}
    return {key: parse_simple_object(split_block(source, marker)) for key, marker in names.items()}

def parse_discovery_metadata():
    group_labels, proxy_fields, coverage_fields, tech_fields, pain_fields = {}, [], [], [], []
    group_re = re.compile(r'\{ id: "([^"]+)", label: "([^"]+)" \}')
    proxy_re = re.compile(r'\{ row: (\d+), id: "([^"]+)", groupId: "([^"]+)", label: "([^"]+)"')
    item_re = re.compile(r'\{ row: (\d+), id: "([^"]+)", label: "([^"]+)"')
    current = None
    for raw in DISCOVERY_CONFIG_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("export const FPA_DISCOVERY_PROXY_GROUPS"):
            current = "groups"
            continue
        if line.startswith("export const FPA_DISCOVERY_PROXY_FIELDS"):
            current = "proxy"
            continue
        if line.startswith("export const FPA_DISCOVERY_COVERAGE_FIELDS"):
            current = "coverage"
            continue
        if line.startswith("export const FPA_DISCOVERY_TECH_FIELDS"):
            current = "tech"
            continue
        if line.startswith("export const FPA_DISCOVERY_PAIN_POINT_FIELDS"):
            current = "pain"
            continue
        if line == "];":
            current = None
            continue
        if current == "groups":
            match = group_re.search(line)
            if match:
                group_labels[match.group(1)] = match.group(2)
        elif current == "proxy":
            match = proxy_re.search(line)
            if match:
                proxy_fields.append({"row": int(match.group(1)), "id": match.group(2), "groupId": match.group(3), "label": match.group(4)})
        elif current in {"coverage", "tech", "pain"}:
            match = item_re.search(line)
            if match:
                item = {"row": int(match.group(1)), "id": match.group(2), "label": match.group(3)}
                {"coverage": coverage_fields, "tech": tech_fields, "pain": pain_fields}[current].append(item)
    return group_labels, proxy_fields, coverage_fields, tech_fields, pain_fields


def parse_scope_metadata():
    l2_lookup, l3_lookup = {}, {}
    l2_re = re.compile(r'\{ id: "([^"]+)", row: (\d+), l2Number: (\d+), label: "([^"]+)", cluster: "([^"]+)", l3Count: (\d+) \}')
    l3_re = re.compile(r'\{ id: "([^"]+)", row: (\d+), l2Id: "([^"]+)", activity: "([^"]+)", cluster: "([^"]+)" \}')
    current = None
    for raw in SCOPE_CONFIG_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("export const FPA_SCOPE_L2_ROWS"):
            current = "l2"
            continue
        if line.startswith("const BASE_SCOPE_L3_ROWS"):
            current = "l3"
            continue
        if line == "];":
            current = None
            continue
        if current == "l2":
            match = l2_re.search(line)
            if match:
                l2_lookup[match.group(1)] = {"row": int(match.group(2)), "l2Number": int(match.group(3)), "label": match.group(4)}
        elif current == "l3":
            match = l3_re.search(line)
            if match:
                l2 = l2_lookup.get(match.group(3), {})
                l3_lookup[match.group(1)] = {"row": int(match.group(2)), "activity": match.group(4), "l2Number": l2.get("l2Number"), "l2Label": l2.get("label")}
    return l3_lookup


def compact_scope(row) -> str:
    return " | ".join([f"status={row.get('status', '')}", f"partial={row.get('partialPct', '')}", f"retainedToo={row.get('retainedToo', '')}", f"disposition={row.get('disposition', '')}", f"location={row.get('locationIntent', '')}"])


def build_report():
    workspace = load_json(DEALS_PATH)
    deal = next(item for item in workspace["deals"] if item.get("dealId") == TARGET_DEAL_ID)
    seed = next(item for item in workspace["deals"] if item.get("id") == SEED_DEAL_ID)
    users = {item["id"]: item for item in load_json(USERS_PATH) if item.get("id")}
    defaults = parse_workspace_defaults()
    group_labels, proxy_fields, coverage_fields, tech_fields, pain_fields = parse_discovery_metadata()
    scope_lookup = parse_scope_metadata()
    sections, evidence = [], deal.get("fieldEvidence", {})

    rows = []
    for field_key, label in DEAL_MASTER_FIELDS:
        value, info = deal.get(field_key), evidence.get(field_key, {})
        if info.get("fileName"):
            logic = "Direct workbook import."
            if format_value(info.get("workbookValue")) != format_value(value):
                logic = f"Direct workbook import. Workbook value {format_value(info.get('workbookValue'))} normalized to portal value {format_value(value)}."
            add_row(rows, label, field_key, value, "Workbook import", f"{info.get('fileName')} / {info.get('sheetName')} / {info.get('cell')}", logic)
    sections.append({"title": "Shared Deal Master", "intro": "Shared commercial inputs mirrored into `01 Deal Setup`.", "rows": rows})

    rows = []
    for code, title in {"FPA": "FP&A", "RTR": "RTR", "O2C": "O2C", "P2P": "P2P"}.items():
        scope_key, lead_key, owner_key = f"towerScope_{code}", f"towerLead_{code}", f"towerOwnerUserId_{code}"
        scope_info = evidence.get(scope_key, {})
        add_row(rows, f"{title} In Scope", scope_key, deal.get(scope_key), "Workbook import", f"{scope_info.get('fileName')} / {scope_info.get('sheetName')} / {scope_info.get('cell')}", str(scope_info.get("note") or "Workbook scope flag."))
        workbook_lead, portal_lead = format_value(evidence.get(lead_key, {}).get("portalValue")), format_value(deal.get(lead_key))
        owner = users.get(deal.get(owner_key, ""), {})
        logic = f"Workbook solution lead = {workbook_lead}. Portal display lead = {portal_lead}."
        if owner:
            logic += f" Portal user mapping = {owner.get('name')} <{owner.get('email')}>."
        add_row(rows, f"{title} Lead", lead_key, portal_lead, "Portal access override" if workbook_lead and portal_lead != workbook_lead else "Workbook import", f"workbook: {evidence.get(lead_key, {}).get('fileName')} / {evidence.get(lead_key, {}).get('sheetName')} / {evidence.get(lead_key, {}).get('cell')} ; portal user: {deal.get(owner_key)}", logic)
    sections.append({"title": "Deal Master - Tower Scope", "intro": "Tower leads can differ from workbook names because the portal maps them to real users for access control.", "rows": rows})

    rows = []
    owner = users.get(deal.get("dealOwnerUserId", ""), {})
    if owner:
        add_row(rows, "Deal Owner", "dealOwnerName", deal.get("dealOwnerName"), "Portal access mapping", f"backend/data/users.json / {owner.get('id')}", f"Portal owner user = {owner.get('name')} <{owner.get('email')}>.")
    for collaborator in deal.get("collaborators", []):
        add_row(rows, f"Collaborator - {collaborator.get('name')} ({collaborator.get('towerCode')})", f"collaborators[{collaborator.get('id')}]", f"{collaborator.get('name')} <{collaborator.get('email')}>", "Portal collaboration mapping", f"backend/data/deals.json / {deal.get('id')} / collaborators", "Controls which user can see and work on the assigned tower.")
    sections.append({"title": "Ownership and Access", "intro": "Portal user-to-deal mappings. These are not workbook commercial cells.", "rows": rows})

    rows = []
    for field_key in WORKFLOW_FIELDS:
        value, info = deal.get(field_key), evidence.get(field_key, {})
        label = WORKFLOW_LABELS.get(field_key, humanize(field_key))
        if info.get("note"):
            add_row(rows, label, field_key, value, "Portal import assumption", info.get("source", "Portal import assumption"), str(info.get("note")))
        elif norm(value) == norm(seed.get(field_key)):
            add_row(rows, label, field_key, value, "Seeded portal carry-forward", f"backend/data/deals.json / {seed.get('id')} / {field_key}", f"Carried from seeded portal deal {seed.get('draftLabel')}; not direct workbook cell data.")
        else:
            add_row(rows, label, field_key, value, "Portal deal state", f"backend/data/deals.json / {deal.get('id')} / {field_key}", "Current portal workflow value.")
    sections.append({"title": "Portal Workflow", "intro": "Portal-only state, notes, and workflow metadata.", "rows": rows})

    rows = []
    discovery, discovery_evidence = deal.get("fpaWorkspace", {}).get("discovery", {}), deal.get("fpaWorkspace", {}).get("discoveryEvidence", {})
    for field in [*proxy_fields, *tech_fields]:
        if field["id"] == "revenueBand":
            continue
        value, info = discovery.get(field["id"]), discovery_evidence.get(field["id"], {})
        logic = f"Group = {group_labels.get(field.get('groupId', ''), 'Technology / landscape')}. Direct workbook raw input."
        if info.get("effectiveValue") not in {None, ""}:
            logic += f" Effective workbook value = {format_value(info.get('effectiveValue'))}."
        if info.get("sourceClass"):
            logic += f" Source class = {info.get('sourceClass')}."
        if info.get("confidence"):
            logic += f" Confidence = {info.get('confidence')}."
        add_row(rows, field["label"], f"fpaWorkspace.discovery.{field['id']}", value, "Workbook import", f"{info.get('fileName')} / {info.get('sheetName')} / {info.get('cell')} ; effective {info.get('effectiveCell', '')}", logic)
    sections.append({"title": "FP&A 02 Discovery", "intro": "Field-level imports from `FPA_02 Discovery`.", "rows": rows})

    rows = []
    for field in coverage_fields:
        add_row(rows, field["label"], f"fpaWorkspace.discoveryCoverage.{field['id']}", deal.get("fpaWorkspace", {}).get("discoveryCoverage", {}).get(field["id"]), "Workbook checklist import", f"{MANAGER_WORKBOOK} / FPA_02 Discovery / H{field['row']}", "Workbook discovery-coverage checklist.")
    sections.append({"title": "FP&A 02 Discovery Coverage", "intro": "Checklist areas marked as covered in the workbook.", "rows": rows})

    rows = []
    for field in pain_fields:
        value = deal.get("fpaWorkspace", {}).get("discoveryPainPoints", {}).get(field["id"], {})
        if isinstance(value, dict) and not is_blank(value.get("present")):
            display = f"present={format_value(value.get('present'))}"
            if not is_blank(value.get("severity")):
                display += f" | severity={format_value(value.get('severity'))}"
            add_row(rows, field["label"], f"fpaWorkspace.discoveryPainPoints.{field['id']}", display, "Workbook pain-point import", f"{MANAGER_WORKBOOK} / FPA_02 Discovery / D{field['row']} and E{field['row']}", "Workbook present/severity pair.")
    sections.append({"title": "FP&A 02 Discovery Pain Points", "intro": "Pain points imported from the workbook present/severity grid.", "rows": rows})

    rows = []
    for field_id, value in deal.get("fpaWorkspace", {}).get("scopeL3", {}).items():
        meta = scope_lookup.get(field_id, {})
        label = f"L2 {meta.get('l2Number', '?')} - {meta.get('l2Label', field_id)} / {meta.get('activity', field_id)}"
        if value == DEFAULT_SCOPE_ROW:
            provenance, reference, logic = "Portal default", "src/config/fpaScope.js / DEFAULT_SCOPE_ROW", "Matches the default L3 scope row and feeds the workload roll-up."
        elif value == seed.get("fpaWorkspace", {}).get("scopeL3", {}).get(field_id):
            provenance, reference, logic = "Seeded portal carry-forward", f"backend/data/deals.json / {seed.get('id')} / fpaWorkspace.scopeL3.{field_id}", f"Carried from seeded portal deal {seed.get('draftLabel')} and used by the workload engine."
        else:
            provenance, reference, logic = "Portal deal override", f"backend/data/deals.json / {deal.get('id')} / fpaWorkspace.scopeL3.{field_id}", "Deal-specific scope override used by the workload engine."
        add_row(rows, label, f"fpaWorkspace.scopeL3.{field_id}", compact_scope(value), provenance, f"{reference} ; workbook row model = {meta.get('row', '')}", logic)
    sections.append({"title": SECTION_META['scopeL3'][0], "intro": "Editable L3 switchboard rows that feed scope roll-up and workload sizing.", "rows": rows})

    for section_key in ["benchmarks", "aiBenefit", "opsModel", "rateCard", "pricing", "transition", "governance", "changeLog"]:
        rows, current = [], deal.get("fpaWorkspace", {}).get(section_key, {})
        seed_section, default_section = seed.get("fpaWorkspace", {}).get(section_key, {}), defaults.get(section_key, {})
        for field_key, value in current.items():
            if is_blank(value):
                continue
            if norm(value) == norm(default_section.get(field_key)):
                provenance, reference, logic = "Portal default", f"src/config/fpaWorkspace.js / {section_key}.{field_key}", f"Matches portal default. Formula owner = {SECTION_META[section_key][1]}."
            elif norm(value) == norm(seed_section.get(field_key)):
                provenance, reference, logic = "Seeded portal carry-forward", f"backend/data/deals.json / {seed.get('id')} / fpaWorkspace.{section_key}.{field_key}", f"Carried from seeded portal deal {seed.get('draftLabel')}. Formula owner = {SECTION_META[section_key][1]}."
            else:
                provenance, reference, logic = "Portal deal override", f"backend/data/deals.json / {deal.get('id')} / fpaWorkspace.{section_key}.{field_key}", f"Deal-specific stored input. Formula owner = {SECTION_META[section_key][1]}."
            add_row(rows, humanize(field_key), f"fpaWorkspace.{section_key}.{field_key}", value, provenance, reference, logic)
        sections.append({"title": SECTION_META[section_key][0], "intro": f"Stored editable inputs for this section. Formula owner = {SECTION_META[section_key][1]}.", "rows": rows})

    all_rows = [row for section in sections for row in section["rows"]]
    docs, source_inventory = deal.get("sourceDocuments", {}), []
    manager = docs.get("managerWorkbook", {})
    if manager:
        source_inventory.append({"file": manager.get("file", MANAGER_WORKBOOK), "type": "XLSX", "fieldBacked": "Yes", "notes": "Direct field import source."})
    for item in docs.get("workbooks", []) or []:
        source_inventory.append({"file": item.get("file", ""), "type": item.get("type", "XLSX"), "fieldBacked": "No", "notes": "Rescanned as inventory only."})
    for item in docs.get("pdfBaselinePacks", []) or []:
        source_inventory.append({"file": item.get("file", ""), "type": item.get("type", "PDF"), "fieldBacked": "No", "notes": "Indexed only; not field-level parsed."})
    return {"generatedAt": now_iso(), "deal": {"id": deal.get("id"), "draftLabel": deal.get("draftLabel"), "dealId": deal.get("dealId"), "clientName": deal.get("clientName")}, "summary": {"rowCount": len(all_rows), "provenanceCounts": dict(sorted(Counter(row["provenance"] for row in all_rows).items()))}, "sourceInventory": source_inventory, "sections": sections}


def build_markdown(report) -> str:
    lines = ["# KDP field provenance report", "", f"Generated: `{report['generatedAt']}`", "", "## Deal", "", f"- Deal record: `{report['deal']['id']}`", f"- Draft label: `{report['deal']['draftLabel']}`", f"- Deal ID: `{report['deal']['dealId']}`", f"- Client: `{report['deal']['clientName']}`", "- Empty portal fields are intentionally skipped.", "", "## Provenance summary", "", "| Provenance type | Row count |", "| --- | --- |"]
    for kind, count in report["summary"]["provenanceCounts"].items():
        lines.append(f"| {md(kind)} | {count} |")
    lines += ["", "## Source inventory", "", "Only `KDP_E2E_Finance_Solution_Model_v6.xlsx` is field-backed in the current portal snapshot. Other workbooks and PDFs are inventory/context only in this pass.", "", "| File | Type | Field-backed? | Notes |", "| --- | --- | --- | --- |"]
    for item in report["sourceInventory"]:
        lines.append(f"| {md(item['file'])} | {md(item['type'])} | {md(item['fieldBacked'])} | {md(item['notes'])} |")
    lines.append("")
    for section in report["sections"]:
        lines += [f"## {section['title']}", "", section["intro"], "", "| Field | Portal path | Portal value | Provenance | Reference | Logic |", "| --- | --- | --- | --- | --- | --- |"]
        for row in section["rows"]:
            lines.append(f"| {md(row['field'])} | {md(row['portalPath'])} | {md(row['portalValue'])} | {md(row['provenance'])} | {md(row['reference'])} | {md(row['logic'])} |")
        lines.append("")
    return "\n".join(lines) + "\n"


def main() -> None:
    report = build_report()
    REPORT_JSON_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    REPORT_MD_PATH.write_text(build_markdown(report), encoding="utf-8")
    print(f"Report JSON: {REPORT_JSON_PATH}")
    print(f"Report MD: {REPORT_MD_PATH}")
    print(f"Rows: {report['summary']['rowCount']}")


if __name__ == "__main__":
    main()
