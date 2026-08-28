"""Fan-out of seat updates to everyone watching one session's seat map."""
import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    """Tracks open sockets per session id.

    Broadcasts are best effort: a client that has gone away is dropped rather
    than allowed to fail the request that triggered the broadcast.
    """

    def __init__(self) -> None:
        self.active_connections: dict[int, list[WebSocket]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def connect(self, session_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections[session_id].append(websocket)

    async def disconnect(self, session_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self.active_connections.get(session_id)
            if not sockets:
                return
            if websocket in sockets:
                sockets.remove(websocket)
            if not sockets:
                self.active_connections.pop(session_id, None)

    async def broadcast_to_session(self, session_id: int, message: dict) -> None:
        async with self._lock:
            sockets = list(self.active_connections.get(session_id, []))

        dead: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(message)
            except Exception:
                dead.append(socket)

        for socket in dead:
            await self.disconnect(session_id, socket)

    def count(self, session_id: int) -> int:
        return len(self.active_connections.get(session_id, []))


# Singleton shared by the routers and the WebSocket endpoint.
manager = ConnectionManager()
