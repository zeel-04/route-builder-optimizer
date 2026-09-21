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
    is_geocode_pending = serializers.SerializerMethodField()
    route = serializers.SerializerMethodField()

    def get_is_geocode_pending(self, obj):
        # Not looked up yet. An address that was tried and not found has no
        # pin either, but nothing is still working on it.
        return obj.latitude is None and obj.geocode_attempted_at is None

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


class CustomerCreateInputSerializer(serializers.Serializer):
    customer_code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=255)
    address = serializers.CharField(max_length=255)
    address2 = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    state = serializers.CharField(min_length=2, max_length=2)
    zipcode = serializers.CharField(max_length=10)


class ProjectCustomerListFilterSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, default="")


class CustomerUpdateInputSerializer(serializers.Serializer):
    customer_code = serializers.CharField(max_length=50, required=False)
    name = serializers.CharField(max_length=255, required=False)
    address = serializers.CharField(max_length=255, required=False)
    address2 = serializers.CharField(max_length=255, required=False, allow_blank=True)
    state = serializers.CharField(min_length=2, max_length=2, required=False)
    zipcode = serializers.CharField(max_length=10, required=False)


class CustomerImportInputSerializer(serializers.Serializer):
    file = serializers.FileField()


class CustomerImportOutputSerializer(serializers.Serializer):
    created = serializers.IntegerField()
    updated = serializers.IntegerField()
    total = serializers.IntegerField()
