"""Fechas y horas de la app.

* utcnow(): hora UTC sin zona, que es como se guardan las columnas DateTime.
  Sustituye a datetime.utcnow(), que Python ha marcado como obsoleto.
* today_es(): el día de hoy en España. El servidor de Render va en UTC, así que entre las
  00:00 y la 01:00/02:00 en España date.today() todavía devolvería el día anterior.
"""
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

_TZ = ZoneInfo("Europe/Madrid")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def today_es() -> date:
    return datetime.now(_TZ).date()
