from fastapi import APIRouter, HTTPException

from app.schemas.assistant import AssistantQuery, AssistantResponse
from app.services.chatbot_engine import ChatbotEngine


router = APIRouter(prefix="/assistant")


@router.post("", response_model=AssistantResponse)
async def assistant(req: AssistantQuery) -> AssistantResponse:
    try:
        return ChatbotEngine().answer(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
