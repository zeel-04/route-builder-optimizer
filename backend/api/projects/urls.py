from rest_framework.routers import SimpleRouter

from api.projects.views.project_view import ProjectViewSet

router = SimpleRouter()
router.register("projects", ProjectViewSet, basename="projects")
urlpatterns = router.urls
