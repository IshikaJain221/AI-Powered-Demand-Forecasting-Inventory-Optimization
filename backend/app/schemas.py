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
