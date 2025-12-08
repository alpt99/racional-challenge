import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

export const cashMovementRepository = {
  listByPortfolio: (portfolioId: string) =>
    prismaAny.cashMovement.findMany({
      where: { portfolioId },
      orderBy: { happenedAt: "desc" },
    }),

  create: (data: any) => prismaAny.cashMovement.create({ data }),
};
