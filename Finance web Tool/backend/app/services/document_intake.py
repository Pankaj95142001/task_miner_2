from __future__ import annotations

import base64
import io
import json
import mimetypes
import re
import subprocess
import zipfile
from copy import deepcopy
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable
from xml.etree import ElementTree as ET

from fastapi import HTTPException, UploadFile, status

try:
    from openai import OpenAI as BaseOpenAI
except ImportError:
    BaseOpenAI = None

from ..config import (
    DOCUMENT_UPLOAD_MAX_BYTES,
    DOCUMENT_UPLOAD_MAX_FILES,
    DOCUMENT_UPLOADS_DIR,
    OPENAI_API_KEY,
    OPENAI_COMPANY_RESEARCH_MODEL,
    OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS,
    OPENAI_DOCUMENT_MODEL,
    OPENAI_COMPANY_OVERVIEW_MODEL,
)
from ..models import User
from ..observability import start_observation, update_observation
from .document_intake_logic import (
    DEAL_MASTER_TOWER_FIELD_CATALOG,
    FPA_CHANGE_LOG_FIELD_CATALOG,
    FPA_COMPLEXITY_FIELD_CATALOG,
    FPA_GOVERNANCE_FIELD_CATALOG,
    FPA_SCPL_FIELD_CATALOG,
    build_logic_builder_snapshot,
    infer_document_reliability,
    infer_source_tier,
)

TEXT_EXTENSIONS = {'.txt', '.md', '.csv', '.json', '.log'}
PREPARED_TEXT_MAX_CHARS = 180000
PREPARED_TEXT_CHUNK_TARGET_CHARS = 14000
PREPARED_TEXT_CHUNK_OVERLAP_CHARS = 1200
PREPARED_TEXT_MAX_CHUNKS = 12
FIELD_MEMORY_PROMPT_LIMIT = 48
XLSX_MAX_ROWS_PER_SHEET = 220
XLSX_MAX_CELLS_PER_ROW = 16
PPTX_MAX_TEXT_RUNS_PER_SLIDE = 60

FIELD_SUGGESTION_ITEM_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'tower': {'type': 'string'},
        'section': {'type': 'string'},
        'subsection': {'type': 'string'},
        'fieldKey': {'type': 'string'},
        'fieldLabel': {'type': 'string'},
        'targetPath': {'type': 'string'},
        'controlType': {'type': 'string'},
        'allowedValues': {'type': 'array', 'items': {'type': 'string'}},
        'proposedValue': {'type': 'string'},
        'sourceFile': {'type': 'string'},
        'sourceLocation': {'type': 'string'},
        'evidenceSnippet': {'type': 'string'},
        'confidence': {'type': 'string'},
        'rationale': {'type': 'string'},
        'agentName': {'type': 'string'},
    },
    'required': [
        'tower', 'section', 'subsection', 'fieldKey', 'fieldLabel', 'targetPath', 'controlType',
        'allowedValues', 'proposedValue', 'sourceFile', 'sourceLocation', 'evidenceSnippet',
        'confidence', 'rationale', 'agentName',
    ],
}

COMPANY_RESEARCH_ROW_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'label': {'type': 'string'},
        'value': {'type': 'string'},
        'note': {'type': 'string'},
    },
    'required': ['label', 'value', 'note'],
}

COMPANY_RESEARCH_RISK_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'risk': {'type': 'string'},
        'severity': {'type': 'string'},
        'implication': {'type': 'string'},
        'source': {'type': 'string'},
    },
    'required': ['risk', 'severity', 'implication', 'source'],
}

COMPANY_RESEARCH_SOURCE_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'title': {'type': 'string'},
        'domain': {'type': 'string'},
        'url': {'type': 'string'},
        'asOfDate': {'type': 'string'},
        'note': {'type': 'string'},
    },
    'required': ['title', 'domain', 'url', 'asOfDate', 'note'],
}

EXTRACTION_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'documentType': {'type': 'string'},
        'summary': {'type': 'string'},
        'towerHints': {'type': 'array', 'items': {'type': 'string'}},
        'confidenceClass': {'type': 'string'},
        'fieldSuggestions': {
            'type': 'array',
            'items': FIELD_SUGGESTION_ITEM_SCHEMA,
        },
        'warnings': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['documentType', 'summary', 'towerHints', 'confidenceClass', 'fieldSuggestions', 'warnings'],
}

COMPANY_RESEARCH_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'companyName': {'type': 'string'},
        'analysisLens': {'type': 'string'},
        'executiveSummary': {'type': 'string'},
        'businessOverview': {'type': 'array', 'items': COMPANY_RESEARCH_ROW_SCHEMA},
        'headlineMetrics': {'type': 'array', 'items': COMPANY_RESEARCH_ROW_SCHEMA},
        'financialOverview': {'type': 'array', 'items': COMPANY_RESEARCH_ROW_SCHEMA},
        'dealImplications': {'type': 'array', 'items': COMPANY_RESEARCH_ROW_SCHEMA},
        'keyRisks': {'type': 'array', 'items': COMPANY_RESEARCH_RISK_SCHEMA},
        'overviewFields': {'type': 'array', 'items': FIELD_SUGGESTION_ITEM_SCHEMA},
        'sources': {'type': 'array', 'items': COMPANY_RESEARCH_SOURCE_SCHEMA},
        'warnings': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': [
        'companyName',
        'analysisLens',
        'executiveSummary',
        'businessOverview',
        'headlineMetrics',
        'financialOverview',
        'dealImplications',
        'keyRisks',
        'overviewFields',
        'sources',
        'warnings',
    ],
}

GENERAL_EXTRACTION_AGENT_NAME = 'Portal Field Extractor'
DISCOVERY_OVERVIEW_AGENT_NAME = 'RFP Company Overview Agent'
COMPANY_RESEARCH_AGENT_NAME = 'Company Research Agent'
DISCOVERY_OVERVIEW_TARGET_PREFIX = 'fpaWorkspace.discovery.'
DISCOVERY_OVERVIEW_LLM_FIELD_KEYS = {
    'industryVertical',
    'annualRevenueUsdM',
    'businessUnits',
    'employeeCount000',
    'geoCountries',
    'productServiceLines',
}
COMPANY_OVERVIEW_PRIORITY_TARGETS = (
    'clientName',
    'fpaWorkspace.discovery.industryVertical',
    'fpaWorkspace.discovery.annualRevenueUsdM',
    'fpaWorkspace.discovery.employeeCount000',
    'fpaWorkspace.discovery.geoCountries',
    'fpaWorkspace.discovery.businessUnits',
    'fpaWorkspace.discovery.productServiceLines',
    'fpaWorkspace.discovery.forecastCadence',
    'fpaWorkspace.discovery.epmPlatform',
    'fpaWorkspace.discovery.erpLandscape',
    'fpaWorkspace.discovery.currentTowerStaff',
    'fpaWorkspace.discovery.currentTowerCostBaselineUsd',
)
COMPANY_OVERVIEW_PRIORITY_RANK = {target_path: index for index, target_path in enumerate(COMPANY_OVERVIEW_PRIORITY_TARGETS)}
RFP_DISCOVERY_OVERVIEW_FILE_KEYWORDS = (
    'rfp',
    'brief',
    'proposal',
    'overview',
    'background',
    'client-profile',
    'company-profile',
)
RFP_DISCOVERY_OVERVIEW_TEXT_KEYWORDS = (
    'request for proposal',
    'executive summary',
    'company overview',
    'business overview',
    'client overview',
    'organisation overview',
    'organization overview',
    'finance transformation',
    'annual revenue',
    'employee count',
    'legal entities',
    'business units',
    'geographic footprint',
    'countries served',
    'planning cycle',
    'forecast cadence',
    'epm tool',
    'erp landscape',
)

DEAL_MASTER_FIELD_CATALOG: list[dict[str, Any]] = [
    {'tower': 'Deal Master', 'section': 'Deal Identity', 'subsection': 'Shared shell', 'fieldKey': 'draftLabel', 'fieldLabel': 'Draft Label', 'targetPath': 'draftLabel', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Deal Identity', 'subsection': 'Shared shell', 'fieldKey': 'clientName', 'fieldLabel': 'Client Name', 'targetPath': 'clientName', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Deal Identity', 'subsection': 'Shared shell', 'fieldKey': 'dealId', 'fieldLabel': 'Deal ID', 'targetPath': 'dealId', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Deal Identity', 'subsection': 'Shared shell', 'fieldKey': 'programName', 'fieldLabel': 'Programme Name', 'targetPath': 'programName', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Deal Identity', 'subsection': 'Shared shell', 'fieldKey': 'presalesLead', 'fieldLabel': 'Presales Lead', 'targetPath': 'presalesLead', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Deal Identity', 'subsection': 'Shared shell', 'fieldKey': 'bidDate', 'fieldLabel': 'Bid Date', 'targetPath': 'bidDate', 'controlType': 'date', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Deal Identity', 'subsection': 'Shared shell', 'fieldKey': 'dealStatus', 'fieldLabel': 'Deal Status', 'targetPath': 'dealStatus', 'controlType': 'select', 'allowedValues': ['Draft', 'In Discovery', 'Sizing', 'In Review', 'Approved for Submission', 'Submitted', 'Won', 'Lost', 'Archived']},
    {'tower': 'Deal Master', 'section': 'Deal Identity', 'subsection': 'Shared shell', 'fieldKey': 'watermark', 'fieldLabel': 'Watermark / Stance', 'targetPath': 'watermark', 'controlType': 'select', 'allowedValues': ['INDICATIVE', 'READY WITH REVIEW ITEMS', 'SUBMIT-READY', 'NOT READY']},
    {'tower': 'Deal Master', 'section': 'Finance & Currency', 'subsection': 'Commercial baseline', 'fieldKey': 'contractTerm', 'fieldLabel': 'Contract Term', 'targetPath': 'contractTerm', 'controlType': 'select', 'allowedValues': ['3', '5', '7']},
    {'tower': 'Deal Master', 'section': 'Finance & Currency', 'subsection': 'Commercial baseline', 'fieldKey': 'discountRate', 'fieldLabel': 'Discount Rate %', 'targetPath': 'discountRate', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Finance & Currency', 'subsection': 'Commercial baseline', 'fieldKey': 'corporateOverhead', 'fieldLabel': 'Corporate Overhead %', 'targetPath': 'corporateOverhead', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Finance & Currency', 'subsection': 'Commercial baseline', 'fieldKey': 'displayCurrency', 'fieldLabel': 'Display Currency', 'targetPath': 'displayCurrency', 'controlType': 'select', 'allowedValues': ['USD', 'INR', 'EUR', 'GBP', 'AUD']},
    {'tower': 'Deal Master', 'section': 'Finance & Currency', 'subsection': 'Commercial baseline', 'fieldKey': 'fxRate', 'fieldLabel': 'FX Rate', 'targetPath': 'fxRate', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Finance & Currency', 'subsection': 'Commercial baseline', 'fieldKey': 'customerFinanceFte', 'fieldLabel': 'Total Customer Finance FTE', 'targetPath': 'customerFinanceFte', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Finance & Currency', 'subsection': 'Commercial baseline', 'fieldKey': 'financeCostBaseline', 'fieldLabel': 'Finance Cost Baseline', 'targetPath': 'financeCostBaseline', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Commercial Setup', 'subsection': 'Deal commercials', 'fieldKey': 'pricingConstruct', 'fieldLabel': 'Pricing Construct', 'targetPath': 'pricingConstruct', 'controlType': 'select', 'allowedValues': ['FTE-based', 'Fixed-fee', 'Gainshare', 'Outcome-based', 'T&M']},
    {'tower': 'Deal Master', 'section': 'Commercial Setup', 'subsection': 'Deal commercials', 'fieldKey': 'transitionCommercials', 'fieldLabel': 'Transition Commercials', 'targetPath': 'transitionCommercials', 'controlType': 'select', 'allowedValues': ['Separate fee', 'Provider-funded', 'Amortised']},
    {'tower': 'Deal Master', 'section': 'Commercial Setup', 'subsection': 'Deal commercials', 'fieldKey': 'transformationFunding', 'fieldLabel': 'Transformation Funding', 'targetPath': 'transformationFunding', 'controlType': 'select', 'allowedValues': ['Provider-funded', 'Customer-funded', 'Amortised', 'Gainshare-funded']},
    {'tower': 'Deal Master', 'section': 'Commercial Setup', 'subsection': 'Deal commercials', 'fieldKey': 'benchmarkPolicy', 'fieldLabel': 'Benchmark Percentile Policy', 'targetPath': 'benchmarkPolicy', 'controlType': 'select', 'allowedValues': ['Auto', 'P25', 'P50', 'P75']},
    {'tower': 'Deal Master', 'section': 'Commercial Setup', 'subsection': 'Deal commercials', 'fieldKey': 'committedProdY2', 'fieldLabel': 'Committed Productivity Y2 %', 'targetPath': 'committedProdY2', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Commercial Setup', 'subsection': 'Deal commercials', 'fieldKey': 'committedProdY3', 'fieldLabel': 'Committed Productivity Y3 %', 'targetPath': 'committedProdY3', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Commercial Setup', 'subsection': 'Deal commercials', 'fieldKey': 'committedProdY4', 'fieldLabel': 'Committed Productivity Y4+ %', 'targetPath': 'committedProdY4', 'controlType': 'number', 'allowedValues': []},
    *DEAL_MASTER_TOWER_FIELD_CATALOG,
]

DISCOVERY_GROUP_LABELS = {
    'scale': 'Business and volume proxies',
    'cadence': 'Planning cadence and reporting',
    'maturity': 'Maturity and transformation context',
    'calendar': 'Calendar, operating model, and staffing',
}

FPA_DISCOVERY_OPTION_FALLBACKS: dict[str, list[str]] = {
    'forecastCadence': ['Quarterly', 'Monthly Rolling', 'Continuous (12-month rolling)'],
    'adhocAnalysisIntensity': ['Low', 'Medium', 'High'],
    'monthlyCloseComplexity': ['Simple (<=5 days)', 'Standard (6-8 days)', 'Complex (9-12 days)', 'Very Complex (>12 days)'],
    'processMaturity': ['Basic', 'Developing', 'Established', 'Leading'],
    'automationMaturity': ['Low (<20%)', 'Medium (20-50%)', 'High (>50%)'],
    'aiMaturity': ['Exploring', 'Piloting', 'Scaled'],
    'digitalMaturity': ['Legacy', 'Traditional', 'Modernised', 'Digital-native'],
    'competitiveIntensity': ['Low (1 bidder)', 'Medium (2-3 bidders)', 'High (4+ bidders)'],
    'platformModernizationInScope': ['Yes', 'No'],
    'retainedOrgIntent': ['Lean', 'Hybrid', 'Oversight-heavy'],
    'epmPlatform': ['Excel-only / legacy', 'SAP (BPC/SAC)', 'Oracle EPM Cloud', 'Anaplan', 'OneStream', 'Workday Adaptive', 'Hyperion (on-prem)', 'IBM Planning Analytics', 'Board / Jedox / Other'],
    'commonEpmTools': ['Excel-only / legacy', 'SAP (BPC/SAC)', 'Oracle EPM Cloud', 'Anaplan', 'OneStream', 'Workday Adaptive', 'Hyperion (on-prem)', 'IBM Planning Analytics', 'Board / Jedox / Other'],
    'consolidationApproach': ['OneStream / FCCS / HFM in place', 'Consolidation inside EPM', 'Spreadsheet consolidation'],
    'biLandscape': ['Enterprise BI (Power BI / Tableau), governed', 'BI present, ungoverned', 'Excel / PowerPoint reporting'],
    'dataMartMaturity': ['Finance data warehouse / lakehouse', 'Partial data marts', 'Direct extracts / manual'],
    'governanceMode': ['Governed MDM tool', 'Manual governance', 'None / ad hoc'],
    'yesNo': ['Yes', 'No'],
    'painSeverity': ['Low', 'Medium', 'High', 'Critical'],
}

SUPPORTED_OPTION_KEYS = tuple(FPA_DISCOVERY_OPTION_FALLBACKS.keys())

def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def read_repo_text(relative_path: str) -> str:
    try:
        return (repo_root() / relative_path).read_text(encoding='utf-8')
    except Exception:
        return ''


def extract_js_block(source: str, export_name: str, opener: str, closer: str) -> str:
    marker = f'export const {export_name} = {opener}'
    start = source.find(marker)
    if start < 0:
        return ''
    index = start + len(marker)
    depth = 1
    while index < len(source):
        char = source[index]
        if char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                return source[start + len(marker):index]
        index += 1
    return ''


def parse_js_array_objects(source: str, export_name: str) -> list[str]:
    block = extract_js_block(source, export_name, '[', ']')
    if not block:
        return []
    return [match.group(1) for match in re.finditer(r'\{([^{}]+)\}', block, flags=re.S)]


def parse_js_string_prop(entry: str, prop: str) -> str:
    match = re.search(rf'{re.escape(prop)}\s*:\s*"([^"]*)"', entry)
    return match.group(1).strip() if match else ''


def parse_js_options_map(source: str, export_name: str) -> dict[str, list[str]]:
    block = extract_js_block(source, export_name, '{', '}')
    if not block:
        return dict(FPA_DISCOVERY_OPTION_FALLBACKS)
    options = dict(FPA_DISCOVERY_OPTION_FALLBACKS)
    for key in SUPPORTED_OPTION_KEYS:
        match = re.search(rf'{re.escape(key)}\s*:\s*\[([^\]]*?)\]', block, flags=re.S)
        if not match:
            continue
        values = [trim_text(value, 120) for value in re.findall(r'"([^"]+)"', match.group(1)) if trim_text(value, 120)]
        if values:
            options[key] = values
    return options


def dedupe_field_catalog(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        target_path = trim_text(entry.get('targetPath') or '', 240)
        dedupe_key = target_path or trim_text(entry.get('fieldKey') or '', 120)
        if not dedupe_key or dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        deduped.append(entry)
    return deduped


@lru_cache(maxsize=1)
def load_generated_fpna_field_catalog() -> list[dict[str, Any]]:
    script_path = repo_root() / 'scripts' / 'build-document-field-catalog.mjs'
    if not script_path.exists():
        return []

    try:
        result = subprocess.run(
            ['node', str(script_path)],
            cwd=str(repo_root()),
            check=False,
            capture_output=True,
            text=True,
            timeout=90,
        )
    except Exception:
        return []

    output = (result.stdout or '').strip()
    if not output:
        return []

    try:
        raw_catalog = json.loads(output)
    except json.JSONDecodeError:
        return []

    if not isinstance(raw_catalog, list):
        return []

    normalized_catalog: list[dict[str, Any]] = []
    for item in raw_catalog:
        if not isinstance(item, dict):
            continue

        section = trim_text(item.get('section') or '', 80)
        subsection = trim_text(item.get('subsection') or '', 140)
        field_key = trim_text(item.get('fieldKey') or '', 120)
        field_label = trim_text(item.get('fieldLabel') or '', 220)
        target_path = trim_text(item.get('targetPath') or '', 240)
        control_type = trim_text(item.get('controlType') or 'text', 40) or 'text'
        allowed_values = [trim_text(value, 120) for value in (item.get('allowedValues') or []) if trim_text(value, 120)]

        if not section or not subsection or not field_key or not field_label or not target_path:
            continue

        normalized_catalog.append({
            'tower': 'FP&A',
            'section': section,
            'subsection': subsection,
            'fieldKey': field_key,
            'fieldLabel': field_label,
            'targetPath': target_path,
            'controlType': control_type,
            'allowedValues': allowed_values,
        })

    return dedupe_field_catalog(normalized_catalog)


@lru_cache(maxsize=1)
def load_portal_field_catalog() -> list[dict[str, Any]]:
    catalog = list(DEAL_MASTER_FIELD_CATALOG)

    discovery_source = read_repo_text('src/config/fpaDiscovery.js')
    discovery_options = parse_js_options_map(discovery_source, 'FPA_DISCOVERY_OPTIONS')

    for entry in parse_js_array_objects(discovery_source, 'FPA_DISCOVERY_PROXY_FIELDS'):
        field_id = parse_js_string_prop(entry, 'id')
        label = parse_js_string_prop(entry, 'label')
        group_id = parse_js_string_prop(entry, 'groupId')
        control_type = parse_js_string_prop(entry, 'control') or 'text'
        options_key = parse_js_string_prop(entry, 'optionsKey')
        if not field_id or not label:
            continue
        catalog.append({
            'tower': 'FP&A',
            'section': '02 Discovery',
            'subsection': DISCOVERY_GROUP_LABELS.get(group_id, group_id or 'Discovery'),
            'fieldKey': field_id,
            'fieldLabel': label,
            'targetPath': f'fpaWorkspace.discovery.{field_id}',
            'controlType': control_type,
            'allowedValues': discovery_options.get(options_key, []) if options_key else [],
        })

    for entry in parse_js_array_objects(discovery_source, 'FPA_DISCOVERY_TECH_FIELDS'):
        field_id = parse_js_string_prop(entry, 'id')
        label = parse_js_string_prop(entry, 'label')
        options_key = parse_js_string_prop(entry, 'optionsKey')
        if not field_id or not label:
            continue
        catalog.append({
            'tower': 'FP&A',
            'section': '02 Discovery',
            'subsection': 'Technology landscape',
            'fieldKey': field_id,
            'fieldLabel': label,
            'targetPath': f'fpaWorkspace.discovery.{field_id}',
            'controlType': 'select',
            'allowedValues': discovery_options.get(options_key, []),
        })

    for entry in parse_js_array_objects(discovery_source, 'FPA_DISCOVERY_COVERAGE_FIELDS'):
        field_id = parse_js_string_prop(entry, 'id')
        label = parse_js_string_prop(entry, 'label')
        if not field_id or not label:
            continue
        catalog.append({
            'tower': 'FP&A',
            'section': '02 Discovery',
            'subsection': 'Evidence coverage',
            'fieldKey': field_id,
            'fieldLabel': label,
            'targetPath': f'fpaWorkspace.discoveryCoverage.{field_id}',
            'controlType': 'select',
            'allowedValues': discovery_options.get('yesNo', ['Yes', 'No']),
        })

    for entry in parse_js_array_objects(discovery_source, 'FPA_DISCOVERY_PAIN_POINT_FIELDS'):
        field_id = parse_js_string_prop(entry, 'id')
        label = parse_js_string_prop(entry, 'label')
        if not field_id or not label:
            continue
        catalog.append({
            'tower': 'FP&A',
            'section': '02 Discovery',
            'subsection': 'Pain points',
            'fieldKey': field_id,
            'fieldLabel': label,
            'targetPath': f'fpaWorkspace.discoveryPainPoints.{field_id}',
            'controlType': 'pain_point',
            'allowedValues': ['No', 'Yes | Low', 'Yes | Medium', 'Yes | High', 'Yes | Critical'],
        })

    scope_source = read_repo_text('src/config/fpaScope.js')
    l2_lookup: dict[str, str] = {}

    for entry in parse_js_array_objects(scope_source, 'FPA_SCOPE_L2_ROWS'):
        field_id = parse_js_string_prop(entry, 'id')
        label = parse_js_string_prop(entry, 'label')
        cluster = parse_js_string_prop(entry, 'cluster')
        if not field_id or not label:
            continue
        l2_lookup[field_id] = label
        catalog.append({
            'tower': 'FP&A',
            'section': '03 Scope L3',
            'subsection': f'L2 process · {cluster}' if cluster else 'L2 process',
            'fieldKey': field_id,
            'fieldLabel': label,
            'targetPath': f'fpaWorkspace.scopeL2.{field_id}.status',
            'controlType': 'scope_status',
            'allowedValues': ['Y', 'Partial', 'N'],
        })

    for entry in parse_js_array_objects(scope_source, 'BASE_SCOPE_L3_ROWS'):
        field_id = parse_js_string_prop(entry, 'id')
        activity = parse_js_string_prop(entry, 'activity')
        l2_id = parse_js_string_prop(entry, 'l2Id')
        cluster = parse_js_string_prop(entry, 'cluster')
        if not field_id or not activity:
            continue
        l2_label = l2_lookup.get(l2_id, l2_id or 'L3 activity')
        subsection = l2_label
        if cluster:
            subsection = f'{l2_label} · {cluster}'
        catalog.append({
            'tower': 'FP&A',
            'section': '03 Scope L3',
            'subsection': subsection,
            'fieldKey': field_id,
            'fieldLabel': activity,
            'targetPath': f'fpaWorkspace.scopeL3.{field_id}.status',
            'controlType': 'scope_status',
            'allowedValues': ['Y', 'Partial', 'N'],
        })

    catalog.extend(load_generated_fpna_field_catalog())
    catalog.extend(FPA_COMPLEXITY_FIELD_CATALOG)
    catalog.extend(FPA_GOVERNANCE_FIELD_CATALOG)
    catalog.extend(FPA_CHANGE_LOG_FIELD_CATALOG)
    catalog.extend(FPA_SCPL_FIELD_CATALOG)
    return dedupe_field_catalog(catalog)


@lru_cache(maxsize=1)
def load_portal_field_lookup() -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for item in load_portal_field_catalog():
        field_key = trim_text(item.get('fieldKey') or '', 120)
        if field_key and field_key not in lookup:
            lookup[field_key] = item
    return lookup


@lru_cache(maxsize=1)
def load_discovery_overview_field_catalog() -> list[dict[str, Any]]:
    return [
        item
        for item in load_portal_field_catalog()
        if (
            trim_text(item.get('tower') or '', 40) == 'FP&A'
            and trim_text(item.get('section') or '', 80) == '02 Discovery'
            and trim_text(item.get('targetPath') or '', 160).startswith(DISCOVERY_OVERVIEW_TARGET_PREFIX)
            and trim_text(item.get('fieldKey') or '', 80) in DISCOVERY_OVERVIEW_LLM_FIELD_KEYS
        )
    ]


def extract_company_name_from_payload(payload: dict[str, Any] | None) -> str:
    if not isinstance(payload, dict):
        return ''

    suggestions = payload.get('fieldSuggestions') if isinstance(payload.get('fieldSuggestions'), list) else []
    for item in suggestions:
        if not isinstance(item, dict):
            continue
        target_path = trim_text(item.get('targetPath') or '', 160)
        field_key = trim_text(item.get('fieldKey') or '', 80)
        if target_path == 'clientName' or field_key == 'clientName':
            company_name = trim_text(item.get('proposedValue') or '', 180)
            if company_name:
                return company_name
    return ''


def extract_company_name_from_documents(documents: list[dict[str, Any]] | None, fallback_name: str = '') -> str:
    if isinstance(documents, list):
        for document in documents:
            if not isinstance(document, dict):
                continue
            preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
            detected_name = extract_company_name_from_payload(preview)
            if detected_name:
                return detected_name

    return trim_text(fallback_name or '', 180)


def normalize_company_research_rows(rows: Any, *, limit: int = 10) -> list[dict[str, str]]:
    normalized_rows: list[dict[str, str]] = []
    for raw_row in rows if isinstance(rows, list) else []:
        if not isinstance(raw_row, dict):
            continue
        label = trim_text(raw_row.get('label') or '', 80)
        value = trim_text(raw_row.get('value') or '', 200)
        note = trim_text(raw_row.get('note') or '', 240)
        if not label and not value:
            continue
        normalized_rows.append({
            'label': label or 'Field',
            'value': value,
            'note': note,
        })
        if len(normalized_rows) >= limit:
            break
    return normalized_rows


def normalize_company_research_sources(rows: Any, *, limit: int = 12) -> list[dict[str, str]]:
    normalized_sources: list[dict[str, str]] = []
    for raw_row in rows if isinstance(rows, list) else []:
        if not isinstance(raw_row, dict):
            continue
        title = trim_text(raw_row.get('title') or '', 180)
        domain = trim_text(raw_row.get('domain') or '', 120)
        url = trim_text(raw_row.get('url') or '', 320)
        as_of_date = trim_text(raw_row.get('asOfDate') or '', 80)
        note = trim_text(raw_row.get('note') or '', 220)
        if not title and not domain and not note:
            continue
        normalized_sources.append({
            'title': title,
            'domain': domain,
            'url': url,
            'asOfDate': as_of_date,
            'note': note,
        })
        if len(normalized_sources) >= limit:
            break
    return normalized_sources


def normalize_company_research_risks(rows: Any, *, limit: int = 10) -> list[dict[str, str]]:
    normalized_risks: list[dict[str, str]] = []
    for raw_row in rows if isinstance(rows, list) else []:
        if not isinstance(raw_row, dict):
            continue
        risk = trim_text(raw_row.get('risk') or '', 120)
        severity = trim_text(raw_row.get('severity') or '', 40)
        implication = trim_text(raw_row.get('implication') or '', 240)
        source = trim_text(raw_row.get('source') or '', 180)
        if not risk and not implication:
            continue
        normalized_risks.append({
            'risk': risk or 'Risk',
            'severity': severity,
            'implication': implication,
            'source': source,
        })
        if len(normalized_risks) >= limit:
            break
    return normalized_risks


def build_company_research_context(documents: list[dict[str, Any]] | None) -> str:
    if not isinstance(documents, list) or not documents:
        return ''

    lines = ['Uploaded client evidence:']
    for index, document in enumerate(documents[:8], start=1):
        if not isinstance(document, dict):
            continue
        file_name = trim_text(document.get('fileName') or f'Document {index}', 180)
        document_type = trim_text(document.get('documentType') or '', 40)
        summary = trim_text((document.get('preview') or {}).get('summary') if isinstance(document.get('preview'), dict) else '', 280)
        tower_hints = document.get('towerHints') if isinstance(document.get('towerHints'), list) else []
        tower_text = ', '.join([trim_text(item, 20) for item in tower_hints if trim_text(item, 20)])
        line = f'- {file_name}'
        if document_type:
            line += f' | type={document_type}'
        if tower_text:
            line += f' | towers={tower_text}'
        if summary:
            line += f' | summary={summary}'
        lines.append(line)
    return '\n'.join(lines)


def normalize_company_research_payload(payload: dict[str, Any] | None, *, company_name: str = '', used_web_search: bool = False) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None

    normalized_name = trim_text(payload.get('companyName') or company_name or '', 180)
    overview_fields: list[dict[str, Any]] = []
    for raw_field in payload.get('overviewFields', []):
        if not isinstance(raw_field, dict):
            continue
        target_path = trim_text(raw_field.get('targetPath') or '', 160)
        field_key = trim_text(raw_field.get('fieldKey') or '', 120)
        proposed_value = trim_text(raw_field.get('proposedValue') or '', 220)
        if not target_path or not proposed_value:
            continue
        overview_fields.append({
            'tower': trim_text(raw_field.get('tower') or 'FP&A', 40),
            'section': trim_text(raw_field.get('section') or '02 Discovery', 80),
            'subsection': trim_text(raw_field.get('subsection') or 'Company overview', 120),
            'fieldKey': field_key,
            'fieldLabel': trim_text(raw_field.get('fieldLabel') or field_key or target_path, 140),
            'targetPath': target_path,
            'controlType': trim_text(raw_field.get('controlType') or 'text', 60),
            'allowedValues': [trim_text(item, 80) for item in raw_field.get('allowedValues', []) if trim_text(item, 80)],
            'proposedValue': proposed_value,
            'sourceFile': trim_text(raw_field.get('sourceFile') or 'OpenAI web research', 180),
            'sourceLocation': trim_text(raw_field.get('sourceLocation') or 'public company research', 120),
            'evidenceSnippet': trim_text(raw_field.get('evidenceSnippet') or '', 260),
            'confidence': trim_text(raw_field.get('confidence') or 'Medium', 24),
            'rationale': trim_text(raw_field.get('rationale') or '', 220),
            'agentName': COMPANY_RESEARCH_AGENT_NAME,
        })

    sources = normalize_company_research_sources(payload.get('sources'))
    warnings = [trim_text(str(item), 200) for item in payload.get('warnings', []) if trim_text(str(item), 200)][:8]
    if used_web_search:
        warnings = merge_unique_strings([*warnings, 'Company research used OpenAI web search on public sources.'])

    return {
        'companyName': normalized_name,
        'analysisLens': trim_text(payload.get('analysisLens') or 'Finance deal diligence overview', 180),
        'executiveSummary': trim_text(payload.get('executiveSummary') or '', 1500),
        'businessOverview': normalize_company_research_rows(payload.get('businessOverview')),
        'headlineMetrics': normalize_company_research_rows(payload.get('headlineMetrics')),
        'financialOverview': normalize_company_research_rows(payload.get('financialOverview')),
        'dealImplications': normalize_company_research_rows(payload.get('dealImplications')),
        'keyRisks': normalize_company_research_risks(payload.get('keyRisks')),
        'overviewFields': overview_fields,
        'sources': sources,
        'sourceCount': len(sources),
        'warnings': warnings,
        'usedWebSearch': bool(used_web_search),
        'updatedAt': utc_now_iso(),
    }


def should_run_rfp_company_overview_agent(*, filename: str = '', mime_type: str = '', prepared_text: str = '', detected_company_name: str = '') -> bool:
    if trim_text(detected_company_name or '', 180):
        return True

    document_type = infer_document_type(filename, mime_type)
    if document_type == 'Spreadsheet':
        return False

    haystack = normalize_space((filename or '') + ' ' + trim_text(prepared_text or '', 30000)).lower()
    if not haystack:
        return False

    file_hits = sum(1 for pattern in RFP_DISCOVERY_OVERVIEW_FILE_KEYWORDS if pattern in haystack)
    text_hits = sum(1 for pattern in RFP_DISCOVERY_OVERVIEW_TEXT_KEYWORDS if pattern in haystack)

    if file_hits >= 1:
        return True

    if text_hits >= 4:
        return True

    return document_type in {'PDF', 'Document', 'Presentation', 'Text'} and text_hits >= 2


CORE_PORTAL_EXTRACTION_SECTIONS = {
    '02 Discovery',
    '03 Scope L3',
    '06 Complexity',
}

EXPANDED_FPA_EXTRACTION_SECTIONS = {
    '04 Benchmarks',
    '05 Workload',
    '06 Complexity',
    '07 Personas',
    '08 AI Benefit',
    '09 Ops Model',
    '10 Rate Card',
    '13 Pricing',
    '14 Outcome',
    '15 Transition',
    '20 Recommend',
    '21 Client Value',
    '24 Governance',
    '28 Change Log',
    '30 SCPL',
}

FPA_EXTRACTION_SECTION_KEYWORDS: dict[str, tuple[str, ...]] = {
    '04 Benchmarks': ('benchmark', 'norm', 'percentile', 'seasonality', 'driver table', 'epm', 'close cadence'),
    '05 Workload': ('workload', 'hours', 'fte', 'capacity', 'reconciliation', 'shared fte', 'monthly hours'),
    '06 Complexity': ('complexity', 'maturity', 'regulatory', 'stakeholder'),
    '07 Personas': ('persona', 'utilisation', 'utilization', 'shrinkage', 'working days', 'working hours', 'productivity glide'),
    '08 AI Benefit': ('automation', 'copilot', 'agent', 'ai benefit', 'addressability', 'reduction', 'residual', 'ramp'),
    '09 Ops Model': ('ops model', 'shore mix', 'onshore', 'nearshore', 'offshore', 'location blend', 'language coverage', 'pyramid'),
    '10 Rate Card': ('rate card', 'salary', 'band', 'benefits', 'wage inflation', 'seat cost', 'attrition', 'technology cost', 'arc'),
    '13 Pricing': ('pricing', 'gross margin', 'gm floor', 'gainshare', 'markup', 'commercial'),
    '14 Outcome': ('outcome', 'unit price', 'report pack', 'budget cycle', 'forecast cycle', 'value metric'),
    '15 Transition': ('transition', 'knowledge transfer', 'shadow', 'reverse shadow', 'hypercare', 'travel', 'pmo'),
    '20 Recommend': ('recommend', 'decision criteria', 'weighting', 'persona fit'),
    '21 Client Value': ('client value', 'baseline', 'overhead uplift', 'savings'),
    '24 Governance': ('approval', 'review', 'governance', 'sign-off'),
    '28 Change Log': ('change log', 'version note', 'reviewer', 'decision'),
    '30 SCPL': ('scpl', 'india', 'noida', 'chennai', 'hyderabad', 'fx', 'offshore share', 'location factor'),
}


def select_portal_field_catalog(*, filename: str = '', mime_type: str = '', prepared_text: str = '') -> list[dict[str, Any]]:
    catalog = load_portal_field_catalog()
    if infer_document_type(filename, mime_type) == 'Spreadsheet':
        return catalog

    haystack = normalize_space((filename or '') + ' ' + trim_text(prepared_text or '', 20000)).lower()
    matched_sections = set(CORE_PORTAL_EXTRACTION_SECTIONS)

    if should_expand_fpna_extraction_sections(haystack, filename=filename, prepared_text=prepared_text):
        matched_sections.update(EXPANDED_FPA_EXTRACTION_SECTIONS)

    for section, patterns in FPA_EXTRACTION_SECTION_KEYWORDS.items():
        if any(pattern in haystack for pattern in patterns):
            matched_sections.add(section)

    selected_catalog = [
        item
        for item in catalog
        if item.get('tower') == 'Deal Master' or trim_text(item.get('section') or '', 80) in matched_sections
    ]
    return selected_catalog or catalog


def build_portal_catalog_prompt(field_catalog: list[dict[str, Any]] | None = None) -> str:
    lines = [
        'Extract only fields supported by this portal. Skip anything not supported by the current portal.',
        'Return only portal-ready field suggestions that the user can review and then populate into Deal Master or the FP&A tower.',
        'Do not return atomic facts, driver candidates, open questions, or local source previews.',
        'If two documents disagree on the same field, return separate suggestions with their own source references instead of silently choosing one.',
        'Prefer clarified client addenda, structured client data files, and explicit sheet/page references over generic narrative statements.',
        'For select fields, choose only from the allowed values listed. For boolean fields, use only Yes or No.',
        'For FP&A scope, only return rows that are explicitly evidenced. Do not invent in-scope rows. If only the L2 process is mentioned, return the L2 row and do not fabricate L3 activities.',
        'For workbook-input tabs like SCPL, return only editable driver inputs. Do not return calculated output cells or derived KPIs.',
        'Formula-driven output tabs such as FTE Engine, Cost, Business Case, Sensitivity, Risk, Deal Risks, Dashboard, Trace Log, Confidence, Calibration, Benchmark Pack, and L3 Business View should only be populated indirectly through their listed upstream editable inputs.',
        'For percent-style controls, prefer user-facing values like 15% when the document expresses a percentage.',
        'For pain-point rows, use one of: No, Yes | Low, Yes | Medium, Yes | High, Yes | Critical.',
        'Catalog:',
    ]
    catalog = field_catalog or load_portal_field_catalog()
    for item in catalog:
        allowed_values = item.get('allowedValues') or []
        allowed_text = f" | allowed={'; '.join(allowed_values)}" if allowed_values else ''
        lines.append(
            f"- tower={item['tower']} | section={item['section']} | subsection={item['subsection']} | key={item['fieldKey']} | label={item['fieldLabel']} | target={item['targetPath']} | control={item['controlType']}{allowed_text}"
        )
    return '\n'.join(lines)


def build_rfp_discovery_overview_prompt(field_catalog: list[dict[str, Any]] | None = None) -> str:
    intro_lines = [
        'Focused pass: identify the client / company name from the uploaded source, then fill only the safe FP&A Discovery company-overview fields listed in the catalog.',
        'This pass is allowed to use general LLM knowledge about the company only after the company is clearly identifiable from the source document.',
        'Only use general company knowledge for public-profile fields such as industry, revenue scale, employee base, geographic footprint, business units, or product / service lines.',
        'Do not use general knowledge for private internal finance-process fields such as staffing baseline, cost baseline, EPM landscape, ERP estate, governance model, or process cadence unless the document itself states them.',
        'Do not return Discovery coverage flags, pain-point rows, scope rows, benchmarks, or downstream calculated tabs in this pass.',
        'If a value comes from general company knowledge rather than an explicit client statement, set confidence to Low or Medium, explain that clearly in rationale, and note that the source location is an LLM company profile from the client name that still needs verification.',
        'If the document explicitly lists countries, business units, products, languages, or systems, you may count those lists and explain the counting logic in rationale.',
        'Always cite the tightest possible page, section, slide, or sheet reference for each returned value.',
    ]
    return '\n'.join(intro_lines) + '\n\n' + build_portal_catalog_prompt(field_catalog or load_discovery_overview_field_catalog())


def build_company_research_prompt(company_name: str, field_catalog: list[dict[str, Any]] | None = None) -> str:
    catalog = field_catalog or load_discovery_overview_field_catalog()
    lines = [
        f'You are a finance diligence research agent preparing a company extraction pack for {trim_text(company_name, 180)}.',
        'Use web search on public sources before answering whenever available.',
        'Think like a finance deal professional.',
        'Focus on business model, scale, segment mix, public financial signals, recent strategic events, risks, and what these imply for FP&A discovery.',
        'Do not invent private internal delivery data, systems, staffing baselines, or cost baselines unless the uploaded documents state them.',
        'Return only JSON that matches the schema.',
        'For overviewFields, fill only the safe Discovery company-profile fields listed below.',
        '',
        'Discovery field catalog:',
        build_portal_catalog_prompt(catalog),
    ]
    return '\n'.join(lines)


def company_overview_target_rank(target_path: str) -> int:
    normalized = trim_text(target_path or '', 160)
    return COMPANY_OVERVIEW_PRIORITY_RANK.get(normalized, len(COMPANY_OVERVIEW_PRIORITY_RANK) + 20)


def build_company_overview_suggestion_score(suggestion: dict[str, Any], document: dict[str, Any] | None = None) -> int:
    agent_name = trim_text(suggestion.get('agentName') or '', 80)
    source_location = trim_text(suggestion.get('sourceLocation') or '', 120)
    evidence_snippet = trim_text(suggestion.get('evidenceSnippet') or '', 260)
    confidence = trim_text(suggestion.get('confidence') or '', 24)
    document_payload = document if isinstance(document, dict) else {}

    score = confidence_rank(confidence) * 100
    if agent_name == DISCOVERY_OVERVIEW_AGENT_NAME:
        score += 35
    if source_location:
        score += 8
    if evidence_snippet:
        score += 6
    score += int(document_payload.get('sourceTierRank') or 0) * 3
    score += int(document_payload.get('reliabilityRank') or 0) * 2
    return score


def build_company_overview_summary(fields_by_target: dict[str, dict[str, Any]]) -> str:
    summary_parts: list[str] = []
    for target_path in (
        'fpaWorkspace.discovery.industryVertical',
        'fpaWorkspace.discovery.annualRevenueUsdM',
        'fpaWorkspace.discovery.employeeCount000',
        'fpaWorkspace.discovery.geoCountries',
        'fpaWorkspace.discovery.businessUnits',
        'fpaWorkspace.discovery.productServiceLines',
    ):
        field = fields_by_target.get(target_path)
        if not isinstance(field, dict):
            continue
        label = trim_text(field.get('label') or field.get('fieldLabel') or '', 80)
        value = trim_text(field.get('value') or '', 140)
        if not label or not value:
            continue
        summary_parts.append(f'{label}: {value}')
        if len(summary_parts) >= 4:
            break

    return ' | '.join(summary_parts)


def build_company_overview_snapshot(
    documents: list[dict[str, Any]],
    *,
    company_research: dict[str, Any] | None = None,
    updated_at: str = '',
) -> dict[str, Any] | None:
    has_documents = isinstance(documents, list) and bool(documents)
    has_research = isinstance(company_research, dict) and bool(company_research)
    if not has_documents and not has_research:
        return None

    fields_by_target: dict[str, dict[str, Any]] = {}
    source_files: list[str] = []
    seen_source_files: set[str] = set()

    def register_candidate(raw_suggestion: dict[str, Any], document_payload: dict[str, Any] | None = None, *, default_source_file: str = '') -> None:
        target_path = trim_text(raw_suggestion.get('targetPath') or '', 160)
        if not target_path or (target_path != 'clientName' and not target_path.startswith(DISCOVERY_OVERVIEW_TARGET_PREFIX)):
            return

        value = trim_text(raw_suggestion.get('proposedValue') or raw_suggestion.get('value') or '', 220)
        if not value:
            return

        candidate = {
            'targetPath': target_path,
            'fieldKey': trim_text(raw_suggestion.get('fieldKey') or '', 120),
            'label': trim_text(raw_suggestion.get('fieldLabel') or raw_suggestion.get('label') or raw_suggestion.get('fieldKey') or target_path, 140),
            'value': value,
            'confidence': trim_text(raw_suggestion.get('confidence') or '', 24),
            'sourceFile': trim_text(raw_suggestion.get('sourceFile') or default_source_file, 180),
            'sourceLocation': trim_text(raw_suggestion.get('sourceLocation') or '', 120),
            'evidenceSnippet': trim_text(raw_suggestion.get('evidenceSnippet') or '', 260),
            'rationale': trim_text(raw_suggestion.get('rationale') or '', 220),
            'agentName': trim_text(raw_suggestion.get('agentName') or '', 80),
        }
        candidate_score = build_company_overview_suggestion_score(candidate, document_payload)
        existing = fields_by_target.get(target_path)
        if existing and int(existing.get('_score') or 0) >= candidate_score:
            return

        fields_by_target[target_path] = {
            **candidate,
            '_score': candidate_score,
        }

    if has_documents:
        for document in documents:
            if not isinstance(document, dict):
                continue
            preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
            suggestions = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []

            document_file = trim_text(document.get('fileName') or '', 180)
            if document_file and document_file not in seen_source_files:
                seen_source_files.add(document_file)
                source_files.append(document_file)

            for raw_suggestion in suggestions:
                if not isinstance(raw_suggestion, dict):
                    continue
                register_candidate(raw_suggestion, document, default_source_file=document_file)

    if has_research:
        for raw_suggestion in company_research.get('overviewFields', []):
            if not isinstance(raw_suggestion, dict):
                continue
            register_candidate(
                raw_suggestion,
                {'sourceTierRank': 5, 'reliabilityRank': 5},
                default_source_file=trim_text(raw_suggestion.get('sourceFile') or 'OpenAI web research', 180),
            )

    if not fields_by_target:
        return None

    ordered_fields = [
        {
            key: value
            for key, value in field.items()
            if key != '_score'
        }
        for _, field in sorted(
            fields_by_target.items(),
            key=lambda item: (company_overview_target_rank(item[0]), trim_text(item[1].get('label') or '', 140)),
        )
    ]

    company_name = trim_text((fields_by_target.get('clientName') or {}).get('value') or '', 180)
    if not company_name and has_research:
        company_name = trim_text(company_research.get('companyName') or '', 180)
    summary = build_company_overview_summary(fields_by_target)

    return {
        'companyName': company_name,
        'summary': summary,
        'fieldCount': len(ordered_fields),
        'sourceFiles': source_files[:8],
        'fields': ordered_fields,
        'updatedAt': trim_text(updated_at or utc_now_iso(), 40),
    }

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slugify(value: str) -> str:
    text = re.sub(r'[^a-zA-Z0-9._-]+', '-', str(value or '').strip())
    text = re.sub(r'-{2,}', '-', text).strip('-._')
    return text or 'document'


def trim_text(value: str, limit: int) -> str:
    text = str(value or '').strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + '…'


def normalize_space(value: str) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def limit_context_text(value: str, limit: int = PREPARED_TEXT_MAX_CHARS) -> tuple[str, bool]:
    text = str(value or '').strip()
    if len(text) <= limit:
        return text, False
    return text[:limit].rstrip(), True


def decode_text(raw: bytes) -> str:
    for encoding in ('utf-8', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin-1'):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode('utf-8', errors='ignore')


def guess_towers(*parts: str) -> list[str]:
    text = ' '.join(parts).lower()
    hints: list[str] = []
    mappings = {
        'FPA': ['fp&a', 'fpa', 'plan', 'forecast', 'budget', 'finance planning'],
        'RTR': ['rtr', 'record to report', 'close', 'journal', 'reconciliation'],
        'O2C': ['o2c', 'order to cash', 'invoice', 'cash', 'collections', 'dispute'],
        'P2P': ['p2p', 'procure to pay', 'plan-to-perform', 'vendor', 'po', 'payment run'],
    }
    for code, patterns in mappings.items():
        if any(pattern in text for pattern in patterns):
            hints.append(code)
    return hints or ['All']


def should_expand_fpna_extraction_sections(haystack: str, *, filename: str = '', prepared_text: str = '') -> bool:
    preferred_towers = guess_towers(filename, prepared_text)
    if 'FPA' in preferred_towers:
        return True

    finance_markers = (
        'fp&a',
        'fpa',
        'finance planning',
        'financial planning',
        'forecast',
        'budget',
        'plan-to-perform',
        'plan to perform',
        'variance analysis',
        'management reporting',
    )
    return any(marker in haystack for marker in finance_markers)


def infer_document_type(filename: str, mime_type: str) -> str:
    ext = Path(filename or '').suffix.lower()
    if ext in {'.xlsx', '.xlsm', '.xls'}:
        return 'Spreadsheet'
    if ext in {'.ppt', '.pptx'}:
        return 'Presentation'
    if ext in {'.doc', '.docx'}:
        return 'Document'
    if ext == '.pdf' or 'pdf' in mime_type.lower():
        return 'PDF'
    if ext in {'.csv', '.txt', '.md', '.json', '.log'}:
        return 'Text'
    return 'File'


def data_url_for_file(file_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(file_bytes).decode('ascii')
    return f'data:{mime_type};base64,{encoded}'


def extract_output_text(response: Any) -> str:
    output_text = getattr(response, 'output_text', None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()
    output = getattr(response, 'output', None) or []
    parts: list[str] = []
    for item in output:
        content = getattr(item, 'content', None) or []
        for part in content:
            text = getattr(part, 'text', None)
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
    return '\n'.join(parts).strip()


def extract_docx_text(file_bytes: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            xml = archive.read('word/document.xml')
    except Exception:
        return ''
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return ''
    texts = [node.text for node in root.iter() if node.tag.endswith('}t') and node.text]
    return '\n'.join(normalize_space(text) for text in texts if normalize_space(text))


def extract_pptx_text(file_bytes: bytes) -> tuple[str, dict[str, Any]]:
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            slide_names = sorted(name for name in archive.namelist() if name.startswith('ppt/slides/slide') and name.endswith('.xml'))
            slides: list[str] = []
            for index, name in enumerate(slide_names, start=1):
                try:
                    root = ET.fromstring(archive.read(name))
                except ET.ParseError:
                    continue
                texts = [normalize_space(node.text) for node in root.iter() if node.tag.endswith('}t') and node.text]
                texts = [item for item in texts if item]
                if texts:
                    slides.append(f'Slide {index}: ' + ' | '.join(texts[:PPTX_MAX_TEXT_RUNS_PER_SLIDE]))
            return '\n\n'.join(slides), {'slideCount': len(slide_names), 'slideTextLimit': PPTX_MAX_TEXT_RUNS_PER_SLIDE}
    except Exception:
        return '', {'slideCount': 0}


def load_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if 'xl/sharedStrings.xml' not in archive.namelist():
        return []
    try:
        root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
    except ET.ParseError:
        return []
    values: list[str] = []
    for item in root.iter():
        if item.tag.endswith('}si'):
            texts = [node.text or '' for node in item.iter() if node.tag.endswith('}t')]
            values.append(''.join(texts).strip())
    return values


def resolve_xlsx_sheet_names(archive: zipfile.ZipFile) -> list[tuple[str, str]]:
    try:
        workbook_root = ET.fromstring(archive.read('xl/workbook.xml'))
        rel_root = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
    except Exception:
        return []
    rel_map: dict[str, str] = {}
    for rel in rel_root.iter():
        if rel.tag.endswith('}Relationship'):
            rel_id = rel.attrib.get('Id')
            target = rel.attrib.get('Target')
            if rel_id and target:
                rel_map[rel_id] = target.replace('\\', '/').lstrip('/')
    sheets: list[tuple[str, str]] = []
    for sheet in workbook_root.iter():
        if not sheet.tag.endswith('}sheet'):
            continue
        name = sheet.attrib.get('name') or 'Sheet'
        rel_id = sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = rel_map.get(rel_id or '', '')
        if not target:
            continue
        path = target if target.startswith('xl/') else f'xl/{target}'
        sheets.append((name, path))
    return sheets


def extract_xlsx_text(file_bytes: bytes) -> tuple[str, dict[str, Any]]:
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            shared_strings = load_shared_strings(archive)
            sheets = resolve_xlsx_sheet_names(archive)
            if not sheets:
                sheet_files = sorted(name for name in archive.namelist() if name.startswith('xl/worksheets/') and name.endswith('.xml'))
                sheets = [(f'Sheet {index}', name) for index, name in enumerate(sheet_files, start=1)]
            sections: list[str] = []
            populated_sheets = 0
            for sheet_name, sheet_path in sheets:
                if sheet_path not in archive.namelist():
                    continue
                try:
                    root = ET.fromstring(archive.read(sheet_path))
                except ET.ParseError:
                    continue
                rows: list[str] = []
                for row in root.iter():
                    if not row.tag.endswith('}row'):
                        continue
                    cells: list[str] = []
                    for cell in row:
                        if not cell.tag.endswith('}c'):
                            continue
                        ref = cell.attrib.get('r') or ''
                        value_node = next((node for node in cell if node.tag.endswith('}v')), None)
                        if value_node is None or value_node.text is None:
                            continue
                        raw_value = value_node.text.strip()
                        if not raw_value:
                            continue
                        if cell.attrib.get('t') == 's':
                            try:
                                raw_value = shared_strings[int(raw_value)]
                            except Exception:
                                pass
                        raw_value = normalize_space(raw_value)
                        if raw_value:
                            cells.append(f'{ref}={raw_value}')
                    if cells:
                        rows.append(' | '.join(cells[:XLSX_MAX_CELLS_PER_ROW]))
                    if len(rows) >= XLSX_MAX_ROWS_PER_SHEET:
                        break
                if rows:
                    populated_sheets += 1
                    sections.append(f'[{sheet_name}]\n' + '\n'.join(rows))
            return '\n\n'.join(sections), {
                'sheetCount': len(sheets),
                'populatedSheetCount': populated_sheets,
                'sheetRowLimit': XLSX_MAX_ROWS_PER_SHEET,
                'sheetCellLimit': XLSX_MAX_CELLS_PER_ROW,
            }
    except Exception:
        return '', {'sheetCount': 0, 'populatedSheetCount': 0}


def prepare_document_context(file_bytes: bytes, filename: str, mime_type: str) -> tuple[str, dict[str, Any]]:
    ext = Path(filename or '').suffix.lower()
    metadata: dict[str, Any] = {'contentPrep': 'none'}
    prepared_text = ''
    if ext in TEXT_EXTENSIONS:
        metadata['contentPrep'] = 'plain_text'
        prepared_text = decode_text(file_bytes)
    elif ext == '.docx':
        metadata['contentPrep'] = 'docx_xml'
        prepared_text = extract_docx_text(file_bytes)
    elif ext == '.pptx':
        text, extra = extract_pptx_text(file_bytes)
        metadata.update(extra)
        metadata['contentPrep'] = 'pptx_xml'
        prepared_text = text
    elif ext in {'.xlsx', '.xlsm'}:
        text, extra = extract_xlsx_text(file_bytes)
        metadata.update(extra)
        metadata['contentPrep'] = 'xlsx_xml'
        prepared_text = text
    elif mime_type.startswith('text/'):
        metadata['contentPrep'] = 'plain_text'
        prepared_text = decode_text(file_bytes)

    limited_text, was_truncated = limit_context_text(prepared_text, PREPARED_TEXT_MAX_CHARS)
    metadata['preparedTextRawChars'] = len(str(prepared_text or ''))
    metadata['preparedTextTruncated'] = was_truncated
    return limited_text, metadata


def split_text_windows(text: str, *, target_chars: int = PREPARED_TEXT_CHUNK_TARGET_CHARS, overlap_chars: int = PREPARED_TEXT_CHUNK_OVERLAP_CHARS) -> list[str]:
    prepared = str(text or '').strip()
    if not prepared:
        return []
    if len(prepared) <= target_chars:
        return [prepared]

    windows: list[str] = []
    start = 0
    text_length = len(prepared)
    while start < text_length:
        tentative_end = min(text_length, start + target_chars)
        end = tentative_end
        if tentative_end < text_length:
            min_boundary = start + max(1, target_chars // 2)
            boundary_candidates = [
                prepared.rfind('\n\n', min_boundary, tentative_end),
                prepared.rfind('\n', min_boundary, tentative_end),
                prepared.rfind('. ', min_boundary, tentative_end),
                prepared.rfind('; ', min_boundary, tentative_end),
                prepared.rfind(' | ', min_boundary, tentative_end),
            ]
            boundary = max(boundary_candidates)
            if boundary > min_boundary:
                end = boundary
        if end <= start:
            end = tentative_end
        chunk = prepared[start:end].strip()
        if chunk:
            windows.append(chunk)
        if end >= text_length:
            break
        next_start = max(end - overlap_chars, start + 1)
        if next_start <= start:
            next_start = end
        start = next_start
    return windows


def build_prepared_text_chunks(prepared_text: str, parser_meta: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    prepared = str(prepared_text or '').strip()
    if not prepared:
        return [], {'chunkStrategy': 'raw_file_only', 'chunkCount': 0, 'omittedChunkCount': 0, 'segmentCount': 0}

    content_prep = trim_text(parser_meta.get('contentPrep') or '', 40)
    if content_prep == 'xlsx_xml':
        strategy = 'sheet_sections'
        raw_segments = re.split(r'\n{2,}(?=\[[^\]\n]+\]\n)', prepared)
    elif content_prep == 'pptx_xml':
        strategy = 'slide_sections'
        raw_segments = re.split(r'\n{2,}(?=Slide \d+:)', prepared)
    else:
        strategy = 'paragraph_blocks'
        raw_segments = re.split(r'\n{2,}', prepared)

    segments: list[dict[str, str]] = []
    for index, raw_segment in enumerate(raw_segments, start=1):
        segment_text = str(raw_segment or '').strip()
        if not segment_text:
            continue
        first_line = segment_text.splitlines()[0] if segment_text.splitlines() else ''
        if strategy == 'sheet_sections' and first_line.startswith('[') and first_line.endswith(']'):
            label = trim_text(first_line.strip('[]') or f'Sheet {index}', 80)
        elif strategy == 'slide_sections' and first_line.lower().startswith('slide '):
            label = trim_text(first_line.split(':', 1)[0] or f'Slide {index}', 80)
        else:
            label = trim_text(first_line or f'Section {index}', 80)
        segments.append({'label': label, 'text': segment_text})

    if not segments:
        segments = [{'label': 'Document text', 'text': prepared}]

    all_chunks: list[dict[str, Any]] = []
    current_texts: list[str] = []
    current_labels: list[str] = []
    current_chars = 0

    def flush_current() -> None:
        nonlocal current_texts, current_labels, current_chars
        if not current_texts:
            return
        label = ', '.join(current_labels[:3])
        if len(current_labels) > 3:
            label += f' (+{len(current_labels) - 3} more)'
        all_chunks.append({'label': trim_text(label or 'Document text', 120), 'text': '\n\n'.join(current_texts).strip()})
        current_texts = []
        current_labels = []
        current_chars = 0

    for segment in segments:
        segment_text = segment['text']
        segment_label = segment['label']
        windows = split_text_windows(segment_text)
        if len(windows) > 1:
            flush_current()
            for window_index, window_text in enumerate(windows, start=1):
                all_chunks.append({
                    'label': trim_text(f'{segment_label} - part {window_index}', 120),
                    'text': window_text,
                })
            continue

        window_text = windows[0] if windows else segment_text
        separator_chars = 2 if current_texts else 0
        projected_chars = current_chars + len(window_text) + separator_chars
        if current_texts and projected_chars > PREPARED_TEXT_CHUNK_TARGET_CHARS:
            flush_current()
        current_texts.append(window_text)
        current_labels.append(segment_label)
        current_chars += len(window_text) + separator_chars

    flush_current()

    chunks = all_chunks[:PREPARED_TEXT_MAX_CHUNKS]
    omitted_chunk_count = max(0, len(all_chunks) - len(chunks))
    return chunks, {
        'chunkStrategy': strategy,
        'chunkCount': len(chunks),
        'omittedChunkCount': omitted_chunk_count,
        'segmentCount': len(segments),
    }


def merge_unique_strings(values: list[Any], *, item_limit: int = 180, max_items: int = 12) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in values:
        text = trim_text(str(item or ''), item_limit)
        if not text or text in seen:
            continue
        result.append(text)
        seen.add(text)
        if len(result) >= max_items:
            break
    return result


def normalize_extraction(raw: dict[str, Any] | None, *, filename: str, mime_type: str, parser_meta: dict[str, Any], used_openai: bool) -> dict[str, Any]:
    payload = raw if isinstance(raw, dict) else {}
    warnings = [trim_text(str(item), 180) for item in payload.get('warnings', []) if str(item).strip()]
    openai_disabled_reason = trim_text(str(parser_meta.get('openAiDisabledReason') or ''), 180)
    openai_error = trim_text(str(parser_meta.get('openAiError') or ''), 180)
    if openai_disabled_reason and openai_disabled_reason not in warnings:
        warnings.append(openai_disabled_reason)
    if openai_error and openai_error not in warnings:
        warnings.append(openai_error)

    lookup = load_portal_field_lookup()
    suggestions: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()

    for item in payload.get('fieldSuggestions', []):
        if not isinstance(item, dict):
            continue
        field_key = trim_text(item.get('fieldKey') or '', 120)
        catalog_item = lookup.get(field_key)
        if not catalog_item:
            continue
        proposed_value = trim_text(item.get('proposedValue') or '', 220)
        evidence_snippet = trim_text(item.get('evidenceSnippet') or '', 260)
        source_file = trim_text(item.get('sourceFile') or filename, 180)
        source_location = trim_text(item.get('sourceLocation') or '', 120)
        confidence = trim_text(item.get('confidence') or payload.get('confidenceClass') or '', 24) or ('Medium' if used_openai else 'Low')
        rationale = trim_text(item.get('rationale') or '', 220)
        if not proposed_value or not evidence_snippet:
            continue
        dedupe_key = (field_key, proposed_value, source_file, source_location)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        suggestions.append({
            'agentName': trim_text(item.get('agentName') or '', 80),
            'tower': trim_text(catalog_item.get('tower') or item.get('tower') or '', 40) or 'Deal Master',
            'section': trim_text(catalog_item.get('section') or item.get('section') or '', 80) or 'Deal Master',
            'subsection': trim_text(catalog_item.get('subsection') or item.get('subsection') or '', 120),
            'fieldKey': field_key,
            'fieldLabel': trim_text(catalog_item.get('fieldLabel') or item.get('fieldLabel') or field_key, 140),
            'targetPath': trim_text(catalog_item.get('targetPath') or item.get('targetPath') or '', 160),
            'controlType': trim_text(catalog_item.get('controlType') or item.get('controlType') or 'text', 40),
            'allowedValues': [trim_text(value, 120) for value in (catalog_item.get('allowedValues') or item.get('allowedValues') or []) if trim_text(value, 120)],
            'proposedValue': proposed_value,
            'sourceFile': source_file,
            'sourceLocation': source_location,
            'evidenceSnippet': evidence_snippet,
            'confidence': confidence,
            'rationale': rationale,
        })

    suggestions = suggestions[:120]
    summary = trim_text(payload.get('summary') or '', 600)
    if not summary:
        if suggestions:
            summary = f'ChatGPT found {len(suggestions)} reviewable field suggestion(s) from this file for Deal Master / FP&A validation.'
        else:
            summary = f'Uploaded {filename}. No portal-ready fields were confidently extracted from this file.'

    tower_hints = payload.get('towerHints') if isinstance(payload.get('towerHints'), list) else []
    normalized_towers: list[str] = []
    seen_towers: set[str] = set()
    inferred_towers = [item.get('tower') for item in suggestions if item.get('tower')]
    hint_source = tower_hints or inferred_towers or guess_towers(filename, summary)
    for tower in hint_source:
        tower_value = trim_text(str(tower), 24) or 'All'
        if tower_value in seen_towers:
            continue
        normalized_towers.append(tower_value)
        seen_towers.add(tower_value)

    return {
        'status': 'ai_extracted' if used_openai else 'ai_required',
        'previewVersion': 'tower_field_suggestions_v1',
        'documentType': trim_text(payload.get('documentType') or infer_document_type(filename, mime_type), 40),
        'summary': summary,
        'towerHints': normalized_towers,
        'confidenceClass': trim_text(payload.get('confidenceClass') or ('Medium' if used_openai else 'Low'), 24),
        'fieldSuggestions': suggestions,
        'warnings': warnings[:8],
        'parserMeta': parser_meta,
    }


def build_langfuse_field_preview(payload: dict[str, Any] | None, *, limit: int = 12) -> dict[str, Any]:
    data = payload if isinstance(payload, dict) else {}
    suggestions = data.get('fieldSuggestions') if isinstance(data.get('fieldSuggestions'), list) else []
    suggestion_rows = [item for item in suggestions if isinstance(item, dict)]
    preview_rows: list[dict[str, Any]] = []

    for item in suggestion_rows[:limit]:
        preview_rows.append({
            'agentName': trim_text(item.get('agentName') or '', 80),
            'tower': trim_text(item.get('tower') or '', 40),
            'section': trim_text(item.get('section') or '', 80),
            'fieldLabel': trim_text(item.get('fieldLabel') or item.get('fieldKey') or 'Field', 120),
            'proposedValue': trim_text(item.get('proposedValue') or '', 140),
            'sourceFile': trim_text(item.get('sourceFile') or '', 160),
            'sourceLocation': trim_text(item.get('sourceLocation') or '', 120),
            'evidenceSnippet': trim_text(item.get('evidenceSnippet') or '', 220),
            'confidence': trim_text(item.get('confidence') or data.get('confidenceClass') or '', 24),
        })

    warnings = [trim_text(str(item), 180) for item in data.get('warnings', []) if str(item).strip()][:5]

    return {
        'documentType': trim_text(data.get('documentType') or '', 40),
        'summary': trim_text(data.get('summary') or '', 320),
        'confidenceClass': trim_text(data.get('confidenceClass') or '', 24),
        'fieldSuggestionCount': len(suggestion_rows),
        'fieldSuggestionsPreview': preview_rows,
        'fieldSuggestionsTruncated': len(preview_rows) < len(suggestion_rows),
        'warnings': warnings,
    }


def build_langfuse_company_research_preview(payload: dict[str, Any] | None, *, limit: int = 6) -> dict[str, Any]:
    data = payload if isinstance(payload, dict) else {}
    metrics = normalize_company_research_rows(data.get('headlineMetrics'), limit=limit)
    overview_fields = data.get('overviewFields') if isinstance(data.get('overviewFields'), list) else []
    sources = normalize_company_research_sources(data.get('sources'), limit=limit)
    risks = normalize_company_research_risks(data.get('keyRisks'), limit=limit)

    return {
        'companyName': trim_text(data.get('companyName') or '', 180),
        'analysisLens': trim_text(data.get('analysisLens') or '', 180),
        'executiveSummary': trim_text(data.get('executiveSummary') or '', 600),
        'headlineMetricsPreview': metrics,
        'overviewFieldCount': len([item for item in overview_fields if isinstance(item, dict)]),
        'riskPreview': risks,
        'sourcePreview': sources,
        'warningCount': len([item for item in data.get('warnings', []) if trim_text(str(item), 80)]),
        'usedWebSearch': bool(data.get('usedWebSearch')),
    }


def annotate_agent_payload(payload: dict[str, Any] | None, *, agent_name: str, warning_text: str = '') -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None

    annotated = deepcopy(payload)
    suggestions = annotated.get('fieldSuggestions') if isinstance(annotated.get('fieldSuggestions'), list) else []
    next_suggestions: list[dict[str, Any]] = []

    for raw_suggestion in suggestions:
        if not isinstance(raw_suggestion, dict):
            continue
        suggestion = deepcopy(raw_suggestion)
        suggestion['agentName'] = trim_text(agent_name, 80)
        rationale = trim_text(suggestion.get('rationale') or '', 220)
        if rationale:
            suggestion['rationale'] = trim_text(f'{agent_name}: {rationale}', 220)
        else:
            suggestion['rationale'] = trim_text(agent_name, 220)
        next_suggestions.append(suggestion)

    annotated['fieldSuggestions'] = next_suggestions
    if warning_text:
        annotated['warnings'] = merge_unique_strings([*(annotated.get('warnings') or []), warning_text])
    return annotated


def confidence_rank(value: str | None) -> int:
    normalized = str(value or '').strip().lower()
    return {
        'very high': 5,
        'high': 4,
        'medium': 3,
        'low': 2,
        'very low': 1,
    }.get(normalized, 0)


def build_field_memory_summary(entries: list[dict[str, Any]], *, updated_field_count: int = 0) -> dict[str, Any]:
    tower_keys = {str(item.get('tower') or '').strip() for item in entries if str(item.get('tower') or '').strip()}
    section_keys = {
        f"{str(item.get('tower') or '').strip()}::{str(item.get('section') or '').strip()}"
        for item in entries
        if str(item.get('tower') or '').strip() and str(item.get('section') or '').strip()
    }
    status_counts: dict[str, int] = {}
    for item in entries:
        status_value = trim_text(item.get('status') or 'suggested', 24) or 'suggested'
        status_counts[status_value] = status_counts.get(status_value, 0) + 1

    return {
        'fieldCount': len(entries),
        'towerCount': len(tower_keys),
        'sectionCount': len(section_keys),
        'updatedFieldCount': updated_field_count,
        'statusCounts': status_counts,
    }


def normalize_field_memory(memory: dict[str, Any] | None) -> dict[str, Any]:
    payload = memory if isinstance(memory, dict) else {}
    entries: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for raw_entry in payload.get('entries', []):
        if not isinstance(raw_entry, dict):
            continue
        memory_key = trim_text(raw_entry.get('memoryKey') or '', 240)
        field_key = trim_text(raw_entry.get('fieldKey') or '', 120)
        if not memory_key:
            if not field_key:
                continue
            memory_key = field_key
        if memory_key in seen_keys:
            continue

        sources: list[dict[str, Any]] = []
        source_seen: set[tuple[str, str, str]] = set()
        for raw_source in raw_entry.get('sources', []):
            if not isinstance(raw_source, dict):
                continue
            source_file = trim_text(raw_source.get('sourceFile') or '', 180)
            source_location = trim_text(raw_source.get('sourceLocation') or '', 120)
            proposed_value = trim_text(raw_source.get('proposedValue') or '', 220)
            if not proposed_value:
                continue
            dedupe_key = (source_file, source_location, proposed_value)
            if dedupe_key in source_seen:
                continue
            source_seen.add(dedupe_key)
            sources.append({
                'documentId': trim_text(raw_source.get('documentId') or '', 80),
                'sourceFile': source_file,
                'sourceLocation': source_location,
                'proposedValue': proposed_value,
                'evidenceSnippet': trim_text(raw_source.get('evidenceSnippet') or '', 260),
                'confidence': trim_text(raw_source.get('confidence') or '', 24),
                'rationale': trim_text(raw_source.get('rationale') or '', 220),
                'runId': trim_text(raw_source.get('runId') or '', 80),
                'updatedAt': trim_text(raw_source.get('updatedAt') or '', 40),
            })

        entry = {
            'memoryKey': memory_key,
            'tower': trim_text(raw_entry.get('tower') or '', 40),
            'section': trim_text(raw_entry.get('section') or '', 80),
            'subsection': trim_text(raw_entry.get('subsection') or '', 120),
            'fieldKey': field_key,
            'fieldLabel': trim_text(raw_entry.get('fieldLabel') or field_key or 'Field', 140),
            'targetPath': trim_text(raw_entry.get('targetPath') or '', 160),
            'controlType': trim_text(raw_entry.get('controlType') or 'text', 40),
            'currentValue': trim_text(raw_entry.get('currentValue') or '', 220),
            'currentConfidence': trim_text(raw_entry.get('currentConfidence') or '', 24),
            'currentRationale': trim_text(raw_entry.get('currentRationale') or '', 220),
            'lastSourceFile': trim_text(raw_entry.get('lastSourceFile') or '', 180),
            'lastSourceLocation': trim_text(raw_entry.get('lastSourceLocation') or '', 120),
            'lastEvidenceSnippet': trim_text(raw_entry.get('lastEvidenceSnippet') or '', 260),
            'lastDocumentId': trim_text(raw_entry.get('lastDocumentId') or '', 80),
            'lastRunId': trim_text(raw_entry.get('lastRunId') or '', 80),
            'lastUpdatedAt': trim_text(raw_entry.get('lastUpdatedAt') or payload.get('updatedAt') or '', 40),
            'status': trim_text(raw_entry.get('status') or 'suggested', 24) or 'suggested',
            'sourceCount': len(sources),
            'suggestionCount': max(int(raw_entry.get('suggestionCount') or 0), len(sources)),
            'sources': sources[:8],
        }
        entries.append(entry)
        seen_keys.add(memory_key)

    entries.sort(key=lambda item: (
        str(item.get('tower') or ''),
        str(item.get('section') or ''),
        str(item.get('fieldLabel') or ''),
        str(item.get('memoryKey') or ''),
    ))

    return {
        'version': trim_text(payload.get('version') or 'v1', 24) or 'v1',
        'updatedAt': trim_text(payload.get('updatedAt') or '', 40),
        'lastRunId': trim_text(payload.get('lastRunId') or '', 80),
        'entries': entries,
        'summary': build_field_memory_summary(entries),
    }


def merge_field_memory(existing_memory: dict[str, Any] | None, documents: list[dict[str, Any]], *, run_id: str, updated_at: str) -> dict[str, Any]:
    memory = normalize_field_memory(existing_memory)
    entries_by_key = {str(item.get('memoryKey') or ''): deepcopy(item) for item in memory.get('entries', []) if str(item.get('memoryKey') or '')}
    updated_keys: set[str] = set()

    for document in documents:
        if not isinstance(document, dict):
            continue
        document_id = trim_text(document.get('id') or '', 80)
        preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
        field_suggestions = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []

        for raw_suggestion in field_suggestions:
            if not isinstance(raw_suggestion, dict):
                continue
            field_key = trim_text(raw_suggestion.get('fieldKey') or '', 120)
            tower = trim_text(raw_suggestion.get('tower') or '', 40) or 'Deal Master'
            section = trim_text(raw_suggestion.get('section') or '', 80) or 'Deal Master'
            memory_key = trim_text(f'{tower}::{section}::{field_key}', 240)
            proposed_value = trim_text(raw_suggestion.get('proposedValue') or '', 220)
            if not field_key or not proposed_value:
                continue

            source_file = trim_text(raw_suggestion.get('sourceFile') or document.get('fileName') or '', 180)
            source_location = trim_text(raw_suggestion.get('sourceLocation') or '', 120)
            confidence = trim_text(raw_suggestion.get('confidence') or preview.get('confidenceClass') or '', 24)
            evidence_snippet = trim_text(raw_suggestion.get('evidenceSnippet') or '', 260)
            rationale = trim_text(raw_suggestion.get('rationale') or '', 220)

            entry = entries_by_key.get(memory_key) or {
                'memoryKey': memory_key,
                'tower': tower,
                'section': section,
                'subsection': trim_text(raw_suggestion.get('subsection') or '', 120),
                'fieldKey': field_key,
                'fieldLabel': trim_text(raw_suggestion.get('fieldLabel') or field_key, 140),
                'targetPath': trim_text(raw_suggestion.get('targetPath') or '', 160),
                'controlType': trim_text(raw_suggestion.get('controlType') or 'text', 40),
                'currentValue': '',
                'currentConfidence': '',
                'currentRationale': '',
                'lastSourceFile': '',
                'lastSourceLocation': '',
                'lastEvidenceSnippet': '',
                'lastDocumentId': '',
                'lastRunId': '',
                'lastUpdatedAt': '',
                'status': 'suggested',
                'sourceCount': 0,
                'suggestionCount': 0,
                'sources': [],
            }

            source_record = {
                'documentId': document_id,
                'sourceFile': source_file,
                'sourceLocation': source_location,
                'proposedValue': proposed_value,
                'evidenceSnippet': evidence_snippet,
                'confidence': confidence,
                'rationale': rationale,
                'runId': run_id,
                'updatedAt': updated_at,
            }
            existing_sources = entry.get('sources') if isinstance(entry.get('sources'), list) else []
            dedupe_key = (source_file, source_location, proposed_value)
            existing_keys = {
                (
                    trim_text(item.get('sourceFile') or '', 180),
                    trim_text(item.get('sourceLocation') or '', 120),
                    trim_text(item.get('proposedValue') or '', 220),
                )
                for item in existing_sources
                if isinstance(item, dict)
            }
            if dedupe_key not in existing_keys:
                existing_sources.insert(0, source_record)
            entry['sources'] = existing_sources[:8]
            entry['sourceCount'] = len(entry['sources'])
            entry['suggestionCount'] = int(entry.get('suggestionCount') or 0) + 1

            if str(entry.get('status') or 'suggested') not in {'accepted', 'locked'}:
                current_value = trim_text(entry.get('currentValue') or '', 220)
                current_rank = confidence_rank(entry.get('currentConfidence') or '')
                next_rank = confidence_rank(confidence)
                if (
                    not current_value
                    or next_rank > current_rank
                    or (next_rank == current_rank and proposed_value != current_value)
                ):
                    entry['currentValue'] = proposed_value
                    entry['currentConfidence'] = confidence
                    entry['currentRationale'] = rationale
                    entry['lastSourceFile'] = source_file
                    entry['lastSourceLocation'] = source_location
                    entry['lastEvidenceSnippet'] = evidence_snippet
                    entry['lastDocumentId'] = document_id

            entry['lastRunId'] = run_id
            entry['lastUpdatedAt'] = updated_at
            entries_by_key[memory_key] = entry
            updated_keys.add(memory_key)

    entries = list(entries_by_key.values())
    entries.sort(key=lambda item: (
        str(item.get('tower') or ''),
        str(item.get('section') or ''),
        str(item.get('fieldLabel') or ''),
        str(item.get('memoryKey') or ''),
    ))

    return {
        'version': 'v1',
        'updatedAt': updated_at,
        'lastRunId': run_id,
        'entries': entries,
        'summary': build_field_memory_summary(entries, updated_field_count=len(updated_keys)),
    }


def confidence_label_from_rank(rank: int) -> str:
    return {
        5: 'Very High',
        4: 'High',
        3: 'Medium',
        2: 'Low',
        1: 'Very Low',
    }.get(max(0, int(rank or 0)), 'Medium')


def build_field_memory_prompt(field_memory: dict[str, Any] | None, *, preferred_towers: list[str] | None = None, limit: int = FIELD_MEMORY_PROMPT_LIMIT) -> str:
    normalized = normalize_field_memory(field_memory)
    entries = [item for item in normalized.get('entries', []) if trim_text(item.get('currentValue') or '', 220)]
    if not entries:
        return ''

    preferred = {trim_text(item, 24) for item in (preferred_towers or []) if trim_text(item, 24) and trim_text(item, 24) != 'All'}
    if preferred:
        prioritized = [item for item in entries if str(item.get('tower') or '') in preferred or str(item.get('tower') or '') == 'Deal Master']
        prioritized_keys = {str(item.get('memoryKey') or '') for item in prioritized}
        entries = prioritized + [item for item in entries if str(item.get('memoryKey') or '') not in prioritized_keys]

    entries.sort(key=lambda item: (
        0 if str(item.get('status') or '') in {'accepted', 'locked'} else 1,
        -confidence_rank(item.get('currentConfidence') or ''),
        -int(item.get('suggestionCount') or 0),
        str(item.get('tower') or ''),
        str(item.get('fieldLabel') or ''),
    ))

    lines = [
        'Existing deal extraction memory is below. Use it only as context for conflict checking and duplicate avoidance.',
        'Do not repeat a field with the exact same value unless this file provides a stronger source, a newer override, or materially better evidence.',
        'If the current file contradicts the memory with clearly better evidence, return the field again with the better source and rationale.',
        'Memory snapshot:',
    ]

    for item in entries[:limit]:
        tower = trim_text(item.get('tower') or 'Deal Master', 40)
        section = trim_text(item.get('section') or 'General', 80)
        field_key = trim_text(item.get('fieldKey') or '', 120)
        field_label = trim_text(item.get('fieldLabel') or field_key or 'Field', 140)
        current_value = trim_text(item.get('currentValue') or '', 220)
        confidence = trim_text(item.get('currentConfidence') or '', 24) or 'Review'
        status_value = trim_text(item.get('status') or 'suggested', 24)
        source_file = trim_text(item.get('lastSourceFile') or '', 140)
        source_location = trim_text(item.get('lastSourceLocation') or '', 120)
        source_ref = ' | '.join(part for part in [source_file, source_location] if part)
        source_text = f' | source={source_ref}' if source_ref else ''
        lines.append(
            f'- tower={tower} | section={section} | key={field_key} | label={field_label} | value={current_value} | confidence={confidence} | status={status_value}{source_text}'
        )

    hidden_count = max(0, len(entries) - limit)
    if hidden_count:
        lines.append(f'- {hidden_count} more memorized field(s) are not shown.')
    return '\n'.join(lines)


def merge_extraction_payloads(payloads: list[dict[str, Any]], *, filename: str, mime_type: str, merge_label: str = 'extraction chunk(s)') -> dict[str, Any]:
    valid_payloads = [item for item in payloads if isinstance(item, dict)]
    warnings: list[Any] = []
    tower_hints: list[Any] = []
    suggestions: list[dict[str, Any]] = []
    seen_suggestions: set[tuple[str, str, str, str]] = set()
    summary_candidates: list[str] = []
    document_type = ''
    best_confidence_rank = 0

    for payload in valid_payloads:
        payload_summary = trim_text(payload.get('summary') or '', 320)
        if payload_summary:
            summary_candidates.append(payload_summary)
        if not document_type:
            document_type = trim_text(payload.get('documentType') or '', 40)
        best_confidence_rank = max(best_confidence_rank, confidence_rank(payload.get('confidenceClass') or ''))

        for warning in payload.get('warnings', []):
            warnings.append(warning)
        for tower in payload.get('towerHints', []):
            tower_hints.append(tower)
        for raw_suggestion in payload.get('fieldSuggestions', []):
            if not isinstance(raw_suggestion, dict):
                continue
            field_key = trim_text(raw_suggestion.get('fieldKey') or '', 120)
            proposed_value = trim_text(raw_suggestion.get('proposedValue') or '', 220)
            source_file = trim_text(raw_suggestion.get('sourceFile') or filename, 180)
            source_location = trim_text(raw_suggestion.get('sourceLocation') or '', 120)
            if not field_key or not proposed_value:
                continue
            dedupe_key = (field_key, proposed_value, source_file, source_location)
            if dedupe_key in seen_suggestions:
                continue
            seen_suggestions.add(dedupe_key)
            suggestion = deepcopy(raw_suggestion)
            suggestion['sourceFile'] = source_file
            suggestion['sourceLocation'] = source_location
            suggestions.append(suggestion)

    suggestions.sort(key=lambda item: (
        str(item.get('tower') or ''),
        str(item.get('section') or ''),
        str(item.get('fieldLabel') or item.get('fieldKey') or ''),
        str(item.get('sourceLocation') or ''),
    ))

    if len(valid_payloads) == 1:
        summary = summary_candidates[0] if summary_candidates else f'Uploaded {filename}. Field extraction is ready for review.'
    else:
        summary = f'ChatGPT merged {len(suggestions)} reviewable field suggestion(s) from {len(valid_payloads)} {merge_label} for {filename}.'

    return {
        'documentType': document_type or infer_document_type(filename, mime_type),
        'summary': trim_text(summary, 600),
        'towerHints': merge_unique_strings(tower_hints, item_limit=24, max_items=12),
        'confidenceClass': confidence_label_from_rank(best_confidence_rank),
        'fieldSuggestions': suggestions,
        'warnings': merge_unique_strings(warnings, item_limit=180, max_items=12),
    }


def build_failed_document_record(*, filename: str, mime_type: str, size_bytes: int, error: Exception) -> dict[str, Any]:
    if isinstance(error, HTTPException):
        detail = error.detail
        status_code = int(error.status_code)
    else:
        detail = str(error)
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    reason = trim_text(str(detail or 'Unable to process this document.'), 280) or 'Unable to process this document.'
    if status_code == status.HTTP_502_BAD_GATEWAY:
        failure_type = 'structured_output'
    elif 400 <= status_code < 500:
        failure_type = 'validation'
    else:
        failure_type = 'processing'

    return {
        'fileName': filename,
        'mimeType': mime_type,
        'sizeBytes': size_bytes,
        'status': 'failed',
        'failureType': failure_type,
        'reason': reason,
    }


class DealDocumentIntakeService:
    def __init__(self) -> None:
        self.upload_root = DOCUMENT_UPLOADS_DIR
        self.max_files = DOCUMENT_UPLOAD_MAX_FILES
        self.max_bytes = DOCUMENT_UPLOAD_MAX_BYTES
        self.model = OPENAI_DOCUMENT_MODEL
        self.company_overview_model = OPENAI_COMPANY_OVERVIEW_MODEL or OPENAI_DOCUMENT_MODEL
        self.company_research_model = OPENAI_COMPANY_RESEARCH_MODEL or self.company_overview_model or OPENAI_DOCUMENT_MODEL
        self.max_output_tokens = OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS
        self.openai_sdk_available = BaseOpenAI is not None
        self.client = BaseOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY and self.openai_sdk_available else None

    def _build_openai_content(
        self,
        *,
        filename: str,
        mime_type: str,
        file_bytes: bytes,
        prepared_text: str,
        attach_raw_file: bool,
        field_memory_prompt: str,
        chunk_label: str,
        chunk_index: int,
        chunk_count: int,
        field_catalog: list[dict[str, Any]] | None = None,
        task_brief: str = '',
        catalog_prompt_text: str = '',
    ) -> list[dict[str, Any]]:
        segment_details = ''
        if chunk_count > 1:
            segment_details = (
                f'Prepared text segment: {chunk_index} of {chunk_count}\n'
                f'Segment label: {chunk_label or f"Segment {chunk_index}"}\n'
                'Only use evidence from this segment for any suggestion you return.\n'
            )

        catalog = field_catalog or select_portal_field_catalog(filename=filename, mime_type=mime_type, prepared_text=prepared_text)
        catalog_prompt = catalog_prompt_text or build_portal_catalog_prompt(catalog)
        extraction_brief = task_brief or 'Extract portal-ready field suggestions from this client document for a finance presales portal. Do not return atomic facts, driver candidates, open questions, or local source previews. Return only reviewable field suggestions that the user can validate and then populate into Deal Master or FP&A.'

        content: list[dict[str, Any]] = [
            {
                'type': 'input_text',
                'text': extraction_brief,
            },
            {
                'type': 'input_text',
                'text': (
                    f'Filename: {filename}\n'
                    f'MIME type: {mime_type}\n'
                    + segment_details
                    + 'Use exact portal field labels and keys from the catalog below.\n'
                    'Only include fields that are directly evidenced or very safely derived from explicit client data.\n'
                    'For select fields, use only the allowed values.\n'
                    'For sourceLocation, use formats like page 11, slide 6, sheet Baseline!B12, or section 2.1.\n'
                    'Keep evidenceSnippet short and specific.\n\n'
                    + catalog_prompt
                ),
            },
        ]

        if field_memory_prompt:
            content.append({'type': 'input_text', 'text': field_memory_prompt})

        if prepared_text:
            segment_title = 'Prepared document text for extraction'
            if chunk_count > 1:
                segment_title += f' ({chunk_label or f"segment {chunk_index}"}, {chunk_index}/{chunk_count})'
            content.append({'type': 'input_text', 'text': segment_title + ':\n' + prepared_text})

        if attach_raw_file:
            content.append({'type': 'input_file', 'filename': filename, 'file_data': data_url_for_file(file_bytes, mime_type)})
        return content

    def _request_structured_extraction(
        self,
        *,
        filename: str,
        mime_type: str,
        file_bytes: bytes,
        prepared_text: str,
        parser_meta: dict[str, Any],
        attach_raw_file: bool,
        field_memory_prompt: str,
        chunk_label: str = '',
        chunk_index: int = 1,
        chunk_count: int = 1,
        field_catalog: list[dict[str, Any]] | None = None,
        task_brief: str = '',
        catalog_prompt_text: str = '',
        observation_name: str = 'deal-document-intake.openai-field-extraction',
        schema_name: str = 'deal_document_field_suggestions',
        schema_description: str = 'Portal field suggestions for Deal Master and FP&A document extraction.',
        agent_name: str = GENERAL_EXTRACTION_AGENT_NAME,
        model_name: str = '',
        schema: dict[str, Any] | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any] | None:
        content = self._build_openai_content(
            filename=filename,
            mime_type=mime_type,
            file_bytes=file_bytes,
            prepared_text=prepared_text,
            attach_raw_file=attach_raw_file,
            field_memory_prompt=field_memory_prompt,
            chunk_label=chunk_label,
            chunk_index=chunk_index,
            chunk_count=chunk_count,
            field_catalog=field_catalog,
            task_brief=task_brief,
            catalog_prompt_text=catalog_prompt_text,
        )

        effective_model = trim_text(model_name or self.model, 120) or self.model
        effective_schema = schema or EXTRACTION_SCHEMA

        observation_input = {
            'fileName': filename,
            'mimeType': mime_type,
            'sizeBytes': len(file_bytes),
            'preparedTextChars': len(prepared_text),
            'maxOutputTokens': self.max_output_tokens,
        }
        if chunk_count > 1:
            observation_input.update({
                'chunkIndex': chunk_index,
                'chunkCount': chunk_count,
                'chunkLabel': chunk_label,
            })

        with start_observation(
            name=observation_name,
            as_type='generation',
            model=effective_model,
            input=observation_input,
            metadata={
                'agentName': agent_name,
                'configuredModel': effective_model,
                'attachedRawFile': attach_raw_file,
                'contentPrep': parser_meta.get('contentPrep') or '',
                'chunkStrategy': parser_meta.get('chunkStrategy') or '',
                'fieldMemoryCount': int(parser_meta.get('fieldMemoryCountUsed') or 0),
            },
        ) as generation:
            try:
                response = self.client.responses.create(
                    model=effective_model,
                    input=[{'role': 'user', 'content': content}],
                    max_output_tokens=self.max_output_tokens,
                    tools=tools or [],
                    text={
                        'format': {
                            'type': 'json_schema',
                            'name': schema_name,
                            'description': schema_description,
                            'strict': True,
                            'schema': effective_schema,
                        },
                        'verbosity': 'medium',
                    },
                )
                output_text = extract_output_text(response)
                try:
                    parsed_output = json.loads(output_text) if output_text else None
                except json.JSONDecodeError as error:
                    update_observation(
                        generation,
                        output={
                            'hasStructuredOutput': False,
                            'outputChars': len(output_text or ''),
                            'invalidJsonPreview': trim_text(output_text or '', 600),
                        },
                        level='ERROR',
                        status_message=trim_text(f'Invalid structured JSON: {error}', 280),
                    )
                    chunk_suffix = f' ({chunk_label})' if chunk_label else ''
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=(
                            f'ChatGPT returned incomplete structured JSON for {filename}{chunk_suffix}. '
                            'This file segment is likely too large or too dense for a single extraction pass right now.'
                        ),
                    )
                update_observation(
                    generation,
                    output={
                        'hasStructuredOutput': bool(output_text),
                        'outputChars': len(output_text or ''),
                        **build_langfuse_field_preview(parsed_output, limit=10),
                    },
                )
            except Exception as error:
                update_observation(generation, level='ERROR', status_message=trim_text(str(error), 280))
                raise
        if not output_text:
            return None
        return parsed_output

    def _run_extraction_pass(
        self,
        *,
        filename: str,
        mime_type: str,
        file_bytes: bytes,
        prepared_text: str,
        parser_meta: dict[str, Any],
        field_memory: dict[str, Any] | None = None,
        field_catalog: list[dict[str, Any]] | None = None,
        task_brief: str = '',
        catalog_prompt_text: str = '',
        observation_name: str = 'deal-document-intake.openai-field-extraction',
        schema_name: str = 'deal_document_field_suggestions',
        schema_description: str = 'Portal field suggestions for Deal Master and FP&A document extraction.',
        agent_name: str = GENERAL_EXTRACTION_AGENT_NAME,
        model_name: str = '',
    ) -> dict[str, Any] | None:
        if self.client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail='OPENAI_API_KEY is not configured in backend/.env or the OpenAI SDK is unavailable. Deal document extraction now requires ChatGPT API access.',
            )

        ext = Path(filename or '').suffix.lower()
        attach_raw_file = ext == '.pdf' or 'pdf' in mime_type.lower() or not prepared_text
        normalized_memory = normalize_field_memory(field_memory)
        memory_summary = normalized_memory.get('summary') if isinstance(normalized_memory.get('summary'), dict) else build_field_memory_summary(normalized_memory.get('entries', []))
        preferred_towers = guess_towers(filename, prepared_text)
        request_meta = {
            **parser_meta,
            'fieldMemoryCountUsed': int(parser_meta.get('fieldMemoryCountUsed') or memory_summary.get('fieldCount') or 0),
        }
        field_memory_prompt = build_field_memory_prompt(normalized_memory, preferred_towers=preferred_towers)
        chunks, chunk_meta = build_prepared_text_chunks(prepared_text, request_meta)
        request_meta.update(chunk_meta)

        if not chunks:
            payload = self._request_structured_extraction(
                filename=filename,
                mime_type=mime_type,
                file_bytes=file_bytes,
                prepared_text=prepared_text,
                parser_meta=request_meta,
                attach_raw_file=attach_raw_file,
                field_memory_prompt=field_memory_prompt,
                field_catalog=field_catalog,
                task_brief=task_brief,
                catalog_prompt_text=catalog_prompt_text,
                observation_name=observation_name,
                schema_name=schema_name,
                schema_description=schema_description,
                agent_name=agent_name,
                model_name=model_name,
            )
            if payload and request_meta.get('preparedTextTruncated'):
                payload['warnings'] = merge_unique_strings([
                    *(payload.get('warnings') or []),
                    'Prepared document text was truncated before extraction because the parsed content exceeded the processing limit.',
                ])
            return payload

        if len(chunks) == 1:
            payload = self._request_structured_extraction(
                filename=filename,
                mime_type=mime_type,
                file_bytes=file_bytes,
                prepared_text=chunks[0]['text'],
                parser_meta=request_meta,
                attach_raw_file=attach_raw_file and not prepared_text,
                field_memory_prompt=field_memory_prompt,
                chunk_label=trim_text(chunks[0].get('label') or '', 120),
                chunk_index=1,
                chunk_count=1,
                field_catalog=field_catalog,
                task_brief=task_brief,
                catalog_prompt_text=catalog_prompt_text,
                observation_name=observation_name,
                schema_name=schema_name,
                schema_description=schema_description,
                agent_name=agent_name,
                model_name=model_name,
            )
            if payload:
                warnings = [*(payload.get('warnings') or [])]
                if request_meta.get('preparedTextTruncated'):
                    warnings.append('Prepared document text was truncated before extraction because the parsed content exceeded the processing limit.')
                if request_meta.get('omittedChunkCount'):
                    warnings.append(f'Only the first {request_meta.get("chunkCount") or 1} prepared-text chunk(s) were processed from this file to stay within the extraction limit.')
                payload['warnings'] = merge_unique_strings(warnings)
            return payload

        payloads: list[dict[str, Any]] = []
        chunk_failures: list[dict[str, str]] = []
        chunk_count = len(chunks)
        for index, chunk in enumerate(chunks, start=1):
            chunk_label = trim_text(chunk.get('label') or f'Segment {index}', 120)
            chunk_text = str(chunk.get('text') or '').strip()
            if not chunk_text:
                continue
            try:
                payload = self._request_structured_extraction(
                    filename=filename,
                    mime_type=mime_type,
                    file_bytes=file_bytes,
                    prepared_text=chunk_text,
                    parser_meta=request_meta,
                    attach_raw_file=False,
                    field_memory_prompt=field_memory_prompt,
                    chunk_label=chunk_label,
                    chunk_index=index,
                    chunk_count=chunk_count,
                    field_catalog=field_catalog,
                    task_brief=task_brief,
                    catalog_prompt_text=catalog_prompt_text,
                    observation_name=observation_name,
                    schema_name=schema_name,
                    schema_description=schema_description,
                    agent_name=agent_name,
                    model_name=model_name,
                )
                if payload is not None:
                    payloads.append(payload)
            except Exception as error:
                if isinstance(error, HTTPException):
                    reason = error.detail
                else:
                    reason = str(error)
                chunk_failures.append({
                    'chunkLabel': chunk_label,
                    'reason': trim_text(str(reason or 'Unable to process this segment.'), 180),
                })
                continue

        if not payloads:
            if chunk_failures:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f'ChatGPT could not extract structured fields from {filename}. {chunk_failures[0]["reason"]}',
                )
            return None

        merged_payload = merge_extraction_payloads(payloads, filename=filename, mime_type=mime_type)
        warnings = [*(merged_payload.get('warnings') or []), f'Chunked extraction used {len(payloads)} text segment(s).']
        if chunk_failures:
            skipped_preview = '; '.join(f'{item["chunkLabel"]}: {item["reason"]}' for item in chunk_failures[:2])
            warnings.append(f'{len(chunk_failures)} text segment(s) were skipped during extraction. {skipped_preview}')
        if request_meta.get('preparedTextTruncated'):
            warnings.append('Prepared document text was truncated before extraction because the parsed content exceeded the processing limit.')
        if request_meta.get('omittedChunkCount'):
            warnings.append(f'Only the first {request_meta.get("chunkCount") or chunk_count} prepared-text chunk(s) were processed from this file to stay within the extraction limit.')
        merged_payload['warnings'] = merge_unique_strings(warnings)
        return merged_payload

    def _request_company_research(
        self,
        *,
        company_name: str,
        documents: list[dict[str, Any]],
        field_memory: dict[str, Any] | None = None,
        use_web_search: bool = True,
    ) -> dict[str, Any] | None:
        catalog = load_discovery_overview_field_catalog()
        if not catalog:
            return None

        document_context = build_company_research_context(documents)
        field_memory_prompt = build_field_memory_prompt(field_memory, preferred_towers=['Deal Master', 'FPA'])
        research_prompt = build_company_research_prompt(company_name, catalog)
        content: list[dict[str, Any]] = [
            {'type': 'input_text', 'text': research_prompt},
            {
                'type': 'input_text',
                'text': (
                    f'Client / company name: {trim_text(company_name, 180)}\n'
                    'Prepare a concise company extraction for deal and FP&A discovery purposes.\n'
                    'Return market-facing company facts, recent public financial signals, strategic context, and only the safe Discovery overview fields.\n'
                ),
            },
        ]
        if document_context:
            content.append({'type': 'input_text', 'text': document_context})
        if field_memory_prompt:
            content.append({'type': 'input_text', 'text': field_memory_prompt})

        tools: list[dict[str, Any]] = []
        if use_web_search:
            tools = [
                {
                    'type': 'web_search_preview',
                    'search_context_size': 'medium',
                    'user_location': {
                        'type': 'approximate',
                        'country': 'US',
                    },
                }
            ]

        with start_observation(
            name='deal-document-intake.company-research-agent',
            as_type='generation',
            model=self.company_research_model,
            input={
                'companyName': trim_text(company_name, 180),
                'documentCount': len(documents or []),
                'usedWebSearch': bool(use_web_search),
            },
            metadata={
                'agentName': COMPANY_RESEARCH_AGENT_NAME,
                'configuredModel': self.company_research_model,
                'fieldMemoryCount': int(((field_memory or {}).get('summary') or {}).get('fieldCount') or 0),
            },
        ) as generation:
            try:
                response = self.client.responses.create(
                    model=self.company_research_model,
                    input=[{'role': 'user', 'content': content}],
                    max_output_tokens=self.max_output_tokens,
                    tools=tools,
                    text={
                        'format': {
                            'type': 'json_schema',
                            'name': 'deal_company_research',
                            'description': 'Company research output for finance deal diligence and FP&A discovery support.',
                            'strict': True,
                            'schema': COMPANY_RESEARCH_SCHEMA,
                        },
                        'verbosity': 'medium',
                    },
                )
                output_text = extract_output_text(response)
                payload = json.loads(output_text) if output_text else None
                normalized_payload = normalize_company_research_payload(payload, company_name=company_name, used_web_search=use_web_search)
                update_observation(
                    generation,
                    output={
                        'hasStructuredOutput': isinstance(normalized_payload, dict),
                        'outputChars': len(output_text or ''),
                        **build_langfuse_company_research_preview(normalized_payload, limit=5),
                    },
                )
                return normalized_payload
            except Exception as error:
                update_observation(generation, level='ERROR', status_message=trim_text(str(error), 280))
                raise

    def _run_company_research_agent(
        self,
        *,
        company_name: str,
        documents: list[dict[str, Any]],
        field_memory: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        normalized_name = trim_text(company_name or '', 180)
        if not normalized_name:
            return None

        try:
            return self._request_company_research(
                company_name=normalized_name,
                documents=documents,
                field_memory=field_memory,
                use_web_search=True,
            )
        except Exception as error:
            fallback_payload = self._request_company_research(
                company_name=normalized_name,
                documents=documents,
                field_memory=field_memory,
                use_web_search=False,
            )
            if isinstance(fallback_payload, dict):
                fallback_payload['warnings'] = merge_unique_strings([
                    *(fallback_payload.get('warnings') or []),
                    f'Web search fallback: {trim_text(str(error), 180)}',
                ])
            return fallback_payload

    def _call_openai(self, *, filename: str, mime_type: str, file_bytes: bytes, prepared_text: str, parser_meta: dict[str, Any], field_memory: dict[str, Any] | None = None) -> dict[str, Any] | None:
        primary_payload = self._run_extraction_pass(
            filename=filename,
            mime_type=mime_type,
            file_bytes=file_bytes,
            prepared_text=prepared_text,
            parser_meta=parser_meta,
            field_memory=field_memory,
            observation_name='deal-document-intake.openai-field-extraction',
            schema_name='deal_document_field_suggestions',
            schema_description='Portal field suggestions for Deal Master and FP&A document extraction.',
            agent_name=GENERAL_EXTRACTION_AGENT_NAME,
            model_name=self.model,
        )
        return annotate_agent_payload(primary_payload, agent_name=GENERAL_EXTRACTION_AGENT_NAME)

    def merge_document_intake(self, existing_intake: dict[str, Any] | None, run: dict[str, Any]) -> dict[str, Any]:
        intake = deepcopy(existing_intake) if isinstance(existing_intake, dict) else {}
        existing_documents = intake.get('documents') if isinstance(intake.get('documents'), list) else []
        existing_history = intake.get('history') if isinstance(intake.get('history'), list) else []
        existing_memory = intake.get('fieldMemory') if isinstance(intake.get('fieldMemory'), dict) else {}
        existing_logic_builder = intake.get('logicBuilder') if isinstance(intake.get('logicBuilder'), dict) else {}
        existing_company_overview = intake.get('companyOverview') if isinstance(intake.get('companyOverview'), dict) else {}
        existing_company_research = intake.get('companyResearch') if isinstance(intake.get('companyResearch'), dict) else {}
        successful_documents = run.get('documents') if isinstance(run.get('documents'), list) else []

        if successful_documents:
            field_memory = merge_field_memory(
                existing_memory,
                successful_documents,
                run_id=trim_text(run.get('id') or '', 80),
                updated_at=trim_text(run.get('createdAt') or utc_now_iso(), 40),
            )
        else:
            field_memory = normalize_field_memory(existing_memory)

        memory_summary = field_memory.get('summary') if isinstance(field_memory.get('summary'), dict) else build_field_memory_summary(field_memory.get('entries', []))
        next_documents = successful_documents + existing_documents
        logic_builder = build_logic_builder_snapshot(
            next_documents,
            existing_logic_builder=existing_logic_builder,
            normalized_field_memory=field_memory,
            run_id=trim_text(run.get('id') or '', 80),
            updated_at=trim_text(run.get('createdAt') or utc_now_iso(), 40),
        )
        logic_builder_summary = logic_builder.get('summary') if isinstance(logic_builder.get('summary'), dict) else {}
        run_company_overview = run.get('companyOverview') if isinstance(run.get('companyOverview'), dict) else {}
        run_company_research = run.get('companyResearch') if isinstance(run.get('companyResearch'), dict) else {}
        company_research = deepcopy(run_company_research or existing_company_research)
        company_overview = deepcopy(run_company_overview or existing_company_overview)
        next_run = deepcopy(run)
        next_run['memorySummary'] = memory_summary
        next_run['logicBuilderSummary'] = logic_builder_summary
        if company_overview:
            next_run['companyOverview'] = deepcopy(company_overview)
        if company_research:
            next_run['companyResearch'] = deepcopy(company_research)
        failed_documents = next_run.get('failedDocuments') if isinstance(next_run.get('failedDocuments'), list) else []

        intake.update({
            'documents': next_documents,
            'latestRun': next_run,
            'companyOverview': company_overview,
            'companyResearch': company_research,
            'history': [
                {
                    'id': next_run.get('id'),
                    'createdAt': next_run.get('createdAt'),
                    'documentCount': next_run.get('documentCount'),
                    'failureCount': next_run.get('failureCount'),
                    'status': next_run.get('status'),
                    'usedOpenAi': next_run.get('usedOpenAi'),
                    'model': next_run.get('model'),
                    'fieldSuggestionCount': next_run.get('fieldSuggestionCount'),
                    'sectionCount': next_run.get('sectionCount'),
                    'memoryFieldCount': memory_summary.get('fieldCount') if isinstance(memory_summary, dict) else 0,
                    'reviewFieldCount': logic_builder_summary.get('reviewFieldCount') if isinstance(logic_builder_summary, dict) else 0,
                    'conflictFieldCount': logic_builder_summary.get('conflictFieldCount') if isinstance(logic_builder_summary, dict) else 0,
                },
                *existing_history,
            ][:12],
            'updatedAt': next_run.get('createdAt') or utc_now_iso(),
            'fieldMemory': field_memory,
            'logicBuilder': logic_builder,
            'lastFailedDocuments': failed_documents[:8],
        })
        return intake

    async def process_uploads(
        self,
        deal_id: str,
        current_user: User,
        files: list[UploadFile],
        existing_intake: dict[str, Any] | None = None,
        *,
        run_id: str | None = None,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        uploads = [item for item in files if item and str(item.filename or '').strip()]
        if not uploads:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Select at least one file to extract.')
        if len(uploads) > self.max_files:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Upload up to {self.max_files} files at a time.')

        existing_memory = existing_intake.get('fieldMemory') if isinstance(existing_intake, dict) and isinstance(existing_intake.get('fieldMemory'), dict) else {}
        working_memory = normalize_field_memory(existing_memory)
        starting_memory_summary = working_memory.get('summary') if isinstance(working_memory.get('summary'), dict) else build_field_memory_summary(working_memory.get('entries', []))

        with start_observation(
            name='deal-document-intake.process-uploads',
            as_type='span',
            input={
                'dealId': deal_id,
                'fileCount': len(uploads),
                'userId': current_user.id,
            },
            metadata={
                'userRole': current_user.role,
                'openAiConfigured': bool(OPENAI_API_KEY),
                'openAiSdkAvailable': self.openai_sdk_available,
                'model': self.model if self.client is not None else '',
                'maxFiles': self.max_files,
                'maxBytes': self.max_bytes,
                'startingMemoryFields': starting_memory_summary.get('fieldCount') if isinstance(starting_memory_summary, dict) else 0,
            },
        ) as run_span:
            try:
                ai_enabled = self.client is not None
                if not ai_enabled:
                    reason = 'OpenAI SDK is not installed in the backend environment. Run uv sync inside backend before using ChatGPT extraction.' if not self.openai_sdk_available else 'OPENAI_API_KEY is not configured in backend/.env. Deal document extraction now requires ChatGPT API access.'
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=reason)

                timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
                active_run_id = trim_text(run_id or f'run-{timestamp}', 80)
                run_created_at = utc_now_iso()
                deal_dir = self.upload_root / slugify(deal_id)
                deal_dir.mkdir(parents=True, exist_ok=True)
                documents: list[dict[str, Any]] = []
                failed_documents: list[dict[str, Any]] = []
                total_field_suggestions = 0
                covered_sections: set[str] = set()
                company_overview = deepcopy(existing_intake.get('companyOverview')) if isinstance(existing_intake, dict) and isinstance(existing_intake.get('companyOverview'), dict) else {}
                company_research = deepcopy(existing_intake.get('companyResearch')) if isinstance(existing_intake, dict) and isinstance(existing_intake.get('companyResearch'), dict) else {}

                def emit_progress(*, phase: str, current_file_index: int = 0, current_file_name: str = '', current_chunk_count: int = 0, status_value: str = 'running') -> None:
                    if progress_callback is None:
                        return
                    processed_files = len(documents) + len(failed_documents)
                    progress_callback({
                        'id': active_run_id,
                        'createdAt': run_created_at,
                        'createdByUserId': current_user.id,
                        'createdByName': current_user.name,
                        'status': status_value,
                        'phase': phase,
                        'documentCount': len(documents),
                        'totalFiles': len(uploads),
                        'processedFiles': processed_files,
                        'completedFiles': len(documents),
                        'failureCount': len(failed_documents),
                        'failedDocuments': deepcopy(failed_documents),
                        'usedOpenAi': ai_enabled,
                        'model': self.model if ai_enabled else '',
                        'fieldSuggestionCount': total_field_suggestions,
                        'sectionCount': len(covered_sections),
                        'documents': deepcopy(documents),
                        'companyOverview': deepcopy(company_overview) if company_overview else None,
                        'companyResearch': deepcopy(company_research) if company_research else None,
                        'currentFileIndex': current_file_index,
                        'currentFileName': current_file_name,
                        'currentChunkCount': current_chunk_count,
                    })

                emit_progress(phase='queued', current_file_index=0, current_file_name='', current_chunk_count=0)

                for index, upload in enumerate(uploads, start=1):
                    filename = str(upload.filename or f'document-{index}').strip() or f'document-{index}'
                    file_bytes = await upload.read()
                    mime_type = str(upload.content_type or mimetypes.guess_type(filename)[0] or 'application/octet-stream').strip() or 'application/octet-stream'
                    ext = Path(filename).suffix.lower()

                    with start_observation(
                        name='deal-document-intake.file',
                        as_type='span',
                        input={
                            'index': index,
                            'fileName': filename,
                            'mimeType': mime_type,
                            'sizeBytes': len(file_bytes),
                        },
                        metadata={
                            'dealId': deal_id,
                            'extension': ext or '',
                            'usedOpenAi': ai_enabled,
                        },
                    ) as file_span:
                        try:
                            if not file_bytes:
                                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'{filename} is empty.')
                            if len(file_bytes) > self.max_bytes:
                                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f'{filename} exceeds the {self.max_bytes // (1024 * 1024)} MB limit.')

                            prepared_text, parser_meta = prepare_document_context(file_bytes, filename, mime_type)
                            current_memory_summary = working_memory.get('summary') if isinstance(working_memory.get('summary'), dict) else build_field_memory_summary(working_memory.get('entries', []))
                            document_chunks, chunk_meta = build_prepared_text_chunks(prepared_text, parser_meta)
                            parser_meta = {
                                **parser_meta,
                                'extension': ext or '',
                                'mimeType': mime_type,
                                'sizeBytes': len(file_bytes),
                                'preparedTextChars': len(prepared_text),
                                'usedOpenAi': ai_enabled,
                                'fieldMemoryCountUsed': int(current_memory_summary.get('fieldCount') or 0),
                                **chunk_meta,
                            }

                            emit_progress(
                                phase='extracting',
                                current_file_index=index,
                                current_file_name=filename,
                                current_chunk_count=max(1, len(document_chunks) or int(parser_meta.get('chunkCount') or 0) or 1),
                            )

                            try:
                                ai_payload = self._call_openai(
                                    filename=filename,
                                    mime_type=mime_type,
                                    file_bytes=file_bytes,
                                    prepared_text=prepared_text,
                                    parser_meta=parser_meta,
                                    field_memory=working_memory,
                                )
                            except Exception as error:
                                parser_meta['openAiError'] = trim_text(str(error), 280)
                                raise

                            if ai_payload is None:
                                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f'ChatGPT did not return structured extraction for {filename}.')

                            preview = normalize_extraction(
                                ai_payload,
                                filename=filename,
                                mime_type=mime_type,
                                parser_meta=parser_meta,
                                used_openai=True,
                            )

                            field_suggestions = preview['fieldSuggestions']
                            field_suggestion_count = len(field_suggestions)
                            section_count = len({f"{item['tower']}::{item['section']}" for item in field_suggestions})
                            total_field_suggestions += field_suggestion_count
                            covered_sections.update(f"{item['tower']}::{item['section']}" for item in field_suggestions)

                            document_id = f'doc-{timestamp}-{index:02d}'
                            stored_name = f'{timestamp}-{index:02d}-{slugify(filename)}'
                            relative_path = Path('data') / 'uploads' / slugify(deal_id) / stored_name
                            absolute_path = deal_dir / stored_name
                            absolute_path.write_bytes(file_bytes)

                            source_tier, source_tier_rank = infer_source_tier(filename, preview['documentType'])
                            reliability, reliability_rank = infer_document_reliability(preview['documentType'], filename)
                            chunk_rows = [
                                {
                                    'id': f'{document_id}::chunk::{chunk_index:02d}',
                                    'label': trim_text(chunk.get('label') or f'Chunk {chunk_index}', 120),
                                    'index': chunk_index,
                                    'count': len(document_chunks),
                                    'charCount': len(str(chunk.get('text') or '')),
                                    'preview': trim_text(normalize_space(chunk.get('text') or ''), 240),
                                    'strategy': trim_text(parser_meta.get('chunkStrategy') or '', 40),
                                }
                                for chunk_index, chunk in enumerate(document_chunks, start=1)
                            ]

                            document_record = {
                                'id': document_id,
                                'fileName': filename,
                                'storedFileName': stored_name,
                                'mimeType': mime_type,
                                'extension': ext,
                                'sizeBytes': len(file_bytes),
                                'uploadedAt': utc_now_iso(),
                                'uploadedByUserId': current_user.id,
                                'uploadedByName': current_user.name,
                                'relativePath': str(relative_path).replace('\\', '/'),
                                'status': preview['status'],
                                'documentType': preview['documentType'],
                                'summary': preview['summary'],
                                'towerHints': preview['towerHints'],
                                'sourceTier': source_tier,
                                'sourceTierRank': source_tier_rank,
                                'reliability': reliability,
                                'reliabilityRank': reliability_rank,
                                'fieldSuggestionCount': field_suggestion_count,
                                'sectionCount': section_count,
                                'parserMeta': parser_meta,
                                'chunks': chunk_rows,
                                'preview': preview,
                            }
                            # Archive parser evidence separately from field suggestions.
                            # PDF evidence from the legacy parser may require a standalone JSON import.
                            from .document_knowledge import knowledge
                            evidence_blocks = [{'text': chunk['text'], 'location': {'section': chunk.get('label', 'Document')}} for chunk in document_chunks]
                            if evidence_blocks:
                                extraction_artifact = {'schema_version': '1.0', 'file_name': filename,
                                    'status': 'partial', 'blocks': evidence_blocks, 'metadata': parser_meta,
                                    'warnings': ['Portal parser coverage may be limited; inspect parser metadata and original file.']}
                                _, artifact_path, _ = knowledge.save_artifact(deal_id, document_id, extraction_artifact)
                                document_record['knowledgeArtifact'] = artifact_path
                            documents.append(document_record)
                            working_memory = merge_field_memory(
                                working_memory,
                                [document_record],
                                run_id=active_run_id,
                                updated_at=run_created_at,
                            )

                            company_overview = build_company_overview_snapshot(documents, updated_at=utc_now_iso()) or company_overview

                            if company_overview:
                                emit_progress(
                                    phase='company-overview',
                                    current_file_index=index,
                                    current_file_name=filename,
                                    current_chunk_count=len(document_chunks),
                                )

                            emit_progress(
                                phase='review-prep',
                                current_file_index=index,
                                current_file_name=filename,
                                current_chunk_count=len(document_chunks),
                            )

                            update_observation(
                                file_span,
                                output={
                                    'documentId': document_id,
                                    'status': preview['status'],
                                    'fieldSuggestionCount': field_suggestion_count,
                                    'sectionCount': section_count,
                                    **build_langfuse_field_preview(preview, limit=10),
                                },
                                metadata={
                                    'documentType': preview['documentType'],
                                    'towerHints': preview['towerHints'],
                                },
                            )
                        except Exception as error:
                            failure = build_failed_document_record(
                                filename=filename,
                                mime_type=mime_type,
                                size_bytes=len(file_bytes),
                                error=error,
                            )
                            failed_documents.append(failure)
                            emit_progress(
                                phase='review-prep',
                                current_file_index=index,
                                current_file_name=filename,
                                current_chunk_count=0,
                            )
                            update_observation(
                                file_span,
                                output=failure,
                                level='ERROR',
                                status_message=trim_text(failure['reason'], 280),
                            )
                            continue

                detected_company_name = extract_company_name_from_documents(
                    documents,
                    fallback_name=trim_text((company_overview or {}).get('companyName') or '', 180),
                )
                if detected_company_name and documents:
                    emit_progress(
                        phase='company-overview',
                        current_file_index=len(documents),
                        current_file_name=detected_company_name,
                        current_chunk_count=0,
                    )
                    try:
                        company_research = self._run_company_research_agent(
                            company_name=detected_company_name,
                            documents=documents,
                            field_memory=working_memory,
                        ) or company_research
                    except Exception as error:
                        if isinstance(company_overview, dict) and company_overview:
                            company_overview['warnings'] = merge_unique_strings([
                                *((company_overview or {}).get('warnings') or []),
                                f'{COMPANY_RESEARCH_AGENT_NAME} skipped: {trim_text(str(error), 180)}',
                            ])
                    company_overview = build_company_overview_snapshot(
                        documents,
                        company_research=company_research,
                        updated_at=utc_now_iso(),
                    ) or company_overview

                if failed_documents and documents:
                    run_status = 'partial'
                elif failed_documents:
                    run_status = 'failed'
                else:
                    run_status = 'completed'

                result = {
                    'id': active_run_id,
                    'createdAt': run_created_at,
                    'createdByUserId': current_user.id,
                    'createdByName': current_user.name,
                    'status': run_status,
                    'phase': 'completed',
                    'totalFiles': len(uploads),
                    'processedFiles': len(uploads),
                    'completedFiles': len(documents),
                    'currentFileIndex': len(uploads),
                    'currentFileName': '',
                    'currentChunkCount': 0,
                    'documentCount': len(documents),
                    'failureCount': len(failed_documents),
                    'failedDocuments': failed_documents,
                    'usedOpenAi': ai_enabled,
                    'model': self.model if ai_enabled else '',
                    'fieldSuggestionCount': total_field_suggestions,
                    'sectionCount': len(covered_sections),
                    'documents': documents,
                    'companyOverview': company_overview,
                    'companyResearch': company_research,
                }
                emit_progress(phase='completed', current_file_index=len(uploads), current_file_name='', current_chunk_count=0, status_value=run_status)
                update_observation(
                    run_span,
                    output={
                        'runId': result['id'],
                        'status': result['status'],
                        'documentCount': result['documentCount'],
                        'failureCount': result['failureCount'],
                        'usedOpenAi': result['usedOpenAi'],
                        'model': result['model'],
                        'fieldSuggestionCount': result['fieldSuggestionCount'],
                        'sectionCount': result['sectionCount'],
                        'companyOverviewFieldCount': int((company_overview or {}).get('fieldCount') or 0),
                        'companyResearchSourceCount': int((company_research or {}).get('sourceCount') or 0),
                        'startingMemoryFields': starting_memory_summary.get('fieldCount') if isinstance(starting_memory_summary, dict) else 0,
                        'endingMemoryFields': (working_memory.get('summary') or {}).get('fieldCount') if isinstance(working_memory, dict) else 0,
                    },
                    metadata={
                        'fileNames': [document['fileName'] for document in documents],
                        'failedFileNames': [item['fileName'] for item in failed_documents],
                    },
                )
                return result
            except Exception as error:
                if progress_callback is not None:
                    progress_callback({
                        'id': trim_text(run_id or '', 80),
                        'status': 'failed',
                        'phase': 'failed',
                        'failureCount': 1,
                        'errorMessage': trim_text(str(error), 280),
                    })
                update_observation(run_span, level='ERROR', status_message=trim_text(str(error), 280))
                raise

