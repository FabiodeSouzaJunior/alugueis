import { NextResponse } from "next/server";

import {
  handleDeleteTenant,
  handleGetTenant,
  handleUpdateTenant,
} from "@/server/modules/tenants";
import { withAuth } from "@/lib/auth";

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

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
