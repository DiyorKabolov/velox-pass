import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pyngrok import ngrok
import uvicorn

from app.routers import admin, auth, events, scanner, tickets, venues

# The Windows console defaults to a legacy code page that cannot encode the
# emoji in the startup banner, which would crash the process on the first print.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

app = FastAPI(title="Velox Pass API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=r"https://.*\.ngrok(-free)?\.app|https://.*\.ngrok\.io",
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


@app.get("/")
def root():
    return {"status": "ok", "project": "Velox Pass", "version": "1.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    # .public_url is the bare https URL; the tunnel object itself reprs as
    # 'NgrokTunnel: "https://..." -> "http://localhost:8000"', which breaks the
    # docs link below.
    public_url = ngrok.connect(8000).public_url
    print(f"\n🎟  Velox Pass API")
    print(f"📡  Public URL: {public_url}")
    print(f"📖  Docs: {public_url}/docs")
    print(f"🔧  Local: http://localhost:8000\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
