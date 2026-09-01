import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "feature_disabled",
        message: "AI 教练在当前版本未开放。",
      },
    },
    { status: 404 }
  );
}
