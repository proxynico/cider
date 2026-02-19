import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolModule } from "../types.ts";
import { runAppleScript, escAS } from "../applescript.ts";

const tools: Tool[] = [
  {
    name: "notes_list_folders",
    description: "List all folders in Apple Notes",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "notes_list",
    description: "List notes, optionally filtered by folder",
    inputSchema: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description: "Folder name (optional, lists all if omitted)",
        },
      },
      required: [],
    },
  },
  {
    name: "notes_create",
    description: "Create a new note in Apple Notes",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Note title" },
        body: { type: "string", description: "Note body (plain text)" },
        folder: {
          type: "string",
          description: "Folder name (optional, uses default)",
        },
      },
      required: ["title", "body"],
    },
  },
  {
    name: "notes_read",
    description: "Read the content of a note by title",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Note title" },
      },
      required: ["title"],
    },
  },
  {
    name: "notes_search",
    description: "Search notes by title",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "notes_delete",
    description: "Delete a note by title",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Note title to delete" },
      },
      required: ["title"],
    },
  },
];

async function handleCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "notes_list_folders": {
      return runAppleScript(`
        tell application "Notes"
          set output to ""
          repeat with f in folders
            set nCount to count of notes of f
            set output to output & name of f & " (" & nCount & " notes)" & linefeed
          end repeat
          return output
        end tell
      `);
    }

    case "notes_list": {
      const folder = args.folder as string | undefined;
      const scope = folder
        ? `notes of folder "${escAS(folder)}"`
        : "notes";
      const emptyMsg = folder
        ? `No notes in folder ${escAS(folder)}`
        : "No notes found";

      return runAppleScript(`
        tell application "Notes"
          set output to ""
          repeat with n in ${scope}
            set output to output & name of n & " | " & (modification date of n as string) & linefeed
          end repeat
          if output is "" then return "${emptyMsg}"
          return output
        end tell
      `);
    }

    case "notes_create": {
      const title = escAS(args.title as string);
      const body = escAS(args.body as string).replace(/\n/g, "<br>");
      const target = args.folder
        ? `folder "${escAS(args.folder as string)}"`
        : "default account";

      return runAppleScript(`
        tell application "Notes"
          tell ${target}
            make new note with properties {name:"${title}", body:"<h1>${title}</h1><br>${body}"}
          end tell
          return "Note created: ${title}"
        end tell
      `);
    }

    case "notes_read": {
      const title = escAS(args.title as string);

      return runAppleScript(`
        tell application "Notes"
          set theNotes to (every note whose name is "${title}")
          if (count of theNotes) is 0 then return "Note not found: ${title}"
          repeat with n in theNotes
            return "Title: " & name of n & linefeed & "Modified: " & (modification date of n as string) & linefeed & linefeed & plaintext of n
          end repeat
        end tell
      `);
    }

    case "notes_search": {
      const query = escAS(args.query as string);

      return runAppleScript(`
        tell application "Notes"
          set output to ""
          set theNotes to (every note whose name contains "${query}")
          repeat with n in theNotes
            set output to output & name of n & " | " & (modification date of n as string) & linefeed
          end repeat
          if output is "" then return "No notes matching: ${query}"
          return output
        end tell
      `);
    }

    case "notes_delete": {
      const title = escAS(args.title as string);

      return runAppleScript(`
        tell application "Notes"
          set theNotes to (every note whose name is "${title}")
          if (count of theNotes) is 0 then return "Note not found: ${title}"
          repeat with n in theNotes
            delete n
          end repeat
          return "Note deleted: ${title}"
        end tell
      `);
    }

    default:
      throw new Error(`Unknown notes tool: ${name}`);
  }
}

export default { tools, handleCall } satisfies ToolModule;
