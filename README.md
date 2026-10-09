# Demand Forecasting & Inventory Optimization

Phase 1 scaffold: data ingestion + multi-model forecasting engine (XGBoost, Prophet, LSTM)
with automatic per-SKU model selection. Later phases (fingerprinting, memory, simulator,
copilot) build on top of this.

## Stack    
- Backend: FastAPI + SQLAlchemy + Postgres
- Forecasting: XGBoost, Prophet, PyTorch (LSTM)   
- Frontend: Next.js (scaffold only for now — build out after backend is solid)   

## Getting the dataset

This scaffold is built around the **M5 Forecasting - Accuracy** dataset (Walmart, ~30k SKUs,
years of daily sales). It requires a free Kaggle account and can't be auto-downloaded from
this environment, so:

1. Go to https://www.kaggle.com/competitions/m5-forecasting-accuracy/data
2. Download `sales_train_validation.csv`, `calendar.csv`, `sell_prices.csv`
3. Place them in `backend/data/raw/`
4. Run `python -m app.services.data_loader` to load a subset into Postgres

If you want something lighter to get moving today, `backend/data/sample_sales.csv` has a
tiny synthetic multi-SKU dataset (3 SKUs, 180 days) so you can run the pipeline end-to-end
before wrangling the real M5 files.

## Setup

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your Postgres URL, and ANTHROPIC_API_KEY for the supply-chain news feature
uvicorn app.main:app --reload
```

## Supply chain risk (live news + Bill of Materials)

This models products as a multi-tier Bill of Materials (e.g. iPhone → chip → silicon wafer),
each with a source region, and checks **live news** (via the Anthropic API's web search tool)
for disruptions like export bans that would delay that component — then recommends when to
start production to hit a target ship date and volume.

Needs `ANTHROPIC_API_KEY` set in `backend/.env` (get one at console.anthropic.com). Seed the
demo BOM tree with:
```bash
python -m app.services.seed_bom
```
Then use the "Supply chain risk" page in the frontend, or hit the API directly:
- `GET /api/supply-chain/components`
- `GET /api/supply-chain/tree/{component_id}`
- `POST /api/supply-chain/check-news-tree/{component_id}` — refreshes news for every node
- `POST /api/supply-chain/recommend` — body: `{root_component_id, target_ship_date, target_units}`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on http://localhost:3000. It proxies `/api/*` calls to the backend at
`localhost:8000`, so start the backend first (see Setup above).

Pages: Overview (SKU list + risk), Forecasting, Risk & shocks, Simulation, Copilot,
Backtesting, and a per-SKU detail page with tabs (Forecast, Safety stock, Shock
fingerprints, What-if, Explanation).

Only the **Overview** and **Forecast** tab call the real backend right now. Everything
else (risk scores, fingerprints, safety stock, what-if simulator, copilot answers,
backtesting) runs on deterministic mock data so the UI is fully built out and demoable —
each of those sections is marked with a small "sample data" tag. As you build each
backend phase, swap the matching function in `frontend/lib/mockData.js` for a real
`frontend/lib/api.js` call.

## Where to go next (see roadmap)
1. ✅ Data model + forecasting engine (this scaffold)
2. SKU behavior profiling + dynamic safety stock
3. Demand Shock Fingerprinting + Memory
4. What-If Simulator + Counterfactual Inventory Engine
5. Explainability, risk scoring, AI copilot
6. Decision feedback learning + backtesting
