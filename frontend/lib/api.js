const BASE = "/api";

async function req(path, options) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  return res.json();
}

export function listSkus() {
  return req("/skus");
}

export function runForecast(skuCode) {
  return req(`/forecast/run/${skuCode}`, { method: "POST" });
}

export function getForecast(skuCode) {
  return req(`/forecast/${skuCode}`);
}

export function listComponents() {
  return req("/supply-chain/components");
}

export function getBomTree(componentId) {
  return req(`/supply-chain/tree/${componentId}`);
}

export function checkNews(componentId) {
  return req(`/supply-chain/check-news/${componentId}`, { method: "POST" });
}

export function checkNewsForTree(componentId) {
  return req(`/supply-chain/check-news-tree/${componentId}`, { method: "POST" });
}

export function getRecommendation({ rootComponentId, targetShipDate, targetUnits }) {
  return req("/supply-chain/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      root_component_id: rootComponentId,
      target_ship_date: targetShipDate,
      target_units: targetUnits,
    }),
  });
}

export function askCopilot(question) {
  return req("/copilot/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}
