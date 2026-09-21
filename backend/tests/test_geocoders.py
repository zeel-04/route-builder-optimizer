"""Unit tests for the address-lookup providers. No network: Nominatim's
`_request` and Census's `httpx.get` are replaced with canned answers."""

import httpx
import pytest

from api.customers.geocoders import CensusGeocoder, NominatimGeocoder, _street_only
from api.customers.schema import AddressQuery, GeocodeResult

# conftest swaps search_place for a fake on every test; this is the real one.
_REAL_SEARCH_PLACE = NominatimGeocoder.search_place

QUERY = AddressQuery(street="6325 Washington Blvd ste e", zipcode="21075", state="MD")


def _nominatim_hit(state="MD", **extra):
    return [
        {
            "lat": "39.2054",
            "lon": "-76.7284",
            "display_name": "6325, Washington Boulevard, Elkridge",
            "address": {
                "town": "Elkridge",
                "county": "Howard County",
                "state": "Maryland",
                "ISO3166-2-lvl4": f"US-{state}",
                **extra,
            },
        }
    ]


CENSUS_MATCH = {
    "coordinates": {"x": -82.016156, "y": 39.025729},
    "addressComponents": {"city": "MASON", "state": "WV"},
    "geographies": {"Counties": [{"NAME": "Mason County"}]},
}
CENSUS_RESULT = GeocodeResult(39.025729, -82.016156, "street", "Mason", "Mason")


@pytest.fixture
def nominatim(monkeypatch):
    """A NominatimGeocoder whose HTTP layer answers from `geocoder.answers`
    (one per request, in order) and records the params it was sent."""
    geocoder = NominatimGeocoder()
    geocoder.answers, geocoder.sent = [], []

    def fake_request(params):
        geocoder.sent.append(params)
        return geocoder.answers.pop(0)

    monkeypatch.setattr(geocoder, "_request", fake_request)
    monkeypatch.setattr(NominatimGeocoder, "search_place", _REAL_SEARCH_PLACE)
    return geocoder


@pytest.fixture
def census(monkeypatch):
    """Sets what CensusGeocoder.geocode returns and counts its calls."""
    calls = []

    def answer(result):
        monkeypatch.setattr(
            CensusGeocoder, "geocode", lambda self, query: calls.append(query) or result
        )
        return calls

    return answer


@pytest.mark.parametrize(
    ("street", "expected"),
    [
        ("6325 Washington Blvd ste e", "6325 Washington Blvd"),
        ("41-05 Bell Blvd #4105", "41-05 Bell Blvd"),
        ("229 S Bridge St, Unit C", "229 S Bridge St"),
        ("3905 Hixson Pike Suite 117", "3905 Hixson Pike"),
        ("77 Oak Ave Apt 3B", "77 Oak Ave"),
        ("77 Oak Ave Ste. 5", "77 Oak Ave"),
        ("100 Main St Suite 100, Bldg 2", "100 Main St"),
        ("1042 Adamsville Rd", "1042 Adamsville Rd"),
        ("1037 W US Hwy 90", "1037 W US Hwy 90"),  # a trailing number alone is not a unit
        ("12 Flower St", "12 Flower St"),  # "fl" only as a whole word
        ("12 Floor Ave", "12 Floor Ave"),  # a street word, not a unit
        ("2300 Route #9 North", "2300 Route #9 North"),
        ("Unit 5", "Unit 5"),  # never strips down to nothing
        ("", ""),
    ],
)
def test_street_only_drops_unit_suffix(street, expected):
    assert _street_only(street) == expected


# --- NominatimGeocoder.geocode: street -> Census -> ZIP ---------------------


def test_street_hit_is_used_and_nothing_else_is_asked(nominatim, census):
    nominatim.answers = [_nominatim_hit()]
    census_calls = census(CENSUS_RESULT)

    result = nominatim.geocode(QUERY)

    assert result == GeocodeResult(39.2054, -76.7284, "street", "Elkridge", "Howard")
    assert len(nominatim.sent) == 1
    assert census_calls == []


def test_street_lookup_sends_the_address_without_its_unit(nominatim, census):
    nominatim.answers = [_nominatim_hit()]
    census(None)

    nominatim.geocode(QUERY)

    assert nominatim.sent[0]["street"] == "6325 Washington Blvd"
    assert nominatim.sent[0]["postalcode"] == "21075"


def test_street_miss_falls_back_to_census_before_the_zip(nominatim, census):
    nominatim.answers = [[]]
    census_calls = census(CENSUS_RESULT)

    assert nominatim.geocode(QUERY) == CENSUS_RESULT
    assert census_calls == [QUERY]  # Census gets the address as written
    assert len(nominatim.sent) == 1  # the ZIP was never looked up


def test_street_and_census_miss_settles_for_the_zip(nominatim, census):
    nominatim.answers = [[], _nominatim_hit()]
    census(None)

    result = nominatim.geocode(QUERY)

    assert result.accuracy == "zip"
    assert "street" not in nominatim.sent[1]
    assert nominatim.sent[1]["postalcode"] == "21075"


def test_everything_missing_is_none(nominatim, census):
    nominatim.answers = [[], None]  # None = the request itself failed
    census(None)

    assert nominatim.geocode(QUERY) is None


def test_a_match_in_another_state_is_rejected(nominatim, census):
    nominatim.answers = [_nominatim_hit(state="VA"), _nominatim_hit(state="VA")]
    census(None)

    assert nominatim.geocode(QUERY) is None


# --- NominatimGeocoder.search_place (explore map) ---------------------------


def test_place_search_keeps_every_part_when_there_is_a_street(nominatim):
    nominatim.answers = [_nominatim_hit()]

    place = nominatim.search_place(
        state="Maryland", county="", city="Elkridge", street="6325 Washington Blvd ste e",
        postalcode="21075",
    )

    assert place.label == "6325, Washington Boulevard, Elkridge"
    sent = nominatim.sent[0]
    assert sent["street"] == "6325 Washington Blvd"
    assert (sent["state"], sent["city"], sent["postalcode"]) == ("Maryland", "Elkridge", "21075")
    assert "county" not in sent  # blanks are left out


def test_zip_only_place_search_sends_the_zip_alone(nominatim):
    nominatim.answers = [_nominatim_hit()]

    nominatim.search_place(state="Maryland", county="Howard", city="Elkridge", street="", postalcode="21075")

    sent = nominatim.sent[0]
    assert sent["postalcode"] == "21075"
    assert not {"state", "county", "city", "street"} & sent.keys()


@pytest.mark.parametrize(
    ("state", "found"),
    [("Maryland", True), ("maryland", True), ("MD", True), ("", True), ("New Jersey", False), ("NJ", False)],
)
def test_zip_only_place_search_still_honours_the_state(nominatim, state, found):
    nominatim.answers = [_nominatim_hit()]

    place = nominatim.search_place(state=state, county="", city="", street="", postalcode="21075")

    assert (place is not None) == found


def test_place_search_with_no_match_is_none(nominatim):
    nominatim.answers = [[]]

    assert nominatim.search_place(state="", county="", city="Nowhere", street="", postalcode="") is None


# --- CensusGeocoder ----------------------------------------------------------


class _Response:
    def __init__(self, body):
        self._body = body

    def raise_for_status(self): ...

    def json(self):
        return self._body


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ({"result": {"addressMatches": [CENSUS_MATCH]}}, CENSUS_RESULT),
        ({"result": {"addressMatches": []}}, None),
        # wrong state
        ({"result": {"addressMatches": [{**CENSUS_MATCH, "addressComponents": {"state": "OH"}}]}}, None),
        # no county layer in the answer: still a pin, just no county
        (
            {"result": {"addressMatches": [{**CENSUS_MATCH, "geographies": {}}]}},
            GeocodeResult(39.025729, -82.016156, "street", "Mason", ""),
        ),
        # malformed bodies must not raise — an exception would abandon the whole run
        ({"result": {"addressMatches": [{"coordinates": None}]}}, None),
        ({"result": None}, None),
        ({}, None),
    ],
)
def test_census_reads_the_first_match(monkeypatch, body, expected):
    monkeypatch.setattr("api.customers.geocoders.httpx.get", lambda *a, **kw: _Response(body))
    query = AddressQuery(street="1042 Adamsville Rd", zipcode="25260", state="WV")

    assert CensusGeocoder().geocode(query) == expected


def test_census_network_failure_is_none(monkeypatch):
    def boom(*args, **kwargs):
        raise httpx.ConnectTimeout("census is down")

    monkeypatch.setattr("api.customers.geocoders.httpx.get", boom)

    assert CensusGeocoder().geocode(QUERY) is None


def test_census_is_asked_for_the_address_and_its_county(monkeypatch):
    sent = {}

    def fake_get(url, params, **kwargs):
        sent.update(params, url=url)
        return _Response({"result": {"addressMatches": []}})

    monkeypatch.setattr("api.customers.geocoders.httpx.get", fake_get)
    CensusGeocoder().geocode(QUERY)

    assert sent["url"] == CensusGeocoder.URL
    assert (sent["street"], sent["zip"], sent["state"]) == (QUERY.street, "21075", "MD")
    assert sent["layers"] == "Counties"


# --- NominatimGeocoder._request: retry, backoff, throttle --------------------


class _Status(_Response):
    def __init__(self, status_code, body=None):
        super().__init__(body)
        self.status_code = status_code
        self.request = httpx.Request("GET", "https://nominatim.test/search")

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("bad status", request=self.request, response=self)


@pytest.fixture
def http(monkeypatch):
    """Queues Nominatim HTTP answers and records every sleep instead of taking it."""

    class Http:
        answers, calls, sleeps = [], 0, []

    def fake_get(*args, **kwargs):
        Http.calls += 1
        answer = Http.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer

    monkeypatch.setattr("api.customers.geocoders.httpx.get", fake_get)
    monkeypatch.setattr("api.customers.geocoders.time.sleep", Http.sleeps.append)
    return Http


def test_request_retries_a_server_error_with_backoff(http):
    http.answers = [_Status(503), httpx.ConnectTimeout("slow"), _Status(200, [{"lat": "1"}])]

    assert NominatimGeocoder()._request({}) == [{"lat": "1"}]
    assert http.calls == 3
    assert http.sleeps == [2, 4]


def test_request_gives_up_after_three_attempts(http):
    http.answers = [_Status(500), _Status(500), _Status(500)]

    assert NominatimGeocoder()._request({}) is None
    assert http.calls == 3
    assert http.sleeps == [2, 4]  # no pointless wait after the last attempt


def test_requests_are_spaced_a_second_apart(http, monkeypatch):
    """Nominatim bans clients that go faster than 1 request/second."""
    clock = iter([100.0, 100.0, 100.3, 101.0])  # each request reads the clock twice
    monkeypatch.setattr("api.customers.geocoders.time.monotonic", lambda: next(clock))
    http.answers = [_Status(200, []), _Status(200, [])]
    geocoder = NominatimGeocoder()

    geocoder._request({})
    geocoder._request({})  # 0.3s after the first

    assert http.sleeps == [pytest.approx(0.7)]
