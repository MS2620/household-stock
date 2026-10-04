from __future__ import annotations

from pathlib import Path

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
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


def _get_runtime(hass: HomeAssistant) -> tuple[HouseholdStockCoordinator, HouseholdStockStore, str]:
    entry_id = hass.data[DOMAIN].get("entry_id")
    if not entry_id:
        raise ServiceValidationError("Household Stock is not configured")

    coordinator = hass.data[DOMAIN].get(entry_id)
    if coordinator is None:
        raise ServiceValidationError("Household Stock is not loaded")

    return coordinator, coordinator.store, entry_id


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    data = hass.data.setdefault(DOMAIN, {})
    data.setdefault("entity_callbacks", {})
    data.setdefault("binary_entity_callbacks", {})
    data.setdefault("button_entity_callbacks", {})
    data.setdefault("number_entity_callbacks", {})
    data.setdefault("text_entity_callbacks", {})

    card_path = str(Path(__file__).parent / "www" / "household-stock-card.js")
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/household_stock/household-stock-card.js", card_path, False)]
    )

    async def sync_shopping_list(item: StockItem, was_low: bool) -> None:
        if not item.auto_add_to_shopping_list:
            return

        name = item.shopping_list_item or item.name
        if (
            not was_low
            and item.is_low_stock
            and hass.services.has_service("shopping_list", "add_item")
        ):
            await hass.services.async_call(
                "shopping_list", "add_item", {"name": name}, blocking=True
            )
        elif (
            was_low
            and not item.is_low_stock
            and hass.services.has_service("shopping_list", "complete_item")
        ):
            await hass.services.async_call(
                "shopping_list", "complete_item", {"name": name}, blocking=True
            )

    async def add_item(call: ServiceCall) -> None:
        coordinator, store, entry_id = _get_runtime(hass)
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
            auto_add_to_shopping_list=call.data.get(
                ATTR_AUTO_ADD_TO_SHOPPING_LIST, True
            ),
        )
        await store.async_add_item(item)
        await sync_shopping_list(item, False)

        callbacks = (
            ("entity_callbacks", "entity_callbacks"),
            ("binary_entity_callbacks", "binary_entity_callbacks"),
            ("button_entity_callbacks", "button_entity_callbacks"),
            ("number_entity_callbacks", "number_entity_callbacks"),
            ("text_entity_callbacks", "text_entity_callbacks"),
        )
        for key, _ in callbacks:
            callback = hass.data[DOMAIN][key].get(entry_id)
            if callback:
                callback([item])

        await coordinator.async_refresh()

    async def consume_item(call: ServiceCall) -> None:
        coordinator, store, _ = _get_runtime(hass)
        item = store.items.get(call.data[ATTR_ITEM_ID])
        if item is None:
            raise ServiceValidationError("Unknown inventory item")

        was_low = item.is_low_stock
        amount = float(call.data.get(ATTR_QUANTITY, 1))
        item = await store.async_adjust_quantity(item.item_id, -amount)
        if item:
            await sync_shopping_list(item, was_low)
        await coordinator.async_refresh()

    async def restock_item(call: ServiceCall) -> None:
        coordinator, store, _ = _get_runtime(hass)
        item = store.items.get(call.data[ATTR_ITEM_ID])
        if item is None:
            raise ServiceValidationError("Unknown inventory item")

        was_low = item.is_low_stock
        amount = float(call.data.get(ATTR_QUANTITY, 1))
        item = await store.async_adjust_quantity(item.item_id, amount)
        if item:
            await sync_shopping_list(item, was_low)
        await coordinator.async_refresh()

    async def set_quantity(call: ServiceCall) -> None:
        coordinator, store, _ = _get_runtime(hass)
        item = store.items.get(call.data[ATTR_ITEM_ID])
        if item is None:
            raise ServiceValidationError("Unknown inventory item")

        was_low = item.is_low_stock
        item = await store.async_update_quantity(
            item.item_id, float(call.data[ATTR_QUANTITY])
        )
        if item:
            await sync_shopping_list(item, was_low)
        await coordinator.async_refresh()

    async def update_item(call: ServiceCall) -> None:
        coordinator, store, entry_id = _get_runtime(hass)
        item = store.items.get(call.data[ATTR_ITEM_ID])
        if item is None:
            raise ServiceValidationError("Unknown inventory item")

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
                identifiers={(DOMAIN, f"{entry_id}_{item.item_id}")}
            )
            if device:
                device_registry.async_update_device(device.id, name=item.name)
            await sync_shopping_list(item, was_low)
        await coordinator.async_refresh()

    async def delete_item(call: ServiceCall) -> None:
        coordinator, store, entry_id = _get_runtime(hass)
        item_id = call.data[ATTR_ITEM_ID]
        if not await store.async_delete_item(item_id):
            raise ServiceValidationError("Unknown inventory item")

        device_registry = dr.async_get(hass)
        device = device_registry.async_get_device(
            identifiers={(DOMAIN, f"{entry_id}_{item_id}")}
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
                vol.Optional(ATTR_QUANTITY, default=0): vol.All(
                    vol.Coerce(float), vol.Range(min=0)
                ),
                vol.Optional(ATTR_LOW_STOCK_THRESHOLD, default=1): vol.All(
                    vol.Coerce(float), vol.Range(min=0)
                ),
                vol.Optional(ATTR_BARCODE): str,
                vol.Optional(ATTR_LOCATION): str,
                vol.Optional("shopping_list_item"): str,
                vol.Optional(ATTR_AUTO_ADD_TO_SHOPPING_LIST, default=True): bool,
            }
        ),
        SERVICE_CONSUME_ITEM: vol.Schema(
            {
                vol.Required(ATTR_ITEM_ID): str,
                vol.Optional(ATTR_QUANTITY, default=1): vol.All(
                    vol.Coerce(float), vol.Range(min=0.1)
                ),
            }
        ),
        SERVICE_RESTOCK_ITEM: vol.Schema(
            {
                vol.Required(ATTR_ITEM_ID): str,
                vol.Optional(ATTR_QUANTITY, default=1): vol.All(
                    vol.Coerce(float), vol.Range(min=0.1)
                ),
            }
        ),
        SERVICE_SET_QUANTITY: vol.Schema(
            {
                vol.Required(ATTR_ITEM_ID): str,
                vol.Required(ATTR_QUANTITY): vol.All(
                    vol.Coerce(float), vol.Range(min=0)
                ),
            }
        ),
        SERVICE_UPDATE_ITEM: vol.Schema(
            {
                vol.Required(ATTR_ITEM_ID): str,
                vol.Optional(ATTR_NAME): vol.All(str, vol.Length(min=1)),
                vol.Optional(ATTR_CATEGORY): str,
                vol.Optional(ATTR_UNIT): str,
                vol.Optional(ATTR_LOW_STOCK_THRESHOLD): vol.All(
                    vol.Coerce(float), vol.Range(min=0)
                ),
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

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = HouseholdStockStore(hass)
    await store.async_load()

    coordinator = HouseholdStockCoordinator(hass, store)
    hass.data[DOMAIN][entry.entry_id] = coordinator
    hass.data[DOMAIN]["entry_id"] = entry.entry_id

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        if hass.data[DOMAIN].get("entry_id") == entry.entry_id:
            hass.data[DOMAIN].pop("entry_id", None)

        for callbacks_key in (
            "entity_callbacks",
            "binary_entity_callbacks",
            "button_entity_callbacks",
            "number_entity_callbacks",
            "text_entity_callbacks",
        ):
            hass.data[DOMAIN].get(callbacks_key, {}).pop(entry.entry_id, None)

    return unloaded
