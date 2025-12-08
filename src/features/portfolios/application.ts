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
      baseCurrency: payload.baseCurrency,
    });
  },

  updatePortfolioTotals: (input: UpdatePortfolioTotalsInput) => {
    const payload = updatePortfolioTotalsSchema.parse(input);

    return portfolioRepository.update(payload.id, {
      totalValue: payload.totalValue,
      cashValue: payload.cashValue,
      investedValue: payload.investedValue,
    });
  },
};
