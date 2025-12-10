import { cashMovementRepository } from "@/features/cashMovements/repository";
import { portfolioRepository } from "@/features/portfolios/repository";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
}));

const portfolioId = "fa767471-118c-47a2-99a7-998506bb26e1";

// const createRequest = (body: unknown, portfolioId: string) =>
//   new Request(`http://localhost/api/portfolios/${portfolioId}/cashMovements`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(body),
//   });

describe("POST /api/portfolios/[id]/orders", () => {
  it("creates a new buy order", async () => {});
  it("creates a new sell order", async () => {});
  it("cannot create a buy order with a non-numeric quantity", async () => {});
  it("cannot create a buy order with a non-numeric price", async () => {});
  it("cannot create a sell order with a non-numeric quantity", async () => {});
  it("cannot create a sell order with a non-numeric price", async () => {});
  it("disocunts the portfolio cash value after a buy order is created", async () => {});
  it("adjusts the portfolio cash value after a sell order is created", async () => {});
  it("updates the portfolio position after a buy order is created", async () => {});
  it("updates the portfolio position after a sell order is created", async () => {});
  it("updates the portfolio snapshot after a buy order is created", async () => {});
  it("updates the portfolio snapshot after a sell order is created", async () => {});
  it("updates the portfolio snapshot after a buy order is created", async () => {});
});
