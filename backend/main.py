"""Velox Pass API entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import admin, auth, events, scanner, tickets, venues

app = FastAPI(
    title="Velox Pass API",
    version="2.0",
    description="Electronic ticketing system: events, halls, seats, QR tickets.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(events.router)
app.include_router(tickets.router)
app.include_router(venues.router)
app.include_router(scanner.router)
app.include_router(admin.router)


@app.get("/", tags=["system"])
async def root():
    return {
        "status": "ok",
        "version": "2.0",
        "project": "Velox Pass",
        "docs": "/docs",
    }


@app.get("/health", tags=["system"])
async def health():
    return {"status": "healthy"}


def open_tunnel(port: int) -> str | None:
    """Open an ngrok tunnel; returns None when ngrok is unavailable."""
    try:
        from pyngrok import ngrok

        tunnel = ngrok.connect(port, "http")
        return tunnel.public_url
    except Exception as exc:
        print(f"[ngrok] tunnel not started: {exc}")
        return None


if __name__ == "__main__":
    import uvicorn

    PORT = 8000
    public_url = open_tunnel(PORT)

    print("=" * 60)
    print(f"  Velox Pass API v{settings.VERSION}")
    print(f"  Local:      http://localhost:{PORT}")
    print(f"  Local docs: http://localhost:{PORT}/docs")
    if public_url:
        print(f"  Public:     {public_url}")
        print(f"  Public docs:{public_url}/docs")
    print("=" * 60)

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
