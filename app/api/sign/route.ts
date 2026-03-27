import { NextRequest, NextResponse } from "next/server";
import { verifyAndSign } from "@/lib/actions";
import { DEVICE_ID_COOKIE_NAME } from "@/lib/constants";
import { formatSupabaseError } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await verifyAndSign({
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
        message: formatSupabaseError(error),
      },
      { status: 500 },
    );
  }
}
