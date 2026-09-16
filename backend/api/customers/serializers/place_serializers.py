from rest_framework import serializers


class PlaceSearchFilterSerializer(serializers.Serializer):
    state = serializers.CharField(required=False, allow_blank=True, default="")
    county = serializers.CharField(required=False, allow_blank=True, default="")
    city = serializers.CharField(required=False, allow_blank=True, default="")
    address = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not any(attrs.values()):
            raise serializers.ValidationError(
                "Provide at least one of state, county, city, address."
            )
        return attrs


class PlaceSearchOutputSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    label = serializers.CharField()
