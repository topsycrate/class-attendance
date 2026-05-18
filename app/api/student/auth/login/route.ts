import { NextRequest, NextResponse } from "next/server";
import { setStudentSession } from "@/lib/auth";
import { loginStudent } from "@/lib/actions";
import { DEVICE_ID_COOKIE_NAME } from "@/lib/constants";
import { formatDatabaseError } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await loginStudent({
      student_id: body.student_id ?? "",
      pin: body.pin ?? "",
      device_id: request.cookies.get(DEVICE_ID_COOKIE_NAME)?.value ?? body.device_id ?? "",
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    const response = NextResponse.json(result);
    setStudentSession(response, result.student.id);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        code: "SERVER_ERROR",
        message: formatDatabaseError(error),
      },
      { status: 500 },
    );
  }
}
