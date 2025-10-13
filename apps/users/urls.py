from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import ActivationTokenViewSet, UserViewSet

router = DefaultRouter()
router.register("accounts", UserViewSet, basename="accounts")
router.register("activation-tokens", ActivationTokenViewSet, basename="activation-tokens")

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

urlpatterns += router.urls
