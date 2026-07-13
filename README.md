# FlowRelay

> A Zapier-style webhook connector: reshape a JSON payload with declarative field
> mapping and relay it to any webhook, with delivery logging and SSRF-guarded targets.

**Live demo:** _(added after deploy)_ — a demo connector is pre-loaded, pointed at [httpbin.org](https://httpbin.org/post) so you can send a test event immediately and see exactly what was sent and received.

## What it does

- **Connectors** — name a target webhook URL, add custom headers, and define a field-mapping pipeline (source path → target path, with optional `uppercase`/`lowercase`/`trim` and a fallback value).
- **Send test event** — paste or edit a sample JSON payload, apply the mapping, and POST the transformed result to the real target URL. No mocking — this hits an actual endpoint.
- **Delivery log** — every send is recorded with status code, duration, and the full transformed request/response bodies, expandable per entry.

## Architecture decisions

- **SSRF guard on every send, not just at creation.** [`lib/urlGuard.ts`](lib/urlGuard.ts) blocks loopback, RFC1918 private ranges, and link-local addresses — including `169.254.169.254`, the AWS/GCP/Azure cloud metadata endpoint, the single most common SSRF exploitation target. This is a real concern for any public tool that relays to user-supplied URLs, not a hypothetical one; the check runs both when a connector is saved and again at send time, since a connector's target could predate a guard-rule change.
- **Bounded outbound requests.** Sends go through an `AbortController` with an 8-second timeout, so a slow or unresponsive target can't tie up the request indefinitely.
- **Declarative mapping over an expression language.** `lib/transform.ts` implements dot-path get/set plus a handful of named transforms — enough for the common "rename and reshape" case without pulling in a full JSONata/JMESPath dependency, and it's fully unit-testable as pure functions.
- **In-memory demo storage.** Connectors and delivery logs live in a module-level store scoped to the serverless instance — resets on cold start/redeploy, the same zero-config tradeoff used across this portfolio.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Vitest

## Running locally

```bash
npm install
npm run dev   # http://localhost:3000
```

## Testing

```bash
npm test
```

Covers the mapping engine (renaming, reshaping, transforms, fallbacks, edge cases) and the
URL guard (valid URLs, invalid schemes, loopback, private ranges, the cloud metadata address,
and a check that it doesn't false-positive on public IPs sharing a prefix with a private range).

## Deploying

```bash
npm i -g vercel
vercel --prod
```

No environment variables required — it works out of the box.

---

Built by **Ahmed Al-Madani**
