import type { ToolDef } from "../types.ts";
import { runAppleScript, esc } from "../applescript.ts";

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const renderBodyFragment = (body: string): string =>
  escapeHtml(body).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");

const renderNoteBody = (title: string, body: string): string => {
  const safeTitle = escapeHtml(title);
  const safeBody = renderBodyFragment(body);
  return `<h1>${safeTitle}</h1><br>${safeBody}`;
};

const findNote = (title: string) => `
  set theNotes to (every note whose name is "${title}")
  if (count of theNotes) is 0 then error "Note not found: ${title}"
  if (count of theNotes) > 1 then error "Multiple notes match: ${title}"
  set n to item 1 of theNotes`;

const findFolder = (name: string) => `
  set theFolders to (every folder whose name is "${name}")
  if (count of theFolders) is 0 then error "Folder not found: ${name}"
  if (count of theFolders) > 1 then error "Multiple folders match: ${name}"
  set f to item 1 of theFolders`;

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
          ${findFolder(folder)}
          set output to ""
          repeat with n in notes of f
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
      const rawTitle = a.title as string;
      const title = esc(rawTitle);
      const body = esc(renderNoteBody(rawTitle, a.body as string));
      const target = a.folder ? `folder "${esc(a.folder as string)}"` : "default account";
      return runAppleScript(`
        tell application "Notes"
          tell ${target}
            make new note with properties {name:"${title}", body:"${body}"}
          end tell
          return "Note created: ${rawTitle}"
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
          ${findNote(title)}
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
    name: "notes_append",
    desc: "Append plain text to an existing note by exact title",
    params: {
      title: { type: "string", desc: "Note title", req: true },
      text: { type: "string", desc: "Text to append", req: true },
    },
    handle: async (a) => {
      const rawTitle = a.title as string;
      const title = esc(rawTitle);
      const fragment = esc(renderBodyFragment(a.text as string));
      return runAppleScript(`
        tell application "Notes"
          ${findNote(title)}
          set body of n to (body of n) & "<br>${fragment}"
          return "Note appended: ${rawTitle}"
        end tell
      `);
    },
  },
  {
    name: "notes_move",
    desc: "Move a note to a different folder by exact title",
    params: {
      title: { type: "string", desc: "Note title", req: true },
      folder: { type: "string", desc: "Destination folder", req: true },
    },
    handle: async (a) => {
      const rawTitle = a.title as string;
      const title = esc(rawTitle);
      const folder = esc(a.folder as string);
      return runAppleScript(`
        tell application "Notes"
          ${findNote(title)}
          ${findFolder(folder)}
          move n to f
          return "Note moved: ${rawTitle} -> ${folder}"
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
      const rawTitle = a.title as string;
      const title = esc(rawTitle);
      const updates: string[] = [];
      if (a.newTitle) updates.push(`set name of n to "${esc(a.newTitle as string)}"`);
      if (a.newBody) {
        const heading = (a.newTitle as string | undefined) ?? rawTitle;
        const html = esc(renderNoteBody(heading, a.newBody as string));
        updates.push(`set body of n to "${html}"`);
      }
      if (!updates.length) throw new Error("No updates specified");
      return runAppleScript(`
        tell application "Notes"
          ${findNote(title)}
          ${updates.join("\n          ")}
          return "Note updated: ${rawTitle}"
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
      const rawTitle = a.title as string;
      const title = esc(rawTitle);
      return runAppleScript(`
        tell application "Notes"
          ${findNote(title)}
          delete n
          return "Note deleted: ${rawTitle}"
        end tell
      `);
    },
  },
];

export default tools;
