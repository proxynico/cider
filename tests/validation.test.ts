import { describe, expect, test } from "bun:test";

import {
  assertNoUnknownFields,
  assertRecord,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireBoolean,
  requireDateString,
  requireString,
  ValidationError,
} from "../src/tools/validation.ts";

describe("validation helpers", () => {
  test("assertRecord validates object input", () => {
    expect(() => assertRecord(undefined, "tool")).toThrow(ValidationError);
  });

  test("assertNoUnknownFields catches unknown keys", () => {
    expect(() =>
      assertNoUnknownFields({ title: "x", junk: 1 }, ["title"], "tool")
    ).toThrow(ValidationError);
  });

  test("requireString rejects invalid values", () => {
    expect(() => requireString({ title: 1 }, "title", "notes_create")).toThrow(
      ValidationError
    );
  });

  test("requireDateString validates ISO dates", () => {
    expect(() =>
      requireDateString({ startDate: "nope" }, "startDate", "calendar_list_events")
    ).toThrow(ValidationError);
  });

  test("optionalBoolean validates type", () => {
    expect(() =>
      optionalBoolean(
        { showCompleted: "yes" as unknown },
        "showCompleted",
        "reminders_list"
      )
    ).toThrow(ValidationError);
  });

  test("requireBoolean validates type", () => {
    expect(() =>
      requireBoolean({ showCompleted: "yes" as unknown }, "showCompleted", "reminders_list")
    ).toThrow(ValidationError);
  });

  test("optionalNumber validates integer range", () => {
    expect(() =>
      optionalNumber({ p: 1.5 as unknown }, "p", "reminders_create", { integer: true })
    ).toThrow(ValidationError);
  });

  test("optionalString returns undefined for missing values", () => {
    expect(
      optionalString({ foo: 1 } as Record<string, unknown>, "bar", "notes_list")
    ).toBeUndefined();
  });
});
