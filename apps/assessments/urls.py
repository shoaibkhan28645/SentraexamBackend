from rest_framework.routers import DefaultRouter

from .views import AssessmentSubmissionViewSet, AssessmentViewSet

router = DefaultRouter()
router.register("submissions", AssessmentSubmissionViewSet, basename="assessment-submissions")
router.register("", AssessmentViewSet, basename="assessments")

urlpatterns = router.urls
