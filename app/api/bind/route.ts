import { NextRequest, NextResponse } from "next/server";
import { bindStudentDevice } from "@/lib/actions";
import { DEVICE_ID_COOKIE_NAME } from "@/lib/constants";
import { formatDatabaseError } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await bindStudentDevice({
      ...body,
      device_id: request.cookies.get(DEVICE_ID_COOKIE_NAME)?.value ?? body.device_id ?? "",
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
