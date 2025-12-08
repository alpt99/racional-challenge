import { z } from "zod";

export const cashMovementTypes = [
  "DEPOSIT",
  "WITHDRAWAL",
  "ORDER_SETTLEMENT",
  "ADJUSTMENT",
] as const;

export const recordCashMovementSchema = z.object({
  portfolioId: z.string().uuid(),
  type: z.enum(cashMovementTypes),
  amount: z.number(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((code) => code.toUpperCase()),
  happenedAt: z.coerce.date(),
  note: z.string().trim().max(512).optional(),
});

export type CashMovementTypeValue = (typeof cashMovementTypes)[number];
export type RecordCashMovementInput = z.infer<typeof recordCashMovementSchema>;
