# Velox Pass

Modern electronic ticketing system with seat selection, venue management, and role-based access.

## Stack
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, JWT, ngrok (static domain)
- **Frontend**: React 18, Vite, TanStack Query, Zustand, Tailwind CSS

## Features
- Event ticketing with and without seat selection
- Interactive hall seat map
- Role system: superadmin → venue_admin → scanner → user
- Email verification
- QR code tickets with PDF export
- Real-time seat availability

## Getting started

See [SETUP.md](SETUP.md) for the full walkthrough.

```bash
# backend
cd backend && pip install -r requirements.txt && python create_db.py && python main.py

# frontend
cd frontend && npm install && npm run dev
```

## Structure

```
backend/
  app/
    core/       config, security, database, dependencies
    models/     SQLAlchemy tables
    schemas/    Pydantic request/response models
    routers/    auth, events, tickets, venues, scanner, admin
    services/   auth, ticket and mail logic
  alembic/      migrations
  create_db.py  database + superadmin bootstrap
  main.py       app entry point with the ngrok tunnel

frontend/
  src/
    api/        axios client and endpoint wrappers
    components/ ui, layout, tickets, events
    hooks/      useAuth, useTickets, useEvents
    pages/      public pages + admin section
    store/      Zustand auth store
    utils/      date and colour helpers
```
