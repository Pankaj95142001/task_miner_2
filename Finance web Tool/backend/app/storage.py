from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status

from .models import (
    Deal,
    DealCollection,
    DealCollaborator,
    DealMember,
    DealPayload,
    MeSummary,
    TOWER_CODES,
    TOWER_LABELS,
    TowerWorkspaceSummary,
    User,
)

DEFAULT_USERS = [
    {'id': 'user-bid-owner', 'name': 'Bid Owner', 'role': 'Deal Owner', 'email': 'bid.owner@hcltech.local'},
    {'id': 'user-fpa-lead', 'name': 'FP&A Lead', 'role': 'Tower Lead', 'email': 'fpa.lead@hcltech.local'},
    {'id': 'user-rtr-lead', 'name': 'RTR Lead', 'role': 'Tower Lead', 'email': 'rtr.lead@hcltech.local'},
    {'id': 'user-o2c-lead', 'name': 'O2C Lead', 'role': 'Tower Lead', 'email': 'o2c.lead@hcltech.local'},
    {'id': 'user-p2p-lead', 'name': 'P2P Lead', 'role': 'Tower Lead', 'email': 'p2p.lead@hcltech.local'},
    {'id': 'user-reviewer', 'name': 'Finance Reviewer', 'role': 'Reviewer', 'email': 'reviewer@hcltech.local'},
]

DEFAULT_USER_ID = 'user-bid-owner'
DEFAULT_TOWER_OWNER_BY_CODE = {
    'FPA': 'user-fpa-lead',
    'RTR': 'user-rtr-lead',
    'O2C': 'user-o2c-lead',
    'P2P': 'user-p2p-lead',
}
TOWER_WORKSPACE_FIELD_BY_CODE = {
    'FPA': 'fpaWorkspace',
    'RTR': 'rtrWorkspace',
    'O2C': 'o2cWorkspace',
    'P2P': 'p2pWorkspace',
}
OWNER_ROLE = 'owner'
TOWER_LEAD_ROLE = 'tower_lead'
COLLABORATOR_ROLE = 'collaborator'
RECENT_LIMIT = 8
WORKSPACE_SCOPE = 'global'
DEAL_RUNTIME_ONLY_FIELDS = {'accessRole', 'members', 'towerWorkspaces'}
DEAL_LIST_SECTION_KEY = 'collaborators'
DEAL_CORE_FIELD_TO_COLUMN = {
    'id': 'id',
    'draftLabel': 'draft_label',
    'clientName': 'client_name',
    'dealId': 'deal_code',
    'programName': 'program_name',
    'presalesLead': 'presales_lead',
    'bidDate': 'bid_date',
    'dealStatus': 'deal_status',
    'watermark': 'watermark',
    'contractTerm': 'contract_term',
    'discountRate': 'discount_rate',
    'corporateOverhead': 'corporate_overhead',
    'displayCurrency': 'display_currency',
    'fxRate': 'fx_rate',
    'customerFinanceFte': 'customer_finance_fte',
    'financeCostBaseline': 'finance_cost_baseline',
    'pricingConstruct': 'pricing_construct',
    'transitionCommercials': 'transition_commercials',
    'transformationFunding': 'transformation_funding',
    'benchmarkPolicy': 'benchmark_policy',
    'committedProdY2': 'committed_prod_y2',
    'committedProdY3': 'committed_prod_y3',
    'committedProdY4': 'committed_prod_y4',
    'notesTag': 'notes_tag',
    'reviewNotes': 'review_notes',
    'canonicalSchemaRef': 'canonical_schema_ref',
    'dealOwnerUserId': 'deal_owner_user_id',
    'dealOwnerName': 'deal_owner_name',
    'towerScope_FPA': 'tower_scope_fpa',
    'towerScope_RTR': 'tower_scope_rtr',
    'towerScope_O2C': 'tower_scope_o2c',
    'towerScope_P2P': 'tower_scope_p2p',
    'towerLead_FPA': 'tower_lead_fpa',
    'towerLead_RTR': 'tower_lead_rtr',
    'towerLead_O2C': 'tower_lead_o2c',
    'towerLead_P2P': 'tower_lead_p2p',
    'towerOwnerUserId_FPA': 'tower_owner_user_id_fpa',
    'towerOwnerUserId_RTR': 'tower_owner_user_id_rtr',
    'towerOwnerUserId_O2C': 'tower_owner_user_id_o2c',
    'towerOwnerUserId_P2P': 'tower_owner_user_id_p2p',
    'towerStatus_FPA': 'tower_status_fpa',
    'towerStatus_RTR': 'tower_status_rtr',
    'towerStatus_O2C': 'tower_status_o2c',
    'towerStatus_P2P': 'tower_status_p2p',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'version': 'version',
}
DEAL_BOOL_FIELDS = {'towerScope_FPA', 'towerScope_RTR', 'towerScope_O2C', 'towerScope_P2P'}
DEAL_INT_FIELDS = {'version'}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class JsonDealStore:
    def __init__(
        self,
        deals_file_path: Path,
        users_file_path: Path,
        auth_file_path: Path,
        legacy_database_path: Path | None = None,
    ) -> None:
        self.deals_file_path = deals_file_path
        self.users_file_path = users_file_path
        self.auth_file_path = auth_file_path
        self.legacy_database_path = legacy_database_path
        self._lock = threading.Lock()

    def bootstrap(self) -> None:
        self.deals_file_path.parent.mkdir(parents=True, exist_ok=True)
        self.users_file_path.parent.mkdir(parents=True, exist_ok=True)
        self.auth_file_path.parent.mkdir(parents=True, exist_ok=True)

        with self._lock:
            users = self._load_users()
            if not users:
                users = [User(**item) for item in DEFAULT_USERS]
                self._write_users(users)

            if not self.auth_file_path.exists():
                self._write_auth_records({})

            workspace = self._load_workspace(users)
            if not workspace['deals']:
                imported = self._import_legacy_database()
                if imported is not None:
                    workspace = self._normalize_workspace(imported, users)

            self._write_workspace(workspace)

    def list_users(self) -> list[User]:
        with self._lock:
            return self._load_users()

    def login(self, email: str, password: str) -> User:
        email_key = self._normalize_email(email)
        if not email_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Email is required to sign in.',
            )

        if not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Password is required to sign in.',
            )

        with self._lock:
            users = self._load_users()
            auth_records = self._load_auth_records()
            user = self._users_by_email(users).get(email_key)

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='No account was found for that email address.',
            )

        password_hash = str(auth_records.get(user.id) or '')
        if not password_hash:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Account not activated yet. Please create your account first.',
            )

        if not self._verify_password(password, password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Incorrect email or password.',
            )

        return user

    def register_user(self, name: str, role: str, email: str, password: str) -> User:
        name_value = str(name or '').strip()
        role_value = str(role or '').strip()
        email_key = self._normalize_email(email)

        if not name_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Name is required to create an account.',
            )

        if not role_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Role is required to create an account.',
            )

        if not email_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Email is required to create an account.',
            )

        if len(str(password or '')) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Password must be at least 8 characters long.',
            )

        with self._lock:
            users = self._load_users()
            auth_records = self._load_auth_records()
            users_by_id = self._users_by_id(users)
            existing_user = self._users_by_email(users).get(email_key)

            if existing_user is not None and str(auth_records.get(existing_user.id) or ''):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail='An account already exists for that email. Please sign in instead.',
                )

            if existing_user is not None:
                next_user = User(id=existing_user.id, name=name_value, role=role_value, email=email_key)
                users = [next_user if item.id == existing_user.id else item for item in users]
            else:
                next_user = User(
                    id=self._build_user_id(email_key, users_by_id),
                    name=name_value,
                    role=role_value,
                    email=email_key,
                )
                users.append(next_user)

            auth_records[next_user.id] = self._hash_password(password)
            self._write_users(users)
            self._write_auth_records(auth_records)
            return next_user

    def get_user(self, user_id: str | None) -> User:
        with self._lock:
            return self._get_user_from_users(user_id, self._load_users())

    def get_me_summary(self, user_id: str | None) -> MeSummary:
        with self._lock:
            users = self._load_users()
            current_user = self._get_user_from_users(user_id, users)
            workspace = self._load_workspace(users)
            collection = self._build_collection_for_user(workspace, current_user, users)
            owned_deals = [deal for deal in collection.deals if deal.dealOwnerUserId == current_user.id]
            assigned_deals = [deal for deal in collection.deals if deal.dealOwnerUserId != current_user.id]
            recent_deals = self._filter_deals_by_ids(collection.deals, self._get_recent_ids(workspace, current_user.id))
            return MeSummary(
                user=current_user,
                currentId=collection.currentId,
                ownedDeals=owned_deals,
                assignedDeals=assigned_deals,
                pinnedDeals=[],
                recentDeals=recent_deals,
            )

    def list_deals(self, user_id: str | None) -> DealCollection:
        with self._lock:
            users = self._load_users()
            current_user = self._get_user_from_users(user_id, users)
            workspace = self._load_workspace(users)
            return self._build_collection_for_user(workspace, current_user, users)

    def get_deal(self, user_id: str | None, deal_id: str) -> Deal:
        with self._lock:
            users = self._load_users()
            current_user = self._get_user_from_users(user_id, users)
            workspace = self._load_workspace(users)
            deal_payload = self._require_deal_access(workspace['deals'], current_user, users, deal_id)
            return self._build_deal(deal_payload, current_user, users)

    def create_deal(self, user_id: str | None, incoming: DealPayload) -> Deal:
        with self._lock:
            users = self._load_users()
            current_user = self._get_user_from_users(user_id, users)
            workspace = self._load_workspace(users)
            deal_data = self._sanitize_payload_dict(incoming.model_dump(exclude_none=True))
            deal_id = str(deal_data.get('id') or self._build_id())

            if any(str(item.get('id')) == deal_id for item in workspace['deals']):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail='Deal {} already exists.'.format(deal_id),
                )

            users, users_changed = self._ensure_collaborator_users(users, deal_data.get('collaborators', []))
            users_by_id = self._users_by_id(users)
            current_user = users_by_id.get(current_user.id, current_user)

            now = utc_now_iso()
            deal_data['id'] = deal_id
            normalized = self._normalize_payload(deal_data, current_user, None, users_by_id)
            normalized['createdAt'] = normalized.get('createdAt') or now
            normalized['updatedAt'] = now
            normalized['version'] = 1

            workspace['deals'].insert(0, normalized)
            workspace['savedAt'] = now
            workspace['currentId'] = deal_id
            self._set_current_deal_preference(workspace, current_user.id, deal_id)
            workspace = self._normalize_workspace(workspace, users)
            self._write_state(workspace, users, users_changed)
            return self._build_deal(self._find_deal(workspace['deals'], deal_id), current_user, users)

    def update_deal(self, user_id: str | None, deal_id: str, incoming: DealPayload) -> Deal:
        with self._lock:
            users = self._load_users()
            current_user = self._get_user_from_users(user_id, users)
            workspace = self._load_workspace(users)
            existing = self._require_deal_access(workspace['deals'], current_user, users, deal_id)
            existing_payload = deepcopy(existing)
            updates = self._sanitize_payload_dict(incoming.model_dump(exclude_unset=True, exclude_none=True))
            is_owner = str(existing.get('dealOwnerUserId') or '') == current_user.id

            if is_owner:
                merged = {**existing_payload, **updates}
                users, users_changed = self._ensure_collaborator_users(users, merged.get('collaborators', []))
            else:
                editable_tower_codes = self._editable_tower_codes(existing, current_user, users)
                allowed_keys = {
                    key
                    for code in editable_tower_codes
                    for key in ('towerStatus_{}'.format(code), TOWER_WORKSPACE_FIELD_BY_CODE.get(code, ''))
                    if key
                }
                update_keys = set(updates.keys())

                if not allowed_keys or not update_keys or any(key not in allowed_keys for key in update_keys):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail='Only the deal owner can update the Deal Master. Tower users can update only their assigned tower workspace.',
                    )

                merged = deepcopy(existing_payload)
                for key in update_keys:
                    merged[key] = updates[key]
                users_changed = False

            users_by_id = self._users_by_id(users)
            current_user = users_by_id.get(current_user.id, current_user)

            now = utc_now_iso()
            merged['id'] = deal_id
            merged['createdAt'] = existing_payload.get('createdAt') or now
            merged['updatedAt'] = now
            normalized = self._normalize_payload(merged, current_user, existing_payload, users_by_id)
            normalized['version'] = int(existing_payload.get('version') or 1) + 1

            self._replace_deal(workspace['deals'], deal_id, normalized)
            workspace['savedAt'] = now
            workspace['currentId'] = deal_id
            self._set_current_deal_preference(workspace, current_user.id, deal_id)
            workspace = self._normalize_workspace(workspace, users)
            self._write_state(workspace, users, users_changed)
            return self._build_deal(self._find_deal(workspace['deals'], deal_id), current_user, users)

    def delete_deal(self, user_id: str | None, deal_id: str) -> DealCollection:
        with self._lock:
            users = self._load_users()
            current_user = self._get_user_from_users(user_id, users)
            workspace = self._load_workspace(users)
            existing = self._require_deal_access(workspace['deals'], current_user, users, deal_id)

            if str(existing.get('dealOwnerUserId') or '') != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail='Only the deal owner can delete the deal.',
                )

            workspace['deals'] = [deal for deal in workspace['deals'] if str(deal.get('id')) != deal_id]
            workspace['savedAt'] = utc_now_iso()
            if workspace.get('currentId') == deal_id:
                workspace['currentId'] = workspace['deals'][0]['id'] if workspace['deals'] else None
            self._clear_current_deal_preference(workspace, deal_id)
            workspace = self._normalize_workspace(workspace, users)
            self._write_state(workspace, users, False)
            return self._build_collection_for_user(workspace, current_user, users)

    def duplicate_deal(self, user_id: str | None, deal_id: str) -> Deal:
        with self._lock:
            users = self._load_users()
            current_user = self._get_user_from_users(user_id, users)
            workspace = self._load_workspace(users)
            source = self._require_deal_access(workspace['deals'], current_user, users, deal_id)
            duplicate = deepcopy(source)
            duplicate_id = self._build_id()
            now = utc_now_iso()

            duplicate['id'] = duplicate_id
            duplicate['draftLabel'] = '{} Copy'.format(source.get('draftLabel') or source.get('dealId') or 'Draft')
            duplicate['dealId'] = '{}-COPY'.format(source.get('dealId') or 'PRE-2026-E2E')
            duplicate['dealOwnerUserId'] = current_user.id
            duplicate['dealOwnerName'] = current_user.name
            duplicate['presalesLead'] = current_user.name
            duplicate['createdAt'] = now
            duplicate['updatedAt'] = now
            duplicate['version'] = 1

            users, users_changed = self._ensure_collaborator_users(users, duplicate.get('collaborators', []))
            users_by_id = self._users_by_id(users)
            normalized = self._normalize_payload(duplicate, current_user, None, users_by_id)
            normalized['version'] = 1

            workspace['deals'].insert(0, normalized)
            workspace['savedAt'] = now
            workspace['currentId'] = duplicate_id
            self._set_current_deal_preference(workspace, current_user.id, duplicate_id)
            workspace = self._normalize_workspace(workspace, users)
            self._write_state(workspace, users, users_changed)
            return self._build_deal(self._find_deal(workspace['deals'], duplicate_id), current_user, users)

    def set_current_deal(self, user_id: str | None, deal_id: str) -> DealCollection:
        with self._lock:
            users = self._load_users()
            current_user = self._get_user_from_users(user_id, users)
            workspace = self._load_workspace(users)
            self._require_deal_access(workspace['deals'], current_user, users, deal_id)
            workspace['savedAt'] = utc_now_iso()
            workspace['currentId'] = deal_id
            self._set_current_deal_preference(workspace, current_user.id, deal_id)
            workspace = self._normalize_workspace(workspace, users)
            self._write_state(workspace, users, False)
            return self._build_collection_for_user(workspace, current_user, users)

    def _load_users(self) -> list[User]:
        payload = self._read_json(self.users_file_path, [])
        raw_users = payload if isinstance(payload, list) else payload.get('users', []) if isinstance(payload, dict) else []
        users: list[User] = []
        seen_ids: set[str] = set()

        for item in raw_users:
            if not isinstance(item, dict):
                continue

            user_id = str(item.get('id') or '').strip()
            email = str(item.get('email') or '').strip().lower()
            if not user_id or not email or user_id in seen_ids:
                continue

            users.append(
                User(
                    id=user_id,
                    name=str(item.get('name') or 'User').strip() or 'User',
                    role=str(item.get('role') or 'Collaborator').strip() or 'Collaborator',
                    email=email,
                )
            )
            seen_ids.add(user_id)

        return users

    def _load_workspace(self, users: list[User]) -> dict:
        payload = self._read_json(self.deals_file_path, {})
        return self._normalize_workspace(payload, users)

    def _normalize_workspace(self, payload: dict, users: list[User]) -> dict:
        raw = payload if isinstance(payload, dict) else {}
        raw_deals = raw.get('deals') if isinstance(raw.get('deals'), list) else []
        users_by_id = self._users_by_id(users)
        normalized_deals: list[dict] = []
        seen_ids: set[str] = set()

        for item in raw_deals:
            if not isinstance(item, dict):
                continue
            normalized = self._normalize_saved_deal(item, users_by_id)
            deal_id = str(normalized.get('id') or '').strip()
            if not deal_id or deal_id in seen_ids:
                continue
            normalized_deals.append(normalized)
            seen_ids.add(deal_id)

        current_by_user = raw.get('currentByUser') if isinstance(raw.get('currentByUser'), dict) else {}
        sanitized_current_by_user = {
            str(user_id): str(deal_id)
            for user_id, deal_id in current_by_user.items()
            if str(deal_id) in seen_ids
        }
        current_id = str(raw.get('currentId') or '').strip() or None
        if current_id not in seen_ids:
            current_id = normalized_deals[0]['id'] if normalized_deals else None

        return {
            'savedAt': str(raw.get('savedAt') or utc_now_iso()),
            'currentId': current_id,
            'currentByUser': sanitized_current_by_user,
            'recentByUser': self._normalize_recent_map(raw.get('recentByUser'), seen_ids),
            'deals': self._sort_raw_deals(normalized_deals),
        }

    def _normalize_recent_map(self, payload: object, valid_ids: set[str]) -> dict[str, list[str]]:
        if not isinstance(payload, dict):
            return {}

        recent_by_user: dict[str, list[str]] = {}
        for user_id, deal_ids in payload.items():
            if not isinstance(deal_ids, list):
                continue
            deduped: list[str] = []
            for deal_id in deal_ids:
                deal_key = str(deal_id)
                if deal_key not in valid_ids or deal_key in deduped:
                    continue
                deduped.append(deal_key)
            if deduped:
                recent_by_user[str(user_id)] = deduped[:RECENT_LIMIT]
        return recent_by_user

    def _normalize_saved_deal(self, payload: dict, users_by_id: dict[str, User]) -> dict:
        existing = deepcopy(payload)
        owner_user_id = str(existing.get('dealOwnerUserId') or '').strip()
        owner_user = users_by_id.get(owner_user_id) or self._default_user(users_by_id)
        normalized = self._normalize_payload(existing, owner_user, existing, users_by_id)
        normalized['id'] = str(normalized.get('id') or self._build_id())
        normalized['createdAt'] = str(normalized.get('createdAt') or utc_now_iso())
        normalized['updatedAt'] = str(normalized.get('updatedAt') or normalized['createdAt'])
        normalized['version'] = int(existing.get('version') or 1)
        return normalized

    def _normalize_payload(
        self,
        payload: dict,
        current_user: User,
        existing_payload: dict | None,
        users_by_id: dict[str, User],
    ) -> dict:
        normalized = deepcopy(existing_payload or {})
        normalized.update(self._sanitize_payload_dict(payload))

        owner_user_id = str((existing_payload or {}).get('dealOwnerUserId') or current_user.id).strip() or current_user.id
        owner_user = users_by_id.get(owner_user_id) or current_user
        normalized['dealOwnerUserId'] = owner_user.id
        normalized['dealOwnerName'] = owner_user.name

        if not str(normalized.get('presalesLead') or '').strip():
            normalized['presalesLead'] = owner_user.name

        normalized['collaborators'] = self._normalize_collaborators(normalized.get('collaborators', []))

        for code in TOWER_CODES:
            scope_key = 'towerScope_{}'.format(code)
            lead_key = 'towerLead_{}'.format(code)
            owner_key = 'towerOwnerUserId_{}'.format(code)

            in_scope = bool(normalized.get(scope_key, True))
            if owner_key in payload:
                assigned_user_id = str(payload.get(owner_key) or '').strip()
            elif existing_payload is not None:
                assigned_user_id = str(existing_payload.get(owner_key) or '').strip()
            else:
                assigned_user_id = DEFAULT_TOWER_OWNER_BY_CODE.get(code, '') if in_scope else ''

            assigned_user = users_by_id.get(assigned_user_id) if assigned_user_id else None
            normalized[scope_key] = in_scope
            normalized[owner_key] = assigned_user.id if assigned_user is not None else assigned_user_id
            normalized[lead_key] = assigned_user.name if assigned_user is not None else str(normalized.get(lead_key) or '')

        return normalized

    def _normalize_collaborators(self, payload: object) -> list[dict]:
        if not isinstance(payload, list):
            return []

        collaborators: list[dict] = []
        seen_keys: set[tuple[str, str]] = set()
        valid_tower_codes = {'MASTER', *TOWER_CODES}
        for item in payload:
            if not isinstance(item, dict):
                continue

            name = str(item.get('name') or '').strip()
            email = str(item.get('email') or '').strip().lower()
            tower_code = str(item.get('towerCode') or 'MASTER').strip().upper() or 'MASTER'
            if tower_code not in valid_tower_codes or not name or not email:
                continue

            dedupe_key = (email, tower_code)
            if dedupe_key in seen_keys:
                continue

            collaborator = DealCollaborator(
                id=str(item.get('id') or self._build_collaborator_id(email, tower_code)),
                name=name,
                email=email,
                towerCode=tower_code,
            )
            collaborators.append(collaborator.model_dump())
            seen_keys.add(dedupe_key)

        return collaborators

    def _build_collection_for_user(self, workspace: dict, current_user: User, users: list[User]) -> DealCollection:
        visible_deals = [
            self._build_deal(deal, current_user, users)
            for deal in workspace['deals']
            if self._has_access(deal, current_user, users)
        ]
        visible_deals.sort(key=lambda deal: self._deal_sort_key(deal.updatedAt, deal.createdAt, deal.id), reverse=True)
        stored_current_id = workspace.get('currentByUser', {}).get(current_user.id) or workspace.get('currentId')
        current_id = self._resolve_current_deal_id(stored_current_id, visible_deals)
        return DealCollection(savedAt=workspace.get('savedAt') or utc_now_iso(), currentId=current_id, deals=visible_deals)

    def _build_deal(self, payload: dict, current_user: User, users: list[User]) -> Deal:
        users_by_id = self._users_by_id(users)
        users_by_email = self._users_by_email(users)
        members = self._build_members(payload, users_by_id, users_by_email)
        access_role = self._resolve_access_role(members, str(payload.get('dealOwnerUserId') or ''), current_user.id)
        tower_workspaces = self._build_tower_workspaces(payload)
        body = deepcopy(payload)
        version = int(body.pop('version', 1) or 1)
        body.pop('members', None)
        body.pop('towerWorkspaces', None)
        body.pop('accessRole', None)
        body['collaborators'] = self._normalize_collaborators(body.get('collaborators', []))
        body['createdAt'] = body.get('createdAt') or utc_now_iso()
        body['updatedAt'] = body.get('updatedAt') or body['createdAt']
        return Deal(
            **body,
            version=version,
            accessRole=access_role,
            members=members,
            towerWorkspaces=tower_workspaces,
        )

    def _build_members(
        self,
        payload: dict,
        users_by_id: dict[str, User],
        users_by_email: dict[str, User],
    ) -> list[DealMember]:
        members: list[DealMember] = []
        seen_keys: set[tuple[str, str, str | None]] = set()

        def append_member(user_id: str, user_name: str, role: str, tower_code: str | None) -> None:
            key = (user_id, role, tower_code)
            if not user_id or key in seen_keys:
                return
            members.append(DealMember(userId=user_id, userName=user_name or user_id, role=role, towerCode=tower_code))
            seen_keys.add(key)

        owner_user_id = str(payload.get('dealOwnerUserId') or '').strip()
        owner_name = str(payload.get('dealOwnerName') or '').strip()
        append_member(owner_user_id, owner_name, OWNER_ROLE, None)

        for code in TOWER_CODES:
            if not bool(payload.get('towerScope_{}'.format(code), True)):
                continue
            assigned_user_id = str(payload.get('towerOwnerUserId_{}'.format(code)) or '').strip()
            assigned_name = str(payload.get('towerLead_{}'.format(code)) or '').strip()
            append_member(assigned_user_id, assigned_name, TOWER_LEAD_ROLE, code)

        for collaborator in self._normalize_collaborators(payload.get('collaborators', [])):
            collaborator_user = users_by_email.get(collaborator['email'])
            if collaborator_user is None:
                continue
            append_member(collaborator_user.id, collaborator_user.name, COLLABORATOR_ROLE, collaborator['towerCode'])

        return members

    def _build_tower_workspaces(self, payload: dict) -> list[TowerWorkspaceSummary]:
        existing = {}
        if isinstance(payload.get('towerWorkspaces'), list):
            existing = {
                str(item.get('towerCode')): item
                for item in payload.get('towerWorkspaces', [])
                if isinstance(item, dict) and item.get('towerCode')
            }

        workspaces: list[TowerWorkspaceSummary] = []
        for code in TOWER_CODES:
            item = existing.get(code, {})
            status_key = 'towerStatus_{}'.format(code)
            workspaces.append(
                TowerWorkspaceSummary(
                    towerCode=code,
                    towerLabel=TOWER_LABELS.get(code, code),
                    status=str(item.get('status') or payload.get(status_key) or 'Not Started'),
                    assignedUserId=str(payload.get('towerOwnerUserId_{}'.format(code)) or '').strip() or None,
                    assignedUserName=str(payload.get('towerLead_{}'.format(code)) or '').strip(),
                    inScope=bool(payload.get('towerScope_{}'.format(code), True)),
                    version=int(item.get('version') or 1),
                )
            )
        return workspaces

    def _has_access(self, payload: dict, current_user: User, users: list[User]) -> bool:
        if str(payload.get('dealOwnerUserId') or '').strip() == current_user.id:
            return True

        users_by_id = self._users_by_id(users)
        users_by_email = self._users_by_email(users)
        members = self._build_members(payload, users_by_id, users_by_email)
        return any(member.userId == current_user.id for member in members)

    def _require_deal_access(self, deals: list[dict], current_user: User, users: list[User], deal_id: str) -> dict:
        deal = self._find_deal(deals, deal_id)
        if deal is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Deal {} was not found.'.format(deal_id),
            )

        if not self._has_access(deal, current_user, users):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='You do not have access to deal {}.'.format(deal_id),
            )

        return deal

    def _resolve_access_role(self, members: list[DealMember], owner_user_id: str, user_id: str) -> str:
        if owner_user_id == user_id:
            return OWNER_ROLE

        for member in members:
            if member.userId != user_id:
                continue
            if member.role == TOWER_LEAD_ROLE:
                return TOWER_LEAD_ROLE
            if member.role == COLLABORATOR_ROLE:
                return COLLABORATOR_ROLE
            return member.role

        return 'viewer'

    def _editable_tower_codes(self, payload: dict, current_user: User, users: list[User]) -> set[str]:
        if str(payload.get('dealOwnerUserId') or '').strip() == current_user.id:
            return set(TOWER_CODES)

        users_by_id = self._users_by_id(users)
        users_by_email = self._users_by_email(users)
        members = self._build_members(payload, users_by_id, users_by_email)
        editable: set[str] = set()

        for member in members:
            if member.userId != current_user.id or not member.towerCode:
                continue

            tower_code = str(member.towerCode).strip().upper()
            if tower_code in TOWER_CODES:
                editable.add(tower_code)

        return editable

    def _ensure_collaborator_users(self, users: list[User], collaborators: object) -> tuple[list[User], bool]:
        if not isinstance(collaborators, list):
            return users, False

        next_users = list(users)
        users_by_email = self._users_by_email(next_users)
        users_by_id = self._users_by_id(next_users)
        auth_records = self._load_auth_records()
        changed = False

        for collaborator in collaborators:
            if not isinstance(collaborator, dict):
                continue

            email = str(collaborator.get('email') or '').strip().lower()
            name = str(collaborator.get('name') or '').strip()
            tower_code = str(collaborator.get('towerCode') or 'MASTER').strip().upper() or 'MASTER'
            if not email:
                continue

            existing_user = users_by_email.get(email)
            if existing_user is not None:
                has_account = bool(str(auth_records.get(existing_user.id) or '').strip())
                next_name = name or existing_user.name
                next_role = existing_user.role if has_account else self._role_for_collaborator(tower_code)

                if not has_account and (existing_user.name != next_name or existing_user.role != next_role):
                    updated_user = User(
                        id=existing_user.id,
                        name=next_name,
                        role=next_role,
                        email=email,
                    )
                    next_users = [updated_user if item.id == existing_user.id else item for item in next_users]
                    users_by_email[email] = updated_user
                    users_by_id[updated_user.id] = updated_user
                    changed = True
                continue

            new_user_id = self._build_user_id(email, users_by_id)
            user = User(
                id=new_user_id,
                name=name or email.split('@')[0],
                role=self._role_for_collaborator(tower_code),
                email=email,
            )
            next_users.append(user)
            users_by_email[email] = user
            users_by_id[new_user_id] = user
            changed = True

        return next_users, changed

    def _role_for_collaborator(self, tower_code: str) -> str:
        if tower_code == 'MASTER':
            return 'Deal Collaborator'
        return '{} Collaborator'.format(TOWER_LABELS.get(tower_code, tower_code))

    def _write_state(self, workspace: dict, users: list[User], users_changed: bool) -> None:
        self._write_workspace(workspace)
        if users_changed or not self.users_file_path.exists():
            self._write_users(users)

    def _write_workspace(self, workspace: dict) -> None:
        payload = {
            'savedAt': workspace.get('savedAt') or utc_now_iso(),
            'currentId': workspace.get('currentId'),
            'currentByUser': workspace.get('currentByUser', {}),
            'recentByUser': workspace.get('recentByUser', {}),
            'deals': [deepcopy(deal) for deal in workspace.get('deals', [])],
        }
        self._write_json(self.deals_file_path, payload)

    def _write_users(self, users: list[User]) -> None:
        self._write_json(self.users_file_path, [user.model_dump() for user in users])

    def _load_auth_records(self) -> dict[str, str]:
        payload = self._read_json(self.auth_file_path, {})
        if not isinstance(payload, dict):
            return {}
        return {str(user_id): str(password_hash) for user_id, password_hash in payload.items() if str(user_id).strip()}

    def _write_auth_records(self, payload: dict[str, str]) -> None:
        self._write_json(self.auth_file_path, payload)

    def _normalize_email(self, value: str | None) -> str:
        return str(value or '').strip().lower()

    def _hash_password(self, password: str) -> str:
        salt = secrets.token_hex(16)
        derived = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 120000).hex()
        return f"pbkdf2_sha256$120000${salt}${derived}"

    def _verify_password(self, password: str, stored_hash: str) -> bool:
        try:
            algorithm, iterations, salt, expected = str(stored_hash).split('$', 3)
        except ValueError:
            return False

        if algorithm != 'pbkdf2_sha256':
            return False

        derived = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), int(iterations)).hex()
        return hmac.compare_digest(derived, expected)

    def _read_json(self, path: Path, default: object) -> object:
        if not path.exists():
            return deepcopy(default)

        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            return deepcopy(default)

    def _write_json(self, path: Path, payload: object) -> None:
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

    def _import_legacy_database(self) -> dict | None:
        if self.legacy_database_path is None or not self.legacy_database_path.exists():
            return None

        try:
            with sqlite3.connect(self.legacy_database_path) as connection:
                connection.row_factory = sqlite3.Row
                exists = connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deals'"
                ).fetchone()
                if exists is None:
                    return None

                rows = connection.execute(
                    'SELECT id, payload_json, created_at, updated_at, version FROM deals ORDER BY updated_at DESC, created_at DESC, id DESC'
                ).fetchall()
        except sqlite3.Error:
            return None

        deals: list[dict] = []
        for row in rows:
            try:
                payload = json.loads(row['payload_json'])
            except (TypeError, json.JSONDecodeError):
                continue

            if not isinstance(payload, dict):
                continue

            payload['id'] = row['id']
            payload['createdAt'] = payload.get('createdAt') or row['created_at'] or utc_now_iso()
            payload['updatedAt'] = payload.get('updatedAt') or row['updated_at'] or payload['createdAt']
            payload['version'] = int(row['version'] or 1)
            deals.append(payload)

        return {
            'savedAt': utc_now_iso(),
            'currentId': deals[0]['id'] if deals else None,
            'currentByUser': {},
            'recentByUser': {},
            'deals': deals,
        }

    def _filter_deals_by_ids(self, deals: list[Deal], ordered_ids: list[str]) -> list[Deal]:
        deal_map = {deal.id: deal for deal in deals}
        return [deal_map[deal_id] for deal_id in ordered_ids if deal_id in deal_map]

    def _get_recent_ids(self, workspace: dict, user_id: str) -> list[str]:
        recent_by_user = workspace.get('recentByUser', {})
        if not isinstance(recent_by_user, dict):
            return []
        raw = recent_by_user.get(user_id)
        return raw if isinstance(raw, list) else []

    def _set_current_deal_preference(self, workspace: dict, user_id: str, deal_id: str) -> None:
        current_by_user = workspace.setdefault('currentByUser', {})
        current_by_user[user_id] = deal_id
        recent_by_user = workspace.setdefault('recentByUser', {})
        current_recent = recent_by_user.get(user_id) if isinstance(recent_by_user.get(user_id), list) else []
        next_recent = [deal_id] + [item for item in current_recent if item != deal_id]
        recent_by_user[user_id] = next_recent[:RECENT_LIMIT]

    def _clear_current_deal_preference(self, workspace: dict, deal_id: str) -> None:
        current_by_user = workspace.setdefault('currentByUser', {})
        for user_id, current_id in list(current_by_user.items()):
            if current_id == deal_id:
                current_by_user.pop(user_id, None)

        recent_by_user = workspace.setdefault('recentByUser', {})
        for user_id, recent_ids in list(recent_by_user.items()):
            if not isinstance(recent_ids, list):
                recent_by_user[user_id] = []
                continue
            recent_by_user[user_id] = [item for item in recent_ids if item != deal_id]

    def _users_by_id(self, users: list[User]) -> dict[str, User]:
        return {user.id: user for user in users}

    def _users_by_email(self, users: list[User]) -> dict[str, User]:
        return {user.email.strip().lower(): user for user in users if user.email.strip()}

    def _get_user_from_users(self, user_id: str | None, users: list[User]) -> User:
        users_by_id = self._users_by_id(users)
        if user_id:
            user = users_by_id.get(user_id)
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail='User {} was not found.'.format(user_id),
                )
            return user

        fallback = self._default_user(users_by_id)
        if fallback is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='No users are configured in the collaboration store.',
            )
        return fallback

    def _default_user(self, users_by_id: dict[str, User]) -> User:
        return users_by_id.get(DEFAULT_USER_ID) or next(iter(users_by_id.values()), User(**DEFAULT_USERS[0]))

    def _find_deal(self, deals: list[dict], deal_id: str) -> dict | None:
        for deal in deals:
            if str(deal.get('id')) == deal_id:
                return deal
        return None

    def _replace_deal(self, deals: list[dict], deal_id: str, next_value: dict) -> None:
        for index, deal in enumerate(deals):
            if str(deal.get('id')) == deal_id:
                deals[index] = next_value
                return
        deals.insert(0, next_value)

    def _resolve_current_deal_id(self, stored_current_id: str | None, deals: list[Deal]) -> str | None:
        deal_ids = {deal.id for deal in deals}
        if stored_current_id and stored_current_id in deal_ids:
            return stored_current_id
        return deals[0].id if deals else None

    def _sanitize_payload_dict(self, payload: dict) -> dict:
        clean = deepcopy(payload)
        clean.pop('members', None)
        clean.pop('towerWorkspaces', None)
        clean.pop('version', None)
        clean.pop('accessRole', None)
        clean.pop('colaRate', None)
        return clean

    def _deal_sort_key(self, updated_at: str | None, created_at: str | None, deal_id: str | None) -> tuple[datetime, datetime, str]:
        return (
            self._parse_datetime(updated_at),
            self._parse_datetime(created_at),
            str(deal_id or ''),
        )

    def _sort_raw_deals(self, deals: list[dict]) -> list[dict]:
        return sorted(
            deals,
            key=lambda deal: self._deal_sort_key(deal.get('updatedAt'), deal.get('createdAt'), deal.get('id')),
            reverse=True,
        )

    def _parse_datetime(self, value: str | None) -> datetime:
        if not value:
            return datetime.min.replace(tzinfo=timezone.utc)
        try:
            return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)

    def _build_id(self) -> str:
        return 'deal-{}'.format(datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f'))

    def _build_collaborator_id(self, email: str, tower_code: str) -> str:
        slug = re.sub(r'[^a-z0-9]+', '-', email.split('@')[0].lower()).strip('-') or 'collaborator'
        return 'collab-{}-{}'.format(slug, tower_code.lower())

    def _build_user_id(self, email: str, users_by_id: dict[str, User]) -> str:
        slug = re.sub(r'[^a-z0-9]+', '-', email.split('@')[0].lower()).strip('-') or 'user'
        candidate = 'user-{}'.format(slug)
        suffix = 2
        while candidate in users_by_id:
            candidate = 'user-{}-{}'.format(slug, suffix)
            suffix += 1
        return candidate


FileDealStore = JsonDealStore
