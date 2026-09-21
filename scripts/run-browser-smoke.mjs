/** Optional CLI-driven browser check. Start the web and API servers first. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const session = `rental-smoke-${Date.now()}`;
function run(...args) {
  const result = spawnSync(
    "npx",
    ["--yes", "@playwright/cli@0.1.21", `-s=${session}`, ...args],
    { encoding: "utf8" },
  );
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  // CLI tool errors can be reported in stdout without a nonzero process exit.
  if (result.status !== 0 || /^### Error/m.test(result.stdout || ""))
    throw new Error("Browser smoke check failed");
}
try {
  run("open", "http://127.0.0.1:4173");
  run("resize", "1440", "1000");
  run(
    "run-code",
    readFileSync(new URL("./browser-smoke.js", import.meta.url), "utf8")
      .trim()
      .replace(/;$/, ""),
  );
} finally {
  run("close");
}
