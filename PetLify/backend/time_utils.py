"""Explicit time contracts for the MVP's existing naive SQLite columns.

Purchase/subscription/audit instants are UTC; agenda/vaccine wall times are
America/Sao_Paulo. Convert at the boundaries, without rewriting legacy values.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

SHOP_TIMEZONE = 'America/Sao_Paulo'
SHOP_ZONE = ZoneInfo(SHOP_TIMEZONE)


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def utc_to_local(value):
    aware = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    return aware.astimezone(SHOP_ZONE).replace(tzinfo=None)


def local_to_utc(value):
    aware = value.replace(tzinfo=SHOP_ZONE) if value.tzinfo is None else value
    return aware.astimezone(timezone.utc).replace(tzinfo=None)


def local_now():
    return utc_to_local(utc_now())


def utc_iso(value):
    aware = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    return aware.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def local_iso(value):
    aware = value.replace(tzinfo=SHOP_ZONE) if value.tzinfo is None else value
    return aware.astimezone(SHOP_ZONE).isoformat()


def parse_local_datetime(value, field_name):
    if not value:
        raise ValueError(f'{field_name} é obrigatório')
    try:
        parsed = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        # A datetime-local input is a shop wall time. An offset denotes an instant.
        return utc_to_local(parsed) if parsed.tzinfo is not None else parsed
    except ValueError as exc:
        raise ValueError(f'{field_name} deve estar em formato ISO-8601') from exc
