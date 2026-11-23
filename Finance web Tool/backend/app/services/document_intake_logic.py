from __future__ import annotations

import re
from pathlib import Path
from typing import Any

DEAL_MASTER_TOWER_FIELD_CATALOG: list[dict[str, Any]] = [
    {'tower': 'Deal Master', 'section': 'Towers & Ownership', 'subsection': 'FP&A', 'fieldKey': 'towerScope_FPA', 'fieldLabel': 'FP&A In Scope', 'targetPath': 'towerScope_FPA', 'controlType': 'boolean_select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'Deal Master', 'section': 'Towers & Ownership', 'subsection': 'FP&A', 'fieldKey': 'towerLead_FPA', 'fieldLabel': 'FP&A Workspace Owner', 'targetPath': 'towerLead_FPA', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Towers & Ownership', 'subsection': 'RTR', 'fieldKey': 'towerScope_RTR', 'fieldLabel': 'RTR In Scope', 'targetPath': 'towerScope_RTR', 'controlType': 'boolean_select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'Deal Master', 'section': 'Towers & Ownership', 'subsection': 'RTR', 'fieldKey': 'towerLead_RTR', 'fieldLabel': 'RTR Workspace Owner', 'targetPath': 'towerLead_RTR', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Towers & Ownership', 'subsection': 'O2C', 'fieldKey': 'towerScope_O2C', 'fieldLabel': 'O2C In Scope', 'targetPath': 'towerScope_O2C', 'controlType': 'boolean_select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'Deal Master', 'section': 'Towers & Ownership', 'subsection': 'O2C', 'fieldKey': 'towerLead_O2C', 'fieldLabel': 'O2C Workspace Owner', 'targetPath': 'towerLead_O2C', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'Deal Master', 'section': 'Towers & Ownership', 'subsection': 'P2P', 'fieldKey': 'towerScope_P2P', 'fieldLabel': 'P2P In Scope', 'targetPath': 'towerScope_P2P', 'controlType': 'boolean_select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'Deal Master', 'section': 'Towers & Ownership', 'subsection': 'P2P', 'fieldKey': 'towerLead_P2P', 'fieldLabel': 'P2P Workspace Owner', 'targetPath': 'towerLead_P2P', 'controlType': 'text', 'allowedValues': []},
]

FPA_GOVERNANCE_FIELD_CATALOG: list[dict[str, Any]] = [
    {'tower': 'FP&A', 'section': '24 Governance', 'subsection': 'Governance inputs', 'fieldKey': 'approvalStage', 'fieldLabel': 'Approval Stage', 'targetPath': 'fpaWorkspace.governance.approvalStage', 'controlType': 'select', 'allowedValues': ['Working', 'Tower Lead Review', 'Finance Review', 'Solution Review', 'Submission Ready']},
    {'tower': 'FP&A', 'section': '24 Governance', 'subsection': 'Governance inputs', 'fieldKey': 'evidenceCoveragePct', 'fieldLabel': 'Evidence Coverage %', 'targetPath': 'fpaWorkspace.governance.evidenceCoveragePct', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '24 Governance', 'subsection': 'Governance inputs', 'fieldKey': 'benchmarkCorroborationPct', 'fieldLabel': 'Benchmark Corroboration %', 'targetPath': 'fpaWorkspace.governance.benchmarkCorroborationPct', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '24 Governance', 'subsection': 'Governance inputs', 'fieldKey': 'changeNote', 'fieldLabel': 'Governance Notes', 'targetPath': 'fpaWorkspace.governance.changeNote', 'controlType': 'textarea', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '24 Governance', 'subsection': 'Governance checks', 'fieldKey': 'qaReviewComplete', 'fieldLabel': 'QA review complete', 'targetPath': 'fpaWorkspace.governance.qaReviewComplete', 'controlType': 'boolean_select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'FP&A', 'section': '24 Governance', 'subsection': 'Governance checks', 'fieldKey': 'financeLeadershipReview', 'fieldLabel': 'Finance leadership review', 'targetPath': 'fpaWorkspace.governance.financeLeadershipReview', 'controlType': 'boolean_select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'FP&A', 'section': '24 Governance', 'subsection': 'Governance checks', 'fieldKey': 'clientEvidenceValidated', 'fieldLabel': 'Client evidence validated', 'targetPath': 'fpaWorkspace.governance.clientEvidenceValidated', 'controlType': 'boolean_select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'FP&A', 'section': '24 Governance', 'subsection': 'Governance checks', 'fieldKey': 'benchmarkPackReady', 'fieldLabel': 'Benchmark pack ready', 'targetPath': 'fpaWorkspace.governance.benchmarkPackReady', 'controlType': 'boolean_select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'FP&A', 'section': '24 Governance', 'subsection': 'Governance checks', 'fieldKey': 'calibrationComplete', 'fieldLabel': 'Calibration complete', 'targetPath': 'fpaWorkspace.governance.calibrationComplete', 'controlType': 'boolean_select', 'allowedValues': ['Yes', 'No']},
]

FPA_CHANGE_LOG_FIELD_CATALOG: list[dict[str, Any]] = [
    {'tower': 'FP&A', 'section': '28 Change Log', 'subsection': 'Version control', 'fieldKey': 'lastReviewer', 'fieldLabel': 'Last Reviewer', 'targetPath': 'fpaWorkspace.changeLog.lastReviewer', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '28 Change Log', 'subsection': 'Version control', 'fieldKey': 'lastDecision', 'fieldLabel': 'Last Decision', 'targetPath': 'fpaWorkspace.changeLog.lastDecision', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '28 Change Log', 'subsection': 'Version control', 'fieldKey': 'latestChangeSummary', 'fieldLabel': 'Latest Change Summary', 'targetPath': 'fpaWorkspace.changeLog.latestChangeSummary', 'controlType': 'textarea', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '28 Change Log', 'subsection': 'Version control', 'fieldKey': 'versionNote', 'fieldLabel': 'Version Note', 'targetPath': 'fpaWorkspace.changeLog.versionNote', 'controlType': 'textarea', 'allowedValues': []},
]

FPA_COMPLEXITY_FIELD_CATALOG: list[dict[str, Any]] = [
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityProcessOverride', 'fieldLabel': 'Process complexity - Override score', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.E6', 'controlType': 'select', 'allowedValues': ['1', '2', '3', '4', '5']},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityProcessRationale', 'fieldLabel': 'Process complexity - Override rationale', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.F6', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityOrganisationOverride', 'fieldLabel': 'Organisational complexity - Override score', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.E7', 'controlType': 'select', 'allowedValues': ['1', '2', '3', '4', '5']},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityOrganisationRationale', 'fieldLabel': 'Organisational complexity - Override rationale', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.F7', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityDataSystemsOverride', 'fieldLabel': 'Data & systems complexity - Override score', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.E8', 'controlType': 'select', 'allowedValues': ['1', '2', '3', '4', '5']},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityDataSystemsRationale', 'fieldLabel': 'Data & systems complexity - Override rationale', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.F8', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityTechAiOverride', 'fieldLabel': 'Technology & AI readiness (inv.) - Override score', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.E9', 'controlType': 'select', 'allowedValues': ['1', '2', '3', '4', '5']},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityTechAiRationale', 'fieldLabel': 'Technology & AI readiness (inv.) - Override rationale', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.F9', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityGovernanceOverride', 'fieldLabel': 'Governance & planning maturity (inv.) - Override score', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.E10', 'controlType': 'select', 'allowedValues': ['1', '2', '3', '4', '5']},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityGovernanceRationale', 'fieldLabel': 'Governance & planning maturity (inv.) - Override rationale', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.F10', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityAutomationOverride', 'fieldLabel': 'Automation maturity (inv.) - Override score', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.E11', 'controlType': 'select', 'allowedValues': ['1', '2', '3', '4', '5']},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityAutomationRationale', 'fieldLabel': 'Automation maturity (inv.) - Override rationale', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.F11', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityGeoLanguageOverride', 'fieldLabel': 'Geographic & language - Override score', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.E12', 'controlType': 'select', 'allowedValues': ['1', '2', '3', '4', '5']},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityGeoLanguageRationale', 'fieldLabel': 'Geographic & language - Override rationale', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.F12', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityRegulatoryOverride', 'fieldLabel': 'Regulatory intensity - Override score', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.E13', 'controlType': 'select', 'allowedValues': ['1', '2', '3', '4', '5']},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityRegulatoryRationale', 'fieldLabel': 'Regulatory intensity - Override rationale', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.F13', 'controlType': 'text', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityStakeholderOverride', 'fieldLabel': 'Stakeholder & service delivery - Override score', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.E14', 'controlType': 'select', 'allowedValues': ['1', '2', '3', '4', '5']},
    {'tower': 'FP&A', 'section': '06 Complexity', 'subsection': 'Manual override', 'fieldKey': 'complexityStakeholderRationale', 'fieldLabel': 'Stakeholder & service delivery - Override rationale', 'targetPath': 'fpaWorkbookInputs.FPA_06 Complexity.F14', 'controlType': 'text', 'allowedValues': []},
]

FPA_SCPL_FIELD_CATALOG: list[dict[str, Any]] = [
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Core controls', 'fieldKey': 'scplPersonaOverride', 'fieldLabel': 'SCPL Persona Override', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.C6', 'controlType': 'select', 'allowedValues': ['Conservative', 'Standard', 'Lean', 'Aggressive AI-First', 'Autonomous Finance']},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Core controls', 'fieldKey': 'scplOffshoreShare', 'fieldLabel': 'India Offshore Share of Tower FTE', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.C9', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Band mix', 'fieldKey': 'scplBandMixAssociate', 'fieldLabel': 'Band Mix - Associate (E0.1)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D21', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Band mix', 'fieldKey': 'scplBandMixSrAssociate', 'fieldLabel': 'Band Mix - Sr Associate (E0.2)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D22', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Band mix', 'fieldKey': 'scplBandMixAnalyst', 'fieldLabel': 'Band Mix - Analyst (E0.3)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D23', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Band mix', 'fieldKey': 'scplBandMixLeadAnalyst', 'fieldLabel': 'Band Mix - Lead Analyst (E1)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D24', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Band mix', 'fieldKey': 'scplBandMixAssistantManager', 'fieldLabel': 'Band Mix - Assistant Manager/Deputy Manager (E2)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D25', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Band mix', 'fieldKey': 'scplBandMixManager', 'fieldLabel': 'Band Mix - Manager/Senior Manager (E3)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D26', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Band mix', 'fieldKey': 'scplBandMixGroupManager', 'fieldLabel': 'Band Mix - Group Manager/ Assistant Manager (E4)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D27', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Band mix', 'fieldKey': 'scplBandMixDeputyGeneralManager', 'fieldLabel': 'Band Mix - Deputy General Manager/ General Manager (E5)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D28', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Commercial controls', 'fieldKey': 'scplArcLoadingPct', 'fieldLabel': 'ARC Loading %', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.C36', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Commercial controls', 'fieldKey': 'scplFxReference', 'fieldLabel': 'FX Reference (INR per USD)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.C37', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Commercial controls', 'fieldKey': 'scplPricingGrossMarginPct', 'fieldLabel': 'Pricing GM %', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.C38', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Commercial controls', 'fieldKey': 'scplRateCardConfirmed', 'fieldLabel': 'Rate Card Confirmed by Deal Desk?', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.C39', 'controlType': 'select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Delivery centers', 'fieldKey': 'scplAllocationNoida', 'fieldLabel': 'Noida Allocation %', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D56', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Delivery centers', 'fieldKey': 'scplFactorNoida', 'fieldLabel': 'Noida Location Factor', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.E56', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Delivery centers', 'fieldKey': 'scplAllocationChennai', 'fieldLabel': 'Chennai Allocation %', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D57', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Delivery centers', 'fieldKey': 'scplFactorChennai', 'fieldLabel': 'Chennai Location Factor', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.E57', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Delivery centers', 'fieldKey': 'scplAllocationHyderabad', 'fieldLabel': 'Hyderabad Allocation %', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.D58', 'controlType': 'percent', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Delivery centers', 'fieldKey': 'scplFactorHyderabad', 'fieldLabel': 'Hyderabad Location Factor', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.E58', 'controlType': 'number', 'allowedValues': []},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Delivery centers', 'fieldKey': 'scplLocationFactorsConfirmed', 'fieldLabel': 'Location Factors Confirmed by Deal Desk?', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.C62', 'controlType': 'select', 'allowedValues': ['Yes', 'No']},
    {'tower': 'FP&A', 'section': '30 SCPL', 'subsection': 'Delivery centers', 'fieldKey': 'scplMinSecondaryCenterFte', 'fieldLabel': 'Minimum Viable Secondary-Center Size (FTE)', 'targetPath': 'fpaWorkbookInputs.FPA_30 SCPL.C63', 'controlType': 'number', 'allowedValues': []},
]


def trim_text(value: Any, limit: int) -> str:
    text = str(value or '').strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + '...'


def normalize_space(value: Any) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def merge_unique_strings(values: list[Any], *, item_limit: int = 180, max_items: int = 12) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in values:
        text = trim_text(item, item_limit)
        if not text or text in seen:
            continue
        result.append(text)
        seen.add(text)
        if len(result) >= max_items:
            break
    return result


def confidence_rank(value: str | None) -> int:
    normalized = str(value or '').strip().lower()
    return {
        'very high': 5,
        'high': 4,
        'medium': 3,
        'low': 2,
        'very low': 1,
    }.get(normalized, 0)


def slugify(value: Any) -> str:
    text = re.sub(r'[^a-zA-Z0-9._-]+', '-', str(value or '').strip())
    text = re.sub(r'-{2,}', '-', text).strip('-._')
    return text or 'document'


def infer_document_type(filename: str, mime_type: str) -> str:
    ext = Path(filename or '').suffix.lower()
    if ext in {'.xlsx', '.xlsm', '.xls', '.csv'}:
        return 'Spreadsheet'
    if ext in {'.ppt', '.pptx'}:
        return 'Presentation'
    if ext in {'.doc', '.docx'}:
        return 'Document'
    if ext == '.pdf' or 'pdf' in str(mime_type or '').lower():
        return 'PDF'
    if ext in {'.csv', '.txt', '.md', '.json', '.log'}:
        return 'Text'
    return 'File'


def document_type_rank(document_type: str | None) -> int:
    normalized = trim_text(document_type or '', 40)
    return {
        'Spreadsheet': 5,
        'PDF': 4,
        'Document': 4,
        'Presentation': 3,
        'Text': 2,
        'File': 1,
    }.get(normalized, 1)


def infer_source_tier(filename: str, document_type: str | None = None) -> tuple[str, int]:
    token = str(filename or '').strip().lower()
    doc_type = trim_text(document_type or '', 40)
    if any(marker in token for marker in ('q&a', 'addendum', 'clarification', 'clarified', 'latest', 'final', 'revised')):
        return 'Client clarification', 6
    if doc_type == 'Spreadsheet' or any(marker in token for marker in ('volumetric', 'volumetrics', 'baseline', 'tracker', 'workbook', 'data', '.csv')):
        return 'Client data file', 5
    if any(marker in token for marker in ('rfp', 'brief', 'proposal', 'requirements', 'requirement', 'narrative', 'sow')) or doc_type in {'PDF', 'Document'}:
        return 'Client narrative', 4
    if doc_type == 'Presentation' or any(marker in token for marker in ('deck', 'presentation', 'steerco')):
        return 'Client presentation', 3
    if any(marker in token for marker in ('benchmark', 'peer', 'market', 'comparable')):
        return 'Benchmark / peer proxy', 2
    if any(marker in token for marker in ('template', 'sample', 'example', 'default')):
        return 'Template / default', 1
    return 'Client source', 3


def infer_document_reliability(document_type: str | None, filename: str = '') -> tuple[str, int]:
    rank = document_type_rank(document_type)
    token = str(filename or '').strip().lower()
    if any(marker in token for marker in ('latest', 'final', 'approved', 'signed')):
        rank = min(5, rank + 1)
    label = {5: 'Very High', 4: 'High', 3: 'Medium', 2: 'Low', 1: 'Low'}.get(rank, 'Medium')
    return label, rank


def source_precedence_policy_text() -> str:
    return 'Client clarification > client data file > client narrative/presentation > benchmark/template'


def normalize_logic_builder_value(value: Any) -> str:
    return trim_text(value, 220)


def review_source_sort_key(item: dict[str, Any]) -> tuple[int, int, int, str, int]:
    return (
        int(item.get('sourceTierRank') or 0),
        int(item.get('reliabilityRank') or 0),
        confidence_rank(item.get('confidence') or ''),
        trim_text(item.get('uploadedAt') or '', 40),
        1 if trim_text(item.get('sourceLocation') or '', 120) else 0,
    )


def build_logic_builder_document_register(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    register: list[dict[str, Any]] = []
    for document in documents:
        if not isinstance(document, dict):
            continue
        preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
        parser_meta = document.get('parserMeta') if isinstance(document.get('parserMeta'), dict) else preview.get('parserMeta') if isinstance(preview.get('parserMeta'), dict) else {}
        document_type = trim_text(document.get('documentType') or infer_document_type(document.get('fileName') or '', document.get('mimeType') or ''), 40)
        source_tier, source_tier_rank = infer_source_tier(document.get('fileName') or '', document_type)
        reliability, reliability_rank = infer_document_reliability(document_type, document.get('fileName') or '')
        register.append({
            'documentId': trim_text(document.get('id') or '', 80),
            'fileName': trim_text(document.get('fileName') or '', 180),
            'documentType': document_type,
            'mimeType': trim_text(document.get('mimeType') or '', 120),
            'sizeBytes': int(document.get('sizeBytes') or 0),
            'uploadedAt': trim_text(document.get('uploadedAt') or '', 40),
            'uploadedByName': trim_text(document.get('uploadedByName') or '', 120),
            'towerHints': merge_unique_strings(document.get('towerHints') or [], item_limit=24, max_items=8),
            'sourceTier': trim_text(document.get('sourceTier') or source_tier, 60),
            'sourceTierRank': int(document.get('sourceTierRank') or source_tier_rank),
            'reliability': trim_text(document.get('reliability') or reliability, 24),
            'reliabilityRank': int(document.get('reliabilityRank') or reliability_rank),
            'fieldSuggestionCount': int(document.get('fieldSuggestionCount') or 0),
            'sectionCount': int(document.get('sectionCount') or 0),
            'status': trim_text(document.get('status') or preview.get('status') or 'ready', 40),
            'summary': trim_text(document.get('summary') or preview.get('summary') or '', 280),
            'contentPrep': trim_text(parser_meta.get('contentPrep') or '', 40),
            'preparedTextChars': int(parser_meta.get('preparedTextChars') or 0),
            'chunkCount': int(parser_meta.get('chunkCount') or 0),
            'chunkStrategy': trim_text(parser_meta.get('chunkStrategy') or '', 40),
            'segmentCount': int(parser_meta.get('segmentCount') or 0),
        })
    register.sort(key=lambda item: (trim_text(item.get('uploadedAt') or '', 40), trim_text(item.get('fileName') or '', 180)), reverse=True)
    return register


def build_logic_builder_chunk_store(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    chunk_rows: list[dict[str, Any]] = []
    for document in documents:
        if not isinstance(document, dict):
            continue
        raw_chunks = document.get('chunks') if isinstance(document.get('chunks'), list) else []
        for index, raw_chunk in enumerate(raw_chunks, start=1):
            if not isinstance(raw_chunk, dict):
                continue
            chunk_rows.append({
                'chunkId': trim_text(raw_chunk.get('id') or f"{document.get('id') or 'document'}::chunk::{index:02d}", 120),
                'documentId': trim_text(document.get('id') or '', 80),
                'fileName': trim_text(document.get('fileName') or '', 180),
                'label': trim_text(raw_chunk.get('label') or f'Chunk {index}', 120),
                'index': int(raw_chunk.get('index') or index),
                'count': int(raw_chunk.get('count') or len(raw_chunks) or 0),
                'charCount': int(raw_chunk.get('charCount') or 0),
                'preview': trim_text(raw_chunk.get('preview') or '', 240),
                'strategy': trim_text(raw_chunk.get('strategy') or '', 40),
            })
    chunk_rows.sort(key=lambda item: (trim_text(item.get('fileName') or '', 180), int(item.get('index') or 0)))
    return chunk_rows


def build_logic_builder_fact_ledger(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    for document in documents:
        if not isinstance(document, dict):
            continue
        preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
        suggestions = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []
        document_type = trim_text(document.get('documentType') or infer_document_type(document.get('fileName') or '', document.get('mimeType') or ''), 40)
        source_tier, _ = infer_source_tier(document.get('fileName') or '', document_type)
        reliability, _ = infer_document_reliability(document_type, document.get('fileName') or '')
        for index, suggestion in enumerate(suggestions, start=1):
            if not isinstance(suggestion, dict):
                continue
            proposed_value = normalize_logic_builder_value(suggestion.get('proposedValue') or '')
            target_path = trim_text(suggestion.get('targetPath') or '', 160)
            if not proposed_value or not target_path:
                continue
            facts.append({
                'factId': trim_text(f"{document.get('id') or 'document'}::fact::{index:03d}", 120),
                'documentId': trim_text(document.get('id') or '', 80),
                'fileName': trim_text(document.get('fileName') or '', 180),
                'documentType': document_type,
                'sourceTier': trim_text(document.get('sourceTier') or source_tier, 60),
                'reliability': trim_text(document.get('reliability') or reliability, 24),
                'tower': trim_text(suggestion.get('tower') or 'Deal Master', 40),
                'section': trim_text(suggestion.get('section') or 'General', 80),
                'subsection': trim_text(suggestion.get('subsection') or '', 120),
                'fieldKey': trim_text(suggestion.get('fieldKey') or '', 120),
                'fieldLabel': trim_text(suggestion.get('fieldLabel') or suggestion.get('fieldKey') or 'Field', 140),
                'targetPath': target_path,
                'value': proposed_value,
                'sourceLocation': trim_text(suggestion.get('sourceLocation') or '', 120),
                'evidenceSnippet': trim_text(suggestion.get('evidenceSnippet') or '', 260),
                'confidence': trim_text(suggestion.get('confidence') or preview.get('confidenceClass') or '', 24),
                'rationale': trim_text(suggestion.get('rationale') or '', 220),
                'status': 'extracted',
            })
    facts.sort(key=lambda item: (trim_text(item.get('tower') or '', 40), trim_text(item.get('section') or '', 80), trim_text(item.get('fieldLabel') or '', 140), trim_text(item.get('fileName') or '', 180)))
    return facts


def build_review_queue_preserved_lookup(existing_logic_builder: dict[str, Any] | None, normalized_field_memory: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    if isinstance(existing_logic_builder, dict):
        review_queue = existing_logic_builder.get('reviewQueue') if isinstance(existing_logic_builder.get('reviewQueue'), dict) else {}
        for raw_entry in review_queue.get('fields', []):
            if not isinstance(raw_entry, dict):
                continue
            target_path = trim_text(raw_entry.get('targetPath') or '', 160)
            if target_path and target_path not in lookup:
                lookup[target_path] = raw_entry
    if isinstance(normalized_field_memory, dict):
        for raw_entry in normalized_field_memory.get('entries', []):
            if not isinstance(raw_entry, dict):
                continue
            target_path = trim_text(raw_entry.get('targetPath') or '', 160)
            current_value = trim_text(raw_entry.get('currentValue') or '', 220)
            if not target_path or not current_value or target_path in lookup:
                continue
            lookup[target_path] = raw_entry
    return lookup


def build_logic_builder_review_queue(
    documents: list[dict[str, Any]],
    *,
    existing_logic_builder: dict[str, Any] | None = None,
    normalized_field_memory: dict[str, Any] | None = None,
    run_id: str = '',
    updated_at: str = '',
) -> dict[str, Any]:
    preserved_lookup = build_review_queue_preserved_lookup(existing_logic_builder, normalized_field_memory)
    grouped: dict[str, dict[str, Any]] = {}
    for document in documents:
        if not isinstance(document, dict):
            continue
        preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
        suggestions = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []
        document_type = trim_text(document.get('documentType') or infer_document_type(document.get('fileName') or '', document.get('mimeType') or ''), 40)
        source_tier, source_tier_rank = infer_source_tier(document.get('fileName') or '', document_type)
        reliability, reliability_rank = infer_document_reliability(document_type, document.get('fileName') or '')
        for suggestion in suggestions:
            if not isinstance(suggestion, dict):
                continue
            target_path = trim_text(suggestion.get('targetPath') or '', 160)
            proposed_value = normalize_logic_builder_value(suggestion.get('proposedValue') or '')
            if not target_path or not proposed_value:
                continue
            entry = grouped.setdefault(target_path, {
                'id': trim_text(f"field::{slugify(target_path)}", 160),
                'targetPath': target_path,
                'tower': trim_text(suggestion.get('tower') or 'Deal Master', 40),
                'section': trim_text(suggestion.get('section') or 'General', 80),
                'subsection': trim_text(suggestion.get('subsection') or '', 120),
                'fieldKey': trim_text(suggestion.get('fieldKey') or target_path, 120),
                'fieldLabel': trim_text(suggestion.get('fieldLabel') or suggestion.get('fieldKey') or target_path, 140),
                'controlType': trim_text(suggestion.get('controlType') or 'text', 40),
                'allowedValues': [trim_text(value, 120) for value in (suggestion.get('allowedValues') or []) if trim_text(value, 120)],
                'sources': [],
            })
            entry['sources'].append({
                'documentId': trim_text(document.get('id') or '', 80),
                'fileName': trim_text(suggestion.get('sourceFile') or document.get('fileName') or '', 180),
                'sourceLocation': trim_text(suggestion.get('sourceLocation') or '', 120),
                'proposedValue': proposed_value,
                'evidenceSnippet': trim_text(suggestion.get('evidenceSnippet') or '', 260),
                'confidence': trim_text(suggestion.get('confidence') or preview.get('confidenceClass') or 'Medium', 24),
                'rationale': trim_text(suggestion.get('rationale') or '', 220),
                'uploadedAt': trim_text(document.get('uploadedAt') or '', 40),
                'documentType': document_type,
                'sourceTier': trim_text(document.get('sourceTier') or source_tier, 60),
                'sourceTierRank': int(document.get('sourceTierRank') or source_tier_rank),
                'reliability': trim_text(document.get('reliability') or reliability, 24),
                'reliabilityRank': int(document.get('reliabilityRank') or reliability_rank),
                'precedenceScore': (int(document.get('sourceTierRank') or source_tier_rank) * 100)
                    + (int(document.get('reliabilityRank') or reliability_rank) * 10)
                    + confidence_rank(suggestion.get('confidence') or preview.get('confidenceClass') or 'Medium'),
            })

    fields: list[dict[str, Any]] = []
    for target_path, entry in grouped.items():
        sources = [item for item in entry.get('sources', []) if isinstance(item, dict)]
        if not sources:
            continue
        sources.sort(key=review_source_sort_key, reverse=True)
        value_counts: dict[str, int] = {}
        for source in sources:
            proposed_value = normalize_logic_builder_value(source.get('proposedValue') or '')
            if proposed_value:
                value_counts[proposed_value] = value_counts.get(proposed_value, 0) + 1
        preserved = preserved_lookup.get(target_path, {})
        preserved_value = trim_text(preserved.get('resolvedValue') or preserved.get('currentValue') or '', 220)
        preserved_status = trim_text(preserved.get('reviewStatus') or preserved.get('status') or '', 24)
        primary_source = sources[0]
        resolved_value = preserved_value or normalize_logic_builder_value(primary_source.get('proposedValue') or '')
        resolved_confidence = trim_text(preserved.get('resolvedConfidence') or preserved.get('currentConfidence') or primary_source.get('confidence') or 'Medium', 24)
        review_status = preserved_status or ('conflict' if len(value_counts) > 1 else 'pending')
        selected_sources = [source for source in sources if normalize_logic_builder_value(source.get('proposedValue') or '') == resolved_value]
        if selected_sources:
            primary_source = selected_sources[0]
        resolution_reason = trim_text(preserved.get('resolutionReason') or '', 240)
        if not resolution_reason:
            if preserved_value and preserved_value != normalize_logic_builder_value(sources[0].get('proposedValue') or ''):
                resolution_reason = 'Preserved a previously accepted value from extraction memory until the new evidence is reviewed.'
            elif len(value_counts) > 1:
                resolution_reason = 'Multiple source values were found. The queue defaults to the strongest source by precedence, reliability, confidence, and recency until you validate it.'
            else:
                resolution_reason = 'Single-source suggestion selected from the strongest available evidence.'
        fields.append({
            'id': entry['id'],
            'targetPath': target_path,
            'tower': entry['tower'],
            'section': entry['section'],
            'subsection': entry['subsection'],
            'fieldKey': entry['fieldKey'],
            'fieldLabel': entry['fieldLabel'],
            'controlType': entry['controlType'],
            'allowedValues': entry['allowedValues'],
            'resolvedValue': resolved_value,
            'resolvedConfidence': resolved_confidence or 'Medium',
            'reviewStatus': review_status or 'pending',
            'resolutionReason': resolution_reason,
            'supportingSourceCount': len(sources),
            'supportingDocumentCount': len({trim_text(source.get('documentId') or '', 80) for source in sources if trim_text(source.get('documentId') or '', 80)}),
            'distinctValueCount': len(value_counts),
            'conflictCount': max(0, len(value_counts) - 1),
            'valuesFound': list(value_counts.keys())[:6],
            'primarySourceFile': trim_text(primary_source.get('fileName') or '', 180),
            'primarySourceLocation': trim_text(primary_source.get('sourceLocation') or '', 120),
            'primaryEvidenceSnippet': trim_text(primary_source.get('evidenceSnippet') or '', 260),
            'primarySourceTier': trim_text(primary_source.get('sourceTier') or '', 60),
            'primaryReliability': trim_text(primary_source.get('reliability') or '', 24),
            'sourcePrecedencePolicy': source_precedence_policy_text(),
            'populatedAt': trim_text(preserved.get('populatedAt') or '', 40),
            'populatedByUserId': trim_text(preserved.get('populatedByUserId') or '', 80),
            'populatedByName': trim_text(preserved.get('populatedByName') or '', 120),
            'sources': sources[:6],
        })
    fields.sort(key=lambda item: (trim_text(item.get('tower') or '', 40), trim_text(item.get('section') or '', 80), trim_text(item.get('fieldLabel') or '', 140), trim_text(item.get('subsection') or '', 120)))
    status_counts: dict[str, int] = {}
    conflict_count = 0
    high_confidence_count = 0
    for item in fields:
        status_value = trim_text(item.get('reviewStatus') or 'pending', 24) or 'pending'
        status_counts[status_value] = status_counts.get(status_value, 0) + 1
        if int(item.get('conflictCount') or 0) > 0:
            conflict_count += 1
        if confidence_rank(item.get('resolvedConfidence') or '') >= 4:
            high_confidence_count += 1
    summary = {
        'fieldCount': len(fields),
        'pendingCount': status_counts.get('pending', 0),
        'populatedCount': status_counts.get('populated', 0),
        'acceptedCount': status_counts.get('accepted', 0) + status_counts.get('locked', 0),
        'conflictCount': conflict_count,
        'highConfidenceCount': high_confidence_count,
        'towerCount': len({trim_text(item.get('tower') or '', 40) for item in fields if trim_text(item.get('tower') or '', 40)}),
        'sectionCount': len({f"{trim_text(item.get('tower') or '', 40)}::{trim_text(item.get('section') or '', 80)}" for item in fields if trim_text(item.get('tower') or '', 40)}),
        'statusCounts': status_counts,
    }
    return {
        'version': 'logic_builder_v2',
        'updatedAt': updated_at,
        'lastRunId': run_id,
        'fields': fields,
        'summary': summary,
    }


def build_logic_builder_snapshot(
    documents: list[dict[str, Any]],
    *,
    existing_logic_builder: dict[str, Any] | None = None,
    normalized_field_memory: dict[str, Any] | None = None,
    run_id: str = '',
    updated_at: str = '',
) -> dict[str, Any]:
    document_register = build_logic_builder_document_register(documents)
    chunk_store = build_logic_builder_chunk_store(documents)
    fact_ledger = build_logic_builder_fact_ledger(documents)
    review_queue = build_logic_builder_review_queue(
        documents,
        existing_logic_builder=existing_logic_builder,
        normalized_field_memory=normalized_field_memory,
        run_id=run_id,
        updated_at=updated_at,
    )
    review_summary = review_queue.get('summary') if isinstance(review_queue.get('summary'), dict) else {}
    fields = review_queue.get('fields') if isinstance(review_queue.get('fields'), list) else []
    summary = {
        'documentCount': len(document_register),
        'chunkCount': len(chunk_store),
        'factCount': len(fact_ledger),
        'reviewFieldCount': len(fields),
        'conflictFieldCount': int(review_summary.get('conflictCount') or 0),
        'highConfidenceFieldCount': int(review_summary.get('highConfidenceCount') or 0),
        'towerCount': int(review_summary.get('towerCount') or 0),
        'sectionCount': int(review_summary.get('sectionCount') or 0),
    }
    return {
        'version': 'logic_builder_v2',
        'updatedAt': updated_at,
        'lastRunId': run_id,
        'documentRegister': document_register,
        'chunkStore': chunk_store,
        'factLedger': fact_ledger,
        'reviewQueue': review_queue,
        'summary': summary,
    }

