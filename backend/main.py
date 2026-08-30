import atexit
import os
import sys

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pyngrok import conf as ngrok_conf
from pyngrok import ngrok as ngrok_tunnel
import uvicorn

from app.core.config import settings
from app.core.websocket_manager import manager
from app.routers import (
    admin,
    auth,
    events,
    pdf_templates,
    scanner,
    sessions,
    tickets,
    venue_admin,
    venues,
)

# The Windows console defaults to a legacy code page that cannot encode the
# emoji in the startup banner, which would crash the process on the first print.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

app = FastAPI(
    title="Velox Pass API",
    version="1.0",
    # Keeps the token across page reloads of /docs.
    swagger_ui_parameters={"persistAuthorization": True},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every API route lives under /api so the path is identical in development
# (through the Vite proxy) and in production (served by FastAPI itself).
API_PREFIX = "/api"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(events.router, prefix=API_PREFIX)
app.include_router(tickets.router, prefix=API_PREFIX)
app.include_router(venues.router, prefix=API_PREFIX)
app.include_router(sessions.router, prefix=API_PREFIX)
app.include_router(scanner.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(pdf_templates.router, prefix=API_PREFIX)
app.include_router(pdf_templates.event_router, prefix=API_PREFIX)
app.include_router(venue_admin.router, prefix=API_PREFIX)


@app.get("/api/status", tags=["system"])
def status():
    return {"status": "ok", "project": "Velox Pass", "version": "1.0"}


@app.get("/health", tags=["system"])
def health():
    return {"status": "healthy"}


@app.websocket("/ws/sessions/{session_id}/seats")
async def session_seats_socket(websocket: WebSocket, session_id: int):
    """Read-only live seat updates. Unauthenticated on purpose: it carries no
    personal data, only which seat numbers just sold."""
    await manager.connect(session_id, websocket)
    try:
        while True:
            # Nothing is expected from the client; this keeps the socket open
            # and notices the disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await manager.disconnect(session_id, websocket)


# --- React frontend -------------------------------------------------------
# Mounted AFTER every API router so the catch-all below can never shadow them.
FRONTEND_DIST = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
)

# Uploaded template PDFs. Created before the mount, which fails on a missing
# directory and would take the whole app down with it.
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOADS_DIR, "templates"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Paths owned by FastAPI; the SPA fallback must never answer for them.
RESERVED_PREFIXES = ("api", "docs", "redoc", "openapi.json", "health", "uploads")

if os.path.isdir(FRONTEND_DIST):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")),
        name="assets",
    )

    def _safe_dist_file(relative_path: str) -> str | None:
        """Resolve a path inside dist/, or None if it escapes or is missing."""
        candidate = os.path.normpath(os.path.join(FRONTEND_DIST, relative_path))
        # normpath collapses '..', so this blocks directory traversal.
        if not candidate.startswith(FRONTEND_DIST):
            return None
        return candidate if os.path.isfile(candidate) else None

    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def serve_react(full_path: str):
        """Serve built files, falling back to index.html for client routes."""
        # An unmatched /api/... or /docs must 404 as JSON, not as the SPA shell,
        # otherwise fetch() silently receives HTML instead of an error.
        if full_path.split("/", 1)[0] in RESERVED_PREFIXES:
            raise HTTPException(status_code=404, detail="Not found")

        # Real files (favicon, vite.svg, robots.txt) are returned as themselves.
        if full_path:
            existing = _safe_dist_file(full_path)
            if existing:
                return FileResponse(existing)

        index_path = os.path.join(FRONTEND_DIST, "index.html")
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())


if __name__ == "__main__":
    PORT = 8000

    # Must be set before connect(); pyngrok otherwise falls back to whatever
    # `ngrok config` holds, which may be nothing on a fresh machine.
    if settings.NGROK_AUTH_TOKEN:
        ngrok_conf.get_default().auth_token = settings.NGROK_AUTH_TOKEN

    # A static domain keeps one address across restarts, so browser sessions
    # (and their localStorage tokens) survive a server restart.
    static_domain = settings.NGROK_DOMAIN.strip()
    if static_domain:
        tunnel = ngrok_tunnel.connect(PORT, domain=static_domain)
    else:
        tunnel = ngrok_tunnel.connect(PORT)

    # .public_url, not the tunnel object: its repr is
    # 'NgrokTunnel: "https://..." -> "http://localhost:8000"', which would
    # mangle the docs link below.
    public_url = tunnel.public_url

    # ngrok survives a hard kill and then blocks the next start with
    # ERR_NGROK_334 ("endpoint already online"), so close it explicitly.
    atexit.register(ngrok_tunnel.kill)

    print("\n🎟  Velox Pass v1.0")
    print(f"🔧  Local:      http://localhost:{PORT}")
    print(f"🌐  Public:     {public_url}")
    print(f"📖  API Docs:   {public_url}/docs")
    if os.path.isdir(FRONTEND_DIST):
        print("🖥   Site:       served from frontend/dist")
    else:
        print("⚠   frontend/dist not found - API only. Run build.bat first.")
    print()

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
