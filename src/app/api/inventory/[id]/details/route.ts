import { NextResponse } from "next/server";
import {
  getBoughtItemById,
  updateInventoryItem,
} from "@/lib/items";
import { updateInventoryItemSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseId(value: string) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  _request: Request,
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
    const item = await getBoughtItemById(id);

    if (!item) {
      return NextResponse.json(
        { error: "Inventory item not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Could not load inventory item:", error);

    return NextResponse.json(
      {
        error: "Unable to load inventory item.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
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
    const parsed = updateInventoryItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid inventory item data.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const item = await updateInventoryItem(id, parsed.data);

    if (!item) {
      return NextResponse.json(
        { error: "Inventory item not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Could not update inventory item:", error);

    return NextResponse.json(
      {
        error: "Unable to update inventory item.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}