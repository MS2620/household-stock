# Household Stock

Household Stock started as a Next.js application for managing household inventory. The repository now also contains a native Home Assistant integration.

## Home Assistant integration

The native integration lives in `custom_components/household_stock` and stores inventory directly in Home Assistant.

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
- Native Household Stock Lovelace dashboard card for day-to-day inventory management
- Automated Home Assistant integration tests, model tests and Python/JavaScript validation

### Install for development

Copy the `custom_components/household_stock` directory into your Home Assistant `config/custom_components` directory, restart Home Assistant, then add **Household Stock** from **Settings → Devices & services → Add integration**.

The integration does not require the Next.js application, PostgreSQL, Docker or an external API.

### Add an inventory item

After installing the integration, go to **Settings → Devices & services → Household Stock → Configure**. The Configure screen opens an **Add inventory item** form where you can enter the item name, category, unit, quantity, low-stock threshold, barcode, location and shopping-list settings. This creates the item immediately in Home Assistant.

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

The card supports searching, adding items, consuming/restocking by one unit, editing item metadata and quantity, and deleting items. It talks directly to the Home Assistant `household_stock` services; the Next.js application is not involved.

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

## Original web application

The original web application remains in the repository for development and historical use.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 to view the application.
