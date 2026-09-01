"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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

const categoryOptions = [
  "Groceries",
  "Cleaning",
  "Bathroom",
  "Kitchen",
  "Hardware",
  "Electronics",
  "Pet supplies",
  "Pharmacy",
  "Other",
];

const unitOptions = [
  "item",
  "pack",
  "roll",
  "bottle",
  "bag",
  "box",
  "tablet",
  "can",
  "g",
  "kg",
  "ml",
  "l",
];

export default function EditInventoryItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itemId = params.id;

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");
  const [unit, setUnit] = useState("item");
  const [stockQuantity, setStockQuantity] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(0);
  const [barcode, setBarcode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadItem() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/inventory/${itemId}/details`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Could not load this inventory item.");
        }

        const loadedItem = data.item as InventoryItem;

        setItem(loadedItem);
        setName(loadedItem.name);
        setCategory(loadedItem.category);
        setUnit(loadedItem.unit);
        setStockQuantity(loadedItem.stockQuantity);
        setLowStockThreshold(loadedItem.lowStockThreshold);
        setBarcode(loadedItem.barcode ?? "");
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Could not load this inventory item.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (itemId) {
      void loadItem();
    }
  }, [itemId]);

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(`/api/inventory/${itemId}/details`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          category,
          unit,
          stockQuantity,
          lowStockThreshold,
          barcode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not save this inventory item.");
      }

      router.push("/inventory");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save this inventory item.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
        <div className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-slate-200">
          Loading item…
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold">Item not found.</h1>

          <p className="mt-2 text-slate-600">
            This item may have been deleted or is no longer in inventory.
          </p>

          <Link
            href="/inventory"
            className="mt-5 inline-flex rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800"
          >
            Back to inventory
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <header className="mb-8">
        <Link
          href="/inventory"
          className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Back to inventory
        </Link>

        <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
          Household Stock
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Edit item
        </h1>

        <p className="mt-2 text-slate-600">
          Set the stock level at which you want to buy this item again.
        </p>
      </header>

      <form
        onSubmit={saveItem}
        className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
      >
        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="space-y-5">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-slate-900"
            >
              Item name
            </label>

            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-semibold text-slate-900"
              >
                Category
              </label>

              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
              >
                {!categoryOptions.includes(category) ? (
                  <option value={category}>{category}</option>
                ) : null}

                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="unit"
                className="block text-sm font-semibold text-slate-900"
              >
                Unit
              </label>

              <select
                id="unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
              >
                {!unitOptions.includes(unit) ? (
                  <option value={unit}>{unit}</option>
                ) : null}

                {unitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="stockQuantity"
                className="block text-sm font-semibold text-slate-900"
              >
                Current stock
              </label>

              <input
                id="stockQuantity"
                type="number"
                min="0"
                max="999"
                value={stockQuantity}
                onChange={(event) =>
                  setStockQuantity(Math.max(0, Number(event.target.value)))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
              />

              <p className="mt-1 text-sm text-slate-500">
                How many {unit === "item" ? "items" : unit}s do you have now?
              </p>
            </div>

            <div>
              <label
                htmlFor="lowStockThreshold"
                className="block text-sm font-semibold text-slate-900"
              >
                Low-stock threshold
              </label>

              <input
                id="lowStockThreshold"
                type="number"
                min="0"
                max="999"
                value={lowStockThreshold}
                onChange={(event) =>
                  setLowStockThreshold(
                    Math.max(0, Number(event.target.value)),
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
              />

              <p className="mt-1 text-sm text-slate-500">
                Set to 0 to disable low-stock reminders.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="barcode"
              className="block text-sm font-semibold text-slate-900"
            >
              Barcode <span className="font-normal text-slate-500">(optional)</span>
            </label>

            <input
              id="barcode"
              inputMode="numeric"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="Add later by scanning a product"
              maxLength={32}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {lowStockThreshold > 0 ? (
              <>
                This item will be marked low stock at{" "}
                <strong>
                  {lowStockThreshold} {unit}
                  {lowStockThreshold === 1 || unit !== "item" ? "" : "s"}
                </strong>{" "}
                or fewer.
              </>
            ) : (
              <>Low-stock reminders are currently disabled for this item.</>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/inventory"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </main>
  );
}