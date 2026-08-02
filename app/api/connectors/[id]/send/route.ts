import { NextRequest, NextResponse } from "next/server";
import { getConnector, recordDelivery } from "@/lib/store";
import { applyMapping } from "@/lib/transform";
import { checkOutboundUrlWithDnsResolution } from "@/lib/urlGuard";
import { checkRateLimit } from "@/lib/rateLimit";

const FETCH_TIMEOUT_MS = 8000;

// This endpoint forwards arbitrary POST bodies to a connector's target URL —
// without a limit it's effectively an open request-forwarding proxy that
// could be used to flood a third party. Two independent sliding windows: one
// per client IP (stops a single caller from hammering the endpoint across
// connectors), one per connector (stops any single target from being flooded
// regardless of how many callers are involved).
const IP_RATE_LIMIT = { limit: 20, windowMs: 60_000 };
const CONNECTOR_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/connectors/[id]/send">) {
  const { id } = await ctx.params;
  const connector = getConnector(id);
  if (!connector) return NextResponse.json({ error: "Connector not found" }, { status: 404 });

  const ipRate = checkRateLimit(`ip:${getClientIp(request)}`, IP_RATE_LIMIT);
  const connectorRate = checkRateLimit(`connector:${connector.id}`, CONNECTOR_RATE_LIMIT);
  if (!ipRate.allowed || !connectorRate.allowed) {
    const retryAfterMs = Math.max(
      ipRate.allowed ? 0 : ipRate.retryAfterMs,
      connectorRate.allowed ? 0 : connectorRate.retryAfterMs
    );
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down and try again shortly." },
      { status: 429, headers: { "retry-after": Math.ceil(retryAfterMs / 1000).toString() } }
    );
  }

  const body = await request.json().catch(() => null);
  const samplePayload = body?.samplePayload;
  if (samplePayload === undefined) {
    return NextResponse.json({ error: "samplePayload is required" }, { status: 400 });
  }

  // Re-check at send time — a connector's target could have been created before
  // this guard existed, or the guard rules could have changed since. This also
  // re-resolves DNS right before the fetch so a hostname that has been
  // rebound to a private/internal address since connector creation is caught.
  const urlCheck = await checkOutboundUrlWithDnsResolution(connector.targetUrl);
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
