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

const DEMO_USER_ID = 1;
const DEMO_PORTFOLIO_ID = "fa767471-118c-47a2-99a7-998506bb26e1";
const DEMO_STOCK_ID = "d894a3bf-5316-49dc-bcd9-3004be5ab0ca";

async function main() {
  const seededUser = await prisma.user.upsert({
    where: { email: "demo@racional.com" },
    update: { name: "Demo User" },
    create: {
      id: DEMO_USER_ID,
      email: "demo@racional.com",
      name: "Demo User",
    },
  });

  const seededPortfolio = await prisma.portfolio.upsert({
    where: { id: DEMO_PORTFOLIO_ID },
    update: {},
    create: {
      id: DEMO_PORTFOLIO_ID,
      userId: seededUser.id,
      name: "Demo Portfolio",
      baseCurrency: "USD",
      totalValue: 0,
      cashValue: 0,
      investedValue: 0,
    },
  });

  const seededStock = await prisma.stock.upsert({
    where: { symbol: "VOO" },
    update: {
      name: "Vanguard S&P 500 ETF",
      exchange: "NYSE",
      currency: "USD",
    },
    create: {
      id: DEMO_STOCK_ID,
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      exchange: "NYSE",
      currency: "USD",
    },
  });

  console.log(
    `Seeded user ${seededUser.email} (id: ${seededUser.id}). Portfolio: ${seededPortfolio.name} (id: ${seededPortfolio.id}).`
  );
  console.log(
    `Seeded stock ${seededStock.symbol} with ${seededStock.name} (id: ${seededStock.id}).`
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
