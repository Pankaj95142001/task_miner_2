import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

os.environ['LANGFUSE_PUBLIC_KEY'] = ''
os.environ['LANGFUSE_SECRET_KEY'] = ''

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import knowledge as api
from app.models import DealPayload, User
from app.services.document_knowledge import DocumentKnowledge, chunk_blocks, portal_key, validate_extraction
from app.services.copilot_grounding import saved_context, validate_reply_sources, context_key, scoped_session
from app.services import portal_copilot
from app.sqlite_store import SqliteDealStore


class Embedder:
    model = 'test-semantic-v1'

    def __init__(self):
        self.calls = []
        self.fail = False

    def embed(self, texts):
        self.calls.append(texts)
        if self.fail:
            raise RuntimeError('Simulated outage; do not expose raw provider messages')
        # The test deliberately gives synonyms identical vectors.
        return [[1., 0., 0.] if any(w in t.lower() for w in ('payment', 'invoice', 'settle'))
                else [0., 1., 0.] if 'staff' in t.lower() else [0., 0., 1.] for t in texts]


def extraction(text='Payment is due within 30 days.', **kwargs):
    return {'schema_version': '1.0', 'document_id': 'source-1', 'file_name': 'contract.pdf',
            'status': 'ok', 'warnings': [], 'blocks': [{'type': 'text', 'text': text, 'location': {'page': 3}}], **kwargs}


def deal(deal_id='a', **kwargs):
    return {'id': deal_id, 'clientName': deal_id, 'version': 1, 'documentIntake': {}, **kwargs}


class KnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.embedder = Embedder()
        self.knowledge = DocumentKnowledge(self.root / 'knowledge.db', self.root / 'files', self.embedder)

    def tearDown(self):
        self.temp.cleanup()

    def test_semantic_synonyms_and_persistence(self):
        self.knowledge.index('a', 'doc', extraction())
        reopened = DocumentKnowledge(self.knowledge.path, self.knowledge.files_dir, self.embedder)
        results = reopened.search('When should we settle?', [deal()])['chunks']
        self.assertEqual(results[0]['sourceFile'], 'contract.pdf')
        self.assertIn('page: 3', results[0]['sourceLocation'])
        self.assertEqual(results[0]['reviewStatus'], 'unreviewed')

    def test_scope_filtering_before_retrieval(self):
        self.knowledge.index('private', 'private-doc', extraction('Payment private sentinel'))
        self.knowledge.index('a', 'public-doc', extraction('Payment visible sentinel'))
        rows = self.knowledge.search('payment', [deal()])['chunks']
        self.assertEqual({r['dealId'] for r in rows}, {'a'})
        self.assertNotIn('private sentinel', json.dumps(rows))
        self.assertEqual(self.knowledge.search('payment', [])['chunks'], [])

    def test_replace_removes_old_chunks_and_fts(self):
        self.knowledge.index('a', 'doc', extraction('Obsolete zebra clause'))
        self.knowledge.index('a', 'doc', extraction('Payment revised clause'))
        rows = self.knowledge.search('payment', [deal()])['chunks']
        self.assertTrue(rows)
        self.assertNotIn('Obsolete', json.dumps(rows))
        with self.knowledge.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM knowledge_fts WHERE knowledge_fts MATCH 'zebra'").fetchone()[0], 0)

    def test_delete_deal_and_document(self):
        self.knowledge.index('a', 'doc', extraction())
        self.knowledge.delete('a', 'doc')
        self.assertEqual(self.knowledge.search('payment', [deal()])['chunks'], [])
        self.knowledge.index('a', 'doc', extraction())
        self.knowledge.delete('a')
        self.assertEqual(self.knowledge.status(deal())['documents'], [])

    def test_current_portal_manifest_excludes_stale_deleted_sources(self):
        document = {'id': 'portal-doc', 'uploadedAt': 'v1', 'fileName': 'contract.pdf'}
        self.knowledge.index('a', 'portal-doc', extraction(), origin='portal', source_key=portal_key(document))
        current = deal(documentIntake={'documents': [document]})
        self.assertTrue(self.knowledge.search('payment', [current])['chunks'])
        current['documentIntake']['documents'][0]['uploadedAt'] = 'v2'
        self.assertEqual(self.knowledge.search('payment', [current])['chunks'], [])
        self.assertEqual(self.knowledge.search('payment', [deal()])['chunks'], [])

    def test_idempotency_and_model_change(self):
        self.knowledge.index('a', 'doc', extraction())
        self.knowledge.index('a', 'doc', extraction())
        self.assertEqual(len(self.embedder.calls), 1)
        self.embedder.model = 'test-semantic-v2'
        self.knowledge.index('a', 'doc', extraction())
        self.assertEqual(len(self.embedder.calls), 2)

    def test_index_failure_preserves_keyword_search_and_raw_json(self):
        self.embedder.fail = True
        result = self.knowledge.index('a', 'doc', extraction())
        self.assertEqual(result['embeddedChunks'], 0)
        self.assertIn('keyword', result['warning'])
        self.assertNotIn('Simulated', result['warning'])
        rows = self.knowledge.search('payment', [deal()])
        self.assertTrue(rows['chunks'])
        self.assertTrue(rows['warnings'])
        self.assertEqual(json.loads(next(self.knowledge.files_dir.rglob('extraction.json')).read_text()), extraction())

    def test_query_failure_uses_keyword_search(self):
        self.knowledge.index('a', 'doc', extraction())
        self.embedder.fail = True
        result = self.knowledge.search('payment', [deal()])
        self.assertTrue(result['chunks'])
        self.assertIn('keyword', result['warnings'][0])

    def test_force_rebuild_recovers_embeddings(self):
        self.embedder.fail = True
        self.knowledge.index('a', 'doc', extraction())
        self.embedder.fail = False
        self.knowledge.sync_portal(deal(), force=True)
        self.assertEqual(self.knowledge.status(deal())['documents'][0]['embeddedChunks'], 1)

    def test_changed_embedding_model_cannot_mix_vector_spaces(self):
        self.knowledge.index('a', 'doc', extraction())
        self.embedder.model = 'different-model'
        # No lexical matches; a vector from the old model must not be compared.
        self.assertEqual(self.knowledge.search('settle', [deal()])['chunks'], [])

    def test_cannot_backfill_another_deals_artifact_path(self):
        _, path, _ = self.knowledge.save_artifact('private', 'doc', extraction('Private sentinel'))
        payload = deal(documentIntake={'documents': [{'id': 'doc', 'fileName': 'x.pdf', 'knowledgeArtifact': path}]})
        self.knowledge.sync_portal(payload)
        self.assertEqual(self.knowledge.search('sentinel', [payload])['chunks'], [])

    def test_portal_archive_backfills_and_deletion_prunes(self):
        _, path, _ = self.knowledge.save_artifact('a', 'doc', extraction())
        payload = deal(documentIntake={'documents': [{'id': 'doc', 'fileName': 'x.pdf', 'knowledgeArtifact': path}]})
        self.knowledge.sync_portal(payload)
        self.assertTrue(self.knowledge.search('payment', [payload])['chunks'])
        self.knowledge.sync_portal(deal())
        self.assertEqual(self.knowledge.active_documents([deal()]), [])

    def test_chunking_preserves_table_context_and_spreadsheet_formula(self):
        rows = [['Item', 'Amount']] + [[f'item-{i}', i] for i in range(500)]
        chunks = chunk_blocks([{'rows': rows, 'location': {'page': 5}}])
        self.assertGreater(len(chunks), 2)
        self.assertTrue(all('Item' in c['text'] and 'Amount' in c['text'] for c in chunks))
        sheet = [{'cells': [{'address': 'A1', 'value': 'Revenue'}], 'location': {'sheet': 'Finance', 'row': 1}},
                 {'cells': [{'address': 'A2', 'value': None, 'formula': '=SUM(B2:C2)'}], 'location': {'sheet': 'Finance', 'row': 2}}]
        result = chunk_blocks(sheet)
        self.assertIn('A2=null', result[0]['text'])
        self.assertIn('=SUM(B2:C2)', result[0]['text'])
        self.assertEqual(result[0]['location']['rows'], '1-2')

    def test_invalid_manifest_and_empty_extraction_are_rejected(self):
        for value in ({'files': []}, extraction(blocks=[]), extraction(status='failed'), [], extraction(blocks=['text'])):
            with self.assertRaises(ValueError):
                validate_extraction(value)

    def test_original_can_be_added_after_idempotent_import(self):
        self.knowledge.index('a', 'doc', extraction())
        self.knowledge.index('a', 'doc', extraction(), original=b'original')
        row = self.knowledge.active_documents([deal()])[0]
        self.assertEqual(Path(row['original_path']).read_bytes(), b'original')
        self.assertEqual(len(self.embedder.calls), 1)

    def test_totals_all_deals_not_top_six_and_no_currency_mixing(self):
        deals = [deal(str(i), customerFinanceFte='0.1', financeCostBaseline='1.20', displayCurrency='USD') for i in range(10)]
        deals += [deal('euro', customerFinanceFte='', financeCostBaseline='2', displayCurrency='EUR')]
        result = saved_context(deals, [])
        metrics = {(r['field'], r['unit']): r for r in result['computedAggregates']}
        fte = metrics[('customerFinanceFte', 'FTE')]
        self.assertEqual(fte['sumOfAvailableValues'], '1.0')
        self.assertEqual(fte['missingOrInvalidDealCount'], 1)
        self.assertFalse(fte['complete'])
        self.assertEqual(metrics[('financeCostBaseline', 'USD')]['sumOfAvailableValues'], '12.00')
        self.assertEqual(metrics[('financeCostBaseline', 'EUR')]['sumOfAvailableValues'], '2')

    def test_saved_zero_and_invalid_numeric_values(self):
        result = saved_context([deal(customerFinanceFte='0'), deal('b', customerFinanceFte='1 million')], [])
        self.assertTrue(any(f['value'] == '0' for f in result['facts']))
        metric = result['computedAggregates'][0]
        self.assertEqual(metric['includedDealCount'], 1)
        self.assertEqual(metric['missingOrInvalidDealCount'], 1)

    def test_citation_validation_rejects_invented_locations_and_quotes(self):
        evidence = {'sourceFile': 'a.pdf', 'sourceLocation': 'page 1', 'text': 'Exact quote', 'dealId': 'a', 'version': 'v1'}
        reply = {'sourceRefs': [
            {'sourceFile': 'a.pdf', 'sourceLocation': 'page 1', 'evidenceSnippet': 'Exact quote'},
            {'sourceFile': 'a.pdf', 'sourceLocation': 'page 1', 'evidenceSnippet': 'Invented quote'},
            {'sourceFile': 'a.pdf', 'sourceLocation': 'page 9', 'evidenceSnippet': 'Exact quote'}]}
        result = validate_reply_sources(reply, [evidence])
        self.assertEqual(len(result['sourceRefs']), 1)
        self.assertEqual(result['sourceRefs'][0]['dealId'], 'a')

    def test_history_invalidated_after_scope_version_or_source_changes(self):
        key = context_key([deal()], [])
        session = {'messages': [{'content': 'private answer', 'contextKey': key}]}
        self.assertEqual(len(scoped_session(session, key)['messages']), 1)
        for changed in ([deal(version=2)], [deal('b')], []):
            self.assertEqual(scoped_session(session, context_key(changed, []))['messages'], [])

    def test_copilot_uses_saved_facts_and_retrieved_evidence(self):
        self.knowledge.index('a', 'doc', extraction('Document staffing is 99. Payment 30 days.'))
        captured = {}

        def respond(**kwargs):
            captured.update(kwargs)
            return SimpleNamespace(output_text=json.dumps({'answer': 'Saved FTE is 12. The document says 99.',
                'sourceRefs': [{'sourceFile': 'invented.pdf', 'sourceLocation': 'page 1', 'evidenceSnippet': 'fake'}]}))

        with patch.object(portal_copilot, 'knowledge', self.knowledge), patch.object(portal_copilot, 'OPENAI_API_KEY', ''):
            service = portal_copilot.PortalCopilotService()
            service.client = SimpleNamespace(responses=SimpleNamespace(create=respond))
            reply, session = service.ask(deal_payload=deal(customerFinanceFte='12'), current_user=User(id='u', name='Owner', role='Deal Owner'), question='What is current staffing and payment?')
        prompt = json.dumps(captured['input'])
        self.assertIn('customerFinanceFte = 12', prompt)
        self.assertIn('Document staffing is 99', prompt)
        self.assertIn('authoritative', captured['instructions'])
        self.assertFalse(captured['store'])
        self.assertEqual(reply['sourceRefs'], [])
        self.assertTrue(all(m['contextKey'] for m in session['messages']))

    def test_portfolio_copilot_reads_all_saved_deals(self):
        captured = {}
        def respond(**kwargs):
            captured.update(kwargs)
            return SimpleNamespace(output_text=json.dumps({'answer': 'All accessible deals have total FTE 10.'}))
        with patch.object(portal_copilot, 'knowledge', self.knowledge), patch.object(portal_copilot, 'OPENAI_API_KEY', ''):
            service = portal_copilot.PortalCopilotService()
            service.client = SimpleNamespace(responses=SimpleNamespace(create=respond))
            service.ask_portfolio(deal_payloads=[deal(str(i), customerFinanceFte='1') for i in range(10)],
                current_user=User(id='u', name='Owner', role='Deal Owner'), question='Total FTE across all deals?')
        snapshot_text = next(c['text'] for c in captured['input'][0]['content'] if c['text'].startswith('Accessible deal portfolio snapshot JSON:'))
        snapshot = json.loads(snapshot_text.split('\n', 1)[1])
        self.assertEqual(snapshot['savedFinance']['accessibleDealCount'], 10)
        metric = snapshot['savedFinance']['computedAggregates'][0]
        self.assertEqual(metric['sumOfAvailableValues'], '10')
        self.assertEqual(metric['includedDealCount'], 10)


class KnowledgeApiTests(unittest.TestCase):
    def setUp(self):
        KnowledgeTests.setUp(self)
        self.store = SqliteDealStore(self.root / 'deals.db', self.root / 'deals.json', self.root / 'users.json', self.root / 'auth.json')
        self.store.bootstrap()
        self.owner = 'user-bid-owner'
        self.deal = self.store.create_deal(self.owner, DealPayload(clientName='Test', towerScope_FPA=False, towerScope_RTR=False, towerScope_O2C=False, towerScope_P2P=False))
        app = FastAPI()
        app.state.deal_store = self.store
        app.include_router(api.router, prefix='/api')
        self.client = TestClient(app)
        self.patch = patch.object(api, 'knowledge', self.knowledge)
        self.patch.start()
        self.base = f'/api/deals/{self.deal.id}/knowledge'
        self.headers = {'X-User-Id': self.owner}

    def tearDown(self):
        self.client.close()
        self.patch.stop()
        KnowledgeTests.tearDown(self)

    def upload(self, extraction_data=None, **kwargs):
        return self.client.post(self.base + '/import', headers=self.headers,
                                files={'extraction': ('document.json', json.dumps(extraction_data or extraction()), 'application/json')}, **kwargs)

    def test_import_download_replace_delete_round_trip(self):
        response = self.upload()
        self.assertEqual(response.status_code, 200, response.text)
        document = response.json()['document']
        doc_id = document['documentId']
        downloaded = self.client.get(self.base + '/' + doc_id + '/extraction', headers=self.headers)
        self.assertEqual(downloaded.json(), extraction())
        replacement = self.upload(extraction('Payment revised 60 days', document_id='new'), data={'replace_document_id': doc_id})
        self.assertEqual(replacement.status_code, 200, replacement.text)
        self.assertEqual(len(replacement.json()['documents']), 1)
        self.assertEqual(replacement.json()['document']['documentId'], doc_id)
        removed = self.client.delete(self.base + '/' + doc_id, headers=self.headers)
        self.assertEqual(removed.json()['documents'], [])
        self.assertEqual(self.client.get(self.base + '/' + doc_id + '/extraction', headers=self.headers).status_code, 404)

    def test_authentication_and_cross_deal_access(self):
        self.assertEqual(self.client.get(self.base).status_code, 401)
        self.assertIn(self.client.get(self.base, headers={'X-User-Id': 'user-fpa-lead'}).status_code, (403, 404))
        self.upload()
        private_id = self.knowledge.status(self.deal.model_dump())['documents'][0]['documentId']
        self.assertIn(self.client.get(self.base + '/' + private_id + '/extraction', headers={'X-User-Id': 'user-fpa-lead'}).status_code, (403, 404))

    def test_original_hash_validation_and_saved_values_unchanged(self):
        data = extraction(sha256=hashlib.sha256(b'original').hexdigest())
        response = self.client.post(self.base + '/import', headers=self.headers, files={
            'extraction': ('file.json', json.dumps(data)), 'original': ('contract.pdf', b'wrong')})
        self.assertEqual(response.status_code, 422)
        before = self.store.get_deal(self.owner, self.deal.id).model_dump()
        response = self.client.post(self.base + '/import', headers=self.headers, files={
            'extraction': ('file.json', json.dumps(data)), 'original': ('contract.pdf', b'original')})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(before, self.store.get_deal(self.owner, self.deal.id).model_dump())
        doc_id = response.json()['document']['documentId']
        self.assertEqual(self.client.get(self.base + '/' + doc_id + '/original', headers=self.headers).content, b'original')

    def test_invalid_and_oversize_import_and_foreign_replacement(self):
        response = self.client.post(self.base + '/import', headers=self.headers, files={'extraction': ('bad.json', b'bad')})
        self.assertEqual(response.status_code, 422)
        with patch.object(api, 'KNOWLEDGE_IMPORT_MAX_BYTES', 20):
            self.assertEqual(self.upload().status_code, 413)
        self.assertEqual(self.upload(data={'replace_document_id': 'foreign'}).status_code, 404)

    def test_authorized_reader_cannot_import_or_remove(self):
        shared = self.store.create_deal(self.owner, DealPayload(clientName='Shared', towerScope_FPA=True, towerOwnerUserId_FPA='user-fpa-lead'))
        self.base = f'/api/deals/{shared.id}/knowledge'
        imported = self.upload().json()['document']['documentId']
        reader = {'X-User-Id': 'user-fpa-lead'}
        self.assertEqual(self.client.get(self.base, headers=reader).status_code, 200)
        response = self.client.post(self.base + '/import', headers=reader, files={'extraction': ('document.json', json.dumps(extraction()))})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.delete(self.base + '/' + imported, headers=reader).status_code, 403)


if __name__ == '__main__':
    unittest.main()
