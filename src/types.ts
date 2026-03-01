import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolModule {
  tools: Tool[];
  parseArgs?(name: string, args: Record<string, unknown>): Record<string, unknown>;
  handleCall(name: string, args: Record<string, unknown>): Promise<string>;
}
