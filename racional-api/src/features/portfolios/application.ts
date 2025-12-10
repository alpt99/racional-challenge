import { DomainError } from "@/lib/errors";
import {
  createPortfolioSchema,
  updatePortfolioTotalsSchema,
  updatePortfolioInfoSchema,
  type CreatePortfolioInput,
  type UpdatePortfolioTotalsInput,
  type UpdatePortfolioInfoInput,
} from "./model";
import { portfolioRepository } from "./repository";

export const portfolioApplication = {
  listUserPortfolios: (userId: number) =>
    portfolioRepository.findByUser(userId),

  createPortfolio: (input: CreatePortfolioInput) => {
    const payload = createPortfolioSchema.parse(input);
    return portfolioRepository.create({
      name: payload.name,
      baseCurrency: payload.baseCurrency,
      user: {
        connect: { id: payload.userId },
      },
    });
  },

  updatePortfolioInfo: (input: UpdatePortfolioInfoInput) => {
    const payload = updatePortfolioInfoSchema.parse(input);
    return portfolioRepository.update(payload.id, {
      name: payload.name,
    });
  },

  updatePortfolioTotals: async (input: UpdatePortfolioTotalsInput) => {
    console.log("updatePortfolioTotals", input);
    const payload = updatePortfolioTotalsSchema.parse(input);
    console.log("payload", payload);
    return portfolioRepository.update(payload.id, {
      totalValue: payload.totalValue,
      cashValue: payload.cashValue,
      investedValue: payload.investedValue,
    });
  },

  updatePortfolioCashValue: async (
    id: string,
    cashValue: number,
    type: "DEPOSIT" | "WITHDRAWAL"
  ) => {
    const delta = type === "DEPOSIT" ? cashValue : -cashValue;
    const portfolio = await portfolioApplication.findById(id);
    if (!portfolio) {
      throw new DomainError("PORTFOLIO_NOT_FOUND", {
        status: 404,
        code: "PORTFOLIO_NOT_FOUND",
      });
    }
    console.log("delta", delta);
    console.log("portfolio.cashValue", portfolio.cashValue);
    console.log("portfolio.totalValue", portfolio.totalValue);
    console.log("portfolio.investedValue", portfolio.investedValue);
    return await portfolioApplication.updatePortfolioTotals({
      id,
      cashValue: Number(portfolio.cashValue) + delta,
      totalValue: Number(portfolio.totalValue) + delta,
      investedValue: Number(portfolio.investedValue),
    });
  },

  findById: async (id: string) => {
    const portfolio = await portfolioRepository.findById(id);
    if (!portfolio) {
      throw new DomainError("PORTFOLIO_NOT_FOUND", {
        status: 404,
        code: "PORTFOLIO_NOT_FOUND",
      });
    }
    return portfolio;
  },

  findPortfolioSnapshotsHistory: async (id: string) => {
    const snapshots = await portfolioRepository.findPortfolioSnapshotsHistory(
      id
    );
    return snapshots;
  },

  findLatestActions: async (id: string, limit: number = 10) => {
    const portfolio = await portfolioRepository.findById(id);
    if (!portfolio) {
      throw new DomainError("PORTFOLIO_NOT_FOUND", {
        status: 404,
        code: "PORTFOLIO_NOT_FOUND",
      });
    }
    console.log("limit", limit);
    const actions = await Promise.all([
      portfolioRepository.findLatestCashMovements(id, limit),
      portfolioRepository.findLatestOrders(id, limit),
    ]);
    return {
      cashMovements: actions[0],
      orders: actions[1],
    };
  },
};
