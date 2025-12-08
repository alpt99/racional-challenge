import { NextResponse } from "next/server";
import { z } from "zod";
import { portfolioApplication } from "@/features/portfolios/application";

export async function PATCH(request: Request) {
  try {
    const json = await request.json();
    const response = await portfolioApplication.updatePortfolioInfo(json);

    return NextResponse.json({ data: response }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
