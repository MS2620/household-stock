from __future__ import annotations

from homeassistant.components.text import TextEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SERVICE_UPDATE_ITEM
from .coordinator import HouseholdStockCoordinator
from .models import StockItem


_FIELDS = {
    "name": ("Name", "mdi:tag-outline"),
    "category": ("Category", "mdi:shape-outline"),
    "unit": ("Unit", "mdi:counter"),
    "barcode": ("Barcode", "mdi:barcode"),
    "location": ("Location", "mdi:map-marker"),
    "shopping_list_item": ("Shopping list item", "mdi:format-list-bulleted"),
}


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: HouseholdStockCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            HouseholdStockText(coordinator, entry.entry_id, item_id, field)
            for item_id in coordinator.data
            for field in _FIELDS
        ]
    )

    hass.data[DOMAIN].setdefault("text_entity_callbacks", {})[entry.entry_id] = (
        lambda items: async_add_entities(
            [
                HouseholdStockText(coordinator, entry.entry_id, item.item_id, field)
                for item in items
                for field in _FIELDS
            ]
        )
    )


class HouseholdStockText(TextEntity):
    _attr_has_entity_name = True
    _attr_native_min = 0
    _attr_native_max = 255

    def __init__(
        self,
        coordinator: HouseholdStockCoordinator,
        entry_id: str,
        item_id: str,
        field: str,
    ) -> None:
        self.coordinator = coordinator
        self.entry_id = entry_id
        self.item_id = item_id
        self.field = field
        self._attr_translation_key = field
        self._attr_native_min = 1 if field == "name" else 0
        self._attr_icon = _FIELDS[field][1]
        self._attr_unique_id = f"{entry_id}_{item_id}_{field}"

    @property
    def item(self) -> StockItem | None:
        return self.coordinator.data.get(self.item_id)

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, f"{self.entry_id}_{self.item_id}")},
            "name": self.item.name if self.item else "Household Stock Item",
            "manufacturer": "MS2620",
            "model": "Household Stock Item",
        }

    @property
    def native_value(self) -> str:
        if not self.item:
            return ""
        return getattr(self.item, self.field) or ""

    async def async_set_value(self, value: str) -> None:
        if self.item:
            await self.hass.services.async_call(
                DOMAIN,
                SERVICE_UPDATE_ITEM,
                {"item_id": self.item_id, self.field: value or None},
                blocking=True,
            )

    @property
    def available(self) -> bool:
        return self.item is not None
