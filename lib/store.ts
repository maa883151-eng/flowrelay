import type { MappingRule } from "./transform";

export type Connector = {
  id: string;
  name: string;
  targetUrl: string;
  headers: Array<{ key: string; value: string }>;
  mapping: MappingRule[];
  createdAt: string;
};

export type Delivery = {
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

const DEFAULT_MAPPING: MappingRule[] = [
  { sourcePath: "customer.full_name", targetPath: "name", transform: "trim" },
  { sourcePath: "customer.email", targetPath: "email", transform: "lowercase" },
  { sourcePath: "order.total", targetPath: "amount" },
  { sourcePath: "order.currency", targetPath: "currency", fallback: "USD" },
];

function seedConnectors(): Connector[] {
  return [
    {
      id: "connector-demo",
      name: "New order → CRM contact",
      targetUrl: "https://httpbin.org/post",
      headers: [{ key: "x-source", value: "flowrelay-demo" }],
      mapping: DEFAULT_MAPPING,
      createdAt: new Date(0).toISOString(),
    },
  ];
}

type Store = { connectors: Connector[]; deliveries: Delivery[] };
const globalForStore = globalThis as unknown as { __flowrelayStore?: Store };

function getStore(): Store {
  if (!globalForStore.__flowrelayStore) {
    globalForStore.__flowrelayStore = { connectors: seedConnectors(), deliveries: [] };
  }
  return globalForStore.__flowrelayStore;
}

export function listConnectors(): Connector[] {
  return [...getStore().connectors];
}

export function getConnector(id: string): Connector | undefined {
  return getStore().connectors.find((c) => c.id === id);
}

export function createConnector(input: Omit<Connector, "id" | "createdAt">): Connector {
  const connector: Connector = {
    ...input,
    id: `connector-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    createdAt: new Date().toISOString(),
  };
  getStore().connectors.push(connector);
  return connector;
}

export function deleteConnector(id: string): boolean {
  const store = getStore();
  const idx = store.connectors.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  store.connectors.splice(idx, 1);
  return true;
}

export function recordDelivery(delivery: Omit<Delivery, "id" | "createdAt">): Delivery {
  const entry: Delivery = {
    ...delivery,
    id: `delivery-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    createdAt: new Date().toISOString(),
  };
  const store = getStore();
  store.deliveries.unshift(entry);
  store.deliveries = store.deliveries.slice(0, 50); // cap demo log size
  return entry;
}

export function listDeliveries(): Delivery[] {
  return [...getStore().deliveries];
}

export { DEFAULT_MAPPING };
