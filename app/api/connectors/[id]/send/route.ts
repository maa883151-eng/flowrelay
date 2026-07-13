import { NextRequest, NextResponse } from "next/server";
import { getConnector, recordDelivery } from "@/lib/store";
import { applyMapping } from "@/lib/transform";
import { checkOutboundUrl } from "@/lib/urlGuard";

const FETCH_TIMEOUT_MS = 8000;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/connectors/[id]/send">) {
  const { id } = await ctx.params;
  const connector = getConnector(id);
  if (!connector) return NextResponse.json({ error: "Connector not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const samplePayload = body?.samplePayload;
  if (samplePayload === undefined) {
    return NextResponse.json({ error: "samplePayload is required" }, { status: 400 });
  }

  // Re-check at send time — a connector's target could have been created before
  // this guard existed, or the guard rules could have changed since.
  const urlCheck = checkOutboundUrl(connector.targetUrl);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
  }

  const transformed = applyMapping(samplePayload, connector.mapping);
  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const h of connector.headers) {
    if (h.key) headers[h.key] = h.value;
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(connector.targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(transformed),
      signal: controller.signal,
    });
    const responseBody = await res.text();
    const delivery = recordDelivery({
      connectorId: connector.id,
      connectorName: connector.name,
      requestBody: transformed,
      responseStatus: res.status,
      responseBody: responseBody.slice(0, 2000),
      error: null,
      durationMs: Date.now() - started,
    });
    return NextResponse.json(delivery);
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "Request timed out" : "Request failed";
    const delivery = recordDelivery({
      connectorId: connector.id,
      connectorName: connector.name,
      requestBody: transformed,
      responseStatus: null,
      responseBody: null,
      error: message,
      durationMs: Date.now() - started,
    });
    return NextResponse.json(delivery);
  } finally {
    clearTimeout(timeout);
  }
}
