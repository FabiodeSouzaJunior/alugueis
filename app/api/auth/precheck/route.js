import { NextResponse } from "next/server";

import { handlePrecheckAuth } from "@/server/modules/auth";

export async function POST(request) {
  const response = await handlePrecheckAuth(request);
  return NextResponse.json(response.body, { status: response.status });
}
