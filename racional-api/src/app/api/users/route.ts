import { NextResponse } from "next/server";
import { z } from "zod";
import { userApplication } from "@/features/users/application";

export async function GET() {
  // TODO: change to use features
  const response = await userApplication.listUsers();

  return NextResponse.json({ data: response }, { status: 200 });
}

export async function PATCH(request: Request) {
  try {
    const json = await request.json();
    const response = await userApplication.updateUser(json);

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
//     if (error instanceof z.ZodError) {
//       return NextResponse.json(
//         {
//           error: "Invalid request body",
//           details: error.flatten(),
//         },
//         { status: 400 }
//       );
//     }

//     if (
//       error instanceof PrismaClientKnownRequestError &&
//       error.code === "P2002"
//     ) {
//       return NextResponse.json(
//         {
//           error: "Email already exists",
//         },
//         { status: 409 }
//       );
//     }

//     console.error(error);
//     return NextResponse.json(
//       { error: "Unexpected server error" },
//       { status: 500 }
//     );
//   }
// }
