import { z } from "zod";

export const orderSides = ["BUY", "SELL"] as const;
export const orderStatuses = ["PENDING", "FILLED", "CANCELED"] as const;

export const placeOrderSchema = z.object({
  portfolioId: z.string().uuid(),
  stockId: z.string().uuid(),
  side: z.enum(orderSides),
  quantity: z.number().positive(),
  price: z.number().positive(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((code) => code.toUpperCase()),
  placedAt: z.coerce.date().default(() => new Date()),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(orderStatuses),
  filledAt: z.coerce.date().optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderSideValue = (typeof orderSides)[number];
export type OrderStatusValue = (typeof orderStatuses)[number];
