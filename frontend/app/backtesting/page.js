"use client";

import { getBacktestResults } from "../../lib/mockData";

export default function BacktestingPage() {
  const results = getBacktestResults();
  const best = Math.min(...results.map((r) => r.stockoutRate));

  return (
    <div>
      <h1 className="page-title">Backtesting</h1>
      <p className="page-subtitle">
        Comparing inventory strategies against historical data to see which policy would have performed best.
      </p>
      <div style={{ marginBottom: 16 }}>
        <span className="tag-mock">Sample results — real backtesting runs against historical data aren't wired up yet</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface-sunken)", textAlign: "left" }}>
              <th style={{ padding: "10px 16px", fontWeight: 500, color: "var(--ink-secondary)" }}>Strategy</th>
              <th style={{ padding: "10px 16px", fontWeight: 500, color: "var(--ink-secondary)" }}>Stockout rate</th>
              <th style={{ padding: "10px 16px", fontWeight: 500, color: "var(--ink-secondary)" }}>Avg. cost / SKU</th>
              <th style={{ padding: "10px 16px", fontWeight: 500, color: "var(--ink-secondary)" }}>Service level</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.strategy} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 500 }}>{r.strategy}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span
                    className="mono"
                    style={{ color: r.stockoutRate === best ? "var(--accent-teal)" : "var(--ink)" }}
                  >
                    {r.stockoutRate}%
                  </span>
                </td>
                <td className="mono" style={{ padding: "12px 16px" }}>${r.avgCost}</td>
                <td className="mono" style={{ padding: "12px 16px" }}>{r.serviceLevel}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
