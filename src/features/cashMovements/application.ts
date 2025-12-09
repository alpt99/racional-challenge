import {
  recordCashMovementSchema,
  type RecordCashMovementInput,
} from "./model";
import { cashMovementRepository } from "./repository";
import { portfolioApplication } from "@/features/portfolios/application";
import { DomainError } from "@/lib/errors";

export const cashMovementApplication = {
  listPortfolioMovements: (portfolioId: string) =>
    cashMovementRepository.listByPortfolio(portfolioId),

  recordMovement: async (input: RecordCashMovementInput) => {
    const payload = recordCashMovementSchema.parse(input);
    const portfolio = await portfolioApplication.findById(payload.portfolioId);
    if (!portfolio) {
      throw new DomainError("PORTFOLIO_NOT_FOUND", {
        status: 404,
        code: "PORTFOLIO_NOT_FOUND",
      });
    }

    const available = Number(portfolio.cashValue ?? 0);
    if (payload.type === "WITHDRAWAL" && payload.amount > available) {
      throw new DomainError("INSUFFICIENT_FUNDS", {
        status: 400,
        code: "INSUFFICIENT_FUNDS",
      });
    }

    const movement = await cashMovementRepository.create({
      portfolio: { connect: { id: payload.portfolioId } },
      type: payload.type,
      amount: payload.amount,
      currency: payload.currency,
      happenedAt: payload.happenedAt,
      note: payload.note,
    });
    await portfolioApplication.updatePortfolioCashValue(
      payload.portfolioId,
      payload.amount,
      payload.type as "DEPOSIT" | "WITHDRAWAL"
    );
    return movement;
  },

  recordMovementWithEffects: async (input: RecordCashMovementInput) => {
    const payload = recordCashMovementSchema.parse(input);
    const movement = await cashMovementRepository.createWithEffects({
      portfolioId: payload.portfolioId,
      type: payload.type,
      amount: payload.amount,
      currency: payload.currency,
      happenedAt: payload.happenedAt,
    });
    return movement;
  },
};
