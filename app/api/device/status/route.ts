import { NextRequest, NextResponse } from "next/server";
import { getDeviceStatus } from "@/lib/actions";
import { DEVICE_ID_COOKIE_NAME } from "@/lib/constants";
import { formatSupabaseError } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const deviceId =
      request.cookies.get(DEVICE_ID_COOKIE_NAME)?.value ??
      request.nextUrl.searchParams.get("device_id") ??
      "";

    const result = await getDeviceStatus(deviceId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: formatSupabaseError(error),
      },
      { status: 500 },
    );
  }
}
