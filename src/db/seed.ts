import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { households, shoppingItems, inventoryItems } from "./schema";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  // Create a default household if it does not exist
  const [household] = await db
    .insert(households)
    .values({
      name: "Default Household",
    })
    .onConflictDoNothing({
      target: households.id,
    })
    .returning();

  let householdId = household?.id;

  if (!householdId) {
    const [existing] = await db
      .select()
      .from(households)
      .limit(1);

    if (!existing) {
      throw new Error("Failed to create or find default household.");
    }

    householdId = existing.id;
  }

  console.log("Default household ID:", householdId);

  // Optional: create a sample shopping item if the table is empty
  const [firstItem] = await db
    .select()
    .from(shoppingItems)
    .limit(1);

  if (!firstItem) {
    await db.insert(shoppingItems).values({
      householdId,
      name: "Milk",
      category: "Groceries",
      quantity: 1,
      unit: "bottle",
      status: "shopping",
      isLowStock: false,
      stockQuantity: 0,
      lowStockThreshold: 0,
    });

    console.log("Created sample shopping item: Milk");
  }

  await client.end();
  console.log("Seed completed.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});