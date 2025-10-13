from rest_framework.routers import DefaultRouter

from .views import CourseEnrollmentViewSet, CourseViewSet

router = DefaultRouter()
router.register("", CourseViewSet, basename="courses")
router.register("enrollments", CourseEnrollmentViewSet, basename="course-enrollments")

urlpatterns = router.urls
