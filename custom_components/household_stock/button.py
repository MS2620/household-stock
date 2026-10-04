from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SERVICE_CONSUME_ITEM, SERVICE_RESTOCK_ITEM
from .coordinator import HouseholdStockCoordinator
from .models import StockItem


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: HouseholdStockCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[ButtonEntity] = []
    for item_id, item in coordinator.data.items():
        entities.extend(
            [
                HouseholdStockActionButton(
                    coordinator, entry.entry_id, item_id, SERVICE_CONSUME_ITEM
                ),
                HouseholdStockActionButton(
                    coordinator, entry.entry_id, item_id, SERVICE_RESTOCK_ITEM
                ),
            ]
        )
    async_add_entities(entities)

    hass.data[DOMAIN].setdefault("button_entity_callbacks", {})[entry.entry_id] = (
        lambda items: async_add_entities(
            [
                button
                for item in items
                for button in (
                    HouseholdStockActionButton(
                        coordinator, entry.entry_id, item.item_id, SERVICE_CONSUME_ITEM
                    ),
                    HouseholdStockActionButton(
                        coordinator, entry.entry_id, item.item_id, SERVICE_RESTOCK_ITEM
                    ),
                )
            ]
        )
    )


class HouseholdStockActionButton(ButtonEntity):
    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: HouseholdStockCoordinator,
        entry_id: str,
        item_id: str,
        action: str,
    ) -> None:
        self.coordinator = coordinator
        self.entry_id = entry_id
        self.item_id = item_id
        self.action = action
        self._attr_unique_id = f"{entry_id}_{item_id}_{action}"
        self._attr_translation_key = "consume" if action == SERVICE_CONSUME_ITEM else "restock"
        self._attr_icon = (
            "mdi:minus-circle-outline"
            if action == SERVICE_CONSUME_ITEM
            else "mdi:plus-circle-outline"
        )

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
    def available(self) -> bool:
        return self.item_id in self.coordinator.data

    async def async_press(self) -> None:
        if self.item_id not in self.coordinator.data:
            return
        await self.hass.services.async_call(
            DOMAIN,
            self.action,
            {"item_id": self.item_id, "quantity": 1},
            blocking=True,
        )
