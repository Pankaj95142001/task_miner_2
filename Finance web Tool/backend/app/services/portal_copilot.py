from __future__ import annotations

import json
import re
import sqlite3
import ssl
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

try:
    from openai import OpenAI as BaseOpenAI, DefaultHttpxClient
except ImportError:
    BaseOpenAI = None

from ..config import (
    BACKEND_DIR,
    OPENAI_API_KEY,
    OPENAI_PORTAL_COPILOT_MAX_OUTPUT_TOKENS,
    OPENAI_PORTAL_COPILOT_MODEL,
    PORTAL_COPILOT_SESSIONS_FILE,
    SQLITE_STORAGE_PATH,
    STORAGE_BACKEND,
)
from .document_knowledge import knowledge
from .copilot_grounding import GROUNDING_INSTRUCTIONS, context_key, scoped_session, saved_context, validate_reply_sources
from ..models import User
from ..observability import start_observation, update_observation
from .document_intake import (
    FIELD_SUGGESTION_ITEM_SCHEMA,
    build_portal_catalog_prompt,
    build_prepared_text_chunks,
    extract_output_text,
    load_portal_field_catalog,
    normalize_space,
    prepare_document_context,
    trim_text,
)

PORTAL_COPILOT_AGENT_NAME = 'Portal Copilot'
PORTAL_COPILOT_PORTFOLIO_SCOPE_ID = '__all-deals__'
MAX_HISTORY_MESSAGES = 18
MAX_HISTORY_FOR_PROMPT = 10
MAX_CATALOG_FIELDS = 60
MAX_REVIEW_FIELDS = 18
MAX_DOCS = 3
MAX_DOC_CHUNKS = 2
MAX_PORTFOLIO_DEALS = 6
STOPWORDS = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'could', 'do', 'for', 'from', 'how', 'i', 'if', 'in',
    'into', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'please', 'portal', 'question', 'questions', 'show', 'tell',
    'that', 'the', 'this', 'to', 'up', 'use', 'what', 'which', 'with', 'you', 'your',
}
WORKSPACE_RULES = (
    ('fpaWorkspace.discovery', ('discovery', 'overview', 'company', 'client', 'industry', 'revenue', 'employee')),
    ('fpaWorkspace.discoveryCoverage', ('coverage',)),
    ('fpaWorkspace.discoveryPainPoints', ('pain', 'painpoint', 'pain point')),
    ('fpaWorkspace.scopeL2', ('scope l2', 'scope', 'l2', 'process')),
    ('fpaWorkspace.scopeL3', ('scope l3', 'l3', 'activity')),
    ('fpaWorkspace.benchmarks', ('benchmark', 'multiplier')),
    ('fpaWorkspace.aiBenefit', ('ai benefit', 'automation', 'copilot', 'agent')),
    ('fpaWorkspace.opsModel', ('ops', 'ops model', 'location', 'pyramid', 'delivery')),
    ('fpaWorkspace.rateCard', ('rate card', 'rate', 'band', 'arc')),
    ('fpaWorkspace.pricing', ('pricing', 'price')),
    ('fpaWorkspace.transition', ('transition', 'ramp')),
    ('fpaWorkspace.governance', ('governance', 'review')),
    ('fpaWorkspace.changeLog', ('change log', 'change')),
    ('p2pWorkspace.discovery', ('p2p discovery', 'p2p overview')),
    ('p2pWorkspace.scopeL3', ('p2p scope', 'p2p l3')),
    ('p2pWorkspace.benchmarks', ('p2p benchmark',)),
    ('p2pWorkspace.workload', ('p2p workload', 'invoice', 'vendor', 'po')),
    ('p2pWorkspace.governance', ('p2p governance',)),
)
SOURCE_REF_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'sourceFile': {'type': 'string'},
        'sourceLocation': {'type': 'string'},
        'evidenceSnippet': {'type': 'string'},
    },
    'required': ['sourceFile', 'sourceLocation', 'evidenceSnippet'],
}
PORTAL_COPILOT_RESPONSE_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'answer': {'type': 'string'},
        'confidence': {'type': 'string'},
        'answerType': {'type': 'string'},
        'sourceRefs': {'type': 'array', 'items': SOURCE_REF_SCHEMA},
        'suggestedFields': {'type': 'array', 'items': FIELD_SUGGESTION_ITEM_SCHEMA},
        'openQuestions': {'type': 'array', 'items': {'type': 'string'}},
        'nextActions': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['answer', 'confidence', 'answerType', 'sourceRefs', 'suggestedFields', 'openQuestions', 'nextActions'],
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def session_key(deal_id: str, user_id: str) -> str:
    return f'{trim_text(deal_id or "", 120)}::{trim_text(user_id or "", 120)}'


def query_tokens(query: str) -> list[str]:
    tokens = re.findall(r'[a-z0-9&+.-]{2,}', str(query or '').lower())
    return [token for token in tokens if token not in STOPWORDS][:28]


def score_text(text: str, tokens: list[str]) -> int:
    haystack = normalize_space(text or '').lower()
    if not haystack or not tokens:
        return 0
    score = 0
    for token in tokens:
        if token in haystack:
            score += 2
        if f' {token} ' in f' {haystack} ':
            score += 1
    return score


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return False
    if isinstance(value, list):
        return all(is_empty(item) for item in value)
    if isinstance(value, dict):
        return all(is_empty(item) for item in value.values())
    return False


def compact(value: Any, depth: int = 0) -> Any:
    if depth > 4:
        return None
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            reduced = compact(item, depth + 1)
            if is_empty(reduced):
                continue
            result[str(key)] = reduced
        return result
    if isinstance(value, list):
        result = []
        for item in value:
            reduced = compact(item, depth + 1)
            if is_empty(reduced):
                continue
            result.append(reduced)
            if len(result) >= 14:
                break
        return result
    if isinstance(value, str):
        return trim_text(normalize_space(value), 280)
    return value


def get_path_value(payload: dict[str, Any] | None, dotted_path: str) -> Any:
    current: Any = payload if isinstance(payload, dict) else {}
    for part in dotted_path.split('.'):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def build_workspace_snapshot(question: str, deal_payload: dict[str, Any]) -> dict[str, Any]:
    lower = normalize_space(question).lower()
    result = {}
    for path, keywords in WORKSPACE_RULES:
        if any(keyword in lower for keyword in keywords):
            value = compact(get_path_value(deal_payload, path))
            if not is_empty(value):
                result[path] = value
    return result


def build_review_fields(question: str, intake: dict[str, Any]) -> list[dict[str, Any]]:
    logic_builder = intake.get('logicBuilder') if isinstance(intake.get('logicBuilder'), dict) else {}
    review_queue = logic_builder.get('reviewQueue') if isinstance(logic_builder.get('reviewQueue'), dict) else {}
    fields = review_queue.get('fields') if isinstance(review_queue.get('fields'), list) else []
    tokens = query_tokens(question)
    ranked = []
    for field in fields:
        if not isinstance(field, dict):
            continue
        target_path = trim_text(field.get('targetPath') or field.get('id') or '', 240)
        if target_path == 'colaRate' or trim_text(field.get('fieldKey') or '', 120) == 'colaRate':
            continue
        haystack = ' '.join([
            field.get('tower') or '', field.get('section') or '', field.get('subsection') or '',
            field.get('fieldLabel') or '', field.get('fieldKey') or '', field.get('proposedValue') or field.get('resolvedValue') or '',
            field.get('evidenceSnippet') or '', field.get('sourceFile') or '',
        ])
        score = score_text(haystack, tokens)
        if not tokens:
            score += 1
        ranked.append((score, field))
    ranked.sort(key=lambda item: (-item[0], trim_text(item[1].get('fieldLabel') or '', 180)))
    selected = [field for score, field in ranked if score > 0][:MAX_REVIEW_FIELDS] or [field for _, field in ranked[:MAX_REVIEW_FIELDS]]
    return [
        {
            'tower': trim_text(field.get('tower') or '', 40),
            'section': trim_text(field.get('section') or '', 80),
            'subsection': trim_text(field.get('subsection') or '', 120),
            'fieldLabel': trim_text(field.get('fieldLabel') or '', 180),
            'targetPath': trim_text(field.get('targetPath') or field.get('id') or '', 240),
            'proposedValue': trim_text(field.get('proposedValue') or field.get('resolvedValue') or '', 240),
            'confidence': trim_text(field.get('confidence') or '', 24),
            'sourceFile': trim_text(field.get('sourceFile') or '', 180),
            'sourceLocation': trim_text(field.get('sourceLocation') or '', 120),
            'evidenceSnippet': trim_text(field.get('evidenceSnippet') or '', 220),
        }
        for field in selected
    ]

def document_path(document: dict[str, Any]) -> Path | None:
    relative_path = trim_text(document.get('relativePath') or '', 240)
    if not relative_path:
        return None
    path = (BACKEND_DIR / relative_path).resolve()
    try:
        path.relative_to(BACKEND_DIR.resolve())
    except ValueError:
        return None
    return path if path.exists() else None


def matching_preview_fields(question: str, preview_fields: list[dict[str, Any]]) -> list[dict[str, str]]:
    tokens = query_tokens(question)
    ranked = []
    for item in preview_fields:
        if not isinstance(item, dict):
            continue
        haystack = ' '.join([
            item.get('tower') or '', item.get('section') or '', item.get('subsection') or '', item.get('fieldLabel') or '',
            item.get('fieldKey') or '', item.get('proposedValue') or '', item.get('evidenceSnippet') or '',
        ])
        score = score_text(haystack, tokens)
        if not tokens:
            score += 1
        ranked.append((score, item))
    ranked.sort(key=lambda row: -row[0])
    selected = [item for score, item in ranked if score > 0][:6] or [item for _, item in ranked[:4]]
    return [
        {
            'fieldLabel': trim_text(item.get('fieldLabel') or '', 180),
            'targetPath': trim_text(item.get('targetPath') or '', 240),
            'proposedValue': trim_text(item.get('proposedValue') or '', 240),
            'sourceLocation': trim_text(item.get('sourceLocation') or '', 120),
            'evidenceSnippet': trim_text(item.get('evidenceSnippet') or '', 220),
        }
        for item in selected
    ]


def build_document_context(question: str, intake: dict[str, Any]) -> list[dict[str, Any]]:
    documents = intake.get('documents') if isinstance(intake.get('documents'), list) else []
    tokens = query_tokens(question)
    ranked_docs = []
    for document in documents:
        if not isinstance(document, dict):
            continue
        preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
        preview_fields = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []
        haystack = ' '.join([
            document.get('fileName') or '', document.get('documentType') or '', document.get('summary') or '',
            ' '.join(item.get('fieldLabel') or '' for item in preview_fields if isinstance(item, dict)),
        ])
        score = score_text(haystack, tokens)
        if not tokens:
            score += 1
        ranked_docs.append((score, document))
    ranked_docs.sort(key=lambda item: (-item[0], trim_text(item[1].get('fileName') or '', 180)))
    selected_docs = [document for score, document in ranked_docs if score > 0][:MAX_DOCS] or [document for _, document in ranked_docs[:MAX_DOCS]]

    rows = []
    for document in selected_docs:
        preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
        preview_fields = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []
        row = {
            'fileName': trim_text(document.get('fileName') or '', 180),
            'documentType': trim_text(document.get('documentType') or '', 80),
            'summary': trim_text(document.get('summary') or preview.get('summary') or '', 320),
            'matchingFieldSuggestions': matching_preview_fields(question, preview_fields),
        }
        path = document_path(document)
        if path is not None:
            try:
                file_bytes = path.read_bytes()
                prepared_text, parser_meta = prepare_document_context(file_bytes, row['fileName'], trim_text(document.get('mimeType') or '', 80))
                chunks, _ = build_prepared_text_chunks(prepared_text, parser_meta)
                ranked_chunks = []
                for chunk in chunks:
                    if not isinstance(chunk, dict):
                        continue
                    score = score_text(chunk.get('text') or '', tokens)
                    if not tokens:
                        score += 1
                    ranked_chunks.append((score, chunk))
                ranked_chunks.sort(key=lambda item: -item[0])
                selected_chunks = [chunk for score, chunk in ranked_chunks if score > 0][:MAX_DOC_CHUNKS] or [chunk for _, chunk in ranked_chunks[:MAX_DOC_CHUNKS]]
                if selected_chunks:
                    row['documentExcerpts'] = [
                        {
                            'label': trim_text(chunk.get('label') or 'Document excerpt', 120),
                            'text': trim_text(normalize_space(chunk.get('text') or ''), 1200),
                        }
                        for chunk in selected_chunks
                    ]
            except Exception:
                pass
        rows.append(row)
    return rows


def select_catalog(question: str, catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tokens = query_tokens(question)
    lower = normalize_space(question).lower()
    ranked = []
    for item in catalog:
        haystack = ' '.join([
            item.get('tower') or '', item.get('section') or '', item.get('subsection') or '',
            item.get('fieldLabel') or '', item.get('fieldKey') or '', item.get('targetPath') or '',
        ])
        score = score_text(haystack, tokens)
        if not tokens:
            if trim_text(item.get('tower') or '', 40) == 'Deal Master':
                score += 3
            if trim_text(item.get('section') or '', 80) in {'02 Discovery', '03 Scope L3', '30 SCPL', '31 Sizing & Band Mix'}:
                score += 2
        if ('fp&a' in lower or 'fpa' in lower) and trim_text(item.get('tower') or '', 40) == 'FP&A':
            score += 3
        if 'p2p' in lower and trim_text(item.get('tower') or '', 40) == 'P2P':
            score += 3
        ranked.append((score, item))
    ranked.sort(key=lambda item: (-item[0], trim_text(item[1].get('fieldLabel') or '', 180)))
    return [item for score, item in ranked if score > 0][:MAX_CATALOG_FIELDS] or [item for _, item in ranked[:MAX_CATALOG_FIELDS]]


def portal_inventory(catalog: list[dict[str, Any]]) -> list[str]:
    seen = set()
    lines = []
    for item in catalog:
        key = f"{trim_text(item.get('tower') or '', 40)}::{trim_text(item.get('section') or '', 80)}"
        if key in seen:
            continue
        seen.add(key)
        lines.append(f"- {trim_text(item.get('tower') or '', 40)} | {trim_text(item.get('section') or '', 80)}")
    return lines[:48]


def normalize_source_refs(rows: Any) -> list[dict[str, str]]:
    result = []
    seen = set()
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        source_file = trim_text(row.get('sourceFile') or '', 180)
        source_location = trim_text(row.get('sourceLocation') or '', 120)
        evidence = trim_text(row.get('evidenceSnippet') or '', 260)
        key = f'{source_file}::{source_location}::{evidence}'
        if not source_file or key in seen:
            continue
        seen.add(key)
        result.append({'sourceFile': source_file, 'sourceLocation': source_location, 'evidenceSnippet': evidence})
        if len(result) >= 8:
            break
    return result


def normalize_suggested_fields(rows: Any, catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    catalog_by_target = {trim_text(item.get('targetPath') or '', 240): item for item in catalog}
    catalog_by_key = {trim_text(item.get('fieldKey') or '', 120): item for item in catalog}
    result = []
    seen = set()
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        target_path = trim_text(row.get('targetPath') or '', 240)
        field_key = trim_text(row.get('fieldKey') or '', 120)
        catalog_item = catalog_by_target.get(target_path) or catalog_by_key.get(field_key)
        if not catalog_item:
            continue
        normalized_target = trim_text(catalog_item.get('targetPath') or target_path, 240)
        if not normalized_target or normalized_target in seen:
            continue
        seen.add(normalized_target)
        result.append({
            'tower': trim_text(catalog_item.get('tower') or row.get('tower') or '', 40),
            'section': trim_text(catalog_item.get('section') or row.get('section') or '', 80),
            'subsection': trim_text(catalog_item.get('subsection') or row.get('subsection') or '', 140),
            'fieldKey': trim_text(catalog_item.get('fieldKey') or field_key, 120),
            'fieldLabel': trim_text(catalog_item.get('fieldLabel') or row.get('fieldLabel') or '', 220),
            'targetPath': normalized_target,
            'controlType': trim_text(catalog_item.get('controlType') or row.get('controlType') or 'text', 40),
            'allowedValues': [trim_text(value, 120) for value in (catalog_item.get('allowedValues') or row.get('allowedValues') or []) if trim_text(value, 120)],
            'proposedValue': trim_text(row.get('proposedValue') or '', 280),
            'sourceFile': trim_text(row.get('sourceFile') or '', 180),
            'sourceLocation': trim_text(row.get('sourceLocation') or '', 120),
            'evidenceSnippet': trim_text(row.get('evidenceSnippet') or '', 260),
            'confidence': trim_text(row.get('confidence') or 'Medium', 24),
            'rationale': trim_text(row.get('rationale') or '', 320),
            'agentName': trim_text(row.get('agentName') or PORTAL_COPILOT_AGENT_NAME, 80),
        })
        if len(result) >= 8:
            break
    return result


def normalize_reply(payload: dict[str, Any] | None, catalog: list[dict[str, Any]]) -> dict[str, Any]:
    data = payload if isinstance(payload, dict) else {}
    return {
        'answer': trim_text(data.get('answer') or 'I could not produce a safe portal-bounded answer from the available context.', 5000),
        'confidence': trim_text(data.get('confidence') or 'Low', 24),
        'answerType': trim_text(data.get('answerType') or 'portal-guidance', 40),
        'sourceRefs': normalize_source_refs(data.get('sourceRefs')),
        'suggestedFields': normalize_suggested_fields(data.get('suggestedFields'), catalog),
        'openQuestions': [trim_text(item, 180) for item in (data.get('openQuestions') or []) if trim_text(item, 180)][:6],
        'nextActions': [trim_text(item, 180) for item in (data.get('nextActions') or []) if trim_text(item, 180)][:6],
    }

def build_deal_snapshot(question: str, deal_payload: dict[str, Any]) -> dict[str, Any]:
    intake = deal_payload.get('documentIntake') if isinstance(deal_payload.get('documentIntake'), dict) else {}
    documents = intake.get('documents') if isinstance(intake.get('documents'), list) else []
    logic_builder = intake.get('logicBuilder') if isinstance(intake.get('logicBuilder'), dict) else {}
    review_queue = logic_builder.get('reviewQueue') if isinstance(logic_builder.get('reviewQueue'), dict) else {}
    fields = review_queue.get('fields') if isinstance(review_queue.get('fields'), list) else []
    snapshot = {
        'dealIdentity': {
            'draftLabel': trim_text(deal_payload.get('draftLabel') or '', 180),
            'clientName': trim_text(deal_payload.get('clientName') or '', 180),
            'dealId': trim_text(deal_payload.get('dealId') or '', 120),
            'programName': trim_text(deal_payload.get('programName') or '', 180),
            'dealStatus': trim_text(deal_payload.get('dealStatus') or '', 80),
            'watermark': trim_text(deal_payload.get('watermark') or '', 80),
            'displayCurrency': trim_text(deal_payload.get('displayCurrency') or '', 24),
        },
        'commercialSetup': {
            'contractTerm': trim_text(deal_payload.get('contractTerm') or '', 24),
            'pricingConstruct': trim_text(deal_payload.get('pricingConstruct') or '', 80),
            'transitionCommercials': trim_text(deal_payload.get('transitionCommercials') or '', 80),
            'transformationFunding': trim_text(deal_payload.get('transformationFunding') or '', 80),
            'benchmarkPolicy': trim_text(deal_payload.get('benchmarkPolicy') or '', 40),
        },
        'towerScope': {
            'FPA': bool(deal_payload.get('towerScope_FPA')),
            'RTR': bool(deal_payload.get('towerScope_RTR')),
            'O2C': bool(deal_payload.get('towerScope_O2C')),
            'P2P': bool(deal_payload.get('towerScope_P2P')),
        },
        'extractionStatus': {
            'documentCount': len(documents),
            'reviewFieldCount': len(fields),
            'latestRunStatus': trim_text(((intake.get('latestRun') or {}).get('status') or ''), 40),
            'latestRunCreatedAt': trim_text(((intake.get('latestRun') or {}).get('createdAt') or ''), 40),
        },
    }
    workspace_slices = build_workspace_snapshot(question, deal_payload)
    if workspace_slices:
        snapshot['workspaceSlices'] = workspace_slices
    company_overview = intake.get('companyOverview') if isinstance(intake.get('companyOverview'), dict) else {}
    company_research = intake.get('companyResearch') if isinstance(intake.get('companyResearch'), dict) else {}
    lower = normalize_space(question).lower()
    if any(keyword in lower for keyword in ('company', 'client', 'overview', 'industry', 'revenue', 'employee', 'segment', 'business model')):
        company_context = {}
        if company_overview:
            company_context['companyOverview'] = compact(company_overview)
        if company_research:
            company_context['companyResearch'] = compact({
                'companyName': company_research.get('companyName'),
                'analysisLens': company_research.get('analysisLens'),
                'executiveSummary': company_research.get('executiveSummary'),
                'headlineMetrics': company_research.get('headlineMetrics'),
                'businessOverview': company_research.get('businessOverview'),
                'dealImplications': company_research.get('dealImplications'),
            })
        if company_context:
            snapshot['companyContext'] = company_context
    return compact(snapshot)


def deal_display_name(deal_payload: dict[str, Any]) -> str:
    return trim_text(
        deal_payload.get('draftLabel')
        or deal_payload.get('clientName')
        or deal_payload.get('dealId')
        or deal_payload.get('id')
        or 'Deal',
        180,
    )


def selected_portfolio_deals(question: str, deal_payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tokens = query_tokens(question)
    ranked = []
    for deal_payload in deal_payloads if isinstance(deal_payloads, list) else []:
        if not isinstance(deal_payload, dict):
            continue
        intake = deal_payload.get('documentIntake') if isinstance(deal_payload.get('documentIntake'), dict) else {}
        documents = intake.get('documents') if isinstance(intake.get('documents'), list) else []
        haystack = ' '.join([
            deal_display_name(deal_payload),
            trim_text(deal_payload.get('clientName') or '', 180),
            trim_text(deal_payload.get('dealId') or '', 120),
            trim_text(deal_payload.get('programName') or '', 180),
            trim_text(deal_payload.get('dealStatus') or '', 80),
            trim_text(deal_payload.get('watermark') or '', 80),
            ' '.join(trim_text(document.get('fileName') or '', 180) for document in documents if isinstance(document, dict)),
        ])
        score = score_text(haystack, tokens)
        if not tokens:
            score += 1
        ranked.append((score, deal_payload))
    ranked.sort(key=lambda item: (-item[0], deal_display_name(item[1])))
    selected = [deal_payload for score, deal_payload in ranked if score > 0][:MAX_PORTFOLIO_DEALS] or [deal_payload for _, deal_payload in ranked[:MAX_PORTFOLIO_DEALS]]
    return selected


def build_portfolio_review_fields(question: str, deal_payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tokens = query_tokens(question)
    ranked = []
    for deal_payload in selected_portfolio_deals(question, deal_payloads):
        intake = deal_payload.get('documentIntake') if isinstance(deal_payload.get('documentIntake'), dict) else {}
        logic_builder = intake.get('logicBuilder') if isinstance(intake.get('logicBuilder'), dict) else {}
        review_queue = logic_builder.get('reviewQueue') if isinstance(logic_builder.get('reviewQueue'), dict) else {}
        fields = review_queue.get('fields') if isinstance(review_queue.get('fields'), list) else []
        for field in fields:
            if not isinstance(field, dict):
                continue
            haystack = ' '.join([
                deal_display_name(deal_payload),
                trim_text(deal_payload.get('clientName') or '', 180),
                field.get('tower') or '', field.get('section') or '', field.get('subsection') or '', field.get('fieldLabel') or '',
                field.get('targetPath') or field.get('id') or '', field.get('proposedValue') or field.get('resolvedValue') or '',
                field.get('evidenceSnippet') or '',
            ])
            score = score_text(haystack, tokens)
            if not tokens:
                score += 1
            ranked.append((score, deal_payload, field))
    ranked.sort(key=lambda item: (-item[0], deal_display_name(item[1]), trim_text(item[2].get('fieldLabel') or '', 180)))
    selected = [(deal_payload, field) for score, deal_payload, field in ranked if score > 0][:MAX_REVIEW_FIELDS] or [(deal_payload, field) for _, deal_payload, field in ranked[:MAX_REVIEW_FIELDS]]
    return [
        {
            'dealLabel': deal_display_name(deal_payload),
            'dealId': trim_text(deal_payload.get('dealId') or deal_payload.get('id') or '', 120),
            'clientName': trim_text(deal_payload.get('clientName') or '', 180),
            'tower': trim_text(field.get('tower') or '', 40),
            'section': trim_text(field.get('section') or '', 80),
            'subsection': trim_text(field.get('subsection') or '', 120),
            'fieldLabel': trim_text(field.get('fieldLabel') or '', 180),
            'targetPath': trim_text(field.get('targetPath') or field.get('id') or '', 240),
            'proposedValue': trim_text(field.get('proposedValue') or field.get('resolvedValue') or '', 240),
            'confidence': trim_text(field.get('confidence') or '', 24),
            'sourceFile': trim_text(field.get('sourceFile') or '', 180),
            'sourceLocation': trim_text(field.get('sourceLocation') or '', 120),
            'evidenceSnippet': trim_text(field.get('evidenceSnippet') or '', 220),
        }
        for deal_payload, field in selected
    ]


def build_portfolio_document_context(question: str, deal_payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tokens = query_tokens(question)
    ranked_docs = []
    for deal_payload in selected_portfolio_deals(question, deal_payloads):
        intake = deal_payload.get('documentIntake') if isinstance(deal_payload.get('documentIntake'), dict) else {}
        documents = intake.get('documents') if isinstance(intake.get('documents'), list) else []
        for document in documents:
            if not isinstance(document, dict):
                continue
            preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
            preview_fields = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []
            haystack = ' '.join([
                deal_display_name(deal_payload),
                trim_text(deal_payload.get('clientName') or '', 180),
                document.get('fileName') or '',
                document.get('documentType') or '',
                document.get('summary') or '',
                ' '.join(item.get('fieldLabel') or '' for item in preview_fields if isinstance(item, dict)),
            ])
            score = score_text(haystack, tokens)
            if not tokens:
                score += 1
            ranked_docs.append((score, deal_payload, document))
    ranked_docs.sort(key=lambda item: (-item[0], deal_display_name(item[1]), trim_text(item[2].get('fileName') or '', 180)))
    selected_docs = [(deal_payload, document) for score, deal_payload, document in ranked_docs if score > 0][:MAX_DOCS] or [(deal_payload, document) for _, deal_payload, document in ranked_docs[:MAX_DOCS]]

    rows = []
    for deal_payload, document in selected_docs:
        preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
        preview_fields = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []
        row = {
            'dealLabel': deal_display_name(deal_payload),
            'dealId': trim_text(deal_payload.get('dealId') or deal_payload.get('id') or '', 120),
            'clientName': trim_text(deal_payload.get('clientName') or '', 180),
            'fileName': trim_text(document.get('fileName') or '', 180),
            'documentType': trim_text(document.get('documentType') or '', 80),
            'summary': trim_text(document.get('summary') or preview.get('summary') or '', 320),
            'matchingFieldSuggestions': matching_preview_fields(question, preview_fields),
        }
        path = document_path(document)
        if path is not None:
            try:
                file_bytes = path.read_bytes()
                prepared_text, parser_meta = prepare_document_context(file_bytes, row['fileName'], trim_text(document.get('mimeType') or '', 80))
                chunks, _ = build_prepared_text_chunks(prepared_text, parser_meta)
                ranked_chunks = []
                for chunk in chunks:
                    if not isinstance(chunk, dict):
                        continue
                    score = score_text(chunk.get('text') or '', tokens)
                    if not tokens:
                        score += 1
                    ranked_chunks.append((score, chunk))
                ranked_chunks.sort(key=lambda item: -item[0])
                selected_chunks = [chunk for score, chunk in ranked_chunks if score > 0][:MAX_DOC_CHUNKS] or [chunk for _, chunk in ranked_chunks[:MAX_DOC_CHUNKS]]
                if selected_chunks:
                    row['documentExcerpts'] = [
                        {
                            'label': trim_text(chunk.get('label') or 'Document excerpt', 120),
                            'text': trim_text(normalize_space(chunk.get('text') or ''), 1200),
                        }
                        for chunk in selected_chunks
                    ]
            except Exception:
                pass
        rows.append(row)
    return rows


def build_portfolio_snapshot(question: str, deal_payloads: list[dict[str, Any]], current_user: User) -> dict[str, Any]:
    safe_deals = [deal_payload for deal_payload in deal_payloads if isinstance(deal_payload, dict)]
    status_counts: dict[str, int] = {}
    tower_counts = {'FPA': 0, 'RTR': 0, 'O2C': 0, 'P2P': 0}
    documents_total = 0
    review_fields_total = 0
    deals_with_docs = 0
    deals_with_review = 0

    for deal_payload in safe_deals:
        intake = deal_payload.get('documentIntake') if isinstance(deal_payload.get('documentIntake'), dict) else {}
        documents = intake.get('documents') if isinstance(intake.get('documents'), list) else []
        logic_builder = intake.get('logicBuilder') if isinstance(intake.get('logicBuilder'), dict) else {}
        review_queue = logic_builder.get('reviewQueue') if isinstance(logic_builder.get('reviewQueue'), dict) else {}
        fields = review_queue.get('fields') if isinstance(review_queue.get('fields'), list) else []
        status_key = trim_text(deal_payload.get('dealStatus') or 'Draft', 80) or 'Draft'
        status_counts[status_key] = status_counts.get(status_key, 0) + 1
        if documents:
            deals_with_docs += 1
        if fields:
            deals_with_review += 1
        documents_total += len(documents)
        review_fields_total += len(fields)
        for tower_code in tower_counts:
            if bool(deal_payload.get(f'towerScope_{tower_code}')):
                tower_counts[tower_code] += 1

    selected_deals = selected_portfolio_deals(question, safe_deals)
    deal_rows = []
    lower = normalize_space(question).lower()
    include_company_context = any(keyword in lower for keyword in ('company', 'client', 'overview', 'industry', 'revenue', 'employee', 'segment', 'business model'))
    for deal_payload in selected_deals:
        intake = deal_payload.get('documentIntake') if isinstance(deal_payload.get('documentIntake'), dict) else {}
        documents = intake.get('documents') if isinstance(intake.get('documents'), list) else []
        logic_builder = intake.get('logicBuilder') if isinstance(intake.get('logicBuilder'), dict) else {}
        review_queue = logic_builder.get('reviewQueue') if isinstance(logic_builder.get('reviewQueue'), dict) else {}
        fields = review_queue.get('fields') if isinstance(review_queue.get('fields'), list) else []
        row = {
            'dealLabel': deal_display_name(deal_payload),
            'clientName': trim_text(deal_payload.get('clientName') or '', 180),
            'dealId': trim_text(deal_payload.get('dealId') or deal_payload.get('id') or '', 120),
            'dealStatus': trim_text(deal_payload.get('dealStatus') or '', 80),
            'watermark': trim_text(deal_payload.get('watermark') or '', 80),
            'updatedAt': trim_text(deal_payload.get('updatedAt') or '', 40),
            'documentCount': len(documents),
            'reviewFieldCount': len(fields),
            'inScopeTowers': [tower_code for tower_code in ('FPA', 'RTR', 'O2C', 'P2P') if bool(deal_payload.get(f'towerScope_{tower_code}'))],
            'workspaceSlices': build_workspace_snapshot(question, deal_payload),
        }
        if include_company_context:
            company_overview = intake.get('companyOverview') if isinstance(intake.get('companyOverview'), dict) else {}
            company_research = intake.get('companyResearch') if isinstance(intake.get('companyResearch'), dict) else {}
            if company_overview:
                row['companyOverview'] = compact(company_overview)
            if company_research:
                row['companyResearch'] = compact({
                    'companyName': company_research.get('companyName'),
                    'analysisLens': company_research.get('analysisLens'),
                    'executiveSummary': company_research.get('executiveSummary'),
                    'headlineMetrics': company_research.get('headlineMetrics'),
                })
        deal_rows.append(compact(row))

    snapshot = {
        'scope': 'all-deals',
        'currentUser': {
            'id': trim_text(current_user.id or '', 120),
            'name': trim_text(current_user.name or '', 120),
            'role': trim_text(current_user.role or '', 120),
        },
        'portfolioSummary': {
            'visibleDealCount': len(safe_deals),
            'activeDealCount': sum(1 for deal_payload in safe_deals if trim_text(deal_payload.get('dealStatus') or '', 80) not in {'Won', 'Lost', 'Archived'}),
            'documentsTotal': documents_total,
            'reviewFieldTotal': review_fields_total,
            'dealsWithDocuments': deals_with_docs,
            'dealsWithReviewFields': deals_with_review,
            'towerCoverage': tower_counts,
            'statusCounts': status_counts,
        },
        'selectedDeals': deal_rows,
    }
    return compact(snapshot)


class PortalCopilotSessionStore:
    def __init__(
        self,
        file_path: Path | None = None,
        database_path: Path | None = None,
        storage_backend: str | None = None,
    ) -> None:
        self.file_path = file_path or PORTAL_COPILOT_SESSIONS_FILE
        self.database_path = database_path or SQLITE_STORAGE_PATH
        self.storage_backend = str(storage_backend or STORAGE_BACKEND or 'sqlite').strip().lower() or 'sqlite'
        self._lock = threading.Lock()
        if self.storage_backend == 'sqlite':
            self.database_path.parent.mkdir(parents=True, exist_ok=True)
            self._ensure_sqlite_schema()
            self._import_legacy_file_to_sqlite()

    def default_session(self, deal_id: str, user: User) -> dict[str, Any]:
        return {
            'id': session_key(deal_id, user.id),
            'dealId': trim_text(deal_id or '', 120),
            'userId': trim_text(user.id or '', 120),
            'userName': trim_text(user.name or '', 120),
            'updatedAt': '',
            'messageCount': 0,
            'messages': [],
        }

    def _connect_sqlite(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        return connection

    def _ensure_sqlite_schema(self) -> None:
        with self._connect_sqlite() as connection:
            connection.execute('PRAGMA journal_mode = WAL')
            connection.execute('PRAGMA synchronous = NORMAL')
            connection.executescript(
                '''
                CREATE TABLE IF NOT EXISTS copilot_sessions (
                    session_id TEXT PRIMARY KEY,
                    scope_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    user_name TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL DEFAULT '',
                    message_count INTEGER NOT NULL DEFAULT 0,
                    messages_json TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL DEFAULT ''
                );

                CREATE INDEX IF NOT EXISTS idx_copilot_sessions_scope_user ON copilot_sessions(scope_id, user_id);
                CREATE INDEX IF NOT EXISTS idx_copilot_sessions_user_updated ON copilot_sessions(user_id, updated_at DESC);
                '''
            )

    def _load_file_state(self) -> dict[str, Any]:
        if not self.file_path.exists():
            return {'savedAt': '', 'sessions': {}}
        try:
            data = json.loads(self.file_path.read_text(encoding='utf-8'))
        except Exception:
            return {'savedAt': '', 'sessions': {}}
        return {
            'savedAt': trim_text(data.get('savedAt') or '', 40),
            'sessions': data.get('sessions') if isinstance(data.get('sessions'), dict) else {},
        }

    def _write_file_state(self, state: dict[str, Any]) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            'savedAt': trim_text(state.get('savedAt') or '', 40),
            'sessions': state.get('sessions') if isinstance(state.get('sessions'), dict) else {},
        }
        self.file_path.write_text(json.dumps(payload, indent=2), encoding='utf-8')

    def _import_legacy_file_to_sqlite(self) -> None:
        if not self.file_path.exists():
            return
        try:
            with self._connect_sqlite() as connection:
                existing = int(connection.execute('SELECT COUNT(*) FROM copilot_sessions').fetchone()[0] or 0)
                if existing > 0:
                    return
                state = self._load_file_state()
                sessions = state.get('sessions') if isinstance(state.get('sessions'), dict) else {}
                imported_at = trim_text(state.get('savedAt') or utc_now_iso(), 40)
                for key, stored in sessions.items():
                    if not isinstance(stored, dict):
                        continue
                    session_id = trim_text(stored.get('id') or key or '', 255)
                    scope_id = trim_text(stored.get('dealId') or '', 120)
                    user_id = trim_text(stored.get('userId') or '', 120)
                    if not session_id or not scope_id or not user_id:
                        continue
                    messages = stored.get('messages') if isinstance(stored.get('messages'), list) else []
                    updated_at = trim_text(stored.get('updatedAt') or imported_at, 40)
                    connection.execute(
                        '''
                        INSERT INTO copilot_sessions (
                            session_id, scope_id, user_id, user_name, updated_at, message_count, messages_json, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(session_id) DO UPDATE SET
                            scope_id = excluded.scope_id,
                            user_id = excluded.user_id,
                            user_name = excluded.user_name,
                            updated_at = excluded.updated_at,
                            message_count = excluded.message_count,
                            messages_json = excluded.messages_json
                        ''',
                        (
                            session_id,
                            scope_id,
                            user_id,
                            trim_text(stored.get('userName') or '', 120),
                            updated_at,
                            max(0, int(stored.get('messageCount') or len(messages))),
                            json.dumps(messages, ensure_ascii=False),
                            updated_at or imported_at,
                        ),
                    )
        except sqlite3.Error:
            return

    def load_state(self) -> dict[str, Any]:
        if self.storage_backend != 'sqlite':
            return self._load_file_state()
        try:
            with self._connect_sqlite() as connection:
                rows = connection.execute(
                    'SELECT session_id, scope_id, user_id, user_name, updated_at, message_count, messages_json FROM copilot_sessions ORDER BY updated_at DESC, session_id ASC'
                ).fetchall()
        except sqlite3.Error:
            return {'savedAt': '', 'sessions': {}}

        sessions: dict[str, Any] = {}
        saved_at = ''
        for row in rows:
            try:
                messages = json.loads(row['messages_json'] or '[]')
            except (TypeError, json.JSONDecodeError):
                messages = []
            updated_at = trim_text(row['updated_at'] or '', 40)
            if not saved_at and updated_at:
                saved_at = updated_at
            sessions[str(row['session_id'])] = {
                'id': str(row['session_id'] or ''),
                'dealId': trim_text(row['scope_id'] or '', 120),
                'userId': trim_text(row['user_id'] or '', 120),
                'userName': trim_text(row['user_name'] or '', 120),
                'updatedAt': updated_at,
                'messageCount': max(0, int(row['message_count'] or 0)),
                'messages': messages if isinstance(messages, list) else [],
            }
        return {'savedAt': saved_at, 'sessions': sessions}

    def write_state(self, state: dict[str, Any]) -> None:
        if self.storage_backend != 'sqlite':
            self._write_file_state(state)
            return

        sessions = state.get('sessions') if isinstance(state.get('sessions'), dict) else {}
        with self._connect_sqlite() as connection:
            keep_ids: list[str] = []
            for key, stored in sessions.items():
                if not isinstance(stored, dict):
                    continue
                session_id = trim_text(stored.get('id') or key or '', 255)
                scope_id = trim_text(stored.get('dealId') or '', 120)
                user_id = trim_text(stored.get('userId') or '', 120)
                if not session_id or not scope_id or not user_id:
                    continue
                keep_ids.append(session_id)
                messages = stored.get('messages') if isinstance(stored.get('messages'), list) else []
                updated_at = trim_text(stored.get('updatedAt') or '', 40)
                connection.execute(
                    '''
                    INSERT INTO copilot_sessions (
                        session_id, scope_id, user_id, user_name, updated_at, message_count, messages_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(session_id) DO UPDATE SET
                        scope_id = excluded.scope_id,
                        user_id = excluded.user_id,
                        user_name = excluded.user_name,
                        updated_at = excluded.updated_at,
                        message_count = excluded.message_count,
                        messages_json = excluded.messages_json
                    ''',
                    (
                        session_id,
                        scope_id,
                        user_id,
                        trim_text(stored.get('userName') or '', 120),
                        updated_at,
                        max(0, int(stored.get('messageCount') or len(messages))),
                        json.dumps(messages, ensure_ascii=False),
                        updated_at or trim_text(state.get('savedAt') or utc_now_iso(), 40),
                    ),
                )
            if keep_ids:
                placeholders = ', '.join(['?'] * len(keep_ids))
                connection.execute(
                    f'DELETE FROM copilot_sessions WHERE session_id NOT IN ({placeholders})',
                    keep_ids,
                )
            else:
                connection.execute('DELETE FROM copilot_sessions')

    def get_session(self, deal_id: str, user: User) -> dict[str, Any]:
        key = session_key(deal_id, user.id)
        with self._lock:
            if self.storage_backend != 'sqlite':
                state = self.load_state()
                stored = state['sessions'].get(key)
                if not isinstance(stored, dict):
                    return self.default_session(deal_id, user)
                session = self.default_session(deal_id, user)
                session.update({
                    'updatedAt': trim_text(stored.get('updatedAt') or '', 40),
                    'messageCount': max(0, int(stored.get('messageCount') or 0)),
                    'messages': stored.get('messages') if isinstance(stored.get('messages'), list) else [],
                })
                return deepcopy(session)

            try:
                with self._connect_sqlite() as connection:
                    row = connection.execute(
                        'SELECT user_name, updated_at, message_count, messages_json FROM copilot_sessions WHERE session_id = ?',
                        (key,),
                    ).fetchone()
            except sqlite3.Error:
                row = None
            if row is None:
                return self.default_session(deal_id, user)
            try:
                messages = json.loads(row['messages_json'] or '[]')
            except (TypeError, json.JSONDecodeError):
                messages = []
            session = self.default_session(deal_id, user)
            session.update({
                'userName': trim_text(row['user_name'] or user.name or '', 120),
                'updatedAt': trim_text(row['updated_at'] or '', 40),
                'messageCount': max(0, int(row['message_count'] or 0)),
                'messages': messages if isinstance(messages, list) else [],
            })
            return deepcopy(session)

    def save_session(self, deal_id: str, user: User, session: dict[str, Any]) -> dict[str, Any]:
        key = session_key(deal_id, user.id)
        with self._lock:
            next_session = self.default_session(deal_id, user)
            next_session.update({
                'updatedAt': trim_text(session.get('updatedAt') or '', 40),
                'messageCount': max(0, int(session.get('messageCount') or 0)),
                'messages': session.get('messages') if isinstance(session.get('messages'), list) else [],
            })
            if self.storage_backend != 'sqlite':
                state = self.load_state()
                state['sessions'][key] = next_session
                state['savedAt'] = next_session['updatedAt']
                self.write_state(state)
                return deepcopy(next_session)

            try:
                with self._connect_sqlite() as connection:
                    connection.execute(
                        '''
                        INSERT INTO copilot_sessions (
                            session_id, scope_id, user_id, user_name, updated_at, message_count, messages_json, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(session_id) DO UPDATE SET
                            scope_id = excluded.scope_id,
                            user_id = excluded.user_id,
                            user_name = excluded.user_name,
                            updated_at = excluded.updated_at,
                            message_count = excluded.message_count,
                            messages_json = excluded.messages_json
                        ''',
                        (
                            key,
                            trim_text(deal_id or '', 120),
                            trim_text(user.id or '', 120),
                            trim_text(user.name or '', 120),
                            next_session['updatedAt'],
                            next_session['messageCount'],
                            json.dumps(next_session['messages'], ensure_ascii=False),
                            next_session['updatedAt'] or utc_now_iso(),
                        ),
                    )
            except sqlite3.Error:
                pass
            return deepcopy(next_session)

    def clear_session(self, deal_id: str, user: User) -> dict[str, Any]:
        session = self.default_session(deal_id, user)
        with self._lock:
            if self.storage_backend != 'sqlite':
                state = self.load_state()
                state['sessions'][session_key(deal_id, user.id)] = session
                state['savedAt'] = ''
                self.write_state(state)
                return deepcopy(session)

            try:
                with self._connect_sqlite() as connection:
                    connection.execute(
                        '''
                        INSERT INTO copilot_sessions (
                            session_id, scope_id, user_id, user_name, updated_at, message_count, messages_json, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(session_id) DO UPDATE SET
                            scope_id = excluded.scope_id,
                            user_id = excluded.user_id,
                            user_name = excluded.user_name,
                            updated_at = excluded.updated_at,
                            message_count = excluded.message_count,
                            messages_json = excluded.messages_json
                        ''',
                        (
                            session['id'],
                            session['dealId'],
                            session['userId'],
                            session['userName'],
                            '',
                            0,
                            '[]',
                            utc_now_iso(),
                        ),
                    )
            except sqlite3.Error:
                pass
        return deepcopy(session)


class PortalCopilotService:
    def __init__(self) -> None:
        self.model = OPENAI_PORTAL_COPILOT_MODEL
        self.max_output_tokens = OPENAI_PORTAL_COPILOT_MAX_OUTPUT_TOKENS
        self.openai_sdk_available = BaseOpenAI is not None
        self.client = BaseOpenAI(api_key=OPENAI_API_KEY, base_url="https://api.openai.com/v1", timeout=90, max_retries=1, http_client=DefaultHttpxClient(verify=ssl.create_default_context())) if OPENAI_API_KEY and self.openai_sdk_available else None

    def ask(self, *, deal_payload: dict[str, Any], current_user: User, question: str, session: dict[str, Any] | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
        if self.client is None:
            reason = 'OpenAI SDK is not installed in the backend environment.' if not self.openai_sdk_available else 'OPENAI_API_KEY is not configured in backend/.env.'
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f'Portal copilot is unavailable. {reason}')

        safe_question = trim_text(question or '', 4000)
        if not safe_question:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Type a copilot question first.')

        knowledge.sync_portal(deal_payload)
        context_fingerprint = context_key([deal_payload], knowledge.active_documents([deal_payload]))
        active_session = scoped_session(session, context_fingerprint)
        history = active_session.get('messages') if isinstance(active_session.get('messages'), list) else []
        recent_history = history[-MAX_HISTORY_FOR_PROMPT:]
        transcript_lines = []
        for message in recent_history:
            if not isinstance(message, dict):
                continue
            role = trim_text(message.get('role') or 'user', 20).upper()
            content = trim_text(message.get('content') or '', 1200)
            if content:
                transcript_lines.append(f'{role}: {content}')
        transcript = '\n'.join(transcript_lines) if transcript_lines else 'No previous conversation in this copilot session.'

        intake = deal_payload.get('documentIntake') if isinstance(deal_payload.get('documentIntake'), dict) else {}
        catalog = load_portal_field_catalog()
        selected_catalog = select_catalog(safe_question, catalog)
        review_fields = build_review_fields(safe_question, intake)
        document_context = knowledge.search(safe_question, [deal_payload])
        deal_snapshot = build_deal_snapshot(safe_question, deal_payload)
        saved_data = saved_context([deal_payload], selected_catalog)
        deal_snapshot['savedFinance'] = saved_data

        content = [
            {
                'type': 'input_text',
                'text': (
                    'You are HCLTech Portal Copilot, an experimental in-portal analyst assistant. '
                    'You are bounded to this portal, the current deal, the extracted review queue, and the uploaded deal documents. '
                    'Do not invent evidence. If the answer is not supported by the supplied context, say that clearly and ask for the missing document or field. '
                    'For portal behavior, rely on the provided field catalog and deal snapshot only. '
                    'When you suggest portal fields, keep them review-safe and only when they are directly evidenced or safely derived from explicit content already present in the provided context.'
                ),
            },
            {'type': 'input_text', 'text': 'User question:\n' + safe_question},
            {'type': 'input_text', 'text': 'Recent conversation transcript:\n' + transcript},
            {'type': 'input_text', 'text': 'Portal section inventory:\n' + '\n'.join(portal_inventory(catalog))},
            {'type': 'input_text', 'text': 'Relevant portal field definitions:\n' + build_portal_catalog_prompt(selected_catalog)},
            {'type': 'input_text', 'text': 'Current deal snapshot JSON:\n' + json.dumps(deal_snapshot, indent=2)},
            {'type': 'input_text', 'text': 'Relevant extracted review fields JSON:\n' + json.dumps(review_fields, indent=2)},
            {'type': 'input_text', 'text': 'Relevant uploaded document context JSON:\n' + json.dumps(document_context, indent=2)},
            {
                'type': 'input_text',
                'text': (
                    'Return only JSON matching the schema. sourceRefs must reference only the supplied document chunks, extracted evidence, saved finance facts, or computed aggregates. '
                    'If there is no direct source, return an empty sourceRefs array and explain the limitation in answer. '
                    'suggestedFields must use exact portal target paths from the provided field definitions.'
                ),
            },
        ]

        with start_observation(
            name='portal-copilot.chat',
            as_type='generation',
            model=self.model,
            input={
                'dealId': trim_text(deal_payload.get('id') or '', 120),
                'questionChars': len(safe_question),
                'historyMessagesUsed': len(recent_history),
                'documentCount': len(intake.get('documents') or []),
            },
            metadata={
                'agentName': PORTAL_COPILOT_AGENT_NAME,
                'configuredModel': self.model,
                'userId': current_user.id,
                'catalogEntriesUsed': len(selected_catalog),
            },
        ) as generation:
            try:
                response = self.client.responses.create(
                    model=self.model,
                    instructions=GROUNDING_INSTRUCTIONS,
                    store=False,
                    input=[{'role': 'user', 'content': content}],
                    max_output_tokens=self.max_output_tokens,
                    text={
                        'format': {
                            'type': 'json_schema',
                            'name': 'portal_copilot_response',
                            'description': 'Portal bounded copilot answer with evidence and optional field suggestions.',
                            'strict': True,
                            'schema': PORTAL_COPILOT_RESPONSE_SCHEMA,
                        },
                    },
                )
                output_text = extract_output_text(response)
                payload = json.loads(output_text) if output_text else None
                reply = validate_reply_sources(normalize_reply(payload, catalog),
                    document_context['chunks'] + saved_data['facts'] + saved_data['computedAggregates'] + review_fields)
                reply['retrievalWarnings'] = document_context['warnings']
                update_observation(generation, output={
                    'answerChars': len(reply['answer'] or ''),
                    'sourceRefCount': len(reply['sourceRefs']),
                    'suggestedFieldCount': len(reply['suggestedFields']),
                    'confidence': reply['confidence'],
                })
            except Exception as error:
                update_observation(generation, level='ERROR', status_message=trim_text(str(error), 280))
                raise

        created_at = utc_now_iso()
        next_messages = [
            *history,
            {'id': f'msg-{created_at}-user', 'role': 'user', 'content': safe_question, 'createdAt': created_at, 'sourceRefs': [], 'suggestedFields': [], 'openQuestions': [], 'nextActions': [], 'confidence': '', 'answerType': ''},
            {'id': f'msg-{created_at}-assistant', 'role': 'assistant', 'content': reply['answer'], 'createdAt': created_at, 'sourceRefs': reply['sourceRefs'], 'suggestedFields': reply['suggestedFields'], 'openQuestions': reply['openQuestions'], 'nextActions': reply['nextActions'], 'confidence': reply['confidence'], 'answerType': reply['answerType']},
        ][-MAX_HISTORY_MESSAGES:]
        for message in next_messages:
            message['contextKey'] = context_fingerprint
        next_session = {
            **active_session,
            'updatedAt': created_at,
            'messageCount': len(next_messages),
            'messages': next_messages,
        }
        return reply, next_session

    def ask_portfolio(self, *, deal_payloads: list[dict[str, Any]], current_user: User, question: str, session: dict[str, Any] | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
        if self.client is None:
            reason = 'OpenAI SDK is not installed in the backend environment.' if not self.openai_sdk_available else 'OPENAI_API_KEY is not configured in backend/.env.'
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f'Portal copilot is unavailable. {reason}')

        safe_question = trim_text(question or '', 4000)
        if not safe_question:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Type a copilot question first.')

        for accessible_deal in deal_payloads:
            knowledge.sync_portal(accessible_deal)
        context_fingerprint = context_key(deal_payloads, knowledge.active_documents(deal_payloads))
        active_session = scoped_session(session, context_fingerprint)
        history = active_session.get('messages') if isinstance(active_session.get('messages'), list) else []
        recent_history = history[-MAX_HISTORY_FOR_PROMPT:]
        transcript_lines = []
        for message in recent_history:
            if not isinstance(message, dict):
                continue
            role = trim_text(message.get('role') or 'user', 20).upper()
            content = trim_text(message.get('content') or '', 1200)
            if content:
                transcript_lines.append(f'{role}: {content}')
        transcript = '\n'.join(transcript_lines) if transcript_lines else 'No previous conversation in this copilot session.'

        catalog = load_portal_field_catalog()
        selected_catalog = select_catalog(safe_question, catalog)
        review_fields = build_portfolio_review_fields(safe_question, deal_payloads)
        document_context = knowledge.search(safe_question, deal_payloads)
        portfolio_snapshot = build_portfolio_snapshot(safe_question, deal_payloads, current_user)
        saved_data = saved_context(deal_payloads, selected_catalog)
        portfolio_snapshot['savedFinance'] = saved_data

        content = [
            {
                'type': 'input_text',
                'text': (
                    'You are HCLTech Portal Copilot, an experimental in-portal analyst assistant. '
                    'You are bounded to the All Deals page, the user\'s accessible deal portfolio, extracted review queues, and uploaded deal documents across those deals. '
                    'Do not invent evidence. If the answer is not supported by the supplied context, say that clearly and ask for the missing document or field. '
                    'For portal behavior, rely on the provided field catalog and portfolio snapshot only. '
                    'When you mention a specific deal, use its visible deal label or client name. '
                    'When you suggest portal fields, keep them review-safe and only when they are directly evidenced or safely derived from explicit content already present in the provided context.'
                ),
            },
            {'type': 'input_text', 'text': 'User question:\n' + safe_question},
            {'type': 'input_text', 'text': 'Recent conversation transcript:\n' + transcript},
            {'type': 'input_text', 'text': 'Portal section inventory:\n' + '\n'.join(portal_inventory(catalog))},
            {'type': 'input_text', 'text': 'Relevant portal field definitions:\n' + build_portal_catalog_prompt(selected_catalog)},
            {'type': 'input_text', 'text': 'Accessible deal portfolio snapshot JSON:\n' + json.dumps(portfolio_snapshot, indent=2)},
            {'type': 'input_text', 'text': 'Relevant extracted review fields across deals JSON:\n' + json.dumps(review_fields, indent=2)},
            {'type': 'input_text', 'text': 'Relevant uploaded document context across deals JSON:\n' + json.dumps(document_context, indent=2)},
            {
                'type': 'input_text',
                'text': (
                    'Return only JSON matching the schema. sourceRefs must reference only the supplied document chunks, extracted evidence, saved finance facts, or computed aggregates. '
                    'If there is no direct source, return an empty sourceRefs array and explain the limitation in answer. '
                    'suggestedFields must use exact portal target paths from the provided field definitions.'
                ),
            },
        ]

        visible_deals = [deal_payload for deal_payload in deal_payloads if isinstance(deal_payload, dict)]
        document_total = sum(
            len((deal_payload.get('documentIntake') or {}).get('documents') or [])
            for deal_payload in visible_deals
            if isinstance(deal_payload.get('documentIntake'), dict)
        )

        with start_observation(
            name='portal-copilot.portfolio.chat',
            as_type='generation',
            model=self.model,
            input={
                'scope': PORTAL_COPILOT_PORTFOLIO_SCOPE_ID,
                'questionChars': len(safe_question),
                'historyMessagesUsed': len(recent_history),
                'visibleDealCount': len(visible_deals),
                'documentCount': document_total,
            },
            metadata={
                'agentName': PORTAL_COPILOT_AGENT_NAME,
                'configuredModel': self.model,
                'userId': current_user.id,
                'catalogEntriesUsed': len(selected_catalog),
            },
        ) as generation:
            try:
                response = self.client.responses.create(
                    model=self.model,
                    instructions=GROUNDING_INSTRUCTIONS,
                    store=False,
                    input=[{'role': 'user', 'content': content}],
                    max_output_tokens=self.max_output_tokens,
                    text={
                        'format': {
                            'type': 'json_schema',
                            'name': 'portal_copilot_response',
                            'description': 'Portfolio-wide portal bounded copilot answer with evidence and optional field suggestions.',
                            'strict': True,
                            'schema': PORTAL_COPILOT_RESPONSE_SCHEMA,
                        },
                    },
                )
                output_text = extract_output_text(response)
                payload = json.loads(output_text) if output_text else None
                reply = validate_reply_sources(normalize_reply(payload, catalog),
                    document_context['chunks'] + saved_data['facts'] + saved_data['computedAggregates'] + review_fields)
                reply['retrievalWarnings'] = document_context['warnings']
                update_observation(generation, output={
                    'answerChars': len(reply['answer'] or ''),
                    'sourceRefCount': len(reply['sourceRefs']),
                    'suggestedFieldCount': len(reply['suggestedFields']),
                    'confidence': reply['confidence'],
                })
            except Exception as error:
                update_observation(generation, level='ERROR', status_message=trim_text(str(error), 280))
                raise

        created_at = utc_now_iso()
        next_messages = [
            *history,
            {'id': f'msg-{created_at}-user', 'role': 'user', 'content': safe_question, 'createdAt': created_at, 'sourceRefs': [], 'suggestedFields': [], 'openQuestions': [], 'nextActions': [], 'confidence': '', 'answerType': ''},
            {'id': f'msg-{created_at}-assistant', 'role': 'assistant', 'content': reply['answer'], 'createdAt': created_at, 'sourceRefs': reply['sourceRefs'], 'suggestedFields': reply['suggestedFields'], 'openQuestions': reply['openQuestions'], 'nextActions': reply['nextActions'], 'confidence': reply['confidence'], 'answerType': reply['answerType']},
        ][-MAX_HISTORY_MESSAGES:]
        for message in next_messages:
            message['contextKey'] = context_fingerprint
        next_session = {
            **active_session,
            'updatedAt': created_at,
            'messageCount': len(next_messages),
            'messages': next_messages,
        }
        return reply, next_session
