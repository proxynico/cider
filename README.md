# cider

Single MCP server that gives Claude Code (or any MCP client) access to macOS Apple apps via AppleScript, JXA, and EventKit.

**21 tools** across Calendar, Notes, Contacts, and local diagnostics.

## Quick Start

```bash
# Clone and install
git clone https://github.com/proxynico/cider.git
cd cider
bun install
bun run build:swift    # compile calendar helper (one-time)

# Register one MCP server with Claude Code
claude mcp add --scope user cider -- bun run ~/developer/cider/src/index.ts
```

Cider is **one MCP server**. Register it once and it exposes all Calendar, Notes, Contacts, and diagnostic tools.

Restart Claude Code. Tools appear automatically. macOS will prompt for app permissions on first use.

## Tools

### Calendar (5 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `calendar_list_calendars` | List all calendars | — |
| `calendar_search_events` | Search events in a date range | `startDate`, `endDate` |
| `calendar_create_event` | Create a new event | `title`, `startDate`, `endDate` |
| `calendar_update_event` | Update an existing event | `title` |
| `calendar_delete_event` | Delete an event | `title` |

**Optional params:**
- `calendarName`, `query` (`calendar_search_events`)
- `calendar`, `location`, `notes`, `dryRun` (`calendar_create_event`)
- `calendar`, `newTitle`, `newStart`, `newEnd`, `newLocation`, `newNotes`, `dryRun` (`calendar_update_event`)
- `calendar`, `dryRun` (`calendar_delete_event`)

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
- `folder`, `limit` (`notes_list`)
- `folder`, `dryRun` (`notes_create`)
- `limit` (`notes_search`)
- `dryRun` (`notes_append`, `notes_move`, `notes_update`, `notes_delete`)
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
- `email`, `phone`, `org`, `title`, `dryRun` (`contacts_create`)
- `newFirstName`, `newLastName`, `newEmail`, `newPhone`, `newOrg`, `newTitle`, `dryRun` (`contacts_update`)
- `dryRun` (`contacts_delete`)

### Diagnostics (1 tool)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `doctor` | Check Bun, osascript, and compiled calendar helper readiness | - |

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
    calendar.ts     EventKit binary for reads and writes
    notes.ts        AppleScript
    contacts.ts     JXA with batch property access
    doctor.ts       Local runtime checks
  helpers/
    cider-cal.swift Compiled EventKit helper for fast calendar operations
```

- **Runtime:** Bun + TypeScript
- **Transport:** stdio (MCP protocol)
- **Execution:** Calendar reads and writes use a compiled Swift binary via EventKit for indexed calendar/event access. Contacts use JXA. Notes use AppleScript.
- **Timeout:** AppleScript/JXA calls and the calendar helper use a 30-second timeout to prevent indefinite hangs.
- **Auth:** macOS Calendars and Automation permissions handle access control. No API keys needed.

## Permissions

On first use, macOS may show permission dialogs:

- Calendar uses EventKit and needs **System Settings > Privacy & Security > Calendars** access.
- Notes and Contacts use AppleScript/JXA and may need **System Settings > Privacy & Security > Automation** access for the terminal, IDE, or MCP client process.

Run `doctor` to check local dependency readiness and Calendar authorization state.

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
- macOS permission errors are detected and include actionable guidance pointing to System Settings.
- Date parameters require strict ISO 8601 input and are validated before execution.
- Date-only inputs are treated as local midnight. UTC/offset date-times are converted to the same instant in local Calendar time before writing.
- Notes `body`/`text` fields are treated as plain text when written.
- `contacts_update` and `contacts_delete` require an exact full-name match.
- Mutating tools accept `dryRun: true` to preview the target action without changing Apple apps.

## Local Checks

```bash
bun run test
bun run build:swift
```

Run the MCP `doctor` tool after registration to confirm Bun, `osascript`, the compiled calendar helper, and Calendar authorization.
