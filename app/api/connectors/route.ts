import { NextRequest, NextResponse } from "next/server";
import { listConnectors, createConnector } from "@/lib/store";
import { checkOutboundUrl } from "@/lib/urlGuard";
import type { MappingRule } from "@/lib/transform";

export async function GET() {
  return NextResponse.json({ connectors: listConnectors() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const targetUrl = typeof body?.targetUrl === "string" ? body.targetUrl.trim() : "";
  const headers = Array.isArray(body?.headers) ? body.headers : [];
  const mapping: MappingRule[] = Array.isArray(body?.mapping) ? body.mapping : [];

  if (!name || !targetUrl || mapping.length === 0) {
    return NextResponse.json({ error: "name, targetUrl, and at least one mapping rule are required" }, { status: 400 });
  }

  const urlCheck = checkOutboundUrl(targetUrl);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
  }

  const connector = createConnector({ name, targetUrl, headers, mapping });
  return NextResponse.json(connector, { status: 201 });
}
