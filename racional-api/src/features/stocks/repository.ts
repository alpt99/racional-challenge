import { prisma } from "@/lib/prisma";

export const stockRepository = {
  list: () =>
    prisma.stock.findMany({
      orderBy: { symbol: "asc" },
    }),
  findBySymbol: (symbol: string) =>
    prisma.stock.findUnique({
      where: { symbol },
    }),
  findById: (id: string) =>
    prisma.stock.findUnique({
      where: { id },
    }),
  create: (data: any) => prisma.stock.create({ data }),
  update: (id: string, data: any) =>
    prisma.stock.update({
      where: { id },
      data,
    }),
};
