from __future__ import annotations

from homeassistant.components.number import NumberEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import ATTR_LOW_STOCK_THRESHOLD, DOMAIN, SERVICE_SET_QUANTITY, SERVICE_UPDATE_ITEM
from .coordinator import HouseholdStockCoordinator
from .models import StockItem


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: HouseholdStockCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            entity
            for item_id in coordinator.data
            for entity in (
                HouseholdStockNumber(
                    coordinator, entry.entry_id, item_id, "quantity"
                ),
                HouseholdStockNumber(
                    coordinator, entry.entry_id, item_id, "threshold"
                ),
            )
        ]
    )

    hass.data[DOMAIN].setdefault("number_entity_callbacks", {})[entry.entry_id] = (
        lambda items: async_add_entities(
            [
                entity
                for item in items
                for entity in (
                    HouseholdStockNumber(
                        coordinator, entry.entry_id, item.item_id, "quantity"
                    ),
                    HouseholdStockNumber(
                        coordinator, entry.entry_id, item.item_id, "threshold"
                    ),
                )
            ]
        )
    )


class HouseholdStockNumber(NumberEntity):
    _attr_has_entity_name = True
    _attr_native_min_value = 0
    _attr_native_max_value = 1000000
    _attr_native_step = 1

    def __init__(
        self,
        coordinator: HouseholdStockCoordinator,
        entry_id: str,
        item_id: str,
        kind: str,
    ) -> None:
        self.coordinator = coordinator
        self.entry_id = entry_id
        self.item_id = item_id
        self.kind = kind
        self._attr_translation_key = kind
        self._attr_icon = "mdi:counter" if kind == "quantity" else "mdi:alert-circle-outline"
        self._attr_unique_id = f"{entry_id}_{item_id}_{kind}_control"

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, f"{self.entry_id}_{self.item_id}")},
            "name": self.item.name if self.item else "Household Stock Item",
            "manufacturer": "MS2620",
            "model": "Household Stock Item",
        }

    @property
    def item(self) -> StockItem | None:
        return self.coordinator.data.get(self.item_id)

    @property
    def native_value(self) -> float | None:
        if not self.item:
            return None
        return (
            self.item.quantity
            if self.kind == "quantity"
            else self.item.low_stock_threshold
        )

    async def async_set_native_value(self, value: float) -> None:
        if not self.item:
            return
        service = SERVICE_SET_QUANTITY if self.kind == "quantity" else SERVICE_UPDATE_ITEM
        data = (
            {"item_id": self.item_id, "quantity": value}
            if self.kind == "quantity"
            else {"item_id": self.item_id, ATTR_LOW_STOCK_THRESHOLD: value}
        )
        await self.hass.services.async_call(DOMAIN, service, data, blocking=True)

    @property
    def available(self) -> bool:
        return self.item is not None
