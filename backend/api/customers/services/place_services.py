from django.conf import settings
from django.utils.module_loading import import_string
from loguru import logger

from api.customers.geocoders import Geocoder
from api.customers.schema import PlaceResult


class PlaceSearchService:
    """Geocodes a free-text place search for the explore map. No DB access."""

    def __init__(self, geocoder: Geocoder | None = None):
        self._geocoder = geocoder or import_string(settings.GEOCODER_CLASS)()

    def execute(self, *, state: str, county: str, city: str, address: str) -> PlaceResult | None:
        result = self._geocoder.search_place(
            state=state, county=county, city=city, street=address
        )
        logger.info("place search", matched=result is not None, state=state, city=city)
        return result
