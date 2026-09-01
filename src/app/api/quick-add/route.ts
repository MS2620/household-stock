import { NextResponse } from "next/server";
import { createOrIncreaseShoppingItem } from "@/lib/items";
import { verifyQuickAddToken } from "@/lib/auth";

function parseQuickAdd(text: string) {
  const cleaned = text
    .trim()
    .replace(/^add\s+/i, "")
    .replace(/\s+/g, " ");

  const match = cleaned.match(/^(\d+)\s+(?:packs?\s+of\s+)?(.+)$/i);

  if (match) {
    return {
      name: match[2],
      quantity: Number(match[1]),
    };
  }

  return {
    name: cleaned,
    quantity: 1,
  };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!verifyQuickAddToken(authHeader)) {
      return NextResponse.json(
        { error: "Unauthorized. Provide a valid Bearer token." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const text = typeof body.text === "string" ? body.text : "";

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Send a non-empty text value." },
        { status: 400 },
      );
    }

    const parsed = parseQuickAdd(text);
    const item = await createOrIncreaseShoppingItem(parsed);

    return NextResponse.json({
      ok: true,
      message: `Added ${item.quantity} ${item.name} to the shopping list.`,
      item,
    });
  } catch (error) {
    console.error("Quick add failed:", error);

    return NextResponse.json(
      {
        error: "Unable to add item.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}