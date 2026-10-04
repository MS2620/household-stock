from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
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
            HouseholdStockLowStockSensor(coordinator, entry.entry_id, item_id)
            for item_id in coordinator.data
        ]
    )

    hass.data[DOMAIN].setdefault("binary_entity_callbacks", {})[entry.entry_id] = (
        lambda items: async_add_entities(
            [
                HouseholdStockLowStockSensor(coordinator, entry.entry_id, item.item_id)
                for item in items
            ]
        )
    )


class HouseholdStockLowStockSensor(BinarySensorEntity):
    _attr_has_entity_name = True
    _attr_translation_key = "low_stock"
    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_icon = "mdi:package-down"

    def __init__(
        self,
        coordinator: HouseholdStockCoordinator,
        entry_id: str,
        item_id: str,
    ) -> None:
        self.coordinator = coordinator
        self.item_id = item_id
        self._attr_unique_id = f"{entry_id}_{item_id}_low_stock"
        self._entry_id = entry_id

    @property
    def device_info(self):
        item = self.item
        return {
            "identifiers": {(DOMAIN, f"{self._entry_id}_{self.item_id}")},
            "name": item.name if item else "Household Stock Item",
            "manufacturer": "MS2620",
            "model": "Household Stock Item",
        }

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(
            self.coordinator.async_add_listener(self._handle_update)
        )

    def _handle_update(self) -> None:
        self.async_write_ha_state()

    @property
    def item(self) -> StockItem | None:
        return self.coordinator.data.get(self.item_id)

    @property
    def is_on(self) -> bool:
        return bool(self.item and self.item.is_low_stock)

    @property
    def available(self) -> bool:
        return self.item is not None
