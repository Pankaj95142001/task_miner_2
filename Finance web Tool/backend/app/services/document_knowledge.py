"""Local RAG evidence store. Saved finance values remain in the deal store.

SQLite stores vectors and FTS5 text; exact cosine search is suitable for a local
portal. Access is supplied by server-side get_deal/list_deals, never by the LLM.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
import ssl
import threading
from contextlib import contextmanager
from pathlib import Path

from ..config import (BACKEND_DIR, DOCUMENT_UPLOADS_DIR, KNOWLEDGE_DATABASE_PATH,
                      KNOWLEDGE_FILES_DIR, KNOWLEDGE_TOP_K, OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL)


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def portal_key(document: dict) -> str:
    return digest({k: document.get(k) for k in ('id', 'relativePath', 'uploadedAt', 'knowledgeArtifact', 'preview', 'parserMeta')})


def location_text(location: dict) -> str:
    return ', '.join(f'{key}: {value}' for key, value in location.items()
                     if key not in {'bbox', 'render_dpi'} and value is not None)[:90] or 'Document'


def chunk_blocks(blocks: list[dict], limit: int = 1800) -> list[dict]:
    """Keep table headers on each window and group sheet rows with coordinates."""
    chunks = []
    sheet_headers = {}
    row_buffer = []
    row_sheet = None

    def add(text, location, prefix=''):
        text = str(text).replace('\x00', '').strip()
        prefix = prefix[:600]
        width = max(400, limit - len(prefix))
        start = 0
        while start < len(text):
            end = min(len(text), start + width)
            if end < len(text):
                split = text.rfind('\n', start + width // 2, end)
                if split > start:
                    end = split
            chunks.append({'text': (prefix + '\n' + text[start:end]).strip(), 'location': dict(location)})
            if end == len(text):
                break
            start = max(start + 1, end - 150)

    def flush_rows():
        if row_buffer:
            add('\n'.join(item[1] for item in row_buffer),
                {'sheet': row_sheet, 'rows': f'{row_buffer[0][0]}-{row_buffer[-1][0]}'},
                sheet_headers.get(row_sheet, ''))
            row_buffer.clear()

    for block in blocks:
        if not isinstance(block, dict):
            continue
        location = block.get('location') if isinstance(block.get('location'), dict) else {}
        if isinstance(block.get('cells'), list):
            sheet = str(location.get('sheet', 'Sheet'))
            cells = []
            for cell in block['cells']:
                if not isinstance(cell, dict):
                    continue
                value = json.dumps(cell.get('value'), ensure_ascii=False)
                formula = f" [formula: {cell['formula']}; cached value: {value}]" if cell.get('formula') else ''
                cells.append(f"{cell.get('address', '')}={value}{formula}")
            line = ' | '.join(cells)
            if row_sheet != sheet or sum(len(x[1]) for x in row_buffer) + len(line) > 1200:
                flush_rows()
            row_sheet = sheet
            # This is explicitly labelled as context, not an inferred header schema.
            sheet_headers.setdefault(sheet, 'First populated row (context): ' + line[:500])
            row_buffer.append((location.get('row', '?'), line))
            continue
        flush_rows()
        if isinstance(block.get('text'), str):
            add(block['text'], location)
        elif isinstance(block.get('rows'), list) and block['rows']:
            rows = [json.dumps(row, ensure_ascii=False) for row in block['rows']]
            add('\n'.join(rows), location, 'Table first row (context): ' + rows[0])
    flush_rows()
    return chunks


def validate_extraction(data: object) -> dict:
    if not isinstance(data, dict) or data.get('schema_version') != '1.0':
        raise ValueError('Upload a document-extractor document JSON with schema_version 1.0.')
    if not isinstance(data.get('file_name'), str) or not data['file_name'].strip():
        raise ValueError('The extraction JSON must contain file_name.')
    if not isinstance(data.get('blocks'), list) or not all(isinstance(b, dict) for b in data['blocks']):
        raise ValueError('The extraction JSON must contain a blocks array of objects.')
    if not isinstance(data.get('warnings', []), list):
        raise ValueError('Extraction warnings must be an array.')
    if data.get('status') not in {'ok', 'partial'} or not chunk_blocks(data['blocks']):
        raise ValueError('The extraction has no usable text or table evidence. Extract the document first.')
    return data


class OpenAIEmbedder:
    model = OPENAI_EMBEDDING_MODEL

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not OPENAI_API_KEY:
            raise RuntimeError('Embeddings are not configured.')
        from openai import OpenAI, DefaultHttpxClient
        vectors = []
        with OpenAI(api_key=OPENAI_API_KEY, base_url='https://api.openai.com/v1', timeout=30,
                    max_retries=1, http_client=DefaultHttpxClient(verify=ssl.create_default_context())) as client:
            for offset in range(0, len(texts), 32):
                response = client.embeddings.create(model=self.model, input=texts[offset:offset + 32], encoding_format='float')
                vectors.extend(row.embedding for row in sorted(response.data, key=lambda row: row.index))
        return vectors


def normalized(vector):
    if not vector or not all(isinstance(v, (float, int)) and math.isfinite(v) for v in vector):
        raise ValueError('Invalid embedding.')
    norm = math.sqrt(sum(v * v for v in vector))
    if not norm:
        raise ValueError('Empty embedding.')
    return [v / norm for v in vector]


class DocumentKnowledge:
    def __init__(self, path=None, files_dir=None, embedder=None):
        self.path = Path(path or KNOWLEDGE_DATABASE_PATH)
        self.files_dir = Path(files_dir or KNOWLEDGE_FILES_DIR)
        self.embedder = embedder or OpenAIEmbedder()
        self._lock = threading.RLock()

    @contextmanager
    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        try:
            connection.executescript('''
                CREATE TABLE IF NOT EXISTS knowledge_documents (
                    deal_id TEXT, document_id TEXT, origin TEXT, source_key TEXT, version TEXT,
                    file_name TEXT, status TEXT, warnings_json TEXT, artifact_path TEXT,
                    original_path TEXT, embedding_model TEXT, index_warning TEXT,
                    PRIMARY KEY(deal_id, document_id));
                CREATE TABLE IF NOT EXISTS knowledge_chunks (
                    id INTEGER PRIMARY KEY, deal_id TEXT, document_id TEXT, version TEXT,
                    ordinal INTEGER, text TEXT, location_json TEXT, embedding_json TEXT);
                CREATE INDEX IF NOT EXISTS knowledge_scope ON knowledge_chunks(deal_id, document_id, version);
                CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(text, content='knowledge_chunks', content_rowid='id');
                CREATE TRIGGER IF NOT EXISTS knowledge_insert AFTER INSERT ON knowledge_chunks BEGIN
                    INSERT INTO knowledge_fts(rowid,text) VALUES(new.id,new.text); END;
                CREATE TRIGGER IF NOT EXISTS knowledge_delete AFTER DELETE ON knowledge_chunks BEGIN
                    INSERT INTO knowledge_fts(knowledge_fts,rowid,text) VALUES('delete',old.id,old.text); END;
            ''')
            with connection:
                yield connection
        finally:
            connection.close()

    def save_artifact(self, deal_id, document_id, data, original: bytes | None = None):
        version = digest(data)
        folder = self.files_dir / digest(str(deal_id))[:24] / digest(str(document_id))[:24] / version
        folder.mkdir(parents=True, exist_ok=True)
        artifact = folder / 'extraction.json'
        if not artifact.exists():
            artifact.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        original_path = ''
        if original is not None:
            path = folder / 'original.bin'
            path.write_bytes(original)
            original_path = str(path)
        return version, str(artifact), original_path

    def index(self, deal_id, document_id, data, *, origin='extractor', source_key='', original=None, force=False):
        chunks = chunk_blocks(data.get('blocks', []))
        if not chunks:
            raise ValueError('No searchable evidence was found.')
        version = digest(data)
        with self._lock:
            with self.connect() as db:
                existing = db.execute('SELECT * FROM knowledge_documents WHERE deal_id=? AND document_id=?', (deal_id, document_id)).fetchone()
            if existing and existing['version'] == version and existing['source_key'] == source_key and existing['embedding_model'] == self.embedder.model and not force:
                if original is not None and not existing['original_path']:
                    _, _, original_path = self.save_artifact(deal_id, document_id, data, original)
                    with self.connect() as db:
                        db.execute('UPDATE knowledge_documents SET original_path=? WHERE deal_id=? AND document_id=?', (original_path, deal_id, document_id))
                    existing = dict(existing)
                    existing['original_path'] = original_path
                return self.document_status(dict(existing))
            vectors, warning = [], ''
            try:
                vectors = [normalized(v) for v in self.embedder.embed([c['text'] for c in chunks])]
                if len(vectors) != len(chunks) or len({len(v) for v in vectors}) != 1:
                    raise ValueError('Embedding dimensions or count do not match.')
            except Exception:
                vectors = []
                warning = 'Semantic indexing unavailable; keyword search is active. Check the backend key/model and rebuild to retry.'
            version, artifact, original_path = self.save_artifact(deal_id, document_id, data, original)
            if not original_path and existing and existing['version'] == version:
                original_path = existing['original_path']
            values = (deal_id, document_id, origin, source_key, version, str(data.get('file_name', 'Document'))[:180],
                      str(data.get('status', 'partial')), json.dumps(data.get('warnings', [])), artifact,
                      original_path, self.embedder.model, warning)
            with self.connect() as db:
                db.execute('DELETE FROM knowledge_chunks WHERE deal_id=? AND document_id=?', (deal_id, document_id))
                db.execute('INSERT OR REPLACE INTO knowledge_documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', values)
                db.executemany('INSERT INTO knowledge_chunks(deal_id,document_id,version,ordinal,text,location_json,embedding_json) VALUES(?,?,?,?,?,?,?)',
                               [(deal_id, document_id, version, i, chunk['text'], json.dumps(chunk['location']), json.dumps(vectors[i]) if vectors else None)
                                for i, chunk in enumerate(chunks)])
            return {'documentId': document_id, 'fileName': values[5], 'version': version,
                    'chunkCount': len(chunks), 'embeddedChunks': len(vectors), 'warning': warning}

    def document_status(self, row):
        with self.connect() as db:
            counts = db.execute('SELECT count(*) AS n,count(embedding_json) AS embedded FROM knowledge_chunks WHERE deal_id=? AND document_id=?',
                                (row['deal_id'], row['document_id'])).fetchone()
        return {'documentId': row['document_id'], 'fileName': row['file_name'], 'version': row['version'],
                'origin': row['origin'], 'status': row['status'], 'chunkCount': counts['n'],
                'embeddedChunks': counts['embedded'], 'warning': row['index_warning'],
                'hasOriginal': bool(row['original_path']), 'reviewStatus': 'unreviewed'}

    def delete(self, deal_id, document_id=None):
        where, args = 'deal_id=?', [deal_id]
        if document_id is not None:
            where += ' AND document_id=?'
            args.append(document_id)
        with self._lock, self.connect() as db:
            db.execute('DELETE FROM knowledge_chunks WHERE ' + where, args)
            db.execute('DELETE FROM knowledge_documents WHERE ' + where, args)

    def active_documents(self, deal_payloads):
        allowed = {str(d['id']): {str(doc.get('id')): portal_key(doc) for doc in (d.get('documentIntake') or {}).get('documents', []) if isinstance(doc, dict)} for d in deal_payloads}
        result = []
        # Filter in SQL before loading vectors; do not rank globally then filter.
        with self.connect() as db:
            for deal_id, portal_documents in allowed.items():
                for row in db.execute('SELECT * FROM knowledge_documents WHERE deal_id=?', (deal_id,)):
                    if row['origin'] == 'extractor' or portal_documents.get(row['document_id']) == row['source_key']:
                        result.append(dict(row))
        return result

    def status(self, deal_payload):
        active = self.active_documents([deal_payload])
        portal_ids = {str(d.get('id')) for d in (deal_payload.get('documentIntake') or {}).get('documents', []) if isinstance(d, dict)}
        indexed_ids = {r['document_id'] for r in active}
        return {'embeddingModel': self.embedder.model,
                'unindexedPortalDocuments': len(portal_ids - indexed_ids),
                'documents': [self.document_status(row) for row in active]}

    def sync_portal(self, deal_payload, force=False):
        from .document_intake import prepare_document_context, build_prepared_text_chunks, slugify
        deal_id = str(deal_payload['id'])
        documents = [d for d in (deal_payload.get('documentIntake') or {}).get('documents', []) if isinstance(d, dict)]
        with self.connect() as db:
            existing = {row['document_id']: dict(row) for row in db.execute('SELECT * FROM knowledge_documents WHERE deal_id=? AND origin=?', (deal_id, 'portal'))}
        for stale_id in set(existing) - {str(d.get('id')) for d in documents}:
            self.delete(deal_id, stale_id)
        for document in documents:
            document_id = str(document.get('id', ''))
            if not document_id:
                continue
            old = existing.get(document_id)
            if old and old['source_key'] == portal_key(document) and old['embedding_model'] == self.embedder.model and not force:
                continue
            data = None
            artifact = document.get('knowledgeArtifact')
            if artifact:
                path = Path(artifact).resolve()
                document_root = (self.files_dir / digest(deal_id)[:24] / digest(document_id)[:24]).resolve()
                if path.is_relative_to(document_root) and path.is_file():
                    data = json.loads(path.read_text(encoding='utf-8'))
            if data is None:
                blocks, parser_meta = [], {}
                path = (BACKEND_DIR / str(document.get('relativePath') or '')).resolve()
                if path.is_relative_to((DOCUMENT_UPLOADS_DIR / slugify(deal_id)).resolve()) and path.is_file():
                    prepared, parser_meta = prepare_document_context(path.read_bytes(), document.get('fileName', ''), document.get('mimeType', ''))
                    prepared_chunks, _ = build_prepared_text_chunks(prepared, parser_meta)
                    blocks = [{'text': c['text'], 'location': {'section': c.get('label', 'Document')}} for c in prepared_chunks]
                if not blocks:
                    suggestions = (document.get('preview') or {}).get('fieldSuggestions', [])
                    blocks = [{'text': s.get('evidenceSnippet', ''), 'location': {'section': s.get('sourceLocation') or 'Extracted field evidence'}} for s in suggestions if isinstance(s, dict)]
                data = {'schema_version': '1.0', 'file_name': document.get('fileName', 'Document'), 'status': 'partial',
                        'blocks': blocks, 'metadata': parser_meta,
                        'warnings': ['Legacy portal extraction can be incomplete. Import the standalone extraction JSON for full document evidence.']}
            if chunk_blocks(data.get('blocks', [])):
                self.index(deal_id, document_id, data, origin='portal', source_key=portal_key(document), force=force)
        if force:
            for row in self.active_documents([deal_payload]):
                if row['origin'] == 'extractor':
                    data = json.loads(Path(row['artifact_path']).read_text(encoding='utf-8'))
                    self.index(deal_id, row['document_id'], data, force=True)

    def search(self, question, deal_payloads, limit=KNOWLEDGE_TOP_K):
        active = self.active_documents(deal_payloads)
        deal_labels = {str(d['id']): str(d.get('draftLabel') or d.get('clientName') or d['id']) for d in deal_payloads}
        sources = {(r['deal_id'], r['document_id']): r for r in active}
        rows = []
        with self.connect() as db:
            for source in active:
                rows.extend(dict(row) for row in db.execute('SELECT * FROM knowledge_chunks WHERE deal_id=? AND document_id=? AND version=?',
                                                          (source['deal_id'], source['document_id'], source['version'])))
            tokens = re.findall(r'\w+', question.lower())[:32]
            ignored = {'the', 'what', 'is', 'are', 'a', 'an', 'for', 'of', 'in', 'to', 'and', 'my', 'all', 'deal', 'deals'}
            expression = ' OR '.join('"' + t + '"' for t in tokens if t not in ignored)
            lexical = set()
            if expression:
                # Scope lexical matching too, including version checks in the eligible set below.
                for deal_id in {r['deal_id'] for r in active}:
                    lexical.update(r['id'] for r in db.execute('SELECT c.id FROM knowledge_fts JOIN knowledge_chunks c ON c.id=knowledge_fts.rowid WHERE knowledge_fts MATCH ? AND c.deal_id=?', (expression, deal_id)))
        query_vector, warnings = None, []
        if rows and any(r['embedding_json'] and sources[(r['deal_id'], r['document_id'])]['embedding_model'] == self.embedder.model for r in rows):
            try:
                query_vector = normalized(self.embedder.embed([question[:4000]])[0])
            except Exception:
                warnings.append('Semantic search unavailable for this question; keyword search was used.')
        ranked = []
        for row in rows:
            source = sources[(row['deal_id'], row['document_id'])]
            semantic = 0.0
            if query_vector and row['embedding_json'] and source['embedding_model'] == self.embedder.model:
                vector = json.loads(row['embedding_json'])
                if len(vector) == len(query_vector):
                    semantic = sum(a * b for a, b in zip(vector, query_vector))
            matches = sum(t in row['text'].lower() for t in tokens if t not in ignored)
            lexical_score = min(1.0, matches / max(1, len(set(tokens) - ignored))) if row['id'] in lexical else 0.0
            if lexical_score or semantic >= 0.25:
                label = deal_labels.get(row['deal_id'], '')
                name_bonus = 0.5 if len(label) >= 3 and label.casefold() in question.casefold() else 0.0
                ranked.append((0.65 * semantic + 0.35 * lexical_score + name_bonus, row, source))
        ranked.sort(key=lambda item: (-item[0], item[1]['id']))
        context = []
        for score, row, source in ranked[:limit]:
            context.append({'dealId': row['deal_id'], 'documentId': row['document_id'], 'version': row['version'],
                            'dealLabel': deal_labels.get(row['deal_id'], ''),
                            'chunkId': str(row['id']), 'sourceFile': source['file_name'],
                            'sourceLocation': location_text(json.loads(row['location_json'])) + f" [chunk {row['id']}]",
                            'text': row['text'], 'reviewStatus': 'unreviewed', 'extractionStatus': source['status'],
                            'warnings': [str(w)[:500] for w in json.loads(source['warnings_json'])[:10]], 'score': round(score, 4)})
        warnings.extend(r['index_warning'] for r in active if r['index_warning'])
        return {'chunks': context, 'warnings': sorted(set(warnings)), 'indexedDocuments': len(active),
                'scope': 'Only the supplied accessible deals and current document versions.',
                'coverage': 'Top matching excerpts, not a complete set for numerical aggregation.'}


knowledge = DocumentKnowledge()
