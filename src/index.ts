import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { toZodShape } from "./types.ts";
import calendar from "./tools/calendar.ts";
import notes from "./tools/notes.ts";
import contacts from "./tools/contacts.ts";
import doctor from "./tools/doctor.ts";

const server = new McpServer({ name: "cider", version: "0.1.0" });

for (const def of [...calendar, ...notes, ...contacts, ...doctor]) {
  server.tool(def.name, def.desc, toZodShape(def), async (raw) => {
    try {
      return { content: [{ type: "text" as const, text: await def.handle(raw) }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown error"}` }],
        isError: true,
      };
    }
  });
}

await server.connect(new StdioServerTransport());
