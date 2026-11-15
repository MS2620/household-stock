from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import DOMAIN
from .storage import HouseholdStockStore


class HouseholdStockCoordinator(DataUpdateCoordinator[dict]):
    def __init__(self, hass: HomeAssistant, store: HouseholdStockStore) -> None:
        super().__init__(
            hass,
            logger=logging.getLogger(__name__),
            name=DOMAIN,
        )
        self.store = store
        self.data = store.items

    async def async_refresh(self) -> None:
        self.data = self.store.items
        self.async_set_updated_data(self.data)
