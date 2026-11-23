from __future__ import annotations

from fastapi import APIRouter, Depends

from ..models import MeSummary, User
from ..storage import JsonDealStore
from .dependencies import get_current_user, get_store

router = APIRouter(tags=['Users'])


@router.get('/users', response_model=list[User])
def list_users(store: JsonDealStore = Depends(get_store)) -> list[User]:
    return store.list_users()


@router.get('/me', response_model=MeSummary)
def get_me(
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> MeSummary:
    return store.get_me_summary(current_user.id)
