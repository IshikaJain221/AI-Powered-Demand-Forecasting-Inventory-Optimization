from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Component, ComponentEdge, NewsSignal
from app.schemas import ComponentCreate, ComponentOut, ComponentEdgeCreate, BOMNodeOut, RecommendationRequest
from app.services.bom_engine import build_bom_tree, recommend_production_start
from app.services.news_monitor import check_component_news, NewsMonitorError

router = APIRouter(prefix="/api/supply-chain", tags=["supply-chain"])


@router.post("/components", response_model=ComponentOut)
def create_component(payload: ComponentCreate, db: Session = Depends(get_db)):
    component = Component(**payload.model_dump())
    db.add(component)
    db.commit()
    db.refresh(component)
    return component


@router.get("/components", response_model=list[ComponentOut])
def list_components(db: Session = Depends(get_db)):
    return db.query(Component).all()


@router.post("/edges")
def create_edge(payload: ComponentEdgeCreate, db: Session = Depends(get_db)):
    edge = ComponentEdge(**payload.model_dump())
    db.add(edge)
    db.commit()
    return {"status": "ok"}


def _node_to_out(node) -> BOMNodeOut:
    disruption = None
    if node.latest_news:
        disruption = {
            "disruption_type": node.latest_news.disruption_type,
            "estimated_delay_days": node.latest_news.estimated_delay_days,
            "headline": node.latest_news.headline,
            "checked_at": str(node.latest_news.checked_at),
        }
    return BOMNodeOut(
        id=node.component.id,
        name=node.component.name,
        source_region=node.component.source_region,
        category=node.component.category,
        effective_lead_time_days=node.effective_lead_time_days,
        disruption=disruption,
        children=[_node_to_out(c) for c in node.children],
    )


@router.get("/tree/{component_id}", response_model=BOMNodeOut)
def get_tree(component_id: int, db: Session = Depends(get_db)):
    try:
        tree = build_bom_tree(db, component_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return _node_to_out(tree)


@router.post("/check-news/{component_id}")
def check_news(component_id: int, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(404, "Component not found")

    try:
        result = check_component_news(component.name, component.source_region, component.category)
    except NewsMonitorError as e:
        raise HTTPException(502, str(e))

    signal = NewsSignal(
        component_id=component_id,
        headline=result["headline"],
        source_url=result.get("source_url"),
        disruption_type=result["disruption_type"],
        estimated_delay_days=result["estimated_delay_days"],
        confidence=result["confidence"],
        checked_at=date.today(),
    )
    db.add(signal)
    db.commit()
    return result


@router.post("/check-news-tree/{component_id}")
def check_news_for_tree(component_id: int, db: Session = Depends(get_db)):
    """Runs check-news for every component in the subtree (leaf-up), so a whole
    product's BOM gets refreshed in one call instead of one request per leaf."""
    try:
        tree = build_bom_tree(db, component_id)
    except ValueError as e:
        raise HTTPException(404, str(e))

    checked = []
    errors = []

    def walk(node):
        for c in node.children:
            walk(c)
        try:
            result = check_component_news(node.component.name, node.component.source_region, node.component.category)
            signal = NewsSignal(
                component_id=node.component.id,
                headline=result["headline"],
                source_url=result.get("source_url"),
                disruption_type=result["disruption_type"],
                estimated_delay_days=result["estimated_delay_days"],
                confidence=result["confidence"],
                checked_at=date.today(),
            )
            db.add(signal)
            checked.append({"component": node.component.name, **result})
        except NewsMonitorError as e:
            errors.append({"component": node.component.name, "error": str(e)})

    walk(tree)
    db.commit()
    return {"checked": checked, "errors": errors}


@router.post("/recommend")
def recommend(payload: RecommendationRequest, db: Session = Depends(get_db)):
    try:
        return recommend_production_start(db, payload.root_component_id, payload.target_ship_date, payload.target_units)
    except ValueError as e:
        raise HTTPException(404, str(e))
