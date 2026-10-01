"""Seeds a demo BOM tree: iPhone -> (Chip, Display, Battery); Chip -> Silicon Wafer.
Run with: python -m app.services.seed_bom
"""
from app.db import SessionLocal, Base, engine
from app.models import Component, ComponentEdge


def get_or_create(db, name, **kwargs):
    existing = db.query(Component).filter(Component.name == name).first()
    if existing:
        return existing
    c = Component(name=name, **kwargs)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        iphone = get_or_create(db, "iPhone", category="finished_good", base_lead_time_days=5, units_per_day_capacity=50000)
        chip = get_or_create(db, "A-series Chip", source_region="Taiwan", category="semiconductor", base_lead_time_days=30, units_per_day_capacity=200000)
        display = get_or_create(db, "OLED Display", source_region="South Korea", category="display", base_lead_time_days=20, units_per_day_capacity=150000)
        battery = get_or_create(db, "Battery Pack", source_region="China", category="battery", base_lead_time_days=15, units_per_day_capacity=300000)
        wafer = get_or_create(db, "Silicon Wafer", source_region="China", category="raw_material", base_lead_time_days=45, units_per_day_capacity=500000)

        def link(parent, child, qty=1):
            exists = db.query(ComponentEdge).filter(
                ComponentEdge.parent_id == parent.id, ComponentEdge.child_id == child.id
            ).first()
            if not exists:
                db.add(ComponentEdge(parent_id=parent.id, child_id=child.id, quantity=qty))

        link(iphone, chip)
        link(iphone, display)
        link(iphone, battery)
        link(chip, wafer)
        db.commit()
        print(f"Seeded BOM. Root component id for iPhone: {iphone.id}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
