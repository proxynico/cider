import { z } from "zod";

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

const ISO_DATE_RE =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})(?:T(?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2})(?<fraction>\.\d{1,3})?)?(?<zone>Z|[+-]\d{2}:\d{2})?)?$/;

export function isIsoDateString(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match?.groups) return false;

  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);

  if (!match.groups.hour) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  const hour = Number(match.groups.hour);
  const minute = Number(match.groups.minute);
  const second = Number(match.groups.second ?? "0");
  const ms = Number((match.groups.fraction ?? "").slice(1).padEnd(3, "0") || "0");
  const zone = match.groups.zone;

  if (!zone) {
    const date = new Date(year, month - 1, day, hour, minute, second, ms);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second &&
      date.getMilliseconds() === ms
    );
  }

  const sign = zone[0] === "-" ? -1 : 1;
  let offsetHour = 0;
  let offsetMinute = 0;
  if (zone !== "Z") {
    const parts = zone.slice(1).split(":");
    offsetHour = Number(parts[0] ?? 0);
    offsetMinute = Number(parts[1] ?? 0);
  }
  const offsetMs = sign * ((offsetHour * 60) + offsetMinute) * 60_000;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMs;
  const zoned = new Date(utcMs + offsetMs);

  return (
    zoned.getUTCFullYear() === year &&
    zoned.getUTCMonth() === month - 1 &&
    zoned.getUTCDate() === day &&
    zoned.getUTCHours() === hour &&
    zoned.getUTCMinutes() === minute &&
    zoned.getUTCSeconds() === second &&
    zoned.getUTCMilliseconds() === ms
  );
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
    if (p.date && !isIsoDateString(v as string))
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
