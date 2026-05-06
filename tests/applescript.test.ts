import { describe, expect, test } from "bun:test";
import { esc, asDateExpr } from "../src/applescript.ts";
import { isoToEpochMs } from "../src/dates.ts";

function localDateLiteral(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `(date "${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}")`;
}

describe("AppleScript/JXA helpers", () => {
  test("esc escapes quotes, backslashes, and control characters", () => {
    const out = esc('line1"\nline2\\tail');
    expect(out).toContain("\\n");
    expect(out).toContain("\\\\");
    expect(out).toContain('\\"');
  });

  test("asDateExpr preserves timezone-aware instants as local AppleScript dates", () => {
    expect(asDateExpr("2024-03-15T10:30:00.000Z")).toBe(localDateLiteral("2024-03-15T10:30:00.000Z"));
  });

  test("asDateExpr treats date-only input as local midnight", () => {
    expect(asDateExpr("2024-03-15")).toBe('(date "3/15/2024 00:00:00")');
  });

  test("isoToEpochMs treats date-only input as local midnight", () => {
    expect(isoToEpochMs("2024-03-15")).toBe(new Date(2024, 2, 15, 0, 0, 0, 0).getTime());
  });

  test("asDateExpr rejects invalid dates", () => {
    expect(() => asDateExpr("not-a-date")).toThrow("Invalid date");
  });
});
