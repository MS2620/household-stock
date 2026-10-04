from unittest.mock import AsyncMock

import pytest
from homeassistant.config_entries import SOURCE_USER\nfrom homeassistant.core import HomeAssistant
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
    added.assert_awaited_once()
    assert added.await_args.args[0].data["name"] == "Milk"

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_QUANTITY,
        {ATTR_ITEM_ID: item_id, "quantity": 2},
        blocking=True,
    )
    completed.assert_awaited_once()
    assert completed.await_args.args[0].data["name"] == "Milk"


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


@pytest.mark.usefixtures("stock_entry")
async def test_item_sensor_name_is_not_duplicated(hass: HomeAssistant) -> None:
    await _add_item(hass, "Milk")

    states = [
        state
        for state in hass.states.async_all()
        if state.attributes.get("item_id")
    ]
    quantity_states = [state for state in states if state.entity_id.startswith("sensor.")]
    assert len(quantity_states) == 1
    assert quantity_states[0].name == "Milk Quantity"
    item_id = await _add_item(hass, "Butter")
    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ITEM,
        {ATTR_ITEM_ID: item_id, "name": "Salted Butter"},
        blocking=True,
    )
    updated = [
        state
        for state in hass.states.async_all()
        if state.attributes.get("item_id") == item_id
    ]
    assert updated[0].name == "Salted Butter Quantity"


@pytest.mark.usefixtures("stock_entry")
async def test_storage_survives_store_reload(hass: HomeAssistant) -> None:
    item_id = await _add_item(
        hass,
        "Pasta",
        category="Pantry",
        unit="pack",
        quantity=4,
        low_stock_threshold=1,
    )

    from custom_components.household_stock.storage import HouseholdStockStore

    reloaded = HouseholdStockStore(hass)
    await reloaded.async_load()

    assert reloaded.items[item_id].name == "Pasta"
    assert reloaded.items[item_id].category == "Pantry"
    assert reloaded.items[item_id].quantity == 4


@pytest.mark.usefixtures("stock_entry")
async def test_all_inventory_services_are_registered(hass: HomeAssistant) -> None:
    for service in (
        SERVICE_ADD_ITEM,
        SERVICE_CONSUME_ITEM,
        SERVICE_RESTOCK_ITEM,
        SERVICE_SET_QUANTITY,
        SERVICE_UPDATE_ITEM,
        SERVICE_DELETE_ITEM,
    ):
        assert hass.services.has_service(DOMAIN, service)


async def test_config_flow_creates_single_entry(hass: HomeAssistant, enable_custom_integrations) -> None:
    result = await hass.config_entries.flow.async_init(
        DOMAIN,
        context={"source": SOURCE_USER},
    )
    assert result["type"] == "form"
    assert result["step_id"] == "user"

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        user_input={},
    )
    assert result["type"] == "create_entry"
    assert result["title"] == "Household Stock"

    result = await hass.config_entries.flow.async_init(
        DOMAIN,
        context={"source": SOURCE_USER},
    )
    assert result["type"] == "abort"
    assert result["reason"] == "already_configured"


@pytest.mark.usefixtures("stock_entry")
async def test_text_entity_can_clear_optional_metadata(hass: HomeAssistant) -> None:
    item_id = await _add_item(hass, "Eggs", barcode="999")

    barcode_states = [
        state
        for state in hass.states.async_all()
        if state.entity_id.startswith("text.")
        and state.attributes.get("item_id") == item_id
        and state.attributes.get("friendly_name", "").endswith("Barcode")
    ]
    assert len(barcode_states) == 1

    await hass.services.async_call(
        "text",
        "set_value",
        {"entity_id": barcode_states[0].entity_id, "value": ""},
        blocking=True,
    )
    await hass.async_block_till_done()

    coordinator = hass.data[DOMAIN][hass.data[DOMAIN]["entry_id"]]
    assert coordinator.data[item_id].barcode == ""


@pytest.mark.usefixtures("stock_entry")
async def test_item_creates_all_native_entities(hass: HomeAssistant) -> None:
    await _add_item(hass, "Milk")

    assert len(hass.states.async_all("sensor")) == 2
    assert len(hass.states.async_all("binary_sensor")) == 1
    assert len(hass.states.async_all("button")) == 2
    assert len(hass.states.async_all("number")) == 2
    assert len(hass.states.async_all("text")) == 6
