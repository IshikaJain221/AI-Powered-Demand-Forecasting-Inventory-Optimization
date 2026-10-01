"""
Multi-tier Bill-of-Materials engine.

Given a root component (e.g. "iPhone"), walks the BOM tree down to leaf
components (e.g. raw chips), pulls the latest news-based delay estimate for
each leaf, and propagates the worst-case delay back up to the root — since a
finished product can't ship faster than its slowest/most-disrupted input.

Then, given a target ship date and desired unit volume, computes the latest
safe production start date and flags whether the user needs to wait.
"""
from datetime import date, timedelta
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models import Component, ComponentEdge, NewsSignal


@dataclass
class BOMNode:
    component: Component
    children: list["BOMNode"] = field(default_factory=list)
    latest_news: NewsSignal | None = None

    @property
    def effective_lead_time_days(self) -> int:
        """This node's own lead time, adjusted for the most recent disruption found."""
        extra = self.latest_news.estimated_delay_days if self.latest_news else 0
        return self.component.base_lead_time_days + extra

    @property
    def critical_path_lead_time_days(self) -> int:
        """The lead time for this node INCLUDING its slowest child chain —
        a product can't be finished before its most-delayed input arrives."""
        own = self.effective_lead_time_days
        if not self.children:
            return own
        worst_child = max(c.critical_path_lead_time_days for c in self.children)
        return own + worst_child


def build_bom_tree(db: Session, component_id: int, _depth: int = 0) -> BOMNode:
    if _depth > 10:
        raise ValueError("BOM tree too deep (possible cycle)")

    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise ValueError(f"Component {component_id} not found")

    node = BOMNode(component=component)

    latest_signal = (
        db.query(NewsSignal)
        .filter(NewsSignal.component_id == component_id)
        .order_by(NewsSignal.checked_at.desc())
        .first()
    )
    node.latest_news = latest_signal

    edges = db.query(ComponentEdge).filter(ComponentEdge.parent_id == component_id).all()
    for edge in edges:
        node.children.append(build_bom_tree(db, edge.child_id, _depth + 1))

    return node


def flatten_disrupted_nodes(node: BOMNode) -> list[BOMNode]:
    """Every node in the tree that currently has a disruption affecting its lead time."""
    found = []
    if node.latest_news and node.latest_news.disruption_type != "none" and node.latest_news.estimated_delay_days > 0:
        found.append(node)
    for c in node.children:
        found.extend(flatten_disrupted_nodes(c))
    return found


def recommend_production_start(
    db: Session,
    root_component_id: int,
    target_ship_date: date,
    target_units: int,
) -> dict:
    """
    Core recommendation: given the current (news-adjusted) BOM lead time and the
    root component's production capacity, work backward from the target ship
    date to find the latest safe start date, and flag if that's already in the past
    (i.e. the user needs to push their target date out).
    """
    tree = build_bom_tree(db, root_component_id)

    lead_time_days = tree.critical_path_lead_time_days
    capacity_per_day = max(1, tree.component.units_per_day_capacity)
    production_duration_days = -(-target_units // capacity_per_day)  # ceil division

    total_days_needed = lead_time_days + production_duration_days
    latest_safe_start = target_ship_date - timedelta(days=total_days_needed)
    today = date.today()

    feasible = latest_safe_start >= today
    disrupted = flatten_disrupted_nodes(tree)

    recommendation = {
        "root_component": tree.component.name,
        "lead_time_days": lead_time_days,
        "production_duration_days": production_duration_days,
        "total_days_needed": total_days_needed,
        "latest_safe_start_date": latest_safe_start.isoformat(),
        "feasible_with_target_date": feasible,
        "disrupted_components": [
            {
                "name": n.component.name,
                "disruption_type": n.latest_news.disruption_type,
                "extra_delay_days": n.latest_news.estimated_delay_days,
                "headline": n.latest_news.headline,
                "source_url": n.latest_news.source_url,
            }
            for n in disrupted
        ],
    }

    if not feasible:
        shortfall_days = (today - latest_safe_start).days
        # Suggest pushing the ship date out by the shortfall, rounded up to whole months for readability
        suggested_new_date = target_ship_date + timedelta(days=shortfall_days)
        recommendation["suggested_new_ship_date"] = suggested_new_date.isoformat()
        recommendation["message"] = (
            f"With current disruptions, {tree.component.name} needs {total_days_needed} days "
            f"({lead_time_days} lead time + {production_duration_days} to produce {target_units} units), "
            f"but only {(target_ship_date - today).days} days remain until your target date. "
            f"Recommend shipping no earlier than {suggested_new_date.isoformat()}, "
            f"which means starting production around {(suggested_new_date - timedelta(days=total_days_needed)).isoformat()}."
        )
    else:
        recommendation["suggested_new_ship_date"] = None
        recommendation["message"] = (
            f"On track — start production by {latest_safe_start.isoformat()} to hit your "
            f"target ship date, given current lead times and known disruptions."
        )

    return recommendation
