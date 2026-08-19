import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().nonnegative(),
  barcode: z.string().max(64).optional(),
  sku: z.string().max(64).optional(),
  current_stock: z.number().int().nonnegative().default(0),
  safety_stock: z.number().int().nonnegative().default(0),
  metadata: z.record(z.unknown()).optional(),
});

export const setStockSchema = z.object({
  current_stock: z.number().int().nonnegative(),
});

export const setActiveSchema = z.object({
  is_active: z.boolean(),
});
