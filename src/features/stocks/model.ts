import { z } from "zod";

const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .transform((value) => value.toUpperCase());

export const createStockSchema = z.object({
  symbol: symbolSchema,
  name: z.string().trim().min(1).max(255),
  exchange: z.string().trim().min(1).max(64),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((code) => code.toUpperCase()),
});

export const updateStockSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(255).optional(),
  exchange: z.string().trim().min(1).max(64).optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((code) => code.toUpperCase())
    .optional(),
});

export type CreateStockInput = z.infer<typeof createStockSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
