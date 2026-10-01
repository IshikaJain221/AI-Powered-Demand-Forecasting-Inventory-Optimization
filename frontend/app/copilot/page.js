"use client";

import { useState } from "react";
import { askCopilot } from "../../lib/api";

const SUGGESTIONS = [
  "What SKUs are being tracked?",
  "What's the forecast for SKU_STABLE_001?",
  "What's the Bill of Materials for component 1?",
];

export default function CopilotPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Ask me about SKUs, forecasts, or the Bill of Materials — I can call real tools to check." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(text) {
    const q = text.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const result = await askCopilot(q);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: result.answer, toolCalls: result.tool_calls },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Couldn't reach the copilot: ${e.message}` },
      ]);
    }
    setLoading(false);
  }

  return (
    <div>
      <h1 className="page-title">Copilot</h1>
      <p className="page-subtitle">
        A real agent — calls live tools over MCP (Model Context Protocol) against this app's own
        data and, when needed, a live web-fetch server.
      </p>

      <div className="card" style={{ display: "flex", flexDirection: "column", height: 480 }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              <div
                style={{
                  background: m.role === "user" ? "var(--ink)" : "var(--surface-sunken)",
                  color: m.role === "user" ? "#fff" : "var(--ink)",
                  padding: "9px 13px",
                  borderRadius: 10,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                {m.text}
              </div>
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {m.toolCalls.map((tc, j) => (
                    <div key={j} className="mono" style={{ fontSize: 10.5, color: "var(--ink-secondary)" }}>
                      🔧 {tc.tool}({JSON.stringify(tc.args)})
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <div style={{ fontSize: 12.5, color: "var(--ink-secondary)" }}>Thinking, calling tools…</div>}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="btn" style={{ fontSize: 12 }} onClick={() => send(s)} disabled={loading}>
              {s}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-strong)", fontSize: 13, fontFamily: "var(--font-sans)" }}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>Send</button>
        </form>
      </div>
    </div>
  );
}
