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
  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return { ok: false, reason: "Requests to internal/private network addresses are blocked" };
  }

  return { ok: true };
}
