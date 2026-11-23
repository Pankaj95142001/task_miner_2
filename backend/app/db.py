import sqlite3
from contextlib import contextmanager


class Database:
    def __init__(self, directory):
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / "sop.sqlite3"
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS workflows (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    recording_context TEXT NOT NULL DEFAULT '',
                    purpose TEXT NOT NULL DEFAULT '',
                    scope TEXT NOT NULL DEFAULT '',
                    prerequisites TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'recording',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS steps (
                    id TEXT PRIMARY KEY,
                    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                    sequence INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    reviewed INTEGER NOT NULL DEFAULT 0,
                    edited INTEGER NOT NULL DEFAULT 0,
                    payload TEXT NOT NULL,
                    UNIQUE(workflow_id, sequence)
                );
                CREATE TABLE IF NOT EXISTS step_merge_originals (
                    id TEXT PRIMARY KEY,
                    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                    merged_step_id TEXT NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
                    position INTEGER NOT NULL,
                    sequence INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    reviewed INTEGER NOT NULL,
                    edited INTEGER NOT NULL,
                    payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS merge_originals_workflow ON step_merge_originals(workflow_id);
                CREATE TABLE IF NOT EXISTS narrations (
                    workflow_id TEXT PRIMARY KEY REFERENCES workflows(id) ON DELETE CASCADE,
                    payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workflow_vision (
                    workflow_id TEXT PRIMARY KEY REFERENCES workflows(id) ON DELETE CASCADE,
                    payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS steps_workflow ON steps(workflow_id, sequence);
            """)
            # Existing recordings retain their content when these fields are added.
            db.execute("BEGIN IMMEDIATE")
            columns = {row['name'] for row in db.execute('PRAGMA table_info(workflows)')}
            for name in ('purpose', 'scope', 'prerequisites', 'recording_context'):
                if name not in columns:
                    db.execute(f"ALTER TABLE workflows ADD COLUMN {name} TEXT NOT NULL DEFAULT ''")

    @contextmanager
    def connect(self, write=False):
        db = sqlite3.connect(self.path, timeout=20)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            if write:
                db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
