import type { ToolDef } from "../types.ts";
import { runAppleScript, esc } from "../applescript.ts";

const tools: ToolDef[] = [
  {
    name: "notes_list_folders",
    desc: "List all folders in Apple Notes",
    handle: () => runAppleScript(`
      tell application "Notes"
        set output to ""
        repeat with f in folders
          set output to output & name of f & " (" & (count of notes of f) & " notes)" & linefeed
        end repeat
        return output
      end tell
    `),
  },
  {
    name: "notes_list",
    desc: "List notes, optionally filtered by folder",
    params: {
      folder: { type: "string", desc: "Folder name (lists all if omitted)" },
    },
    handle: async (a) => {
      const folder = a.folder ? esc(a.folder as string) : null;
      if (folder) return runAppleScript(`
        tell application "Notes"
          set flds to (every folder whose name is "${folder}")
          if (count of flds) is 0 then error "Folder not found: ${folder}"
          if (count of flds) > 1 then error "Multiple folders match: ${folder}"
          set output to ""
          repeat with n in notes of item 1 of flds
            set output to output & name of n & " | " & (modification date of n as string) & linefeed
          end repeat
          if output is "" then return "No notes in folder ${folder}"
          return output
        end tell
      `);
      return runAppleScript(`
        tell application "Notes"
          set output to ""
          repeat with n in notes
            set output to output & name of n & " | " & (modification date of n as string) & linefeed
          end repeat
          if output is "" then return "No notes found"
          return output
        end tell
      `);
    },
  },
  {
    name: "notes_create",
    desc: "Create a new note in Apple Notes",
    params: {
      title: { type: "string", desc: "Note title", req: true },
      body: { type: "string", desc: "Note body (plain text)", req: true },
      folder: { type: "string", desc: "Folder name (uses default if omitted)" },
    },
    handle: async (a) => {
      const title = esc(a.title as string);
      const body = esc(a.body as string).replace(/\\n/g, "<br>");
      const target = a.folder ? `folder "${esc(a.folder as string)}"` : "default account";
      return runAppleScript(`
        tell application "Notes"
          tell ${target}
            make new note with properties {name:"${title}", body:"<h1>${title}</h1><br>${body}"}
          end tell
          return "Note created: ${title}"
        end tell
      `);
    },
  },
  {
    name: "notes_read",
    desc: "Read the content of a note by title",
    params: {
      title: { type: "string", desc: "Note title", req: true },
    },
    handle: async (a) => {
      const title = esc(a.title as string);
      return runAppleScript(`
        tell application "Notes"
          set theNotes to (every note whose name is "${title}")
          if (count of theNotes) is 0 then error "Note not found: ${title}"
          if (count of theNotes) > 1 then error "Multiple notes match: ${title}"
          set n to item 1 of theNotes
          return "Title: " & name of n & linefeed & "Modified: " & (modification date of n as string) & linefeed & linefeed & plaintext of n
        end tell
      `);
    },
  },
  {
    name: "notes_search",
    desc: "Search notes by title",
    params: {
      query: { type: "string", desc: "Search query", req: true },
    },
    handle: async (a) => {
      const query = esc(a.query as string);
      return runAppleScript(`
        tell application "Notes"
          set output to ""
          repeat with n in (every note whose name contains "${query}")
            set output to output & name of n & " | " & (modification date of n as string) & linefeed
          end repeat
          if output is "" then return "No notes matching: ${query}"
          return output
        end tell
      `);
    },
  },
  {
    name: "notes_update",
    desc: "Update an existing note's title or body",
    params: {
      title: { type: "string", desc: "Current note title to find", req: true },
      newTitle: { type: "string", desc: "New title" },
      newBody: { type: "string", desc: "New body text (plain text)" },
    },
    handle: async (a) => {
      const title = esc(a.title as string);
      const updates: string[] = [];
      if (a.newTitle) updates.push(`set name of n to "${esc(a.newTitle as string)}"`);
      if (a.newBody) {
        const html = esc(a.newBody as string).replace(/\\n/g, "<br>");
        const heading = a.newTitle ? esc(a.newTitle as string) : title;
        updates.push(`set body of n to "<h1>${heading}</h1><br>${html}"`);
      }
      if (!updates.length) throw new Error("No updates specified");
      return runAppleScript(`
        tell application "Notes"
          set theNotes to (every note whose name is "${title}")
          if (count of theNotes) is 0 then error "Note not found: ${title}"
          if (count of theNotes) > 1 then error "Multiple notes match: ${title}"
          set n to item 1 of theNotes
          ${updates.join("\n          ")}
          return "Note updated: ${title}"
        end tell
      `);
    },
  },
  {
    name: "notes_delete",
    desc: "Delete a note by title",
    params: {
      title: { type: "string", desc: "Note title to delete", req: true },
    },
    handle: async (a) => {
      const title = esc(a.title as string);
      return runAppleScript(`
        tell application "Notes"
          set theNotes to (every note whose name is "${title}")
          if (count of theNotes) is 0 then error "Note not found: ${title}"
          if (count of theNotes) > 1 then error "Multiple notes match: ${title}"
          delete item 1 of theNotes
          return "Note deleted: ${title}"
        end tell
      `);
    },
  },
];

export default tools;
