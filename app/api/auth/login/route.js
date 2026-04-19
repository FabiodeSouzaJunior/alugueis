import { NextResponse } from "next/server";

import { handleLoginAuth } from "@/server/modules/auth";

export async function POST(request) {
  const response = await handleLoginAuth(request);
  return NextResponse.json(response.body, { status: response.status });
}
