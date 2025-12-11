import { POST } from "@/app/api/portfolios/[id]/cashMovements/route";
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

jest.mock("@/features/cashMovements/repository", () => ({
  cashMovementRepository: {
    listByPortfolio: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("@/features/portfolios/repository", () => ({
  portfolioRepository: {
    findById: jest.fn(),
    update: jest.fn(),
  },
}));

const portfolioId = "fa767471-118c-47a2-99a7-998506bb26e1";

const createRequest = (body: unknown, portfolioId: string) =>
  new Request(`http://localhost/api/portfolios/${portfolioId}/cashMovements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe.skip("POST /api/portfolios/[id]/cashMovements", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    (portfolioRepository.findById as jest.Mock).mockResolvedValue(
      new Promise((resolve) => {
        resolve({
          id: "fa767471-118c-47a2-99a7-998506bb26e1",
          cashValue: 1000,
          totalValue: 1000,
          investedValue: 0,
        });
      })
    );
  });

  it("records a deposit movement", async () => {
    const portfolioId = "fa767471-118c-47a2-99a7-998506bb26e1";
    const requestBody = {
      type: "DEPOSIT",
      amount: 1000,
      currency: "USD",
      happenedAt: new Date().toISOString(),
      note: "Initial deposit",
    };
    const fakeMovement = {
      id: "movement-1",
      ...requestBody,
    };

    const mockCreate = cashMovementRepository.create as jest.MockedFunction<
      typeof cashMovementRepository.create
    >;
    mockCreate.mockResolvedValue(fakeMovement);

    const response = await POST(createRequest(requestBody, portfolioId), {
      params: { id: portfolioId },
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ data: fakeMovement });
    expect(mockCreate).toHaveBeenCalledWith({
      portfolio: { connect: { id: portfolioId } },
      type: requestBody.type,
      amount: requestBody.amount,
      currency: requestBody.currency,
      happenedAt: new Date(requestBody.happenedAt),
      note: requestBody.note,
    });
  });

  it("records a withdrawal movement", async () => {
    const requestBody = {
      type: "WITHDRAWAL",
      amount: 250,
      currency: "USD",
      happenedAt: new Date().toISOString(),
    };
    const fakeMovement = {
      id: "movement-2",
      ...requestBody,
    };

    const mockCreate = cashMovementRepository.create as jest.MockedFunction<
      typeof cashMovementRepository.create
    >;
    mockCreate.mockResolvedValue(fakeMovement);

    const response = await POST(createRequest(requestBody, portfolioId), {
      params: { id: portfolioId },
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ data: fakeMovement });
    expect(mockCreate).toHaveBeenCalledWith({
      portfolio: { connect: { id: portfolioId } },
      type: requestBody.type,
      amount: requestBody.amount,
      currency: requestBody.currency,
      happenedAt: new Date(requestBody.happenedAt),
    });
  });

  it("cannot withdraw more than the portfolio has", async () => {
    const requestBody = {
      type: "WITHDRAWAL",
      amount: 2500,
      currency: "USD",
      happenedAt: new Date().toISOString(),
    };
    const response = await POST(createRequest(requestBody, portfolioId), {
      params: { id: portfolioId },
    });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: "INSUFFICIENT_FUNDS",
    });
  });

  it("cannot deposit a negative amount", async () => {
    const portfolioId = "5f6ff102-3ff1-45aa-a894-22df3ed7e5d8";
    const requestBody = {
      type: "DEPOSIT",
      amount: -100,
      currency: "USD",
      happenedAt: new Date().toISOString(),
    };
    const response = await POST(createRequest(requestBody, portfolioId), {
      params: { id: portfolioId },
    });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toEqual("Invalid request body");
  });

  it("cannot withdraw a negative amount", async () => {
    const portfolioId = "5f6ff102-3ff1-45aa-a894-22df3ed7e5d8";
    const requestBody = {
      type: "WITHDRAWAL",
      amount: -100,
      currency: "USD",
      happenedAt: new Date().toISOString(),
    };
    const response = await POST(createRequest(requestBody, portfolioId), {
      params: { id: portfolioId },
    });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toEqual("Invalid request body");
  });

  it("cannot deposit a non-numeric amount", async () => {
    const portfolioId = "5f6ff102-3ff1-45aa-a894-22df3ed7e5d8";
    const requestBody = {
      type: "DEPOSIT",
      amount: "not a number",
      currency: "USD",
      happenedAt: new Date().toISOString(),
    };
    const response = await POST(createRequest(requestBody, portfolioId), {
      params: { id: portfolioId },
    });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toEqual("Invalid request body");
  });

  it("cannot withdraw a non-numeric amount", async () => {
    const portfolioId = "5f6ff102-3ff1-45aa-a894-22df3ed7e5d8";
    const requestBody = {
      type: "WITHDRAWAL",
      amount: "not a number",
      currency: "USD",
      happenedAt: new Date().toISOString(),
    };
    const response = await POST(createRequest(requestBody, portfolioId), {
      params: { id: portfolioId },
    });
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toEqual("Invalid request body");
  });

  it("portfolio cash value is updated after a deposit is recorded", async () => {
    const requestBody = {
      type: "DEPOSIT",
      amount: 1000,
      currency: "USD",
      happenedAt: new Date().toISOString(),
    };
    const mockCreate = cashMovementRepository.create as jest.MockedFunction<
      typeof cashMovementRepository.create
    >;
    mockCreate.mockResolvedValue({
      id: "movement-1",
      ...requestBody,
    });
    const response = await POST(createRequest(requestBody, portfolioId), {
      params: { id: portfolioId },
    });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toEqual({ data: { id: "movement-1", ...requestBody } });
    expect(portfolioRepository.update).toHaveBeenCalledWith(portfolioId, {
      cashValue: 2000,
      totalValue: 2000,
      investedValue: 0,
    });
  });

  it.only("portfolio cash value is updated after a withdrawal is recorded", async () => {
    const requestBody = {
      type: "WITHDRAWAL",
      amount: 1000,
      currency: "USD",
      happenedAt: new Date().toISOString(),
    };
    const mockCreate = cashMovementRepository.create as jest.MockedFunction<
      typeof cashMovementRepository.create
    >;
    mockCreate.mockResolvedValue({
      id: "movement-1",
      ...requestBody,
    });
    const response = await POST(createRequest(requestBody, portfolioId), {
      params: { id: portfolioId },
    });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toEqual({ data: { id: "movement-1", ...requestBody } });
    expect(portfolioRepository.update).toHaveBeenCalledWith(portfolioId, {
      cashValue: 0,
      totalValue: 0,
      investedValue: 0,
    });
  });
});
