import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  households,
  inventoryItems,
  shoppingItems,
  itemStatus,
} from "@/db/schema";

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

const DEFAULT_HOUSEHOLD_NAME = "Default Household";

async function getDefaultHouseholdId() {
  const [household] = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.name, DEFAULT_HOUSEHOLD_NAME))
    .limit(1);

  if (!household) {
    throw new Error("Default household not found. Run the seed script.");
  }

  return household.id;
}

function normaliseName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function getShoppingItems() {
  const householdId = await getDefaultHouseholdId();

  const items = await db
    .select()
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.householdId, householdId),
        eq(shoppingItems.status, "shopping"),
      ),
    )
    .orderBy(sql`${shoppingItems.createdAt} DESC`);

  return items;
}

export async function getBoughtItems() {
  const householdId = await getDefaultHouseholdId();

  const items = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.householdId, householdId))
    .orderBy(sql`${inventoryItems.updatedAt} DESC`);

  return items;
}

export async function getBoughtItemById(id: number) {
  const householdId = await getDefaultHouseholdId();

  const [item] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.householdId, householdId),
      ),
    )
    .limit(1);

  return item ?? null;
}

export async function getLowStockItems() {
  const householdId = await getDefaultHouseholdId();

  const items = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.householdId, householdId),
        eq(inventoryItems.lowStockThreshold, sql`> 0`),
        eq(inventoryItems.stockQuantity, sql`<= ${inventoryItems.lowStockThreshold}`),
      ),
    )
    .orderBy(sql`${inventoryItems.updatedAt} DESC`);

  return items;
}

export async function createOrIncreaseShoppingItem(input: CreateItemInput) {
  const householdId = await getDefaultHouseholdId();
  const name = normaliseName(input.name);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.householdId, householdId),
        ilike(shoppingItems.name, name),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(shoppingItems)
      .set({
        quantity: existing.quantity + (input.quantity ?? 1),
        status: "shopping",
        updatedAt: now,
      })
      .where(eq(shoppingItems.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(shoppingItems)
    .values({
      householdId,
      name,
      category: input.category ?? "Other",
      quantity: input.quantity ?? 1,
      unit: input.unit ?? "item",
      status: "shopping",
      isLowStock: false,
      stockQuantity: input.stockQuantity ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? 0,
      barcode: input.barcode,
    })
    .returning();

  return created;
}

export async function markItemBought(id: number) {
  const householdId = await getDefaultHouseholdId();

  const [item] = await db
    .select()
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.id, id),
        eq(shoppingItems.householdId, householdId),
      ),
    )
    .limit(1);

  if (!item) {
    return null;
  }

  const now = new Date();

  // Ensure a matching inventory item exists
  const [existingInventory] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.householdId, householdId),
        ilike(inventoryItems.name, item.name),
      ),
    )
    .limit(1);

  if (existingInventory) {
    await db
      .update(inventoryItems)
      .set({
        stockQuantity: existingInventory.stockQuantity + item.quantity,
        updatedAt: now,
      })
      .where(eq(inventoryItems.id, existingInventory.id));
  } else {
    await db.insert(inventoryItems).values({
      householdId,
      name: item.name,
      category: item.category,
      unit: item.unit,
      stockQuantity: item.quantity,
      lowStockThreshold: item.lowStockThreshold,
      barcode: item.barcode,
    });
  }

  const [updated] = await db
    .update(shoppingItems)
    .set({
      status: "bought",
      updatedAt: now,
    })
    .where(eq(shoppingItems.id, id))
    .returning();

  return updated;
}

export async function updateInventoryItem(
  id: number,
  input: UpdateInventoryItemInput,
) {
  const householdId = await getDefaultHouseholdId();
  const now = new Date();

  const [updated] = await db
    .update(inventoryItems)
    .set({
      name: normaliseName(input.name),
      category: input.category.trim(),
      unit: input.unit.trim(),
      stockQuantity: input.stockQuantity,
      lowStockThreshold: input.lowStockThreshold,
      barcode: input.barcode?.trim() || undefined,
      updatedAt: now,
    })
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.householdId, householdId),
      ),
    )
    .returning();

  return updated ?? null;
}

export async function deleteItem(id: number) {
  const householdId = await getDefaultHouseholdId();

  const [deleted] = await db
    .delete(shoppingItems)
    .where(
      and(
        eq(shoppingItems.id, id),
        eq(shoppingItems.householdId, householdId),
      ),
    )
    .returning();

  return deleted ?? null;
}

export async function consumeInventory(id: number, amount = 1) {
  const householdId = await getDefaultHouseholdId();
  const now = new Date();

  const [item] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.householdId, householdId),
      ),
    )
    .limit(1);

  if (!item) {
    return null;
  }

  const stockQuantity = Math.max(0, item.stockQuantity - amount);
  const isLowStock =
    item.lowStockThreshold > 0 &&
    stockQuantity <= item.lowStockThreshold;

  const [updatedInventory] = await db
    .update(inventoryItems)
    .set({
      stockQuantity,
      updatedAt: now,
    })
    .where(eq(inventoryItems.id, id))
    .returning();

  let automaticallyAddedToShoppingList = false;

  if (isLowStock) {
    const [existingShopping] = await db
      .select()
      .from(shoppingItems)
      .where(
        and(
          eq(shoppingItems.householdId, householdId),
          eq(shoppingItems.status, "shopping"),
          ilike(shoppingItems.name, item.name),
        ),
      )
      .limit(1);

    if (!existingShopping) {
      await db.insert(shoppingItems).values({
        householdId,
        name: item.name,
        category: item.category,
        quantity: 1,
        unit: item.unit,
        status: "shopping",
        isLowStock: false,
        stockQuantity: 0,
        lowStockThreshold: item.lowStockThreshold,
        barcode: item.barcode,
      });

      automaticallyAddedToShoppingList = true;
    }
  }

  return {
    item: updatedInventory,
    automaticallyAddedToShoppingList,
  };
}