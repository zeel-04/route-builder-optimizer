from rest_framework.routers import SimpleRouter

from api.routes.views.route_view import RouteViewSet

router = SimpleRouter()
router.register("routes", RouteViewSet, basename="routes")
urlpatterns = router.urls
