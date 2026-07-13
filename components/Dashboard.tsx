"use client";

import { useEffect, useState } from "react";
import type { MappingRule } from "@/lib/transform";

type Connector = {
  id: string;
  name: string;
  targetUrl: string;
  headers: Array<{ key: string; value: string }>;
  mapping: MappingRule[];
};

type Delivery = {
  id: string;
  connectorId: string;
  connectorName: string;
  requestBody: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  durationMs: number;
  createdAt: string;
};

const SAMPLE_PAYLOAD = JSON.stringify(
  {
    customer: { full_name: "  Jamie Lin  ", email: "Jamie.Lin@Example.com" },
    order: { total: 84.5, currency: "USD" },
  },
  null,
  2
);

const TRANSFORMS: NonNullable<MappingRule["transform"]>[] = ["none", "uppercase", "lowercase", "trim"];

function emptyRule(): MappingRule {
  return { sourcePath: "", targetPath: "", transform: "none", fallback: "" };
}

export function Dashboard() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [rules, setRules] = useState<MappingRule[]>([emptyRule()]);
  const [formError, setFormError] = useState<string | null>(null);

  const [payloadDrafts, setPayloadDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => {
    const [cRes, dRes] = await Promise.all([fetch("/api/connectors"), fetch("/api/deliveries")]);
    const cData = await cRes.json();
    const dData = await dRes.json();
    setConnectors(cData.connectors ?? []);
    setDeliveries(dData.deliveries ?? []);
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  const updateRule = (idx: number, patch: Partial<MappingRule>) => {
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const createConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const validRules = rules.filter((r) => r.sourcePath && r.targetPath);
    const res = await fetch("/api/connectors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, targetUrl, headers: [], mapping: validRules }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error ?? "Failed to create connector");
      return;
    }
    setName("");
    setTargetUrl("");
    setRules([emptyRule()]);
    setShowForm(false);
    load();
  };

  const removeConnector = async (id: string) => {
    await fetch(`/api/connectors/${id}`, { method: "DELETE" });
    load();
  };

  const sendTest = async (connector: Connector) => {
    setSending(connector.id);
    const raw = payloadDrafts[connector.id] ?? SAMPLE_PAYLOAD;
    let samplePayload: unknown;
    try {
      samplePayload = JSON.parse(raw);
    } catch {
      setSending(null);
      alert("Sample payload is not valid JSON");
      return;
    }
    await fetch(`/api/connectors/${connector.id}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ samplePayload }),
    });
    setSending(null);
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-50">FlowRelay</h1>
          <p className="text-sm text-zinc-400">
            Reshape a JSON payload and relay it to any webhook — a Zapier-style connector.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-amber-500 text-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-amber-400"
        >
          {showForm ? "Cancel" : "+ New connector"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createConnector} className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              required
              placeholder="Connector name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
            />
            <input
              required
              placeholder="Target webhook URL (https://…)"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          <p className="text-xs font-medium text-zinc-400 mt-2">Field mapping</p>
          {rules.map((rule, idx) => (
            <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input
                placeholder="source.path"
                value={rule.sourcePath}
                onChange={(e) => updateRule(idx, { sourcePath: e.target.value })}
                className="rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-500"
              />
              <input
                placeholder="target.path"
                value={rule.targetPath}
                onChange={(e) => updateRule(idx, { targetPath: e.target.value })}
                className="rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-500"
              />
              <select
                value={rule.transform}
                onChange={(e) => updateRule(idx, { transform: e.target.value as MappingRule["transform"] })}
                className="rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-sm text-zinc-100"
              >
                {TRANSFORMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                placeholder="fallback (optional)"
                value={rule.fallback}
                onChange={(e) => updateRule(idx, { fallback: e.target.value })}
                className="rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={() => setRules((rs) => rs.filter((_, i) => i !== idx))}
                className="text-xs text-red-400 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRules((rs) => [...rs, emptyRule()])}
            className="self-start text-xs text-amber-400 hover:underline"
          >
            + Add mapping rule
          </button>

          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <button type="submit" className="mt-2 rounded-lg bg-amber-500 text-zinc-950 py-2 text-sm font-semibold hover:bg-amber-400">
            Save connector
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {connectors.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-[18px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-100">{c.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                  {c.targetUrl} · {c.mapping.length} field{c.mapping.length === 1 ? "" : "s"}
                </p>
              </div>
              <button onClick={() => removeConnector(c.id)} className="text-[11.5px] font-medium text-red-400 hover:underline">
                Delete
              </button>
            </div>
            <textarea
              value={payloadDrafts[c.id] ?? SAMPLE_PAYLOAD}
              onChange={(e) => setPayloadDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
              rows={5}
              className="mt-3.5 w-full rounded-[10px] border-0 bg-black/40 px-3.5 py-3 font-mono text-[11.5px] text-emerald-300/90"
            />
            <button
              onClick={() => sendTest(c)}
              disabled={sending === c.id}
              className="mt-3 rounded-lg bg-amber-500 text-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-amber-400 disabled:opacity-50"
            >
              {sending === c.id ? "Sending…" : "Send test event"}
            </button>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2.5 text-[13.5px] font-semibold text-zinc-300">Delivery log</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-zinc-500">No deliveries yet — send a test event above.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {deliveries.map((d) => (
              <details key={d.id} className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3.5">
                <summary className="flex cursor-pointer items-center justify-between text-sm">
                  <span className="font-medium text-zinc-200">{d.connectorName}</span>
                  <span className="flex items-center gap-3.5 font-mono text-[11.5px] text-zinc-500">
                    <span className={d.error ? "text-red-400" : d.responseStatus && d.responseStatus < 300 ? "text-emerald-400" : "text-amber-400"}>
                      {d.error ?? `HTTP ${d.responseStatus}`}
                    </span>
                    <span>{d.durationMs}ms</span>
                  </span>
                </summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="mb-1 font-medium text-zinc-500">Sent (transformed)</p>
                    <pre className="overflow-x-auto rounded-lg bg-black/40 p-2.5 font-mono text-emerald-300/90">{JSON.stringify(d.requestBody, null, 2)}</pre>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-zinc-500">Response</p>
                    <pre className="overflow-x-auto rounded-lg bg-black/40 p-2.5 font-mono text-zinc-300">{d.responseBody ?? d.error ?? "—"}</pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
