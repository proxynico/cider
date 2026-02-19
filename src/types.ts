import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolModule {
  tools: Tool[];
  handleCall(name: string, args: Record<string, unknown>): Promise<string>;
}
