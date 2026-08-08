"""Agent tools.

Built-in tools (calculator, current_datetime, web_search) plus user-defined
custom HTTP tools. All execution is stdlib-only. Tools are executed by the
agentic loop in rag.py when the model asks for one.

A tool config is a dict:
  builtin: {"name": "calculator", "type": "builtin", "description": "..."}
  http:    {"name": "...", "type": "http", "description": "...",
            "url": "https://...", "method": "GET"}
"""
from __future__ import annotations

import ast
import json
import operator
import urllib.parse
import urllib.request

BUILTIN_TOOLS = ("calculator", "current_datetime", "web_search")

_BUILTIN_DESCRIPTIONS = {
    "calculator": "evaluate an arithmetic expression, e.g. input \"2*(3+4)/2\"",
    "current_datetime": "get the current UTC date and time (input can be empty)",
    "web_search": "search the web for a short factual answer to a query",
}


def describe(tool: dict) -> str:
    """One-line description shown to the model in the tool list."""
    if tool.get("type") == "http":
        base = tool.get("description") or f"call {tool.get('url', '')}"
        return f"{base} (pass a string as input)"
    name = tool.get("name", "")
    return tool.get("description") or _BUILTIN_DESCRIPTIONS.get(name, name)


def execute(name: str, tool_input: str, agent_tools: list[dict]) -> str:
    """Run tool `name` with `tool_input`; return a short string observation."""
    tool = next((t for t in agent_tools if t.get("name") == name), None)
    if tool is None:
        return f"Error: tool '{name}' is not enabled for this agent."
    try:
        if tool.get("type") == "http":
            return _http_tool(tool, tool_input)
        if name == "calculator":
            return _calculator(tool_input)
        if name == "current_datetime":
            return _current_datetime()
        if name == "web_search":
            return _web_search(tool_input)
        return f"Error: unknown built-in tool '{name}'."
    except Exception as e:  # tools must never crash the chat
        return f"Error running tool '{name}': {e}"


# ---- Built-ins ------------------------------------------------------------
_MATH_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _eval_math(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _MATH_OPS:
        return _MATH_OPS[type(node.op)](_eval_math(node.left), _eval_math(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _MATH_OPS:
        return _MATH_OPS[type(node.op)](_eval_math(node.operand))
    raise ValueError("unsupported expression")


def _calculator(expr: str) -> str:
    tree = ast.parse(expr.strip(), mode="eval")
    result = _eval_math(tree.body)
    # Present whole numbers without a trailing .0
    if isinstance(result, float) and result.is_integer():
        result = int(result)
    return str(result)


def _current_datetime() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%A, %d %B %Y, %H:%M UTC")


def _web_search(query: str) -> str:
    """Best-effort web answer via DuckDuckGo's Instant Answer API (no key)."""
    url = "https://api.duckduckgo.com/?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "no_html": 1, "no_redirect": 1}
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Muster/0.1"})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode())
    if data.get("AbstractText"):
        return data["AbstractText"]
    if data.get("Answer"):
        return str(data["Answer"])
    for topic in data.get("RelatedTopics", []):
        if isinstance(topic, dict) and topic.get("Text"):
            return topic["Text"]
    return "No quick answer found for that query."


# ---- Custom HTTP tools ----------------------------------------------------
def _http_tool(tool: dict, tool_input: str) -> str:
    url = (tool.get("url") or "").strip()
    if not url.startswith(("http://", "https://")):
        return "Error: this tool has no valid http(s) URL configured."
    method = (tool.get("method") or "GET").upper()
    if method == "GET":
        sep = "&" if "?" in url else "?"
        full = f"{url}{sep}{urllib.parse.urlencode({'input': tool_input})}"
        req = urllib.request.Request(full, headers={"User-Agent": "Muster/0.1"})
    else:
        req = urllib.request.Request(
            url,
            data=json.dumps({"input": tool_input}).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "Muster/0.1"},
            method=method,
        )
    with urllib.request.urlopen(req, timeout=15) as r:
        body = r.read().decode(errors="replace")
    return body[:1000]  # keep observations small
