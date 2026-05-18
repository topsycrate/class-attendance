import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createDatabaseBackupFile, formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  try {
    const backup = await createDatabaseBackupFile();

    return new NextResponse(new Uint8Array(backup.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(backup.filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, "/admin/students");
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
