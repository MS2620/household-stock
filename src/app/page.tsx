"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type ShoppingItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  createdAt: string;
};

type FrequentItem = {
  name: string;
  category: string;
  unit?: string;
};

const frequentItems: FrequentItem[] = [
  { name: "Milk", category: "Groceries" },
  { name: "Bread", category: "Groceries" },
  { name: "Eggs", category: "Groceries", unit: "box" },
  { name: "Kitchen roll", category: "Kitchen", unit: "roll" },
  { name: "Toilet roll", category: "Bathroom", unit: "roll" },
  { name: "Bin bags", category: "Cleaning", unit: "pack" },
  { name: "Dishwasher tablets", category: "Kitchen", unit: "box" },
  { name: "Washing-up liquid", category: "Cleaning", unit: "bottle" },
  { name: "Batteries", category: "Hardware", unit: "pack" },
];

export default function HomePage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addingFrequentItem, setAddingFrequentItem] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function loadItems() {
    try {
      setIsLoading(true);

      const response = await fetch("/api/items", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load the shopping list.");
      }

      setItems(data.items);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not load the shopping list.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  async function createItem(item: {
    name: string;
    quantity?: number;
    category?: string;
    unit?: string;
  }) {
    const response = await fetch("/api/items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(item),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Could not add the item.");
    }

    return data.item as ShoppingItem;
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await createItem({
        name,
        quantity,
      });

      setName("");
      setQuantity(1);
      await loadItems();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not add the item.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addFrequentItem(item: FrequentItem) {
    try {
      setAddingFrequentItem(item.name);
      setError(null);

      await createItem({
        name: item.name,
        quantity: 1,
        category: item.category,
        unit: item.unit ?? "item",
      });

      await loadItems();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : `Could not add ${item.name}.`,
      );
    } finally {
      setAddingFrequentItem(null);
    }
  }

  async function buyItem(id: number) {
    try {
      setError(null);

      const response = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "buy",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not mark the item as bought.");
      }

      await loadItems();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not update the item.",
      );
    }
  }

  async function removeItem(id: number) {
    try {
      setError(null);

      const response = await fetch(`/api/items/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not remove the item.");
      }

      await loadItems();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not remove the item.",
      );
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            Household Stock
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Shopping list
          </h1>

          <p className="mt-2 text-slate-600">
            Add what you need. Tick it off when it is bought.
          </p>
        </div>

        <Link
          href="/inventory"
          className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          Inventory
        </Link>
      </header>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Frequent items
          </h2>

          <span className="text-sm text-slate-500">Tap to add</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {frequentItems.map((item) => {
            const isAdding = addingFrequentItem === item.name;

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => void addFrequentItem(item)}
                disabled={isAdding}
                className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAdding ? "Adding…" : item.name}
              </button>
            );
          })}
        </div>
      </section>

      <form
        onSubmit={addItem}
        className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
      >
        <label className="block text-sm font-semibold" htmlFor="item-name">
          Add an item
        </label>

        <div className="mt-3 flex gap-2">
          <input
            id="item-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Milk, bread, batteries…"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
          />

          <input
            aria-label="Quantity"
            type="number"
            min="1"
            max="99"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="w-16 rounded-xl border border-slate-300 bg-white px-2 py-3 text-center outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <h2 className="font-semibold">To buy</h2>

          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-800">
            {items.length}
          </span>
        </div>

        {isLoading ? (
          <p className="p-6 text-slate-600">Loading shopping list…</p>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-lg font-semibold">Nothing to buy.</p>

            <p className="mt-1 text-sm text-slate-600">
              Your next grocery run is looking easy.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-4 py-4"
              >
                <button
                  type="button"
                  aria-label={`Mark ${item.name} as bought`}
                  onClick={() => void buyItem(item.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-slate-300 text-transparent transition hover:border-emerald-600 hover:bg-emerald-50"
                >
                  ✓
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.name}</p>

                  <p className="text-sm text-slate-500">
                    {item.quantity} {item.unit}
                    {item.quantity !== 1 && item.unit === "item" ? "s" : ""}
                    {" · "}
                    {item.category}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void removeItem(item.id)}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}