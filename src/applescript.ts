const DEFAULT_TIMEOUT_MS = 30_000;

/** Escape a string for embedding in AppleScript double-quoted strings. */
export function escAS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Escape a string for embedding in JXA double-quoted strings. */
export function escJS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** Convert ISO 8601 string to an AppleScript date expression. */
export function asDateExpr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `date "${dateStr}"`;
}

async function runOsascript(
  args: string[],
  script: string,
  timeoutMs: number
): Promise<string> {
  const proc = Bun.spawn([...args, script], {
    stdout: "pipe",
    stderr: "pipe",
  });

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
  } finally {
    clearTimeout(timer!);
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
