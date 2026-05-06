import { access } from "fs/promises";
import { constants } from "fs";
import { resolve, dirname } from "path";
import type { ToolDef } from "../types.ts";

const CAL_BIN = resolve(dirname(import.meta.path), "../helpers/cider-cal");
const TIMEOUT = 5_000;

async function runCheck(name: string, cmd: string[], okText?: string): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`${name} timed out after ${TIMEOUT}ms`));
    }, TIMEOUT);
  });

  try {
    const [stdout, stderr, code] = await Promise.race([
      Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]),
      timeout,
    ]);
    if (code !== 0) return `FAIL ${name}: ${stderr.trim() || stdout.trim() || `exit ${code}`}`;
    return `OK ${name}: ${okText ?? stdout.trim()}`;
  } catch (err) {
    return `FAIL ${name}: ${err instanceof Error ? err.message : "unknown error"}`;
  } finally {
    clearTimeout(timer);
    if (proc.exitCode === null) {
      proc.kill();
      await proc.exited.catch(() => {});
    }
  }
}

async function checkExecutable(path: string): Promise<string> {
  try {
    await access(path, constants.X_OK);
    return `OK calendar helper: ${path}`;
  } catch {
    return `FAIL calendar helper: missing or not executable at ${path}. Run bun run build:swift.`;
  }
}

function permissionSummary(helperOutput: string): string {
  if (helperOutput.includes("calendar authorization: fullAccess") || helperOutput.includes("calendar authorization: authorized")) {
    return "OK calendar permission: granted";
  }
  if (helperOutput.includes("calendar authorization: denied")) {
    return "FAIL calendar permission: denied. Grant access in System Settings > Privacy & Security > Calendars.";
  }
  if (helperOutput.includes("calendar authorization: restricted")) {
    return "FAIL calendar permission: restricted by macOS policy.";
  }
  if (helperOutput.includes("calendar authorization: writeOnly")) {
    return "FAIL calendar permission: write-only; Cider needs full calendar access for search/update/delete.";
  }
  return "WARN calendar permission: not determined. Run a Calendar tool once and approve the macOS prompt.";
}

const tools: ToolDef[] = [
  {
    name: "doctor",
    desc: "Check local Cider runtime dependencies and helper readiness",
    handle: async () => {
      const helperReady = await checkExecutable(CAL_BIN);
      const helperDoctor = helperReady.startsWith("OK")
        ? await runCheck("calendar helper doctor", [CAL_BIN, "--doctor"])
        : helperReady;
      const lines = [
        `OK bun: ${Bun.version}`,
        await runCheck("osascript", ["osascript", "-e", "return \"ok\""], "available"),
        helperReady,
        helperDoctor,
        permissionSummary(helperDoctor),
      ];
      return lines.join("\n");
    },
  },
];

export default tools;
