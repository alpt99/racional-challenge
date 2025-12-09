import {
  placeOrderSchema,
  updateOrderStatusSchema,
  type PlaceOrderInput,
  type UpdateOrderStatusInput,
  type OrderSideValue,
} from "./model";
import { orderRepository } from "./repository";
import { portfolioPositionRepository } from "../portfolioPositions/repository";
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
    console.log("payload", payload);
    const order = await orderRepository.createWithEffects(payload);
    return order;
  },

  placeOrderV2: async (input: PlaceOrderInput) => {},

  updateOrderStatus: async (input: UpdateOrderStatusInput) => {
    const payload = updateOrderStatusSchema.parse(input);
    const updatedOrder = await orderRepository.updateStatus(
      payload.orderId,
      payload.status,
      payload.filledAt
    );

    if (payload.status === "FILLED") {
      const side = updatedOrder.side as OrderSideValue;
      const quantityDelta =
        side === "BUY"
          ? Number(updatedOrder.quantity)
          : -Number(updatedOrder.quantity);

      await portfolioPositionRepository.adjustQuantity({
        portfolioId: updatedOrder.portfolioId,
        stockId: updatedOrder.stockId,
        quantityDelta,
        price: updatedOrder.price ? Number(updatedOrder.price) : undefined,
      });
    }

    return updatedOrder;
  },
};
