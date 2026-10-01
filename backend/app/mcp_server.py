"""
Real MCP (Model Context Protocol) server for this app.

Exposes the app's own data — forecasts, BOM trees, and inventory recommendations —
as proper MCP tools over stdio JSON-RPC, following the MCP spec (not a custom
imitation). Any MCP-compatible client (Claude Desktop, this app's own Copilot,
or any other MCP host) can connect to this and call these tools.

Run standalone for testing: python -m app.mcp_server
Run as a client subprocess: this module is what the Copilot's MCPToolBridge launches.
"""
from mcp.server.fastmcp import FastMCP

from app.db import SessionLocal
from app.models import SKU, ForecastResult, Component
from app.services.bom_engine import build_bom_tree, recommend_production_start
from app.services.news_monitor import check_component_news, NewsMonitorError

from datetime import date as date_cls

mcp = FastMCP("demand-forecast-inventory")


@mcp.tool()
def list_skus() -> list[dict]:
    """List every tracked SKU with its id, code, and behavior classification."""
    db = SessionLocal()
    try:
        skus = db.query(SKU).all()
        return [
            {"id": s.id, "sku_code": s.sku_code, "behavior_class": s.behavior_class}
            for s in skus
        ]
    finally:
        db.close()


@mcp.tool()
def get_forecast(sku_code: str) -> dict:
    """Get the latest demand forecast for a SKU, including which model (XGBoost,
    Prophet, or LSTM) was selected as best and its accuracy (MAPE)."""
    db = SessionLocal()
    try:
        sku = db.query(SKU).filter(SKU.sku_code == sku_code).first()
        if not sku:
            return {"error": f"No SKU found with code {sku_code}"}

        results = (
            db.query(ForecastResult)
            .filter(ForecastResult.sku_id == sku.id)
            .order_by(ForecastResult.date)
            .all()
        )
        if not results:
            return {"error": f"No forecast has been run yet for {sku_code}"}

        best = next((r for r in results if r.is_best_model), results[0])
        return {
            "sku_code": sku_code,
            "best_model": best.model_name,
            "mape": best.mape,
            "predicted_units": best.predicted_units,
            "forecast_date": str(best.date),
        }
    finally:
        db.close()


@mcp.tool()
def list_components() -> list[dict]:
    """List every component/product in the Bill of Materials system, with id,
    name, source region, and category."""
    db = SessionLocal()
    try:
        components = db.query(Component).all()
        return [
            {"id": c.id, "name": c.name, "source_region": c.source_region, "category": c.category}
            for c in components
        ]
    finally:
        db.close()


@mcp.tool()
def get_bom_tree(component_id: int) -> dict:
    """Get the full multi-tier Bill of Materials tree for a component (e.g. a
    finished product), including each part's current lead time and any known
    supply disruption affecting it."""
    db = SessionLocal()
    try:
        node = build_bom_tree(db, component_id)

        def serialize(n):
            return {
                "name": n.component.name,
                "source_region": n.component.source_region,
                "effective_lead_time_days": n.effective_lead_time_days,
                "disruption": (
                    {
                        "type": n.latest_news.disruption_type,
                        "extra_delay_days": n.latest_news.estimated_delay_days,
                        "headline": n.latest_news.headline,
                    }
                    if n.latest_news and n.latest_news.disruption_type != "none"
                    else None
                ),
                "children": [serialize(c) for c in n.children],
            }

        return serialize(node)
    except ValueError as e:
        return {"error": str(e)}
    finally:
        db.close()


@mcp.tool()
def get_production_recommendation(root_component_id: int, target_ship_date: str, target_units: int) -> dict:
    """Given a target ship date (YYYY-MM-DD) and desired unit volume, calculate
    whether production is feasible, the latest safe start date, and which
    disrupted components (if any) are driving the timeline."""
    db = SessionLocal()
    try:
        parsed_date = date_cls.fromisoformat(target_ship_date)
        return recommend_production_start(db, root_component_id, parsed_date, target_units)
    except ValueError as e:
        return {"error": str(e)}
    finally:
        db.close()


@mcp.tool()
def check_supply_disruption_news(component_id: int) -> dict:
    """Run a live news search for a specific component to check for current
    supply disruptions (export bans, tariffs, shortages). This calls out to
    a live search and may take a few seconds."""
    db = SessionLocal()
    try:
        component = db.query(Component).filter(Component.id == component_id).first()
        if not component:
            return {"error": f"No component with id {component_id}"}
        try:
            return check_component_news(component.name, component.source_region, component.category)
        except NewsMonitorError as e:
            return {"error": str(e)}
    finally:
        db.close()


if __name__ == "__main__":
    mcp.run(transport="stdio")
