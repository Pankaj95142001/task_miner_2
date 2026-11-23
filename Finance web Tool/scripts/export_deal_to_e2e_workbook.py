from __future__ import annotations

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEALS_PATH = ROOT / "backend" / "data" / "deals.json"
TEMPLATE_PATH = ROOT / "docs" / "E2E_Finance_Solution_Model_v6.xlsx"
REPORT_PATH = ROOT / "docs" / "Gaurav" / "kdp-manager-workbook-import.generated.json"
SCOPE_CONFIG_PATH = ROOT / "src" / "config" / "fpaScope.js"
OUTPUT_DIR = ROOT / "docs" / "generated"

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CONTENT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
XML_NS = "http://www.w3.org/XML/1998/namespace"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006"
X14AC_NS = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"
X14_NS = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"
XM_NS = "http://schemas.microsoft.com/office/excel/2006/main"
X15_NS = "http://schemas.microsoft.com/office/spreadsheetml/2010/11/main"
X15AC_NS = "http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac"
XR_NS = "http://schemas.microsoft.com/office/spreadsheetml/2014/revision"
XR2_NS = "http://schemas.microsoft.com/office/spreadsheetml/2015/revision2"
XR3_NS = "http://schemas.microsoft.com/office/spreadsheetml/2016/revision3"
XR6_NS = "http://schemas.microsoft.com/office/spreadsheetml/2016/revision6"
XR10_NS = "http://schemas.microsoft.com/office/spreadsheetml/2016/revision10"
XCALCF_NS = "http://schemas.microsoft.com/office/spreadsheetml/2018/calcfeatures"
LOEXT_NS = "http://schemas.libreoffice.org/"

OPENXML_PREFIXES = {
    "r": DOC_REL_NS,
    "mc": MC_NS,
    "x14ac": X14AC_NS,
    "x14": X14_NS,
    "xm": XM_NS,
    "x15": X15_NS,
    "x15ac": X15AC_NS,
    "xr": XR_NS,
    "xr2": XR2_NS,
    "xr3": XR3_NS,
    "xr6": XR6_NS,
    "xr10": XR10_NS,
    "xcalcf": XCALCF_NS,
    "loext": LOEXT_NS,
}


def qn(tag: str, namespace: str = MAIN_NS) -> str:
    return f"{{{namespace}}}{tag}"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def maybe_fix_mojibake(value):
    if isinstance(value, dict):
        return {key: maybe_fix_mojibake(item) for key, item in value.items()}
    if isinstance(value, list):
        return [maybe_fix_mojibake(item) for item in value]
    if not isinstance(value, str):
        return value

    markers = ("â€”", "â€“", "â†’", "·", "Ã", "â€™", "â€œ", "â€", "")
    text = value.strip()
    if any(marker in text for marker in markers):
        try:
            return text.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return text
    return text


def load_current_deal() -> dict:
    workspace = maybe_fix_mojibake(load_json(DEALS_PATH))
    current_id = str(workspace.get("currentId") or "").strip()
    deals = workspace.get("deals") if isinstance(workspace.get("deals"), list) else []
    for deal in deals:
        if str(deal.get("id") or "").strip() == current_id:
            return deal
    if deals:
        return deals[0]
    raise SystemExit("No deal found in backend/data/deals.json")


def get_path(source: dict, dotted_path: str):
    node = source
    for part in dotted_path.split("."):
        if not isinstance(node, dict):
            return None
        node = node.get(part)
    return node


def col_to_index(col: str) -> int:
    total = 0
    for ch in col:
        total = total * 26 + (ord(ch.upper()) - 64)
    return total


def cell_ref_parts(cell_ref: str) -> tuple[str, int]:
    match = re.fullmatch(r"([A-Z]+)(\d+)", cell_ref)
    if not match:
        raise ValueError(f"Invalid cell reference: {cell_ref}")
    return match.group(1), int(match.group(2))


def sort_key_for_cell_ref(cell_ref: str) -> tuple[int, int]:
    col, row = cell_ref_parts(cell_ref)
    return row, col_to_index(col)


def ensure_sheet_data(root: ET.Element) -> ET.Element:
    sheet_data = root.find(qn("sheetData"))
    if sheet_data is None:
        sheet_data = ET.SubElement(root, qn("sheetData"))
    return sheet_data


def ensure_row(sheet_data: ET.Element, row_number: int) -> ET.Element:
    for row in sheet_data.findall(qn("row")):
        if int(row.attrib.get("r", "0")) == row_number:
            return row

    row = ET.Element(qn("row"), {"r": str(row_number)})
    inserted = False
    rows = list(sheet_data.findall(qn("row")))
    for index, existing in enumerate(rows):
        if int(existing.attrib.get("r", "0")) > row_number:
            sheet_data.insert(index, row)
            inserted = True
            break
    if not inserted:
        sheet_data.append(row)
    return row


def ensure_cell(root: ET.Element, cell_ref: str) -> ET.Element:
    col_letters, row_number = cell_ref_parts(cell_ref)
    sheet_data = ensure_sheet_data(root)
    row = ensure_row(sheet_data, row_number)

    for cell in row.findall(qn("c")):
        if cell.attrib.get("r") == cell_ref:
            return cell

    cell = ET.Element(qn("c"), {"r": cell_ref})
    new_index = col_to_index(col_letters)
    inserted = False
    cells = list(row.findall(qn("c")))
    for index, existing in enumerate(cells):
        existing_ref = existing.attrib.get("r", "")
        existing_col, _ = cell_ref_parts(existing_ref)
        if col_to_index(existing_col) > new_index:
            row.insert(index, cell)
            inserted = True
            break
    if not inserted:
        row.append(cell)
    return cell


def clear_cell_value(cell: ET.Element) -> None:
    for child in list(cell):
        if child.tag in {qn("f"), qn("v"), qn("is")}:
            cell.remove(child)
    cell.attrib.pop("t", None)


def set_blank(cell: ET.Element) -> None:
    clear_cell_value(cell)


def set_inline_string(cell: ET.Element, value: str) -> None:
    clear_cell_value(cell)
    cell.attrib["t"] = "inlineStr"
    is_node = ET.SubElement(cell, qn("is"))
    text_node = ET.SubElement(is_node, qn("t"))
    if value.startswith(" ") or value.endswith(" ") or "\n" in value:
        text_node.set(f"{{{XML_NS}}}space", "preserve")
    text_node.text = value


def set_number(cell: ET.Element, value) -> None:
    clear_cell_value(cell)
    value_node = ET.SubElement(cell, qn("v"))
    value_node.text = str(value)


def excel_serial_from_iso_date(value: str) -> int:
    target = datetime.strptime(value, "%Y-%m-%d").date()
    return (target - date(1899, 12, 30)).days


def workbook_ui_date(value: str) -> str:
    target = datetime.strptime(value, "%Y-%m-%d").date()
    return target.strftime("%d-%b-%Y")


def write_cell(root: ET.Element, cell_ref: str, value, kind: str) -> None:
    cell = ensure_cell(root, cell_ref)
    if kind == "blank":
        set_blank(cell)
    elif kind == "number":
        set_number(cell, value)
    else:
        set_inline_string(cell, "" if value is None else str(value))


def deal_master_cell_value(portal_path: str, raw_value):
    if portal_path == "bidDate":
        return workbook_ui_date(str(raw_value)), "string"

    if portal_path in {
        "discountRate",
        "colaRate",
        "corporateOverhead",
        "committedProdY2",
        "committedProdY3",
        "committedProdY4",
    }:
        if raw_value in (None, ""):
            return None, "blank"
        return float(str(raw_value).replace(",", "")) / 100, "number"

    if portal_path in {"contractTerm", "fxRate", "customerFinanceFte", "financeCostBaseline"}:
        if raw_value in (None, ""):
            return None, "blank"
        return float(str(raw_value).replace(",", "")), "number"

    if portal_path.startswith("towerScope_"):
        return ("Yes" if bool(raw_value) else "No"), "string"

    if raw_value in (None, ""):
        return None, "blank"

    return maybe_fix_mojibake(raw_value), "string"


def discovery_field_id(portal_path: str) -> str:
    return portal_path.split(".")[-1]


def build_scope_row_map() -> dict[str, int]:
    source = SCOPE_CONFIG_PATH.read_text(encoding="utf-8")
    pattern = re.compile(r'\{ id: "(?P<id>[^"]+)", row: (?P<row>\d+), l2Id: "(?P<l2>[^"]+)"')
    rows: dict[str, int] = {}
    for match in pattern.finditer(source):
        rows[match.group("id")] = int(match.group("row"))
    return rows


def tech_row_support_values(report_row: dict) -> tuple[str, str]:
    src_code = str(report_row.get("owner") or "").strip()
    defaulted_flag = "1" if bool(report_row.get("defaulted")) else "0"
    if src_code not in {"CC", "CE", "PA", "BM", "MKT"}:
        src_code = ""
    return src_code, defaulted_flag


def build_sheet_updates(deal: dict, report: dict) -> dict[str, list[tuple[str, object, str]]]:
    updates = {
        "E2E Deal Master": [],
        "FPA_02 Discovery": [],
        "FPA_03 Scope L3": [],
    }

    fields = report.get("fields") if isinstance(report.get("fields"), list) else []
    discovery = get_path(deal, "fpaWorkspace.discovery") or {}
    discovery_evidence = get_path(deal, "fpaWorkspace.discoveryEvidence") or {}
    discovery_coverage = get_path(deal, "fpaWorkspace.discoveryCoverage") or {}
    discovery_pain = get_path(deal, "fpaWorkspace.discoveryPainPoints") or {}

    for row in fields:
        section = str(row.get("section") or "").strip()
        portal_path = str(row.get("portalPath") or "").strip()
        cell = str(row.get("cell") or "").strip()
        if not portal_path:
            continue

        if section == "Deal Master" and cell:
            raw_value = deal.get(portal_path)
            value, kind = deal_master_cell_value(portal_path, raw_value)
            updates["E2E Deal Master"].append((cell, value, kind))
            continue

        if section == "Deal Master > Tower Scope" and cell:
            raw_value = deal.get(portal_path)
            value, kind = deal_master_cell_value(portal_path, raw_value)
            updates["E2E Deal Master"].append((cell, value, kind))
            continue

        if section == "FP&A Discovery" and cell:
            field_id = discovery_field_id(portal_path)
            raw_value = discovery.get(field_id)
            kind = "blank" if raw_value in (None, "") else "string"
            updates["FPA_02 Discovery"].append((cell, maybe_fix_mojibake(raw_value), kind))
            _col, row_number = cell_ref_parts(cell)

            if 7 <= row_number <= 36:
                evidence = discovery_evidence.get(field_id, {}) if isinstance(discovery_evidence.get(field_id), dict) else {}
                source_code = str(evidence.get("sourceClassCode") or "").strip()
                confidence = str(evidence.get("confidence") or "").strip()
                owner = maybe_fix_mojibake(str(evidence.get("owner") or evidence.get("source") or "").strip())
                evidence_date = maybe_fix_mojibake(str(evidence.get("rawDateLabel") or evidence.get("date") or "").strip())
                criticality = str(evidence.get("criticality") or "").strip()
                updates["FPA_02 Discovery"].extend(
                    [
                        (f"F{row_number}", source_code, "blank" if not source_code else "string"),
                        (f"G{row_number}", confidence, "blank" if not confidence else "string"),
                        (f"H{row_number}", owner, "blank" if not owner else "string"),
                        (f"I{row_number}", evidence_date, "blank" if not evidence_date else "string"),
                        (f"J{row_number}", criticality, "blank" if not criticality else "string"),
                    ]
                )
            elif 64 <= row_number <= 68:
                src_code, defaulted_flag = tech_row_support_values(row)
                updates["FPA_02 Discovery"].extend(
                    [
                        (f"H{row_number}", src_code, "blank" if not src_code else "string"),
                        (f"I{row_number}", defaulted_flag, "blank" if defaulted_flag == "" else "number"),
                    ]
                )
            continue

        if section == "FP&A Discovery Coverage" and cell:
            field_id = discovery_field_id(portal_path)
            raw_value = discovery_coverage.get(field_id)
            updates["FPA_02 Discovery"].append((cell, raw_value, "blank" if raw_value in (None, "") else "string"))
            continue

        if section == "FP&A Discovery Pain Points":
            field_id = discovery_field_id(portal_path)
            pain = discovery_pain.get(field_id, {}) if isinstance(discovery_pain.get(field_id), dict) else {}
            present_cell = str(row.get("presentCell") or "").strip()
            severity_cell = str(row.get("severityCell") or "").strip()
            present = pain.get("present")
            severity = pain.get("severity")
            if present_cell:
                updates["FPA_02 Discovery"].append((present_cell, present, "blank" if present in (None, "") else "string"))
            if severity_cell:
                updates["FPA_02 Discovery"].append((severity_cell, severity, "blank" if severity in (None, "") else "string"))

    scope_rows = build_scope_row_map()
    scope_values = get_path(deal, "fpaWorkspace.scopeL3") or {}
    for scope_id, row_number in scope_rows.items():
        row = scope_values.get(scope_id, {}) if isinstance(scope_values.get(scope_id), dict) else {}
        updates["FPA_03 Scope L3"].extend(
            [
                (f"F{row_number}", row.get("status"), "blank" if not row.get("status") else "string"),
                (f"G{row_number}", row.get("partialPct"), "blank" if row.get("partialPct") in (None, "") else "number"),
                (f"I{row_number}", row.get("retainedToo"), "blank" if not row.get("retainedToo") else "string"),
                (f"J{row_number}", maybe_fix_mojibake(row.get("disposition")), "blank" if not row.get("disposition") else "string"),
                (f"K{row_number}", maybe_fix_mojibake(row.get("locationIntent")), "blank" if not row.get("locationIntent") else "string"),
            ]
        )

    for sheet_name in updates:
        deduped: dict[str, tuple[str, object, str]] = {}
        for cell_ref, value, kind in updates[sheet_name]:
            deduped[cell_ref] = (cell_ref, value, kind)
        updates[sheet_name] = sorted(deduped.values(), key=lambda item: sort_key_for_cell_ref(item[0]))

    return updates


def update_workbook_calc(root: ET.Element) -> ET.Element:
    calc_pr = root.find(qn("calcPr"))
    if calc_pr is None:
        calc_pr = ET.SubElement(root, qn("calcPr"))
    calc_pr.set("calcMode", "auto")
    calc_pr.set("fullCalcOnLoad", "1")
    calc_pr.set("forceFullCalc", "1")
    calc_pr.set("calcOnSave", "1")
    return root


def strip_calc_chain_rels(root: ET.Element) -> ET.Element:
    for rel in list(root):
        target = str(rel.attrib.get("Target") or "")
        rel_type = str(rel.attrib.get("Type") or "")
        if target.endswith("calcChain.xml") or rel_type.endswith("/calcChain"):
            root.remove(rel)
    return root


def strip_calc_chain_content_type(root: ET.Element) -> ET.Element:
    for child in list(root):
        if child.tag != qn("Override", CONTENT_NS):
            continue
        if str(child.attrib.get("PartName") or "") == "/xl/calcChain.xml":
            root.remove(child)
    return root


def inject_root_namespaces(xml_text: str, namespaces: dict[str, str]) -> str:
    match = re.search(r"<([A-Za-z0-9_:.\-]+)([^>]*)>", xml_text)
    if match is None:
        return xml_text
    open_tag = match.group(0)
    missing = [
        f'xmlns:{prefix}="{uri}"'
        for prefix, uri in namespaces.items()
        if f'xmlns:{prefix}=' not in open_tag
    ]
    if not missing:
        return xml_text
    patched_tag = open_tag[:-1] + " " + " ".join(missing) + ">"
    return xml_text.replace(open_tag, patched_tag, 1)


def to_xml_bytes(root: ET.Element, default_namespace: str = MAIN_NS) -> bytes:
    ET.register_namespace("", default_namespace)
    for prefix, namespace in OPENXML_PREFIXES.items():
        ET.register_namespace(prefix, namespace)
    payload = ET.tostring(root, encoding="UTF-8").decode("UTF-8")
    if default_namespace == MAIN_NS:
        payload = inject_root_namespaces(payload, OPENXML_PREFIXES)
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + payload).encode("UTF-8")


def build_output_name(deal: dict) -> str:
    safe_deal_id = re.sub(r"[^A-Za-z0-9._-]+", "_", str(deal.get("dealId") or "deal"))
    return f"{safe_deal_id}_portal_filled_E2E_Finance_Solution_Model_v6.xlsx"


def export_workbook() -> Path:
    deal = load_current_deal()
    report = maybe_fix_mojibake(load_json(REPORT_PATH))
    updates = build_sheet_updates(deal, report)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / build_output_name(deal)

    sheet_targets = {
        "E2E Deal Master": "xl/worksheets/sheet2.xml",
        "FPA_02 Discovery": "xl/worksheets/sheet23.xml",
        "FPA_03 Scope L3": "xl/worksheets/sheet24.xml",
    }

    with zipfile.ZipFile(TEMPLATE_PATH, "r") as source_zip:
        file_map = {name: source_zip.read(name) for name in source_zip.namelist() if name != "xl/calcChain.xml"}

    for sheet_name, target_path in sheet_targets.items():
        root = ET.fromstring(file_map[target_path])
        for cell_ref, value, kind in updates.get(sheet_name, []):
            write_cell(root, cell_ref, value, kind)
        file_map[target_path] = to_xml_bytes(root, MAIN_NS)

    workbook_path = "xl/workbook.xml"
    workbook_root = ET.fromstring(file_map[workbook_path])
    file_map[workbook_path] = to_xml_bytes(update_workbook_calc(workbook_root), MAIN_NS)

    workbook_rels_path = "xl/_rels/workbook.xml.rels"
    if workbook_rels_path in file_map:
        rels_root = ET.fromstring(file_map[workbook_rels_path])
        file_map[workbook_rels_path] = to_xml_bytes(strip_calc_chain_rels(rels_root), REL_NS)

    content_types_path = "[Content_Types].xml"
    if content_types_path in file_map:
        content_root = ET.fromstring(file_map[content_types_path])
        file_map[content_types_path] = to_xml_bytes(strip_calc_chain_content_type(content_root), CONTENT_NS)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as target_zip:
        for name, payload in file_map.items():
            target_zip.writestr(name, payload)

    return output_path


def main() -> None:
    output_path = export_workbook()
    print(json.dumps({"output": str(output_path.relative_to(ROOT))}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
