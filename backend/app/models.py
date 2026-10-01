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


class Component(Base):
    """A product, sub-assembly, or raw component. Products (e.g. 'iPhone') and their
    parts (e.g. 'A18 chip') are both rows here — the BOM tree below defines how they
    relate. A component can exist standalone (sellable) AND be part of a parent."""
    __tablename__ = "components"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    source_region = Column(String, nullable=True)  # e.g. "China", "Taiwan" — used for news search
    category = Column(String, nullable=True)  # e.g. "semiconductor", "display", "finished_good"
    base_lead_time_days = Column(Integer, default=14)  # normal lead time before any disruption
    units_per_day_capacity = Column(Integer, default=1000)  # how fast this can be produced/assembled


class ComponentEdge(Base):
    """Self-referential BOM edge: parent is made of `quantity` units of child.
    Enables multi-tier trees (a product's component can itself have sub-components)."""
    __tablename__ = "component_edges"

    id = Column(Integer, primary_key=True)
    parent_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    child_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    quantity = Column(Integer, default=1)

    parent = relationship("Component", foreign_keys=[parent_id])
    child = relationship("Component", foreign_keys=[child_id])


class NewsSignal(Base):
    """A disruption event found via live news search for a component's source region/category."""
    __tablename__ = "news_signals"

    id = Column(Integer, primary_key=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    headline = Column(String, nullable=False)
    source_url = Column(String, nullable=True)
    disruption_type = Column(String, nullable=True)  # e.g. "export_ban", "tariff", "shortage", "none"
    estimated_delay_days = Column(Integer, default=0)
    confidence = Column(Float, default=0.5)
    checked_at = Column(Date, nullable=False)

    component = relationship("Component")
