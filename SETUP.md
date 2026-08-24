# Velox Pass — Setup Guide

## Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 18 (local)

## Backend

```bash
cd backend
pip install -r requirements.txt
python create_db.py
python main.py
```

`create_db.py` creates the `velox_pass` database, all tables and the default
superadmin. It is safe to re-run — existing data is left alone.

### Database credentials

`create_db.py` and the API both read `DATABASE_URL` from `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/velox_pass
```

If the bootstrap prints `password authentication failed for user "postgres"`,
put your real local PostgreSQL password in that URL and run it again.

### ngrok

`python main.py` opens an ngrok tunnel on port 8000 and prints the public URL.
Without an ngrok auth token the tunnel is skipped and the API still serves
locally — the startup banner says which happened. Add a token once with:

```bash
ngrok config add-authtoken <your-token>
```

### Migrations

Tables are created by `create_db.py`. For schema changes afterwards, run
Alembic from the `backend/` directory:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

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
