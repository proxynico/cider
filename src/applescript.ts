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
    ? `start date ≥ ${startExpr} and start date ≤ ${endExpr}`
    : `start date > ${startExpr} and start date < ${endExpr}`;
}

async function runOsascript(
  args: string[],
  script: string,
  timeoutMs: number
): Promise<string> {
  let proc: Bun.Process;

  try {
    proc = Bun.spawn([...args, script], {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to run osascript: ${message}`);
  }

  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`osascript timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const [stdout, stderr, exitCode] = await Promise.race([
      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]),
      timeout,
    ]);

    if (exitCode !== 0) {
      throw new Error(stderr.trim() || `osascript exited with code ${exitCode}`);
    }
    return stdout.trim();
  } catch (err) {
    if (err instanceof Error && err.message.includes("timed out")) {
      throw err;
    }
    throw err;
  } finally {
    clearTimeout(timer!);
    try {
      if (proc && proc.exitCode === null) {
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
  return runOsascript(["osascript", "-e"], script, validateTimeoutMs(timeoutMs));
}

/** Run JXA (JavaScript for Automation) via osascript with timeout. */
export function runJXA(script: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return runOsascript(["osascript", "-l", "JavaScript", "-e"], script, validateTimeoutMs(timeoutMs));
}
