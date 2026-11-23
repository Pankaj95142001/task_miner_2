from __future__ import annotations

import hashlib
import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..config import KNOWLEDGE_IMPORT_MAX_BYTES
from ..models import User
from ..services.document_knowledge import digest, knowledge, validate_extraction
from ..storage import JsonDealStore
from .dependencies import get_current_user, get_store

router = APIRouter(prefix='/deals', tags=['Document knowledge'])


def require_owner(deal, user):
    if deal.dealOwnerUserId != user.id:
        raise HTTPException(403, 'Only the deal owner can change document knowledge.')


def read_upload(upload):
    value = upload.file.read(KNOWLEDGE_IMPORT_MAX_BYTES + 1)
    if len(value) > KNOWLEDGE_IMPORT_MAX_BYTES:
        raise HTTPException(413, f'File exceeds the {KNOWLEDGE_IMPORT_MAX_BYTES // (1024 * 1024)} MB import limit.')
    return value


@router.get('/{deal_id}/knowledge')
def get_knowledge(deal_id: str, store: JsonDealStore = Depends(get_store), current_user: User = Depends(get_current_user)):
    return knowledge.status(store.get_deal(current_user.id, deal_id).model_dump())


@router.post('/{deal_id}/knowledge/import')
def import_extraction(deal_id: str, extraction: UploadFile = File(...), original: UploadFile | None = File(None),
                      replace_document_id: str = Form(''), store: JsonDealStore = Depends(get_store), current_user: User = Depends(get_current_user)):
    deal = store.get_deal(current_user.id, deal_id)
    require_owner(deal, current_user)
    try:
        data = validate_extraction(json.loads(read_upload(extraction).decode('utf-8-sig')))
    except (UnicodeError, ValueError, RecursionError) as error:
        raise HTTPException(422, 'Invalid extraction JSON. Use a document JSON exported by document-extractor with readable blocks.') from error
    original_bytes = read_upload(original) if original else None
    if original_bytes is not None:
        if not data.get('sha256') or hashlib.sha256(original_bytes).hexdigest() != data['sha256']:
            raise HTTPException(422, 'The original file SHA-256 does not match the extraction JSON.')
    document_id = 'import-' + digest([data.get('document_id'), data['file_name']])[:32]
    if replace_document_id:
        match = next((r for r in knowledge.active_documents([deal.model_dump()]) if r['document_id'] == replace_document_id and r['origin'] == 'extractor'), None)
        if match is None:
            raise HTTPException(404, 'Imported document to replace was not found in this deal.')
        document_id = replace_document_id
    result = knowledge.index(deal_id, document_id, data, original=original_bytes)
    return {'document': result, **knowledge.status(deal.model_dump())}


@router.post('/{deal_id}/knowledge/reindex')
def reindex(deal_id: str, store: JsonDealStore = Depends(get_store), current_user: User = Depends(get_current_user)):
    deal = store.get_deal(current_user.id, deal_id)
    require_owner(deal, current_user)
    knowledge.sync_portal(deal.model_dump(), force=True)
    return knowledge.status(deal.model_dump())


@router.delete('/{deal_id}/knowledge/{document_id}')
def delete_import(deal_id: str, document_id: str, store: JsonDealStore = Depends(get_store), current_user: User = Depends(get_current_user)):
    deal = store.get_deal(current_user.id, deal_id)
    require_owner(deal, current_user)
    if not any(r['document_id'] == document_id and r['origin'] == 'extractor' for r in knowledge.active_documents([deal.model_dump()])):
        raise HTTPException(404, 'Imported document not found. Remove portal uploads through the document panel.')
    knowledge.delete(deal_id, document_id)
    return knowledge.status(deal.model_dump())


@router.get('/{deal_id}/knowledge/{document_id}/{artifact_kind}')
def download_artifact(deal_id: str, document_id: str, artifact_kind: str, store: JsonDealStore = Depends(get_store), current_user: User = Depends(get_current_user)):
    deal = store.get_deal(current_user.id, deal_id)
    row = next((r for r in knowledge.active_documents([deal.model_dump()]) if r['document_id'] == document_id), None)
    if row is None or artifact_kind not in {'extraction', 'original'}:
        raise HTTPException(404, 'Artifact not found.')
    value = row['artifact_path'] if artifact_kind == 'extraction' else row['original_path']
    path = Path(value).resolve() if value else None
    if path is None or not path.is_relative_to(knowledge.files_dir.resolve()) or not path.is_file():
        raise HTTPException(404, 'Artifact not found. An original is available only when uploaded with the extraction.')
    return FileResponse(path, media_type='application/json' if artifact_kind == 'extraction' else 'application/octet-stream',
                        filename='extraction.json' if artifact_kind == 'extraction' else Path(row['file_name']).name)
