/** Inject the public API address into a Pages artifact; secrets never enter this file. */
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function publicApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("RENTAL_API_URL must be a public HTTPS base URL.");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    /^127\./.test(host)
  )
    throw new Error(
      "RENTAL_API_URL must use HTTPS without credentials, query parameters or a loopback host.",
    );
  return url.href.replace(/\/+$/, "");
}

export function publicConfigSource(value) {
  return `// Generated for this deployment. Contains an API address only, never API keys.\nwindow.RENTAL_DEMO_ENV = Object.freeze(${JSON.stringify({ extractionApiUrl: publicApiUrl(value) })});\n`;
}

export async function verifyApiConfiguration(base, origin, fetchImpl = fetch) {
  const url = publicApiUrl(base);
  const health = await fetchImpl(`${url}/healthz`, {
    headers: { Origin: origin },
    signal: AbortSignal.timeout(15000),
  });
  if (!health.ok)
    throw new Error("The configured API health endpoint is unavailable.");
  const body = await health.json();
  if (
    body.mode !== "live" ||
    !body.enabled ||
    !body.configured ||
    !body.maps?.configured ||
    !body.research?.enabled ||
    !body.research?.configured ||
    !body.sharing?.enabled
  )
    throw new Error(
      "The API must configure live extraction, research, Maps and sharing before a full release.",
    );
  if (health.headers.get("access-control-allow-origin") !== origin)
    throw new Error("The API does not allow the public frontend origin.");
  const preflight = await fetchImpl(`${url}/api/reviews/web`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (
    !preflight.ok ||
    preflight.headers.get("access-control-allow-origin") !== origin ||
    !/\bPOST\b/.test(
      preflight.headers.get("access-control-allow-methods") || "",
    ) ||
    !/content-type/i.test(
      preflight.headers.get("access-control-allow-headers") || "",
    )
  )
    throw new Error(
      "The API does not permit JSON requests from the public frontend.",
    );
  // Configuration checks do not spend provider quota or establish live provider availability.
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const target = process.argv[2];
  if (!target)
    throw new Error("Usage: node scripts/configure-pages.mjs <built-env.js>");
  const base = publicApiUrl(process.env.RENTAL_API_URL);
  await verifyApiConfiguration(
    base,
    process.env.RENTAL_FRONTEND_ORIGIN || "https://sodashikenn.github.io",
  );
  await writeFile(target, publicConfigSource(base));
  console.log(
    "Verified API configuration and CORS; wrote the public API address to the Pages artifact.",
  );
}
