"""Límite de intentos en memoria (sin dependencias nuevas).

Vale para un único proceso (Render gratis ejecuta uno). Si algún día hay varias
instancias, habría que moverlo a Redis o a la base de datos.
"""
import logging
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_lock = threading.Lock()
_hits: dict[str, deque] = defaultdict(deque)
_MAX_KEYS = 20000  # tope de claves para que la memoria no crezca sin límite


log = logging.getLogger("ratelimit")

# Render tiene delante Cloudflare, que escribe la IP real del cliente en estas cabeceras y
# sobrescribe lo que mande el cliente. X-Forwarded-For NO sirve: el cliente puede inventarse
# el primer valor y Render solo añade el suyo al final.
_IP_HEADERS = ("cf-connecting-ip", "true-client-ip")
_source_logged = False


def _note_source(source: str) -> None:
    """Deja una línea en los logs (una vez por arranque) diciendo de dónde se saca la IP."""
    global _source_logged
    if not _source_logged:
        _source_logged = True
        log.warning("Límite de intentos: la IP del cliente se lee de %s", source)


def client_ip(request: Request) -> str:
    for header in _IP_HEADERS:
        value = request.headers.get(header)
        if value:
            _note_source(header)
            return value.strip()
    # Sin Cloudflare delante (desarrollo local): se usa X-Forwarded-For como antes
    xff = request.headers.get("x-forwarded-for")
    if xff:
        _note_source("x-forwarded-for (no fiable: revisa que Cloudflare mande CF-Connecting-IP)")
        return xff.split(",")[0].strip()
    _note_source("la conexión directa")
    return request.client.host if request.client else "unknown"


def _prune(q: deque, window: int, now: float) -> None:
    while q and now - q[0] > window:
        q.popleft()


def _too_many(q: deque, window: int, now: float) -> HTTPException:
    wait = max(1, int(window - (now - q[0])))
    minutes = max(1, -(-wait // 60))
    return HTTPException(
        status_code=429,
        detail=f"Demasiados intentos. Inténtalo de nuevo en {minutes} min.",
        headers={"Retry-After": str(wait)},
    )


def hit(key: str, limit: int, window: int) -> None:
    """Registra un intento y lanza 429 si se supera `limit` dentro de `window` segundos."""
    now = time.monotonic()
    with _lock:
        if len(_hits) > _MAX_KEYS:
            for k in [k for k, q in _hits.items() if not q or now - q[-1] > 3600]:
                del _hits[k]
        q = _hits[key]
        _prune(q, window, now)
        if len(q) >= limit:
            raise _too_many(q, window, now)
        q.append(now)


def blocked(key: str, limit: int, window: int) -> None:
    """Lanza 429 si `key` ya acumula `limit` intentos (sin registrar uno nuevo)."""
    now = time.monotonic()
    with _lock:
        q = _hits.get(key)
        if q is None:
            return
        _prune(q, window, now)
        if len(q) >= limit:
            raise _too_many(q, window, now)


def fail(key: str, window: int) -> None:
    """Anota un fallo (por ejemplo, una contraseña incorrecta) para `key`."""
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        _prune(q, window, now)
        q.append(now)


def reset(key: str) -> None:
    with _lock:
        _hits.pop(key, None)


def clear_all() -> None:  # para los tests
    with _lock:
        _hits.clear()
