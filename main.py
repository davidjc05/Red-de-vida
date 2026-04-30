from fastapi import FastAPI
from database import engine, Base
from routes import assignments, users, exercises, routines, auth
from fastapi.middleware.cors import CORSMiddleware
from routes import routines
# Crea todas las tablas en la base de datos al arrancar
Base.metadata.create_all(bind=engine)

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
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra los routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(routines.router)
app.include_router(assignments.router)


@app.get("/", tags=["Home"])
def home():
    return {
        "msg": "Gym API funcionando",
        "docs": "/docs",
        "version": "1.0.0"
    }
