import { z } from "zod";

export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60).optional(),
  quantity: z.coerce.number().int().min(1).max(99).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  stockQuantity: z.coerce.number().int().min(0).max(999).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(999).optional(),
  barcode: z.string().trim().min(8).max(32).optional(),
});

export const updateInventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  unit: z.string().trim().min(1).max(20),
  stockQuantity: z.coerce.number().int().min(0).max(999),
  lowStockThreshold: z.coerce.number().int().min(0).max(999),
  barcode: z.string().trim().min(8).max(32).optional().or(z.literal("")),
});