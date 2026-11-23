from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..models import DealPayload, User
from ..workbook_oracle import render_p2p_sheet
from .dependencies import get_current_user

router = APIRouter(prefix='/p2p', tags=['P2P Workbook'])


class WorkbookRenderRequest(BaseModel):
    sheetName: str
    deal: DealPayload


@router.post('/workbook/render')
def render_workbook_sheet(
    payload: WorkbookRenderRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    del current_user

    try:
        return render_p2p_sheet(payload.deal.model_dump(), payload.sheetName)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error
