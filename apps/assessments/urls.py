from rest_framework.routers import DefaultRouter

from .views import AssessmentSubmissionViewSet, AssessmentViewSet

router = DefaultRouter()
router.register("", AssessmentViewSet, basename="assessments")
router.register("submissions", AssessmentSubmissionViewSet, basename="assessment-submissions")

urlpatterns = router.urls
