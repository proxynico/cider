import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolModule } from "../types.ts";
import { runJXA, escJS } from "../applescript.ts";
import {
  assertNoUnknownFields,
  assertRecord,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireDateString,
  requireString,
  ValidationError,
} from "./validation.ts";

const tools: Tool[] = [
  {
    name: "reminders_list_lists",
    description: "List all reminder lists in Apple Reminders",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "reminders_list",
    description: "List reminders in a specific list",
    inputSchema: {
      type: "object",
      properties: {
        listName: { type: "string", description: "Reminder list name" },
        showCompleted: {
          type: "boolean",
          description: "Include completed reminders (default: false)",
        },
      },
      required: ["listName"],
    },
  },
  {
    name: "reminders_create",
    description: "Create a new reminder",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Reminder name" },
        list: { type: "string", description: "Reminder list name" },
        dueDate: {
          type: "string",
          description: "Due date ISO 8601 (optional)",
        },
        notes: { type: "string", description: "Notes (optional)" },
        priority: {
          type: "number",
          description: "Priority 0-9, 0=none, 1=high, 5=medium, 9=low (optional)",
        },
      },
      required: ["name", "list"],
    },
  },
  {
    name: "reminders_complete",
    description: "Mark a reminder as complete",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Reminder name" },
        list: { type: "string", description: "Reminder list name" },
      },
      required: ["name", "list"],
    },
  },
  {
    name: "reminders_delete",
    description: "Delete a reminder",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Reminder name" },
        list: { type: "string", description: "Reminder list name" },
      },
      required: ["name", "list"],
    },
  },
];

async function handleCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "reminders_list_lists": {
      return runJXA(`
        const app = Application("Reminders");
        const names = app.lists.name();
        const lines = names.map((n, i) => {
          const completed = app.lists[i].reminders.completed();
          const pending = completed.filter(c => !c).length;
          return n + " (" + pending + " pending)";
        });
        lines.join("\\n");
      `);
    }

    case "reminders_list": {
      const listName = escJS(args.listName as string);
      const showCompleted = args.showCompleted === true;
      const listLookup = `
        const lists = app.lists.whose({ name: "${listName}" });
        if (lists.length === 0) throw new Error("Reminder list not found: ${listName}");
        if (lists.length > 1) throw new Error("Multiple reminder lists match: ${listName}");
        const list = lists[0];
      `;

      return runJXA(`
        const app = Application("Reminders");
        ${listLookup}
        const allNames = list.reminders.name();
        const allDues = list.reminders.dueDate();
        const allDone = list.reminders.completed();
        const lines = [];
        for (let i = 0; i < allNames.length; i++) {
          ${showCompleted ? "" : "if (allDone[i]) continue;"}
          const prefix = allDone[i] ? "[done] " : "[ ] ";
          const due = allDues[i] ? " | Due: " + allDues[i].toLocaleString() : "";
          lines.push(prefix + allNames[i] + due);
        }
        lines.length === 0 ? "No reminders found in ${listName}" : lines.join("\\n");
      `);
    }

    case "reminders_create": {
      const rName = escJS(args.name as string);
      const listName = escJS(args.list as string);
      const priority = args.priority as number | undefined;
      const dueDate = args.dueDate as string | undefined;
      const listLookup = `
        const lists = app.lists.whose({ name: "${listName}" });
        if (lists.length === 0) throw new Error("Reminder list not found: ${listName}");
        if (lists.length > 1) throw new Error("Multiple reminder lists match: ${listName}");
        const list = lists[0];
      `;

      const propParts = [`name: "${rName}"`];
      if (dueDate) propParts.push(`dueDate: new Date("${escJS(dueDate)}")`);
      if (args.notes) propParts.push(`body: "${escJS(args.notes as string)}"`);
      if (priority !== undefined) propParts.push(`priority: ${priority}`);

      return runJXA(`
        const app = Application("Reminders");
        ${listLookup}
        list.reminders.push(app.Reminder({${propParts.join(", ")}}));
        "Reminder created: ${rName}";
      `);
    }

    case "reminders_complete": {
      const rName = escJS(args.name as string);
      const listName = escJS(args.list as string);
      const listLookup = `
        const lists = app.lists.whose({ name: "${listName}" });
        if (lists.length === 0) throw new Error("Reminder list not found: ${listName}");
        if (lists.length > 1) throw new Error("Multiple reminder lists match: ${listName}");
        const list = lists[0];
      `;

      return runJXA(`
        const app = Application("Reminders");
        ${listLookup}
        const names = list.reminders.name();
        const completed = list.reminders.completed();
        const idxs = [];
        for (let i = 0; i < names.length; i++) {
          if (names[i] === "${rName}" && !completed[i]) idxs.push(i);
        }
        if (idxs.length === 0) {
          throw new Error("Reminder not found: ${rName}");
        }
        if (idxs.length > 1) {
          throw new Error("Multiple pending reminders match: ${rName}");
        }
        const idx = idxs[0];
        list.reminders[idx].completed = true;
        return "Reminder completed: ${rName}";
      `);
    }

    case "reminders_delete": {
      const rName = escJS(args.name as string);
      const listName = escJS(args.list as string);
      const listLookup = `
        const lists = app.lists.whose({ name: "${listName}" });
        if (lists.length === 0) throw new Error("Reminder list not found: ${listName}");
        if (lists.length > 1) throw new Error("Multiple reminder lists match: ${listName}");
        const list = lists[0];
      `;

      return runJXA(`
        const app = Application("Reminders");
        ${listLookup}
        const names = list.reminders.name();
        const idxs = [];
        for (let i = 0; i < names.length; i++) {
          if (names[i] === "${rName}") idxs.push(i);
        }
        if (idxs.length === 0) {
          throw new Error("Reminder not found: ${rName}");
        }
        if (idxs.length > 1) {
          throw new Error("Multiple reminders match: ${rName}");
        }
        app.delete(list.reminders[idxs[0]]);
        return "Reminder deleted: ${rName}";
      `);
    }

    default:
      throw new Error(`Unknown reminders tool: ${name}`);
  }
}

function parseArgs(name: string, rawArgs: Record<string, unknown>): Record<string, unknown> {
  const args = assertRecord(rawArgs, `reminders.${name}`);
  switch (name) {
    case "reminders_list_lists":
      assertNoUnknownFields(args, [], "reminders_list_lists");
      return {};

    case "reminders_list": {
      assertNoUnknownFields(args, ["listName", "showCompleted"], "reminders_list");
      return {
        listName: requireString(args, "listName", "reminders_list"),
        showCompleted: optionalBoolean(args, "showCompleted", "reminders_list") ?? false,
      };
    }

    case "reminders_create": {
      assertNoUnknownFields(args, ["name", "list", "dueDate", "notes", "priority"], "reminders_create");
      const priority = optionalNumber(args, "priority", "reminders_create", {
        integer: true,
        min: 0,
        max: 9,
      });
      const dueDate = optionalString(args, "dueDate", "reminders_create");
      if (dueDate) requireDateString({ dueDate }, "dueDate", "reminders_create");
      if (priority !== undefined && ![0, 1, 5, 9].includes(priority)) {
        throw new ValidationError("Tool \\\"reminders_create\\\": priority must be 0, 1, 5, or 9.");
      }
      return {
        name: requireString(args, "name", "reminders_create"),
        list: requireString(args, "list", "reminders_create"),
        dueDate,
        notes: optionalString(args, "notes", "reminders_create"),
        priority,
      };
    }

    case "reminders_complete": {
      assertNoUnknownFields(args, ["name", "list"], "reminders_complete");
      return {
        name: requireString(args, "name", "reminders_complete"),
        list: requireString(args, "list", "reminders_complete"),
      };
    }

    case "reminders_delete":
      assertNoUnknownFields(args, ["name", "list"], "reminders_delete");
      return {
        name: requireString(args, "name", "reminders_delete"),
        list: requireString(args, "list", "reminders_delete"),
      };

    default:
      throw new Error(`Unknown reminders tool: ${name}`);
  }
}

export default { tools, parseArgs, handleCall } satisfies ToolModule;
