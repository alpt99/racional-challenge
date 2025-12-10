import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

export const cashMovementRepository = {
  listByPortfolio: (portfolioId: string) =>
    prismaAny.cashMovement.findMany({
      where: { portfolioId },
      orderBy: { happenedAt: "desc" },
    }),

  create: (data: any) => prismaAny.cashMovement.create({ data }),

  createWithEffects: async (data: any) => {
    return prismaAny.$transaction(async (tx: any) => {
      const portfolio = await tx.portfolio.findUnique({
        where: { id: data.portfolioId },
      });
      if (!portfolio) {
        throw new DomainError("PORTFOLIO_NOT_FOUND", {
          status: 404,
          code: "PORTFOLIO_NOT_FOUND",
        });
      }
      let nextCashValue = 0;
      let nextTotalValue = 0;
      let nextInvestedValue = Number(portfolio.investedValue ?? 0);
      if (data.type === "DEPOSIT") {
        nextCashValue =
          Number(portfolio.cashValue ?? 0) + Number(data.amount ?? 0);
        nextTotalValue =
          Number(portfolio.totalValue ?? 0) + Number(data.amount ?? 0);
      } else if (data.type === "WITHDRAWAL") {
        nextCashValue =
          Number(portfolio.cashValue ?? 0) - Number(data.amount ?? 0);
        nextTotalValue =
          Number(portfolio.totalValue ?? 0) - Number(data.amount ?? 0);
      }
      if (data.type === "WITHDRAWAL" && nextCashValue < 0) {
        throw new DomainError("INSUFFICIENT_FUNDS", {
          status: 400,
          code: "INSUFFICIENT_FUNDS",
        });
      }
      const cashMovement = await tx.cashMovement.create({ data });
      await tx.portfolio.update({
        where: { id: data.portfolioId },
        data: {
          cashValue: nextCashValue,
          totalValue: nextTotalValue,
          investedValue: nextInvestedValue,
        },
      });
      console.log("portfolio updated");
      await tx.portfolioSnapshot.upsert({
        where: {
          portfolioId_asOf: {
            portfolioId: data.portfolioId,
            asOf: data.happenedAt,
          },
        },
        create: {
          portfolioId: data.portfolioId,
          asOf: data.happenedAt,
          totalValue: nextTotalValue,
          cashValue: nextCashValue,
          investedValue: nextInvestedValue,
        },
        update: {
          totalValue: nextTotalValue,
          cashValue: nextCashValue,
          investedValue: nextInvestedValue,
        },
      });
      console.log("portfolio snapshot updated");
      return cashMovement;
    });
  },
};
