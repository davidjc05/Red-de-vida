import os

from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from database import engine, Base, ensure_user_columns, rename_muscle_groups
from routes import assignments, users, exercises, routines, auth, activities, forms, tracking
from fastapi.middleware.cors import CORSMiddleware
# Crea todas las tablas en la base de datos al arrancar
Base.metadata.create_all(bind=engine)
ensure_user_columns(engine)  # añade columnas nuevas a users si faltan
rename_muscle_groups(engine)  # Core -> Abdomen en ejercicios existentes

# Orígenes permitidos (CORS). Se pueden cambiar con CORS_ORIGINS="https://a.com,https://b.com"
_DEFAULT_ORIGINS = [
    "https://red-de-vida-web.onrender.com",
    "http://localhost:8081",
    "http://localhost:19006",
]
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()] or _DEFAULT_ORIGINS
_docs = os.getenv("DISABLE_DOCS") != "1"

app = FastAPI(
    title="Gym API",
    description="""
## API REST para gestión de entrenamientos

Gestiona usuarios, ejercicios y rutinas de gimnasio.

### Funcionalidades:
- **Usuarios**: Crear y consultar usuarios
- **Ejercicios**: Catálogo de ejercicios por grupo muscular
- **Rutinas**: Crear rutinas y asignarles ejercicios
    """,
    version="1.0.0",
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,  # la sesión va en la cabecera Authorization, no en cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra los routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(routines.router)
app.include_router(assignments.router)
app.include_router(activities.router)
app.include_router(forms.router)
app.include_router(tracking.router)


@app.get("/", tags=["Home"])
def home():
    return {
        "msg": "Gym API funcionando",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health", tags=["Home"])
def health():
    """Comprobación ligera para un monitor externo (UptimeRobot): mantiene
    despierto el servidor y la base de datos."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    return {"status": "ok"}
