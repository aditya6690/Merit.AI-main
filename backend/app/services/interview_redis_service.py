import asyncio
import json

from app.core.redis_client import get_client


class InterviewRedisService:
    def __init__(self):
        self._tasks: dict[int, asyncio.Task] = {}

    def channel_name(self, interview_id: int) -> str:
        return f"interview:{interview_id}:events"

    async def publish(self, interview_id: int, message: dict):
        redis_client = get_client()

        await asyncio.to_thread(
            redis_client.publish,
            self.channel_name(interview_id),
            json.dumps(message),
        )

    async def subscribe(self, interview_id: int):
        redis_client = get_client()
        pubsub = redis_client.pubsub()

        await asyncio.to_thread(
            pubsub.subscribe,
            self.channel_name(interview_id),
        )

        return pubsub

    async def close(self, pubsub):
        await asyncio.to_thread(pubsub.close)


interview_redis_service = InterviewRedisService()