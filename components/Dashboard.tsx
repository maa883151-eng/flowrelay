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
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">FlowRelay</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Reshape a JSON payload and relay it to any webhook — a Zapier-style connector.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ New connector"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createConnector} className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              required
              placeholder="Connector name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Target webhook URL (https://…)"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>

          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2">Field mapping</p>
          {rules.map((rule, idx) => (
            <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input
                placeholder="source.path"
                value={rule.sourcePath}
                onChange={(e) => updateRule(idx, { sourcePath: e.target.value })}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="target.path"
                value={rule.targetPath}
                onChange={(e) => updateRule(idx, { targetPath: e.target.value })}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
              />
              <select
                value={rule.transform}
                onChange={(e) => updateRule(idx, { transform: e.target.value as MappingRule["transform"] })}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
              >
                {TRANSFORMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                placeholder="fallback (optional)"
                value={rule.fallback}
                onChange={(e) => updateRule(idx, { fallback: e.target.value })}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setRules((rs) => rs.filter((_, i) => i !== idx))}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRules((rs) => [...rs, emptyRule()])}
            className="self-start text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            + Add mapping rule
          </button>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button type="submit" className="mt-2 rounded-lg bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700">
            Save connector
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {connectors.map((c) => (
          <div key={c.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{c.name}</p>
                <p className="text-xs text-zinc-400">{c.targetUrl} · {c.mapping.length} field{c.mapping.length === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => removeConnector(c.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
            <textarea
              value={payloadDrafts[c.id] ?? SAMPLE_PAYLOAD}
              onChange={(e) => setPayloadDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
              rows={5}
              className="mt-3 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 font-mono text-xs"
            />
            <button
              onClick={() => sendTest(c)}
              disabled={sending === c.id}
              className="mt-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {sending === c.id ? "Sending…" : "Send test event"}
            </button>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Delivery log</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-zinc-400">No deliveries yet — send a test event above.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {deliveries.map((d) => (
              <details key={d.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <summary className="flex cursor-pointer items-center justify-between text-sm">
                  <span className="text-zinc-800 dark:text-zinc-200">{d.connectorName}</span>
                  <span className="flex items-center gap-3 text-xs text-zinc-400">
                    <span
                      className={
                        d.error
                          ? "text-red-600"
                          : d.responseStatus && d.responseStatus < 300
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }
                    >
                      {d.error ?? `HTTP ${d.responseStatus}`}
                    </span>
                    <span>{d.durationMs}ms</span>
                  </span>
                </summary>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="font-medium text-zinc-500 mb-1">Sent (transformed)</p>
                    <pre className="overflow-x-auto rounded bg-zinc-50 dark:bg-zinc-950 p-2">{JSON.stringify(d.requestBody, null, 2)}</pre>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-500 mb-1">Response</p>
                    <pre className="overflow-x-auto rounded bg-zinc-50 dark:bg-zinc-950 p-2">{d.responseBody ?? d.error ?? "—"}</pre>
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
