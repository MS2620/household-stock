from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
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
            HouseholdStockSummarySensor(coordinator, entry.entry_id),
            *[
                HouseholdStockItemSensor(coordinator, entry.entry_id, item_id)
                for item_id in coordinator.data
            ],
        ]
    )

    hass.data[DOMAIN].setdefault("entity_callbacks", {})[entry.entry_id] = (
        lambda items: async_add_entities(
            [
                HouseholdStockItemSensor(coordinator, entry.entry_id, item.item_id)
                for item in items
            ]
        )
    )


class HouseholdStockBaseSensor(SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, coordinator: HouseholdStockCoordinator, entry_id: str) -> None:
        self.coordinator = coordinator
        self._entry_id = entry_id
        self._attr_should_poll = False

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self._entry_id)},
            "name": "Household Stock",
            "manufacturer": "MS2620",
            "model": "Household Inventory",
        }

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(
            self.coordinator.async_add_listener(self._handle_coordinator_update)
        )

    def _handle_coordinator_update(self) -> None:
        self.async_write_ha_state()


class HouseholdStockSummarySensor(HouseholdStockBaseSensor):
    _attr_translation_key = "items"
    _attr_icon = "mdi:package-variant"

    def __init__(self, coordinator, entry_id) -> None:
        super().__init__(coordinator, entry_id)
        self._attr_unique_id = f"{entry_id}_items"

    @property
    def native_value(self) -> int:
        return len(self.coordinator.data)

    @property
    def extra_state_attributes(self) -> dict:
        low_stock = sum(item.is_low_stock for item in self.coordinator.data.values())
        total_units = sum(item.quantity for item in self.coordinator.data.values())
        return {
            "low_stock_items": low_stock,
            "total_quantity": total_units,
        }


class HouseholdStockItemSensor(HouseholdStockBaseSensor):
    _attr_icon = "mdi:package-variant-closed"

    def __init__(self, coordinator, entry_id, item_id: str) -> None:
        super().__init__(coordinator, entry_id)
        self.item_id = item_id
        self._attr_unique_id = f"{entry_id}_{item_id}"

    @property
    def device_info(self):
        item = self.item
        return {
            "identifiers": {(DOMAIN, f"{self._entry_id}_{self.item_id}")},
            "name": item.name if item else "Household Stock Item",
            "manufacturer": "MS2620",
            "model": "Household Stock Item",
        }

    @property
    def item(self) -> StockItem | None:
        return self.coordinator.data.get(self.item_id)

    @property
    def name(self) -> str:
        return self.item.name if self.item else "Household Stock Item"

    @property
    def native_value(self) -> float | None:
        return self.item.quantity if self.item else None

    @property
    def native_unit_of_measurement(self) -> str | None:
        return self.item.unit if self.item else None

    @property
    def extra_state_attributes(self) -> dict:
        if not self.item:
            return {}
        return {
            "item_id": self.item.item_id,
            "category": self.item.category,
            "low_stock_threshold": self.item.low_stock_threshold,
            "low_stock": self.item.is_low_stock,
            "barcode": self.item.barcode,
            "location": self.item.location,
            "shopping_list_item": self.item.shopping_list_item,
            "auto_add_to_shopping_list": self.item.auto_add_to_shopping_list,
            "created_at": self.item.created_at,
            "updated_at": self.item.updated_at,
        }

    @property
    def available(self) -> bool:
        return self.item is not None
