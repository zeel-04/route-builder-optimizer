from rest_framework import serializers

from api.customers.serializers.customer_serializers import CustomerListOutputSerializer


class CreatedByOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    email = serializers.EmailField()


class RouteListFilterSerializer(serializers.Serializer):
    project = serializers.UUIDField()


class RouteListOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    name = serializers.CharField()
    color = serializers.CharField()
    stop_count = serializers.IntegerField()
    created_by = CreatedByOutputSerializer(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class StopCustomerOutputSerializer(CustomerListOutputSerializer):
    """The customer list item, minus the `route` key — redundant here since
    every stop already belongs to this route."""

    route = None


class RouteStopOutputSerializer(serializers.Serializer):
    sequence = serializers.IntegerField()
    customer = serializers.SerializerMethodField()

    def get_customer(self, obj):
        return StopCustomerOutputSerializer(obj.customer).data


class RouteDetailOutputSerializer(RouteListOutputSerializer):
    stops = RouteStopOutputSerializer(many=True)


class RouteWriteInputSerializer(serializers.Serializer):
    project = serializers.UUIDField()
    name = serializers.CharField(max_length=255)
    color = serializers.RegexField(r"^#[0-9A-Fa-f]{6}$")
    customer_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, allow_empty=False
    )


class RouteUpdateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    color = serializers.RegexField(r"^#[0-9A-Fa-f]{6}$", required=False)
    customer_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, allow_empty=False, required=False
    )
