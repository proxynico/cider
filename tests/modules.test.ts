import { describe, expect, test } from "bun:test";
import { validate } from "../src/types.ts";
import type { ToolDef } from "../src/types.ts";
import calendar from "../src/tools/calendar.ts";
import reminders from "../src/tools/reminders.ts";
import notes from "../src/tools/notes.ts";
import contacts from "../src/tools/contacts.ts";

const allTools = [...calendar, ...reminders, ...notes, ...contacts];
const find = (name: string) => allTools.find(t => t.name === name)!;

const modules: [string, ToolDef[]][] = [
  ["calendar", calendar],
  ["reminders", reminders],
  ["notes", notes],
  ["contacts", contacts],
];

// ── Structure ────────────────────────────────────────────────────────────────

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

// ── validate — valid inputs ─────────────────────────────────────────────────

describe("validate valid inputs", () => {
  // Calendar
  test("calendar_list_calendars", () => {
    expect(() => validate(find("calendar_list_calendars"), {})).not.toThrow();
  });

  test("calendar_list_events", () => {
    expect(() => validate(find("calendar_list_events"), {
      startDate: "2024-01-01T00:00:00", endDate: "2024-01-31T23:59:59",
    })).not.toThrow();
  });

  test("calendar_create_event", () => {
    expect(() => validate(find("calendar_create_event"), {
      title: "Meeting", startDate: "2024-06-01T09:00:00", endDate: "2024-06-01T10:00:00",
    })).not.toThrow();
  });

  test("calendar_update_event", () => {
    expect(() => validate(find("calendar_update_event"), {
      title: "Meeting", calendar: "Work", newTitle: "All-hands",
    })).not.toThrow();
  });

  test("calendar_delete_event", () => {
    expect(() => validate(find("calendar_delete_event"), {
      title: "Meeting", calendar: "Work",
    })).not.toThrow();
  });

  // Reminders
  test("reminders_list_lists", () => {
    expect(() => validate(find("reminders_list_lists"), {})).not.toThrow();
  });

  test("reminders_list", () => {
    expect(() => validate(find("reminders_list"), { listName: "Inbox" })).not.toThrow();
  });

  test("reminders_create", () => {
    expect(() => validate(find("reminders_create"), { name: "Buy milk", list: "Inbox" })).not.toThrow();
  });

  test("reminders_create with all optional fields", () => {
    expect(() => validate(find("reminders_create"), {
      name: "Call doctor", list: "Personal",
      dueDate: "2024-06-01T09:00:00", notes: "Ask about results", priority: 1,
    })).not.toThrow();
  });

  test("reminders_create accepts priority 0-9", () => {
    for (const p of [0, 1, 5, 9, 3, 7]) {
      expect(() => validate(find("reminders_create"), { name: "x", list: "y", priority: p })).not.toThrow();
    }
  });

  test("reminders_complete", () => {
    expect(() => validate(find("reminders_complete"), { name: "Buy milk", list: "Inbox" })).not.toThrow();
  });

  test("reminders_delete", () => {
    expect(() => validate(find("reminders_delete"), { name: "Buy milk", list: "Inbox" })).not.toThrow();
  });

  // Notes
  test("notes_list_folders", () => {
    expect(() => validate(find("notes_list_folders"), {})).not.toThrow();
  });

  test("notes_list", () => {
    expect(() => validate(find("notes_list"), {})).not.toThrow();
  });

  test("notes_list with folder", () => {
    expect(() => validate(find("notes_list"), { folder: "Work" })).not.toThrow();
  });

  test("notes_create", () => {
    expect(() => validate(find("notes_create"), { title: "Notes", body: "Content" })).not.toThrow();
  });

  test("notes_read", () => {
    expect(() => validate(find("notes_read"), { title: "Notes" })).not.toThrow();
  });

  test("notes_search", () => {
    expect(() => validate(find("notes_search"), { query: "meeting" })).not.toThrow();
  });

  test("notes_update with title", () => {
    expect(() => validate(find("notes_update"), { title: "Old", newTitle: "New" })).not.toThrow();
  });

  test("notes_update with body", () => {
    expect(() => validate(find("notes_update"), { title: "Old", newBody: "Updated content" })).not.toThrow();
  });

  test("notes_delete", () => {
    expect(() => validate(find("notes_delete"), { title: "Notes" })).not.toThrow();
  });

  // Contacts
  test("contacts_list", () => {
    expect(() => validate(find("contacts_list"), {})).not.toThrow();
  });

  test("contacts_list with limit", () => {
    expect(() => validate(find("contacts_list"), { limit: 50 })).not.toThrow();
  });

  test("contacts_search", () => {
    expect(() => validate(find("contacts_search"), { query: "John" })).not.toThrow();
  });

  test("contacts_get", () => {
    expect(() => validate(find("contacts_get"), { name: "John Doe" })).not.toThrow();
  });

  test("contacts_create minimal", () => {
    expect(() => validate(find("contacts_create"), { firstName: "John", lastName: "Doe" })).not.toThrow();
  });

  test("contacts_create with all fields", () => {
    expect(() => validate(find("contacts_create"), {
      firstName: "John", lastName: "Doe",
      email: "john@example.com", phone: "+1234567890", org: "Acme", title: "Engineer",
    })).not.toThrow();
  });

  test("contacts_delete", () => {
    expect(() => validate(find("contacts_delete"), { name: "John Doe" })).not.toThrow();
  });
});

// ── validate — invalid inputs ───────────────────────────────────────────────

describe("validate rejects invalid inputs", () => {
  test("rejects unknown fields", () => {
    expect(() => validate(find("contacts_get"), { name: "John", unknownField: true })).toThrow();
  });

  test("rejects missing required fields", () => {
    expect(() => validate(find("contacts_get"), {})).toThrow();
  });

  test("rejects wrong type", () => {
    expect(() => validate(find("contacts_get"), { name: 42 })).toThrow();
  });

  test("rejects invalid date", () => {
    expect(() => validate(find("calendar_list_events"), {
      startDate: "not-a-date", endDate: "2024-01-31T23:59:59",
    })).toThrow();
  });

  test("rejects invalid limit", () => {
    expect(() => validate(find("contacts_list"), { limit: 0 })).toThrow();
    expect(() => validate(find("contacts_list"), { limit: 1.5 })).toThrow();
  });

  test("rejects priority out of range", () => {
    expect(() => validate(find("reminders_create"), { name: "x", list: "y", priority: -1 })).toThrow();
    expect(() => validate(find("reminders_create"), { name: "x", list: "y", priority: 10 })).toThrow();
  });
});
