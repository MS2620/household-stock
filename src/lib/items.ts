import { promises as fs } from "node:fs";
import path from "node:path";

export type ItemStatus = "shopping" | "bought" | "archived";

export type ShoppingItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: ItemStatus;
  isLowStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  barcode?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateItemInput = {
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  stockQuantity?: number;
  lowStockThreshold?: number;
  barcode?: string;
};

export type UpdateInventoryItemInput = {
  name: string;
  category: string;
  unit: string;
  stockQuantity: number;
  lowStockThreshold: number;
  barcode?: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "household-stock.json");

const initialData: ShoppingItem[] = [];

function normaliseName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

async function ensureDataFile() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(initialData, null, 2), "utf8");
  }
}

async function readItems(): Promise<ShoppingItem[]> {
  await ensureDataFile();

  const rawData = await fs.readFile(dataFile, "utf8");

  try {
    const parsed = JSON.parse(rawData);

    if (!Array.isArray(parsed)) {
      throw new Error("Inventory data must be an array.");
    }

    return parsed as ShoppingItem[];
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(initialData, null, 2), "utf8");
    return [];
  }
}

async function writeItems(items: ShoppingItem[]) {
  await ensureDataFile();

  const temporaryFile = `${dataFile}.tmp`;

  await fs.writeFile(temporaryFile, JSON.stringify(items, null, 2), "utf8");
  await fs.rename(temporaryFile, dataFile);
}

function nextId(items: ShoppingItem[]) {
  return items.reduce((highestId, item) => Math.max(highestId, item.id), 0) + 1;
}

export async function getShoppingItems() {
  const items = await readItems();

  return items
    .filter((item) => item.status === "shopping")
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );
}

export async function getBoughtItems() {
  const items = await readItems();

  return items
    .filter((item) => item.status === "bought")
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
}

export async function getBoughtItemById(id: number) {
  const items = await readItems();

  return (
    items.find((item) => item.id === id && item.status === "bought") ?? null
  );
}

export async function getLowStockItems() {
  const items = await readItems();

  return items
    .filter(
      (item) =>
        item.status === "bought" &&
        item.lowStockThreshold > 0 &&
        item.stockQuantity <= item.lowStockThreshold,
    )
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
}

export async function createOrIncreaseShoppingItem(input: CreateItemInput) {
  const items = await readItems();
  const name = normaliseName(input.name);
  const now = new Date().toISOString();

  const existingIndex = items.findIndex(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );

  if (existingIndex >= 0) {
    const existing = items[existingIndex];

    const updated: ShoppingItem = {
      ...existing,
      quantity: existing.quantity + (input.quantity ?? 1),
      status: "shopping",
      updatedAt: now,
    };

    items[existingIndex] = updated;
    await writeItems(items);

    return updated;
  }

  const created: ShoppingItem = {
    id: nextId(items),
    name,
    category: input.category ?? "Other",
    quantity: input.quantity ?? 1,
    unit: input.unit ?? "item",
    status: "shopping",
    isLowStock: false,
    stockQuantity: input.stockQuantity ?? 0,
    lowStockThreshold: input.lowStockThreshold ?? 0,
    barcode: input.barcode,
    createdAt: now,
    updatedAt: now,
  };

  items.push(created);
  await writeItems(items);

  return created;
}

export async function markItemBought(id: number) {
  const items = await readItems();
  const index = items.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  const item = items[index];
  const now = new Date().toISOString();

  const updated: ShoppingItem = {
    ...item,
    status: "bought",
    stockQuantity: item.stockQuantity + item.quantity,
    isLowStock: false,
    updatedAt: now,
  };

  items[index] = updated;
  await writeItems(items);

  return updated;
}

export async function updateInventoryItem(
  id: number,
  input: UpdateInventoryItemInput,
) {
  const items = await readItems();
  const index = items.findIndex(
    (item) => item.id === id && item.status === "bought",
  );

  if (index === -1) {
    return null;
  }

  const now = new Date().toISOString();
  const stockQuantity = input.stockQuantity;
  const lowStockThreshold = input.lowStockThreshold;

  const updated: ShoppingItem = {
    ...items[index],
    name: normaliseName(input.name),
    category: input.category.trim(),
    unit: input.unit.trim(),
    stockQuantity,
    lowStockThreshold,
    barcode: input.barcode?.trim() || undefined,
    isLowStock:
      lowStockThreshold > 0 && stockQuantity <= lowStockThreshold,
    updatedAt: now,
  };

  items[index] = updated;
  await writeItems(items);

  return updated;
}

export async function deleteItem(id: number) {
  const items = await readItems();
  const item = items.find((entry) => entry.id === id);

  if (!item) {
    return null;
  }

  await writeItems(items.filter((entry) => entry.id !== id));

  return item;
}

export async function consumeInventory(id: number, amount = 1) {
  const items = await readItems();
  const index = items.findIndex(
    (item) => item.id === id && item.status === "bought",
  );

  if (index === -1) {
    return null;
  }

  const item = items[index];
  const stockQuantity = Math.max(0, item.stockQuantity - amount);
  const isLowStock =
    item.lowStockThreshold > 0 &&
    stockQuantity <= item.lowStockThreshold;

  const now = new Date().toISOString();

  const updatedInventoryItem: ShoppingItem = {
    ...item,
    stockQuantity,
    isLowStock,
    updatedAt: now,
  };

  items[index] = updatedInventoryItem;

  let automaticallyAddedToShoppingList = false;

  if (isLowStock) {
    const itemAlreadyOnShoppingList = items.some(
      (entry) =>
        entry.status === "shopping" &&
        entry.name.toLowerCase() === item.name.toLowerCase(),
    );

    if (!itemAlreadyOnShoppingList) {
      const shoppingItem: ShoppingItem = {
        id: nextId(items),
        name: item.name,
        category: item.category,
        quantity: 1,
        unit: item.unit,
        status: "shopping",
        isLowStock: false,
        stockQuantity: 0,
        lowStockThreshold: item.lowStockThreshold,
        barcode: item.barcode,
        createdAt: now,
        updatedAt: now,
      };

      items.push(shoppingItem);
      automaticallyAddedToShoppingList = true;
    }
  }

  await writeItems(items);

  return {
    item: updatedInventoryItem,
    automaticallyAddedToShoppingList,
  };
}