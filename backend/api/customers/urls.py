from rest_framework.routers import SimpleRouter

from api.customers.views.customer_view import CustomerViewSet
from api.customers.views.place_view import PlaceViewSet

router = SimpleRouter()
router.register("customers", CustomerViewSet, basename="customers")
router.register("places", PlaceViewSet, basename="places")
urlpatterns = router.urls
