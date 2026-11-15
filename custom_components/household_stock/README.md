# Household Stock — Home Assistant integration

This directory contains the native Home Assistant integration.

Inventory data is stored by Home Assistant and is the source of truth.

## Current features

- Config-flow setup
- Persistent inventory storage
- Per-item Home Assistant devices
- Quantity sensor and native quantity control
- Native low-stock threshold control
- Low-stock binary sensor
- Consume and restock buttons
- Add, update, set-quantity, consume, restock, and delete services
- Editable category, unit, barcode, location and shopping-list name text entities
- Optional custom shopping-list item name
- Automatic shopping-list add when an item crosses into low stock
- Automatic shopping-list completion after it is restocked
- Home Assistant diagnostics
- Native Lovelace dashboard card

The integration is self-contained and does not require PostgreSQL, Docker, Node.js, or an external API.
