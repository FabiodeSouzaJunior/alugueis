import { NextResponse } from "next/server";

import {
  handleDeleteTenant,
  handleGetTenant,
  handleUpdateTenant,
} from "@/server/modules/tenants";
import { withAuthContext } from "@/lib/auth";

async function resolveTenantId(params) {
  const resolvedParams = typeof params?.then === "function" ? await params : params;
  return resolvedParams?.id;
}

async function _GET(request, { params }) {
  const response = await handleGetTenant(request, await resolveTenantId(params));
  return NextResponse.json(response.body, { status: response.status });
}

async function _PUT(request, { params }) {
  const response = await handleUpdateTenant(request, await resolveTenantId(params));
  return NextResponse.json(response.body, { status: response.status });
}

async function _DELETE(request, { params }) {
  const response = await handleDeleteTenant(request, await resolveTenantId(params));
  return NextResponse.json(response.body, { status: response.status });
}

export const GET = withAuthContext(_GET);
export const PUT = withAuthContext(_PUT);
export const DELETE = withAuthContext(_DELETE);
