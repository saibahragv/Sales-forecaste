from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json

from app.services.agent_service import stream_agent

router = APIRouter()


class AgentMessage(BaseModel):
    role: str
    content: str


class AgentRequest(BaseModel):
    messages: list[AgentMessage]
    store: Optional[int] = None
    item: Optional[int] = None


@router.post("/agent/chat")
def agent_chat(req: AgentRequest):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    def generate():
        for chunk in stream_agent(messages=messages, store=req.store, item=req.item):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
