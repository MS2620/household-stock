from __future__ import annotations

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import device_registry as dr

from .const import (
    ATTR_AUTO_ADD_TO_SHOPPING_LIST,
    ATTR_BARCODE,
    ATTR_CATEGORY,
    ATTR_ITEM_ID,
    ATTR_LOCATION,
    ATTR_LOW_STOCK_THRESHOLD,
    ATTR_NAME,
    ATTR_QUANTITY,
    ATTR_UNIT,
    DOMAIN,
    PLATFORMS,
    SERVICE_ADD_ITEM,
    SERVICE_CONSUME_ITEM,
    SERVICE_DELETE_ITEM,
    SERVICE_RESTOCK_ITEM,
    SERVICE_SET_QUANTITY,
    SERVICE_UPDATE_ITEM,
)
from .coordinator import HouseholdStockCoordinator
from .models import StockItem
from .storage import HouseholdStockStore


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    card_path = str(__import__("pathlib").Path(__file__).parent / "www" / "household-stock-card.js")
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/household_stock/household-stock-card.js", card_path, False)]
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = HouseholdStockStore(hass)
    await store.async_load()

    coordinator = HouseholdStockCoordinator(hass, store)
    hass.data[DOMAIN][entry.entry_id] = coordinator
    hass.data[DOMAIN].setdefault("entity_callbacks", {})
    hass.data[DOMAIN].setdefault("binary_entity_callbacks", {})
    hass.data[DOMAIN].setdefault("button_entity_callbacks", {})
    hass.data[DOMAIN].setdefault("number_entity_callbacks", {})
    hass.data[DOMAIN].setdefault("text_entity_callbacks", {})

    async def add_item(call: ServiceCall) -> None:
        item = StockItem(
            item_id="",
            name=call.data[ATTR_NAME],
            category=call.data.get(ATTR_CATEGORY, "Other"),
            unit=call.data.get(ATTR_UNIT, "item"),
            quantity=float(call.data.get(ATTR_QUANTITY, 0)),
            low_stock_threshold=float(call.data.get(ATTR_LOW_STOCK_THRESHOLD, 1)),
            barcode=call.data.get(ATTR_BARCODE),
            location=call.data.get(ATTR_LOCATION),
            shopping_list_item=call.data.get("shopping_list_item"),
            auto_add_to_shopping_list=call.data.get("auto_add_to_shopping_list", True),
        )
        await store.async_add_item(item)
        await _sync_shopping_list(item, False)
        callback = hass.data[DOMAIN]["entity_callbacks"].get(entry.entry_id)
        if callback:
            callback([item])
        binary_callback = hass.data[DOMAIN]["binary_entity_callbacks"].get(entry.entry_id)
        if binary_callback:
            binary_callback([item])
        button_callback = hass.data[DOMAIN]["button_entity_callbacks"].get(entry.entry_id)
        if button_callback:
            button_callback([item])
        number_callback = hass.data[DOMAIN]["number_entity_callbacks"].get(entry.entry_id)
        if number_callback:
            number_callback([item])
        text_callback = hass.data[DOMAIN]["text_entity_callbacks"].get(entry.entry_id)
        if text_callback:
            text_callback([item])
        await coordinator.async_refresh()

    async def consume_item(call: ServiceCall) -> None:
        item = store.items.get(call.data[ATTR_ITEM_ID])
        if item is None:
            return
        was_low = item.is_low_stock
        amount = float(call.data.get(ATTR_QUANTITY, 1))
        item = await store.async_adjust_quantity(item.item_id, -amount)
        if item:
            await _sync_shopping_list(item, was_low)
        await coordinator.async_refresh()

    async def restock_item(call: ServiceCall) -> None:
        item = store.items.get(call.data[ATTR_ITEM_ID])
        if item is None:
            return
        was_low = item.is_low_stock
        amount = float(call.data.get(ATTR_QUANTITY, 1))
        item = await store.async_adjust_quantity(item.item_id, amount)
        if item:
            await _sync_shopping_list(item, was_low)
        await coordinator.async_refresh()

    async def _sync_shopping_list(item: StockItem, was_low: bool) -> None:
        if not item.auto_add_to_shopping_list:
            return
        name = item.shopping_list_item or item.name
        if not was_low and item.is_low_stock and hass.services.has_service("shopping_list", "add_item"):
            await hass.services.async_call(
                "shopping_list", "add_item", {"name": name}, blocking=True
            )
        elif was_low and not item.is_low_stock and hass.services.has_service("shopping_list", "complete_item"):
            await hass.services.async_call(
                "shopping_list", "complete_item", {"name": name}, blocking=True
            )

    async def set_quantity(call: ServiceCall) -> None:
        item = store.items.get(call.data[ATTR_ITEM_ID])
        if item is None:
            return
        was_low = item.is_low_stock
        item = await store.async_update_quantity(
            item.item_id, float(call.data[ATTR_QUANTITY])
        )
        if item:
            await _sync_shopping_list(item, was_low)
        await coordinator.async_refresh()

    async def update_item(call: ServiceCall) -> None:
        item = store.items.get(call.data[ATTR_ITEM_ID])
        if item is None:
            return
        was_low = item.is_low_stock
        changes = {
            field: call.data[field]
            for field in (
                ATTR_NAME,
                ATTR_CATEGORY,
                ATTR_UNIT,
                ATTR_LOW_STOCK_THRESHOLD,
                ATTR_BARCODE,
                ATTR_LOCATION,
                "shopping_list_item",
                ATTR_AUTO_ADD_TO_SHOPPING_LIST,
            )
            if field in call.data
        }
        item = await store.async_update_item(item.item_id, **changes)
        if item:
            device_registry = dr.async_get(hass)
            device = device_registry.async_get_device(
                identifiers={(DOMAIN, f"{entry.entry_id}_{item.item_id}")}
            )
            if device:
                device_registry.async_update_device(device.id, name=item.name)
            await _sync_shopping_list(item, was_low)
        await coordinator.async_refresh()

    async def delete_item(call: ServiceCall) -> None:
        item_id = call.data[ATTR_ITEM_ID]
        if not await store.async_delete_item(item_id):
            return
        device_registry = dr.async_get(hass)
        device = device_registry.async_get_device(
            identifiers={(DOMAIN, f"{entry.entry_id}_{item_id}")}
        )
        if device:
            device_registry.async_remove_device(device.id)
        await coordinator.async_refresh()

    service_schemas = {
        SERVICE_ADD_ITEM: vol.Schema(
            {
                vol.Required(ATTR_NAME): vol.All(str, vol.Length(min=1)),
                vol.Optional(ATTR_CATEGORY, default="Other"): str,
                vol.Optional(ATTR_UNIT, default="item"): str,
                vol.Optional(ATTR_QUANTITY, default=0): vol.All(vol.Coerce(float), vol.Range(min=0)),
                vol.Optional(ATTR_LOW_STOCK_THRESHOLD, default=1): vol.All(vol.Coerce(float), vol.Range(min=0)),
                vol.Optional(ATTR_BARCODE): str,
                vol.Optional(ATTR_LOCATION): str,
                vol.Optional("shopping_list_item"): str,
                vol.Optional(ATTR_AUTO_ADD_TO_SHOPPING_LIST, default=True): bool,
            }
        ),
        SERVICE_CONSUME_ITEM: vol.Schema(
            {
                vol.Required(ATTR_ITEM_ID): str,
                vol.Optional(ATTR_QUANTITY, default=1): vol.All(vol.Coerce(float), vol.Range(min=0.1)),
            }
        ),
        SERVICE_RESTOCK_ITEM: vol.Schema(
            {
                vol.Required(ATTR_ITEM_ID): str,
                vol.Optional(ATTR_QUANTITY, default=1): vol.Coerce(float),
            }
        ),
        SERVICE_SET_QUANTITY: vol.Schema(
            {
                vol.Required(ATTR_ITEM_ID): str,
                vol.Required(ATTR_QUANTITY): vol.All(vol.Coerce(float), vol.Range(min=0)),
            }
        ),
        SERVICE_UPDATE_ITEM: vol.Schema(
            {
                vol.Required(ATTR_ITEM_ID): str,
                vol.Optional(ATTR_NAME): vol.All(str, vol.Length(min=1)),
                vol.Optional(ATTR_CATEGORY): str,
                vol.Optional(ATTR_UNIT): str,
                vol.Optional(ATTR_LOW_STOCK_THRESHOLD): vol.All(vol.Coerce(float), vol.Range(min=0)),
                vol.Optional(ATTR_BARCODE): str,
                vol.Optional(ATTR_LOCATION): str,
                vol.Optional("shopping_list_item"): str,
                vol.Optional(ATTR_AUTO_ADD_TO_SHOPPING_LIST): bool,
            }
        ),
        SERVICE_DELETE_ITEM: vol.Schema({vol.Required(ATTR_ITEM_ID): str}),
    }

    for service, handler in (
        (SERVICE_ADD_ITEM, add_item),
        (SERVICE_CONSUME_ITEM, consume_item),
        (SERVICE_RESTOCK_ITEM, restock_item),
        (SERVICE_SET_QUANTITY, set_quantity),
        (SERVICE_UPDATE_ITEM, update_item),
        (SERVICE_DELETE_ITEM, delete_item),
    ):
        hass.services.async_register(
            DOMAIN, service, handler, schema=service_schemas[service]
        )

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        for service in (
            SERVICE_ADD_ITEM,
            SERVICE_CONSUME_ITEM,
            SERVICE_RESTOCK_ITEM,
            SERVICE_SET_QUANTITY,
            SERVICE_UPDATE_ITEM,
            SERVICE_DELETE_ITEM,
        ):
            hass.services.async_remove(DOMAIN, service)
        hass.data[DOMAIN].get("entity_callbacks", {}).pop(entry.entry_id, None)
        hass.data[DOMAIN].get("binary_entity_callbacks", {}).pop(entry.entry_id, None)
        hass.data[DOMAIN].get("button_entity_callbacks", {}).pop(entry.entry_id, None)
        hass.data[DOMAIN].get("number_entity_callbacks", {}).pop(entry.entry_id, None)
        hass.data[DOMAIN].get("text_entity_callbacks", {}).pop(entry.entry_id, None)
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unloaded
