import { describe, it, expect } from "vitest";
import { applyMapping } from "../transform";

describe("applyMapping", () => {
  it("renames and reshapes nested fields", () => {
    const source = { customer: { full_name: "Jamie Lin", email: "j@example.com" } };
    const result = applyMapping(source, [
      { sourcePath: "customer.full_name", targetPath: "name" },
      { sourcePath: "customer.email", targetPath: "contact.email" },
    ]);
    expect(result).toEqual({ name: "Jamie Lin", contact: { email: "j@example.com" } });
  });

  it("applies uppercase, lowercase, and trim transforms", () => {
    const source = { a: "  Hello  ", b: "WORLD", c: "shout" };
    const result = applyMapping(source, [
      { sourcePath: "a", targetPath: "a", transform: "trim" },
      { sourcePath: "b", targetPath: "b", transform: "lowercase" },
      { sourcePath: "c", targetPath: "c", transform: "uppercase" },
    ]);
    expect(result).toEqual({ a: "Hello", b: "world", c: "SHOUT" });
  });

  it("uses the fallback when the source path is missing", () => {
    const result = applyMapping({}, [{ sourcePath: "missing.field", targetPath: "x", fallback: "default" }]);
    expect(result).toEqual({ x: "default" });
  });

  it("omits the target field when there is no value and no fallback", () => {
    const result = applyMapping({}, [{ sourcePath: "missing.field", targetPath: "x" }]);
    expect(result).toEqual({});
  });

  it("skips rules with an empty target path", () => {
    const result = applyMapping({ a: 1 }, [{ sourcePath: "a", targetPath: "" }]);
    expect(result).toEqual({});
  });

  it("passes through non-string values (numbers) unaffected by string transforms", () => {
    const result = applyMapping({ amount: 42 }, [{ sourcePath: "amount", targetPath: "total", transform: "uppercase" }]);
    expect(result).toEqual({ total: 42 });
  });
});
