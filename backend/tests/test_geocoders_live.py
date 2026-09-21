"""Calls the real Nominatim and Census APIs. Skipped by default; run before a
deploy with `uv run pytest -m live`.

If one of these fails while the unit tests pass, the provider changed its
response and production is quietly dropping pins to the ZIP code.
"""

import pytest

from api.customers.geocoders import CensusGeocoder, NominatimGeocoder
from api.customers.schema import AddressQuery

pytestmark = pytest.mark.live

# conftest swaps search_place for a fake on every test; this is the real one.
_REAL_SEARCH_PLACE = NominatimGeocoder.search_place

SUITE = AddressQuery(street="6325 Washington Blvd ste e", zipcode="21075", state="MD")
# Not in OpenStreetMap, so only Census finds it.
RURAL = AddressQuery(street="1042 Adamsville Rd", zipcode="25260", state="WV")


@pytest.fixture
def nominatim(monkeypatch):
    monkeypatch.setattr(NominatimGeocoder, "search_place", _REAL_SEARCH_PLACE)
    return NominatimGeocoder()


def test_nominatim_finds_a_street_address_with_a_suite(nominatim):
    result = nominatim._lookup_street(SUITE)

    assert result.accuracy == "street"
    assert (result.city, result.county) == ("Elkridge", "Howard")
    assert result.latitude == pytest.approx(39.205, abs=0.01)
    assert result.longitude == pytest.approx(-76.728, abs=0.01)


def test_census_finds_the_address_nominatim_lacks():
    result = CensusGeocoder().geocode(RURAL)

    assert result.accuracy == "street"
    assert (result.city, result.county) == ("Mason", "Mason")
    assert result.latitude == pytest.approx(39.026, abs=0.01)


def test_the_full_chain_reaches_census(nominatim):
    assert nominatim.geocode(RURAL).accuracy == "street"


def test_zip_only_place_search_honours_the_state(nominatim):
    parts = dict(county="", city="", street="", postalcode="21075")

    assert "Maryland" in nominatim.search_place(state="Maryland", **parts).label
    assert nominatim.search_place(state="New Jersey", **parts) is None
