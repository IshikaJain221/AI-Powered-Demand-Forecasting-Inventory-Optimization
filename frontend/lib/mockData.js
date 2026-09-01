// Mock data for phases 2-6 (not built on the backend yet).
// Deterministic per SKU so the UI is stable across renders/pages —
// swap each function's body for a real /api call once that phase exists.

function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getBehaviorClass(skuCode) {
  const classes = ["stable", "seasonal", "volatile", "intermittent"];
  const rnd = mulberry32(seedFromString(skuCode));
  return classes[Math.floor(rnd() * classes.length)];
}

export function getRiskScore(skuCode) {
  const rnd = mulberry32(seedFromString(skuCode + "risk"));
  const score = Math.round(rnd() * 100);
  const level = score > 66 ? "high" : score > 33 ? "medium" : "low";
  return { score, level };
}

export function getSafetyStock(skuCode) {
  const rnd = mulberry32(seedFromString(skuCode + "safety"));
  return {
    currentUnits: Math.round(30 + rnd() * 120),
    recommendedUnits: Math.round(30 + rnd() * 140),
    leadTimeDays: Math.round(3 + rnd() * 10),
    serviceLevel: Math.round(90 + rnd() * 9),
  };
}

export function getFingerprints(skuCode) {
  const rnd = mulberry32(seedFromString(skuCode + "fp"));
  const templates = [
    { label: "Promo + weekend", impact: "+38% demand" },
    { label: "Payday + promo", impact: "+52% demand" },
    { label: "Competitor stockout", impact: "+21% demand" },
    { label: "Weather disruption", impact: "-18% demand" },
    { label: "Festival week", impact: "+64% demand" },
  ];
  const count = 2 + Math.floor(rnd() * 3);
  const shuffled = [...templates].sort(() => rnd() - 0.5).slice(0, count);
  return shuffled.map((t, i) => ({
    id: `${skuCode}-fp-${i}`,
    ...t,
    date: `2026-0${1 + Math.floor(rnd() * 8)}-${10 + Math.floor(rnd() * 18)}`,
    similarity: Math.round(70 + rnd() * 28),
  }));
}

export function getSupplierRisk(skuCode) {
  const rnd = mulberry32(seedFromString(skuCode + "supplier"));
  return {
    onTimeRate: Math.round(72 + rnd() * 26),
    avgDelayDays: +(rnd() * 4).toFixed(1),
    riskLevel: rnd() > 0.66 ? "high" : rnd() > 0.33 ? "medium" : "low",
  };
}

export function getCostBreakdown(skuCode) {
  const rnd = mulberry32(seedFromString(skuCode + "cost"));
  const holding = Math.round(200 + rnd() * 600);
  const ordering = Math.round(100 + rnd() * 300);
  const stockout = Math.round(50 + rnd() * 900);
  const lostSales = Math.round(50 + rnd() * 500);
  return { holding, ordering, stockout, lostSales, total: holding + ordering + stockout + lostSales };
}

export function getWhatIfScenario(skuCode, { priceChangePct, promo, supplierDelayDays }) {
  const rnd = mulberry32(seedFromString(skuCode + priceChangePct + promo + supplierDelayDays));
  const base = 40 + rnd() * 40;
  const priceEffect = -(priceChangePct / 100) * 0.6 * base;
  const promoEffect = promo ? base * 0.35 : 0;
  const delayPenalty = supplierDelayDays * 1.8;
  const projected = Math.max(0, Math.round(base + priceEffect + promoEffect));
  return {
    baseDemand: Math.round(base),
    projectedDemand: projected,
    stockoutRiskPct: Math.min(95, Math.round(10 + supplierDelayDays * 6 + rnd() * 15)),
    extraCost: Math.round(delayPenalty * 12),
  };
}

export function getCounterfactualOrders(skuCode) {
  const rnd = mulberry32(seedFromString(skuCode + "cf"));
  return [100, 200, 300].map((qty) => ({
    qty,
    stockoutRiskPct: Math.max(2, Math.round(40 - qty / 10 + rnd() * 10)),
    totalCost: Math.round(400 + qty * (2 + rnd()) + (qty < 200 ? rnd() * 500 : 0)),
  }));
}

export function getExplanation(skuCode) {
  const behavior = getBehaviorClass(skuCode);
  const { level } = getRiskScore(skuCode);
  const factors = {
    stable: "Demand has stayed within a narrow band, so the recommendation leans on recent trend more than volatility buffers.",
    seasonal: "A recurring cycle was detected in the sales history, so the forecast weights the same period last cycle heavily.",
    volatile: "Demand swings widely week to week, so a larger safety stock buffer is being carried to absorb the uncertainty.",
    intermittent: "Sales are sparse and irregular, so the model leans on frequency-of-demand patterns rather than a smooth trend line.",
  };
  return {
    summary: factors[behavior],
    riskNote:
      level === "high"
        ? "Risk is elevated mainly due to demand volatility combined with a longer supplier lead time."
        : level === "medium"
        ? "Risk is moderate — demand is reasonably predictable but supplier timing adds some uncertainty."
        : "Risk is low — demand is stable and supplier delivery has been reliable.",
  };
}

export function getBacktestResults() {
  return [
    { strategy: "Current (fixed safety stock)", stockoutRate: 14.2, avgCost: 812, serviceLevel: 91.1 },
    { strategy: "Dynamic safety stock", stockoutRate: 7.6, avgCost: 705, serviceLevel: 95.4 },
    { strategy: "Dynamic + fingerprint memory", stockoutRate: 4.1, avgCost: 668, serviceLevel: 97.8 },
  ];
}

export const MOCK_SKU_CODES = ["SKU_STABLE_001", "SKU_SEASONAL_002", "SKU_VOLATILE_003"];
