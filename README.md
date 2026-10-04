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
- Automated Python model tests and integration syntax validation

### Install for development

Copy the `custom_components/household_stock` directory into your Home Assistant `config/custom_components` directory, restart Home Assistant, then add **Household Stock** from **Settings → Devices & services → Add integration**.

The integration does not require the Next.js application, PostgreSQL, Docker or an external API.

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
