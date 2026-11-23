from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..models import User
from ..observability import flush_langfuse, start_observation, update_observation
from ..services.portal_copilot import PORTAL_COPILOT_PORTFOLIO_SCOPE_ID, PortalCopilotService, PortalCopilotSessionStore
from ..services.document_knowledge import knowledge
from ..services.copilot_grounding import context_key, scoped_session
from ..storage import JsonDealStore
from .dependencies import get_current_user, get_store

router = APIRouter(prefix='/deals', tags=['Portal Copilot'])
service = PortalCopilotService()
session_store = PortalCopilotSessionStore()


class CopilotChatRequest(BaseModel):
    message: str


@router.get('/{deal_id}/copilot/session')
def get_portal_copilot_session(
    deal_id: str,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> dict:
    deal = store.get_deal(current_user.id, deal_id)
    session = session_store.get_session(deal_id, current_user)
    deals = [deal.model_dump()]
    session = scoped_session(session, context_key(deals, knowledge.active_documents(deals)))
    return {'dealId': deal.id, 'session': session}


@router.get('/copilot/session')
def get_portfolio_copilot_session(
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> dict:
    collection = store.list_deals(current_user.id)
    session = session_store.get_session(PORTAL_COPILOT_PORTFOLIO_SCOPE_ID, current_user)
    deals = [deal.model_dump() for deal in collection.deals]
    session = scoped_session(session, context_key(deals, knowledge.active_documents(deals)))
    return {'scope': 'all-deals', 'dealCount': len(collection.deals), 'session': session}


@router.post('/{deal_id}/copilot/chat')
def chat_with_portal_copilot(
    deal_id: str,
    payload: CopilotChatRequest,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> dict:
    with start_observation(
        name='api.deals.copilot.chat',
        as_type='span',
        input={'dealId': deal_id, 'questionChars': len(str(payload.message or ''))},
        metadata={'userId': current_user.id, 'userRole': current_user.role, 'userEmail': current_user.email},
    ) as api_span:
        try:
            deal = store.get_deal(current_user.id, deal_id)
            session = session_store.get_session(deal_id, current_user)
            reply, next_session = service.ask(
                deal_payload=deal.model_dump(),
                current_user=current_user,
                question=payload.message,
                session=session,
            )
            saved_session = session_store.save_session(deal_id, current_user, next_session)
            update_observation(api_span, output={
                'messageCount': saved_session.get('messageCount') or 0,
                'sourceRefCount': len(reply.get('sourceRefs') or []),
                'suggestedFieldCount': len(reply.get('suggestedFields') or []),
            })
            return {'dealId': deal.id, 'reply': reply, 'session': saved_session}
        except HTTPException:
            raise
        except Exception as error:
            update_observation(api_span, level='ERROR', status_message=str(error))
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Portal copilot failed to answer this question right now.') from error
        finally:
            flush_langfuse()


@router.post('/copilot/chat')
def chat_with_portfolio_copilot(
    payload: CopilotChatRequest,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> dict:
    with start_observation(
        name='api.deals.copilot.portfolio.chat',
        as_type='span',
        input={'scope': PORTAL_COPILOT_PORTFOLIO_SCOPE_ID, 'questionChars': len(str(payload.message or ''))},
        metadata={'userId': current_user.id, 'userRole': current_user.role, 'userEmail': current_user.email},
    ) as api_span:
        try:
            collection = store.list_deals(current_user.id)
            session = session_store.get_session(PORTAL_COPILOT_PORTFOLIO_SCOPE_ID, current_user)
            reply, next_session = service.ask_portfolio(
                deal_payloads=[deal.model_dump() for deal in collection.deals],
                current_user=current_user,
                question=payload.message,
                session=session,
            )
            saved_session = session_store.save_session(PORTAL_COPILOT_PORTFOLIO_SCOPE_ID, current_user, next_session)
            update_observation(api_span, output={
                'visibleDealCount': len(collection.deals),
                'messageCount': saved_session.get('messageCount') or 0,
                'sourceRefCount': len(reply.get('sourceRefs') or []),
                'suggestedFieldCount': len(reply.get('suggestedFields') or []),
            })
            return {'scope': 'all-deals', 'dealCount': len(collection.deals), 'reply': reply, 'session': saved_session}
        except HTTPException:
            raise
        except Exception as error:
            update_observation(api_span, level='ERROR', status_message=str(error))
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Portfolio copilot failed to answer this question right now.') from error
        finally:
            flush_langfuse()


@router.delete('/{deal_id}/copilot/session')
def clear_portal_copilot_session(
    deal_id: str,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> dict:
    deal = store.get_deal(current_user.id, deal_id)
    session = session_store.clear_session(deal_id, current_user)
    return {'dealId': deal.id, 'session': session, 'message': 'Portal copilot session cleared.'}


@router.delete('/copilot/session')
def clear_portfolio_copilot_session(
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> dict:
    collection = store.list_deals(current_user.id)
    session = session_store.clear_session(PORTAL_COPILOT_PORTFOLIO_SCOPE_ID, current_user)
    return {'scope': 'all-deals', 'dealCount': len(collection.deals), 'session': session, 'message': 'Portfolio copilot session cleared.'}
