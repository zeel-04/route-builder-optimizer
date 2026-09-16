from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from api.customers.serializers.place_serializers import (
    PlaceSearchFilterSerializer,
    PlaceSearchOutputSerializer,
)
from api.customers.services.place_services import PlaceSearchService


class PlaceViewSet(ViewSet):
    @action(detail=False)
    def search(self, request):
        filters = PlaceSearchFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)

        place = PlaceSearchService().execute(**filters.validated_data)
        if place is None:
            raise NotFound("No place matches that search.")
        return Response(PlaceSearchOutputSerializer(place).data)
