import { NextRequest, NextResponse } from "next/server";
import { clearStudentSession } from "@/lib/auth";

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({
    success: true,
  });
  clearStudentSession(response);
  return response;
}
