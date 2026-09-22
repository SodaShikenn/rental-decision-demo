/** Captioned recording of the local app with real provider requests. */
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
const session = `rental-record-${Date.now()}`;
const dir = "output/playwright";
mkdirSync(dir, { recursive: true });
rmSync(`${dir}/walkthrough-timings.json`, { force: true });
function cli(...args) {
  if (args[0] === "run-code") args[1] = args[1].trim().replace(/;$/, "");
  const result = spawnSync(
    "npx",
    ["--yes", "@playwright/cli@0.1.21", `-s=${session}`, ...args],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.status !== 0 || /^### Error/m.test(result.stdout || ""))
    throw new Error(result.stdout + result.stderr);
  return result.stdout;
}
let recording = false;
try {
  cli("open", "http://127.0.0.1:4173");
  cli("resize", "1440", "1000");
  cli(
    "run-code",
    readFileSync(new URL("./browser-demo-setup.js", import.meta.url), "utf8"),
  );
  cli(
    "video-start",
    `${dir}/walkthrough.webm`,
    "--size=1440x1000",
    "--fps=25",
    "--cursor",
  );
  recording = true;
  console.log(
    "Recording with live Gemini and Maps requests; provider charges may apply.",
  );
  const output = cli(
    "run-code",
    readFileSync(new URL("./browser-demo-journey.js", import.meta.url), "utf8"),
  );
  const json = output.match(/### Result\s*\n([^\n]+)/)?.[1];
  if (!json) throw new Error("Recording did not return chapter timings");
  writeFileSync(`${dir}/walkthrough-timings.json`, json + "\n");
  cli("video-stop");
  recording = false;
  console.log(`Recorded video and chapter timings in ${dir}`);
} finally {
  if (recording) cli("video-stop");
  cli("close");
}
