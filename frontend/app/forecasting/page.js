"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listSkus } from "../../lib/api";
import { MOCK_SKU_CODES } from "../../lib/mockData";

export default function ForecastingPage() {
  const [skus, setSkus] = useState(null);

  useEffect(() => {
    listSkus()
      .then((data) => setSkus(data.length ? data : MOCK_SKU_CODES.map((sku_code, id) => ({ id, sku_code }))))
      .catch(() => setSkus(MOCK_SKU_CODES.map((sku_code, id) => ({ id, sku_code }))));
  }, []);

  return (
    <div>
      <h1 className="page-title">Forecasting</h1>
      <p className="page-subtitle">
        Multi-model demand forecasting — XGBoost, Prophet, and an LSTM are trained per SKU, backtested, and the
        best performer is auto-selected.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {(skus || []).map((sku) => (
          <Link key={sku.sku_code} href={`/sku/${sku.sku_code}`} className="card" style={{ display: "block" }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{sku.sku_code}</div>
            <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>View forecast →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
