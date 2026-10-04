from __future__ import annotations

import logging

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback

from .const import (
    ATTR_AUTO_ADD_TO_SHOPPING_LIST,
    ATTR_BARCODE,
    ATTR_CATEGORY,
    ATTR_LOCATION,
    ATTR_LOW_STOCK_THRESHOLD,
    ATTR_NAME,
    ATTR_QUANTITY,
    ATTR_UNIT,
    DOMAIN,
    SERVICE_ADD_ITEM,
)

_LOGGER = logging.getLogger(__name__)


class HouseholdStockConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        return HouseholdStockOptionsFlowHandler()

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(title="Household Stock", data={})

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({}),
        )


class HouseholdStockOptionsFlowHandler(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        errors: dict[str, str] = {}

        if user_input is not None:
            try:
                await self.hass.services.async_call(
                    DOMAIN,
                    SERVICE_ADD_ITEM,
                    {
                        ATTR_NAME: user_input[ATTR_NAME],
                        ATTR_CATEGORY: user_input[ATTR_CATEGORY],
                        ATTR_UNIT: user_input[ATTR_UNIT],
                        ATTR_QUANTITY: user_input[ATTR_QUANTITY],
                        ATTR_LOW_STOCK_THRESHOLD: user_input[ATTR_LOW_STOCK_THRESHOLD],
                        ATTR_BARCODE: user_input.get(ATTR_BARCODE),
                        ATTR_LOCATION: user_input.get(ATTR_LOCATION),
                        "shopping_list_item": user_input.get("shopping_list_item"),
                        ATTR_AUTO_ADD_TO_SHOPPING_LIST: user_input[ATTR_AUTO_ADD_TO_SHOPPING_LIST],
                    },
                    blocking=True,
                )
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Failed to add inventory item from options flow")
                errors["base"] = "unknown"
            else:
                return self.async_create_entry(data={})

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
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
                    vol.Optional(
                        ATTR_AUTO_ADD_TO_SHOPPING_LIST, default=True
                    ): bool,
                }
            ),
            errors=errors,
        )
