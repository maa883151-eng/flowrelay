export type MappingRule = {
  sourcePath: string; // dot-path into the source payload, e.g. "user.email"
  targetPath: string; // dot-path to write into the output, e.g. "contact.email"
  transform?: "none" | "uppercase" | "lowercase" | "trim";
  fallback?: string; // used when sourcePath resolves to undefined
};

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

function applyTransform(value: unknown, transform: MappingRule["transform"]): unknown {
  if (typeof value !== "string") return value;
  switch (transform) {
    case "uppercase":
      return value.toUpperCase();
    case "lowercase":
      return value.toLowerCase();
    case "trim":
      return value.trim();
    default:
      return value;
  }
}

/** Applies a declarative field-mapping pipeline to a JSON payload — no dependency
 * on a full expression-language library for the common "rename + reshape" case. */
export function applyMapping(source: unknown, rules: MappingRule[]): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const rule of rules) {
    if (!rule.targetPath.trim()) continue;
    const raw = getByPath(source, rule.sourcePath);
    const resolved = raw === undefined ? rule.fallback : raw;
    if (resolved === undefined) continue;
    setByPath(output, rule.targetPath, applyTransform(resolved, rule.transform));
  }
  return output;
}
