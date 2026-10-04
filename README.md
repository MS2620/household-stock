# Household Stock

A native Home Assistant integration for managing household inventory.

## Home Assistant integration

The integration lives in `custom_components/household_stock` and stores inventory directly in Home Assistant.

It provides:

- Config-flow setup
- Persistent inventory storage
- A Home Assistant device for each stock item
- Quantity sensor and editable quantity control
- Editable low-stock threshold
- Low-stock binary sensor
- Consume and restock buttons
- Add, update, consume, restock, set-quantity and delete services
- Category, unit, barcode and location metadata
- Automatic integration with Home Assistant's shopping list
- Diagnostics
- Add inventory items from the integration's Configure screen
- Native Household Stock Lovelace dashboard card
- Automated Home Assistant integration tests, model tests and Python/JavaScript validation

### Install for development

Copy the `custom_components/household_stock` directory into your Home Assistant `config/custom_components` directory, restart Home Assistant, then add **Household Stock** from **Settings → Devices & services → Add integration**.

The integration is self-contained. It does not require PostgreSQL, Docker, Node.js, or an external API.

### Add an inventory item

Go to **Settings → Devices & services → Household Stock → Configure**. The Configure screen opens an **Add inventory item** form where you can enter the item name, category, unit, quantity, low-stock threshold, barcode, location and shopping-list settings.

### Household Stock dashboard card

The integration includes a self-contained Lovelace card at:

```text
/household_stock/household-stock-card.js
```

After installing or updating the integration and restarting Home Assistant:

1. Go to **Settings → Dashboards → Resources**.
2. Add `/household_stock/household-stock-card.js` as a **JavaScript Module** resource.
3. Add a card to a dashboard and choose **Household Stock** from the custom card picker, or use:

```yaml
type: custom:household-stock-card
title: Household Stock
sort: name
```

The card supports searching, adding items, consuming/restocking by one unit, editing item metadata and quantity, and deleting items. It talks directly to Home Assistant services.

### Development tests

Install the test dependencies with:

```bash
python -m pip install -r requirements_test.txt
```

Run the complete test suite:

```bash
pytest -q
```

The CI workflow runs the same test suite, plus Python compilation, Ruff static validation and JavaScript syntax validation.

### Inventory flow

```text
Inventory
   │
   ├── Quantity
   ├── Low-stock threshold
   ├── Consume / Restock
   └── Metadata
          │
          ▼
     Low-stock state
          │
          ▼
 Home Assistant Shopping List
          │
          ▼
       Restocked
```
