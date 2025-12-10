import { z } from "zod";

export const createPortfolioSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().trim().min(1).max(255),
  baseCurrency: z
    .string()
    .trim()
    .length(3, "Currency must be ISO 4217 code")
    .transform((code) => code.toUpperCase()),
});

export const updatePortfolioInfoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
});

export const updatePortfolioTotalsSchema = z.object({
  id: z.string().uuid(),
  totalValue: z.number().nonnegative(),
  cashValue: z.number().nonnegative(),
  investedValue: z.number().nonnegative(),
});

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;
export type UpdatePortfolioTotalsInput = z.infer<
  typeof updatePortfolioTotalsSchema
>;
export type UpdatePortfolioInfoInput = z.infer<
  typeof updatePortfolioInfoSchema
>;
