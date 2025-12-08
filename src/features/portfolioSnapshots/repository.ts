import { prisma } from "@/lib/prisma";

export const portfolioSnapshotRepository = {
  listByPortfolio: (portfolioId: string) =>
    prisma.portfolioSnapshot.findMany({
      where: { portfolioId },
      orderBy: { asOf: "desc" },
    }),

  upsert: (
    portfolioId: string,
    asOf: Date,
    data: { totalValue: number; cashValue: number; investedValue: number }
  ) =>
    prisma.portfolioSnapshot.upsert({
      where: {
        portfolioId_asOf: {
          portfolioId,
          asOf,
        },
      },
      update: data,
      create: {
        portfolio: { connect: { id: portfolioId } },
        asOf,
        totalValue: data.totalValue,
        cashValue: data.cashValue,
        investedValue: data.investedValue,
      },
    }),
};
