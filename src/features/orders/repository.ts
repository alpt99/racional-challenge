import { prisma } from "@/lib/prisma";
import type { OrderSideValue, OrderStatusValue } from "./model";

const prismaAny = prisma as any;

export const orderRepository = {
  listByPortfolio: (portfolioId: string) =>
    prismaAny.order.findMany({
      where: { portfolioId },
      include: { stock: true },
      orderBy: { placedAt: "desc" },
    }),

  create: (params: {
    portfolioId: string;
    stockId: string;
    side: OrderSideValue;
    quantity: number;
    price: number;
    currency: string;
    placedAt: Date;
  }) =>
    prismaAny.order.create({
      data: {
        portfolio: { connect: { id: params.portfolioId } },
        stock: { connect: { id: params.stockId } },
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        currency: params.currency,
        placedAt: params.placedAt,
      },
    }),

  updateStatus: (orderId: string, status: OrderStatusValue, filledAt?: Date) =>
    prismaAny.order.update({
      where: { id: orderId },
      data: {
        status,
        filledAt,
      },
    }),
};
