import re
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
        """Free-text structured search (street/city/county/state/postalcode), best match only."""
        raise NotImplementedError


def _first_present(address: dict, *keys: str) -> str:
    for key in keys:
        if address.get(key):
            return address[key]
    return ""


# Nominatim's street lookup misses when a suite/unit trails the street ("6325
# Washington Blvd ste e"), and the pin falls back to the ZIP code. The leading
# Only a trailing keyword + unit value (a number, or one letter) is dropped, so
# street names keep their words: "12 Floor Ave", "2300 Route #9 North".
_UNIT_VALUE = r"(?:[a-z]?-?\d[\w-]*|[a-z])"
_UNIT_SUFFIX = re.compile(
    r"(?:[\s,]+(?:(?:ste|suite|unit|apt|apartment|bldg|building|floor|fl|rm|room)\.?\s*#?\s*|#\s*)"
    + _UNIT_VALUE
    + r")+\s*$",
    re.IGNORECASE,
)


def _street_only(street: str) -> str:
    return _UNIT_SUFFIX.sub("", street).strip() or street


def _strip_county_suffix(county: str) -> str:
    return county.removesuffix(" County")


class CensusGeocoder(Geocoder):
    """US Census Bureau geocoder — free, no key, US street addresses only.

    It knows rural roads OpenStreetMap lacks and ignores suite/unit suffixes,
    but places the pin by house-number range along the street, so it can be a
    few doors off. That makes it the fallback, not the first choice.
    """

    URL = "https://geocoding.geo.census.gov/geocoder/geographies/address"

    def geocode(self, query: AddressQuery) -> GeocodeResult | None:
        params = {
            "street": query.street,
            "zip": query.zipcode,
            "state": query.state,
            "benchmark": "Public_AR_Current",
            "vintage": "Current_Current",
            "layers": "Counties",
            "format": "json",
        }
        # One bad response must not raise: the geocode run has no per-customer
        # guard, so an exception here would abandon every customer after this one.
        try:
            response = httpx.get(self.URL, params=params, timeout=15)
            response.raise_for_status()
            matches = response.json()["result"]["addressMatches"]
            if not matches or matches[0]["addressComponents"]["state"] != query.state:
                return None
            match = matches[0]
            counties = match.get("geographies", {}).get("Counties") or [{}]
            return GeocodeResult(
                latitude=float(match["coordinates"]["y"]),
                longitude=float(match["coordinates"]["x"]),
                accuracy="street",
                city=match["addressComponents"].get("city", "").title(),
                # NAME ("Mason County"), cut the same way as Nominatim's, so one
                # county never shows up under two spellings in the filters.
                county=_strip_county_suffix(counties[0].get("NAME", "")),
            )
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            logger.warning("census lookup failed", error=str(exc), params=params)
            return None


class NominatimGeocoder(Geocoder):
    """Nominatim (OpenStreetMap) — free, but allows only 1 request/second.

    The throttle and the User-Agent requirement are this provider's own
    limits, owned entirely inside this class per the plan's Liskov note.

    A street it can't find goes to CensusGeocoder before settling for the ZIP.
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
        return (
            self._lookup_street(query)
            or CensusGeocoder().geocode(query)
            or self._lookup_zip(query)
        )

    def search_place(self, **parts: str) -> PlaceResult | None:
        params = {"format": "jsonv2", "addressdetails": 1, "limit": 1, "countrycodes": "us"}
        state = ""
        if parts.get("postalcode") and not parts.get("street"):
            # Same quirk as _lookup_zip: a postcode with state/county/city but
            # no street returns [] (or the city, ignoring the ZIP). The ZIP
            # goes alone and the state is checked on the result instead.
            state = parts.get("state", "")
            parts = {"postalcode": parts["postalcode"]}
        params.update({key: value for key, value in parts.items() if value})
        if "street" in params:
            params["street"] = _street_only(params["street"])
        data = self._request(params)
        if not data:
            return None
        address = data[0].get("address", {})
        if state and state.lower() not in (
            address.get("state", "").lower(),
            address.get("ISO3166-2-lvl4", "").removeprefix("US-").lower(),
        ):
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
            "street": _street_only(query.street),
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
