import { prisma } from "@/lib/prisma";
import type { OrderSideValue, OrderStatusValue } from "./model";
import { DomainError } from "@/lib/errors";

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

  createWithEffects: async (params: {
    portfolioId: string;
    stockId: string;
    side: OrderSideValue;
    quantity: number;
    price: number;
    currency: string;
    placedAt: Date;
  }) => {
    const { portfolioId, stockId, side, quantity, price, currency, placedAt } =
      params;
    return prismaAny.$transaction(async (tx: any) => {
      const portfolio = await tx.portfolio.findUnique({
        where: { id: portfolioId },
      });
      if (!portfolio)
        throw new DomainError("PORTFOLIO_NOT_FOUND", {
          status: 404,
          code: "PORTFOLIO_NOT_FOUND",
        });
      const cost = quantity * price;
      if (side === "BUY" && Number(portfolio.cashValue ?? 0) < cost) {
        throw new DomainError("INSUFFICIENT_FUNDS", {
          status: 400,
          code: "INSUFFICIENT_FUNDS",
        });
      }
      // Todo: validacion de venta segun portfolio position
      if (side === "SELL") {
        const portfolioPosition = await tx.portfolioPosition.findUnique({
          where: { portfolioId_stockId: { portfolioId, stockId } },
        });
        if (!portfolioPosition)
          throw new DomainError("PORTFOLIO_POSITION_NOT_FOUND", {
            status: 404,
            code: "PORTFOLIO_POSITION_NOT_FOUND",
          });
        if (Number(portfolioPosition.quantity ?? 0) < quantity)
          throw new DomainError("INSUFFICIENT_STOCK_QUANTITY", {
            status: 400,
            code: "INSUFFICIENT_STOCK_QUANTITY",
          });
      }

      const nextCash =
        side === "BUY"
          ? Number(portfolio.cashValue ?? 0) - cost
          : Number(portfolio.cashValue ?? 0) + cost;
      const nextInvestedValue =
        side === "BUY"
          ? Number(portfolio.investedValue ?? 0) + cost
          : Number(portfolio.investedValue ?? 0) - cost;
      await tx.portfolio.update({
        where: { id: portfolioId },
        data: {
          cashValue: nextCash,
          investedValue: nextInvestedValue,
        },
      });

      // 3) Crear orden
      const order = await tx.order.create({
        data: {
          portfolio: { connect: { id: portfolioId } },
          stock: { connect: { id: stockId } },
          side,
          quantity,
          price,
          currency,
          placedAt,
          status: "FILLED",
        },
      });

      // Todo: Cambiar avgPrice
      await tx.portfolioPosition.upsert({
        where: { portfolioId_stockId: { portfolioId, stockId } },
        create: {
          portfolioId,
          stockId,
          currency,
          quantity: side === "BUY" ? quantity : -quantity,
          avgPrice: price,
          lastPrice: price,
        },
        update: {
          quantity: {
            increment: side === "BUY" ? quantity : -quantity,
          },
          avgPrice: price,
          lastPrice: price,
        },
      });
      await tx.portfolioSnapshot.upsert({
        where: { portfolioId_asOf: { portfolioId, asOf: placedAt } },
        create: {
          portfolioId,
          asOf: placedAt,
          totalValue: portfolio.totalValue,
          cashValue: nextCash,
          investedValue: nextInvestedValue,
        },
        update: {
          cashValue: nextCash,
          investedValue: nextInvestedValue,
        },
      });
      return order;
    });
  },

  updateStatus: (orderId: string, status: OrderStatusValue, filledAt?: Date) =>
    prismaAny.order.update({
      where: { id: orderId },
      data: {
        status,
        filledAt,
      },
    }),
};
