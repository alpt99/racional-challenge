import { z } from "zod";

export const upsertPortfolioPositionSchema = z.object({
  portfolioId: z.string().uuid(),
  stockId: z.string().uuid(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((code) => code.toUpperCase()),
  quantity: z.number().refine((value) => Number.isFinite(value), {
    message: "Quantity must be finite",
  }),
  avgPrice: z.number().nonnegative(),
  lastPrice: z.number().nonnegative().optional(),
});

export const adjustPortfolioPositionSchema = z.object({
  portfolioId: z.string().uuid(),
  stockId: z.string().uuid(),
  quantityDelta: z.number(),
  price: z.number().nonnegative().optional(),
});

export type UpsertPortfolioPositionInput = z.infer<
  typeof upsertPortfolioPositionSchema
>;
export type AdjustPortfolioPositionInput = z.infer<
  typeof adjustPortfolioPositionSchema
>;
