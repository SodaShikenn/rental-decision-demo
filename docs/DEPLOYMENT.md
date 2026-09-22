# Deploy Rental Helper

The public [walkthrough](https://sodashikenn.github.io/rental-helper/demo/) is a video, not a hosted application. Deploy the frontend and Python API together to use image/link analysis, AI, Maps checks, leisure discovery, reviews and expiring shares.

This guide uses one Linux server, Docker Compose and a domain. The supplied [production configuration](../docker/compose.production.yml) serves HTTPS with Caddy, keeps the API port private and stores shares in a persistent Docker volume. It is a single-instance deployment; do not scale replicas while sharing uses SQLite and rate limiting is process-local.

## 1. Prepare the host and providers

- Install Docker Engine with the Compose plugin using the [official installation guide](https://docs.docker.com/engine/install/). Verify `docker compose version`.
- Point your domain's A record (and AAAA only if IPv6 works) at the server. Allow inbound TCP ports **80 and 443**; retain your SSH access. Do not expose port 8000.
- Prepare a Gemini key with model and Google Search quota, and a server-side Google Maps key with Geocoding, Places API (New) and Routes enabled. Set provider billing budgets and quota limits before making the app public.
- Allocate enough disk and memory for the OCR model image and actual extraction requests. The initial build downloads models and CPU PyTorch; a passing health check alone does not prove sufficient memory.

Caddy obtains and renews HTTPS certificates once DNS and ports are reachable. See its [automatic HTTPS requirements](https://caddyserver.com/docs/automatic-https). The Compose service name `api:8000` is the internal upstream, following the [reverse proxy configuration](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

## 2. Clone and configure

```sh
git clone https://github.com/SodaShikenn/rental-helper.git
cd rental-helper
cp docker/.env.production.example docker/.env.production
chmod 600 docker/.env.production
```

Edit **`docker/.env.production` on the server**:

```dotenv
RENTAL_DOMAIN=rentals.your-domain.com
GEMINI_API_KEY=your-gemini-key
GOOGLE_MAPS_API_KEY=your-maps-key
GEMINI_MODEL=gemini-3.8-flash
GEMINI_THINKING_LEVEL=low
RATE_LIMIT_PER_MINUTE=5
```

Use a hostname without `https://` or a path. Choose a Gemini model available to your account that supports the application's structured output, search and URL-context requests. Keys never belong in `web/env.js`, GitHub Pages variables or committed files. The secret file is ignored by Git and lies outside the API build context.

Production Compose sets live mode, enables extraction/research/sharing, uses `https://RENTAL_DOMAIN` as the allowed origin, and stores SQLite at `/app/data/shares.sqlite3`. Its frontend uses the same origin for API calls, so there is no separate frontend URL to configure. Forwarded IPs are trusted only because the API container has no published host port and is behind Caddy.

## 3. Validate and launch

From the repository root:

```sh
docker compose --env-file docker/.env.production -f docker/compose.production.yml config --quiet
docker compose --env-file docker/.env.production -f docker/compose.production.yml up -d --build
docker compose --env-file docker/.env.production -f docker/compose.production.yml ps
```

Use `config --quiet`: plain `config` prints expanded environment values, including keys. If startup fails, inspect service logs locally without posting secrets:

```sh
docker compose --env-file docker/.env.production -f docker/compose.production.yml logs --tail=100 api web
curl --fail https://rentals.your-domain.com/healthz
```

Expect `mode: "live"`, `enabled: true`, `configured: true`, research enabled/configured, Maps configured and sharing enabled. These indicate configuration; **only real requests verify provider permissions and quota**. Then open `https://rentals.your-domain.com/` in a fresh browser. The API reference is at `/docs`.

## 4. Verify the complete flow

Use public listing material and your deployed URL, without intercepted responses:

- [ ] Upload an image; confirm extracted fields against its source.
- [ ] Import a listing URL; inspect building/unit identity and source links.
- [ ] Research missing rent. Another unit's price must remain a labelled reference.
- [ ] Start AI analysis, choose an actual answer, explicitly confirm a proposal and check the brief.
- [ ] Select a commute destination; inspect both prefilled Google Maps routes. Set 08:00 arrival / 18:00 departure **inside Maps**. Links do not return transit durations to the app.
- [ ] Run a station/shopping check; inspect the date and walking estimates.
- [ ] Search leisure places, confirm an interest, and compare weekly scenarios.
- [ ] Search reviews. A successful search with no usable reviews is valid; a provider error is not an empty result.
- [ ] Read the brief and download its HTML.
- [ ] Create a share; open it in a separate browser, restart the API, and verify it remains readable. Revoke it and verify that the reader loses access.
- [ ] Check mobile navigation and browser errors.

The walkthrough is a **local live-API recording**, not proof that your deployment passes these checks. Japanese transit times/fares are not supplied in-app; Maps handoff is the current workflow. Availability, rent and user reviews require source/context checks rather than a promise of accuracy.

## 5. Keep data across updates

The named `share-data` volume preserves unexpired shares across container replacement. Caddy's named volumes preserve certificates. **Do not run `down -v`** unless you intend to erase these volumes. Frontend candidates and confirmed preferences remain in each user's browser.

Before updating, create a consistent SQLite backup and copy it to protected storage:

```sh
mkdir -p backups
chmod 700 backups
docker compose --env-file docker/.env.production -f docker/compose.production.yml exec -T api python -c 'import sqlite3; src=sqlite3.connect("/app/data/shares.sqlite3"); dst=sqlite3.connect("/app/data/shares.backup.sqlite3"); src.backup(dst); dst.close(); src.close()'
docker compose --env-file docker/.env.production -f docker/compose.production.yml cp api:/app/data/shares.backup.sqlite3 ./backups/shares.sqlite3
chmod 600 backups/shares.sqlite3
```

Backups contain shared user content; keep them private and expire old copies. `backups/` is ignored by Git. Save the current commit ID, update and rebuild:

```sh
git rev-parse HEAD
git pull --ff-only
docker compose --env-file docker/.env.production -f docker/compose.production.yml up -d --build
```

Recheck health and the acceptance flow. To roll back, check out the saved commit and rebuild with the same command, retaining the volumes; review any database format change before rolling back. Stop without deleting data using:

```sh
docker compose --env-file docker/.env.production -f docker/compose.production.yml down
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Certificate cannot be issued | DNS A/AAAA, ports 80/443, domain spelling and Caddy logs. |
| `configured: false` | The production secret file and key variable names; recreate the containers after editing it. |
| AI/search returns quota errors | Gemini project billing, model access and request/search quotas. |
| Maps returns permission errors | APIs enabled on the key's project, billing, and server-side key restrictions. |
| HTTP 429 from this app | Per-client requests exceeded the process-local limit; wait, then retry. |
| Slow first build or extraction | Model download, CPU/memory and API logs. Proxy waits up to 200 seconds for response headers. |
| Shares vanish after redeploy | `/app/data` volume and UID 10001 write permission; do not replace the volume. |

[Development and storage limits](DEVELOPMENT.md) · [Record a new walkthrough](DEMO.md)
