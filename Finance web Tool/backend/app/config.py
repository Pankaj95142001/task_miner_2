from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*_args, **_kwargs) -> bool:
        return False

APP_NAME = 'E2E Finance Deal Master API'
APP_VERSION = '0.1.0'
API_PREFIX = '/api'

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / 'data'
DEALS_FILE = DATA_DIR / 'deals.json'
USERS_FILE = DATA_DIR / 'users.json'
AUTH_FILE = DATA_DIR / 'auth.json'
DATABASE_FILE = DATA_DIR / 'deals.db'
SQLITE_DATABASE_FILE = DATA_DIR / 'deal_master.sqlite3'
DOCUMENT_UPLOADS_DIR = DATA_DIR / 'uploads'

load_dotenv(BACKEND_DIR / '.env')


def get_cors_origins() -> list[str]:
    raw = os.getenv('E2E_FINANCE_CORS_ORIGINS', '*').strip()
    if raw == '*':
        return ['*']
    return [origin.strip() for origin in raw.split(',') if origin.strip()]


def get_int_env(name: str, default: int) -> int:
    raw = str(os.getenv(name, '') or '').strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def get_bool_env(name: str, default: bool) -> bool:
    raw = str(os.getenv(name, '') or '').strip().lower()
    if not raw:
        return default
    return raw in {'1', 'true', 'yes', 'on'}


def get_path_env(name: str) -> Path | None:
    raw = str(os.getenv(name, '') or '').strip()
    if not raw:
        return None
    path = Path(raw).expanduser()
    if path.is_absolute():
        return path
    return (BACKEND_DIR.parent / path).resolve()


CORS_ORIGINS = get_cors_origins()
ALLOW_CREDENTIALS = CORS_ORIGINS != ['*']

STORAGE_BACKEND = str(os.getenv('E2E_FINANCE_STORAGE_BACKEND', 'sqlite') or 'sqlite').strip().lower() or 'sqlite'
SQLITE_STORAGE_PATH = get_path_env('E2E_FINANCE_SQLITE_DATABASE') or SQLITE_DATABASE_FILE
POSTGRES_HOST = str(os.getenv('E2E_FINANCE_POSTGRES_HOST', 'localhost') or 'localhost').strip() or 'localhost'
POSTGRES_PORT = get_int_env('E2E_FINANCE_POSTGRES_PORT', 5432)
POSTGRES_DATABASE = str(os.getenv('E2E_FINANCE_POSTGRES_DATABASE', 'deal_master') or 'deal_master').strip() or 'deal_master'
POSTGRES_USER = str(os.getenv('E2E_FINANCE_POSTGRES_USER', 'postgres') or 'postgres').strip() or 'postgres'
POSTGRES_PASSWORD = str(os.getenv('E2E_FINANCE_POSTGRES_PASSWORD', '') or '').strip()
POSTGRES_SSLMODE = str(os.getenv('E2E_FINANCE_POSTGRES_SSLMODE', 'prefer') or 'prefer').strip() or 'prefer'

OPENAI_API_KEY = str(os.getenv('OPENAI_API_KEY', '') or '').strip()
OPENAI_DOCUMENT_MODEL = str(os.getenv('OPENAI_DOCUMENT_MODEL', 'gpt-4.1-mini') or 'gpt-4.1-mini').strip() or 'gpt-4.1-mini'
OPENAI_COMPANY_OVERVIEW_MODEL = str(os.getenv('OPENAI_COMPANY_OVERVIEW_MODEL', OPENAI_DOCUMENT_MODEL) or OPENAI_DOCUMENT_MODEL).strip() or OPENAI_DOCUMENT_MODEL
OPENAI_COMPANY_RESEARCH_MODEL = str(os.getenv('OPENAI_COMPANY_RESEARCH_MODEL', OPENAI_COMPANY_OVERVIEW_MODEL) or OPENAI_COMPANY_OVERVIEW_MODEL).strip() or OPENAI_COMPANY_OVERVIEW_MODEL
OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS = get_int_env('OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS', 3200)
OPENAI_PORTAL_COPILOT_MODEL = str(os.getenv('OPENAI_PORTAL_COPILOT_MODEL', OPENAI_DOCUMENT_MODEL) or OPENAI_DOCUMENT_MODEL).strip() or OPENAI_DOCUMENT_MODEL
OPENAI_PORTAL_COPILOT_MAX_OUTPUT_TOKENS = get_int_env('OPENAI_PORTAL_COPILOT_MAX_OUTPUT_TOKENS', 2600)
DOCUMENT_UPLOAD_MAX_FILES = get_int_env('DOCUMENT_UPLOAD_MAX_FILES', 20)
DOCUMENT_UPLOAD_MAX_BYTES = get_int_env('DOCUMENT_UPLOAD_MAX_BYTES', 20 * 1024 * 1024)
LANGFUSE_PUBLIC_KEY = str(os.getenv('LANGFUSE_PUBLIC_KEY', '') or '').strip()
LANGFUSE_SECRET_KEY = str(os.getenv('LANGFUSE_SECRET_KEY', '') or '').strip()
LANGFUSE_BASE_URL = str(os.getenv('LANGFUSE_BASE_URL', 'https://cloud.langfuse.com') or 'https://cloud.langfuse.com').strip() or 'https://cloud.langfuse.com'
LANGFUSE_TRACING_ENVIRONMENT = str(os.getenv('LANGFUSE_TRACING_ENVIRONMENT', 'development') or 'development').strip() or 'development'
LANGFUSE_DEBUG = get_bool_env('LANGFUSE_DEBUG', False)
WORKBOOK_TEMPLATE_PATH = get_path_env('E2E_FINANCE_WORKBOOK_TEMPLATE')
PORTAL_COPILOT_SESSIONS_FILE = DATA_DIR / 'portal_copilot_sessions.json'
KNOWLEDGE_DATABASE_PATH = get_path_env('KNOWLEDGE_DATABASE_PATH') or DATA_DIR / 'knowledge.sqlite3'
KNOWLEDGE_FILES_DIR = DATA_DIR / 'knowledge'
OPENAI_EMBEDDING_MODEL = str(os.getenv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small')).strip() or 'text-embedding-3-small'
KNOWLEDGE_TOP_K = max(1, min(20, get_int_env('KNOWLEDGE_TOP_K', 8)))
KNOWLEDGE_IMPORT_MAX_BYTES = max(1024, get_int_env('KNOWLEDGE_IMPORT_MAX_BYTES', 100 * 1024 * 1024))

