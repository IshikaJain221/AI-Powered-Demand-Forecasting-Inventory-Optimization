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
