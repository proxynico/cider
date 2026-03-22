import { describe, expect, test } from "bun:test";
import { validate } from "../src/types.ts";
import type { ToolDef } from "../src/types.ts";

const mock: ToolDef = {
  name: "test_tool",
  desc: "test",
  params: {
    title: { type: "string", desc: "Title", req: true },
    count: { type: "number", desc: "Count", int: true, min: 0, max: 10 },
    date: { type: "string", desc: "Date", date: true },
    flag: { type: "boolean", desc: "Flag" },
  },
  handle: async () => "",
};

const noParams: ToolDef = { name: "empty", desc: "test", handle: async () => "" };

describe("validate", () => {
  test("passes valid required-only input", () => {
    expect(validate(mock, { title: "hi" })).toEqual({ title: "hi" });
  });

  test("passes valid input with all fields", () => {
    expect(validate(mock, { title: "hi", count: 5, date: "2024-01-01T00:00:00", flag: true }))
      .toEqual({ title: "hi", count: 5, date: "2024-01-01T00:00:00", flag: true });
  });

  test("rejects unknown fields", () => {
    expect(() => validate(mock, { title: "hi", junk: 1 })).toThrow("unknown");
  });

  test("rejects missing required field", () => {
    expect(() => validate(mock, {})).toThrow("missing");
  });

  test("rejects empty required string", () => {
    expect(() => validate(mock, { title: "  " })).toThrow("must not be empty");
  });

  test("rejects wrong type", () => {
    expect(() => validate(mock, { title: 42 })).toThrow("must be string");
  });

  test("rejects invalid date string", () => {
    expect(() => validate(mock, { title: "hi", date: "nope" })).toThrow("ISO 8601");
  });

  test("rejects non-integer", () => {
    expect(() => validate(mock, { title: "hi", count: 1.5 })).toThrow("integer");
  });

  test("rejects below min", () => {
    expect(() => validate(mock, { title: "hi", count: -1 })).toThrow(">= 0");
  });

  test("rejects above max", () => {
    expect(() => validate(mock, { title: "hi", count: 11 })).toThrow("<= 10");
  });

  test("rejects non-boolean", () => {
    expect(() => validate(mock, { title: "hi", flag: "yes" })).toThrow("must be boolean");
  });

  test("rejects non-object input", () => {
    expect(() => validate(mock, null as unknown as Record<string, unknown>)).toThrow("expected argument object");
  });

  test("accepts empty args for tool with no params", () => {
    expect(validate(noParams, {})).toEqual({});
  });

  test("skips undefined optional fields", () => {
    const result = validate(mock, { title: "hi" });
    expect(result).not.toHaveProperty("count");
    expect(result).not.toHaveProperty("flag");
  });
});
