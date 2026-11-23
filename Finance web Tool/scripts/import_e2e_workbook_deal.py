from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEALS_PATH = ROOT / "backend" / "data" / "deals.json"
USERS_PATH = ROOT / "backend" / "data" / "users.json"
DOCS_DIR = ROOT / "docs" / "Gaurav"
SCOPE_CONFIG_PATH = ROOT / "src" / "config" / "fpaScope.js"

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}

SOURCE_CLASS_LABELS = {
    "CC": "Client-confirmed",
    "CE": "Client-estimated",
    "PA": "Practitioner assumption",
    "BM": "Benchmark",
    "MKT": "Market evidence",
}

CONFIDENCE_LABELS = {
    "H": "High",
    "M": "Medium",
    "L": "Low",
}

DEAL_MASTER_FIELD_MAP = [
    {"portalPath": "clientName", "label": "Client Name", "cell": "D6"},
    {"portalPath": "dealId", "label": "Pursuit / Deal ID", "cell": "D7"},
    {"portalPath": "presalesLead", "label": "Presales Lead", "cell": "D8"},
    {"portalPath": "bidDate", "label": "Bid Date", "cell": "D9", "transform": "date_ui"},
    {"portalPath": "contractTerm", "label": "Contract Term (years)", "cell": "D11"},
    {"portalPath": "discountRate", "label": "Discount Rate", "cell": "D12", "transform": "percent_ui"},
    {"portalPath": "displayCurrency", "label": "Display Currency", "cell": "D16"},
    {"portalPath": "fxRate", "label": "FX rate (1 USD = x display)", "cell": "D17"},
    {"portalPath": "pricingConstruct", "label": "Pricing Construct (primary bid)", "cell": "D20"},
    {"portalPath": "transitionCommercials", "label": "Transition Commercials", "cell": "D21"},
    {"portalPath": "transformationFunding", "label": "Transformation Funding", "cell": "D22"},
    {"portalPath": "benchmarkPolicy", "label": "Benchmark Percentile Policy", "cell": "D25"},
    {"portalPath": "corporateOverhead", "label": "Corporate Overhead Allocation on cost", "cell": "D26", "transform": "percent_ui"},
    {"portalPath": "committedProdY2", "label": "Committed productivity Y2", "cell": "D29", "transform": "percent_ui_optional"},
    {"portalPath": "committedProdY3", "label": "Committed productivity Y3", "cell": "D30", "transform": "percent_ui_optional"},
    {"portalPath": "committedProdY4", "label": "Committed productivity Y4+", "cell": "D31", "transform": "percent_ui_optional"},
    {"portalPath": "customerFinanceFte", "label": "Total customer Finance FTE (all towers, optional)", "cell": "D43"},
    {"portalPath": "financeCostBaseline", "label": "Total customer Finance cost baseline (USD/yr, optional)", "cell": "D44"},
    {"portalPath": "programName", "label": "Programme name", "cell": "D45"},
]

TOWER_SCOPE_ROWS = [
    {"row": 36, "code": "FPA"},
    {"row": 37, "code": "RTR"},
    {"row": 38, "code": "O2C"},
    {"row": 39, "code": "P2P"},
]

DISCOVERY_ROWS = [
    {"row": 7, "fieldId": "industryVertical", "label": "Industry Vertical"},
    {"row": 8, "fieldId": "annualRevenueUsdM", "label": "Annual Revenue (USD $B)"},
    {"row": 10, "fieldId": "legalEntities", "label": "# Legal Entities"},
    {"row": 11, "fieldId": "businessUnits", "label": "# Business Units"},
    {"row": 12, "fieldId": "employeeCount000", "label": "Employee Count (000s)"},
    {"row": 13, "fieldId": "geoCountries", "label": "Geographic Footprint (# countries)"},
    {"row": 14, "fieldId": "languagesBeyondEnglish", "label": "Languages beyond English (#)"},
    {"row": 15, "fieldId": "costCentres", "label": "# Cost Centres"},
    {"row": 16, "fieldId": "productServiceLines", "label": "# Products / Service Lines"},
    {"row": 17, "fieldId": "forecastCadence", "label": "Forecast Cadence"},
    {"row": 18, "fieldId": "planningIterationsPerBudget", "label": "Planning Iterations per Budget"},
    {"row": 19, "fieldId": "forecastVersionsMaintained", "label": "Forecast Versions Maintained"},
    {"row": 20, "fieldId": "reportPacksPerMonth", "label": "# Report Packs / month"},
    {"row": 21, "fieldId": "adhocAnalysisIntensity", "label": "Ad-hoc Analysis Intensity"},
    {"row": 22, "fieldId": "epmPlatform", "label": "EPM Tool in Place"},
    {"row": 23, "fieldId": "monthlyCloseComplexity", "label": "Monthly Close Complexity"},
    {"row": 24, "fieldId": "processMaturity", "label": "Planning & Forecasting Maturity"},
    {"row": 25, "fieldId": "automationMaturity", "label": "Automation Maturity"},
    {"row": 26, "fieldId": "aiMaturity", "label": "AI Maturity"},
    {"row": 27, "fieldId": "digitalMaturity", "label": "Customer Digital Maturity"},
    {"row": 28, "fieldId": "competitiveIntensity", "label": "Competitive Intensity"},
    {"row": 29, "fieldId": "platformModernizationInScope", "label": "EPM Modernisation in Transformation Scope?"},
    {"row": 30, "fieldId": "peakMonth1", "label": "Peak Month 1"},
    {"row": 31, "fieldId": "peakMonth2", "label": "Peak Month 2"},
    {"row": 32, "fieldId": "peakMonth3", "label": "Peak Month 3"},
    {"row": 33, "fieldId": "retainedOrgIntent", "label": "Retained-Organisation Intent"},
    {"row": 34, "fieldId": "dataSourcesCount", "label": "# Data Sources feeding the tower"},
    {"row": 35, "fieldId": "currentTowerStaff", "label": "# FP&A Planners / BPs (current)"},
    {"row": 36, "fieldId": "currentTowerCostBaselineUsd", "label": "Current FP&A Cost Baseline (USD/yr)"},
    {"row": 64, "fieldId": "erpLandscape", "label": "ERP GL feed"},
    {"row": 65, "fieldId": "consolidationApproach", "label": "Close / consolidation tool"},
    {"row": 66, "fieldId": "biLandscape", "label": "BI / reporting layer"},
    {"row": 67, "fieldId": "dataMartMaturity", "label": "Finance data layer"},
    {"row": 68, "fieldId": "governanceMode", "label": "Master data management"},
]

COVERAGE_ROWS = [
    {"row": 41, "fieldId": "volumesCoreDrivers", "label": "Volumes (FP&A core drivers)"},
    {"row": 42, "fieldId": "currentFteByProcess", "label": "Current FTE by process"},
    {"row": 43, "fieldId": "platformAndMaturity", "label": "Platform and maturity"},
    {"row": 44, "fieldId": "automationAlreadyAchieved", "label": "Automation % already achieved"},
    {"row": 45, "fieldId": "kpiBaselineCycleMetrics", "label": "KPI baseline / cycle metrics"},
    {"row": 46, "fieldId": "activityInventory", "label": "Activity / report inventory (with effort)"},
    {"row": 47, "fieldId": "closeCalendar", "label": "Close / process calendar"},
    {"row": 48, "fieldId": "existingSlasKpis", "label": "Existing SLAs / KPIs"},
    {"row": 49, "fieldId": "currentCostBaseline", "label": "Current cost baseline"},
    {"row": 50, "fieldId": "painPointsPriorities", "label": "Pain points and priorities"},
    {"row": 51, "fieldId": "retainedOrgIntentShared", "label": "Retained-org intent shared"},
    {"row": 52, "fieldId": "dataSourceLandscape", "label": "Data-source landscape"},
    {"row": 53, "fieldId": "peakCalendarConfirmed", "label": "Peak calendar confirmed"},
]

PAIN_ROWS = [
    {"row": 80, "fieldId": "budgetCycleTooLong", "label": "Budget cycle too long (>12 weeks)"},
    {"row": 81, "fieldId": "forecastAccuracyPoor", "label": "Forecast accuracy poor (>10% MAPE)"},
    {"row": 82, "fieldId": "excelDependentConsolidation", "label": "Excel-dependent consolidation"},
    {"row": 83, "fieldId": "reportProliferation", "label": "Report proliferation / low usage"},
    {"row": 84, "fieldId": "lateCloseDelays", "label": "Late close delays flash and commentary"},
    {"row": 85, "fieldId": "weakDriverGovernance", "label": "Weak driver governance"},
    {"row": 86, "fieldId": "limitedScenarioCapability", "label": "Limited scenario capability"},
    {"row": 87, "fieldId": "businessPartnersConsumedByDataPrep", "label": "Business partners consumed by data prep"},
]

EXCLUDED_CAPTURE_SHEETS = {
    "TAB GUIDE",
    "FPA_00 Cover",
    "FPA_00 Logic",
    "FPA_00 Dict",
    "FPA_00 KDP Baseline",
}

EXTRA_CAPTURE_SHEETS = {
    "E2E Deal Master",
    "E2E Evidence Register",
    "E2E Calibration Closure",
}


class XlsxBook:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.zip_file = zipfile.ZipFile(self.path)
        self.shared_strings = self._load_shared_strings()
        self.style_is_date = self._load_date_styles()
        self.sheet_targets = self._load_sheet_targets()
        self._sheet_cache: dict[str, dict[str, str]] = {}

    def _read_xml(self, name: str) -> ET.Element:
        return ET.fromstring(self.zip_file.read(name))

    def _load_shared_strings(self) -> list[str]:
        try:
            root = self._read_xml("xl/sharedStrings.xml")
        except KeyError:
            return []
        values: list[str] = []
        for item in root.findall("a:si", NS):
            text_parts: list[str] = []
            for node in item.iter():
                if node.tag == f"{{{NS['a']}}}t":
                    text_parts.append(node.text or "")
            values.append("".join(text_parts))
        return values

    def _load_date_styles(self) -> dict[int, bool]:
        builtin_date_ids = {14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58}
        style_map: dict[int, bool] = {}
        custom_date_ids: set[int] = set()
        try:
            root = self._read_xml("xl/styles.xml")
        except KeyError:
            return style_map
        numfmts = root.find("a:numFmts", NS)
        if numfmts is not None:
            for fmt in numfmts.findall("a:numFmt", NS):
                fmt_id = int(fmt.attrib.get("numFmtId", "0"))
                code = (fmt.attrib.get("formatCode") or "").lower()
                if ("y" in code or "d" in code) or ("m" in code and any(marker in code for marker in ["d", "y", "h", "s"])):
                    custom_date_ids.add(fmt_id)
        cell_xfs = root.find("a:cellXfs", NS)
        if cell_xfs is not None:
            for index, xf in enumerate(cell_xfs.findall("a:xf", NS)):
                numfmt_id = int(xf.attrib.get("numFmtId", "0"))
                style_map[index] = numfmt_id in builtin_date_ids or numfmt_id in custom_date_ids
        return style_map

    def _load_sheet_targets(self) -> dict[str, str]:
        workbook = self._read_xml("xl/workbook.xml")
        rels = self._read_xml("xl/_rels/workbook.xml.rels")
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("pr:Relationship", NS)}
        targets: dict[str, str] = {}
        for sheet in workbook.find("a:sheets", NS).findall("a:sheet", NS):
            sheet_name = sheet.attrib["name"]
            rel_id = sheet.attrib[f"{{{NS['r']}}}id"]
            target = rel_map[rel_id]
            if not target.startswith("xl/"):
                target = f"xl/{target.lstrip('/')}"
            targets[sheet_name] = target
        return targets

    @property
    def sheet_names(self) -> list[str]:
        return list(self.sheet_targets.keys())

    def _from_excel_date(self, value: str) -> str:
        base = datetime(1899, 12, 30)
        return (base + timedelta(days=float(value))).strftime("%d-%b-%Y")

    def _decode_cell(self, cell: ET.Element) -> str:
        cell_type = cell.attrib.get("t")
        style_index = int(cell.attrib.get("s", "0"))
        if cell_type == "inlineStr":
            node = cell.find("a:is/a:t", NS)
            return (node.text or "").strip() if node is not None else ""
        value_node = cell.find("a:v", NS)
        if value_node is None:
            return ""
        value = value_node.text or ""
        if cell_type == "s":
            try:
                return (self.shared_strings[int(value)] or "").strip()
            except Exception:
                return value.strip()
        if cell_type == "b":
            return "TRUE" if value == "1" else "FALSE"
        if cell_type == "str":
            return value.strip()
        if self.style_is_date.get(style_index):
            try:
                return self._from_excel_date(value)
            except Exception:
                pass
        try:
            number = float(value)
            return str(int(number)) if number.is_integer() else str(number)
        except Exception:
            return value.strip()

    def _sheet_cells(self, sheet_name: str) -> dict[str, str]:
        if sheet_name not in self._sheet_cache:
            root = self._read_xml(self.sheet_targets[sheet_name])
            self._sheet_cache[sheet_name] = {
                cell.attrib.get("r", ""): clean_text(self._decode_cell(cell))
                for cell in root.iterfind(".//a:c", NS)
                if cell.attrib.get("r")
            }
        return self._sheet_cache[sheet_name]

    def get(self, sheet_name: str, cell_ref: str) -> str:
        return self._sheet_cells(sheet_name).get(cell_ref, "").strip()

    def sheet_cells(self, sheet_name: str) -> dict[str, str]:
        return dict(self._sheet_cells(sheet_name))


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def safe_text(value: object) -> str:
    text = "" if value is None else str(value)
    return text.strip()


def clean_text(value: object) -> str:
    text = safe_text(value).replace("\xa0", " ")
    markers = ("Ã¢â‚¬â€", "Ã¢â‚¬â€œ", "Ã¢â€ â€™", "Ã‚·", "Ãƒ", "Ã¢â‚¬â„¢", "Ã¢â‚¬Å“", "Ã¢â‚¬", "Ã‚")
    if any(marker in text for marker in markers):
        try:
            text = text.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return text.strip()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def format_ui_percent(value: str, optional: bool = False) -> str:
    text = clean_text(value)
    if not text:
        return "" if optional else "0"
    try:
        number = float(text.replace(",", "").replace("%", ""))
    except ValueError:
        return text
    if abs(number) <= 1:
        number *= 100
    if abs(number - round(number)) < 1e-9:
        return str(int(round(number)))
    return f"{number:.2f}".rstrip("0").rstrip(".")


def parse_evidence_date(value: str) -> str:
    text = clean_text(value)
    if not text:
        return ""
    for fmt in ("%d-%b-%Y", "%b-%Y"):
        try:
            parsed = datetime.strptime(text, fmt)
            if fmt == "%b-%Y":
                parsed = parsed.replace(day=1)
            return parsed.date().isoformat()
        except ValueError:
            continue
    return ""


def format_portal_date(value: str) -> str:
    text = clean_text(value)
    if not text:
        return ""
    for fmt in ("%d-%b-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return text


def bool_from_yes_no(value: str) -> bool:
    return clean_text(value).lower() in {"yes", "y", "true", "1"}


def sha256_for(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rel_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def derive_in_scope_fte(note: str) -> str:
    match = re.search(r"(\d+(?:\.\d+)?)\s+DVE in-scope FTE", clean_text(note))
    return match.group(1) if match else ""


def prettify_stem(stem: str) -> str:
    words = re.sub(r"[_\-]+", " ", stem).strip()
    if not words:
        return "Workbook Import"
    if words.lower().endswith("claude"):
        return "Claude Workbook Import"
    return words


def build_inventory() -> tuple[list[dict], list[dict]]:
    workbook_entries: list[dict] = []
    pdf_entries: list[dict] = []
    for path in sorted(DOCS_DIR.iterdir(), key=lambda item: item.name.lower()):
        if path.name.endswith(".generated.json") or path.name.endswith(".generated.md"):
            continue
        if path.suffix.lower() == ".xlsx":
            book = XlsxBook(path)
            workbook_entries.append({
                "file": path.name,
                "relativePath": rel_path(path),
                "sheetCount": len(book.sheet_names),
                "sheets": book.sheet_names,
                "sha256": sha256_for(path),
            })
        elif path.suffix.lower() == ".pdf":
            pdf_entries.append({
                "file": path.name,
                "relativePath": rel_path(path),
                "parsed": False,
                "sha256": sha256_for(path),
            })
    return workbook_entries, pdf_entries


def build_discovery_evidence(book: XlsxBook, workbook_path: Path, row: int) -> dict:
    raw_value = book.get("FPA_02 Discovery", f"D{row}")
    effective_value = book.get("FPA_02 Discovery", f"E{row}")
    source_class_code = book.get("FPA_02 Discovery", f"F{row}")
    confidence_code = book.get("FPA_02 Discovery", f"G{row}")
    owner = book.get("FPA_02 Discovery", f"H{row}")
    raw_date_label = book.get("FPA_02 Discovery", f"I{row}")
    criticality = book.get("FPA_02 Discovery", f"J{row}")
    default_source = book.get("FPA_02 Discovery", f"K{row}")
    source_class = SOURCE_CLASS_LABELS.get(source_class_code, source_class_code)
    confidence = CONFIDENCE_LABELS.get(confidence_code, confidence_code)
    defaulted = not bool(raw_value)
    source_parts = [workbook_path.name, "FPA_02 Discovery", f"D{row}"]
    if defaulted:
        source_parts[-1] = f"D{row}:E{row}"
    return {
        "source": " / ".join(source_parts),
        "confidence": confidence,
        "owner": owner,
        "date": parse_evidence_date(raw_date_label),
        "fileName": workbook_path.name,
        "sheetName": "FPA_02 Discovery",
        "cell": f"D{row}",
        "effectiveCell": f"E{row}",
        "effectiveValue": effective_value,
        "sourceClass": source_class,
        "sourceClassCode": source_class_code,
        "criticality": criticality,
        "defaultSource": default_source,
        "rawDateLabel": raw_date_label,
        "defaulted": defaulted,
    }


def parse_scope_config() -> tuple[list[dict], list[dict]]:
    source = SCOPE_CONFIG_PATH.read_text(encoding="utf-8")
    l2_pattern = re.compile(r'\{ id: "(?P<id>[^"]+)", row: (?P<row>\d+), l2Number: (?P<l2number>\d+), label: "(?P<label>[^"]+)", cluster: "(?P<cluster>[^"]+)", l3Count: (?P<l3count>\d+) \}')
    l3_pattern = re.compile(r'\{ id: "(?P<id>[^"]+)", row: (?P<row>\d+), l2Id: "(?P<l2id>[^"]+)", activity: "(?P<activity>[^"]+)", cluster: "(?P<cluster>[^"]+)" \}')
    l2_rows = [
        {
            "id": match.group("id"),
            "row": int(match.group("row")),
            "l2Number": int(match.group("l2number")),
            "label": match.group("label"),
            "cluster": match.group("cluster"),
            "l3Count": int(match.group("l3count")),
        }
        for match in l2_pattern.finditer(source)
    ]
    l3_rows = [
        {
            "id": match.group("id"),
            "row": int(match.group("row")),
            "l2Id": match.group("l2id"),
            "activity": match.group("activity"),
            "cluster": match.group("cluster"),
        }
        for match in l3_pattern.finditer(source)
    ]
    return l2_rows, l3_rows


def parse_scope_fraction(value: str) -> float:
    text = clean_text(value)
    if not text:
        return 0.0
    try:
        numeric = float(text.replace(",", "").replace("%", ""))
    except ValueError:
        return 0.0
    if text.endswith("%") or abs(numeric) > 1:
        numeric /= 100
    return max(0.0, min(1.0, numeric))


def format_scope_fraction(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.3f}".rstrip("0").rstrip(".")


def build_scope_l3_rows(book: XlsxBook, l3_rows: list[dict]) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    for item in l3_rows:
        row_number = item["row"]
        rows[item["id"]] = {
            "status": clean_text(book.get("FPA_03 Scope L3", f"F{row_number}")) or "N",
            "partialPct": clean_text(book.get("FPA_03 Scope L3", f"G{row_number}")) or "0",
            "retainedToo": clean_text(book.get("FPA_03 Scope L3", f"I{row_number}")),
            "disposition": clean_text(book.get("FPA_03 Scope L3", f"J{row_number}")),
            "locationIntent": clean_text(book.get("FPA_03 Scope L3", f"K{row_number}")),
        }
    return rows


def build_scope_l2_rows(book: XlsxBook, l2_rows: list[dict]) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    for item in l2_rows:
        scope_pct = parse_scope_fraction(book.get("FPA_03 Scope L3", f"D{item['row']}"))
        if scope_pct <= 0:
            status = "N"
        elif scope_pct >= 1:
            status = "Y"
        else:
            status = "Partial"
        rows[item["id"]] = {
            "status": status,
            "partialPct": format_scope_fraction(scope_pct),
            "sourceLabel": "Workbook roll-up",
        }
    return rows


def should_capture_sheet(sheet_name: str) -> bool:
    if sheet_name in EXTRA_CAPTURE_SHEETS:
        return True
    return sheet_name.startswith("FPA_") and sheet_name not in EXCLUDED_CAPTURE_SHEETS


def build_workbook_input_cache(book: XlsxBook) -> dict[str, dict[str, str]]:
    payload: dict[str, dict[str, str]] = {}
    for sheet_name in book.sheet_names:
        if not should_capture_sheet(sheet_name):
            continue
        cells = {
            cell_ref: clean_text(value)
            for cell_ref, value in book.sheet_cells(sheet_name).items()
            if clean_text(value)
        }
        if cells:
            payload[sheet_name] = cells
    return payload


def empty_document_intake() -> dict:
    return {
        "documents": [],
        "latestRun": None,
        "companyOverview": None,
        "companyResearch": None,
        "history": [],
        "updatedAt": "",
        "fieldMemory": {
            "version": "v1",
            "updatedAt": "",
            "lastRunId": "",
            "entries": [],
            "summary": {
                "fieldCount": 0,
                "towerCount": 0,
                "sectionCount": 0,
                "updatedFieldCount": 0,
                "statusCounts": {},
            },
        },
        "logicBuilder": {
            "version": "logic_builder_v2",
            "updatedAt": "",
            "lastRunId": "",
            "documentRegister": [],
            "chunkStore": [],
            "factLedger": [],
            "reviewQueue": {
                "version": "logic_builder_v2",
                "updatedAt": "",
                "lastRunId": "",
                "fields": [],
                "summary": {
                    "fieldCount": 0,
                    "pendingCount": 0,
                    "populatedCount": 0,
                    "acceptedCount": 0,
                    "conflictCount": 0,
                    "highConfidenceCount": 0,
                    "towerCount": 0,
                    "sectionCount": 0,
                    "statusCounts": {},
                },
            },
            "summary": {
                "documentCount": 0,
                "chunkCount": 0,
                "factCount": 0,
                "reviewFieldCount": 0,
                "conflictFieldCount": 0,
                "highConfidenceFieldCount": 0,
                "towerCount": 0,
                "sectionCount": 0,
            },
        },
    }

def load_users() -> list[dict]:
    payload = load_json(USERS_PATH)
    return payload if isinstance(payload, list) else []


def append_recent_deal(bucket: dict[str, list[str]], user_id: str, deal_id: str) -> None:
    existing = bucket.get(user_id)
    if not isinstance(existing, list):
        existing = []
    bucket[user_id] = [deal_id, *[item for item in existing if item != deal_id][:19]]


def build_field_report(
    *,
    book: XlsxBook,
    workbook_path: Path,
    deal: dict,
    docs_inventory: list[dict],
    pdf_inventory: list[dict],
    report_json_path: Path,
    captured_inputs: dict[str, dict[str, str]],
    l2_rows: list[dict],
    l3_rows: list[dict],
) -> dict:
    fields: list[dict] = []
    discovery = deal.get("fpaWorkspace", {}).get("discovery", {})
    discovery_evidence = deal.get("fpaWorkspace", {}).get("discoveryEvidence", {})
    coverage = deal.get("fpaWorkspace", {}).get("discoveryCoverage", {})
    pain_points = deal.get("fpaWorkspace", {}).get("discoveryPainPoints", {})
    scope_l2 = deal.get("fpaWorkspace", {}).get("scopeL2", {})
    scope_l3 = deal.get("fpaWorkspace", {}).get("scopeL3", {})

    for item in DEAL_MASTER_FIELD_MAP:
        workbook_value = book.get("E2E Deal Master", item["cell"])
        fields.append({
            "section": "Deal Master",
            "portalPath": item["portalPath"],
            "label": item["label"],
            "sheetName": "E2E Deal Master",
            "cell": item["cell"],
            "workbookValue": workbook_value,
            "portalValue": deal.get(item["portalPath"], ""),
            "note": "Imported from workbook deal master.",
        })

    for tower in TOWER_SCOPE_ROWS:
        code = tower["code"]
        row = tower["row"]
        fields.append({
            "section": "Deal Master > Tower Scope",
            "portalPath": f"towerScope_{code}",
            "label": f"{code} In Scope",
            "sheetName": "E2E Deal Master",
            "cell": f"D{row}",
            "workbookValue": book.get("E2E Deal Master", f"D{row}"),
            "portalValue": deal.get(f"towerScope_{code}"),
            "note": book.get("E2E Deal Master", f"F{row}"),
        })
        fields.append({
            "section": "Deal Master > Tower Scope",
            "portalPath": f"towerLead_{code}",
            "label": f"{code} Solution Lead",
            "sheetName": "E2E Deal Master",
            "cell": f"E{row}",
            "workbookValue": book.get("E2E Deal Master", f"E{row}"),
            "portalValue": deal.get(f"towerLead_{code}"),
            "note": "Workbook lead; portal access stays mapped to existing users.",
        })

    for item in DISCOVERY_ROWS:
        row = item["row"]
        evidence = discovery_evidence.get(item["fieldId"], {}) if isinstance(discovery_evidence.get(item["fieldId"]), dict) else {}
        fields.append({
            "section": "FP&A Discovery",
            "portalPath": f"fpaWorkspace.discovery.{item['fieldId']}",
            "label": item["label"],
            "sheetName": "FPA_02 Discovery",
            "cell": f"D{row}",
            "effectiveCell": f"E{row}",
            "workbookValue": book.get("FPA_02 Discovery", f"D{row}"),
            "effectiveValue": book.get("FPA_02 Discovery", f"E{row}"),
            "portalValue": discovery.get(item["fieldId"], ""),
            "sourceClass": evidence.get("sourceClass", ""),
            "confidence": evidence.get("confidence", ""),
            "defaultSource": evidence.get("defaultSource", ""),
            "note": "Workbook discovery import.",
        })

    for item in COVERAGE_ROWS:
        row = item["row"]
        fields.append({
            "section": "FP&A Discovery Coverage",
            "portalPath": f"fpaWorkspace.discoveryCoverage.{item['fieldId']}",
            "label": item["label"],
            "sheetName": "FPA_02 Discovery",
            "cell": f"H{row}",
            "workbookValue": book.get("FPA_02 Discovery", f"H{row}"),
            "portalValue": coverage.get(item["fieldId"], ""),
            "note": "Workbook coverage checklist import.",
        })

    for item in PAIN_ROWS:
        row = item["row"]
        pain_value = pain_points.get(item["fieldId"], {}) if isinstance(pain_points.get(item["fieldId"]), dict) else {}
        fields.append({
            "section": "FP&A Discovery Pain Points",
            "portalPath": f"fpaWorkspace.discoveryPainPoints.{item['fieldId']}",
            "label": item["label"],
            "sheetName": "FPA_02 Discovery",
            "cell": f"D{row}",
            "severityCell": f"E{row}",
            "workbookValue": book.get("FPA_02 Discovery", f"D{row}"),
            "effectiveValue": book.get("FPA_02 Discovery", f"E{row}"),
            "portalValue": pain_value,
            "note": "Workbook pain-point import.",
        })

    l2_lookup = {item["id"]: item for item in l2_rows}
    for item in l2_rows:
        scope_value = scope_l2.get(item["id"], {}) if isinstance(scope_l2.get(item["id"]), dict) else {}
        fields.append({
            "section": "FP&A Scope L2",
            "portalPath": f"fpaWorkspace.scopeL2.{item['id']}",
            "label": item["label"],
            "sheetName": "FPA_03 Scope L3",
            "cell": f"D{item['row']}",
            "workbookValue": book.get("FPA_03 Scope L3", f"D{item['row']}"),
            "portalValue": scope_value,
            "note": "Imported from workbook roll-up Final %.",
        })

    for item in l3_rows:
        scope_value = scope_l3.get(item["id"], {}) if isinstance(scope_l3.get(item["id"]), dict) else {}
        l2_label = l2_lookup.get(item["l2Id"], {}).get("label", "")
        fields.append({
            "section": "FP&A Scope L3",
            "portalPath": f"fpaWorkspace.scopeL3.{item['id']}",
            "label": f"{l2_label} / {item['activity']}",
            "sheetName": "FPA_03 Scope L3",
            "cell": f"F{item['row']}",
            "partialCell": f"G{item['row']}",
            "retainedCell": f"I{item['row']}",
            "dispositionCell": f"J{item['row']}",
            "locationCell": f"K{item['row']}",
            "workbookValue": {
                "status": book.get("FPA_03 Scope L3", f"F{item['row']}"),
                "partialPct": book.get("FPA_03 Scope L3", f"G{item['row']}"),
                "retainedToo": book.get("FPA_03 Scope L3", f"I{item['row']}"),
                "disposition": book.get("FPA_03 Scope L3", f"J{item['row']}"),
                "locationIntent": book.get("FPA_03 Scope L3", f"K{item['row']}"),
            },
            "portalValue": scope_value,
            "note": "Imported from workbook activity row.",
        })

    return {
        "generatedAt": now_iso(),
        "importedDeal": {
            "id": deal["id"],
            "draftLabel": deal.get("draftLabel", ""),
            "dealId": deal.get("dealId", ""),
            "clientName": deal.get("clientName", ""),
        },
        "workbook": {
            "file": workbook_path.name,
            "absolutePath": str(workbook_path),
            "sheetCount": len(book.sheet_names),
            "sha256": sha256_for(workbook_path),
        },
        "sourceCoverage": {
            "docsWorkbooks": docs_inventory,
            "docsPdfPacks": pdf_inventory,
            "reportJson": rel_path(report_json_path),
        },
        "capturedWorkbookSheets": {sheet_name: len(cells) for sheet_name, cells in captured_inputs.items()},
        "assumptions": [
            "The portal deal is cloned from the current seeded portal deal so existing access control, collaborators, and downstream portal structure remain intact.",
            "Workbook Deal Master, FP&A Discovery, Discovery Coverage, Pain Points, and Scope L2/L3 are imported directly from the attached workbook.",
            "Portal owner and tower-user mappings remain the current local users so the imported deal stays visible after login.",
            "Additional workbook-backed FP&A sheet cells are stored under fpaWorkbookInputs for parity with workbook-driven pages and downstream readers.",
        ],
        "fields": fields,
    }


def build_markdown_report(report: dict) -> str:
    imported = report["importedDeal"]
    workbook = report["workbook"]
    lines = [
        "# Workbook import report",
        "",
        f"Generated: `{report['generatedAt']}`",
        "",
        "## Imported deal",
        "",
        f"- Deal record: `{imported['id']}`",
        f"- Draft label: `{imported['draftLabel']}`",
        f"- Deal ID: `{imported['dealId']}`",
        f"- Client: `{imported['clientName']}`",
        f"- Workbook: `{workbook['file']}`",
        "",
        "## Captured workbook sheets",
        "",
        "| Sheet | Non-empty cells cached |",
        "| --- | ---: |",
    ]
    for sheet_name, count in sorted(report.get("capturedWorkbookSheets", {}).items()):
        lines.append(f"| {sheet_name} | {count} |")
    lines.extend([
        "",
        "## Import assumptions",
        "",
    ])
    for item in report.get("assumptions", []):
        lines.append(f"- {item}")
    lines.extend([
        "",
        "## Field references",
        "",
        "| Section | Portal path | Workbook ref | Portal value | Workbook value | Notes |",
        "| --- | --- | --- | --- | --- | --- |",
    ])

    def clean_cell(value: object) -> str:
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=False)
        return str(value if value is not None else "").replace("|", "/").replace("\n", " ").strip()

    for field in report.get("fields", []):
        cell_parts = [field.get("sheetName", ""), field.get("cell", "")]
        for extra_key in ("effectiveCell", "partialCell", "retainedCell", "dispositionCell", "locationCell", "severityCell"):
            extra_value = field.get(extra_key)
            if extra_value:
                cell_parts.append(str(extra_value))
        workbook_ref = " / ".join(part for part in cell_parts if part)
        lines.append(
            f"| {clean_cell(field.get('section'))} | {clean_cell(field.get('portalPath'))} | {clean_cell(workbook_ref)} | {clean_cell(field.get('portalValue'))} | {clean_cell(field.get('workbookValue'))} | {clean_cell(field.get('note'))} |"
        )
    lines.append("")
    return "\n".join(lines) + "\n"


def populate_current_and_recent(workspace: dict, deal: dict) -> None:
    users = load_users()
    email_to_id = {clean_text(item.get("email")): clean_text(item.get("id")) for item in users if clean_text(item.get("email")) and clean_text(item.get("id"))}
    visible_user_ids = {
        clean_text(deal.get("dealOwnerUserId")),
        clean_text(deal.get("towerOwnerUserId_FPA")),
        clean_text(deal.get("towerOwnerUserId_RTR")),
        clean_text(deal.get("towerOwnerUserId_O2C")),
        clean_text(deal.get("towerOwnerUserId_P2P")),
    }
    for collaborator in deal.get("collaborators", []):
        if not isinstance(collaborator, dict):
            continue
        matched_user_id = email_to_id.get(clean_text(collaborator.get("email")))
        if matched_user_id:
            visible_user_ids.add(matched_user_id)
    visible_user_ids = {user_id for user_id in visible_user_ids if user_id}

    workspace["currentId"] = deal["id"]
    current_by_user = workspace.setdefault("currentByUser", {})
    recent_by_user = workspace.setdefault("recentByUser", {})
    for user_id in visible_user_ids:
        current_by_user[user_id] = deal["id"]
        append_recent_deal(recent_by_user, user_id, deal["id"])


def import_workbook_deal(workbook_path: Path, report_stem: str, draft_label: str | None) -> dict:
    if not workbook_path.exists():
        raise SystemExit(f"Workbook not found: {workbook_path}")

    workspace = load_json(DEALS_PATH)
    if not isinstance(workspace, dict) or not isinstance(workspace.get("deals"), list) or not workspace["deals"]:
        raise SystemExit("deals.json does not contain a template deal to clone.")

    template = deepcopy(workspace["deals"][0])
    workbook = XlsxBook(workbook_path)
    docs_inventory, pdf_inventory = build_inventory()
    l2_rows, l3_rows = parse_scope_config()
    workbook_inputs = build_workbook_input_cache(workbook)

    report_json_path = DOCS_DIR / f"{report_stem}.generated.json"
    report_md_path = DOCS_DIR / f"{report_stem}.generated.md"

    now = now_iso()
    today = today_iso()
    deal = template
    deal["id"] = f"deal-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    deal["createdAt"] = now
    deal["updatedAt"] = now
    deal["version"] = 1
    deal["accessRole"] = "owner"
    deal["draftLabel"] = draft_label or prettify_stem(workbook_path.stem)
    deal.pop("colaRate", None)
    deal["documentIntake"] = empty_document_intake()

    field_evidence: dict[str, dict] = {}
    for item in DEAL_MASTER_FIELD_MAP:
        workbook_value = workbook.get("E2E Deal Master", item["cell"])
        transform = item.get("transform")
        if transform == "percent_ui":
            portal_value = format_ui_percent(workbook_value)
        elif transform == "percent_ui_optional":
            portal_value = format_ui_percent(workbook_value, optional=True)
        elif transform == "date_ui":
            portal_value = format_portal_date(workbook_value)
        else:
            portal_value = workbook_value
        deal[item["portalPath"]] = portal_value
        field_evidence[item["portalPath"]] = {
            "source": f"{workbook_path.name} / E2E Deal Master / {item['cell']}",
            "fileName": workbook_path.name,
            "sheetName": "E2E Deal Master",
            "cell": item["cell"],
            "workbookValue": workbook_value,
            "portalValue": portal_value,
            "dateImported": today,
        }

    deal["dealStatus"] = "Sizing"
    deal["watermark"] = "READY WITH REVIEW ITEMS"
    deal["notesTag"] = "Internal"
    deal["reviewNotes"] = (
        f"Imported from workbook {workbook_path.name} on {today}. "
        "Deal Master, FP&A Discovery, Discovery Coverage, Pain Points, Scope L2/L3, and workbook-backed FP&A sheet cells were refreshed from the workbook. "
        "Portal owner and collaborator access stays mapped to the current local users."
    )
    field_evidence["dealStatus"] = {
        "source": "Portal import assumption",
        "note": "Not present as a dedicated workbook state cell; set to Sizing because the workbook has sizing inputs populated.",
        "dateImported": today,
    }
    field_evidence["watermark"] = {
        "source": "Portal import assumption",
        "note": "Set to READY WITH REVIEW ITEMS for the imported workbook-backed deal.",
        "dateImported": today,
    }

    tower_mapping_notes: dict[str, str] = {}
    tower_in_scope_fte: dict[str, str] = {}
    for tower in TOWER_SCOPE_ROWS:
        code = tower["code"]
        row = tower["row"]
        scope_value = workbook.get("E2E Deal Master", f"D{row}")
        lead_value = workbook.get("E2E Deal Master", f"E{row}")
        note_value = workbook.get("E2E Deal Master", f"F{row}")
        deal[f"towerScope_{code}"] = bool_from_yes_no(scope_value)
        deal[f"towerLead_{code}"] = lead_value
        tower_mapping_notes[code] = note_value
        tower_in_scope_fte[code] = derive_in_scope_fte(note_value)
        field_evidence[f"towerScope_{code}"] = {
            "source": f"{workbook_path.name} / E2E Deal Master / D{row}",
            "fileName": workbook_path.name,
            "sheetName": "E2E Deal Master",
            "cell": f"D{row}",
            "workbookValue": scope_value,
            "portalValue": deal[f"towerScope_{code}"],
            "note": note_value,
            "dateImported": today,
        }
        field_evidence[f"towerLead_{code}"] = {
            "source": f"{workbook_path.name} / E2E Deal Master / E{row}",
            "fileName": workbook_path.name,
            "sheetName": "E2E Deal Master",
            "cell": f"E{row}",
            "workbookValue": lead_value,
            "portalValue": lead_value,
            "note": "Workbook solution lead; portal access user IDs remain unchanged.",
            "dateImported": today,
        }

    deal["fieldEvidence"] = field_evidence

    fpa_workspace = deal.setdefault("fpaWorkspace", {})
    fpa_workspace["status"] = "In Progress"
    discovery = fpa_workspace.setdefault("discovery", {})
    discovery_evidence = fpa_workspace.setdefault("discoveryEvidence", {})
    coverage = fpa_workspace.setdefault("discoveryCoverage", {})
    pain_points = fpa_workspace.setdefault("discoveryPainPoints", {})

    for item in DISCOVERY_ROWS:
        row = item["row"]
        discovery[item["fieldId"]] = workbook.get("FPA_02 Discovery", f"D{row}")
        discovery_evidence[item["fieldId"]] = build_discovery_evidence(workbook, workbook_path, row)

    for item in COVERAGE_ROWS:
        coverage[item["fieldId"]] = workbook.get("FPA_02 Discovery", f"H{item['row']}")

    for item in PAIN_ROWS:
        row = item["row"]
        present = workbook.get("FPA_02 Discovery", f"D{row}")
        pain_points[item["fieldId"]] = {
            "present": present,
            "severity": workbook.get("FPA_02 Discovery", f"E{row}") if present == "Yes" else "",
        }

    fpa_workspace["scopeL3"] = build_scope_l3_rows(workbook, l3_rows)
    fpa_workspace["scopeL2"] = build_scope_l2_rows(workbook, l2_rows)
    fpa_workspace["notes"] = (
        f"Workbook import source: {workbook_path.name}. "
        f"Import report: {rel_path(report_md_path)}"
    )

    deal["fpaWorkbookInputs"] = workbook_inputs
    deal["sourceDocuments"] = {
        "managerWorkbook": {
            "file": workbook_path.name,
            "absolutePath": str(workbook_path),
            "sheetCount": len(workbook.sheet_names),
            "sha256": sha256_for(workbook_path),
        },
        "workbooks": docs_inventory,
        "pdfBaselinePacks": pdf_inventory,
        "rawExtractReference": rel_path(report_json_path),
        "schemaReference": "docs/Gaurav/deal-schema.generated.json",
    }
    deal["sourceSummary"] = {
        "sourcePackName": f"Workbook import: {workbook_path.name}",
        "workbookCount": len(docs_inventory) + 1,
        "pdfCount": len(pdf_inventory),
        "clientAlias": clean_text(deal.get("dealId")).split("-")[0] if clean_text(deal.get("dealId")) else "",
        "keyPlatforms": [
            discovery.get("epmPlatform", ""),
            discovery.get("erpLandscape", ""),
            discovery.get("consolidationApproach", ""),
            discovery.get("biLandscape", ""),
            discovery.get("dataMartMaturity", ""),
        ],
        "towerInScopeFte": tower_in_scope_fte,
        "towerMappingNotes": tower_mapping_notes,
        "capturedWorkbookSheets": {sheet_name: len(cells) for sheet_name, cells in workbook_inputs.items()},
        "lastSeededAt": today,
        "seedMode": "Workbook import",
        "importReport": rel_path(report_md_path),
    }
    deal["canonicalSchemaRef"] = "docs/Gaurav/deal-schema.generated.json"
    deal["importReport"] = {
        "json": rel_path(report_json_path),
        "markdown": rel_path(report_md_path),
        "workbook": str(workbook_path),
        "generatedAt": now,
    }

    report = build_field_report(
        book=workbook,
        workbook_path=workbook_path,
        deal=deal,
        docs_inventory=docs_inventory,
        pdf_inventory=pdf_inventory,
        report_json_path=report_json_path,
        captured_inputs=workbook_inputs,
        l2_rows=l2_rows,
        l3_rows=l3_rows,
    )
    report_json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    report_md_path.write_text(build_markdown_report(report), encoding="utf-8")

    deals = workspace["deals"]
    replaced = False
    for index, existing in enumerate(deals):
        if clean_text(existing.get("dealId")) == clean_text(deal.get("dealId")) and clean_text(existing.get("draftLabel")) == clean_text(deal.get("draftLabel")):
            deals[index] = deal
            replaced = True
            break
    if not replaced:
        deals.insert(0, deal)

    workspace["savedAt"] = now
    populate_current_and_recent(workspace, deal)
    write_json(DEALS_PATH, workspace)
    return {
        "dealId": deal["id"],
        "draftLabel": deal["draftLabel"],
        "dealCode": deal.get("dealId", ""),
        "reportJson": rel_path(report_json_path),
        "reportMarkdown": rel_path(report_md_path),
        "capturedSheets": len(workbook_inputs),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import an E2E Finance workbook into backend/data/deals.json")
    parser.add_argument("--workbook", required=True, help="Absolute or relative path to the .xlsx workbook")
    parser.add_argument("--report-stem", default="workbook-import", help="Stem used for generated JSON/Markdown report files under docs/Gaurav")
    parser.add_argument("--draft-label", default="", help="Optional portal draft label override")
    args = parser.parse_args()

    result = import_workbook_deal(
        workbook_path=Path(args.workbook),
        report_stem=clean_text(args.report_stem) or "workbook-import",
        draft_label=clean_text(args.draft_label) or None,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
