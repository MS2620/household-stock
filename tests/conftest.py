import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest_asyncio
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

# Make the repository root importable when pytest is invoked from CI.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from custom_components.household_stock import async_setup, async_setup_entry, async_unload_entry
from custom_components.household_stock.const import DOMAIN


@pytest_asyncio.fixture
async def stock_entry(
    hass: HomeAssistant, enable_custom_integrations
) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Household Stock",
        data={},
    )
    entry.add_to_hass(hass)
    if hass.http is None:
        hass.http = SimpleNamespace(async_register_static_paths=AsyncMock())
    else:
        hass.http.async_register_static_paths = AsyncMock()
    assert await async_setup(hass, {})
    assert await async_setup_entry(hass, entry)
    await hass.async_block_till_done()

    yield entry

    await async_unload_entry(hass, entry)
