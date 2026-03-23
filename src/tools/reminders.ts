import type { ToolDef } from "../types.ts";
import { runJXA, esc } from "../applescript.ts";

const findList = (name: string) => `
  const lists = app.lists.whose({ name: "${name}" });
  if (lists.length === 0) throw new Error("Reminder list not found: ${name}");
  if (lists.length > 1) throw new Error("Multiple lists match: ${name}");
  const list = lists[0];`;

const tools: ToolDef[] = [
  {
    name: "reminders_list_lists",
    desc: "List all reminder lists in Apple Reminders",
    handle: () => runJXA(`
      const app = Application("Reminders");
      const names = app.lists.name();
      const lines = names.map((n, i) => {
        const pending = app.lists[i].reminders.completed().filter(c => !c).length;
        return n + " (" + pending + " pending)";
      });
      lines.join("\\n");
    `),
  },
  {
    name: "reminders_list",
    desc: "List reminders in a specific list",
    params: {
      listName: { type: "string", desc: "Reminder list name", req: true },
      showCompleted: { type: "boolean", desc: "Include completed reminders (default: false)" },
    },
    handle: async (a) => {
      const ln = esc(a.listName as string);
      const show = a.showCompleted === true;
      return runJXA(`
        const app = Application("Reminders");
        ${findList(ln)}
        const names = list.reminders.name();
        const dues = list.reminders.dueDate();
        const done = list.reminders.completed();
        const lines = [];
        for (let i = 0; i < names.length; i++) {
          ${show ? "" : "if (done[i]) continue;"}
          const prefix = done[i] ? "[done] " : "[ ] ";
          const due = dues[i] ? " | Due: " + dues[i].toLocaleString() : "";
          lines.push(prefix + names[i] + due);
        }
        lines.length === 0 ? "No reminders found in ${ln}" : lines.join("\\n");
      `);
    },
  },
  {
    name: "reminders_create",
    desc: "Create a new reminder",
    params: {
      name: { type: "string", desc: "Reminder name", req: true },
      list: { type: "string", desc: "Reminder list name", req: true },
      dueDate: { type: "string", desc: "Due date (ISO 8601)", date: true },
      notes: { type: "string", desc: "Notes" },
      priority: { type: "number", desc: "Priority 0-9 (0=none, 1=high, 5=medium, 9=low)", int: true, min: 0, max: 9 },
    },
    handle: async (a) => {
      const rName = esc(a.name as string);
      const ln = esc(a.list as string);
      const props = [`name: "${rName}"`];
      if (a.dueDate) props.push(`dueDate: new Date("${esc(a.dueDate as string)}")`);
      if (a.notes) props.push(`body: "${esc(a.notes as string)}"`);
      if (a.priority !== undefined) props.push(`priority: ${a.priority}`);
      return runJXA(`
        const app = Application("Reminders");
        ${findList(ln)}
        list.reminders.push(app.Reminder({${props.join(", ")}}));
        "Reminder created: ${rName}";
      `);
    },
  },
  {
    name: "reminders_complete",
    desc: "Mark a reminder as complete",
    params: {
      name: { type: "string", desc: "Reminder name", req: true },
      list: { type: "string", desc: "Reminder list name", req: true },
    },
    handle: async (a) => {
      const rName = esc(a.name as string);
      const ln = esc(a.list as string);
      return runJXA(`
        const app = Application("Reminders");
        ${findList(ln)}
        const names = list.reminders.name();
        const done = list.reminders.completed();
        const idxs = [];
        for (let i = 0; i < names.length; i++) {
          if (names[i] === "${rName}" && !done[i]) idxs.push(i);
        }
        if (idxs.length === 0) throw new Error("Reminder not found: ${rName}");
        if (idxs.length > 1) throw new Error("Multiple pending reminders match: ${rName}");
        list.reminders[idxs[0]].completed = true;
        "Reminder completed: ${rName}";
      `);
    },
  },
  {
    name: "reminders_delete",
    desc: "Delete a reminder",
    params: {
      name: { type: "string", desc: "Reminder name", req: true },
      list: { type: "string", desc: "Reminder list name", req: true },
    },
    handle: async (a) => {
      const rName = esc(a.name as string);
      const ln = esc(a.list as string);
      return runJXA(`
        const app = Application("Reminders");
        ${findList(ln)}
        const names = list.reminders.name();
        const idxs = [];
        for (let i = 0; i < names.length; i++) {
          if (names[i] === "${rName}") idxs.push(i);
        }
        if (idxs.length === 0) throw new Error("Reminder not found: ${rName}");
        if (idxs.length > 1) throw new Error("Multiple reminders match: ${rName}");
        app.delete(list.reminders[idxs[0]]);
        "Reminder deleted: ${rName}";
      `);
    },
  },
];

export default tools;
