import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "feature_disabled",
        message: "AI Coach is not available in this release.",
      },
    },
    { status: 404 }
  );
}
