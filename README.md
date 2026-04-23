# cider

Single MCP server that gives Claude Code (or any MCP client) access to macOS Apple apps via AppleScript, JXA, and EventKit.

**20 tools** across 3 apps: Calendar, Notes, and Contacts.

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/cider.git
cd cider
bun install
bun run build:swift    # compile calendar helper (one-time)

# Register one MCP server with Claude Code
claude mcp add --scope user cider -- bun run ~/Developer/cider/src/index.ts
```

Cider is **one MCP server**. Register it once and it exposes all Calendar, Notes, and Contacts tools.

Restart Claude Code. Tools appear automatically. macOS will prompt for Automation permissions on first use of each app.

## Tools

### Calendar (5 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `calendar_list_calendars` | List all calendars | — |
| `calendar_search_events` | Search events in a date range | `startDate`, `endDate` |
| `calendar_create_event` | Create a new event | `title`, `startDate`, `endDate` |
| `calendar_update_event` | Update an existing event | `title`, `calendar` |
| `calendar_delete_event` | Delete an event | `title`, `calendar` |

**Optional params:**
- `calendarName`, `query` (`calendar_search_events`)
- `calendar`, `location`, `notes` (`calendar_create_event`)
- `newTitle`, `newStart`, `newEnd`, `newLocation`, `newNotes` (`calendar_update_event`)

### Notes (9 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `notes_list_folders` | List all folders | — |
| `notes_list` | List notes | — |
| `notes_create` | Create a new note | `title`, `body` |
| `notes_read` | Read note content | `title` |
| `notes_search` | Search notes by title | `query` |
| `notes_append` | Append plain text to a note | `title`, `text` |
| `notes_move` | Move a note to a folder | `title`, `folder` |
| `notes_update` | Update a note's title or body | `title` |
| `notes_delete` | Delete a note by title | `title` |

**Optional params:**
- `folder` (`notes_list`, `notes_create`)
- `newTitle`, `newBody` (`notes_update`)

### Contacts (6 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `contacts_list` | List all contacts (name + org) | — |
| `contacts_search` | Search contacts by name | `query` |
| `contacts_get` | Get full contact details | `name` |
| `contacts_create` | Create a new contact | `firstName`, `lastName` |
| `contacts_update` | Update a contact by exact full name | `name` |
| `contacts_delete` | Delete a contact by exact full name | `name` |

**Optional params:**
- `limit` (`contacts_list`)
- `email`, `phone`, `org`, `title` (`contacts_create`)
- `newFirstName`, `newLastName`, `newEmail`, `newPhone`, `newOrg`, `newTitle` (`contacts_update`)

## Date Format

All date parameters use strict ISO 8601 input.

- Date only: `2024-03-15`
- Local date-time: `2024-03-15T10:30:00`
- UTC / offset date-time: `2024-03-15T10:30:00Z`, `2024-03-15T10:30:00+08:00`

## Architecture

```text
src/
  index.ts          MCP server entry, tool registration
  applescript.ts    Shared runners (AppleScript + JXA) with 30s timeout + permission detection
  types.ts          ToolDef interface, Zod schema generation
  tools/
    calendar.ts     EventKit binary for reads, AppleScript for writes
    notes.ts        AppleScript
    contacts.ts     JXA with batch property access
  helpers/
    cider-cal.swift Compiled EventKit helper for fast calendar queries
```

- **Runtime:** Bun + TypeScript
- **Transport:** stdio (MCP protocol)
- **Execution:** Calendar reads use a compiled Swift binary via EventKit for indexed calendar/event queries. Calendar writes use AppleScript. Contacts use JXA with batch property access. Notes use AppleScript.
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

To add a new tool, add the definition and handler to the appropriate `src/tools/*.ts` module. It's automatically registered from `src/index.ts`.

## License

MIT

## Validation and failures

- Tool inputs are validated by the MCP SDK via Zod schemas.
- Missing/invalid arguments return MCP `isError` responses.
- Missing entities and ambiguous matches inside scripts return explicit errors.
- macOS permission errors (e.g. Automation access denied) are detected and include actionable guidance pointing to System Settings.
- Date parameters require strict ISO 8601 input and are validated before execution.
- Notes `body`/`text` fields are treated as plain text when written.
- `contacts_update` and `contacts_delete` require an exact full-name match.

## Notes about repository guidance

- Source-of-truth local notes are tracked in `.claude/napkin.md`.
