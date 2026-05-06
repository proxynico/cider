import { z } from "zod";
import { isIsoDateString } from "./dates.ts";

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

function toZodType(p: Param): z.ZodType {
  if (p.type === "string") {
    let schema = z.string().describe(p.desc);
    if (p.req) schema = schema.refine(v => v.trim() !== "", "must not be empty");
    if (p.date) schema = schema.refine(isIsoDateString, "must be ISO 8601 date");
    return p.req ? schema : schema.optional();
  }

  if (p.type === "number") {
    let schema = z.number().finite().describe(p.desc);
    if (p.int) schema = schema.int();
    if (p.min !== undefined) schema = schema.min(p.min);
    if (p.max !== undefined) schema = schema.max(p.max);
    return p.req ? schema : schema.optional();
  }

  const schema = z.boolean().describe(p.desc);
  return p.req ? schema : schema.optional();
}

export function toZodShape(def: ToolDef): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  for (const [k, p] of Object.entries(def.params ?? {})) {
    shape[k] = toZodType(p);
  }
  return shape;
}
