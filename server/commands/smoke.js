// CLI command (≈ commands/): post the fictional fixture sheet to a running Worker and compare each field with the ground truth.
// Usage: npm run smoke [-- baseUrl]   (default http://localhost:8787)
// Against a live-mode Worker this makes one billed Claude call.
import { readFile } from "node:fs/promises";

const baseUrl = process.argv[2] || "http://localhost:8787";
const fixtureUrl = new URL("../tests/fixtures/", import.meta.url);
const expected = JSON.parse(await readFile(new URL("expected.json", fixtureUrl), "utf8"));
const image = await readFile(new URL("listing-sheet.png", fixtureUrl));

const form = new FormData();
form.append("image", new Blob([image], { type: "image/png" }), "listing-sheet.png");

const started = performance.now();
const response = await fetch(`${baseUrl}/api/extract-listing`, { method: "POST", body: form });
const seconds = ((performance.now() - started) / 1000).toFixed(1);
const body = await response.json();
if (!response.ok) {
  console.error(`HTTP ${response.status} after ${seconds}s`, body);
  process.exit(1);
}

// Compare text leniently: NFKC folds full-width characters, and whitespace is ignored.
const canon = (value) => (typeof value === "string" ? value.normalize("NFKC").replace(/\s+/g, "") : value);
let failures = 0;
console.log(`mode=${body.meta.mode} model=${body.meta.model} ${seconds}s documentId=${body.documentId}`);
for (const [key, want] of Object.entries(expected.fields)) {
  const got = body.fields[key];
  const ok = canon(got.value) === canon(want);
  if (!ok) failures += 1;
  const box = got.evidence ? got.evidence.map((n) => n.toFixed(3)).join(",") : "none";
  console.log(`${ok ? "PASS" : "FAIL"} ${key.padEnd(16)} got=${JSON.stringify(got.value)} want=${JSON.stringify(want)} confidence=${got.confidence} box=[${box}]`);
}
for (const want of expected.expectedWarnings) {
  const found = body.warnings.some((warning) => warning.code === want.code && want.fields.every((field) => warning.fields.includes(field)));
  if (!found) failures += 1;
  console.log(`${found ? "PASS" : "FAIL"} warning ${want.code} on ${want.fields.join(",")}`);
}
console.log(body.warnings.map((warning) => `  warning: ${warning.message}`).join("\n"));
console.log(failures ? `${failures} check(s) failed` : "all checks passed");
process.exit(failures ? 1 : 0);
