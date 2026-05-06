import { isoToAppleScriptDateExpr } from "./dates.ts";

const TIMEOUT = 30_000;
const PERM_RE = /errAEEventNotPermitted|-1743|-10004|Not authorized|not allowed assistive/i;
const PERM_HINT = "\n\nPermission denied. Grant access in System Settings > Privacy & Security > Automation.";

/** Escape a string for embedding in AppleScript/JXA double-quoted strings. */
export function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/"/g, '\\"');
}

/** Convert ISO 8601 string to an AppleScript date expression. */
export function asDateExpr(iso: string): string {
  return isoToAppleScriptDateExpr(iso);
}

async function run(flags: string[], script: string, timeout = TIMEOUT): Promise<string> {
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error(`Invalid timeout: ${timeout}`);
  const proc = Bun.spawn([...flags, script], { stdout: "pipe", stderr: "pipe" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const race = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { proc.kill(); reject(new Error(`osascript timed out after ${timeout}ms`)); }, timeout);
  });
  try {
    const [stdout, stderr, code] = await Promise.race([
      Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]),
      race,
    ]);
    if (code !== 0) {
      const msg = stderr.trim() || `osascript exited with code ${code}`;
      throw new Error(PERM_RE.test(msg) ? msg + PERM_HINT : msg);
    }
    return stdout.trim();
  } finally {
    clearTimeout(timer);
    if (proc.exitCode === null) { proc.kill(); await proc.exited.catch(() => {}); }
  }
}

export const runAppleScript = (s: string, t?: number) => run(["osascript", "-e"], s, t);
export const runJXA = (s: string, t?: number) => run(["osascript", "-l", "JavaScript", "-e"], s, t);
