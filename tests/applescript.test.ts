import { describe, expect, test } from "bun:test";
import { esc, asDateExpr } from "../src/applescript.ts";

describe("AppleScript/JXA helpers", () => {
  test("esc escapes quotes, backslashes, and control characters", () => {
    const out = esc('line1"\nline2\\tail');
    expect(out).toContain("\\n");
    expect(out).toContain("\\\\");
    expect(out).toContain('\\"');
  });

  test("asDateExpr generates epoch-based date expression", () => {
    const expr = asDateExpr("2024-03-15T10:30:00.000Z");
    expect(expr).toContain("date \"1/1/1970");
    expect(expr).toContain("+");
  });

  test("asDateExpr rejects invalid dates", () => {
    expect(() => asDateExpr("not-a-date")).toThrow("Invalid date");
  });
});
