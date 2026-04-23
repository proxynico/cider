import { resolve, dirname } from "path";
import type { ToolDef } from "../types.ts";
import { asDateExpr, esc, runAppleScript } from "../applescript.ts";

const CAL_BIN = resolve(dirname(import.meta.path), "../helpers/cider-cal");
const CAL_TIMEOUT = 30_000;

function toEpochMsArg(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) throw new Error(`Invalid date: ${iso}`);
  return String(date.getTime());
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

const findCal = (name: string) => `
  set cals to (every calendar whose name is "${name}")
  if (count of cals) is 0 then error "Calendar not found: ${name}"
  if (count of cals) > 1 then error "Multiple calendars match: ${name}"`;

const findEvent = (title: string) => `
  set evs to (every event of item 1 of cals whose summary is "${title}")
  if (count of evs) is 0 then error "Event not found: ${title}"
  if (count of evs) > 1 then error "Multiple events match: ${title}"`;

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
    },
    handle: async (a) => {
      const title = esc(a.title as string);
      const cal = a.calendar ? `calendar "${esc(a.calendar as string)}"` : "default calendar";
      const props = [
        `summary:"${title}"`,
        `start date:${asDateExpr(a.startDate as string)}`,
        `end date:${asDateExpr(a.endDate as string)}`,
      ];
      if (a.location) props.push(`location:"${esc(a.location as string)}"`);
      if (a.notes) props.push(`description:"${esc(a.notes as string)}"`);
      return runAppleScript(`
        tell application "Calendar"
          tell ${cal}
            make new event with properties {${props.join(", ")}}
          end tell
          return "Event created: ${title}"
        end tell
      `);
    },
  },
  {
    name: "calendar_update_event",
    desc: "Update an existing event by exact title and calendar",
    params: {
      title: { type: "string", desc: "Current event title to find", req: true },
      calendar: { type: "string", desc: "Calendar containing the event", req: true },
      newTitle: { type: "string", desc: "New title" },
      newStart: { type: "string", desc: "New start date (ISO 8601)", date: true },
      newEnd: { type: "string", desc: "New end date (ISO 8601)", date: true },
      newLocation: { type: "string", desc: "New location" },
      newNotes: { type: "string", desc: "New notes" },
    },
    handle: async (a) => {
      const title = esc(a.title as string);
      const cal = esc(a.calendar as string);
      const updates: string[] = [];
      if (a.newTitle) updates.push(`set summary of ev to "${esc(a.newTitle as string)}"`);
      if (a.newStart) updates.push(`set start date of ev to ${asDateExpr(a.newStart as string)}`);
      if (a.newEnd) updates.push(`set end date of ev to ${asDateExpr(a.newEnd as string)}`);
      if (a.newLocation) updates.push(`set location of ev to "${esc(a.newLocation as string)}"`);
      if (a.newNotes) updates.push(`set description of ev to "${esc(a.newNotes as string)}"`);
      if (!updates.length) throw new Error("No updates specified");
      return runAppleScript(`
        tell application "Calendar"
          ${findCal(cal)}
          ${findEvent(title)}
          set ev to item 1 of evs
          ${updates.join("\n          ")}
          return "Event updated: ${title}"
        end tell
      `);
    },
  },
  {
    name: "calendar_delete_event",
    desc: "Delete an event by title and calendar",
    params: {
      title: { type: "string", desc: "Event title to delete", req: true },
      calendar: { type: "string", desc: "Calendar containing the event", req: true },
    },
    handle: async (a) => {
      const title = esc(a.title as string);
      const cal = esc(a.calendar as string);
      return runAppleScript(`
        tell application "Calendar"
          ${findCal(cal)}
          ${findEvent(title)}
          delete item 1 of evs
          return "Event deleted: ${title}"
        end tell
      `);
    },
  },
];

export default tools;
