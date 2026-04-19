import { NextResponse } from "next/server";

import { handleRegisterAuth } from "@/server/modules/auth";

export async function POST(request) {
  const response = await handleRegisterAuth(request);
  return NextResponse.json(response.body, { status: response.status });
}
