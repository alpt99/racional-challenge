import { NextResponse } from "next/server";
import { z } from "zod";
import { cashMovementApplication } from "@/features/cashMovements/application";
import { DomainError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const json = await request.json();
    const body = {
      ...json,
      portfolioId: (await params).id,
      happenedAt: new Date(),
    };
    const response = await cashMovementApplication.recordMovementWithEffects(
      body
    );
    return NextResponse.json({ data: response }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      );
    }

    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.code ?? error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
