from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request, status

from ..models import User
from ..storage import JsonDealStore


def get_store(request: Request) -> JsonDealStore:
    return request.app.state.deal_store


def get_current_user(
    x_user_id: str | None = Header(None, alias='X-User-Id'),
    store: JsonDealStore = Depends(get_store),
) -> User:
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Sign in required.',
        )
    return store.get_user(x_user_id)
