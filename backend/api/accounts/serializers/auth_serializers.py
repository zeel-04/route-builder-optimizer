from rest_framework import serializers


class TenantOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class UserOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    name = serializers.CharField()
    tenant = TenantOutputSerializer()


class AuthLoginInputSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class AuthLoginOutputSerializer(serializers.Serializer):
    token = serializers.CharField()
    user = UserOutputSerializer()
