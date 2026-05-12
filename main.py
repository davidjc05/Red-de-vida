from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routes import assignments, users, exercises, routines, auth
# from routes.chat import chat_bp
# from routes.calls import calls_bp


# =========================
# DATABASE
# =========================

Base.metadata.create_all(bind=engine)

# =========================
# FASTAPI
# =========================

app = FastAPI(
    title="Gym API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTES
# =========================

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(routines.router)
app.include_router(assignments.router)
# app.include_router(chat_bp)
# app.include_router(calls_bp)


# =========================
# TEST
# =========================

@app.get("/")
def home():
    return {
        "msg": "Gym API funcionando"
    }