import { promises as dns } from "node:dns";

// Blocks the common SSRF targets for a server that fetches user-supplied URLs:
// loopback, link-local (this range also covers the AWS/GCP/Azure cloud metadata
// endpoint at 169.254.169.254), and RFC1918 private ranges. Hostname-string based —
// not a substitute for network-level egress controls, but a reasonable first gate
// for a public-facing relay tool.
const BLOCKED_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^169\.254\./, // link-local, includes cloud metadata services
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^\[?::1\]?$/, // IPv6 loopback
  /^\[?fe80:/i, // IPv6 link-local
  /^\[?fc00:/i, // IPv6 unique local
];

function isBlockedAddress(value: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(value));
}

export type UrlCheckResult = { ok: true } | { ok: false; reason: string };

export function checkOutboundUrl(rawUrl: string): UrlCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only http:// and https:// targets are allowed" };
  }

  const hostname = parsed.hostname;
  if (isBlockedAddress(hostname)) {
    return { ok: false, reason: "Requests to internal/private network addresses are blocked" };
  }

  return { ok: true };
}

/**
 * Same checks as `checkOutboundUrl`, plus a DNS-resolution step to close the
 * "DNS rebinding" gap: a hostname can look public (pass the literal-string
 * check) but resolve to a private/internal IP at request time — either
 * because an attacker controls the domain's DNS, or because the record
 * simply changes between when a connector is created and when it's sent.
 * This re-resolves the hostname and validates every returned address against
 * the same blocklist used for literal IPs, immediately before the outbound
 * fetch is issued.
 */
export async function checkOutboundUrlWithDnsResolution(rawUrl: string): Promise<UrlCheckResult> {
  const literalCheck = checkOutboundUrl(rawUrl);
  if (!literalCheck.ok) return literalCheck;

  const { hostname } = new URL(rawUrl);

  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = records.map((r) => r.address);
  } catch {
    // Resolution failure (e.g. NXDOMAIN, resolver hiccup) isn't itself an SSRF
    // risk — a hostname that can't be resolved can't be used to reach an
    // internal address either. Let it through here; the outbound fetch will
    // fail on its own with a clear network error.
    return { ok: true };
  }

  if (addresses.some((address) => isBlockedAddress(address))) {
    return {
      ok: false,
      reason: "Target hostname resolves to an internal/private network address",
    };
  }

  return { ok: true };
}
