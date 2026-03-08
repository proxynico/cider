import { describe, expect, test } from "bun:test";

import {
  asDateExpr,
  escapeForAppleScriptLiteral,
  escapeForJXALiteral,
  validateTimeoutMs,
} from "../src/applescript.ts";

describe("AppleScript/JXA helpers", () => {
  test("escapeForAppleScriptLiteral escapes quoting and real newline characters", () => {
    const input = 'line1"\nline2\\tail';
    const out = escapeForAppleScriptLiteral(input);
    expect(out).toContain("\\n");
    expect(out).toContain("\\\\");
    expect(out).toContain('\\"');
  });

  test("escapeForJXALiteral escapes quoting and real newline characters", () => {
    const input = 'line1"\nline2\\tail';
    const out = escapeForJXALiteral(input);
    expect(out).toContain("\\n");
    expect(out).toContain("\\\\");
    expect(out).toContain('\\"');
  });

  test("asDateExpr generates applescript date expression", () => {
    const expr = asDateExpr("2024-03-15T10:30:00.000Z");
    expect(expr).toContain("date \"1/1/1970");
  });

  test("validateTimeoutMs rejects invalid timeout", () => {
    expect(() => validateTimeoutMs(0)).toThrow();
  });
});
