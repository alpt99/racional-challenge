import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not defined. Did you copy env.example to .env?"
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const seededUser = await prisma.user.upsert({
    where: { email: "demo@racional.com" },
    update: {},
    create: {
      email: "demo@racional.com",
      name: "Demo User",
      portfolios: {
        create: [
          {
            name: "Demo Portfolio",
            baseCurrency: "USD",
            totalValue: 0,
            cashValue: 0,
            investedValue: 0,
          },
        ],
      },
    },
    include: {
      portfolios: true,
    },
  });

  console.log(
    `Seeded user ${seededUser.email} with ${seededUser.portfolios.length} portfolio(s).`
  );
}

main()
  .catch((error) => {
    console.error("Error while seeding database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
