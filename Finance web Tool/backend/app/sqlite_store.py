from __future__ import annotations

import json
import sqlite3
from copy import deepcopy
from contextlib import contextmanager
from pathlib import Path

from .models import User
from .storage import (
    DEAL_BOOL_FIELDS,
    DEAL_CORE_FIELD_TO_COLUMN,
    DEAL_INT_FIELDS,
    DEFAULT_USERS,
    JsonDealStore,
    WORKSPACE_SCOPE,
    utc_now_iso,
)


DEAL_CORE_KEYS = [key for key in DEAL_CORE_FIELD_TO_COLUMN if key != 'id']
DEAL_DB_COLUMNS = [DEAL_CORE_FIELD_TO_COLUMN[key] for key in DEAL_CORE_KEYS]
DEAL_UPSERT_COLUMNS = [column for column in DEAL_DB_COLUMNS if column != 'created_at'] + ['extra_scalars_json']


class SqliteDealStore(JsonDealStore):
    def __init__(
        self,
        database_path: Path,
        deals_file_path: Path,
        users_file_path: Path,
        auth_file_path: Path,
        legacy_database_path: Path | None = None,
    ) -> None:
        super().__init__(deals_file_path, users_file_path, auth_file_path, legacy_database_path=legacy_database_path)
        self.database_path = database_path

    def bootstrap(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.deals_file_path.parent.mkdir(parents=True, exist_ok=True)
        self.users_file_path.parent.mkdir(parents=True, exist_ok=True)
        self.auth_file_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

        with self._lock:
            users = self._load_users()
            if not users:
                imported_users: list[User] = []
                raw_users = self._read_json(self.users_file_path, [])
                if isinstance(raw_users, list):
                    for item in raw_users:
                        if not isinstance(item, dict):
                            continue
                        try:
                            imported_users.append(User(**item))
                        except Exception:
                            continue
                users = imported_users or [User(**item) for item in DEFAULT_USERS]
                self._write_users(users)

            auth_records = self._load_auth_records()
            if not auth_records:
                raw_auth = self._read_json(self.auth_file_path, {})
                if isinstance(raw_auth, dict):
                    auth_records = {
                        str(user_id): str(password_hash)
                        for user_id, password_hash in raw_auth.items()
                        if str(user_id).strip()
                    }
                self._write_auth_records(auth_records)

            workspace = self._load_workspace(users)
            if not workspace.get('deals'):
                imported_workspace: dict | None = None
                raw_workspace = self._read_json(self.deals_file_path, None)
                if isinstance(raw_workspace, dict):
                    imported_workspace = self._normalize_workspace(raw_workspace, users)

                if imported_workspace is None or not imported_workspace.get('deals'):
                    legacy_workspace = self._import_legacy_database()
                    if legacy_workspace is not None:
                        imported_workspace = self._normalize_workspace(legacy_workspace, users)

                if imported_workspace is not None:
                    workspace = imported_workspace

            self._write_workspace(workspace)

    @contextmanager
    def _connect(self):
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys = ON')
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _ensure_schema(self) -> None:
        with self._connect() as connection:
            connection.execute('PRAGMA journal_mode = WAL')
            connection.execute('PRAGMA synchronous = NORMAL')
            connection.executescript(
                '''
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    email TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(email)
                );

                CREATE TABLE IF NOT EXISTS auth_credentials (
                    user_id TEXT PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS workspace_state (
                    scope TEXT PRIMARY KEY,
                    saved_at TEXT NOT NULL,
                    current_id TEXT
                );

                CREATE TABLE IF NOT EXISTS user_preferences (
                    scope TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    current_deal_id TEXT,
                    recent_deal_ids_json TEXT NOT NULL DEFAULT '[]',
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (scope, user_id),
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS deals (
                    id TEXT PRIMARY KEY,
                    draft_label TEXT,
                    client_name TEXT,
                    deal_code TEXT,
                    program_name TEXT,
                    presales_lead TEXT,
                    bid_date TEXT,
                    deal_status TEXT,
                    watermark TEXT,
                    contract_term TEXT,
                    discount_rate TEXT,
                    corporate_overhead TEXT,
                    display_currency TEXT,
                    fx_rate TEXT,
                    customer_finance_fte TEXT,
                    finance_cost_baseline TEXT,
                    pricing_construct TEXT,
                    transition_commercials TEXT,
                    transformation_funding TEXT,
                    benchmark_policy TEXT,
                    committed_prod_y2 TEXT,
                    committed_prod_y3 TEXT,
                    committed_prod_y4 TEXT,
                    notes_tag TEXT,
                    review_notes TEXT,
                    canonical_schema_ref TEXT,
                    deal_owner_user_id TEXT,
                    deal_owner_name TEXT,
                    tower_scope_fpa INTEGER,
                    tower_scope_rtr INTEGER,
                    tower_scope_o2c INTEGER,
                    tower_scope_p2p INTEGER,
                    tower_lead_fpa TEXT,
                    tower_lead_rtr TEXT,
                    tower_lead_o2c TEXT,
                    tower_lead_p2p TEXT,
                    tower_owner_user_id_fpa TEXT,
                    tower_owner_user_id_rtr TEXT,
                    tower_owner_user_id_o2c TEXT,
                    tower_owner_user_id_p2p TEXT,
                    tower_status_fpa TEXT,
                    tower_status_rtr TEXT,
                    tower_status_o2c TEXT,
                    tower_status_p2p TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    extra_scalars_json TEXT NOT NULL DEFAULT '{}'
                );

                CREATE TABLE IF NOT EXISTS deal_collaborators (
                    deal_id TEXT NOT NULL,
                    collaborator_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    tower_code TEXT NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (deal_id, collaborator_id),
                    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS deal_sections (
                    deal_id TEXT NOT NULL,
                    section_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (deal_id, section_key),
                    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
                );

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

                CREATE INDEX IF NOT EXISTS idx_deals_updated_at ON deals(updated_at DESC, created_at DESC, id DESC);
                CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(deal_owner_user_id);
                CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_name);
                CREATE INDEX IF NOT EXISTS idx_deal_sections_deal ON deal_sections(deal_id);
                CREATE INDEX IF NOT EXISTS idx_deal_collaborators_deal ON deal_collaborators(deal_id, sort_order);
                CREATE INDEX IF NOT EXISTS idx_copilot_sessions_scope_user ON copilot_sessions(scope_id, user_id);
                CREATE INDEX IF NOT EXISTS idx_copilot_sessions_user_updated ON copilot_sessions(user_id, updated_at DESC);
                '''
            )

    def _load_users(self) -> list[User]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    'SELECT user_id, name, role, email FROM users ORDER BY user_id ASC'
                ).fetchall()
        except sqlite3.Error:
            return []

        users: list[User] = []
        for row in rows:
            try:
                users.append(
                    User(
                        id=str(row['user_id'] or ''),
                        name=str(row['name'] or ''),
                        role=str(row['role'] or ''),
                        email=str(row['email'] or ''),
                    )
                )
            except Exception:
                continue
        return users

    def _load_workspace(self, users: list[User]) -> dict:
        raw_workspace = {
            'savedAt': utc_now_iso(),
            'currentId': None,
            'currentByUser': {},
            'recentByUser': {},
            'deals': [],
        }

        try:
            with self._connect() as connection:
                workspace_row = connection.execute(
                    'SELECT saved_at, current_id FROM workspace_state WHERE scope = ?',
                    (WORKSPACE_SCOPE,),
                ).fetchone()
                if workspace_row is not None:
                    raw_workspace['savedAt'] = str(workspace_row['saved_at'] or utc_now_iso())
                    raw_workspace['currentId'] = str(workspace_row['current_id']) if workspace_row['current_id'] else None

                preference_rows = connection.execute(
                    'SELECT user_id, current_deal_id, recent_deal_ids_json FROM user_preferences WHERE scope = ?',
                    (WORKSPACE_SCOPE,),
                ).fetchall()
                for row in preference_rows:
                    user_id = str(row['user_id'] or '').strip()
                    if not user_id:
                        continue
                    if row['current_deal_id']:
                        raw_workspace['currentByUser'][user_id] = str(row['current_deal_id'])
                    try:
                        recent_ids = json.loads(row['recent_deal_ids_json'] or '[]')
                    except (TypeError, json.JSONDecodeError):
                        recent_ids = []
                    if isinstance(recent_ids, list):
                        raw_workspace['recentByUser'][user_id] = [
                            str(item) for item in recent_ids if str(item).strip()
                        ]

                deal_rows = connection.execute(
                    'SELECT * FROM deals ORDER BY updated_at DESC, created_at DESC, id DESC'
                ).fetchall()
                deal_ids = [str(row['id']) for row in deal_rows if row['id']]

                collaborators_by_deal: dict[str, list[dict]] = {}
                sections_by_deal: dict[str, dict[str, object]] = {}
                if deal_ids:
                    placeholders = ', '.join(['?'] * len(deal_ids))
                    collaborator_rows = connection.execute(
                        f'SELECT deal_id, collaborator_id, name, email, tower_code FROM deal_collaborators WHERE deal_id IN ({placeholders}) ORDER BY deal_id ASC, sort_order ASC, collaborator_id ASC',
                        deal_ids,
                    ).fetchall()
                    for row in collaborator_rows:
                        deal_id = str(row['deal_id'])
                        collaborators_by_deal.setdefault(deal_id, []).append(
                            {
                                'id': str(row['collaborator_id'] or ''),
                                'name': str(row['name'] or ''),
                                'email': str(row['email'] or ''),
                                'towerCode': str(row['tower_code'] or 'MASTER'),
                            }
                        )

                    section_rows = connection.execute(
                        f'SELECT deal_id, section_key, payload_json FROM deal_sections WHERE deal_id IN ({placeholders}) ORDER BY deal_id ASC, section_key ASC',
                        deal_ids,
                    ).fetchall()
                    for row in section_rows:
                        deal_id = str(row['deal_id'])
                        section_key = str(row['section_key'] or '').strip()
                        if not section_key:
                            continue
                        try:
                            payload = json.loads(row['payload_json'] or 'null')
                        except (TypeError, json.JSONDecodeError):
                            continue
                        sections_by_deal.setdefault(deal_id, {})[section_key] = payload

                for row in deal_rows:
                    deal_id = str(row['id'] or '').strip()
                    if not deal_id:
                        continue
                    payload = self._deal_payload_from_row(row)
                    payload['collaborators'] = collaborators_by_deal.get(deal_id, [])
                    payload.update(sections_by_deal.get(deal_id, {}))
                    raw_workspace['deals'].append(payload)
        except sqlite3.Error:
            return self._normalize_workspace(raw_workspace, users)

        return self._normalize_workspace(raw_workspace, users)

    def _write_users(self, users: list[User]) -> None:
        timestamp = utc_now_iso()
        with self._connect() as connection:
            keep_ids: set[str] = set()
            for user in users:
                keep_ids.add(user.id)
                connection.execute(
                    '''
                    INSERT INTO users (user_id, name, role, email, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        name = excluded.name,
                        role = excluded.role,
                        email = excluded.email,
                        updated_at = excluded.updated_at
                    ''',
                    (user.id, user.name, user.role, user.email, timestamp, timestamp),
                )
            self._delete_missing_rows(connection, 'users', 'user_id', keep_ids)

    def _load_auth_records(self) -> dict[str, str]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    'SELECT user_id, password_hash FROM auth_credentials ORDER BY user_id ASC'
                ).fetchall()
        except sqlite3.Error:
            return {}

        payload: dict[str, str] = {}
        for row in rows:
            user_id = str(row['user_id'] or '').strip()
            if not user_id:
                continue
            payload[user_id] = str(row['password_hash'] or '')
        return payload

    def _write_auth_records(self, payload: dict[str, str]) -> None:
        timestamp = utc_now_iso()
        with self._connect() as connection:
            keep_ids: set[str] = set()
            for user_id, password_hash in payload.items():
                user_key = str(user_id or '').strip()
                if not user_key:
                    continue
                keep_ids.add(user_key)
                connection.execute(
                    '''
                    INSERT INTO auth_credentials (user_id, password_hash, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        password_hash = excluded.password_hash,
                        updated_at = excluded.updated_at
                    ''',
                    (user_key, str(password_hash or ''), timestamp),
                )
            self._delete_missing_rows(connection, 'auth_credentials', 'user_id', keep_ids)

    def _write_workspace(self, workspace: dict) -> None:
        saved_at = str(workspace.get('savedAt') or utc_now_iso())
        current_id = str(workspace.get('currentId')) if workspace.get('currentId') else None
        current_by_user = workspace.get('currentByUser', {}) if isinstance(workspace.get('currentByUser'), dict) else {}
        recent_by_user = workspace.get('recentByUser', {}) if isinstance(workspace.get('recentByUser'), dict) else {}
        deals = [deepcopy(deal) for deal in workspace.get('deals', []) if isinstance(deal, dict)]

        with self._connect() as connection:
            connection.execute(
                '''
                INSERT INTO workspace_state (scope, saved_at, current_id)
                VALUES (?, ?, ?)
                ON CONFLICT(scope) DO UPDATE SET
                    saved_at = excluded.saved_at,
                    current_id = excluded.current_id
                ''',
                (WORKSPACE_SCOPE, saved_at, current_id),
            )

            preference_user_ids = sorted({*current_by_user.keys(), *recent_by_user.keys()})
            for user_id in preference_user_ids:
                recent_ids = recent_by_user.get(user_id)
                if not isinstance(recent_ids, list):
                    recent_ids = []
                connection.execute(
                    '''
                    INSERT INTO user_preferences (scope, user_id, current_deal_id, recent_deal_ids_json, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(scope, user_id) DO UPDATE SET
                        current_deal_id = excluded.current_deal_id,
                        recent_deal_ids_json = excluded.recent_deal_ids_json,
                        updated_at = excluded.updated_at
                    ''',
                    (
                        WORKSPACE_SCOPE,
                        str(user_id),
                        str(current_by_user.get(user_id)) if current_by_user.get(user_id) else None,
                        json.dumps([str(item) for item in recent_ids if str(item).strip()], ensure_ascii=False),
                        saved_at,
                    ),
                )

            if preference_user_ids:
                placeholders = ', '.join(['?'] * len(preference_user_ids))
                connection.execute(
                    f'DELETE FROM user_preferences WHERE scope = ? AND user_id NOT IN ({placeholders})',
                    [WORKSPACE_SCOPE, *preference_user_ids],
                )
            else:
                connection.execute('DELETE FROM user_preferences WHERE scope = ?', (WORKSPACE_SCOPE,))

            persisted_deal_ids: list[str] = []
            for deal in deals:
                core, collaborators, sections, extra_scalars = self._serialize_deal_payload(deal)
                deal_id = str(core.get('id') or '').strip()
                if not deal_id:
                    continue
                persisted_deal_ids.append(deal_id)

                row_payload: dict[str, object] = {}
                for key in DEAL_CORE_KEYS:
                    value = core.get(key)
                    if key in DEAL_BOOL_FIELDS:
                        row_payload[DEAL_CORE_FIELD_TO_COLUMN[key]] = None if value is None else int(bool(value))
                    elif key in DEAL_INT_FIELDS:
                        if value in (None, ''):
                            row_payload[DEAL_CORE_FIELD_TO_COLUMN[key]] = None
                        else:
                            try:
                                row_payload[DEAL_CORE_FIELD_TO_COLUMN[key]] = int(value)
                            except (TypeError, ValueError):
                                row_payload[DEAL_CORE_FIELD_TO_COLUMN[key]] = 1
                    else:
                        row_payload[DEAL_CORE_FIELD_TO_COLUMN[key]] = value

                created_at = str(row_payload.get('created_at') or saved_at)
                updated_at = str(row_payload.get('updated_at') or saved_at)
                version = int(row_payload.get('version') or 1)
                extra_scalars_json = json.dumps(extra_scalars, ensure_ascii=False)
                ordered_values = [deal_id]
                for column in DEAL_DB_COLUMNS:
                    if column == 'created_at':
                        ordered_values.append(created_at)
                    elif column == 'updated_at':
                        ordered_values.append(updated_at)
                    elif column == 'version':
                        ordered_values.append(version)
                    else:
                        ordered_values.append(row_payload.get(column))
                ordered_values.append(extra_scalars_json)

                update_clause = ', '.join([f'{column} = excluded.{column}' for column in DEAL_UPSERT_COLUMNS])
                connection.execute(
                    f'''
                    INSERT INTO deals (id, {', '.join(DEAL_DB_COLUMNS)}, extra_scalars_json)
                    VALUES ({', '.join(['?'] * (len(DEAL_DB_COLUMNS) + 2))})
                    ON CONFLICT(id) DO UPDATE SET
                        {update_clause}
                    ''',
                    ordered_values,
                )

                collaborator_ids: list[str] = []
                for index, collaborator in enumerate(collaborators):
                    if not isinstance(collaborator, dict):
                        continue
                    collaborator_id = str(collaborator.get('id') or '').strip()
                    if not collaborator_id:
                        continue
                    collaborator_ids.append(collaborator_id)
                    connection.execute(
                        '''
                        INSERT INTO deal_collaborators (deal_id, collaborator_id, name, email, tower_code, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(deal_id, collaborator_id) DO UPDATE SET
                            name = excluded.name,
                            email = excluded.email,
                            tower_code = excluded.tower_code,
                            sort_order = excluded.sort_order
                        ''',
                        (
                            deal_id,
                            collaborator_id,
                            str(collaborator.get('name') or ''),
                            str(collaborator.get('email') or ''),
                            str(collaborator.get('towerCode') or 'MASTER'),
                            index,
                        ),
                    )

                if collaborator_ids:
                    placeholders = ', '.join(['?'] * len(collaborator_ids))
                    connection.execute(
                        f'DELETE FROM deal_collaborators WHERE deal_id = ? AND collaborator_id NOT IN ({placeholders})',
                        [deal_id, *collaborator_ids],
                    )
                else:
                    connection.execute('DELETE FROM deal_collaborators WHERE deal_id = ?', (deal_id,))

                section_keys: list[str] = []
                for section_key, section_payload in sections.items():
                    section_name = str(section_key or '').strip()
                    if not section_name:
                        continue
                    section_keys.append(section_name)
                    connection.execute(
                        '''
                        INSERT INTO deal_sections (deal_id, section_key, payload_json, updated_at)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT(deal_id, section_key) DO UPDATE SET
                            payload_json = excluded.payload_json,
                            updated_at = excluded.updated_at
                        ''',
                        (
                            deal_id,
                            section_name,
                            json.dumps(section_payload, ensure_ascii=False),
                            updated_at,
                        ),
                    )

                if section_keys:
                    placeholders = ', '.join(['?'] * len(section_keys))
                    connection.execute(
                        f'DELETE FROM deal_sections WHERE deal_id = ? AND section_key NOT IN ({placeholders})',
                        [deal_id, *section_keys],
                    )
                else:
                    connection.execute('DELETE FROM deal_sections WHERE deal_id = ?', (deal_id,))

            self._delete_missing_rows(connection, 'deals', 'id', persisted_deal_ids)

    def _serialize_deal_payload(self, deal: dict) -> tuple[dict, list[dict], dict[str, object], dict[str, object]]:
        payload = self._sanitize_payload_dict(deepcopy(deal))
        collaborators = self._normalize_collaborators(payload.get('collaborators', []))
        core: dict[str, object] = {'id': str(payload.get('id') or '')}
        sections: dict[str, object] = {}
        extra_scalars: dict[str, object] = {}

        for key, value in payload.items():
            if key == 'collaborators':
                continue
            if key in DEAL_CORE_FIELD_TO_COLUMN:
                core[key] = deepcopy(value)
                continue
            if isinstance(value, (dict, list)):
                sections[key] = deepcopy(value)
                continue
            extra_scalars[key] = deepcopy(value)

        return core, collaborators, sections, extra_scalars

    def _deal_payload_from_row(self, row: sqlite3.Row) -> dict:
        payload: dict[str, object] = {'id': str(row['id'] or '')}
        for key, column in DEAL_CORE_FIELD_TO_COLUMN.items():
            if key == 'id':
                continue
            value = row[column]
            if value is None:
                continue
            if key in DEAL_BOOL_FIELDS:
                payload[key] = bool(value)
            elif key in DEAL_INT_FIELDS:
                try:
                    payload[key] = int(value)
                except (TypeError, ValueError):
                    continue
            else:
                payload[key] = value

        try:
            extra_scalars = json.loads(row['extra_scalars_json'] or '{}')
        except (TypeError, json.JSONDecodeError):
            extra_scalars = {}
        if isinstance(extra_scalars, dict):
            payload.update(extra_scalars)

        return payload

    def _delete_missing_rows(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        key_column: str,
        keep_ids: list[str] | set[str],
    ) -> None:
        keep_list = [str(item) for item in keep_ids if str(item).strip()]
        if keep_list:
            placeholders = ', '.join(['?'] * len(keep_list))
            connection.execute(
                f'DELETE FROM {table_name} WHERE {key_column} NOT IN ({placeholders})',
                keep_list,
            )
            return
        connection.execute(f'DELETE FROM {table_name}')
