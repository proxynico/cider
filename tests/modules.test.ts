import { describe, expect, test } from "bun:test";
import { toZodShape } from "../src/types.ts";
import type { ToolDef } from "../src/types.ts";
import { z } from "zod";
import calendar from "../src/tools/calendar.ts";
import reminders from "../src/tools/reminders.ts";
import notes from "../src/tools/notes.ts";
import contacts from "../src/tools/contacts.ts";

const allTools = [...calendar, ...reminders, ...notes, ...contacts];
const find = (name: string) => allTools.find(t => t.name === name)!;
const parse = (name: string, input: unknown) => z.object(toZodShape(find(name))).parse(input);
const ok = (name: string, input: unknown) => z.object(toZodShape(find(name))).safeParse(input).success;

const modules: [string, ToolDef[]][] = [
  ["calendar", calendar],
  ["reminders", reminders],
  ["notes", notes],
  ["contacts", contacts],
];

// -- Structure ---------------------------------------------------------------

describe("module structure", () => {
  for (const [name, tools] of modules) {
    describe(name, () => {
      test("exports a non-empty tools array", () => {
        expect(tools.length).toBeGreaterThan(0);
      });

      test("every tool has name, desc, and handle", () => {
        for (const t of tools) {
          expect(typeof t.name).toBe("string");
          expect(t.name.length).toBeGreaterThan(0);
          expect(typeof t.desc).toBe("string");
          expect(typeof t.handle).toBe("function");
        }
      });
    });
  }
});

// -- Schema accepts valid inputs ---------------------------------------------

describe("schema accepts valid inputs", () => {
  // Calendar
  test("calendar_list_calendars", () => {
    expect(() => parse("calendar_list_calendars", {})).not.toThrow();
  });

  test("calendar_list_events", () => {
    expect(() => parse("calendar_list_events", {
      startDate: "2024-01-01T00:00:00", endDate: "2024-01-31T23:59:59",
    })).not.toThrow();
  });

  test("calendar_create_event", () => {
    expect(() => parse("calendar_create_event", {
      title: "Meeting", startDate: "2024-06-01T09:00:00", endDate: "2024-06-01T10:00:00",
    })).not.toThrow();
  });

  test("calendar_update_event", () => {
    expect(() => parse("calendar_update_event", {
      title: "Meeting", calendar: "Work", newTitle: "All-hands",
    })).not.toThrow();
  });

  test("calendar_delete_event", () => {
    expect(() => parse("calendar_delete_event", {
      title: "Meeting", calendar: "Work",
    })).not.toThrow();
  });

  // Reminders
  test("reminders_list_lists", () => {
    expect(() => parse("reminders_list_lists", {})).not.toThrow();
  });

  test("reminders_list", () => {
    expect(() => parse("reminders_list", { listName: "Inbox" })).not.toThrow();
  });

  test("reminders_create", () => {
    expect(() => parse("reminders_create", { name: "Buy milk", list: "Inbox" })).not.toThrow();
  });

  test("reminders_create with all optional fields", () => {
    expect(() => parse("reminders_create", {
      name: "Call doctor", list: "Personal",
      dueDate: "2024-06-01T09:00:00", notes: "Ask about results", priority: 1,
    })).not.toThrow();
  });

  test("reminders_create accepts priority 0-9", () => {
    for (const p of [0, 1, 5, 9, 3, 7]) {
      expect(() => parse("reminders_create", { name: "x", list: "y", priority: p })).not.toThrow();
    }
  });

  test("reminders_complete", () => {
    expect(() => parse("reminders_complete", { name: "Buy milk", list: "Inbox" })).not.toThrow();
  });

  test("reminders_delete", () => {
    expect(() => parse("reminders_delete", { name: "Buy milk", list: "Inbox" })).not.toThrow();
  });

  // Notes
  test("notes_list_folders", () => {
    expect(() => parse("notes_list_folders", {})).not.toThrow();
  });

  test("notes_list", () => {
    expect(() => parse("notes_list", {})).not.toThrow();
  });

  test("notes_list with folder", () => {
    expect(() => parse("notes_list", { folder: "Work" })).not.toThrow();
  });

  test("notes_create", () => {
    expect(() => parse("notes_create", { title: "Notes", body: "Content" })).not.toThrow();
  });

  test("notes_read", () => {
    expect(() => parse("notes_read", { title: "Notes" })).not.toThrow();
  });

  test("notes_search", () => {
    expect(() => parse("notes_search", { query: "meeting" })).not.toThrow();
  });

  test("notes_update with title", () => {
    expect(() => parse("notes_update", { title: "Old", newTitle: "New" })).not.toThrow();
  });

  test("notes_update with body", () => {
    expect(() => parse("notes_update", { title: "Old", newBody: "Updated content" })).not.toThrow();
  });

  test("notes_delete", () => {
    expect(() => parse("notes_delete", { title: "Notes" })).not.toThrow();
  });

  // Contacts
  test("contacts_list", () => {
    expect(() => parse("contacts_list", {})).not.toThrow();
  });

  test("contacts_list with limit", () => {
    expect(() => parse("contacts_list", { limit: 50 })).not.toThrow();
  });

  test("contacts_search", () => {
    expect(() => parse("contacts_search", { query: "John" })).not.toThrow();
  });

  test("contacts_get", () => {
    expect(() => parse("contacts_get", { name: "John Doe" })).not.toThrow();
  });

  test("contacts_create minimal", () => {
    expect(() => parse("contacts_create", { firstName: "John", lastName: "Doe" })).not.toThrow();
  });

  test("contacts_create with all fields", () => {
    expect(() => parse("contacts_create", {
      firstName: "John", lastName: "Doe",
      email: "john@example.com", phone: "+1234567890", org: "Acme", title: "Engineer",
    })).not.toThrow();
  });

  test("contacts_delete", () => {
    expect(() => parse("contacts_delete", { name: "John Doe" })).not.toThrow();
  });
});

// -- Schema rejects invalid inputs -------------------------------------------

describe("schema rejects invalid inputs", () => {
  test("rejects missing required fields", () => {
    expect(ok("contacts_get", {})).toBe(false);
  });

  test("rejects wrong type", () => {
    expect(ok("contacts_get", { name: 42 })).toBe(false);
  });

  test("rejects invalid date", () => {
    expect(ok("calendar_list_events", {
      startDate: "not-a-date", endDate: "2024-01-31T23:59:59",
    })).toBe(false);
  });

  test("rejects invalid limit", () => {
    expect(ok("contacts_list", { limit: 0 })).toBe(false);
    expect(ok("contacts_list", { limit: 1.5 })).toBe(false);
  });

  test("rejects priority out of range", () => {
    expect(ok("reminders_create", { name: "x", list: "y", priority: -1 })).toBe(false);
    expect(ok("reminders_create", { name: "x", list: "y", priority: 10 })).toBe(false);
  });
});
