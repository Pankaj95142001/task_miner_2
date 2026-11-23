from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.auth import router as auth_router
from .api.copilot import router as copilot_router
from .api.deals import router as deals_router
from .api.documents import router as documents_router
from .api.knowledge import router as knowledge_router
from .api.fpa import router as fpa_router
from .api.p2p import router as p2p_router
from .api.users import router as users_router
from .config import (
    ALLOW_CREDENTIALS,
    API_PREFIX,
    APP_NAME,
    APP_VERSION,
    AUTH_FILE,
    CORS_ORIGINS,
    DATABASE_FILE,
    DEALS_FILE,
    SQLITE_STORAGE_PATH,
    STORAGE_BACKEND,
    USERS_FILE,
)
from .sqlite_store import SqliteDealStore
from .storage import JsonDealStore


def create_app() -> FastAPI:
    app = FastAPI(title=APP_NAME, version=APP_VERSION)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=ALLOW_CREDENTIALS,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    if STORAGE_BACKEND == 'json':
        store = JsonDealStore(DEALS_FILE, USERS_FILE, AUTH_FILE, legacy_database_path=DATABASE_FILE)
    elif STORAGE_BACKEND == 'sqlite':
        store = SqliteDealStore(
            SQLITE_STORAGE_PATH,
            DEALS_FILE,
            USERS_FILE,
            AUTH_FILE,
            legacy_database_path=DATABASE_FILE,
        )
    else:
        raise RuntimeError(f'Unsupported storage backend: {STORAGE_BACKEND}')
    store.bootstrap()
    app.state.deal_store = store

    @app.get('/health', tags=['System'])
    def health() -> dict[str, str]:
        return {'status': 'ok', 'service': 'deal-master-api'}

    app.include_router(auth_router, prefix=API_PREFIX)
    app.include_router(copilot_router, prefix=API_PREFIX)
    app.include_router(deals_router, prefix=API_PREFIX)
    app.include_router(documents_router, prefix=API_PREFIX)
    app.include_router(knowledge_router, prefix=API_PREFIX)
    app.include_router(fpa_router, prefix=API_PREFIX)
    app.include_router(p2p_router, prefix=API_PREFIX)
    app.include_router(users_router, prefix=API_PREFIX)
    return app


app = create_app()


