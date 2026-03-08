const DEFAULT_TIMEOUT_MS = 30_000;

/** Escape a string for embedding in AppleScript double-quoted strings. */
export function escapeForAppleScriptLiteral(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/"/g, '\\"');
}

/** Escape a string for embedding in JXA double-quoted strings. */
export function escapeForJXALiteral(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/"/g, '\\"');
}

/** Backward-compatible helpers kept for existing imports. */
export const escAS = escapeForAppleScriptLiteral;
export const escJS = escapeForJXALiteral;

export function validateTimeoutMs(timeoutMs = DEFAULT_TIMEOUT_MS): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid timeout: ${timeoutMs}`);
  }
  return timeoutMs;
}

/** Convert ISO 8601 string to an AppleScript date expression. */
export function asDateExpr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);

  // Use seconds-from-epoch math to avoid locale-dependent date literal parsing.
  const unixSeconds = Math.floor(d.getTime() / 1000);
  return `((date "1/1/1970 00:00:00") + ${unixSeconds})`;
}

export function buildDateRangePredicate(
  startExpr: string,
  endExpr: string,
  inclusive = true
): string {
  return inclusive
    ? `start date is greater than or equal to ${startExpr} and start date is less than or equal to ${endExpr}`
    : `start date is greater than ${startExpr} and start date is less than ${endExpr}`;
}

function readProcessPipe(
  pipe: ReturnType<typeof Bun.spawn>["stdout"] | ReturnType<typeof Bun.spawn>["stderr"]
): Promise<string> {
  return pipe instanceof ReadableStream ? new Response(pipe).text() : Promise.resolve("");
}

async function runOsascript(
  args: string[],
  script: string,
  timeoutMs: number
): Promise<string> {
  const validatedTimeoutMs = validateTimeoutMs(timeoutMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([...args, script], {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to run osascript: ${message}`);
  }

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`osascript timed out after ${validatedTimeoutMs}ms`));
    }, validatedTimeoutMs);
  });

  try {
    const [stdout, stderr, exitCode] = await Promise.race([
      Promise.all([
        readProcessPipe(proc.stdout),
        readProcessPipe(proc.stderr),
        proc.exited,
      ]),
      timeout,
    ]);

    if (exitCode !== 0) {
      throw new Error(stderr.trim() || `osascript exited with code ${exitCode}`);
    }
    return stdout.trim();
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    try {
      if (proc.exitCode === null) {
        proc.kill();
        await proc.exited;
      }
    } catch {
      // Best-effort cleanup only.
    }
  }
}

/** Run AppleScript via osascript with timeout. */
export function runAppleScript(script: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return runOsascript(["osascript", "-e"], script, timeoutMs);
}

/** Run JXA (JavaScript for Automation) via osascript with timeout. */
export function runJXA(script: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return runOsascript(["osascript", "-l", "JavaScript", "-e"], script, timeoutMs);
}
