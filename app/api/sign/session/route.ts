import { NextRequest, NextResponse } from "next/server";
import { getSignContext } from "@/lib/actions";
import { getStudentIdFromRequest } from "@/lib/auth";
import { DEVICE_ID_COOKIE_NAME } from "@/lib/constants";
import { formatDatabaseError } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const studentId = getStudentIdFromRequest(request);
    const result = await getSignContext({
      session_id: request.nextUrl.searchParams.get("session_id") ?? "",
      device_id:
        request.cookies.get(DEVICE_ID_COOKIE_NAME)?.value ??
        request.nextUrl.searchParams.get("device_id") ??
        "",
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
