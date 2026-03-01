export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function assertRecord(args: Record<string, unknown> | undefined, tool: string): Record<string, unknown> {
  if (!isRecord(args)) {
    throw new ValidationError(`Tool \"${tool}\": expected argument object.`);
  }
  return args;
}

export function assertNoUnknownFields(args: Record<string, unknown>, allowed: readonly string[], tool: string): void {
  const unknownKeys = Object.keys(args).filter((key) => !allowed.includes(key));
  if (unknownKeys.length > 0) {
    throw new ValidationError(`Tool \"${tool}\": unknown argument(s): ${unknownKeys.join(", ")}`);
  }
}

export function requireString(args: Record<string, unknown>, field: string, tool: string, opts: { allowEmpty?: boolean } = {}): string {
  const value = args[field];
  if (value == null || typeof value !== "string" || (!opts.allowEmpty && value.trim() === "")) {
    throw new ValidationError(`Tool \"${tool}\": expected string \"${field}\".`);
  }
  return value;
}

export function optionalString(args: Record<string, unknown>, field: string, tool: string): string | undefined {
  const value = args[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`Tool \"${tool}\": expected string \"${field}\".`);
  }
  return value;
}

export function requireBoolean(args: Record<string, unknown>, field: string, tool: string): boolean {
  const value = args[field];
  if (typeof value !== "boolean") {
    throw new ValidationError(`Tool \"${tool}\": expected boolean \"${field}\".`);
  }
  return value;
}

export function optionalBoolean(args: Record<string, unknown>, field: string, tool: string): boolean | undefined {
  const value = args[field];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ValidationError(`Tool \"${tool}\": expected boolean \"${field}\".`);
  }
  return value;
}

export function optionalNumber(
  args: Record<string, unknown>,
  field: string,
  tool: string,
  opts: { integer?: boolean; min?: number; max?: number } = {}
): number | undefined {
  const value = args[field];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`Tool \"${tool}\": expected number \"${field}\".`);
  }
  if (opts.integer && !Number.isInteger(value)) {
    throw new ValidationError(`Tool \"${tool}\": expected integer \"${field}\".`);
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new ValidationError(`Tool \"${tool}\": \"${field}\" must be >= ${opts.min}.`);
  }
  if (opts.max !== undefined && value > opts.max) {
    throw new ValidationError(`Tool \"${tool}\": \"${field}\" must be <= ${opts.max}.`);
  }
  return value;
}

export function requireDateString(args: Record<string, unknown>, field: string, tool: string): string {
  const value = requireString(args, field, tool);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`Tool \"${tool}\": \"${field}\" must be ISO 8601 date string.`);
  }
  return value;
}
