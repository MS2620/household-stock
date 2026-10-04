from unittest.mock import AsyncMock

import pytest
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError

from custom_components.household_stock.const import (
    ATTR_ITEM_ID,
    DOMAIN,
    SERVICE_ADD_ITEM,
    SERVICE_CONSUME_ITEM,
    SERVICE_DELETE_ITEM,
    SERVICE_RESTOCK_ITEM,
    SERVICE_SET_QUANTITY,
    SERVICE_UPDATE_ITEM,
)


async def _add_item(hass: HomeAssistant, name: str = "Milk", **kwargs) -> str:
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ITEM,
        {"name": name, **kwargs},
        blocking=True,
    )
    coordinator = hass.data[DOMAIN][hass.data[DOMAIN]["entry_id"]]
    return next(item_id for item_id, item in coordinator.data.items() if item.name == name)


@pytest.mark.usefixtures("stock_entry")
async def test_add_item_persists_defaults(hass: HomeAssistant) -> None:
    item_id = await _add_item(hass, "Milk")
    coordinator = hass.data[DOMAIN][hass.data[DOMAIN]["entry_id"]]
    item = coordinator.data[item_id]

    assert item.name == "Milk"
    assert item.category == "Other"
    assert item.unit == "item"
    assert item.quantity == 0
    assert item.low_stock_threshold == 1
    assert item.is_low_stock


@pytest.mark.usefixtures("stock_entry")
async def test_quantity_services_enforce_non_negative_quantity(
    hass: HomeAssistant,
) -> None:
    item_id = await _add_item(hass, "Milk", quantity=5)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_CONSUME_ITEM,
        {ATTR_ITEM_ID: item_id, "quantity": 2},
        blocking=True,
    )
    coordinator = hass.data[DOMAIN][hass.data[DOMAIN]["entry_id"]]
    assert coordinator.data[item_id].quantity == 3

    await hass.services.async_call(
        DOMAIN,
        SERVICE_CONSUME_ITEM,
        {ATTR_ITEM_ID: item_id, "quantity": 10},
        blocking=True,
    )
    assert coordinator.data[item_id].quantity == 0

    await hass.services.async_call(
        DOMAIN,
        SERVICE_RESTOCK_ITEM,
        {ATTR_ITEM_ID: item_id, "quantity": 4},
        blocking=True,
    )
    assert coordinator.data[item_id].quantity == 4

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_QUANTITY,
        {ATTR_ITEM_ID: item_id, "quantity": 2},
        blocking=True,
    )
    assert coordinator.data[item_id].quantity == 2


@pytest.mark.usefixtures("stock_entry")
async def test_update_item_supports_clearing_optional_fields(
    hass: HomeAssistant,
) -> None:
    item_id = await _add_item(
        hass,
        "Milk",
        barcode="123",
        location="Fridge",
        shopping_list_item="Semi-skimmed milk",
    )

    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ITEM,
        {
            ATTR_ITEM_ID: item_id,
            "name": "Oat Milk",
            "category": "Dairy alternatives",
            "unit": "carton",
            "low_stock_threshold": 2,
            "barcode": "",
            "location": "",
            "shopping_list_item": "",
            "auto_add_to_shopping_list": False,
        },
        blocking=True,
    )

    coordinator = hass.data[DOMAIN][hass.data[DOMAIN]["entry_id"]]
    item = coordinator.data[item_id]
    assert item.name == "Oat Milk"
    assert item.category == "Dairy alternatives"
    assert item.unit == "carton"
    assert item.low_stock_threshold == 2
    assert item.barcode == ""
    assert item.location == ""
    assert item.shopping_list_item == ""
    assert item.auto_add_to_shopping_list is False


@pytest.mark.usefixtures("stock_entry")
async def test_low_stock_shopping_list_transitions(hass: HomeAssistant) -> None:
    added = AsyncMock()
    completed = AsyncMock()
    hass.services.async_register("shopping_list", "add_item", added)
    hass.services.async_register("shopping_list", "complete_item", completed)

    item_id = await _add_item(
        hass,
        "Milk",
        quantity=3,
        low_stock_threshold=1,
        shopping_list_item="Milk",
    )

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_QUANTITY,
        {ATTR_ITEM_ID: item_id, "quantity": 1},
        blocking=True,
    )
    added.assert_awaited_once_with(
        ServiceCall("shopping_list", "add_item", {"name": "Milk"})
    )

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_QUANTITY,
        {ATTR_ITEM_ID: item_id, "quantity": 2},
        blocking=True,
    )
    completed.assert_awaited_once_with(
        ServiceCall("shopping_list", "complete_item", {"name": "Milk"})
    )


@pytest.mark.usefixtures("stock_entry")
async def test_invalid_item_id_is_rejected(hass: HomeAssistant) -> None:
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_CONSUME_ITEM,
            {ATTR_ITEM_ID: "does-not-exist", "quantity": 1},
            blocking=True,
        )


@pytest.mark.usefixtures("stock_entry")
async def test_delete_item_removes_item(hass: HomeAssistant) -> None:
    item_id = await _add_item(hass, "Milk")

    await hass.services.async_call(
        DOMAIN,
        SERVICE_DELETE_ITEM,
        {ATTR_ITEM_ID: item_id},
        blocking=True,
    )

    coordinator = hass.data[DOMAIN][hass.data[DOMAIN]["entry_id"]]
    assert item_id not in coordinator.data

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_DELETE_ITEM,
            {ATTR_ITEM_ID: item_id},
            blocking=True,
        )
