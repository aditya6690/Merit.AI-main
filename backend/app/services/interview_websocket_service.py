import asyncio

from fastapi import WebSocket


class InterviewConnectionManager:
    def __init__(self):
        self._connections: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, interview_id: int, websocket: WebSocket):
        await websocket.accept()

        async with self._lock:
            self._connections.setdefault(interview_id, set()).add(websocket)

    async def disconnect(self, interview_id: int, websocket: WebSocket):
        async with self._lock:
            connections = self._connections.get(interview_id)

            if not connections:
                return

            connections.discard(websocket)

            if not connections:
                self._connections.pop(interview_id, None)

    async def broadcast(self, interview_id: int, message: dict):
        async with self._lock:
            connections = list(self._connections.get(interview_id, set()))

        disconnected = []

        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)

        for websocket in disconnected:
            await self.disconnect(interview_id, websocket)


interview_connection_manager = InterviewConnectionManager()