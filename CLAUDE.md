# Kaboom Comic Manager

## Project Overview
Kaboom is a self-hosted OPDS 1.2 server for serving CBZ, CBR, and ePub comic/manga/book files to readers like Panels (iPad). It includes a web UI for library management built with Nuxt 3.

## Architecture

### Monorepo (pnpm workspaces)
```
shared/    — TypeScript types, constants, regex patterns (@opds/shared)
server/    — Fastify 5 backend with SQLite (better-sqlite3 via Drizzle ORM) (@opds/server)
web/       — Nuxt 3 SPA frontend with @nuxt/ui (@opds/web)
docker/    — Dockerfile and docker-compose.yml
```

### Key Design Decisions
- **SPA mode (ssr: false)** — Nuxt generates static HTML/JS, served by Fastify in Docker
- **Content negotiation at `/`** — Browsers get the SPA (text/html), OPDS clients get XML catalog
- **Synchronous DB** — better-sqlite3 is sync; use `.get()`, `.all()`, `.run()` (no await needed)
- **tsx in production** — TypeScript runs directly via globally-installed tsx, no build step for server
- **`nuxt generate` (not `nuxt build`)** — Required for static SPA output with index.html in `.output/public/`
- **Relative API URLs** — SPA uses empty `API_BASE` in production (same-origin); dev uses `http://localhost:3000`

### Static File Serving in Docker
Fastify serves the SPA with two mechanisms:
1. `@fastify/static` with `prefix: '/_nuxt/'` — serves Nuxt JS/CSS chunks
2. `setNotFoundHandler` — serves index.html for SPA client-side routing (skips /api/, /opds/, /thumbnails/)
3. Explicit `app.get('/')` — content negotiation between SPA and OPDS catalog

**Important**: Do NOT register `@fastify/static` with `prefix: '/'` — it conflicts with the explicit root route handler.

## Tech Stack
- **Backend**: Fastify 5, Drizzle ORM, better-sqlite3, sharp (thumbnails), yauzl (CBZ/ZIP), node-unrar-js (CBR/RAR)
- **Frontend**: Nuxt 3, Vue 3, @nuxt/ui, Tailwind CSS 4, vuedraggable
- **Database**: SQLite at `DATA_DIR/opds.db`
- **Build**: pnpm workspaces, tsx (dev + prod), vitest (tests)
- **Deploy**: Docker multi-stage build → GHCR, GitHub Actions CI/CD

## Common Commands
```bash
pnpm install                    # Install all deps
pnpm dev                        # Run server (3000) + web (3001) concurrently
pnpm test                       # Run vitest (118 tests)
pnpm test:watch                 # Run vitest in watch mode
pnpm --filter @opds/web generate  # Build static SPA for Docker
```

## Database
- Schema defined in `server/src/db/schema/`
- Tables: watchDirectories, series, seasons, volumes, scanLog, groupingSuggestions, settings
- Migrations: `server/src/db/migrate.ts` (auto-runs on boot via `ensureSchema()`)
- All queries use Drizzle ORM's query builder (`.select().from().where().get()/.all()/.run()`)

## File Parsing
- `server/src/services/parser.ts` — Parses CBZ/CBR/ePub filenames into structured metadata (series, volume, year, etc.)
- Regex patterns defined in `shared/src/constants/parsing.ts`
- Edge cases: numeric-only filenames (e.g., "1.cbz") stay as seriesName; underscored names don't extract volumes due to `\b` word boundary limitations. These can be fixed in the UI.
- Test coverage: `server/src/services/parser.test.ts` (80+ test cases)

## OPDS
- OPDS 1.2 with PSE (Page Streaming Extension) for Panels app compatibility
- Feeds built with xmlbuilder2 in `server/src/services/opds/`
- URL generation uses `request.host` (includes port), NOT `request.hostname`

## Docker
- Multi-stage build: Stage 1 builds frontend + installs deps, Stage 2 is production
- `CMD ["tsx", "server/src/index.ts"]` — tsx installed globally
- Volumes: `/data` (database + cache), comic dirs mounted read-only
- Default docker-compose mounts comics at `/manga`

## Environment Variables
| Variable   | Default     | Description                          |
|------------|-------------|--------------------------------------|
| `PORT`     | `3000`      | Server listen port                   |
| `HOST`     | `0.0.0.0`   | Server bind address                  |
| `DATA_DIR` | `./data`    | Directory for database and cache     |
| `WEB_DIR`  | *(built-in)*| Path to frontend static files        |
| `API_BASE` | `''`        | API URL prefix (empty = relative)    |

## GitHub
- Repo: https://github.com/jakesteele/Kaboom-Comic-Manager
- CI/CD: `.github/workflows/docker.yml` — builds and pushes to GHCR on push to main
- Image: `ghcr.io/jakesteele/kaboom-comic-manager:latest`

## Known Limitations / TODOs
- Numeric-only filenames (e.g., "1.cbz", "23.cbz") can't distinguish series name from volume number — stays as seriesName
- Underscore-separated filenames (e.g., "My_Hero_Academia_v05.cbz") don't extract volume numbers due to word boundary regex
- These are all fixable in the web UI after scan
