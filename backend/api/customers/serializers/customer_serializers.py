from rest_framework import serializers


class RouteRefOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    color = serializers.CharField()


class CustomerListOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    customer_code = serializers.CharField()
    name = serializers.CharField()
    address = serializers.CharField()
    address2 = serializers.CharField()
    city = serializers.CharField()
    county = serializers.CharField()
    state = serializers.CharField()
    zipcode = serializers.CharField()
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, allow_null=True, coerce_to_string=False
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, allow_null=True, coerce_to_string=False
    )
    location_accuracy = serializers.CharField()
    route = serializers.SerializerMethodField()

    def get_route(self, obj):
        stop = getattr(obj, "route_stop", None)
        if stop is None:
            return None
        return RouteRefOutputSerializer(stop.route).data


class CustomerListFilterSerializer(serializers.Serializer):
    project = serializers.UUIDField()
    state = serializers.CharField(required=False, allow_blank=True, default="")
    county = serializers.CharField(required=False, allow_blank=True, default="")
    city = serializers.CharField(required=False, allow_blank=True, default="")
    search = serializers.CharField(required=False, allow_blank=True, default="")


class CustomerFilterOptionsFilterSerializer(serializers.Serializer):
    project = serializers.UUIDField()
    state = serializers.CharField(required=False, allow_blank=True, default="")
    county = serializers.CharField(required=False, allow_blank=True, default="")


class CustomerFilterOptionsOutputSerializer(serializers.Serializer):
    states = serializers.ListField(child=serializers.CharField())
    counties = serializers.ListField(child=serializers.CharField())
    cities = serializers.ListField(child=serializers.CharField())
