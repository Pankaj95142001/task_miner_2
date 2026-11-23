"""Small opt-in live check using synthetic data only; does not modify portal deals."""
import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['LANGFUSE_PUBLIC_KEY'] = ''
os.environ['LANGFUSE_SECRET_KEY'] = ''

from app.config import OPENAI_API_KEY
from app.models import User
from app.services.document_knowledge import DocumentKnowledge
from app.services import portal_copilot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', help='Make paid embedding and chat API calls with a small synthetic fixture.')
    if not parser.parse_args().live:
        parser.print_help()
        return 0
    if not OPENAI_API_KEY:
        print(json.dumps({'status': 'not_configured', 'message': 'Set OPENAI_API_KEY in backend/.env.'}))
        return 1
    with tempfile.TemporaryDirectory(prefix='finance-knowledge-check-') as directory:
        root = Path(directory)
        knowledge = DocumentKnowledge(root / 'knowledge.db', root / 'artifacts')
        synthetic = {'schema_version': '1.0', 'file_name': 'synthetic-contract.txt', 'status': 'ok',
                     'warnings': [], 'blocks': [{'text': 'Invoices are payable within 45 days. The customer finance FTE baseline is 99.', 'location': {'page': 1}}]}
        indexed = knowledge.index('synthetic-deal', 'synthetic-document', synthetic)
        if indexed.get('embeddedChunks') != 1:
            print(json.dumps({'status': 'embedding_unavailable', 'message': indexed.get('warning')}))
            return 1
        deal = {'id': 'synthetic-deal', 'version': 1, 'clientName': 'Synthetic Test', 'customerFinanceFte': '12', 'documentIntake': {}}
        with patch.object(portal_copilot, 'knowledge', knowledge):
            service = portal_copilot.PortalCopilotService()
            try:
                reply, _ = service.ask(deal_payload=deal, current_user=User(id='synthetic-owner', name='Test Owner', role='Deal Owner'),
                    question='What are the invoice payment terms and the current saved customer finance FTE? Explain any conflict with the document. Cite both sources.')
            except Exception as error:
                print(json.dumps({'status': 'chat_unavailable', 'errorType': type(error).__name__, 'httpStatus': getattr(error, 'status_code', None)}))
                return 1
            finally:
                if service.client:
                    service.client.close()
        passed = all(value in reply['answer'] for value in ('45', '12', '99')) and len(reply['sourceRefs']) >= 2
        print(json.dumps({'status': 'passed' if passed else 'needs_review', 'embeddedChunks': indexed['embeddedChunks'],
                          'model': service.model, 'answer': reply['answer'], 'sources': reply['sourceRefs']}, indent=2))
        return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
