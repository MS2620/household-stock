from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION
from .models import StockItem


class HouseholdStockStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self._store = Store[dict[str, Any]](hass, STORAGE_VERSION, STORAGE_KEY)
        self.items: dict[str, StockItem] = {}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if not data:
            return
        self.items = {
            item_id: StockItem.from_dict(item)
            for item_id, item in data.get("items", {}).items()
        }

    async def async_save(self) -> None:
        await self._store.async_save(
            {"items": {item_id: item.to_dict() for item_id, item in self.items.items()}}
        )

    async def async_add_item(self, item: StockItem) -> StockItem:
        now = datetime.now().isoformat()
        item.item_id = item.item_id or uuid.uuid4().hex
        item.created_at = item.created_at or now
        item.updated_at = now
        self.items[item.item_id] = item
        await self.async_save()
        return item

    async def async_delete_item(self, item_id: str) -> bool:
        if item_id not in self.items:
            return False
        del self.items[item_id]
        await self.async_save()
        return True

    async def async_update_item(
        self, item_id: str, **changes: Any
    ) -> StockItem | None:
        item = self.items.get(item_id)
        if item is None:
            return None

        for field in (
            "name",
            "category",
            "unit",
            "low_stock_threshold",
            "barcode",
            "location",
            "shopping_list_item",
            "auto_add_to_shopping_list",
        ):
            if field in changes:
                setattr(item, field, changes[field])

        item.touch()
        await self.async_save()
        return item

    async def async_update_quantity(self, item_id: str, quantity: float) -> StockItem | None:
        item = self.items.get(item_id)
        if item is None:
            return None
        item.quantity = max(0, float(quantity))
        item.touch()
        await self.async_save()
        return item

    async def async_adjust_quantity(self, item_id: str, delta: float) -> StockItem | None:
        item = self.items.get(item_id)
        if item is None:
            return None
        return await self.async_update_quantity(item_id, item.quantity + delta)
