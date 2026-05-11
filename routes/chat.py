"""
routes/chat.py
Genera tokens de Stream Chat para el frontend.
"""

import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from stream_chat import StreamChat
from routes.auth import get_current_user  # tu dependencia de auth existente

chat_bp = APIRouter(prefix="/api/chat", tags=["chat"])

stream_client = StreamChat(
    api_key=os.environ.get("STREAM_API_KEY"),
    api_secret=os.environ.get("STREAM_API_SECRET"),
)


class ChannelRequest(BaseModel):
    clientId: str


@chat_bp.get("/token")
def get_stream_token(current_user=Depends(get_current_user)):
    """Devuelve un token Stream para el usuario autenticado."""
    user_id = str(current_user.id)
    stream_name = getattr(current_user, "name", None) or current_user.email

    stream_client.upsert_user({"id": user_id, "name": stream_name})
    token = stream_client.create_token(user_id)

    return {
        "token": token,
        "userId": user_id,
        "userName": stream_name,
        "apiKey": os.environ.get("STREAM_API_KEY"),
    }


@chat_bp.post("/channel")
def create_or_get_channel(
    body: ChannelRequest,
    current_user=Depends(get_current_user),
):
    """Crea (o recupera) un canal 1-a-1 entre entrenador y cliente."""
    client_id = str(body.clientId)
    trainer_id = str(current_user.id)

    members = sorted([trainer_id, client_id])
    channel_id = f"dm-{members[0]}-{members[1]}"

    channel = stream_client.channel("messaging", channel_id, {
        "members": members,
        "created_by_id": trainer_id,
    })
    channel.create(trainer_id)

    return {"channelId": channel_id}


@chat_bp.get("/channels")
def list_channels(current_user=Depends(get_current_user)):
    """Lista todos los canales del usuario actual."""
    user_id = str(current_user.id)
    response = stream_client.query_channels(
        filter_conditions={"members": {"$in": [user_id]}},
        sort=[{"last_message_at": -1}],
        limit=30,
    )
    channels = [
        {
            "id": ch["channel"]["id"],
            "lastMessage": ch.get("messages", [{}])[-1].get("text", ""),
        }
        for ch in response.get("channels", [])
    ]
    return {"channels": channels}