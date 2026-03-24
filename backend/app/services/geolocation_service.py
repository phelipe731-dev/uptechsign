"""Approximate IP geolocation lookup for signature evidence."""

from __future__ import annotations

import ipaddress
import json
from dataclasses import dataclass
from urllib import request

from app.config import settings


@dataclass(slots=True)
class IpGeolocation:
    latitude: str | None
    longitude: str | None
    label: str | None
    source: str


def _is_public_ip(ip: str | None) -> bool:
    if not ip:
        return False
    try:
        return ipaddress.ip_address(ip).is_global
    except ValueError:
        return False


def lookup_ip_geolocation(ip: str | None) -> IpGeolocation | None:
    if not settings.IP_GEOLOCATION_ENABLED or not _is_public_ip(ip):
        return None

    endpoint = settings.IP_GEOLOCATION_ENDPOINT_TEMPLATE.format(ip=ip)
    req = request.Request(endpoint, headers={"User-Agent": "UptechSign/1.0"})

    try:
        with request.urlopen(req, timeout=settings.IP_GEOLOCATION_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

    if not payload.get("success", False):
        return None

    latitude = payload.get("latitude")
    longitude = payload.get("longitude")
    city = payload.get("city")
    region = payload.get("region")
    country = payload.get("country")

    label_parts = [part for part in [city, region, country] if part]
    label = ", ".join(label_parts) if label_parts else None

    return IpGeolocation(
        latitude=str(latitude) if latitude is not None else None,
        longitude=str(longitude) if longitude is not None else None,
        label=label,
        source="ipwho.is",
    )
