from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


class AskRequest(BaseModel):
    question: str


@router.post("/ask")
async def ask(payload: AskRequest, request: Request):
    bridge = request.app.state.mcp_bridge
    return await bridge.ask(payload.question)


@router.get("/tools")
async def list_tools(request: Request):
    """Introspection endpoint — shows which real MCP tools are currently wired up."""
    bridge = request.app.state.mcp_bridge
    return {"tools": [t["name"] for t in bridge.gemini_tools]}
