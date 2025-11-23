from __future__ import annotations

from django.db import models
from django.db.models import QuerySet
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.models import User
from apps.users.permissions import IsAdmin, IsAdminHODOrTeacher, IsAdminOrHOD
from .models import Course, CourseEnrollment
from .serializers import (
    CourseApprovalSerializer,
    CourseCreateSerializer,
    CourseEnrollmentSerializer,
    CourseSerializer,
)


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.select_related("department", "assigned_teacher").all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, IsAdminHODOrTeacher]
    filterset_fields = ("department", "status", "assigned_teacher")
    search_fields = ("code", "title")
    ordering_fields = ("code", "title", "created_at")

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        if self.action == "approve":
            return [IsAuthenticated(), IsAdminOrHOD()]
        return [IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Course]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs.distinct()
        if user.role == User.Role.HOD:
            return qs.filter(department=user.department).distinct()
        if user.role == User.Role.TEACHER:
            return qs.filter(
                models.Q(assigned_teacher=user) | models.Q(status=Course.Status.ACTIVE)
            ).distinct()
        if user.role == User.Role.STUDENT:
            department_filter = models.Q()
            if user.department_id:
                department_filter = models.Q(
                    department_id=user.department_id, status=Course.Status.ACTIVE
                )
            else:
                department_filter = models.Q(status=Course.Status.ACTIVE)
            return qs.filter(
                models.Q(enrollments__student=user) | department_filter
            ).distinct()
        return qs.none().distinct()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return CourseCreateSerializer
        if self.action == "approve":
            return CourseApprovalSerializer
        return self.serializer_class

    @action(detail=True, methods=["post"])
    def approve(self, request, *args, **kwargs):
        course = self.get_object()
        serializer = self.get_serializer(course, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CourseSerializer(course, context={"request": request}).data)


class CourseEnrollmentViewSet(viewsets.ModelViewSet):
    queryset = CourseEnrollment.objects.select_related("course", "student", "created_by")
    serializer_class = CourseEnrollmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("course", "student", "status")
    search_fields = ("course__code", "student__email")

    def get_permissions(self):
        if self.action in {"create", "destroy"}:
            return [IsAuthenticated(), IsAdminHODOrTeacher()]
        if self.action in {"update", "partial_update"}:
            return [IsAuthenticated(), IsAdminHODOrTeacher()]
        return [IsAuthenticated()]

    def get_queryset(self) -> QuerySet[CourseEnrollment]:
        user = self.request.user
        qs = self.queryset
        if user.role in {User.Role.ADMIN, User.Role.HOD}:
            return qs
        if user.role == User.Role.TEACHER:
            return qs.filter(course__assigned_teacher=user)
        if user.role == User.Role.STUDENT:
            return qs.filter(student=user)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(created_by=user, updated_by=user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
