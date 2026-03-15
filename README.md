# Kaboom Comic Manager

A lightweight, self-hosted OPDS 1.2 server for serving CBZ and ePub comic, manga, and book files. Includes a web UI for library management and full compatibility with OPDS readers like [Panels](https://panels.app) on iPad.

## Features

- **OPDS 1.2 + PSE** — Page Streaming Extension support for reading comics directly in Panels without downloading
- **Web UI** — Browse your library, manage series/seasons/volumes, trigger scans, and configure settings from any browser
- **CBZ + ePub** — Full support for both comic archives and ePub books, including metadata extraction and cover art
- **Auto-scanning** — Watch directories for new files with automatic metadata parsing (ComicInfo.xml for CBZ, OPF for ePub)
- **Smart grouping** — Suggests series groupings based on filename similarity
- **Thumbnails** — Automatic cover extraction and thumbnail generation
- **Search** — Full-text search across your library via OPDS and the web UI
- **Docker-ready** — Single container, SQLite database, no external dependencies

## Quick Start with Docker

### Docker Compose (recommended)

Create a `docker-compose.yml`:

```yaml
services:
  kaboom:
    image: ghcr.io/jakesteele/kaboom-comic-manager:latest
    container_name: kaboom
    ports:
      - "3000:3000"
    volumes:
      - kaboom-data:/data
      - /path/to/your/comics:/comics:ro
    environment:
      - DATA_DIR=/data
      - PORT=3000
    restart: unless-stopped

volumes:
  kaboom-data:
```

Replace `/path/to/your/comics` with the path to your CBZ/ePub files on the host.

```bash
docker compose up -d
```

### Docker Run

```bash
docker run -d \
  --name kaboom \
  -p 3000:3000 \
  -v kaboom-data:/data \
  -v /path/to/your/comics:/comics:ro \
  -e DATA_DIR=/data \
  ghcr.io/jakesteele/kaboom-comic-manager:latest
```

## Setup

1. **Start the container** using one of the methods above
2. **Open the web UI** at `http://your-server:3000`
3. **Add a watch directory** — Go to the Library page and add the path to your comics inside the container (e.g. `/comics`)
4. **Trigger a scan** — Click the scan button to discover and import your CBZ and ePub files
5. **Connect your reader** — In Panels (or any OPDS client), add `http://your-server:3000` as a new server

## Environment Variables

| Variable   | Default     | Description                          |
|------------|-------------|--------------------------------------|
| `PORT`     | `3000`      | Server listen port                   |
| `HOST`     | `0.0.0.0`   | Server bind address                  |
| `DATA_DIR` | `./data`    | Directory for database and cache     |
| `WEB_DIR`  | *(built-in)*| Path to frontend static files        |

## OPDS Endpoints

| Endpoint                     | Description                    |
|------------------------------|--------------------------------|
| `/`                          | Root catalog (auto-negotiated) |
| `/opds`                      | OPDS navigation catalog        |
| `/opds/series`               | Paginated series listing       |
| `/opds/series/:id`           | Seasons within a series        |
| `/opds/season/:id`           | Volumes within a season        |
| `/opds/search?q=`            | Search volumes                 |
| `/opds/stream/:id?page=N`    | PSE page streaming             |
| `/opds/thumbnail/:id`        | Volume thumbnail               |
| `/opds/new`                  | Recently added volumes         |
| `/opds/all`                  | All volumes (paginated)        |
| `/opds/download/:id`         | Download file (CBZ/ePub)       |

## API Endpoints

| Endpoint                              | Method | Description                    |
|---------------------------------------|--------|--------------------------------|
| `/api/library/directories`            | GET    | List watch directories         |
| `/api/library/directories`            | POST   | Add a watch directory          |
| `/api/library/directories/:id`        | DELETE | Remove a watch directory       |
| `/api/library/directories/:id/scan`   | POST   | Scan a specific directory      |
| `/api/library/scan-all`               | POST   | Scan all directories           |
| `/api/library/reset`                  | POST   | Clear library data (keeps dirs)|
| `/api/series`                         | GET    | List all series                |
| `/api/series/:id`                     | GET    | Series detail with seasons     |
| `/api/seasons/:id`                    | GET    | Season detail with volumes     |
| `/api/volumes/:id`                    | PATCH  | Update volume metadata         |
| `/api/grouping/suggestions`           | GET    | Auto-grouping suggestions      |
| `/health`                             | GET    | Health check                   |

## Development

### Prerequisites

- Node.js 20+
- pnpm

### Setup

```bash
pnpm install
```

### Run

Start the server and web UI in development mode:

```bash
# Terminal 1 — Server
cd server && pnpm dev

# Terminal 2 — Web UI
cd web && pnpm dev
```

The server runs on `http://localhost:3000` and the web UI on `http://localhost:3001`.

## Project Structure

```
kaboom/
  shared/          # Shared TypeScript types and constants
  server/          # Fastify backend
    src/
      db/          # SQLite schema and migrations (Drizzle ORM)
      routes/      # API and OPDS route handlers
      services/    # Scanner, parser, thumbnail, page streaming
  web/             # Nuxt 3 frontend (SPA mode)
    pages/         # File-based routing
    components/    # Vue components
  docker/          # Dockerfile and docker-compose.yml
```

## License

MIT
