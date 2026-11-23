from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from .config import WORKBOOK_TEMPLATE_PATH


APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parents[1]
WORKBOOK_TEMPLATE = WORKBOOK_TEMPLATE_PATH or (PROJECT_DIR / 'docs' / 'E2E_Finance_Solution_Model_v6.xlsx')
POWERSHELL_SCRIPT = APP_DIR / 'excel_oracle.ps1'

ALLOWED_FPA_SHEETS = {
    'FPA_00 Cover',
    'FPA_00 Logic',
    'FPA_00 Dict',
    'FPA_01 Deal Setup',
    'FPA_02 Discovery',
    'FPA_03 Scope L3',
    'FPA_04 Benchmarks',
    'FPA_05 Workload',
    'FPA_06 Complexity',
    'FPA_07 Personas',
    'FPA_08 AI Benefit',
    'FPA_09 Ops Model',
    'FPA_10 Rate Card',
    'FPA_11 FTE Engine',
    'FPA_12 Cost',
    'FPA_13 Pricing',
    'FPA_30 SCPL',
    'FPA_14 Outcome',
    'FPA_15 Transition',
    'FPA_16 Business Case',
    'FPA_17 Sensitivity',
    'FPA_18 Risk',
    'FPA_19 Deal Risks',
    'FPA_20 Recommend',
    'FPA_21 Client Value',
    'FPA_22 Dashboard',
    'FPA_23 Trace Log',
    'FPA_24 Governance',
    'FPA_25 Confidence',
    'FPA_26 Calibration',
    'FPA_27 Benchmark Pack',
    'FPA_28 Change Log',
    'FPA_29 L3 Business View',
}

ALLOWED_P2P_SHEETS = {sheet.replace('FPA_', 'P2P_', 1) for sheet in ALLOWED_FPA_SHEETS}

DEAL_MASTER_CELL_MAP = {
    'clientName': 'D6',
    'dealId': 'D7',
    'presalesLead': 'D8',
    'bidDate': 'D9',
    'contractTerm': 'D11',
    'discountRate': 'D12',
    'displayCurrency': 'D16',
    'fxRate': 'D17',
    'pricingConstruct': 'D20',
    'transitionCommercials': 'D21',
    'transformationFunding': 'D22',
    'benchmarkPolicy': 'D25',
    'corporateOverhead': 'D26',
    'committedProdY2': 'D29',
    'committedProdY3': 'D30',
    'committedProdY4': 'D31',
    'customerFinanceFte': 'D43',
    'financeCostBaseline': 'D44',
    'programName': 'D45',
}

DISCOVERY_CELL_MAP = {
    'industryVertical': 'D7',
    'annualRevenueUsdM': 'D8',
    'legalEntities': 'D10',
    'businessUnits': 'D11',
    'employeeCount000': 'D12',
    'geoCountries': 'D13',
    'languagesBeyondEnglish': 'D14',
    'costCentres': 'D15',
    'productServiceLines': 'D16',
    'forecastCadence': 'D17',
    'planningIterationsPerBudget': 'D18',
    'forecastVersionsMaintained': 'D19',
    'reportPacksPerMonth': 'D20',
    'adhocAnalysisIntensity': 'D21',
    'epmPlatform': 'D22',
    'monthlyCloseComplexity': 'D23',
    'processMaturity': 'D24',
    'automationMaturity': 'D25',
    'aiMaturity': 'D26',
    'digitalMaturity': 'D27',
    'competitiveIntensity': 'D28',
    'platformModernizationInScope': 'D29',
    'peakMonth1': 'D30',
    'peakMonth2': 'D31',
    'peakMonth3': 'D32',
    'retainedOrgIntent': 'D33',
    'dataSourcesCount': 'D34',
    'currentTowerStaff': 'D35',
    'currentTowerCostBaselineUsd': 'D36',
    'erpLandscape': 'D64',
    'consolidationApproach': 'D65',
    'biLandscape': 'D66',
    'dataMartMaturity': 'D67',
    'governanceMode': 'D68',
}

DISCOVERY_EVIDENCE_CELL_MAP = {
    'industryVertical': {'source': 'F7', 'confidence': 'G7', 'owner': 'H7', 'date': 'I7'},
    'annualRevenueUsdM': {'source': 'F8', 'confidence': 'G8', 'owner': 'H8', 'date': 'I8'},
    'legalEntities': {'source': 'F10', 'confidence': 'G10', 'owner': 'H10', 'date': 'I10'},
    'businessUnits': {'source': 'F11', 'confidence': 'G11', 'owner': 'H11', 'date': 'I11'},
    'employeeCount000': {'source': 'F12', 'confidence': 'G12', 'owner': 'H12', 'date': 'I12'},
    'geoCountries': {'source': 'F13', 'confidence': 'G13', 'owner': 'H13', 'date': 'I13'},
    'languagesBeyondEnglish': {'source': 'F14', 'confidence': 'G14', 'owner': 'H14', 'date': 'I14'},
    'costCentres': {'source': 'F15', 'confidence': 'G15', 'owner': 'H15', 'date': 'I15'},
    'productServiceLines': {'source': 'F16', 'confidence': 'G16', 'owner': 'H16', 'date': 'I16'},
    'forecastCadence': {'source': 'F17', 'confidence': 'G17', 'owner': 'H17', 'date': 'I17'},
    'planningIterationsPerBudget': {'source': 'F18', 'confidence': 'G18', 'owner': 'H18', 'date': 'I18'},
    'forecastVersionsMaintained': {'source': 'F19', 'confidence': 'G19', 'owner': 'H19', 'date': 'I19'},
    'reportPacksPerMonth': {'source': 'F20', 'confidence': 'G20', 'owner': 'H20', 'date': 'I20'},
    'adhocAnalysisIntensity': {'source': 'F21', 'confidence': 'G21', 'owner': 'H21', 'date': 'I21'},
    'epmPlatform': {'source': 'F22', 'confidence': 'G22', 'owner': 'H22', 'date': 'I22'},
    'monthlyCloseComplexity': {'source': 'F23', 'confidence': 'G23', 'owner': 'H23', 'date': 'I23'},
    'processMaturity': {'source': 'F24', 'confidence': 'G24', 'owner': 'H24', 'date': 'I24'},
    'automationMaturity': {'source': 'F25', 'confidence': 'G25', 'owner': 'H25', 'date': 'I25'},
    'aiMaturity': {'source': 'F26', 'confidence': 'G26', 'owner': 'H26', 'date': 'I26'},
    'digitalMaturity': {'source': 'F27', 'confidence': 'G27', 'owner': 'H27', 'date': 'I27'},
    'competitiveIntensity': {'source': 'F28', 'confidence': 'G28', 'owner': 'H28', 'date': 'I28'},
    'platformModernizationInScope': {'source': 'F29', 'confidence': 'G29', 'owner': 'H29', 'date': 'I29'},
    'peakMonth1': {'source': 'F30', 'confidence': 'G30', 'owner': 'H30', 'date': 'I30'},
    'peakMonth2': {'source': 'F31', 'confidence': 'G31', 'owner': 'H31', 'date': 'I31'},
    'peakMonth3': {'source': 'F32', 'confidence': 'G32', 'owner': 'H32', 'date': 'I32'},
    'retainedOrgIntent': {'source': 'F33', 'confidence': 'G33', 'owner': 'H33', 'date': 'I33'},
    'dataSourcesCount': {'source': 'F34', 'confidence': 'G34', 'owner': 'H34', 'date': 'I34'},
    'currentTowerStaff': {'source': 'F35', 'confidence': 'G35', 'owner': 'H35', 'date': 'I35'},
    'currentTowerCostBaselineUsd': {'source': 'F36', 'confidence': 'G36', 'owner': 'H36', 'date': 'I36'},
}

DISCOVERY_COVERAGE_CELL_MAP = {
    'volumesCoreDrivers': 'H41',
    'currentFteByProcess': 'H42',
    'platformAndMaturity': 'H43',
    'automationAlreadyAchieved': 'H44',
    'kpiBaselineCycleMetrics': 'H45',
    'activityInventory': 'H46',
    'closeCalendar': 'H47',
    'existingSlasKpis': 'H48',
    'currentCostBaseline': 'H49',
    'painPointsPriorities': 'H50',
    'retainedOrgIntentShared': 'H51',
    'dataSourceLandscape': 'H52',
    'peakCalendarConfirmed': 'H53',
}

DISCOVERY_PAIN_POINT_CELL_MAP = {
    'budgetCycleTooLong': {'present': 'D80', 'severity': 'E80'},
    'forecastAccuracyPoor': {'present': 'D81', 'severity': 'E81'},
    'excelDependentConsolidation': {'present': 'D82', 'severity': 'E82'},
    'reportProliferation': {'present': 'D83', 'severity': 'E83'},
    'lateCloseDelays': {'present': 'D84', 'severity': 'E84'},
    'weakDriverGovernance': {'present': 'D85', 'severity': 'E85'},
    'limitedScenarioCapability': {'present': 'D86', 'severity': 'E86'},
    'businessPartnersConsumedByDataPrep': {'present': 'D87', 'severity': 'E87'},
}

DISCOVERY_VALUE_MAP = {
    'industryVertical': {
        'Healthcare & Life Sciences': 'Healthcare & Pharma',
        'Technology': 'Technology & SaaS',
        'Telecom': 'Telecom & Media',
        'Retail & CPG': 'CPG & Retail',
    },
    'monthlyCloseComplexity': {
        'Moderate (6-8 days)': 'Standard (6-8 days)',
    },
    'processMaturity': {
        'Nascent': 'Basic',
        'Stable': 'Established',
    },
    'aiMaturity': {
        'Scaling': 'Scaled',
        'Industrialized': 'Scaled',
    },
    'digitalMaturity': {
        'Transitional': 'Modernised',
        'Modern': 'Modernised',
    },
    'erpLandscape': {
        'Single ERP': 'Single legacy ERP (ECC, EBS, AX)',
        'Complex ERP estate (4+)': 'Fragmented (4+ ERPs / spreadsheets)',
    },
    'consolidationApproach': {
        'Consolidation outside EPM': 'Spreadsheet consolidation',
    },
    'biLandscape': {
        'No BI layer': 'Excel / PowerPoint reporting',
        'BI present, governed': 'Enterprise BI (Power BI / Tableau), governed',
    },
    'dataMartMaturity': {
        'No marts': 'Direct extracts / manual',
        'Enterprise data platform': 'Finance data warehouse / lakehouse',
    },
    'governanceMode': {
        'Standardized governance': 'Governed MDM tool',
    },
}
LEGACY_SCOPE_GROUP_ROWS = {
    'budgetingPlanning': range(10, 16),
    'commercialForecasting': range(22, 26),
    'workforceCapacityPlanning': range(30, 33),
    'cashFlowCapitalPlanning': range(33, 36),
    'variancePerformanceManagement': range(36, 41),
    'managementReportingDecisionSupport': range(41, 46),
    'scenarioRiskModeling': range(46, 49),
    'profitabilityPricingBusinessCases': range(49, 52),
    'costProductivityMarginManagement': range(26, 30),
    'governanceMasterDataBusinessPartnering': range(52, 58),
}
SCOPE_DEFAULTS = {
    'status': 'N',
    'partialPct': '0',
    'retainedToo': '',
    'disposition': '',
    'locationIntent': '',
}
SCOPE_ROW_MAP = (
    ('strategicLrpModelBuildRefresh', 6),
    ('strategicScenarioSupport', 7),
    ('strategicTargetCascade', 8),
    ('strategicBoardStrategyPackSupport', 9),
    ('annualCalendarTemplates', 10),
    ('annualTargetSettingSupport', 11),
    ('annualSubmissionCollectionValidation', 12),
    ('annualConsolidationIteration', 13),
    ('annualBridgeWalkAnalysis', 14),
    ('annualApprovalPack', 15),
    ('forecastDataStagingValidation', 16),
    ('forecastDriverUpdate', 17),
    ('forecastBuCollection', 18),
    ('forecastConsolidationVersionControl', 19),
    ('forecastIbpSopAlignment', 20),
    ('forecastAccuracyTracking', 21),
    ('revenuePipelineBacklogAnalytics', 22),
    ('revenuePricingVolumeMixAnalysis', 23),
    ('revenueModelMaintenance', 24),
    ('revenueCommercialReviewsSupport', 25),
    ('costCentreReporting', 26),
    ('spendAnalytics', 27),
    ('productivityTracking', 28),
    ('allocationMaintenance', 29),
    ('workforceHeadcountReporting', 30),
    ('workforcePositionVacancyTracking', 31),
    ('workforceCostModelling', 32),
    ('cashDirectIndirectForecast', 33),
    ('cashCapexBusinessCaseSupport', 34),
    ('cashWorkingCapitalAnalytics', 35),
    ('varianceFlashResults', 36),
    ('varianceDecomposition', 37),
    ('varianceCommentaryDrafting', 38),
    ('varianceKpiScorecards', 39),
    ('variancePerformanceReviewPacks', 40),
    ('reportingRecurringPackProduction', 41),
    ('reportingDashboardRefresh', 42),
    ('reportingAdhocAnalysis', 43),
    ('reportingExecBoardPackSupport', 44),
    ('reportingDataReconciliation', 45),
    ('scenarioBuilds', 46),
    ('scenarioSensitivityRuns', 47),
    ('scenarioRiskAdjustedViews', 48),
    ('profitabilityCustomerProfitability', 49),
    ('profitabilityPricingAnalytics', 50),
    ('profitabilityBusinessCaseModelling', 51),
    ('governancePlanningCalendarGovernance', 52),
    ('governanceEpmAdminMasterData', 53),
    ('governanceAccessHierarchyMaintenance', 54),
    ('governanceBusinessPartneringSupport', 55),
    ('governanceKnowledgeManagementSops', 56),
    ('governanceContinuousImprovement', 57),
)
SCOPE_ROW_IDS = {scope_id for scope_id, _ in SCOPE_ROW_MAP}


def _string_value(value: object) -> str:
    if value is None:
        return ''
    return str(value).strip()


def _normalize_discovery_value(field: str, value: object) -> str:
    normalized = _string_value(value)
    if not normalized:
        return ''

    if field == 'annualRevenueUsdM':
        try:
            numeric = float(normalized.replace(',', ''))
        except ValueError:
            return normalized
        if numeric >= 1000:
            return str(round(numeric / 1000, 3)).rstrip('0').rstrip('.')
        return str(round(numeric, 3)).rstrip('0').rstrip('.')

    return DISCOVERY_VALUE_MAP.get(field, {}).get(normalized, normalized)


def _format_scope_fraction(value: float) -> str:
    return str(round(value, 3)).rstrip('0').rstrip('.')


def _normalize_scope_status(value: object) -> str:
    normalized = _string_value(value)
    if not normalized:
        return ''

    upper = normalized.upper()
    if upper in {'Y', 'YES'}:
        return 'Y'
    if upper in {'N', 'NO'}:
        return 'N'
    if upper in {'PARTIAL', 'P'}:
        return 'Partial'
    return normalized


def _normalize_scope_partial(value: object) -> str:
    normalized = _string_value(value)
    if not normalized:
        return ''

    try:
        numeric_value = float(normalized.replace(',', ''))
    except ValueError:
        return ''

    return _format_scope_fraction(min(1, max(0, numeric_value)))


def _normalize_scope_retained(value: object) -> str:
    normalized = _string_value(value)
    if not normalized:
        return ''

    upper = normalized.upper()
    if upper in {'Y', 'YES'}:
        return 'Y'
    if upper in {'N', 'NO'}:
        return 'N'
    return normalized


def _scope_row_value(row_state: dict, field: str, normalizer, default: str) -> str:
    if field not in row_state:
        return default
    return normalizer(row_state.get(field))


def _build_scope_inputs(scope: dict) -> dict[str, str]:
    scope_inputs: dict[str, str] = {}

    if any(key in scope for key in SCOPE_ROW_IDS):
        for scope_id, row_number in SCOPE_ROW_MAP:
            row_state = scope.get(scope_id) if isinstance(scope.get(scope_id), dict) else {}
            status = _scope_row_value(row_state, 'status', _normalize_scope_status, SCOPE_DEFAULTS['status'])
            partial = _scope_row_value(row_state, 'partialPct', _normalize_scope_partial, SCOPE_DEFAULTS['partialPct'])
            retained = _scope_row_value(row_state, 'retainedToo', _normalize_scope_retained, SCOPE_DEFAULTS['retainedToo'])
            disposition = _scope_row_value(row_state, 'disposition', _string_value, SCOPE_DEFAULTS['disposition'])
            location_intent = _scope_row_value(row_state, 'locationIntent', _string_value, SCOPE_DEFAULTS['locationIntent'])

            scope_inputs[f'F{row_number}'] = status
            scope_inputs[f'G{row_number}'] = partial
            scope_inputs[f'I{row_number}'] = retained
            scope_inputs[f'J{row_number}'] = disposition
            scope_inputs[f'K{row_number}'] = location_intent

        return scope_inputs

    for field, rows in LEGACY_SCOPE_GROUP_ROWS.items():
        if field not in scope:
            continue
        status = 'Y' if bool(scope.get(field)) else 'N'
        partial = '1' if status == 'Y' else '0'
        for row_number in rows:
            scope_inputs[f'F{row_number}'] = status
            scope_inputs[f'G{row_number}'] = partial
            scope_inputs[f'I{row_number}'] = 'N'
            scope_inputs[f'J{row_number}'] = 'Transfer' if status == 'Y' else 'Retain'
            scope_inputs[f'K{row_number}'] = 'Follow model'

    return scope_inputs


def _sheet_inputs_from_legacy_workspace(deal_payload: dict) -> dict[str, dict[str, str]]:
    workspace = deal_payload.get('fpaWorkspace') if isinstance(deal_payload.get('fpaWorkspace'), dict) else {}
    discovery = workspace.get('discovery') if isinstance(workspace.get('discovery'), dict) else {}
    discovery_evidence = workspace.get('discoveryEvidence') if isinstance(workspace.get('discoveryEvidence'), dict) else {}
    discovery_coverage = workspace.get('discoveryCoverage') if isinstance(workspace.get('discoveryCoverage'), dict) else {}
    discovery_pain_points = workspace.get('discoveryPainPoints') if isinstance(workspace.get('discoveryPainPoints'), dict) else {}
    scope = workspace.get('scopeL3') if isinstance(workspace.get('scopeL3'), dict) else {}

    inputs: dict[str, dict[str, str]] = {}

    discovery_inputs: dict[str, str] = {}
    for field, address in DISCOVERY_CELL_MAP.items():
        next_value = _normalize_discovery_value(field, discovery.get(field))
        if next_value:
            discovery_inputs[address] = next_value

    for field, column_map in DISCOVERY_EVIDENCE_CELL_MAP.items():
        evidence_entry = discovery_evidence.get(field) if isinstance(discovery_evidence.get(field), dict) else {}
        for evidence_key, address in column_map.items():
            next_value = _string_value(evidence_entry.get(evidence_key))
            if next_value:
                discovery_inputs[address] = next_value

    for field, address in DISCOVERY_COVERAGE_CELL_MAP.items():
        next_value = _string_value(discovery_coverage.get(field))
        if next_value:
            discovery_inputs[address] = next_value

    for field, cell_map in DISCOVERY_PAIN_POINT_CELL_MAP.items():
        state = discovery_pain_points.get(field) if isinstance(discovery_pain_points.get(field), dict) else {}
        present = _string_value(state.get('present'))
        severity = _string_value(state.get('severity'))
        if present:
            discovery_inputs[cell_map['present']] = present
        if severity:
            discovery_inputs[cell_map['severity']] = severity

    if discovery_inputs:
        inputs['FPA_02 Discovery'] = discovery_inputs

    scope_inputs = _build_scope_inputs(scope)

    if scope_inputs:
        inputs['FPA_03 Scope L3'] = scope_inputs

    return inputs


def _build_deal_master_inputs(deal_payload: dict) -> dict[str, str]:
    inputs: dict[str, str] = {}
    for field, address in DEAL_MASTER_CELL_MAP.items():
        next_value = _string_value(deal_payload.get(field))
        if next_value:
            inputs[address] = next_value

    
    inputs["D13"] = "3"

    tower_rows = {
        'FPA': 36,
        'RTR': 37,
        'O2C': 38,
        'P2P': 39,
    }
    for code, row in tower_rows.items():
        in_scope = 'Yes' if bool(deal_payload.get(f'towerScope_{code}', True)) else 'No'
        inputs[f'D{row}'] = in_scope
        lead_name = _string_value(deal_payload.get(f'towerLead_{code}'))
        if lead_name:
            inputs[f'E{row}'] = lead_name

    return inputs


def _merge_explicit_workbook_inputs(
    workbook_inputs: dict[str, dict[str, str]],
    explicit_inputs: object,
) -> dict[str, dict[str, str]]:
    if not isinstance(explicit_inputs, dict):
        return workbook_inputs

    for sheet_name, sheet_inputs in explicit_inputs.items():
        if not isinstance(sheet_name, str) or not sheet_name:
            continue
        if not isinstance(sheet_inputs, dict):
            continue
        workbook_inputs.setdefault(sheet_name, {})
        for address, value in sheet_inputs.items():
            if not isinstance(address, str) or not address:
                continue
            workbook_inputs[sheet_name][address] = '' if value is None else str(value)

    return workbook_inputs


def build_fpa_workbook_inputs(deal_payload: dict) -> dict[str, dict[str, str]]:
    workbook_inputs: dict[str, dict[str, str]] = {
        'E2E Deal Master': _build_deal_master_inputs(deal_payload),
    }

    for sheet_name, sheet_inputs in _sheet_inputs_from_legacy_workspace(deal_payload).items():
        workbook_inputs[sheet_name] = dict(sheet_inputs)

    workbook_inputs = _merge_explicit_workbook_inputs(workbook_inputs, deal_payload.get('fpaWorkbookInputs'))
    return {sheet_name: values for sheet_name, values in workbook_inputs.items() if values}


def build_p2p_workbook_inputs(deal_payload: dict) -> dict[str, dict[str, str]]:
    workbook_inputs: dict[str, dict[str, str]] = {
        'E2E Deal Master': _build_deal_master_inputs(deal_payload),
    }

    workbook_inputs = _merge_explicit_workbook_inputs(workbook_inputs, deal_payload.get('p2pWorkbookInputs'))
    return {sheet_name: values for sheet_name, values in workbook_inputs.items() if values}


def build_workbook_inputs(deal_payload: dict) -> dict[str, dict[str, str]]:
    return build_fpa_workbook_inputs(deal_payload)


def _render_workbook_sheet(
    *,
    sheet_name: str,
    allowed_sheets: set[str],
    workbook_inputs: dict[str, dict[str, str]],
    tower_label: str,
    temp_prefix: str,
) -> dict:
    if sheet_name not in allowed_sheets:
        raise ValueError(f'Unsupported {tower_label} sheet: {sheet_name}')

    if not WORKBOOK_TEMPLATE.exists():
        raise FileNotFoundError(f'Workbook template not found at {WORKBOOK_TEMPLATE}')

    if not POWERSHELL_SCRIPT.exists():
        raise FileNotFoundError(f'Workbook renderer script not found at {POWERSHELL_SCRIPT}')

    with tempfile.TemporaryDirectory(prefix=temp_prefix) as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        workbook_path = temp_dir / 'oracle.xlsx'
        input_path = temp_dir / 'inputs.json'
        output_path = temp_dir / 'sheet.json'

        workbook_path.write_bytes(WORKBOOK_TEMPLATE.read_bytes())
        input_path.write_text(json.dumps({'inputs': workbook_inputs}), encoding='utf-8')

        process = subprocess.run(
            [
                'powershell',
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                str(POWERSHELL_SCRIPT),
                '-WorkbookPath',
                str(workbook_path),
                '-InputPath',
                str(input_path),
                '-OutputPath',
                str(output_path),
                '-SheetName',
                sheet_name,
            ],
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )

        if process.returncode != 0 or not output_path.exists():
            error_text = process.stderr.strip() or process.stdout.strip() or 'Unknown Excel rendering error.'
            raise RuntimeError(error_text)

        return json.loads(output_path.read_text(encoding='utf-8-sig'))


def render_fpa_sheet(deal_payload: dict, sheet_name: str) -> dict:
    return _render_workbook_sheet(
        sheet_name=sheet_name,
        allowed_sheets=ALLOWED_FPA_SHEETS,
        workbook_inputs=build_fpa_workbook_inputs(deal_payload),
        tower_label='FP&A',
        temp_prefix='fpa-workbook-',
    )


def render_p2p_sheet(deal_payload: dict, sheet_name: str) -> dict:
    return _render_workbook_sheet(
        sheet_name=sheet_name,
        allowed_sheets=ALLOWED_P2P_SHEETS,
        workbook_inputs=build_p2p_workbook_inputs(deal_payload),
        tower_label='P2P',
        temp_prefix='p2p-workbook-',
    )
