import {
  recordCashMovementSchema,
  type RecordCashMovementInput,
} from "./model";
import { cashMovementRepository } from "./repository";

export const cashMovementApplication = {
  listPortfolioMovements: (portfolioId: string) =>
    cashMovementRepository.listByPortfolio(portfolioId),

  recordMovement: (input: RecordCashMovementInput) => {
    const payload = recordCashMovementSchema.parse(input);
    return cashMovementRepository.create({
      portfolio: { connect: { id: payload.portfolioId } },
      type: payload.type,
      amount: payload.amount,
      currency: payload.currency,
      happenedAt: payload.happenedAt,
      note: payload.note,
    });
  },
};
