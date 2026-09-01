import { NextResponse } from "next/server";
import { getBoughtItems } from "@/lib/items";

export async function GET() {
  try {
    const items = await getBoughtItems();

    return NextResponse.json({
      items,
    });
  } catch (error) {
    console.error("Could not load inventory:", error);

    return NextResponse.json(
      {
        error: "Unable to load inventory.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}