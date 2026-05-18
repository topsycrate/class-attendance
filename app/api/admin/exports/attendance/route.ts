import { NextRequest, NextResponse } from "next/server";
import { exportSessionAttendanceCsv } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

function csvResponse(filename: string, csv: string) {
  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const sessionDate = request.nextUrl.searchParams.get("session_date") ?? "";

  try {
    const csv = await exportSessionAttendanceCsv({ date: sessionDate });

    return csvResponse(
      sessionDate ? `attendance-history-${sessionDate}.csv` : "attendance-history.csv",
      csv,
    );
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, "/admin/stats");

    if (sessionDate) {
      redirectUrl.searchParams.set("session_date", sessionDate);
    }

    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
