import { NextRequest, NextResponse } from "next/server";
import { clearStudentSession, getStudentIdFromRequest } from "@/lib/auth";
import { getStudentAuthStatus } from "@/lib/actions";
import { DEVICE_ID_COOKIE_NAME } from "@/lib/constants";
import { formatDatabaseError } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const studentId = getStudentIdFromRequest(request);
    const result = await getStudentAuthStatus({
      student_id: studentId,
      device_id:
        request.cookies.get(DEVICE_ID_COOKIE_NAME)?.value ??
        request.nextUrl.searchParams.get("device_id") ??
        "",
    });

    const response = NextResponse.json(result);

    if (studentId && !result.authenticated) {
      clearStudentSession(response);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        authenticated: false,
        device_id: "",
        deviceRestricted: false,
        message: formatDatabaseError(error),
      },
      { status: 500 },
    );
  }
}
