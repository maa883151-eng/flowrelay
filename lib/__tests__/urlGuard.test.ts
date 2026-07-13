import { describe, it, expect } from "vitest";
import { checkOutboundUrl } from "../urlGuard";

describe("checkOutboundUrl", () => {
  it("allows a normal public https URL", () => {
    expect(checkOutboundUrl("https://example.com/webhook")).toEqual({ ok: true });
  });

  it("rejects an invalid URL string", () => {
    expect(checkOutboundUrl("not a url").ok).toBe(false);
  });

  it("rejects non-http(s) schemes", () => {
    expect(checkOutboundUrl("ftp://example.com").ok).toBe(false);
    expect(checkOutboundUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("rejects localhost and loopback addresses", () => {
    expect(checkOutboundUrl("http://localhost:3000/hook").ok).toBe(false);
    expect(checkOutboundUrl("http://127.0.0.1/hook").ok).toBe(false);
  });

  it("rejects the cloud metadata link-local address", () => {
    expect(checkOutboundUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
  });

  it("rejects RFC1918 private ranges", () => {
    expect(checkOutboundUrl("http://10.0.0.5/hook").ok).toBe(false);
    expect(checkOutboundUrl("http://172.16.0.1/hook").ok).toBe(false);
    expect(checkOutboundUrl("http://192.168.1.1/hook").ok).toBe(false);
  });

  it("does not false-positive on public IPs that share a prefix with private ranges", () => {
    expect(checkOutboundUrl("http://172.15.0.1/hook").ok).toBe(true);
    expect(checkOutboundUrl("http://172.32.0.1/hook").ok).toBe(true);
  });
});
