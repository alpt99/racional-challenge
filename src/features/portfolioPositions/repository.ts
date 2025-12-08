import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

export const portfolioPositionRepository = {
  findByPortfolio: (portfolioId: string) =>
    prismaAny.portfolioPosition.findMany({
      where: { portfolioId },
      include: { stock: true },
      orderBy: { updatedAt: "desc" },
    }),

  upsert: (params: {
    portfolioId: string;
    stockId: string;
    currency: string;
    quantity: number;
    avgPrice: number;
    lastPrice?: number;
  }) =>
    prismaAny.portfolioPosition.upsert({
      where: {
        portfolioId_stockId: {
          portfolioId: params.portfolioId,
          stockId: params.stockId,
        },
      },
      update: {
        quantity: params.quantity,
        avgPrice: params.avgPrice,
        lastPrice: params.lastPrice,
        currency: params.currency,
      },
      create: {
        portfolioId: params.portfolioId,
        stockId: params.stockId,
        currency: params.currency,
        quantity: params.quantity,
        avgPrice: params.avgPrice,
        lastPrice: params.lastPrice,
      },
    }),

  adjustQuantity: (params: {
    portfolioId: string;
    stockId: string;
    quantityDelta: number;
    price?: number;
  }) =>
    prisma.$transaction(async (tx: any) => {
      const existing = await tx.portfolioPosition.findUnique({
        where: {
          portfolioId_stockId: {
            portfolioId: params.portfolioId,
            stockId: params.stockId,
          },
        },
      });

      if (!existing) {
        throw new Error("POSITION_NOT_FOUND");
      }

      const nextQuantity = Number(existing.quantity) + params.quantityDelta;

      if (nextQuantity < 0) {
        throw new Error("POSITION_NEGATIVE");
      }

      return tx.portfolioPosition.update({
        where: {
          portfolioId_stockId: {
            portfolioId: params.portfolioId,
            stockId: params.stockId,
          },
        },
        data: {
          quantity: nextQuantity,
          lastPrice: params.price ?? existing.lastPrice,
        },
      });
    }),
};
