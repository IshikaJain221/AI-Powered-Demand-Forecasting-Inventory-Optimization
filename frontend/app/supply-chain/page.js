"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ChevronRight } from "lucide-react";
import {
  listComponents,
  getBomTree,
  checkNews,
  checkNewsForTree,
  getRecommendation,
} from "../../lib/api";

export default function SupplyChainPage() {
  const [components, setComponents] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tree, setTree] = useState(null);
  const [error, setError] = useState(null);
  const [checkingTree, setCheckingTree] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  useEffect(() => {
    listComponents()
      .then((data) => {
        setComponents(data);
        const root = data.find((c) => c.category === "finished_good") || data[0];
        if (root) setSelectedId(root.id);
      })
      .catch(() => setError("Couldn't reach the backend."));
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    loadTree(selectedId);
  }, [selectedId]);

  function loadTree(id) {
    setError(null);
    getBomTree(id)
      .then(setTree)
      .catch(() => setError("Couldn't load this component's BOM tree."));
  }

  async function handleCheckNewsTree() {
    if (selectedId == null) return;
    setCheckingTree(true);
    setCheckResult(null);
    setError(null);
    try {
      const result = await checkNewsForTree(selectedId);
      setCheckResult(result);
      await loadTree(selectedId);
      // check-news-tree returns 200 even when individual components failed —
      // surface those failures instead of silently hiding them
      if (result.errors && result.errors.length > 0) {
        setError(
          `${result.errors.length} component(s) failed: ${result.errors
            .map((e) => `${e.component} — ${e.error}`)
            .join(" | ")}`
        );
      }
    } catch (e) {
      // show the REAL backend error message instead of a generic guess
      setError(e.message || "News check failed for an unknown reason.");
    }
    setCheckingTree(false);
  }

  async function handleCheckOne(id) {
    setError(null);
    try {
      await checkNews(id);
      await loadTree(selectedId);
    } catch (e) {
      setError(e.message || "News check failed for an unknown reason.");
    }
  }

  if (error && !components) {
    return (
      <div>
        <h1 className="page-title">Supply chain risk</h1>
        <div className="card" style={{ color: "var(--accent-red)" }}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Supply chain risk</h1>
      <p className="page-subtitle">
        Multi-tier bill of materials, live disruption news, and a production-start recommendation
        for hitting a target ship date.
      </p>

      {!components?.length && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "var(--ink-secondary)", marginBottom: 10 }}>
            No components yet. Seed the demo BOM (iPhone → chip/display/battery → wafer) from the backend:
          </p>
          <code className="mono" style={{ fontSize: 12, background: "var(--surface-sunken)", padding: "6px 10px", borderRadius: 6, display: "block" }}>
            python -m app.services.seed_bom
          </code>
        </div>
      )}

      {components?.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18 }}>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-strong)",
                fontSize: 13,
                fontFamily: "var(--font-sans)",
              }}
            >
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={handleCheckNewsTree} disabled={checkingTree}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={13} className={checkingTree ? "spin" : ""} />
                {checkingTree ? "Searching live news…" : "Check live news for this tree"}
              </span>
            </button>
          </div>

          {error && (
            <div className="card" style={{ marginBottom: 18, background: "var(--accent-amber-bg)", borderColor: "var(--accent-amber-bg)" }}>
              <span style={{ fontSize: 13, color: "var(--accent-amber)" }}>
                {error}
                {error.includes("GEMINI_API_KEY") || error.includes("api key") || error.includes("API key") ? (
                  <> Make sure <code className="mono">GEMINI_API_KEY</code> is set in <code className="mono">backend/.env</code>, then restart the backend and retry.</>
                ) : null}
              </span>
            </div>
          )}

          {checkResult && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                Checked {checkResult.checked.length} component{checkResult.checked.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {checkResult.checked.map((c, i) => (
                  <div key={i} style={{ fontSize: 12.5, display: "flex", gap: 8 }}>
                    <span style={{ fontWeight: 500, minWidth: 130 }}>{c.component}</span>
                    <span style={{ color: c.disruption_found ? "var(--accent-red)" : "var(--ink-secondary)" }}>
                      {c.disruption_found ? c.headline || c.disruption_type : "No disruption found"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Bill of materials</div>
              {tree ? <BomNode node={tree} depth={0} onCheckOne={handleCheckOne} /> : <div style={{ fontSize: 13, color: "var(--ink-secondary)" }}>Loading…</div>}
            </div>

            <RecommendationPanel rootId={selectedId} rootName={tree?.name} />
          </div>
        </>
      )}

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function BomNode({ node, depth, onCheckOne }) {
  const [open, setOpen] = useState(true);
  const hasDisruption = node.disruption && node.disruption.disruption_type !== "none" && node.disruption.estimated_delay_days > 0;

  return (
    <div style={{ marginLeft: depth * 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 0",
          borderBottom: depth === 0 ? "1px solid var(--border)" : "none",
        }}
      >
        {node.children.length > 0 && (
          <button
            onClick={() => setOpen(!open)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
          >
            <ChevronRight size={14} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          </button>
        )}
        {node.children.length === 0 && <span style={{ width: 14 }} />}

        <span style={{ fontSize: 13.5, fontWeight: depth === 0 ? 600 : 500 }}>{node.name}</span>

        {node.source_region && (
          <span className="badge badge-neutral" style={{ fontSize: 11 }}>{node.source_region}</span>
        )}

        <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-secondary)" }}>
          {node.effective_lead_time_days}d lead time
        </span>

        {hasDisruption && (
          <span className="badge badge-high" style={{ fontSize: 11 }}>
            <AlertTriangle size={11} />
            +{node.disruption.estimated_delay_days}d
          </span>
        )}

        <button
          onClick={() => onCheckOne(node.id)}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: "var(--accent-blue)",
            fontSize: 11.5,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          Check news
        </button>
      </div>

      {hasDisruption && (
        <div style={{ fontSize: 11.5, color: "var(--accent-red)", marginLeft: 22, marginBottom: 4 }}>
          {node.disruption.headline}
        </div>
      )}

      {open && node.children.map((child) => (
        <BomNode key={child.id} node={child} depth={depth + 1} onCheckOne={onCheckOne} />
      ))}
    </div>
  );
}

function RecommendationPanel({ rootId, rootName }) {
  const [targetDate, setTargetDate] = useState("");
  const [targetUnits, setTargetUnits] = useState(1000000);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rootId || !targetDate) return;
    setLoading(true);
    setErr(null);
    try {
      const rec = await getRecommendation({
        rootComponentId: rootId,
        targetShipDate: targetDate,
        targetUnits: Number(targetUnits),
      });
      setResult(rec);
    } catch (e2) {
      setErr(e2.message || "Couldn't get a recommendation.");
    }
    setLoading(false);
  }

  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
        When should {rootName || "this product"} go into production?
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 4 }}>Target ship date</div>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            required
            style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border-strong)", fontSize: 13, fontFamily: "var(--font-sans)" }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 4 }}>Target units</div>
          <input
            type="number"
            min={1}
            value={targetUnits}
            onChange={(e) => setTargetUnits(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border-strong)", fontSize: 13, fontFamily: "var(--font-mono)" }}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading || !rootId}>
          {loading ? "Calculating…" : "Get recommendation"}
        </button>
      </form>

      {err && <div style={{ fontSize: 12.5, color: "var(--accent-red)", marginTop: 12 }}>{err}</div>}

      {result && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div
            className="badge"
            style={{
              marginBottom: 10,
              background: result.feasible_with_target_date ? "var(--accent-teal-bg)" : "var(--accent-red-bg)",
              color: result.feasible_with_target_date ? "var(--accent-teal)" : "var(--accent-red)",
            }}
          >
            {result.feasible_with_target_date ? "On track" : "Needs a later date"}
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{result.message}</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, fontSize: 12.5 }}>
            <Row label="Lead time" value={`${result.lead_time_days}d`} />
            <Row label="Production time" value={`${result.production_duration_days}d`} />
            <Row label="Total needed" value={`${result.total_days_needed}d`} />
            <Row label="Latest safe start" value={result.latest_safe_start_date} />
          </div>

          {result.disrupted_components.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Contributing disruptions</div>
              {result.disrupted_components.map((d, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, color: "var(--ink)" }}>{d.name}</span>: +{d.extra_delay_days}d — {d.headline}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <div style={{ color: "var(--ink-secondary)" }}>{label}</div>
      <div className="mono" style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}