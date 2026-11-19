"""Einrichtungs- und Optionsdialog."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_ICON,
    CONF_NAME,
    CONF_REQUIRE_ADMIN,
    CONF_THEME,
    DEFAULT_ICON,
    DEFAULT_NAME,
    DEFAULT_REQUIRE_ADMIN,
    DEFAULT_THEME,
    DOMAIN,
)


def _schema(defaults: dict[str, Any]) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_NAME, default=defaults.get(CONF_NAME, DEFAULT_NAME)): str,
            vol.Required(
                CONF_ICON, default=defaults.get(CONF_ICON, DEFAULT_ICON)
            ): selector.IconSelector(),
            vol.Optional(
                CONF_THEME,
                description={"suggested_value": defaults.get(CONF_THEME, DEFAULT_THEME) or None},
            ): selector.ThemeSelector(),
            vol.Required(
                CONF_REQUIRE_ADMIN,
                default=defaults.get(CONF_REQUIRE_ADMIN, DEFAULT_REQUIRE_ADMIN),
            ): bool,
        }
    )


class HausVisualisierungConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Einrichtung: nur Name, Symbol, Design und Admin-Sperre."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title=user_input[CONF_NAME], data=user_input)
        return self.async_show_form(step_id="user", data_schema=_schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        return HausVisualisierungOptionsFlow()


class HausVisualisierungOptionsFlow(config_entries.OptionsFlow):
    """Panel-Optionen ändern. Das Layout wird im Panel selbst gepflegt."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            user_input.setdefault(CONF_THEME, "")
            return self.async_create_entry(title="", data=user_input)
        current = {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(step_id="init", data_schema=_schema(current))
