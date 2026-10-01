"""
Loads sales data into Postgres.

Two modes:
- load_sample(): tiny synthetic dataset, good for getting the pipeline running today
- load_m5(): real M5 Forecasting - Accuracy dataset (must be downloaded manually, see README)
"""
import pandas as pd
from sqlalchemy.orm import Session

from app.db import SessionLocal, Base, engine
from app.models import SKU, SalesRecord

DATA_DIR = "data"


def get_or_create_sku(db: Session, sku_code: str, name: str = None, category: str = None) -> SKU:
    sku = db.query(SKU).filter(SKU.sku_code == sku_code).first()
    if sku:
        return sku
    sku = SKU(sku_code=sku_code, name=name, category=category)
    db.add(sku)
    db.commit()
    db.refresh(sku)
    return sku


def load_sample():
    """Loads backend/data/sample_sales.csv — columns: sku_code,date,units_sold,price,is_promo"""
    Base.metadata.create_all(bind=engine)
    df = pd.read_csv(f"{DATA_DIR}/sample_sales.csv", parse_dates=["date"])
    db = SessionLocal()
    try:
        for sku_code, group in df.groupby("sku_code"):
            sku = get_or_create_sku(db, sku_code)
            for _, row in group.iterrows():
                exists = (
                    db.query(SalesRecord)
                    .filter(SalesRecord.sku_id == sku.id, SalesRecord.date == row["date"].date())
                    .first()
                )
                if exists:
                    continue
                db.add(SalesRecord(
                    sku_id=sku.id,
                    date=row["date"].date(),
                    units_sold=row["units_sold"],
                    price=row.get("price"),
                    is_promo=int(row.get("is_promo", 0)),
                ))
        db.commit()
        print(f"Loaded {len(df)} sales rows across {df['sku_code'].nunique()} SKUs.")
    finally:
        db.close()


def load_m5(sku_limit: int = 200):
    """
    Loads the real M5 dataset. Expects sales_train_validation.csv, calendar.csv,
    sell_prices.csv in data/raw/ (see README for download instructions).

    sku_limit caps how many SKUs get loaded — the full M5 set (~30k SKUs) is heavy
    to train LSTM/XGBoost/Prophet on for every SKU in a demo environment.
    """
    Base.metadata.create_all(bind=engine)
    sales = pd.read_csv(f"{DATA_DIR}/raw/sales_train_validation.csv")
    calendar = pd.read_csv(f"{DATA_DIR}/raw/calendar.csv", parse_dates=["date"])

    day_cols = [c for c in sales.columns if c.startswith("d_")]
    sales = sales.head(sku_limit)

    date_map = dict(zip(calendar["d"], calendar["date"]))

    db = SessionLocal()
    try:
        for _, row in sales.iterrows():
            sku = get_or_create_sku(db, row["item_id"], category=row.get("cat_id"))
            for d in day_cols:
                units = row[d]
                if pd.isna(units):
                    continue
                db.add(SalesRecord(
                    sku_id=sku.id,
                    date=date_map[d].date(),
                    units_sold=float(units),
                ))
        db.commit()
        print(f"Loaded {sku_limit} SKUs from M5.")
    finally:
        db.close()


if __name__ == "__main__":
    load_sample()
