# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|
| 2026-02-21 | Plan audit | Documentation mismatch | Keep `claude.md` absent and source-of-truth in `.claude/napkin.md` only. |

## User Preferences
- Bun always, never npm/yarn

## Patterns That Work
- Project type-checks clean with `bunx tsc --noEmit`

## Patterns That Don't Work

## Domain Notes
- Cider = MCP server giving Claude Code access to macOS Apple apps via AppleScript
- 4 modules: Calendar, Reminders, Notes, and Contacts (22 tools total)
- Transport: stdio, runs as child process of Claude Code
- No API keys — relies on macOS Automation permissions
- Source-of-truth local guidance file: `.claude/napkin.md` (no `claude.md` in repo root)
- Shared runner/escaping logic lives in `src/applescript.ts`
