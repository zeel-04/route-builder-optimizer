from rest_framework import serializers


class ProjectOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    customer_count = serializers.IntegerField()
    route_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class ProjectCreateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)


class ProjectListFilterSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, default="")
