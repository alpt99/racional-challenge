import { NextResponse } from "next/server";
import { z } from "zod";
import { userApplication } from "@/features/users/application";
import { DomainError } from "@/lib/errors";

export async function PATCH(
  request: Request,
  { params }: { params: { id: number } }
) {
  try {
    const json = await request.json();
    const body = {
      ...json,
      id: Number((await params).id),
    };
    const response = await userApplication.updateUser(body);
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
