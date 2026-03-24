# cider

MCP server that gives Claude Code (or any MCP client) access to macOS Apple apps via AppleScript and JXA.

**22 tools** across 4 apps: Calendar, Reminders, Notes, and Contacts.

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/cider.git
cd cider
bun install
bun run build:swift    # compile calendar helper (one-time)

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

### Notes (7 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `notes_list_folders` | List all folders | — |
| `notes_list` | List notes | — |
| `notes_create` | Create a new note | `title`, `body` |
| `notes_read` | Read note content | `title` |
| `notes_search` | Search notes by title | `query` |
| `notes_update` | Update a note's title or body | `title` |
| `notes_delete` | Delete a note by title | `title` |

**Optional params:** `folder` (list, create), `newTitle`, `newBody` (update).

### Contacts (5 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `contacts_list` | List all contacts (name + org) | — |
| `contacts_search` | Search contacts by name | `query` |
| `contacts_get` | Get full contact details | `name` |
| `contacts_create` | Create a new contact | `firstName`, `lastName` |
| `contacts_delete` | Delete a contact by exact full name | `name` |

**Optional params:** `email`, `phone`, `org`, `title` (create).

## Date Format

All date parameters use strict ISO 8601 input.

- Date only: `2024-03-15`
- Local date-time: `2024-03-15T10:30:00`
- UTC / offset date-time: `2024-03-15T10:30:00Z`, `2024-03-15T10:30:00+08:00`

## Architecture

```
src/
  index.ts          MCP server entry, tool registration
  applescript.ts    Shared runners (AppleScript + JXA) with 30s timeout
  types.ts          ToolDef interface, schema conversion, input validation
  tools/
    calendar.ts     EventKit binary for reads, AppleScript for writes
    reminders.ts    JXA with batch property access
    notes.ts        AppleScript
    contacts.ts     JXA with batch property access
  helpers/
    cider-cal.swift Compiled EventKit helper for fast calendar queries
```

- **Runtime:** Bun + TypeScript
- **Transport:** stdio (MCP protocol)
- **Execution:** Calendar reads (list calendars, list events) use a compiled Swift binary via EventKit for indexed queries — instant even on large synced calendars. Calendar writes use AppleScript. Reminders and Contacts use JXA with batch property access. Notes use AppleScript.
- **Timeout:** AppleScript/JXA calls and the calendar helper use a 30-second timeout to prevent indefinite hangs.
- **Auth:** macOS Automation permissions handle access control. No API keys needed.

## Permissions

On first use of each app, macOS will show a dialog:

> "Terminal.app wants to control Calendar.app. Allow?"

Click **OK**. Manage in **System Settings > Privacy & Security > Automation**.

If running from an IDE (VS Code, Cursor), the IDE is the app requesting permission.

## Development

```bash
bun install
bun run build:swift    # compile calendar helper
bun run src/index.ts
```

To add a new tool, add the definition and handler to the appropriate `src/tools/*.ts` module. It's automatically registered — no changes needed in `index.ts`.

## License

MIT

## Validation and failures

- Tool inputs are validated before AppleScript/JXA execution.
- MCP-exposed schemas now include required-string, integer, range, and ISO-date constraints.
- Missing/invalid arguments return MCP `isError` responses.
- Missing entities and ambiguous matches inside scripts now return explicit errors.
- Date parameters require strict ISO 8601 input and are validated before execution.
- Notes `body` fields are treated as plain text when written.
- `contacts_delete` requires an exact full-name match.

## Notes about repository guidance

- This repository does not currently include `claude.md`.
- Source-of-truth local notes are tracked in `.claude/napkin.md`.
