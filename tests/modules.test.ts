import { describe, expect, test } from "bun:test";
import { toZodShape } from "../src/types.ts";
import type { ToolDef } from "../src/types.ts";
import { z } from "zod";
import calendar from "../src/tools/calendar.ts";
import notes from "../src/tools/notes.ts";
import contacts from "../src/tools/contacts.ts";
import doctor from "../src/tools/doctor.ts";

const allTools = [...calendar, ...notes, ...contacts, ...doctor];
const find = (name: string) => allTools.find(t => t.name === name)!;
const parse = (name: string, input: unknown) => z.object(toZodShape(find(name))).parse(input);
const ok = (name: string, input: unknown) => z.object(toZodShape(find(name))).safeParse(input).success;

const modules: [string, ToolDef[]][] = [
  ["calendar", calendar],
  ["notes", notes],
  ["contacts", contacts],
  ["doctor", doctor],
];

const mutatingTools = [
  "calendar_create_event",
  "calendar_update_event",
  "calendar_delete_event",
  "notes_create",
  "notes_append",
  "notes_move",
  "notes_update",
  "notes_delete",
  "contacts_create",
  "contacts_update",
  "contacts_delete",
];

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

describe("schema accepts valid inputs", () => {
  test("doctor", () => {
    expect(() => parse("doctor", {})).not.toThrow();
  });

  test("calendar_list_calendars", () => {
    expect(() => parse("calendar_list_calendars", {})).not.toThrow();
  });

  test("calendar_search_events", () => {
    expect(() => parse("calendar_search_events", {
      startDate: "2024-01-01T00:00:00", endDate: "2024-01-31T23:59:59",
    })).not.toThrow();
  });

  test("calendar_search_events with optional filters", () => {
    expect(() => parse("calendar_search_events", {
      startDate: "2024-01-01", endDate: "2024-01-31", calendarName: "Work", query: "planning",
    })).not.toThrow();
  });

  test("calendar_create_event", () => {
    expect(() => parse("calendar_create_event", {
      title: "Meeting", startDate: "2024-06-01T09:00:00", endDate: "2024-06-01T10:00:00",
    })).not.toThrow();
  });

  test("calendar_update_event", () => {
    expect(() => parse("calendar_update_event", {
      title: "Meeting", newTitle: "All-hands",
    })).not.toThrow();
  });

  test("calendar_update_event with notes", () => {
    expect(() => parse("calendar_update_event", {
      title: "Meeting", calendar: "Work", newNotes: "Bring agenda",
    })).not.toThrow();
  });

  test("calendar_delete_event", () => {
    expect(() => parse("calendar_delete_event", {
      title: "Meeting",
    })).not.toThrow();
  });

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

  test("notes_append", () => {
    expect(() => parse("notes_append", { title: "Notes", text: "More text" })).not.toThrow();
  });

  test("notes_move", () => {
    expect(() => parse("notes_move", { title: "Notes", folder: "Archive" })).not.toThrow();
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

  test("contacts_update", () => {
    expect(() => parse("contacts_update", { name: "John Doe", newFirstName: "Jane" })).not.toThrow();
  });

  test("contacts_update with optional fields", () => {
    expect(() => parse("contacts_update", {
      name: "John Doe",
      newLastName: "Smith",
      newEmail: "jane@example.com",
      newPhone: "+1987654321",
      newOrg: "Acme",
      newTitle: "Director",
    })).not.toThrow();
  });

  test("contacts_delete", () => {
    expect(() => parse("contacts_delete", { name: "John Doe" })).not.toThrow();
  });

  test("mutating tools accept dryRun", () => {
    for (const name of mutatingTools) {
      expect(find(name).params?.dryRun?.type).toBe("boolean");
    }
  });

  test("notes list and search accept bounded limits", () => {
    expect(() => parse("notes_list", { limit: 50 })).not.toThrow();
    expect(() => parse("notes_search", { query: "meeting", limit: 50 })).not.toThrow();
    expect(ok("notes_list", { limit: 501 })).toBe(false);
    expect(ok("notes_search", { query: "meeting", limit: 501 })).toBe(false);
  });
});

describe("schema rejects invalid inputs", () => {
  test("rejects missing required fields", () => {
    expect(ok("contacts_get", {})).toBe(false);
  });

  test("rejects wrong type", () => {
    expect(ok("contacts_get", { name: 42 })).toBe(false);
  });

  test("rejects invalid date", () => {
    expect(ok("calendar_search_events", {
      startDate: "not-a-date", endDate: "2024-01-31T23:59:59",
    })).toBe(false);
  });

  test("rejects invalid limit", () => {
    expect(ok("contacts_list", { limit: 0 })).toBe(false);
    expect(ok("contacts_list", { limit: 1.5 })).toBe(false);
    expect(ok("contacts_list", { limit: 1001 })).toBe(false);
  });
});

describe("dry-run handlers", () => {
  test("calendar create dry-run does not execute Calendar", async () => {
    const text = await find("calendar_create_event").handle({
      title: "Dry Run",
      startDate: "2024-03-15T10:30:00Z",
      endDate: "2024-03-15T11:00:00Z",
      dryRun: true,
    });
    expect(text).toContain("Dry run: create calendar event");
  });

  test("notes update dry-run does not execute Notes", async () => {
    const text = await find("notes_update").handle({
      title: "Dry Run",
      newTitle: "Dry Run 2",
      dryRun: true,
    });
    expect(text).toContain("Dry run: update note");
  });

  test("contacts delete dry-run does not execute Contacts", async () => {
    const text = await find("contacts_delete").handle({
      name: "Dry Run",
      dryRun: true,
    });
    expect(text).toContain("Dry run: delete contact");
  });
});
