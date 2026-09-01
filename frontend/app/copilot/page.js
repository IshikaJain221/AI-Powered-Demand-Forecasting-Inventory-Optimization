"use client";

import { useState } from "react";
import { getRiskScore, getSupplierRisk, getExplanation } from "../../lib/mockData";

const SUGGESTIONS = [
  "Why is SKU_VOLATILE_003 at high risk?",
  "What happens if the supplier is delayed by 3 days?",
  "Which SKUs need reordering this week?",
];

function mockAnswer(question) {
  const skuMatch = question.match(/SKU_[A-Z0-9_]+/i);
  if (skuMatch) {
    const sku = skuMatch[0].toUpperCase();
    const risk = getRiskScore(sku);
    const supplier = getSupplierRisk(sku);
    const explanation = getExplanation(sku);
    return `${sku} is currently ${risk.level} risk (score ${risk.score}/100). ${explanation.riskNote} Supplier on-time rate is ${supplier.onTimeRate}%, averaging ${supplier.avgDelayDays} days of delay.`;
  }
  if (/delay/i.test(question)) {
    return "A longer supplier delay raises stockout risk and pushes up the recommended safety stock. Try the What-if tab on a specific SKU to see the exact numbers for a given delay.";
  }
  return "I can answer questions about risk scores, forecasts, and simulated scenarios once you mention a specific SKU — try one of the suggestions below.";
}

export default function CopilotPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Ask me about any SKU's risk, forecast, or a what-if scenario." },
  ]);
  const [input, setInput] = useState("");

  function send(text) {
    const q = text.trim();
    if (!q) return;
    const answer = mockAnswer(q);
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: answer }]);
    setInput("");
  }

  return (
    <div>
      <h1 className="page-title">Copilot</h1>
      <p className="page-subtitle">Ask questions in plain language about risk, forecasts, and scenarios.</p>
      <div style={{ marginBottom: 16 }}>
        <span className="tag-mock">Sample responses — not yet wired to a real LLM</span>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", height: 440 }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "78%",
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
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="btn" style={{ fontSize: 12 }} onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a SKU..."
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-strong)",
              fontSize: 13,
              fontFamily: "var(--font-sans)",
            }}
          />
          <button className="btn btn-primary" type="submit">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
