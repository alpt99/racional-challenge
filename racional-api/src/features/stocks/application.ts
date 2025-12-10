import {
  createStockSchema,
  updateStockSchema,
  type CreateStockInput,
  type UpdateStockInput,
} from "./model";
import { stockRepository } from "./repository";

export const stockApplication = {
  listStocks: () => stockRepository.list(),

  ensureStock: async (input: CreateStockInput) => {
    const payload = createStockSchema.parse(input);
    const existing = await stockRepository.findBySymbol(payload.symbol);
    if (existing) {
      return existing;
    }

    return stockRepository.create({
      symbol: payload.symbol,
      name: payload.name,
      exchange: payload.exchange,
      currency: payload.currency,
    });
  },

  updateStock: (input: UpdateStockInput) => {
    const payload = updateStockSchema.parse(input);
    return stockRepository.update(payload.id, {
      name: payload.name,
      exchange: payload.exchange,
      currency: payload.currency,
    });
  },
};
