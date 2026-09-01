import { NextResponse } from "next/server";
import { createOrIncreaseShoppingItem, getShoppingItems } from "@/lib/items";
import { createItemSchema } from "@/lib/validation";

export async function GET() {
  const items = await getShoppingItems();

  return NextResponse.json({
    items,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid item data.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const item = await createOrIncreaseShoppingItem(parsed.data);

    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to create shopping item." },
      { status: 500 },
    );
  }
}