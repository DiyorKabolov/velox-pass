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

## Starting the app

### One command (Windows)

Double-click `start.bat` in the project root, or run it from a terminal:

```
start.bat
```

It opens two windows — one for the backend, one for the frontend — and checks
first that `npm install` has already been run. Closing a window (or Ctrl+C in
it) stops that half; the other keeps running.

### Or manually, in two terminals

Terminal 1 (backend):

```bash
cd backend
python main.py
```

Terminal 2 (frontend):

```bash
cd frontend
npm run dev
```

Either way both processes keep running until you stop them, and the order does
not matter — Vite only calls the backend when the browser makes a request.

The ngrok tunnel exposes the backend API publicly for QR scanner access from
mobile devices. Only port 8000 is tunnelled, so the public ngrok URL serves the
API and `/docs`, never the site. **The site itself is at
http://localhost:5173.**

Free ngrok accounts allow a single tunnel, so run only one backend at a time —
a second `python main.py` fails with `ERR_NGROK_334`.

### Database credentials

`create_db.py` and the API both read `DATABASE_URL` from `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/velox_pass
```

If the bootstrap prints `password authentication failed for user "postgres"`,
put your real local PostgreSQL password in that URL and run it again.

### ngrok

`python main.py` opens an ngrok tunnel on port 8000, prints the public URL and
then starts uvicorn on `0.0.0.0:8000`. The tunnel covers the FastAPI backend
only, so a phone off the local network can still reach the API to scan tickets.

The startup banner looks like this:

```
🎟  Velox Pass API
📡  Public URL: https://<subdomain>.ngrok-free.dev
📖  Docs: https://<subdomain>.ngrok-free.dev/docs
🔧  Local: http://localhost:8000
```

An auth token is required — without one `ngrok.connect()` raises and the server
does not start. Add it once with:

```bash
ngrok config add-authtoken <your-token>
```

The public URL changes on every restart unless you have a reserved domain.
CORS already accepts any `*.ngrok-free.app`, `*.ngrok.app` or `*.ngrok.io`
origin alongside the two localhost ports, so no config change is needed when it
rotates.

### Migrations

Tables are created by `create_db.py`. For schema changes afterwards, run
Alembic from the `backend/` directory:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

## Frontend proxy

Vite proxies `/api/*` to `http://localhost:8000`, so the browser only ever
talks to port 5173 in development.

## Access
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Default admin: admin@veloxpass.com / admin123

## Email

Confirmation codes go out over SMTP using `MAIL_FROM` / `MAIL_PASSWORD` from
`backend/.env` (a Gmail app password works). While those are empty, the code is
printed to the backend console instead of being emailed — enough to register
and confirm an account locally.

## Roles

`superadmin` → `venue_admin` → `scanner` → `user`

Superadmins reach `/admin`; the seeded `admin` account is one. Roles are
assigned from **Admin → Users**.
