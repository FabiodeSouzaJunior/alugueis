import { NextResponse } from "next/server";

import { handleCreateTenant, handleListTenants } from "@/server/modules/tenants";
import { withAuthContext } from "@/lib/auth";

async function _GET(request, context) {
  const response = await handleListTenants(request);
  return NextResponse.json(response.body, { status: response.status });
}

async function _POST(request, context) {
  const response = await handleCreateTenant(request);
  return NextResponse.json(response.body, { status: response.status });
}

export const GET = withAuthContext(_GET);
export const POST = withAuthContext(_POST);
