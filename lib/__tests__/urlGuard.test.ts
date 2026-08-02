import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkOutboundUrl, checkOutboundUrlWithDnsResolution } from "../urlGuard";
import { promises as dns } from "node:dns";

vi.mock("node:dns", () => ({
  promises: {
    lookup: vi.fn(),
  },
}));

const mockLookup = vi.mocked(dns.lookup);

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

describe("checkOutboundUrlWithDnsResolution", () => {
  beforeEach(() => {
    mockLookup.mockReset();
  });

  it("blocks a hostname that DNS-rebinds to a private IP even though the literal hostname looks public", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as never);
    const result = await checkOutboundUrlWithDnsResolution("http://evil-but-looks-public.example.com/hook");
    expect(result.ok).toBe(false);
  });

  it("blocks a hostname that resolves to the cloud metadata link-local address", async () => {
    mockLookup.mockResolvedValue([{ address: "169.254.169.254", family: 4 }] as never);
    const result = await checkOutboundUrlWithDnsResolution("http://looks-fine.example.com/hook");
    expect(result.ok).toBe(false);
  });

  it("blocks when any one of multiple resolved addresses is private", () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.1.1", family: 4 },
    ] as never);
    return checkOutboundUrlWithDnsResolution("http://multi-a-record.example.com/hook").then((result) => {
      expect(result.ok).toBe(false);
    });
  });

  it("allows a hostname that resolves only to public IPs", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    const result = await checkOutboundUrlWithDnsResolution("https://example.com/webhook");
    expect(result).toEqual({ ok: true });
    expect(mockLookup).toHaveBeenCalledWith("example.com", { all: true, verbatim: true });
  });

  it("still rejects on the literal-string checks without ever calling DNS", async () => {
    const result = await checkOutboundUrlWithDnsResolution("http://localhost:3000/hook");
    expect(result.ok).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("does not block when DNS resolution itself fails (host is unreachable regardless)", async () => {
    mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
    const result = await checkOutboundUrlWithDnsResolution("http://does-not-resolve.example.com/hook");
    expect(result).toEqual({ ok: true });
  });
});
