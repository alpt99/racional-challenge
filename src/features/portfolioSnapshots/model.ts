import { z } from "zod";

export const captureSnapshotSchema = z.object({
  portfolioId: z.string().uuid(),
  asOf: z.coerce.date(),
  totalValue: z.number().nonnegative(),
  cashValue: z.number().nonnegative(),
  investedValue: z.number().nonnegative(),
});

export type CaptureSnapshotInput = z.infer<typeof captureSnapshotSchema>;
