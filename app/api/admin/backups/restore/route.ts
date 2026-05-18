import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError, restoreDatabaseBackup } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

export const runtime = "nodejs";

function buildStudentsRedirect(request: NextRequest) {
  return buildRedirectUrl(request, "/admin/students");
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const formData = await request.formData();
  const backupFile = formData.get("backup_file");
  const redirectUrl = buildStudentsRedirect(request);

  if (!(backupFile instanceof File) || backupFile.size === 0) {
    redirectUrl.searchParams.set("error", "请选择要加载的备份文件");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    const restoreResult = await restoreDatabaseBackup(Buffer.from(await backupFile.arrayBuffer()));
    redirectUrl.searchParams.set(
      "message",
      `备份已加载，恢复前快照已自动保存为 ${restoreResult.rollbackFilename}`,
    );
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
