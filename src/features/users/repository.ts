import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../generated/prisma/client";

type CreateUserData = Prisma.UserCreateInput;
type UpdateUserData = Prisma.UserUpdateInput;

export const userRepository = {
  findAll: () =>
    prisma.user.findMany({
      orderBy: { id: "desc" },
    }),
  findById: (id: number) =>
    prisma.user.findUnique({
      where: { id },
    }),
  findByEmail: (email: string) =>
    prisma.user.findUnique({
      where: { email },
    }),
  create: (data: CreateUserData) => prisma.user.create({ data }),
  update: (id: number, data: UpdateUserData) =>
    prisma.user.update({
      where: { id },
      data,
    }),
};
