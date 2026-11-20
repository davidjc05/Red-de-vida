"""Límite de intentos en memoria (sin dependencias nuevas).

Vale para un único proceso (Render gratis ejecuta uno). Si algún día hay varias
instancias, habría que moverlo a Redis o a la base de datos.
"""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_lock = threading.Lock()
_hits: dict[str, deque] = defaultdict(deque)
_MAX_KEYS = 20000  # tope de claves para que la memoria no crezca sin límite


def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
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
