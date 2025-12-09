import { NextResponse } from "next/server";
import { z } from "zod";
import { portfolioApplication } from "@/features/portfolios/application";
import { DomainError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = (await params).id;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) ?? 10;
    const response = await portfolioApplication.findLatestActions(id, limit);
    return NextResponse.json({ data: response }, { status: 200 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.code ?? error.message },
        { status: error.status }
      );
    }
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
