import {
  placeOrderSchema,
  updateOrderStatusSchema,
  type PlaceOrderInput,
  type UpdateOrderStatusInput,
  type OrderSideValue,
} from "./model";
import { orderRepository } from "./repository";
import { DomainError } from "@/lib/errors";
import { portfolioApplication } from "../portfolios/application";

export const orderApplication = {
  listOrdersForPortfolio: (portfolioId: string) =>
    orderRepository.listByPortfolio(portfolioId),

  placeOrder: async (input: PlaceOrderInput) => {
    const payload = placeOrderSchema.parse(input);
    const portfolio = await portfolioApplication.findById(payload.portfolioId);
    if (!portfolio) {
      throw new DomainError("PORTFOLIO_NOT_FOUND", {
        status: 404,
        code: "PORTFOLIO_NOT_FOUND",
      });
    }
    const available = Number(portfolio.cashValue ?? 0);
    if (
      payload.side === "BUY" &&
      payload.price * payload.quantity > available
    ) {
      throw new DomainError("INSUFFICIENT_FUNDS", {
        status: 400,
        code: "INSUFFICIENT_FUNDS",
      });
    }
    const order = await orderRepository.createWithEffects(payload);
    return order;
  },
};
