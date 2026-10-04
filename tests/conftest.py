import pytest_asyncio
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntryState
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.household_stock.const import DOMAIN


@pytest_asyncio.fixture
async def stock_entry(hass: HomeAssistant, enable_custom_integrations) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Household Stock",
        data={},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    return entry
