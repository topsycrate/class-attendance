import { NextRequest, NextResponse } from "next/server";
import { getSignContext } from "@/lib/actions";
import { DEVICE_ID_COOKIE_NAME } from "@/lib/constants";
import { formatSupabaseError } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const result = await getSignContext({
      session_id: request.nextUrl.searchParams.get("session_id") ?? "",
      device_id:
        request.cookies.get(DEVICE_ID_COOKIE_NAME)?.value ??
        request.nextUrl.searchParams.get("device_id") ??
        "",
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        code: "SERVER_ERROR",
        message: formatSupabaseError(error),
      },
      { status: 500 },
    );
  }
}
