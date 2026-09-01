"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type InventoryItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: "shopping" | "bought" | "archived";
  isLowStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  barcode?: string;
  createdAt: string;
  updatedAt: string;
};

function formatUnit(quantity: number, unit: string) {
  if (quantity === 1 || unit !== "item") {
    return `${quantity} ${unit}`;
  }

  return `${quantity} items`;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadInventory() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/inventory", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load inventory.");
      }

      setItems(data.items);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load inventory.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInventory();
  }, []);

  const lowStockItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.lowStockThreshold > 0 &&
          item.stockQuantity <= item.lowStockThreshold,
      ),
    [items],
  );

  const normalStockItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.lowStockThreshold === 0 ||
          item.stockQuantity > item.lowStockThreshold,
      ),
    [items],
  );

  async function updateItem(
    id: number,
    action: "consume" | "restock",
    quantity = 1,
  ) {
    try {
      setUpdatingId(id);
      setError(null);
      setMessage(null);

      const response = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          quantity,
          amount: quantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update inventory.");
      }

      if (action === "restock") {
        setMessage(data.message ?? "Added item to the shopping list.");
      }

      if (action === "consume" && data.automaticallyAddedToShoppingList) {
        setMessage(
          `${data.item.name} is low in stock and was added to the shopping list.`,
        );
      }
      await loadInventory();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not update inventory.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function InventoryCard({ item }: { item: InventoryItem }) {
    const isLowStock =
      item.lowStockThreshold > 0 &&
      item.stockQuantity <= item.lowStockThreshold;

    const isUpdating = updatingId === item.id;

    return (
      <li
        className={`rounded-2xl border p-4 shadow-sm ${
          isLowStock
            ? "border-amber-200 bg-amber-50"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-bold">{item.name}</h3>

              {isLowStock ? (
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-950">
                  Low stock
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-slate-600">{item.category}</p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums">
              {item.stockQuantity}
            </p>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {item.unit}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600">
            {item.lowStockThreshold > 0
              ? `Restock at ${formatUnit(
                  item.lowStockThreshold,
                  item.unit,
                )} or fewer`
              : "No low-stock reminder set"}
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href={`/inventory/${item.id}`}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Edit
            </Link>

            <button
              type="button"
              onClick={() => void updateItem(item.id, "consume")}
              disabled={isUpdating || item.stockQuantity === 0}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating ? "Saving…" : "Use one"}
            </button>

            <button
              type="button"
              onClick={() => void updateItem(item.id, "restock")}
              disabled={isUpdating}
              className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add to list
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            Household Stock
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Inventory
          </h1>

          <p className="mt-2 text-slate-600">
            Track what you have at home and restock before you run out.
          </p>
        </div>

        <Link
          href="/"
          className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          Shopping list
        </Link>
      </header>

      {message ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-slate-200">
          Loading inventory…
        </div>
      ) : items.length === 0 ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">Your inventory is empty.</h2>

          <p className="mt-2 text-slate-600">
            Buy an item from the shopping list and it will appear here.
          </p>

          <Link
            href="/"
            className="mt-5 inline-flex rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800"
          >
            Go to shopping list
          </Link>
        </section>
      ) : (
        <div className="space-y-8">
          {lowStockItems.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Needs restocking</h2>

                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-900">
                  {lowStockItems.length}
                </span>
              </div>

              <ul className="space-y-3">
                {lowStockItems.map((item) => (
                  <InventoryCard key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">In stock</h2>

              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-sm font-bold text-slate-700">
                {normalStockItems.length}
              </span>
            </div>

            {normalStockItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-600">
                All inventory items need restocking.
              </div>
            ) : (
              <ul className="space-y-3">
                {normalStockItems.map((item) => (
                  <InventoryCard key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}