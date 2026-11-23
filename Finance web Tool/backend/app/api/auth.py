from __future__ import annotations

from fastapi import APIRouter, Depends, status

from ..models import LoginRequest, SignupRequest, User
from ..storage import JsonDealStore
from .dependencies import get_store

router = APIRouter(prefix='/auth', tags=['Auth'])


@router.post('/signup', response_model=User, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, store: JsonDealStore = Depends(get_store)) -> User:
    return store.register_user(payload.name, payload.role, payload.email, payload.password)


@router.post('/login', response_model=User)
def login(payload: LoginRequest, store: JsonDealStore = Depends(get_store)) -> User:
    return store.login(payload.email, payload.password)
