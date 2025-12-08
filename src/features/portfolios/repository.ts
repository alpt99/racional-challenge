import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

export const portfolioRepository = {
  findById: (id: string) =>
    prismaAny.portfolio.findUnique({
      where: { id },
      include: {
        positions: true,
        cashMovements: true,
        orders: true,
        snapshots: true,
      },
    }),
  findByUser: (userId: number) =>
    prismaAny.portfolio.findMany({
      where: { userId },
      include: {
        positions: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  create: (data: any) => prismaAny.portfolio.create({ data }),
  update: (id: string, data: any) =>
    prismaAny.portfolio.update({
      where: { id },
      data,
    }),
};
