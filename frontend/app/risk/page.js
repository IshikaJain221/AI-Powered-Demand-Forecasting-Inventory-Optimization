"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listSkus } from "../../lib/api";
import { getRiskScore, getSupplierRisk, getFingerprints, MOCK_SKU_CODES } from "../../lib/mockData";
import RiskBadge from "../../components/RiskBadge";

export default function RiskPage() {
  const [skus, setSkus] = useState(null);

  useEffect(() => {
    listSkus()
      .then((data) => setSkus(data.length ? data : MOCK_SKU_CODES.map((sku_code, id) => ({ id, sku_code }))))
      .catch(() => setSkus(MOCK_SKU_CODES.map((sku_code, id) => ({ id, sku_code }))));
  }, []);

  return (
    <div>
      <h1 className="page-title">Risk & shocks</h1>
      <p className="page-subtitle">
        Inventory risk scores, supplier reliability, and demand shock fingerprints — the system's memory of
        unusual demand events and how closely current conditions match them.
      </p>
      <div style={{ marginBottom: 16 }}>
        <span className="tag-mock">Sample data — risk scoring and fingerprinting aren't wired to the backend yet</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(skus || []).map((sku) => {
          const risk = getRiskScore(sku.sku_code);
          const supplier = getSupplierRisk(sku.sku_code);
          const fingerprints = getFingerprints(sku.sku_code);
          return (
            <Link key={sku.sku_code} href={`/sku/${sku.sku_code}`} className="card" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{sku.sku_code}</span>
                <RiskBadge level={risk.level} score={risk.score} />
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginBottom: 8 }}>
                Supplier on-time rate: <span className="mono">{supplier.onTimeRate}%</span> · avg delay{" "}
                <span className="mono">{supplier.avgDelayDays}d</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {fingerprints.slice(0, 3).map((fp) => (
                  <span key={fp.id} className="badge badge-neutral">
                    {fp.label}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
