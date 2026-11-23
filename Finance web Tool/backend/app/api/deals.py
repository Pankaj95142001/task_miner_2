from __future__ import annotations

from fastapi import APIRouter, Depends, status

from ..models import Deal, DealCollection, DealPayload, User
from ..storage import JsonDealStore
from ..services.document_knowledge import knowledge
from .dependencies import get_current_user, get_store

router = APIRouter(prefix='/deals', tags=['Deal Master'])


@router.get('', response_model=DealCollection)
def list_deals(
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> DealCollection:
    return store.list_deals(current_user.id)


@router.post('', response_model=Deal, status_code=status.HTTP_201_CREATED)
def create_deal(
    payload: DealPayload,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> Deal:
    return store.create_deal(current_user.id, payload)


@router.post('/current/{deal_id}', response_model=DealCollection)
def set_current_deal(
    deal_id: str,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> DealCollection:
    return store.set_current_deal(current_user.id, deal_id)


@router.post('/{deal_id}/duplicate', response_model=Deal, status_code=status.HTTP_201_CREATED)
def duplicate_deal(
    deal_id: str,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> Deal:
    return store.duplicate_deal(current_user.id, deal_id)


@router.get('/{deal_id}', response_model=Deal)
def get_deal(
    deal_id: str,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> Deal:
    return store.get_deal(current_user.id, deal_id)


@router.put('/{deal_id}', response_model=Deal)
def update_deal(
    deal_id: str,
    payload: DealPayload,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> Deal:
    return store.update_deal(current_user.id, deal_id, payload)


@router.delete('/{deal_id}', response_model=DealCollection)
def delete_deal(
    deal_id: str,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> DealCollection:
    collection = store.delete_deal(current_user.id, deal_id)
    knowledge.delete(deal_id)
    return collection
