"""Envío de correos por API web (Brevo). Render free bloquea SMTP, por eso no se usa smtplib.

Variables de entorno:
  BREVO_API_KEY  clave de API de Brevo
  MAIL_FROM      remitente verificado en Brevo (ej. tu_correo@gmail.com)
  MAIL_FROM_NAME nombre visible (opcional, por defecto "Red de Vida")
Si faltan, el envío queda desactivado (desarrollo local): no se exige verificar el email.
"""
import json
import os
import urllib.error
import urllib.request

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def email_enabled() -> bool:
    return bool(os.getenv("BREVO_API_KEY") and os.getenv("MAIL_FROM"))


def send_email(to: str, subject: str, text: str) -> None:
    payload = {
        "sender": {
            "name": os.getenv("MAIL_FROM_NAME", "Red de Vida"),
            "email": os.environ["MAIL_FROM"],
        },
        "to": [{"email": to}],
        "subject": subject,
        "textContent": text,
    }
    req = urllib.request.Request(
        BREVO_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key": os.environ["BREVO_API_KEY"],
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Brevo respondió {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"No se pudo contactar con Brevo: {e.reason}")
