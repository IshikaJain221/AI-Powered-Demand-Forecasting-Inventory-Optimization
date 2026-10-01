"""
Connects the AI Copilot to real MCP servers and lets Gemini call their tools.

Two MCP servers are used, both over real stdio JSON-RPC:
  1. This app's own MCP server (app/mcp_server.py) — forecasts, BOM trees,
     production recommendations, live news checks.
  2. The official reference "fetch" MCP server (mcp-server-fetch) — lets the
     copilot pull in a live web page if a question needs outside context.

On startup, both are launched as subprocesses and kept alive for the life of
the FastAPI app (see the lifespan hook in main.py). Each user question goes
through a standard function-calling loop: send the question + tool schemas to
Gemini, execute any tool calls Gemini requests via the matching MCP session,
feed the results back, repeat until Gemini gives a final answer.
"""
import json
import os
import sys
from contextlib import AsyncExitStack

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from app.config import settings

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MODEL = "gemini-3.8-flash"
MAX_TOOL_TURNS = 5


def _mcp_schema_to_gemini(schema: dict) -> dict:
    """MCP tool inputSchema is standard JSON Schema; Gemini function calling
    wants a trimmed-down subset. Strip fields Gemini doesn't recognize."""
    if not schema:
        return {"type": "object", "properties": {}}
    cleaned = {"type": schema.get("type", "object")}
    if "properties" in schema:
        cleaned["properties"] = schema["properties"]
    if "required" in schema:
        cleaned["required"] = schema["required"]
    return cleaned


class MCPToolBridge:
    """Owns the two live MCP client sessions and the Gemini tool-calling loop."""

    def __init__(self):
        self._stack = AsyncExitStack()
        self.sessions: dict[str, ClientSession] = {}  # tool_name -> owning session
        self.gemini_tools: list[dict] = []  # Gemini function_declarations

    async def start(self):
        own_server = StdioServerParameters(
            command=sys.executable,
            args=["-m", "app.mcp_server"],
            env=dict(os.environ),
        )
        fetch_server = StdioServerParameters(
            command=sys.executable,
            args=["-m", "mcp_server_fetch"],
            env=dict(os.environ),
        )

        for label, params in [("app", own_server), ("fetch", fetch_server)]:
            read, write = await self._stack.enter_async_context(stdio_client(params))
            session = await self._stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
            tools = await session.list_tools()
            for t in tools.tools:
                self.sessions[t.name] = session
                self.gemini_tools.append({
                    "name": t.name,
                    "description": t.description or "",
                    "parameters": _mcp_schema_to_gemini(t.inputSchema),
                })
            print(f"[mcp] {label} server ready with tools: {[t.name for t in tools.tools]}")

    async def stop(self):
        await self._stack.aclose()

    async def _call_tool(self, name: str, args: dict) -> str:
        session = self.sessions.get(name)
        if not session:
            return json.dumps({"error": f"Unknown tool {name}"})
        result = await session.call_tool(name, args)
        texts = [c.text for c in result.content if hasattr(c, "text")]
        return "\n".join(texts) if texts else "(no output)"

    async def ask(self, question: str) -> dict:
        """Runs the Gemini <-> MCP tool-calling loop and returns the final
        answer plus a transparent log of which tools were called."""
        if not settings.gemini_api_key:
            return {
                "answer": "GEMINI_API_KEY isn't set in backend/.env, so the copilot can't reach the model.",
                "tool_calls": [],
            }

        contents = [{"role": "user", "parts": [{"text": question}]}]
        tool_call_log = []

        async with httpx.AsyncClient(timeout=60.0) as client:
            for _ in range(MAX_TOOL_TURNS):
                response = await client.post(
                    GEMINI_API_URL.format(model=MODEL),
                    params={"key": settings.gemini_api_key},
                    json={
                        "contents": contents,
                        "tools": [{"function_declarations": self.gemini_tools}],
                    },
                )
                if response.status_code != 200:
                    return {"answer": f"Gemini API error {response.status_code}: {response.text[:300]}", "tool_calls": tool_call_log}

                data = response.json()
                candidate = data["candidates"][0]
                parts = candidate.get("content", {}).get("parts", [])

                function_calls = [p["functionCall"] for p in parts if "functionCall" in p]
                text_parts = [p["text"] for p in parts if "text" in p]

                if not function_calls:
                    return {"answer": "\n".join(text_parts).strip(), "tool_calls": tool_call_log}

                contents.append({"role": "model", "parts": parts})

                response_parts = []
                for fc in function_calls:
                    tool_name = fc["name"]
                    tool_args = fc.get("args", {})
                    result_text = await self._call_tool(tool_name, tool_args)
                    tool_call_log.append({"tool": tool_name, "args": tool_args, "result": result_text[:500]})
                    try:
                        result_obj = json.loads(result_text)
                    except json.JSONDecodeError:
                        result_obj = {"result": result_text}
                    response_parts.append({
                        "functionResponse": {"name": tool_name, "response": result_obj}
                    })

                contents.append({"role": "user", "parts": response_parts})

        return {"answer": "Reached the tool-call limit without a final answer.", "tool_calls": tool_call_log}