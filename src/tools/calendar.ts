import { resolve, dirname } from "path";
import type { ToolDef } from "../types.ts";
import { isoToEpochMs } from "../dates.ts";

const CAL_BIN = resolve(dirname(import.meta.path), "../helpers/cider-cal");
const CAL_TIMEOUT = 30_000;

function toEpochMsArg(iso: string): string {
  return String(isoToEpochMs(iso));
}

async function runCalBin(...args: string[]): Promise<string> {
  const proc = Bun.spawn([CAL_BIN, ...args], { stdout: "pipe", stderr: "pipe" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const race = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`cider-cal timed out after ${CAL_TIMEOUT}ms`));
    }, CAL_TIMEOUT);
  });

  try {
    const [stdout, stderr, code] = await Promise.race([
      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]),
      race,
    ]);
    if (code !== 0) throw new Error(stderr.trim() || `cider-cal exited ${code}`);
    return stdout.trim();
  } finally {
    clearTimeout(timer);
    if (proc.exitCode === null) {
      proc.kill();
      await proc.exited.catch(() => {});
    }
  }
}

function dryRun(action: string, details: Record<string, unknown>): string {
  return `Dry run: ${action}\n${JSON.stringify(details, null, 2)}`;
}

const tools: ToolDef[] = [
  {
    name: "calendar_list_calendars",
    desc: "List all calendars available in Apple Calendar",
    handle: () => runCalBin(),
  },
  {
    name: "calendar_search_events",
    desc: "Search events in a date range, optionally filtered by calendar and text query",
    params: {
      startDate: { type: "string", desc: "Start date (ISO 8601)", req: true, date: true },
      endDate: { type: "string", desc: "End date (ISO 8601)", req: true, date: true },
      calendarName: { type: "string", desc: "Calendar name (searches all if omitted)" },
      query: { type: "string", desc: "Text query for event title, location, or notes" },
    },
    handle: async (a) => {
      const args = [
        "--start-ms", toEpochMsArg(a.startDate as string),
        "--end-ms", toEpochMsArg(a.endDate as string),
      ];
      if (a.calendarName) args.push("--calendar", a.calendarName as string);
      if (a.query) args.push("--query", a.query as string);
      return runCalBin(...args);
    },
  },
  {
    name: "calendar_create_event",
    desc: "Create a new event in Apple Calendar",
    params: {
      title: { type: "string", desc: "Event title", req: true },
      startDate: { type: "string", desc: "Start date (ISO 8601)", req: true, date: true },
      endDate: { type: "string", desc: "End date (ISO 8601)", req: true, date: true },
      calendar: { type: "string", desc: "Calendar name (uses default if omitted)" },
      location: { type: "string", desc: "Event location" },
      notes: { type: "string", desc: "Event notes" },
      dryRun: { type: "boolean", desc: "Preview the event without creating it" },
    },
    handle: async (a) => {
      const title = a.title as string;
      const args = [
        "--create-event",
        "--title", title,
        "--start-ms", toEpochMsArg(a.startDate as string),
        "--end-ms", toEpochMsArg(a.endDate as string),
      ];
      if (a.calendar) args.push("--calendar", a.calendar as string);
      if (a.location) args.push("--location", a.location as string);
      if (a.notes) args.push("--notes", a.notes as string);
      if (a.dryRun) {
        return dryRun("create calendar event", {
          title,
          calendar: a.calendar ?? "default",
          startDate: a.startDate,
          endDate: a.endDate,
          location: a.location ?? "",
          notes: a.notes ?? "",
        });
      }
      return runCalBin(...args);
    },
  },
  {
    name: "calendar_update_event",
    desc: "Update an existing event by exact title and calendar",
    params: {
      title: { type: "string", desc: "Current event title to find", req: true },
      calendar: { type: "string", desc: "Calendar containing the event (searches all if omitted)" },
      newTitle: { type: "string", desc: "New title" },
      newStart: { type: "string", desc: "New start date (ISO 8601)", date: true },
      newEnd: { type: "string", desc: "New end date (ISO 8601)", date: true },
      newLocation: { type: "string", desc: "New location" },
      newNotes: { type: "string", desc: "New notes" },
      dryRun: { type: "boolean", desc: "Preview the update without changing Calendar" },
    },
    handle: async (a) => {
      const args = ["--update-event", "--title", a.title as string];
      const updates: Record<string, unknown> = {};
      if (a.calendar) args.push("--calendar", a.calendar as string);
      if (a.newTitle) {
        args.push("--new-title", a.newTitle as string);
        updates.newTitle = a.newTitle;
      }
      if (a.newStart) {
        args.push("--start-ms", toEpochMsArg(a.newStart as string));
        updates.newStart = a.newStart;
      }
      if (a.newEnd) {
        args.push("--end-ms", toEpochMsArg(a.newEnd as string));
        updates.newEnd = a.newEnd;
      }
      if (a.newLocation) {
        args.push("--location", a.newLocation as string);
        updates.newLocation = a.newLocation;
      }
      if (a.newNotes) {
        args.push("--notes", a.newNotes as string);
        updates.newNotes = a.newNotes;
      }
      if (!Object.keys(updates).length) throw new Error("No updates specified");
      if (a.dryRun) return dryRun("update calendar event", { title: a.title, calendar: a.calendar ?? "all", updates });
      return runCalBin(...args);
    },
  },
  {
    name: "calendar_delete_event",
    desc: "Delete an event by title and calendar",
    params: {
      title: { type: "string", desc: "Event title to delete", req: true },
      calendar: { type: "string", desc: "Calendar containing the event (searches all if omitted)" },
      dryRun: { type: "boolean", desc: "Preview the deletion without changing Calendar" },
    },
    handle: async (a) => {
      if (a.dryRun) return dryRun("delete calendar event", { title: a.title, calendar: a.calendar ?? "all" });
      const args = ["--delete-event", "--title", a.title as string];
      if (a.calendar) args.push("--calendar", a.calendar as string);
      return runCalBin(...args);
    },
  },
];

export default tools;
