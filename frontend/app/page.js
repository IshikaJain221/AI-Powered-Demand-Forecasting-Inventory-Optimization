"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listSkus } from "../lib/api";
import { getRiskScore, getBehaviorClass, getSupplierRisk, MOCK_SKU_CODES } from "../lib/mockData";
import RiskBadge from "../components/RiskBadge";

export default function OverviewPage() {
  const [skus, setSkus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listSkus()
      .then((data) => setSkus(data.length ? data : MOCK_SKU_CODES.map((sku_code, id) => ({ id, sku_code }))))
      .catch(() => {
        setError("Couldn't reach the backend — showing sample SKUs instead.");
        setSkus(MOCK_SKU_CODES.map((sku_code, id) => ({ id, sku_code })));
      });
  }, []);

  return (
    <div>
      <h1 className="page-title">Overview</h1>
      <p className="page-subtitle">Every tracked SKU, ranked by inventory risk.</p>

      {error && (
        <div
          className="card"
          style={{ marginBottom: 20, borderColor: "var(--accent-amber-bg)", background: "var(--accent-amber-bg)" }}
        >
          <span style={{ fontSize: 13, color: "var(--accent-amber)" }}>
            {error} Run the backend at localhost:8000 and load the sample data to see real forecasts.
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <SummaryCard label="Tracked SKUs" value={skus ? skus.length : "—"} />
        <SummaryCard
          label="High risk"
          value={skus ? skus.filter((s) => getRiskScore(s.sku_code).level === "high").length : "—"}
          tone="high"
        />
        <SummaryCard
          label="Avg. supplier on-time rate"
          value={skus && skus.length ? `${Math.round(skus.reduce((a, s) => a + getSupplierRisk(s.sku_code).onTimeRate, 0) / skus.length)}%` : "—"}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface-sunken)", textAlign: "left" }}>
              <Th>SKU</Th>
              <Th>Behavior</Th>
              <Th>Risk score</Th>
              <Th>Supplier on-time</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {(skus || []).map((sku) => {
              const risk = getRiskScore(sku.sku_code);
              const behavior = getBehaviorClass(sku.sku_code);
              const supplier = getSupplierRisk(sku.sku_code);
              return (
                <tr key={sku.sku_code} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>
                    <span style={{ fontWeight: 500 }}>{sku.sku_code}</span>
                  </Td>
                  <Td>
                    <span className="badge badge-neutral">{behavior}</span>
                  </Td>
                  <Td>
                    <RiskBadge level={risk.level} score={risk.score} />
                  </Td>
                  <Td>
                    <span className="mono">{supplier.onTimeRate}%</span>
                  </Td>
                  <Td>
                    <Link href={`/sku/${sku.sku_code}`} style={{ color: "var(--accent-blue)", fontWeight: 500 }}>
                      View detail →
                    </Link>
                  </Td>
                </tr>
              );
            })}
            {skus && skus.length === 0 && (
              <tr>
                <Td colSpan={5}>
                  <span style={{ color: "var(--ink-secondary)" }}>
                    No SKUs loaded yet. Run <code className="mono">python -m app.services.data_loader</code> on the
                    backend.
                  </span>
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  const color = tone === "high" ? "var(--accent-red)" : "var(--ink)";
  return (
    <div className="card">
      <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 500, color }}>
        {value}
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th style={{ padding: "10px 16px", fontSize: 12, color: "var(--ink-secondary)", fontWeight: 500 }}>{children}</th>;
}

function Td({ children, colSpan }) {
  return (
    <td colSpan={colSpan} style={{ padding: "12px 16px" }}>
      {children}
    </td>
  );
}
