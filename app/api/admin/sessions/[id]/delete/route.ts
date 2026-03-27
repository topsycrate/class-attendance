import { NextRequest, NextResponse } from "next/server";
import { deleteAttendanceSession } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatSupabaseError } from "@/lib/supabase";

interface DeleteSessionRouteProps {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: DeleteSessionRouteProps) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const { id } = await params;

  try {
    await deleteAttendanceSession(id);

    const redirectUrl = new URL("/admin/session", request.url);
    redirectUrl.searchParams.set("message", "签到场次已删除");
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const redirectUrl = new URL(`/admin/session/${id}`, request.url);
    redirectUrl.searchParams.set("error", formatSupabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
