import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ToolModule } from "./types.ts";

import calendar from "./tools/calendar.ts";
import reminders from "./tools/reminders.ts";
import notes from "./tools/notes.ts";
import contacts from "./tools/contacts.ts";

const modules: ToolModule[] = [calendar, reminders, notes, contacts];

const server = new McpServer({
  name: "cider",
  version: "0.1.0",
});

// Register all tools from all modules
for (const mod of modules) {
  for (const tool of mod.tools) {
    server.tool(
      tool.name,
      tool.description ?? "",
      tool.inputSchema as Record<string, unknown>,
      async (args: Record<string, unknown>) => {
        try {
          const parsedArgs = mod.parseArgs
            ? mod.parseArgs(tool.name, args)
            : args;
          const result = await mod.handleCall(tool.name, parsedArgs);
          return { content: [{ type: "text" as const, text: result }] };
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown error";
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      }
    );
  }
}

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
