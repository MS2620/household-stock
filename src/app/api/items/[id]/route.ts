import { NextResponse } from "next/server";
import { deleteItem, markItemBought } from "@/lib/items";

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
    return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
  }

  try {
    const body = await request.json();

    if (body.action !== "buy") {
      return NextResponse.json(
        { error: "Unsupported item action." },
        { status: 400 },
      );
    }

    const item = await markItemBought(id);

    if (!item) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch {
    return NextResponse.json(
      { error: "Unable to update shopping item." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  const { id: rawId } = await params;
  const id = parseId(rawId);

  if (!id) {
    return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
  }

  const item = await deleteItem(id);

  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json({ item });
}