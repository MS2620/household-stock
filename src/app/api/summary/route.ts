import { NextResponse } from "next/server";
import { getLowStockItems, getShoppingItems } from "@/lib/items";

export async function GET() {
  const [shoppingItems, lowStockItems] = await Promise.all([
    getShoppingItems(),
    getLowStockItems(),
  ]);

  return NextResponse.json({
    shoppingCount: shoppingItems.length,
    lowStockCount: lowStockItems.length,
    shoppingItems,
    lowStockItems,
  });
}