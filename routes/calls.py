# """
# routes/calls.py
# Crea y elimina salas de videollamada con Daily.co.
# """

# import os
# import time
# import requests
# from fastapi import APIRouter, Depends, HTTPException
# from pydantic import BaseModel
# from routes.auth import get_current_user  # tu dependencia de auth existente

# calls_bp = APIRouter(prefix="/api/calls", tags=["calls"])

# DAILY_API_KEY = os.environ.get("DAILY_API_KEY")
# DAILY_BASE_URL = "https://api.daily.co/v1"
# DAILY_HEADERS = {
#     "Authorization": f"Bearer {DAILY_API_KEY}",
#     "Content-Type": "application/json",
# }


# class CreateRoomRequest(BaseModel):
#     clientId: str = "guest"


# @calls_bp.post("/create")
# def create_room(
#     body: CreateRoomRequest,
#     current_user=Depends(get_current_user),
# ):
#     """Crea una sala de videollamada temporal (expira en 2 horas)."""
#     trainer_id = str(current_user.id)
#     room_name = f"session-{trainer_id}-{body.clientId}-{int(time.time())}"

#     payload = {
#         "name": room_name,
#         "privacy": "private",
#         "properties": {
#             "exp": int(time.time()) + 7200,
#             "max_participants": 2,
#             "enable_chat": False,
#             "enable_screenshare": True,
#             "enable_recording": False,
#             "start_video_off": False,
#             "start_audio_off": False,
#         },
#     }

#     resp = requests.post(
#         f"{DAILY_BASE_URL}/rooms",
#         json=payload,
#         headers=DAILY_HEADERS,
#         timeout=10,
#     )

#     if resp.status_code != 200:
#         raise HTTPException(status_code=500, detail="No se pudo crear la sala Daily")

#     room = resp.json()
#     trainer_token = _create_meeting_token(room["name"], trainer_id, is_owner=True)
#     client_token = _create_meeting_token(room["name"], str(body.clientId), is_owner=False)

#     return {
#         "roomUrl": room["url"],
#         "roomName": room["name"],
#         "trainerToken": trainer_token,
#         "clientToken": client_token,
#         "expiresAt": payload["properties"]["exp"],
#     }


# @calls_bp.delete("/delete/{room_name}")
# def delete_room(room_name: str, current_user=Depends(get_current_user)):
#     """Elimina una sala cuando la llamada termina."""
#     resp = requests.delete(
#         f"{DAILY_BASE_URL}/rooms/{room_name}",
#         headers=DAILY_HEADERS,
#         timeout=10,
#     )
#     if resp.status_code == 200:
#         return {"message": "Sala eliminada"}
#     raise HTTPException(status_code=404, detail="Sala no encontrada")


# def _create_meeting_token(room_name: str, user_id: str, is_owner: bool) -> str:
#     payload = {
#         "properties": {
#             "room_name": room_name,
#             "user_name": user_id,
#             "is_owner": is_owner,
#             "exp": int(time.time()) + 7200,
#         }
#     }
#     resp = requests.post(
#         f"{DAILY_BASE_URL}/meeting-tokens",
#         json=payload,
#         headers=DAILY_HEADERS,
#         timeout=10,
#     )
#     return resp.json().get("token", "")