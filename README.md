# cider

MCP server that gives Claude Code (or any MCP client) access to macOS Apple apps via AppleScript and JXA.

**21 tools** across 4 apps: Calendar, Reminders, Notes, and Contacts.

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/cider.git
cd cider
bun install

# Register with Claude Code
claude mcp add --scope user cider -- bun run ~/Developer/cider/src/index.ts
```

Restart Claude Code. Tools appear automatically. macOS will prompt for Automation permissions on first use of each app.

## Tools

### Calendar (5 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `calendar_list_calendars` | List all calendars | — |
| `calendar_list_events` | List events in a date range | `startDate`, `endDate` |
| `calendar_create_event` | Create a new event | `title`, `startDate`, `endDate` |
| `calendar_update_event` | Update an existing event | `title`, `calendar` |
| `calendar_delete_event` | Delete an event | `title`, `calendar` |

**Optional params:** `calendarName` (list_events), `calendar`, `location`, `notes` (create), `newTitle`, `newStart`, `newEnd`, `newLocation` (update).

### Reminders (5 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `reminders_list_lists` | List all reminder lists | — |
| `reminders_list` | List reminders in a list | `listName` |
| `reminders_create` | Create a new reminder | `name`, `list` |
| `reminders_complete` | Mark a reminder complete | `name`, `list` |
| `reminders_delete` | Delete a reminder | `name`, `list` |

**Optional params:** `showCompleted` (list), `dueDate`, `notes`, `priority` (create). Priority: 0=none, 1=high, 5=medium, 9=low.

### Notes (6 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `notes_list_folders` | List all folders | — |
| `notes_list` | List notes | — |
| `notes_create` | Create a new note | `title`, `body` |
| `notes_read` | Read note content | `title` |
| `notes_search` | Search notes by title | `query` |
| `notes_delete` | Delete a note by title | `title` |

**Optional params:** `folder` (list, create).

### Contacts (5 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `contacts_list` | List all contacts (name + org) | — |
| `contacts_search` | Search contacts by name | `query` |
| `contacts_get` | Get full contact details | `name` |
| `contacts_create` | Create a new contact | `firstName`, `lastName` |
| `contacts_delete` | Delete a contact by exact name | `name` |

**Optional params:** `email`, `phone`, `org`, `title` (create).

## Date Format

All date parameters use ISO 8601 format: `2024-03-15T10:30:00`

## Architecture

```
src/
  index.ts          MCP server entry, tool registration
  applescript.ts    Shared runners (AppleScript + JXA) with 30s timeout
  types.ts          ToolModule interface
  tools/
    calendar.ts     AppleScript
    reminders.ts    JXA with batch property access
    notes.ts        AppleScript
    contacts.ts     JXA with batch property access
```

- **Runtime:** Bun + TypeScript
- **Transport:** stdio (MCP protocol)
- **Execution:** Calendar and Notes use AppleScript. Reminders and Contacts use JXA with batch property access for performance — fetching all names/dates in a single call instead of per-item, which avoids scripting bridge hangs on large datasets.
- **Timeout:** All osascript calls have a 30-second timeout to prevent indefinite hangs.
- **Auth:** macOS Automation permissions handle access control. No API keys needed.

## Permissions

On first use of each app, macOS will show a dialog:

> "Terminal.app wants to control Calendar.app. Allow?"

Click **OK**. Manage in **System Settings > Privacy & Security > Automation**.

If running from an IDE (VS Code, Cursor), the IDE is the app requesting permission.

## Development

```bash
bun install
bun run src/index.ts
```

To add a new tool, add the definition and handler to the appropriate `src/tools/*.ts` module. It's automatically registered — no changes needed in `index.ts`.

## License

MIT

## Validation and failures

- Tool inputs are validated before AppleScript/JXA execution.
- Missing/invalid arguments return MCP `isError` responses.
- Missing entities and ambiguous matches inside scripts now return explicit errors.
- Date parameters expect ISO 8601 input and are validated before execution.

## Notes about repository guidance

- This repository does not currently include `claude.md`.
- Source-of-truth local notes are tracked in `.claude/napkin.md`.
