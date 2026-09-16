import time
from abc import ABC, abstractmethod

import httpx
from django.conf import settings
from loguru import logger

from api.customers.schema import AddressQuery, GeocodeResult, PlaceResult


class Geocoder(ABC):
    """Common interface every address-lookup provider implements.

    Any provider can replace another without touching the calling code
    (Liskov substitution) — swap GEOCODER_CLASS and add nothing else.
    """

    @abstractmethod
    def geocode(self, query: AddressQuery) -> GeocodeResult | None: ...

    def search_place(self, **parts: str) -> PlaceResult | None:
        """Free-text structured search (street/city/county/state), best match only."""
        raise NotImplementedError


def _first_present(address: dict, *keys: str) -> str:
    for key in keys:
        if address.get(key):
            return address[key]
    return ""


def _strip_county_suffix(county: str) -> str:
    return county.removesuffix(" County")


class NominatimGeocoder(Geocoder):
    """Nominatim (OpenStreetMap) — free, but allows only 1 request/second.

    The throttle and the User-Agent requirement are this provider's own
    limits, owned entirely inside this class per the plan's Liskov note.
    """

    MIN_INTERVAL_SECONDS = 1.0
    MAX_ATTEMPTS = 3

    def __init__(self):
        self._base_url = settings.NOMINATIM_URL
        self._headers = {
            "User-Agent": settings.NOMINATIM_USER_AGENT,
            "Accept": "application/json",
        }
        self._last_request_at = 0.0

    def geocode(self, query: AddressQuery) -> GeocodeResult | None:
        result = self._lookup_street(query)
        if result is not None:
            return result
        return self._lookup_zip(query)

    def search_place(self, **parts: str) -> PlaceResult | None:
        params = {"format": "jsonv2", "limit": 1, "countrycodes": "us"}
        params.update({key: value for key, value in parts.items() if value})
        data = self._request(params)
        if not data:
            return None
        return PlaceResult(
            latitude=float(data[0]["lat"]),
            longitude=float(data[0]["lon"]),
            label=data[0].get("display_name", ""),
        )

    def _lookup_street(self, query: AddressQuery) -> GeocodeResult | None:
        params = {
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 1,
            "countrycodes": "us",
            "street": query.street,
            "postalcode": query.zipcode,
        }
        return self._search(params, query.state, accuracy="street")

    def _lookup_zip(self, query: AddressQuery) -> GeocodeResult | None:
        # Note: adding state= here makes Nominatim return [] for a
        # postcode-only query — country=us alone is the working form.
        params = {
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 1,
            "postalcode": query.zipcode,
            "country": "us",
        }
        return self._search(params, query.state, accuracy="zip")

    def _search(self, params: dict, state: str, *, accuracy: str) -> GeocodeResult | None:
        data = self._request(params)
        if not data:
            return None
        address = data[0].get("address", {})
        if address.get("ISO3166-2-lvl4") != f"US-{state}":
            return None
        return GeocodeResult(
            latitude=float(data[0]["lat"]),
            longitude=float(data[0]["lon"]),
            accuracy=accuracy,
            city=_first_present(address, "city", "town", "village", "hamlet", "suburb"),
            county=_strip_county_suffix(address.get("county", "")),
        )

    def _request(self, params: dict) -> list | None:
        self._throttle()
        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            try:
                response = httpx.get(
                    f"{self._base_url}/search", params=params, headers=self._headers, timeout=10
                )
                if response.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        "server error", request=response.request, response=response
                    )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as exc:
                logger.warning(
                    "nominatim request failed", attempt=attempt, error=str(exc), params=params
                )
                if attempt < self.MAX_ATTEMPTS:
                    time.sleep(2**attempt)
        return None

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.MIN_INTERVAL_SECONDS:
            time.sleep(self.MIN_INTERVAL_SECONDS - elapsed)
        self._last_request_at = time.monotonic()
