import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface Param {
  type: "string" | "boolean" | "number";
  desc: string;
  req?: boolean;
  date?: boolean;
  int?: boolean;
  min?: number;
  max?: number;
}

export interface ToolDef {
  name: string;
  desc: string;
  params?: Record<string, Param>;
  handle(args: Record<string, unknown>): Promise<string>;
}

export function toMcpTool(def: ToolDef): Tool {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [k, p] of Object.entries(def.params ?? {})) {
    properties[k] = { type: p.type, description: p.desc };
    if (p.req) required.push(k);
  }
  return {
    name: def.name,
    description: def.desc,
    inputSchema: { type: "object" as const, properties: properties as Record<string, object>, required },
  };
}

export function validate(def: ToolDef, raw: Record<string, unknown>): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(`${def.name}: expected argument object`);
  const params = def.params ?? {};
  const known = new Set(Object.keys(params));
  const extra = Object.keys(raw).filter(k => !known.has(k));
  if (extra.length) throw new Error(`${def.name}: unknown arg(s): ${extra.join(", ")}`);

  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(params)) {
    const v = raw[k];
    if (v == null) {
      if (p.req) throw new Error(`${def.name}: missing "${k}"`);
      continue;
    }
    if (typeof v !== p.type || (p.type === "number" && !Number.isFinite(v as number)))
      throw new Error(`${def.name}: "${k}" must be ${p.type}`);
    if (p.type === "string" && p.req && (v as string).trim() === "")
      throw new Error(`${def.name}: "${k}" must not be empty`);
    if (p.date && isNaN(new Date(v as string).getTime()))
      throw new Error(`${def.name}: "${k}" must be ISO 8601 date`);
    if (p.int && !Number.isInteger(v))
      throw new Error(`${def.name}: "${k}" must be integer`);
    if (p.min !== undefined && (v as number) < p.min)
      throw new Error(`${def.name}: "${k}" must be >= ${p.min}`);
    if (p.max !== undefined && (v as number) > p.max)
      throw new Error(`${def.name}: "${k}" must be <= ${p.max}`);
    out[k] = v;
  }
  return out;
}
