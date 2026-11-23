# -*- coding: cp1252 -*-
from __future__ import annotations

import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEALS_PATH = ROOT / 'backend' / 'data' / 'deals.json'
DOCS_DIR = ROOT / 'docs' / 'Gaurav'
MANAGER_WORKBOOK_PATH = Path(r'C:\Users\gauravra\Downloads\KDP_E2E_Finance_Solution_Model_v6.xlsx')
REPORT_JSON_PATH = DOCS_DIR / 'kdp-manager-workbook-import.generated.json'
REPORT_MD_PATH = DOCS_DIR / 'kdp-manager-workbook-import.generated.md'
SCHEMA_REF = 'docs/Gaurav/deal-schema.generated.json'
SOURCE_SUMMARY_REF = 'docs/Gaurav/gaurav-source-summary.generated.json'

NS = {
    'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
}

SOURCE_CLASS_LABELS = {
    'CC': 'Client-confirmed',
    'CE': 'Client-estimated',
    'PA': 'Practitioner assumption',
    'BM': 'Benchmark',
    'MKT': 'Market evidence',
}

CONFIDENCE_LABELS = {
    'H': 'High',
    'M': 'Medium',
    'L': 'Low',
}

DEAL_MASTER_FIELD_MAP = [
    {'portalPath': 'clientName', 'label': 'Client Name', 'cell': 'D6'},
    {'portalPath': 'dealId', 'label': 'Pursuit / Deal ID', 'cell': 'D7'},
    {'portalPath': 'presalesLead', 'label': 'Presales Lead', 'cell': 'D8'},
    {'portalPath': 'bidDate', 'label': 'Bid Date', 'cell': 'D9', 'transform': 'date_ui'},
    {'portalPath': 'contractTerm', 'label': 'Contract Term (years)', 'cell': 'D11'},
    {'portalPath': 'discountRate', 'label': 'Discount Rate', 'cell': 'D12', 'transform': 'percent_ui'},
    {'portalPath': 'colaRate', 'label': 'Contractual COLA / indexation (from Y2)', 'cell': 'D13', 'transform': 'percent_ui'},
    {'portalPath': 'displayCurrency', 'label': 'Display Currency', 'cell': 'D16'},
    {'portalPath': 'fxRate', 'label': 'FX rate (1 USD = x display)', 'cell': 'D17'},
    {'portalPath': 'pricingConstruct', 'label': 'Pricing Construct (primary bid)', 'cell': 'D20'},
    {'portalPath': 'transitionCommercials', 'label': 'Transition Commercials', 'cell': 'D21'},
    {'portalPath': 'transformationFunding', 'label': 'Transformation Funding', 'cell': 'D22'},
    {'portalPath': 'benchmarkPolicy', 'label': 'Benchmark Percentile Policy', 'cell': 'D25'},
    {'portalPath': 'corporateOverhead', 'label': 'Corporate Overhead Allocation on cost', 'cell': 'D26', 'transform': 'percent_ui'},
    {'portalPath': 'committedProdY2', 'label': 'Committed productivity Y2', 'cell': 'D29', 'transform': 'percent_ui_optional'},
    {'portalPath': 'committedProdY3', 'label': 'Committed productivity Y3', 'cell': 'D30', 'transform': 'percent_ui_optional'},
    {'portalPath': 'committedProdY4', 'label': 'Committed productivity Y4+', 'cell': 'D31', 'transform': 'percent_ui_optional'},
    {'portalPath': 'customerFinanceFte', 'label': 'Total customer Finance FTE (all towers, optional)', 'cell': 'D43'},
    {'portalPath': 'financeCostBaseline', 'label': 'Total customer Finance cost baseline (USD/yr, optional)', 'cell': 'D44'},
    {'portalPath': 'programName', 'label': 'Programme name', 'cell': 'D45'},
]

TOWER_SCOPE_ROWS = [
    {'row': 36, 'code': 'FPA'},
    {'row': 37, 'code': 'RTR'},
    {'row': 38, 'code': 'O2C'},
    {'row': 39, 'code': 'P2P'},
]

DISCOVERY_ROWS = [
    {'row': 7, 'fieldId': 'industryVertical', 'label': 'Industry Vertical'},
    {'row': 8, 'fieldId': 'annualRevenueUsdM', 'label': 'Annual Revenue (USD $B)'},
    {'row': 10, 'fieldId': 'legalEntities', 'label': '# Legal Entities'},
    {'row': 11, 'fieldId': 'businessUnits', 'label': '# Business Units'},
    {'row': 12, 'fieldId': 'employeeCount000', 'label': 'Employee Count (000s)'},
    {'row': 13, 'fieldId': 'geoCountries', 'label': 'Geographic Footprint (# countries)'},
    {'row': 14, 'fieldId': 'languagesBeyondEnglish', 'label': 'Languages beyond English (#)'},
    {'row': 15, 'fieldId': 'costCentres', 'label': '# Cost Centres'},
    {'row': 16, 'fieldId': 'productServiceLines', 'label': '# Products / Service Lines'},
    {'row': 17, 'fieldId': 'forecastCadence', 'label': 'Forecast Cadence'},
    {'row': 18, 'fieldId': 'planningIterationsPerBudget', 'label': 'Planning Iterations per Budget'},
    {'row': 19, 'fieldId': 'forecastVersionsMaintained', 'label': 'Forecast Versions Maintained'},
    {'row': 20, 'fieldId': 'reportPacksPerMonth', 'label': '# Report Packs / month'},
    {'row': 21, 'fieldId': 'adhocAnalysisIntensity', 'label': 'Ad-hoc Analysis Intensity'},
    {'row': 22, 'fieldId': 'epmPlatform', 'label': 'EPM Tool in Place'},
    {'row': 23, 'fieldId': 'monthlyCloseComplexity', 'label': 'Monthly Close Complexity'},
    {'row': 24, 'fieldId': 'processMaturity', 'label': 'Planning & Forecasting Maturity'},
    {'row': 25, 'fieldId': 'automationMaturity', 'label': 'Automation Maturity'},
    {'row': 26, 'fieldId': 'aiMaturity', 'label': 'AI Maturity'},
    {'row': 27, 'fieldId': 'digitalMaturity', 'label': 'Customer Digital Maturity'},
    {'row': 28, 'fieldId': 'competitiveIntensity', 'label': 'Competitive Intensity'},
    {'row': 29, 'fieldId': 'platformModernizationInScope', 'label': 'EPM Modernisation in Transformation Scope?'},
    {'row': 30, 'fieldId': 'peakMonth1', 'label': 'Peak Month 1'},
    {'row': 31, 'fieldId': 'peakMonth2', 'label': 'Peak Month 2'},
    {'row': 32, 'fieldId': 'peakMonth3', 'label': 'Peak Month 3'},
    {'row': 33, 'fieldId': 'retainedOrgIntent', 'label': 'Retained-Organisation Intent'},
    {'row': 34, 'fieldId': 'dataSourcesCount', 'label': '# Data Sources feeding the tower'},
    {'row': 35, 'fieldId': 'currentTowerStaff', 'label': '# FP&A Planners / BPs (current)'},
    {'row': 36, 'fieldId': 'currentTowerCostBaselineUsd', 'label': 'Current FP&A Cost Baseline (USD/yr)'},
    {'row': 64, 'fieldId': 'erpLandscape', 'label': 'ERP GL feed'},
    {'row': 65, 'fieldId': 'consolidationApproach', 'label': 'Close / consolidation tool'},
    {'row': 66, 'fieldId': 'biLandscape', 'label': 'BI / reporting layer'},
    {'row': 67, 'fieldId': 'dataMartMaturity', 'label': 'Finance data layer'},
    {'row': 68, 'fieldId': 'governanceMode', 'label': 'Master data management'},
]

COVERAGE_ROWS = [
    {'row': 41, 'fieldId': 'volumesCoreDrivers', 'label': 'Volumes (FP&A core drivers)'},
    {'row': 42, 'fieldId': 'currentFteByProcess', 'label': 'Current FTE by process'},
    {'row': 43, 'fieldId': 'platformAndMaturity', 'label': 'Platform and maturity'},
    {'row': 44, 'fieldId': 'automationAlreadyAchieved', 'label': 'Automation % already achieved'},
    {'row': 45, 'fieldId': 'kpiBaselineCycleMetrics', 'label': 'KPI baseline / cycle metrics'},
    {'row': 46, 'fieldId': 'activityInventory', 'label': 'Activity / report inventory (with effort)'},
    {'row': 47, 'fieldId': 'closeCalendar', 'label': 'Close / process calendar'},
    {'row': 48, 'fieldId': 'existingSlasKpis', 'label': 'Existing SLAs / KPIs'},
    {'row': 49, 'fieldId': 'currentCostBaseline', 'label': 'Current cost baseline'},
    {'row': 50, 'fieldId': 'painPointsPriorities', 'label': 'Pain points and priorities'},
    {'row': 51, 'fieldId': 'retainedOrgIntentShared', 'label': 'Retained-org intent shared'},
    {'row': 52, 'fieldId': 'dataSourceLandscape', 'label': 'Data-source landscape'},
    {'row': 53, 'fieldId': 'peakCalendarConfirmed', 'label': 'Peak calendar confirmed'},
]

PAIN_ROWS = [
    {'row': 80, 'fieldId': 'budgetCycleTooLong', 'label': 'Budget cycle too long (>12 weeks)'},
    {'row': 81, 'fieldId': 'forecastAccuracyPoor', 'label': 'Forecast accuracy poor (>10% MAPE)'},
    {'row': 82, 'fieldId': 'excelDependentConsolidation', 'label': 'Excel-dependent consolidation'},
    {'row': 83, 'fieldId': 'reportProliferation', 'label': 'Report proliferation / low usage'},
    {'row': 84, 'fieldId': 'lateCloseDelays', 'label': 'Late close delays flash and commentary'},
    {'row': 85, 'fieldId': 'weakDriverGovernance', 'label': 'Weak driver governance'},
    {'row': 86, 'fieldId': 'limitedScenarioCapability', 'label': 'Limited scenario capability'},
    {'row': 87, 'fieldId': 'businessPartnersConsumedByDataPrep', 'label': 'Business partners consumed by data prep'},
]

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
            root = self._read_xml('xl/sharedStrings.xml')
        except KeyError:
            return []
        values: list[str] = []
        for item in root.findall('a:si', NS):
            text_parts: list[str] = []
            for node in item.iter():
                if node.tag == f"{{{NS['a']}}}t":
                    text_parts.append(node.text or '')
            values.append(''.join(text_parts))
        return values

    def _load_date_styles(self) -> dict[int, bool]:
        builtin_date_ids = {14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58}
        style_map: dict[int, bool] = {}
        custom_date_ids: set[int] = set()
        try:
            root = self._read_xml('xl/styles.xml')
        except KeyError:
            return style_map
        numfmts = root.find('a:numFmts', NS)
        if numfmts is not None:
            for fmt in numfmts.findall('a:numFmt', NS):
                fmt_id = int(fmt.attrib.get('numFmtId', '0'))
                code = (fmt.attrib.get('formatCode') or '').lower()
                if ('y' in code or 'd' in code) or ('m' in code and any(marker in code for marker in ['d', 'y', 'h', 's'])):
                    custom_date_ids.add(fmt_id)
        cell_xfs = root.find('a:cellXfs', NS)
        if cell_xfs is not None:
            for index, xf in enumerate(cell_xfs.findall('a:xf', NS)):
                numfmt_id = int(xf.attrib.get('numFmtId', '0'))
                style_map[index] = numfmt_id in builtin_date_ids or numfmt_id in custom_date_ids
        return style_map

    def _load_sheet_targets(self) -> dict[str, str]:
        workbook = self._read_xml('xl/workbook.xml')
        rels = self._read_xml('xl/_rels/workbook.xml.rels')
        rel_map = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels.findall('pr:Relationship', NS)}
        targets: dict[str, str] = {}
        for sheet in workbook.find('a:sheets', NS).findall('a:sheet', NS):
            sheet_name = sheet.attrib['name']
            rel_id = sheet.attrib[f"{{{NS['r']}}}id"]
            target = rel_map[rel_id]
            if not target.startswith('xl/'):
                target = f"xl/{target.lstrip('/')}"
            targets[sheet_name] = target
        return targets

    @property
    def sheet_names(self) -> list[str]:
        return list(self.sheet_targets.keys())

    def _from_excel_date(self, value: str) -> str:
        base = datetime(1899, 12, 30)
        return (base + timedelta(days=float(value))).strftime('%d-%b-%Y')

    def _decode_cell(self, cell: ET.Element) -> str:
        cell_type = cell.attrib.get('t')
        style_index = int(cell.attrib.get('s', '0'))
        if cell_type == 'inlineStr':
            node = cell.find('a:is/a:t', NS)
            return (node.text or '').strip() if node is not None else ''
        value_node = cell.find('a:v', NS)
        if value_node is None:
            return ''
        value = value_node.text or ''
        if cell_type == 's':
            try:
                return (self.shared_strings[int(value)] or '').strip()
            except Exception:
                return value.strip()
        if cell_type == 'b':
            return 'TRUE' if value == '1' else 'FALSE'
        if cell_type == 'str':
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
                cell.attrib.get('r', ''): self._decode_cell(cell)
                for cell in root.iterfind('.//a:c', NS)
                if cell.attrib.get('r')
            }
        return self._sheet_cache[sheet_name]

    def get(self, sheet_name: str, cell_ref: str) -> str:
        return self._sheet_cells(sheet_name).get(cell_ref, '').strip()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def safe_text(value: object) -> str:
    text = '' if value is None else str(value)
    return text.strip()


def format_ui_percent(value: str, optional: bool = False) -> str:
    text = safe_text(value)
    if not text:
        return '' if optional else '0'
    try:
        number = float(text.replace(',', '').replace('%', ''))
    except ValueError:
        return text
    if abs(number) <= 1:
        number *= 100
    if abs(number - round(number)) < 1e-9:
        return str(int(round(number)))
    return f'{number:.2f}'.rstrip('0').rstrip('.')


def parse_evidence_date(value: str) -> str:
    text = safe_text(value)
    if not text:
        return ''
    for fmt in ('%d-%b-%Y', '%b-%Y'):
        try:
            parsed = datetime.strptime(text, fmt)
            if fmt == '%b-%Y':
                parsed = parsed.replace(day=1)
            return parsed.date().isoformat()
        except ValueError:
            continue
    return ''


def bool_from_yes_no(value: str) -> bool:
    return safe_text(value).lower() in {'yes', 'y', 'true', '1'}


def format_portal_date(value: str) -> str:
    text = safe_text(value)
    if not text:
        return ''
    for fmt in ('%d-%b-%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return text


def sha256_for(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def rel_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def load_json(path: Path) -> object:
    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def write_json(path: Path, payload: object) -> None:
    with path.open('w', encoding='utf-8') as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write('\n')


def build_inventory() -> tuple[list[dict], list[dict]]:
    workbook_entries: list[dict] = []
    pdf_entries: list[dict] = []
    for path in sorted(DOCS_DIR.iterdir(), key=lambda item: item.name.lower()):
        if path.name.endswith('.generated.json') or path.name.endswith('.generated.md'):
            continue
        if path.suffix.lower() == '.xlsx':
            book = XlsxBook(path)
            workbook_entries.append({
                'file': path.name,
                'relativePath': rel_path(path),
                'sheetCount': len(book.sheet_names),
                'sheets': book.sheet_names,
                'sha256': sha256_for(path),
            })
        elif path.suffix.lower() == '.pdf':
            pdf_entries.append({
                'file': path.name,
                'relativePath': rel_path(path),
                'parsed': False,
                'sha256': sha256_for(path),
            })
    return workbook_entries, pdf_entries


def derive_in_scope_fte(note: str) -> str:
    match = re.search(r'(\d+(?:\.\d+)?)\s+DVE in-scope FTE', safe_text(note))
    return match.group(1) if match else ''


def build_discovery_evidence(book: XlsxBook, row: int) -> dict:
    raw_value = book.get('FPA_02 Discovery', f'D{row}')
    effective_value = book.get('FPA_02 Discovery', f'E{row}')
    source_class_code = book.get('FPA_02 Discovery', f'F{row}')
    confidence_code = book.get('FPA_02 Discovery', f'G{row}')
    owner = book.get('FPA_02 Discovery', f'H{row}')
    raw_date_label = book.get('FPA_02 Discovery', f'I{row}')
    criticality = book.get('FPA_02 Discovery', f'J{row}')
    default_source = book.get('FPA_02 Discovery', f'K{row}')
    source_class = SOURCE_CLASS_LABELS.get(source_class_code, source_class_code)
    confidence = CONFIDENCE_LABELS.get(confidence_code, confidence_code)
    defaulted = not bool(raw_value)
    source_parts = [MANAGER_WORKBOOK_PATH.name, 'FPA_02 Discovery', f'D{row}']
    if defaulted:
        source_parts[-1] = f'D{row}:E{row}'
    return {
        'source': ' / '.join(source_parts),
        'confidence': confidence,
        'owner': owner,
        'date': parse_evidence_date(raw_date_label),
        'fileName': MANAGER_WORKBOOK_PATH.name,
        'sheetName': 'FPA_02 Discovery',
        'cell': f'D{row}',
        'effectiveCell': f'E{row}',
        'effectiveValue': effective_value,
        'sourceClass': source_class,
        'sourceClassCode': source_class_code,
        'criticality': criticality,
        'defaultSource': default_source,
        'rawDateLabel': raw_date_label,
        'defaulted': defaulted,
    }

def build_field_report(book: XlsxBook, deal: dict, docs_inventory: list[dict], pdf_inventory: list[dict]) -> dict:
    fields: list[dict] = []

    for item in DEAL_MASTER_FIELD_MAP:
        workbook_value = book.get('E2E Deal Master', item['cell'])
        portal_value = deal.get(item['portalPath'], '')
        note = 'Direct workbook import.'
        if item.get('transform') == 'percent_ui':
            note = 'Workbook stores decimal percent; portal stores UI percent.'
        elif item.get('transform') == 'percent_ui_optional' and not workbook_value:
            note = 'Blank in workbook; left blank in portal to preserve optional override behavior.'
        fields.append({
            'section': 'Deal Master',
            'portalPath': item['portalPath'],
            'label': item['label'],
            'workbookFile': MANAGER_WORKBOOK_PATH.name,
            'sheetName': 'E2E Deal Master',
            'cell': item['cell'],
            'workbookValue': workbook_value,
            'portalValue': portal_value,
            'note': note,
        })

    for tower in TOWER_SCOPE_ROWS:
        scope_cell = f'D{tower["row"]}'
        lead_cell = f'E{tower["row"]}'
        note_cell = f'F{tower["row"]}'
        scope_value = book.get('E2E Deal Master', scope_cell)
        lead_value = book.get('E2E Deal Master', lead_cell)
        note_value = book.get('E2E Deal Master', note_cell)
        fields.append({
            'section': 'Deal Master > Tower Scope',
            'portalPath': f'towerScope_{tower["code"]}',
            'label': f'{tower["code"]} in scope',
            'workbookFile': MANAGER_WORKBOOK_PATH.name,
            'sheetName': 'E2E Deal Master',
            'cell': scope_cell,
            'workbookValue': scope_value,
            'portalValue': deal.get(f'towerScope_{tower["code"]}'),
            'note': note_value,
        })
        fields.append({
            'section': 'Deal Master > Tower Scope',
            'portalPath': f'towerLead_{tower["code"]}',
            'label': f'{tower["code"]} tower solution lead',
            'workbookFile': MANAGER_WORKBOOK_PATH.name,
            'sheetName': 'E2E Deal Master',
            'cell': lead_cell,
            'workbookValue': lead_value,
            'portalValue': deal.get(f'towerLead_{tower["code"]}', ''),
            'note': note_value,
        })

    discovery = deal.get('fpaWorkspace', {}).get('discovery', {})
    discovery_evidence = deal.get('fpaWorkspace', {}).get('discoveryEvidence', {})
    for item in DISCOVERY_ROWS:
        row = item['row']
        raw_value = book.get('FPA_02 Discovery', f'D{row}')
        effective_value = book.get('FPA_02 Discovery', f'E{row}')
        evidence = discovery_evidence.get(item['fieldId'], {})
        fields.append({
            'section': 'FP&A Discovery',
            'portalPath': f'fpaWorkspace.discovery.{item["fieldId"]}',
            'label': item['label'],
            'workbookFile': MANAGER_WORKBOOK_PATH.name,
            'sheetName': 'FPA_02 Discovery',
            'cell': f'D{row}',
            'effectiveCell': f'E{row}',
            'workbookValue': raw_value,
            'effectiveValue': effective_value,
            'portalValue': discovery.get(item['fieldId'], ''),
            'sourceClass': evidence.get('sourceClass', ''),
            'confidence': evidence.get('confidence', ''),
            'owner': evidence.get('owner', ''),
            'evidenceDate': evidence.get('rawDateLabel') or evidence.get('date', ''),
            'criticality': evidence.get('criticality', ''),
            'defaultSource': evidence.get('defaultSource', ''),
            'defaulted': bool(evidence.get('defaulted')),
            'note': 'Blank raw value intentionally preserved; portal derives workbook-effective value from the same default logic.' if not raw_value else 'Direct workbook raw input.',
        })

    coverage = deal.get('fpaWorkspace', {}).get('discoveryCoverage', {})
    for item in COVERAGE_ROWS:
        row = item['row']
        fields.append({
            'section': 'FP&A Discovery Coverage',
            'portalPath': f'fpaWorkspace.discoveryCoverage.{item["fieldId"]}',
            'label': item['label'],
            'workbookFile': MANAGER_WORKBOOK_PATH.name,
            'sheetName': 'FPA_02 Discovery',
            'cell': f'H{row}',
            'weightCell': f'I{row}',
            'scoreCell': f'J{row}',
            'workbookValue': book.get('FPA_02 Discovery', f'H{row}'),
            'weight': book.get('FPA_02 Discovery', f'I{row}'),
            'score': book.get('FPA_02 Discovery', f'J{row}'),
            'portalValue': coverage.get(item['fieldId'], ''),
            'note': 'Workbook coverage checklist import.',
        })

    pain_points = deal.get('fpaWorkspace', {}).get('discoveryPainPoints', {})
    for item in PAIN_ROWS:
        row = item['row']
        pain_value = pain_points.get(item['fieldId'], {})
        fields.append({
            'section': 'FP&A Discovery Pain Points',
            'portalPath': f'fpaWorkspace.discoveryPainPoints.{item["fieldId"]}',
            'label': item['label'],
            'workbookFile': MANAGER_WORKBOOK_PATH.name,
            'sheetName': 'FPA_02 Discovery',
            'presentCell': f'D{row}',
            'severityCell': f'E{row}',
            'scoreCell': f'F{row}',
            'workbookPresent': book.get('FPA_02 Discovery', f'D{row}'),
            'workbookSeverity': book.get('FPA_02 Discovery', f'E{row}'),
            'score': book.get('FPA_02 Discovery', f'F{row}'),
            'portalValue': {
                'present': pain_value.get('present', ''),
                'severity': pain_value.get('severity', ''),
            },
            'note': 'Workbook pain-point import.',
        })

    return {
        'generatedAt': now_iso(),
        'importedDeal': {
            'id': deal['id'],
            'draftLabel': deal.get('draftLabel', ''),
            'dealId': deal.get('dealId', ''),
            'clientName': deal.get('clientName', ''),
        },
        'sourceCoverage': {
            'managerWorkbook': {
                'file': MANAGER_WORKBOOK_PATH.name,
                'absolutePath': str(MANAGER_WORKBOOK_PATH),
                'sheetCount': len(book.sheet_names),
                'sha256': sha256_for(MANAGER_WORKBOOK_PATH),
            },
            'docsWorkbooks': docs_inventory,
            'docsPdfPacks': pdf_inventory,
        },
        'assumptions': [
            'The new portal deal is cloned from the existing seeded KDP portal deal so previously built non-discovery FP&A tabs remain available for demo and further revalidation.',
            'Shared Deal Master fields and FP&A Discovery / Discovery Coverage / Pain Points are re-seeded from the manager workbook KDP_E2E_Finance_Solution_Model_v6.xlsx.',
            'Portal assignee IDs remain the existing portal users for access control, even though the workbook presales and tower solution lead is Mayank Manral.',
            'Percent fields are stored in portal UI format (10, 3, 0) while the workbook stores decimal values (0.1, 0.03, 0).',
            'Discovery blanks are intentionally left blank in portal raw inputs where the workbook expects default inference, and the effective workbook values are captured in this report.',
            'The docs/Gaurav folder is rescanned as source inventory; PDF packs are indexed by file only in this pass.',
        ],
        'fields': fields,
    }


def build_markdown_report(report: dict) -> str:
    lines: list[str] = []
    imported = report['importedDeal']
    lines.append('# KDP manager workbook import report')
    lines.append('')
    lines.append(f"Generated: `{report['generatedAt']}`")
    lines.append('')
    lines.append('## Imported deal')
    lines.append('')
    lines.append(f"- Deal record: `{imported['id']}`")
    lines.append(f"- Draft label: `{imported['draftLabel']}`")
    lines.append(f"- Deal ID: `{imported['dealId']}`")
    lines.append(f"- Client: `{imported['clientName']}`")
    lines.append(f"- Manager workbook: `{report['sourceCoverage']['managerWorkbook']['file']}`")
    lines.append('')
    lines.append('## Scanned source files')
    lines.append('')
    lines.append('| File | Type | Detail |')
    lines.append('| --- | --- | --- |')
    manager = report['sourceCoverage']['managerWorkbook']
    lines.append(f"| {manager['file']} | XLSX | {manager['sheetCount']} sheets |")
    for item in report['sourceCoverage']['docsWorkbooks']:
        lines.append(f"| {item['file']} | XLSX | {item['sheetCount']} sheets |")
    for item in report['sourceCoverage']['docsPdfPacks']:
        lines.append(f"| {item['file']} | PDF | Indexed only |")
    lines.append('')
    lines.append('## Import assumptions')
    lines.append('')
    for item in report['assumptions']:
        lines.append(f'- {item}')
    lines.append('')
    lines.append('## Field references')
    lines.append('')
    lines.append('| Section | Portal path | Portal value | Workbook ref | Workbook value | Notes |')
    lines.append('| --- | --- | --- | --- | --- | --- |')
    for field in report['fields']:
        workbook_ref = f"{field.get('sheetName', '')} {field.get('cell', field.get('presentCell', ''))}".strip()
        workbook_value = field.get('workbookValue')
        if workbook_value in (None, ''):
            if field.get('workbookPresent') is not None:
                workbook_value = f"{field.get('workbookPresent', '')} / {field.get('workbookSeverity', '')}".strip(' /')
            else:
                workbook_value = ''
        portal_value = field.get('portalValue')
        if isinstance(portal_value, dict):
            portal_value = ' / '.join(filter(None, [str(portal_value.get('present', '')).strip(), str(portal_value.get('severity', '')).strip()]))
        note_parts = [field.get('note', '')]
        if field.get('effectiveValue') not in (None, ''):
            note_parts.append(f"effective={field['effectiveValue']}")
        if field.get('sourceClass'):
            note_parts.append(f"src={field['sourceClass']}")
        if field.get('confidence'):
            note_parts.append(f"conf={field['confidence']}")
        if field.get('defaultSource'):
            note_parts.append(f"default={field['defaultSource']}")
        notes = '; '.join(part for part in note_parts if part)
        def clean(value: object) -> str:
            return str(value if value is not None else '').replace('|', '/').replace('\n', ' ').strip()
        lines.append(f"| {clean(field.get('section', ''))} | {clean(field.get('portalPath', ''))} | {clean(portal_value)} | {clean(workbook_ref)} | {clean(workbook_value)} | {clean(notes)} |")
    lines.append('')
    return '\n'.join(lines) + '\n'

def main() -> None:
    if not MANAGER_WORKBOOK_PATH.exists():
        raise SystemExit(f'Manager workbook not found: {MANAGER_WORKBOOK_PATH}')

    workspace = load_json(DEALS_PATH)
    if not isinstance(workspace, dict) or not isinstance(workspace.get('deals'), list) or not workspace['deals']:
        raise SystemExit('deals.json does not contain a seeded deal to clone.')

    manager_book = XlsxBook(MANAGER_WORKBOOK_PATH)
    docs_inventory, pdf_inventory = build_inventory()

    template = deepcopy(workspace['deals'][0])
    new_id = f"deal-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    now = now_iso()
    today = today_iso()

    deal = template
    deal['id'] = new_id
    deal['draftLabel'] = 'KDP DVE Finance — Docs Rescan'
    deal['createdAt'] = now
    deal['updatedAt'] = now
    deal['version'] = 1
    deal['accessRole'] = 'owner'
    deal['reviewNotes'] = (
        'Manager workbook and docs/Gaurav rescanned on 2026-10-16. '
        'Shared Deal Master plus FP&A Discovery / Coverage / Pain Points are re-seeded from '
        'KDP_E2E_Finance_Solution_Model_v6.xlsx. Portal collaborator assignments stay mapped to current portal users for access, '
        'while workbook solution leads remain Mayank Manral. Downstream FP&A tabs remain available from the portal model and should be revalidated tab by tab.'
    )

    field_evidence: dict[str, dict] = {}
    for item in DEAL_MASTER_FIELD_MAP:
        workbook_value = manager_book.get('E2E Deal Master', item['cell'])
        transform = item.get('transform')
        if transform == 'percent_ui':
            portal_value = format_ui_percent(workbook_value)
        elif transform == 'percent_ui_optional':
            portal_value = format_ui_percent(workbook_value, optional=True)
        elif transform == 'date_ui':
            portal_value = format_portal_date(workbook_value)
        else:
            portal_value = workbook_value
        deal[item['portalPath']] = portal_value
        field_evidence[item['portalPath']] = {
            'source': f"{MANAGER_WORKBOOK_PATH.name} / E2E Deal Master / {item['cell']}",
            'fileName': MANAGER_WORKBOOK_PATH.name,
            'sheetName': 'E2E Deal Master',
            'cell': item['cell'],
            'workbookValue': workbook_value,
            'portalValue': portal_value,
            'dateImported': today,
        }

    deal['dealStatus'] = 'Sizing'
    deal['watermark'] = 'READY WITH REVIEW ITEMS'
    deal['notesTag'] = 'Internal'
    field_evidence['dealStatus'] = {
        'source': 'Portal import assumption',
        'note': 'Not present as a dedicated state cell in the workbook; set to Sizing because discovery and shared commercial inputs are populated.',
        'dateImported': today,
    }
    field_evidence['watermark'] = {
        'source': 'Portal import assumption',
        'note': 'Set to READY WITH REVIEW ITEMS for the refreshed workbook-backed deal.',
        'dateImported': today,
    }

    tower_mapping_notes: dict[str, str] = {}
    tower_in_scope_fte: dict[str, str] = {}
    for tower in TOWER_SCOPE_ROWS:
        code = tower['code']
        scope_value = manager_book.get('E2E Deal Master', f'D{tower["row"]}')
        lead_value = manager_book.get('E2E Deal Master', f'E{tower["row"]}')
        note_value = manager_book.get('E2E Deal Master', f'F{tower["row"]}')
        deal[f'towerScope_{code}'] = bool_from_yes_no(scope_value)
        deal[f'towerLead_{code}'] = lead_value
        tower_mapping_notes[code] = note_value
        tower_in_scope_fte[code] = derive_in_scope_fte(note_value)
        field_evidence[f'towerScope_{code}'] = {
            'source': f"{MANAGER_WORKBOOK_PATH.name} / E2E Deal Master / D{tower['row']}",
            'fileName': MANAGER_WORKBOOK_PATH.name,
            'sheetName': 'E2E Deal Master',
            'cell': f'D{tower["row"]}',
            'workbookValue': scope_value,
            'portalValue': deal[f'towerScope_{code}'],
            'note': note_value,
            'dateImported': today,
        }
        field_evidence[f'towerLead_{code}'] = {
            'source': f"{MANAGER_WORKBOOK_PATH.name} / E2E Deal Master / E{tower['row']}",
            'fileName': MANAGER_WORKBOOK_PATH.name,
            'sheetName': 'E2E Deal Master',
            'cell': f'E{tower["row"]}',
            'workbookValue': lead_value,
            'portalValue': lead_value,
            'note': note_value,
            'dateImported': today,
        }

    deal['fieldEvidence'] = field_evidence

    if 'fpaWorkspace' not in deal or not isinstance(deal['fpaWorkspace'], dict):
        deal['fpaWorkspace'] = {}
    fpa_workspace = deal['fpaWorkspace']
    fpa_workspace['status'] = 'In Progress'
    discovery = fpa_workspace.setdefault('discovery', {})
    discovery_evidence = fpa_workspace.setdefault('discoveryEvidence', {})
    coverage = fpa_workspace.setdefault('discoveryCoverage', {})
    pain_points = fpa_workspace.setdefault('discoveryPainPoints', {})

    for item in DISCOVERY_ROWS:
        row = item['row']
        raw_value = manager_book.get('FPA_02 Discovery', f'D{row}')
        discovery[item['fieldId']] = raw_value
        discovery_evidence[item['fieldId']] = build_discovery_evidence(manager_book, row)

    for item in COVERAGE_ROWS:
        coverage[item['fieldId']] = manager_book.get('FPA_02 Discovery', f'H{item["row"]}')

    for item in PAIN_ROWS:
        row = item['row']
        pain_points[item['fieldId']] = {
            'present': manager_book.get('FPA_02 Discovery', f'D{row}'),
            'severity': manager_book.get('FPA_02 Discovery', f'E{row}') if manager_book.get('FPA_02 Discovery', f'D{row}') == 'Yes' else '',
        }

    fpa_workspace['notes'] = (
        'Imported from manager workbook and docs rescan. '
        'Evidence rows now store workbook file, sheet, and cell references. '
        f'Report: {rel_path(REPORT_MD_PATH)}'
    )

    deal['sourceDocuments'] = {
        'managerWorkbook': {
            'file': MANAGER_WORKBOOK_PATH.name,
            'absolutePath': str(MANAGER_WORKBOOK_PATH),
            'sheetCount': len(manager_book.sheet_names),
            'sha256': sha256_for(MANAGER_WORKBOOK_PATH),
        },
        'workbooks': docs_inventory,
        'pdfBaselinePacks': pdf_inventory,
        'rawExtractReference': rel_path(REPORT_JSON_PATH),
        'schemaReference': SCHEMA_REF,
    }
    deal['sourceSummary'] = {
        'sourcePackName': 'Gaurav / KDP finance source pack + manager workbook',
        'workbookCount': len(docs_inventory) + 1,
        'pdfCount': len(pdf_inventory),
        'clientAlias': 'KDP',
        'keyPlatforms': [
            discovery.get('epmPlatform', ''),
            discovery.get('erpLandscape', ''),
            discovery.get('consolidationApproach', ''),
            discovery.get('biLandscape', ''),
            discovery.get('dataMartMaturity', ''),
        ],
        'towerInScopeFte': tower_in_scope_fte,
        'towerMappingNotes': tower_mapping_notes,
        'lastSeededAt': today,
        'seedMode': 'Manager workbook + docs rescan',
        'importReport': rel_path(REPORT_MD_PATH),
    }
    deal['canonicalSchemaRef'] = SCHEMA_REF
    deal['importReport'] = {
        'json': rel_path(REPORT_JSON_PATH),
        'markdown': rel_path(REPORT_MD_PATH),
        'managerWorkbook': str(MANAGER_WORKBOOK_PATH),
        'generatedAt': now,
    }

    report = build_field_report(manager_book, deal, docs_inventory, pdf_inventory)
    REPORT_JSON_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    REPORT_MD_PATH.write_text(build_markdown_report(report), encoding='utf-8')

    deals = workspace['deals']
    replaced = False
    for index, existing in enumerate(deals):
        if safe_text(existing.get('dealId')) == safe_text(deal.get('dealId')) and safe_text(existing.get('draftLabel')) == safe_text(deal.get('draftLabel')):
            deals[index] = deal
            replaced = True
            break
    if not replaced:
        deals.insert(0, deal)

    workspace['savedAt'] = now
    workspace['currentId'] = deal['id']
    current_by_user = workspace.setdefault('currentByUser', {})
    recent_by_user = workspace.setdefault('recentByUser', {})
    pinned_user_ids = ['user-gauravra', 'user-harshsin', 'user-vipulra']
    for user_id in pinned_user_ids:
        current_by_user[user_id] = deal['id']
        current_recent = recent_by_user.get(user_id) if isinstance(recent_by_user.get(user_id), list) else []
        recent_by_user[user_id] = [deal['id'], *[item for item in current_recent if item != deal['id']]][:8]

    write_json(DEALS_PATH, workspace)
    print(f'Imported deal {deal["id"]} -> {deal["dealId"]}')
    print(f'Report JSON: {REPORT_JSON_PATH}')
    print(f'Report MD: {REPORT_MD_PATH}')


if __name__ == '__main__':
    main()
