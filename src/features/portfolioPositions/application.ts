import {
  adjustPortfolioPositionSchema,
  upsertPortfolioPositionSchema,
  type AdjustPortfolioPositionInput,
  type UpsertPortfolioPositionInput,
} from "./model";
import { portfolioPositionRepository } from "./repository";

export const portfolioPositionApplication = {
  listPositionsForPortfolio: (portfolioId: string) =>
    portfolioPositionRepository.findByPortfolio(portfolioId),

  upsertPosition: (input: UpsertPortfolioPositionInput) => {
    const payload = upsertPortfolioPositionSchema.parse(input);
    return portfolioPositionRepository.upsert(payload);
  },

  adjustPositionQuantity: (input: AdjustPortfolioPositionInput) => {
    const payload = adjustPortfolioPositionSchema.parse(input);
    return portfolioPositionRepository.adjustQuantity(payload);
  },
};
