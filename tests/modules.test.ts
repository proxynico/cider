/**
 * Module smoke tests.
 *
 * Importing the tool modules IS the primary test — if any file has a syntax
 * error (e.g. nested template literals) Bun will fail to parse it and the
 * whole suite errors before a single test runs.
 */
import { describe, expect, test } from "bun:test";

import calendar from "../src/tools/calendar.ts";
import reminders from "../src/tools/reminders.ts";
import notes from "../src/tools/notes.ts";
import contacts from "../src/tools/contacts.ts";
import type { ToolModule } from "../src/types.ts";

const modules: [string, ToolModule][] = [
  ["calendar", calendar],
  ["reminders", reminders],
  ["notes", notes],
  ["contacts", contacts],
];

// ── Structure ────────────────────────────────────────────────────────────────

describe("module structure", () => {
  for (const [name, mod] of modules) {
    describe(name, () => {
      test("exports a non-empty tools array", () => {
        expect(Array.isArray(mod.tools)).toBe(true);
        expect(mod.tools.length).toBeGreaterThan(0);
      });

      test("every tool has name, description, and inputSchema", () => {
        for (const tool of mod.tools) {
          expect(typeof tool.name).toBe("string");
          expect(tool.name.length).toBeGreaterThan(0);
          expect(typeof tool.description).toBe("string");
          expect(typeof tool.inputSchema).toBe("object");
        }
      });

      test("exports handleCall function", () => {
        expect(typeof mod.handleCall).toBe("function");
      });

      test("exports parseArgs function", () => {
        expect(typeof mod.parseArgs).toBe("function");
      });
    });
  }
});

// ── parseArgs — valid inputs don't throw ────────────────────────────────────

describe("parseArgs valid inputs", () => {
  // Calendar
  test("calendar_list_calendars", () => {
    expect(() => calendar.parseArgs!("calendar_list_calendars", {})).not.toThrow();
  });

  test("calendar_list_events", () => {
    expect(() =>
      calendar.parseArgs!("calendar_list_events", {
        startDate: "2024-01-01T00:00:00",
        endDate: "2024-01-31T23:59:59",
      })
    ).not.toThrow();
  });

  test("calendar_create_event", () => {
    expect(() =>
      calendar.parseArgs!("calendar_create_event", {
        title: "Team meeting",
        startDate: "2024-06-01T09:00:00",
        endDate: "2024-06-01T10:00:00",
      })
    ).not.toThrow();
  });

  test("calendar_update_event", () => {
    expect(() =>
      calendar.parseArgs!("calendar_update_event", {
        title: "Team meeting",
        calendar: "Work",
        newTitle: "All-hands",
      })
    ).not.toThrow();
  });

  test("calendar_delete_event", () => {
    expect(() =>
      calendar.parseArgs!("calendar_delete_event", {
        title: "Team meeting",
        calendar: "Work",
      })
    ).not.toThrow();
  });

  // Reminders
  test("reminders_list_lists", () => {
    expect(() => reminders.parseArgs!("reminders_list_lists", {})).not.toThrow();
  });

  test("reminders_list", () => {
    expect(() =>
      reminders.parseArgs!("reminders_list", { listName: "Inbox", showCompleted: false })
    ).not.toThrow();
  });

  test("reminders_list defaults showCompleted to false", () => {
    expect(reminders.parseArgs!("reminders_list", { listName: "Inbox" })).toEqual({
      listName: "Inbox",
      showCompleted: false,
    });
  });

  test("reminders_create", () => {
    expect(() =>
      reminders.parseArgs!("reminders_create", { name: "Buy milk", list: "Inbox" })
    ).not.toThrow();
  });

  test("reminders_create with all optional fields", () => {
    expect(() =>
      reminders.parseArgs!("reminders_create", {
        name: "Call doctor",
        list: "Personal",
        dueDate: "2024-06-01T09:00:00",
        notes: "Remember to ask about results",
        priority: 1,
      })
    ).not.toThrow();
  });

  test("reminders_complete", () => {
    expect(() =>
      reminders.parseArgs!("reminders_complete", { name: "Buy milk", list: "Inbox" })
    ).not.toThrow();
  });

  test("reminders_delete", () => {
    expect(() =>
      reminders.parseArgs!("reminders_delete", { name: "Buy milk", list: "Inbox" })
    ).not.toThrow();
  });

  // Notes
  test("notes_list_folders", () => {
    expect(() => notes.parseArgs!("notes_list_folders", {})).not.toThrow();
  });

  test("notes_list", () => {
    expect(() => notes.parseArgs!("notes_list", {})).not.toThrow();
  });

  test("notes_list with folder", () => {
    expect(() => notes.parseArgs!("notes_list", { folder: "Work" })).not.toThrow();
  });

  test("notes_create", () => {
    expect(() =>
      notes.parseArgs!("notes_create", { title: "Meeting notes", body: "We discussed..." })
    ).not.toThrow();
  });

  test("notes_read", () => {
    expect(() => notes.parseArgs!("notes_read", { title: "Meeting notes" })).not.toThrow();
  });

  test("notes_search", () => {
    expect(() => notes.parseArgs!("notes_search", { query: "meeting" })).not.toThrow();
  });

  test("notes_delete", () => {
    expect(() => notes.parseArgs!("notes_delete", { title: "Meeting notes" })).not.toThrow();
  });

  // Contacts
  test("contacts_list", () => {
    expect(() => contacts.parseArgs!("contacts_list", {})).not.toThrow();
  });

  test("contacts_search", () => {
    expect(() => contacts.parseArgs!("contacts_search", { query: "John" })).not.toThrow();
  });

  test("contacts_get", () => {
    expect(() => contacts.parseArgs!("contacts_get", { name: "John Doe" })).not.toThrow();
  });

  test("contacts_create minimal", () => {
    expect(() =>
      contacts.parseArgs!("contacts_create", { firstName: "John", lastName: "Doe" })
    ).not.toThrow();
  });

  test("contacts_create with all optional fields", () => {
    expect(() =>
      contacts.parseArgs!("contacts_create", {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        org: "Acme",
        title: "Engineer",
      })
    ).not.toThrow();
  });

  test("contacts_delete", () => {
    expect(() =>
      contacts.parseArgs!("contacts_delete", { name: "John Doe" })
    ).not.toThrow();
  });
});

// ── parseArgs — invalid inputs throw ────────────────────────────────────────

describe("parseArgs rejects invalid inputs", () => {
  test("rejects unknown fields", () => {
    expect(() =>
      contacts.parseArgs!("contacts_get", { name: "John", unknownField: true })
    ).toThrow();
  });

  test("rejects missing required fields", () => {
    expect(() => contacts.parseArgs!("contacts_get", {})).toThrow();
  });

  test("rejects wrong type for required string", () => {
    expect(() => contacts.parseArgs!("contacts_get", { name: 42 })).toThrow();
  });

  test("rejects invalid date string for calendar event", () => {
    expect(() =>
      calendar.parseArgs!("calendar_list_events", {
        startDate: "not-a-date",
        endDate: "2024-01-31T23:59:59",
      })
    ).toThrow();
  });
});
