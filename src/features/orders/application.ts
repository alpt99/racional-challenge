import {
  placeOrderSchema,
  updateOrderStatusSchema,
  type PlaceOrderInput,
  type UpdateOrderStatusInput,
  type OrderSideValue,
} from "./model";
import { orderRepository } from "./repository";
import { portfolioPositionRepository } from "../portfolioPositions/repository";

export const orderApplication = {
  listOrdersForPortfolio: (portfolioId: string) =>
    orderRepository.listByPortfolio(portfolioId),

  placeOrder: (input: PlaceOrderInput) => {
    const payload = placeOrderSchema.parse(input);
    return orderRepository.create(payload);
  },

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
