from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / 'backend'
sys.path.insert(0, str(BACKEND_DIR.resolve()))

from app.config import AUTH_FILE, DATABASE_FILE, DEALS_FILE, PORTAL_COPILOT_SESSIONS_FILE, SQLITE_STORAGE_PATH, USERS_FILE
from app.services.portal_copilot import PortalCopilotSessionStore
from app.sqlite_store import SqliteDealStore


def main() -> None:
    store = SqliteDealStore(
        SQLITE_STORAGE_PATH,
        DEALS_FILE,
        USERS_FILE,
        AUTH_FILE,
        legacy_database_path=DATABASE_FILE,
    )
    store.bootstrap()
    PortalCopilotSessionStore(
        file_path=PORTAL_COPILOT_SESSIONS_FILE,
        database_path=SQLITE_STORAGE_PATH,
        storage_backend='sqlite',
    )

    with sqlite3.connect(SQLITE_STORAGE_PATH) as connection:
        tables = [
            'users',
            'auth_credentials',
            'workspace_state',
            'user_preferences',
            'deals',
            'deal_collaborators',
            'deal_sections',
            'copilot_sessions',
        ]
        print(f'SQLite database: {SQLITE_STORAGE_PATH}')
        for table in tables:
            count = connection.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            print(f'{table}: {count}')


if __name__ == '__main__':
    main()
