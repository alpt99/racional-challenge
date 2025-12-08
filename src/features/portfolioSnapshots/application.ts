import { captureSnapshotSchema, type CaptureSnapshotInput } from "./model";
import { portfolioSnapshotRepository } from "./repository";

export const portfolioSnapshotApplication = {
  listSnapshots: (portfolioId: string) =>
    portfolioSnapshotRepository.listByPortfolio(portfolioId),

  captureSnapshot: (input: CaptureSnapshotInput) => {
    const payload = captureSnapshotSchema.parse(input);
    return portfolioSnapshotRepository.upsert(
      payload.portfolioId,
      payload.asOf,
      {
        totalValue: payload.totalValue,
        cashValue: payload.cashValue,
        investedValue: payload.investedValue,
      }
    );
  },
};
