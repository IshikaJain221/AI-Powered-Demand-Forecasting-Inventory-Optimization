"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { runForecast, getForecast } from "../../../lib/api";
import {
  getRiskScore,
  getBehaviorClass,
  getSafetyStock,
  getFingerprints,
  getSupplierRisk,
  getCostBreakdown,
  getWhatIfScenario,
  getCounterfactualOrders,
  getExplanation,
} from "../../../lib/mockData";
import RiskBadge from "../../../components/RiskBadge";

const TABS = ["Forecast", "Safety stock", "Shock fingerprints", "What-if", "Explanation"];

export default function SkuDetailPage() {
  const { skuCode } = useParams();
  const [tab, setTab] = useState("Forecast");
  const [forecast, setForecast] = useState(null);
  const [forecastError, setForecastError] = useState(null);
  const [loading, setLoading] = useState(false);

  const risk = getRiskScore(skuCode);
  const behavior = getBehaviorClass(skuCode);

  async function loadForecast() {
    setLoading(true);
    setForecastError(null);
    try {
      const data = await getForecast(skuCode);
      setForecast(data);
    } catch (e) {
      setForecastError("No forecast yet for this SKU, or the backend isn't running.");
    }
    setLoading(false);
  }

  async function trainAndLoad() {
    setLoading(true);
    setForecastError(null);
    try {
      await runForecast(skuCode);
      await loadForecast();
    } catch (e) {
      setForecastError("Couldn't run the forecast — check that the backend is running and this SKU has data loaded.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuCode]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{skuCode}</h1>
        <RiskBadge level={risk.level} score={risk.score} />
        <span className="badge badge-neutral">{behavior}</span>
      </div>
      <p className="page-subtitle">Forecast, inventory recommendation, and simulation for this SKU.</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: tab === t ? 500 : 400,
              color: tab === t ? "var(--ink)" : "var(--ink-secondary)",
              borderBottom: tab === t ? "2px solid var(--ink)" : "2px solid transparent",
              fontFamily: "var(--font-sans)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Forecast" && (
        <ForecastTab
          skuCode={skuCode}
          forecast={forecast}
          error={forecastError}
          loading={loading}
          onTrain={trainAndLoad}
        />
      )}
      {tab === "Safety stock" && <SafetyStockTab skuCode={skuCode} />}
      {tab === "Shock fingerprints" && <FingerprintsTab skuCode={skuCode} />}
      {tab === "What-if" && <WhatIfTab skuCode={skuCode} />}
      {tab === "Explanation" && <ExplanationTab skuCode={skuCode} />}
    </div>
  );
}

function ForecastTab({ skuCode, forecast, error, loading, onTrain }) {
  if (error) {
    return (
      <div className="card">
        <p style={{ fontSize: 13, color: "var(--ink-secondary)", marginBottom: 14 }}>{error}</p>
        <button className="btn btn-primary" onClick={onTrain} disabled={loading}>
          {loading ? "Training models…" : "Train & run forecast"}
        </button>
      </div>
    );
  }

  if (!forecast) {
    return <div className="card">Loading…</div>;
  }

  const chartData = forecast.points.map((p) => ({
    date: p.date,
    predicted: Math.round(p.predicted_units * 10) / 10,
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ink-secondary)" }}>
          Best model: <span style={{ color: "var(--ink)", fontWeight: 500 }}>{forecast.best_model}</span>
        </div>
        <button className="btn" onClick={onTrain} disabled={loading}>
          {loading ? "Retraining…" : "Retrain"}
        </button>
      </div>
      <div className="card" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--ink-secondary)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--ink-secondary)" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey="predicted" stroke="var(--accent-blue)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SafetyStockTab({ skuCode }) {
  const s = getSafetyStock(skuCode);
  const supplier = getSupplierRisk(skuCode);
  const cost = getCostBreakdown(skuCode);
  return (
    <div>
      <MockTag />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <Stat label="Current safety stock" value={`${s.currentUnits} units`} />
        <Stat label="Recommended" value={`${s.recommendedUnits} units`} highlight />
        <Stat label="Supplier lead time" value={`${s.leadTimeDays} days`} />
        <Stat label="Target service level" value={`${s.serviceLevel}%`} />
      </div>
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Total cost breakdown</div>
        <CostBars cost={cost} />
      </div>
    </div>
  );
}

function CostBars({ cost }) {
  const items = [
    ["Holding cost", cost.holding, "var(--accent-blue)"],
    ["Ordering cost", cost.ordering, "var(--accent-teal)"],
    ["Stockout cost", cost.stockout, "var(--accent-red)"],
    ["Lost sales", cost.lostSales, "var(--accent-amber)"],
  ];
  const max = Math.max(...items.map((i) => i[1]));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(([label, val, color]) => (
        <div key={label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: "var(--ink-secondary)" }}>{label}</span>
            <span className="mono">${val}</span>
          </div>
          <div style={{ background: "var(--surface-sunken)", borderRadius: 4, height: 6 }}>
            <div style={{ width: `${(val / max) * 100}%`, background: color, height: 6, borderRadius: 4 }} />
          </div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 500, marginTop: 4 }}>
        <span>Total</span>
        <span className="mono">${cost.total}</span>
      </div>
    </div>
  );
}

function FingerprintsTab({ skuCode }) {
  const fingerprints = getFingerprints(skuCode);
  return (
    <div>
      <MockTag />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {fingerprints.map((fp) => (
          <div key={fp.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{fp.label}</div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>{fp.date} · {fp.impact}</div>
            </div>
            <span className="badge badge-neutral">{fp.similarity}% match to a past event</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhatIfTab({ skuCode }) {
  const [priceChangePct, setPriceChangePct] = useState(0);
  const [promo, setPromo] = useState(false);
  const [supplierDelayDays, setSupplierDelayDays] = useState(0);
  const scenario = getWhatIfScenario(skuCode, { priceChangePct, promo, supplierDelayDays });
  const orders = getCounterfactualOrders(skuCode);

  return (
    <div>
      <MockTag />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Scenario controls</div>

          <Field label={`Price change: ${priceChangePct}%`}>
            <input
              type="range"
              min={-30}
              max={30}
              value={priceChangePct}
              onChange={(e) => setPriceChangePct(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label={`Supplier delay: ${supplierDelayDays} days`}>
            <input
              type="range"
              min={0}
              max={10}
              value={supplierDelayDays}
              onChange={(e) => setSupplierDelayDays(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 6 }}>
            <input type="checkbox" checked={promo} onChange={(e) => setPromo(e.target.checked)} />
            Running a promotion
          </label>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <Row label="Base demand" value={`${scenario.baseDemand} units/day`} />
            <Row label="Projected demand" value={`${scenario.projectedDemand} units/day`} strong />
            <Row label="Stockout risk" value={`${scenario.stockoutRiskPct}%`} />
            <Row label="Extra cost from delay" value={`$${scenario.extraCost}`} />
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Counterfactual order comparison</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {orders.map((o) => (
              <div key={o.qty} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontWeight: 500 }}>Order {o.qty}</span>
                <span className="mono" style={{ color: o.stockoutRiskPct > 25 ? "var(--accent-red)" : "var(--ink-secondary)" }}>
                  {o.stockoutRiskPct}% stockout risk
                </span>
                <span className="mono">${o.totalCost}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExplanationTab({ skuCode }) {
  const ex = getExplanation(skuCode);
  return (
    <div>
      <MockTag />
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Why this recommendation</div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)" }}>{ex.summary}</p>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink-secondary)", marginTop: 10 }}>{ex.riskNote}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="card">
      <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: highlight ? "var(--accent-blue)" : "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
      <span style={{ color: "var(--ink-secondary)" }}>{label}</span>
      <span className="mono" style={{ fontWeight: strong ? 500 : 400 }}>{value}</span>
    </div>
  );
}

function MockTag() {
  return (
    <div style={{ marginBottom: 14 }}>
      <span className="tag-mock">Sample data — this feature isn't wired to the backend yet</span>
    </div>
  );
}
