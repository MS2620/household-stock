from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any


@dataclass
class StockItem:
    item_id: str
    name: str
    category: str = "Other"
    unit: str = "item"
    quantity: float = 0
    low_stock_threshold: float = 1
    barcode: str | None = None
    location: str | None = None
    shopping_list_item: str | None = None
    auto_add_to_shopping_list: bool = True
    created_at: str | None = None
    updated_at: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> StockItem:
        return cls(
            item_id=str(data["item_id"]),
            name=str(data["name"]),
            category=str(data.get("category", "Other")),
            unit=str(data.get("unit", "item")),
            quantity=float(data.get("quantity", 0)),
            low_stock_threshold=float(data.get("low_stock_threshold", 1)),
            barcode=data.get("barcode"),
            location=data.get("location"),
            shopping_list_item=data.get("shopping_list_item"),
            auto_add_to_shopping_list=bool(data.get("auto_add_to_shopping_list", True)),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def is_low_stock(self) -> bool:
        return self.quantity <= self.low_stock_threshold

    def touch(self) -> None:
        self.updated_at = datetime.now().isoformat()
