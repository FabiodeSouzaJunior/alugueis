import { NextResponse } from "next/server";

import { handleCreateTenant, handleListTenants } from "@/server/modules/tenants";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  const response = await handleListTenants(request);
  return NextResponse.json(response.body, { status: response.status });
}

async function _POST(request, context) {
  const response = await handleCreateTenant(request);
  return NextResponse.json(response.body, { status: response.status });
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
