import { NextResponse } from "next/server";
import { getPublicCurrentSession } from "@/lib/actions";
import { formatDatabaseError } from "@/lib/db";

export async function GET() {
  try {
    const result = await getPublicCurrentSession();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        active: false,
        message: formatDatabaseError(error),
      },
      { status: 500 },
    );
  }
}
