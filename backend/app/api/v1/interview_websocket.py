import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.api.deps import _user_from_payload
from app.database.session import SessionLocal
from app.models.enums import RoleName
from app.repositories import user_repository
from app.services import interview_service

from app.services.interview_websocket_service import interview_connection_manager
from app.services.interview_redis_service import interview_redis_service


router = APIRouter()

async def authenticate_interview_websocket(
    websocket: WebSocket,
    interview_id: int,
):
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(
            code=1008,
            reason="Authentication required",
        )
        return None

    payload = decode_access_token(token)

    if not payload:
        await websocket.close(
            code=1008,
            reason="Invalid or expired token",
        )
        return None

    db: Session = SessionLocal()

    try:
        user = _user_from_payload(payload, db)

        if user.role.name == RoleName.STUDENT.value:
            interview_service.get_interview_for_student(
                db,
                user.id,
                interview_id,
            )

        elif user.role.name == RoleName.EXAMINER.value:
            interview_service.get_interview_for_examiner(
                db,
                user.id,
                interview_id,
            )

        else:
            await websocket.close(
                code=1008,
                reason="You do not have access to this interview",
            )
            return None

        return user

    except Exception as exc:
        print(
            f"Interview WebSocket authentication failed: "
            f"{type(exc).__name__}: {exc}"
        )
        await websocket.close(
            code=1008,
            reason="Authentication or interview access failed",
        )
        return None

    finally:
        db.close()


@router.websocket('/ws/interviews/{interview_id}')
async def interview_websocket(websocket: WebSocket, interview_id: int):
    user = await authenticate_interview_websocket(
        websocket,
        interview_id,
    )

    if user is None:
        return

    await interview_connection_manager.connect(
        interview_id,
        websocket,
    )

    pubsub = await interview_redis_service.subscribe(interview_id)

    async def redis_listener():
        try:
            while True:
                message = await asyncio.to_thread(
                    pubsub.get_message,
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )

                if message and message.get('type') == 'message':
                    data = json.loads(message['data'])

                    await interview_connection_manager.broadcast(
                        interview_id,
                        data,
                    )

        except asyncio.CancelledError:
            pass

    listener_task = asyncio.create_task(redis_listener())

    try:
        await websocket.send_json(
            {
                'type': 'connection_established',
                'interview_id': interview_id,
                'message': 'Connected to interactive interview session',
            }
        )

        while True:
            message = await websocket.receive_json()

            await interview_redis_service.publish(
                interview_id,
                {
                    'type': 'interview_event',
                    'interview_id': interview_id,
                    'data': message,
                },
            )

    except WebSocketDisconnect:
        pass

    finally:
        listener_task.cancel()

        try:
            await listener_task
        except asyncio.CancelledError:
            pass

        await interview_redis_service.close(pubsub)

        await interview_connection_manager.disconnect(
            interview_id,
            websocket,
        )