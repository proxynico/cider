import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolModule } from "../types.ts";
import { runAppleScript, escAS, asDateExpr } from "../applescript.ts";

const tools: Tool[] = [
  {
    name: "calendar_list_calendars",
    description: "List all calendars available in Apple Calendar",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "calendar_list_events",
    description:
      "List events in a date range. Dates in ISO 8601 format (e.g. 2024-03-15T00:00:00)",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date (ISO 8601)" },
        endDate: { type: "string", description: "End date (ISO 8601)" },
        calendarName: {
          type: "string",
          description: "Calendar name (optional, searches all if omitted)",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "calendar_create_event",
    description: "Create a new event in Apple Calendar",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Event title" },
        startDate: { type: "string", description: "Start date (ISO 8601)" },
        endDate: { type: "string", description: "End date (ISO 8601)" },
        calendar: {
          type: "string",
          description: "Calendar name (optional, uses default)",
        },
        location: { type: "string", description: "Event location (optional)" },
        notes: { type: "string", description: "Event notes (optional)" },
      },
      required: ["title", "startDate", "endDate"],
    },
  },
  {
    name: "calendar_update_event",
    description: "Update an existing event by title and calendar",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Current event title to find" },
        calendar: {
          type: "string",
          description: "Calendar name containing the event",
        },
        newTitle: { type: "string", description: "New title (optional)" },
        newStart: {
          type: "string",
          description: "New start date ISO 8601 (optional)",
        },
        newEnd: {
          type: "string",
          description: "New end date ISO 8601 (optional)",
        },
        newLocation: {
          type: "string",
          description: "New location (optional)",
        },
      },
      required: ["title", "calendar"],
    },
  },
  {
    name: "calendar_delete_event",
    description: "Delete an event by title and calendar",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Event title to delete" },
        calendar: {
          type: "string",
          description: "Calendar name containing the event",
        },
      },
      required: ["title", "calendar"],
    },
  },
];

async function handleCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "calendar_list_calendars": {
      return runAppleScript(`
        tell application "Calendar"
          set output to ""
          repeat with c in calendars
            set output to output & name of c & linefeed
          end repeat
          return output
        end tell
      `);
    }

    case "calendar_list_events": {
      const startExpr = asDateExpr(args.startDate as string);
      const endExpr = asDateExpr(args.endDate as string);
      const calName = args.calendarName
        ? escAS(args.calendarName as string)
        : null;

      if (calName) {
        return runAppleScript(`
          tell application "Calendar"
            set output to ""
            set theEvents to (every event of calendar "${calName}" whose start date ≥ ${startExpr} and start date ≤ ${endExpr})
            repeat with e in theEvents
              set output to output & summary of e & " | " & (start date of e as string) & " - " & (end date of e as string) & linefeed
            end repeat
            if output is "" then return "No events found"
            return output
          end tell
        `);
      }

      return runAppleScript(`
        tell application "Calendar"
          set output to ""
          repeat with c in calendars
            set theEvents to (every event of c whose start date ≥ ${startExpr} and start date ≤ ${endExpr})
            repeat with e in theEvents
              set output to output & "[" & name of c & "] " & summary of e & " | " & (start date of e as string) & " - " & (end date of e as string) & linefeed
            end repeat
          end repeat
          if output is "" then return "No events found"
          return output
        end tell
      `);
    }

    case "calendar_create_event": {
      const title = escAS(args.title as string);
      const startExpr = asDateExpr(args.startDate as string);
      const endExpr = asDateExpr(args.endDate as string);
      const cal = args.calendar
        ? `calendar "${escAS(args.calendar as string)}"`
        : "default calendar";

      const props = [
        `summary:"${title}"`,
        `start date:${startExpr}`,
        `end date:${endExpr}`,
      ];
      if (args.location) props.push(`location:"${escAS(args.location as string)}"`);
      if (args.notes) props.push(`description:"${escAS(args.notes as string)}"`);

      return runAppleScript(`
        tell application "Calendar"
          tell ${cal}
            make new event with properties {${props.join(", ")}}
          end tell
          return "Event created: ${title}"
        end tell
      `);
    }

    case "calendar_update_event": {
      const title = escAS(args.title as string);
      const cal = escAS(args.calendar as string);
      const updates: string[] = [];

      if (args.newTitle)
        updates.push(`set summary of e to "${escAS(args.newTitle as string)}"`);
      if (args.newStart)
        updates.push(`set start date of e to ${asDateExpr(args.newStart as string)}`);
      if (args.newEnd)
        updates.push(`set end date of e to ${asDateExpr(args.newEnd as string)}`);
      if (args.newLocation)
        updates.push(`set location of e to "${escAS(args.newLocation as string)}"`);

      if (updates.length === 0) return "No updates specified";

      return runAppleScript(`
        tell application "Calendar"
          set theEvents to (every event of calendar "${cal}" whose summary is "${title}")
          if (count of theEvents) is 0 then return "Event not found: ${title}"
          set e to item 1 of theEvents
          ${updates.join("\n          ")}
          return "Event updated: ${title}"
        end tell
      `);
    }

    case "calendar_delete_event": {
      const title = escAS(args.title as string);
      const cal = escAS(args.calendar as string);

      return runAppleScript(`
        tell application "Calendar"
          set theEvents to (every event of calendar "${cal}" whose summary is "${title}")
          if (count of theEvents) is 0 then return "Event not found: ${title}"
          delete item 1 of theEvents
          return "Event deleted: ${title}"
        end tell
      `);
    }

    default:
      throw new Error(`Unknown calendar tool: ${name}`);
  }
}

export default { tools, handleCall } satisfies ToolModule;
