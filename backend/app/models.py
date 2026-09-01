from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.db import Base


class SKU(Base):
    __tablename__ = "skus"

    id = Column(Integer, primary_key=True)
    sku_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    category = Column(String, nullable=True)
    behavior_class = Column(String, nullable=True)  # seasonal / stable / volatile / intermittent

    sales = relationship("SalesRecord", back_populates="sku")
    forecasts = relationship("ForecastResult", back_populates="sku")


class SalesRecord(Base):
    __tablename__ = "sales_records"

    id = Column(Integer, primary_key=True)
    sku_id = Column(Integer, ForeignKey("skus.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    units_sold = Column(Float, nullable=False)
    price = Column(Float, nullable=True)
    is_promo = Column(Integer, default=0)  # 0/1 flag

    sku = relationship("SKU", back_populates="sales")


class ForecastResult(Base):
    __tablename__ = "forecast_results"

    id = Column(Integer, primary_key=True)
    sku_id = Column(Integer, ForeignKey("skus.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    model_name = Column(String, nullable=False)  # xgboost / prophet / lstm
    predicted_units = Column(Float, nullable=False)
    mape = Column(Float, nullable=True)
    is_best_model = Column(Integer, default=0)

    sku = relationship("SKU", back_populates="forecasts")
