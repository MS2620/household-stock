import { NextResponse } from "next/server";
import {
  consumeInventory,
  createOrIncreaseShoppingItem,
  getBoughtItems,
} from "@/lib/items";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseId(value: string) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { id: rawId } = await params;
  const id = parseId(rawId);

  if (!id) {
    return NextResponse.json(
      { error: "Invalid inventory item ID." },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "consume") {
      const amount =
        Number.isInteger(body.amount) && body.amount > 0
          ? body.amount
          : 1;

      const result = await consumeInventory(id, amount);

      if (!result) {
        return NextResponse.json(
          { error: "Inventory item not found." },
          { status: 404 },
        );
      }

      return NextResponse.json({
        item: result.item,
        automaticallyAddedToShoppingList:
          result.automaticallyAddedToShoppingList,
      });
    }

    if (action === "restock") {
      const inventoryItems = await getBoughtItems();
      const inventoryItem = inventoryItems.find((item) => item.id === id);

      if (!inventoryItem) {
        return NextResponse.json(
          { error: "Inventory item not found." },
          { status: 404 },
        );
      }

      const shoppingItem = await createOrIncreaseShoppingItem({
        name: inventoryItem.name,
        category: inventoryItem.category,
        quantity: body.quantity ?? 1,
        unit: inventoryItem.unit,
        lowStockThreshold: inventoryItem.lowStockThreshold,
        barcode: inventoryItem.barcode,
      });

      return NextResponse.json({
        item: shoppingItem,
        message: `Added ${inventoryItem.name} to the shopping list.`,
      });
    }

    return NextResponse.json(
      { error: "Unsupported inventory action." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Could not update inventory:", error);

    return NextResponse.json(
      {
        error: "Unable to update inventory.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}