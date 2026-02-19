import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolModule } from "../types.ts";
import { runJXA, escJS } from "../applescript.ts";

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

      return runJXA(`
        const app = Application("Reminders");
        const list = app.lists.byName("${listName}");
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

      const propParts = [`name: "${rName}"`];
      if (args.dueDate)
        propParts.push(`dueDate: new Date("${escJS(args.dueDate as string)}")`);
      if (args.notes)
        propParts.push(`body: "${escJS(args.notes as string)}"`);
      if (args.priority !== undefined)
        propParts.push(`priority: ${args.priority as number}`);

      return runJXA(`
        const app = Application("Reminders");
        const list = app.lists.byName("${listName}");
        list.reminders.push(app.Reminder({${propParts.join(", ")}}));
        "Reminder created: ${rName}";
      `);
    }

    case "reminders_complete": {
      const rName = escJS(args.name as string);
      const listName = escJS(args.list as string);

      return runJXA(`
        const app = Application("Reminders");
        const list = app.lists.byName("${listName}");
        const names = list.reminders.name();
        const completed = list.reminders.completed();
        const idx = names.findIndex((n, i) => n === "${rName}" && !completed[i]);
        if (idx === -1) { "Reminder not found: ${rName}"; }
        else { list.reminders[idx].completed = true; "Reminder completed: ${rName}"; }
      `);
    }

    case "reminders_delete": {
      const rName = escJS(args.name as string);
      const listName = escJS(args.list as string);

      return runJXA(`
        const app = Application("Reminders");
        const list = app.lists.byName("${listName}");
        const names = list.reminders.name();
        const idx = names.indexOf("${rName}");
        if (idx === -1) { "Reminder not found: ${rName}"; }
        else { app.delete(list.reminders[idx]); "Reminder deleted: ${rName}"; }
      `);
    }

    default:
      throw new Error(`Unknown reminders tool: ${name}`);
  }
}

export default { tools, handleCall } satisfies ToolModule;
