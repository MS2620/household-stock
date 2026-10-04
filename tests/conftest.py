import pytest_asyncio
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.household_stock.const import DOMAIN
from custom_components.household_stock.coordinator import HouseholdStockCoordinator
from custom_components.household_stock.storage import HouseholdStockStore


@pytest_asyncio.fixture
async def stock_entry(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Household Stock",
        data={},
    )
    entry.add_to_hass(hass)
    assert await async_setup_entry(hass, entry)
    await hass.async_block_till_done()

    yield entry

    await async_unload_entry(hass, entry)
