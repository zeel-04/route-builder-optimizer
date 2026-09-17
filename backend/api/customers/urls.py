from rest_framework.routers import SimpleRouter

from api.customers.views.customer_view import CustomerViewSet, ProjectCustomerViewSet
from api.customers.views.place_view import PlaceViewSet

router = SimpleRouter()
router.register("customers", CustomerViewSet, basename="customers")
router.register(
    r"projects/(?P<project_pk>[0-9a-fA-F-]{36})/customers",
    ProjectCustomerViewSet,
    basename="project-customers",
)
router.register("places", PlaceViewSet, basename="places")
urlpatterns = router.urls
