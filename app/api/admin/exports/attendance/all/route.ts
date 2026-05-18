import { NextRequest, NextResponse } from "next/server";
import { exportAllAttendanceCsv } from "@/lib/actions";
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

  try {
    const csv = await exportAllAttendanceCsv();
    return csvResponse("attendance-all.csv", csv);
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, "/admin/stats");
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
