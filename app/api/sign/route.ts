import { NextRequest, NextResponse } from "next/server";
import { verifyAndSign } from "@/lib/actions";
import { getStudentIdFromRequest } from "@/lib/auth";
import { DEVICE_ID_COOKIE_NAME } from "@/lib/constants";
import { formatDatabaseError } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentId = getStudentIdFromRequest(request);
    const result = await verifyAndSign({
      session_id: body.session_id ?? "",
      device_id: request.cookies.get(DEVICE_ID_COOKIE_NAME)?.value ?? body.device_id ?? "",
      ...(studentId ? { student_id: studentId } : {}),
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
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
