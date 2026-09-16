from dataclasses import dataclass


@dataclass(slots=True)
class AddressQuery:
    street: str
    zipcode: str
    state: str


@dataclass(slots=True)
class GeocodeResult:
    latitude: float
    longitude: float
    accuracy: str  # "street" | "zip" — matches Customer.LocationAccuracy values
    city: str
    county: str


@dataclass(slots=True)
class PlaceResult:
    latitude: float
    longitude: float
    label: str
