from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    return {
        "item_count": len(coordinator.data),
        "items": [
            {
                "category": item.category,
                "unit": item.unit,
                "quantity": item.quantity,
                "low_stock_threshold": item.low_stock_threshold,
                "has_barcode": bool(item.barcode),
                "location": item.location,
            }
            for item in coordinator.data.values()
        ],
    }
