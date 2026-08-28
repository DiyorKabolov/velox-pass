# Velox Pass — Setup Guide

## Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 18 (local)

## Install

```bash
cd backend
pip install -r requirements.txt
python create_db.py
```

```bash
cd frontend
npm install
```

`create_db.py` creates the `velox_pass` database, all tables and the default
superadmin. It is safe to re-run — existing data is left alone. Run it before
the first `python main.py`, otherwise every request that touches the database
fails with a 500.

## Demo data (optional)

```bash
cd backend
python seed_demo.py
```

Fills the database with Russian demo content: three venues with five halls
(aisles, VIP rows, a balcony, a couple of broken seats), eight events, sessions
with per-category prices, and one ticket in each state so the cabinet shows a
valid, an expired and a scanned card.

It replaces every event, venue, hall, seat, session and ticket, but never
touches user accounts. `python seed_demo.py --keep` adds without deleting.

## Starting the app

Terminal 1 — Backend + ngrok tunnel:

```bash
cd backend
python main.py
```

It opens the tunnel first, then starts uvicorn, and prints both addresses:

```
🎟  Velox Pass v1.0
🔧  Local:      http://localhost:8000
🌐  Public:     https://<your-domain>.ngrok-free.app
📖  API Docs:   https://<your-domain>.ngrok-free.app/docs
🖥   Site:       served from frontend/dist
```

Terminal 2 — Frontend (development only):

```bash
cd frontend
npm run dev
```

For production (single URL):

```bash
build.bat
cd backend
python main.py
```

Then open the ngrok URL from any device — it serves the site, the API and
`/docs` through one tunnel. Ctrl+C stops the server and closes the tunnel;
ngrok is killed on exit, so the next start is not blocked.

## ngrok static domain

Without a static domain ngrok hands out a new address on every start. That
also drops every browser session, because `localStorage` is scoped per origin
and the token lives there.

The free ngrok plan includes one static domain:

1. Sign in at https://dashboard.ngrok.com
2. Copy the auth token from **Your Authtoken**
3. Claim your domain under **Domains** — it looks like
   `something-random.ngrok-free.app`

Put both in `backend/.env`:

```
NGROK_DOMAIN=your-domain.ngrok-free.app
NGROK_AUTH_TOKEN=your-token
```

`NGROK_DOMAIN` may be left empty; the tunnel then falls back to a random URL.

Only one tunnel can be online per free account. If a previous run was killed
hard, a stale `ngrok.exe` keeps the domain and the next start fails with
`ERR_NGROK_334` — close it with `Stop-Process -Name ngrok -Force`.

## Requirements

- ngrok account and auth token (free) — no separate install needed, `pyngrok`
  downloads the binary on first run

## How the routes are split

| Path | Served by |
|---|---|
| `/api/*` | FastAPI — all API endpoints |
| `/health`, `/docs`, `/openapi.json` | FastAPI |
| `/assets/*` | the built JS and CSS |
| everything else | `index.html`, so React Router handles the URL |

The API lives under `/api` in both modes, so the frontend calls the same paths
in development and in production. The React catch-all is registered last and
explicitly refuses `/api`, `/docs` and `/health`, so an unknown API path
returns a JSON 404 instead of the HTML shell.

Rebuild with `build.bat` after every frontend change — the backend serves
whatever is in `dist`, not your source files.

### Database credentials

`create_db.py` and the API both read `DATABASE_URL` from `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/velox_pass
```

If the bootstrap prints `password authentication failed for user "postgres"`,
put your real local PostgreSQL password in that URL and run it again.

## Email

Confirmation codes go out over SMTP using `MAIL_FROM` / `MAIL_PASSWORD` from
`backend/.env` (a Gmail app password works). While those are empty, the code is
printed to the backend console instead of being emailed — enough to register
and confirm an account locally.

## Roles

`superadmin` → `venue_admin` → `scanner` → `user`

Superadmins reach `/admin`; the seeded `admin` account is one. Roles are
assigned from **Admin → Users**.
