from datetime import date
from pydantic import BaseModel


class SKUOut(BaseModel):
    id: int
    sku_code: str
    name: str | None = None
    category: str | None = None
    behavior_class: str | None = None

    class Config:
        from_attributes = True


class ForecastPoint(BaseModel):
    date: date
    predicted_units: float
    model_name: str
    mape: float | None = None


class ForecastResponse(BaseModel):
    sku_code: str
    best_model: str
    points: list[ForecastPoint]


class ComponentCreate(BaseModel):
    name: str
    source_region: str | None = None
    category: str | None = None
    base_lead_time_days: int = 14
    units_per_day_capacity: int = 1000


class ComponentOut(BaseModel):
    id: int
    name: str
    source_region: str | None = None
    category: str | None = None
    base_lead_time_days: int
    units_per_day_capacity: int

    class Config:
        from_attributes = True


class ComponentEdgeCreate(BaseModel):
    parent_id: int
    child_id: int
    quantity: int = 1


class BOMNodeOut(BaseModel):
    id: int
    name: str
    source_region: str | None = None
    category: str | None = None
    effective_lead_time_days: int
    disruption: dict | None = None
    children: list["BOMNodeOut"] = []


class RecommendationRequest(BaseModel):
    root_component_id: int
    target_ship_date: date
    target_units: int
