from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SKU, ForecastResult
from app.schemas import SKUOut, ForecastResponse, ForecastPoint
from app.services.forecasting import run_forecast_for_sku, run_forecast_all

router = APIRouter(prefix="/api", tags=["forecast"])


@router.get("/skus", response_model=list[SKUOut])
def list_skus(db: Session = Depends(get_db)):
    return db.query(SKU).all()


@router.post("/forecast/run")
def run_all(db: Session = Depends(get_db)):
    run_forecast_all(db)
    return {"status": "done"}


@router.post("/forecast/run/{sku_code}")
def run_one(sku_code: str, db: Session = Depends(get_db)):
    sku = db.query(SKU).filter(SKU.sku_code == sku_code).first()
    if not sku:
        raise HTTPException(404, "SKU not found")
    best_model = run_forecast_for_sku(db, sku)
    return {"sku_code": sku_code, "best_model": best_model}


@router.get("/forecast/{sku_code}", response_model=ForecastResponse)
def get_forecast(sku_code: str, db: Session = Depends(get_db)):
    sku = db.query(SKU).filter(SKU.sku_code == sku_code).first()
    if not sku:
        raise HTTPException(404, "SKU not found")

    results = (
        db.query(ForecastResult)
        .filter(ForecastResult.sku_id == sku.id)
        .order_by(ForecastResult.date)
        .all()
    )
    if not results:
        raise HTTPException(404, "No forecast yet — call POST /api/forecast/run/{sku_code} first")

    best = next((r for r in results if r.is_best_model), results[0])
    return ForecastResponse(
        sku_code=sku_code,
        best_model=best.model_name,
        points=[
            ForecastPoint(date=r.date, predicted_units=r.predicted_units, model_name=r.model_name, mape=r.mape)
            for r in results
        ],
    )
