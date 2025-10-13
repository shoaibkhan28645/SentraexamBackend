from __future__ import annotations

from django.db.models import Q, QuerySet
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.models import User
from apps.users.permissions import IsAdminOrHOD
from .models import AcademicTerm, AcademicYear, CalendarEvent, TimetableEntry
from .serializers import (
    AcademicTermSerializer,
    AcademicYearSerializer,
    CalendarEventSerializer,
    TimetableEntrySerializer,
)


class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAuthenticated, IsAdminOrHOD]
    ordering = ("-start_date",)

    @action(detail=True, methods=["post"])
    def activate(self, request, *args, **kwargs):
        academic_year = self.get_object()
        academic_year.activate()
        return Response(self.get_serializer(academic_year).data, status=status.HTTP_200_OK)


class AcademicTermViewSet(viewsets.ModelViewSet):
    queryset = AcademicTerm.objects.select_related("academic_year")
    serializer_class = AcademicTermSerializer
    permission_classes = [IsAuthenticated, IsAdminOrHOD]
    filterset_fields = ("academic_year", "is_active")

    @action(detail=True, methods=["post"])
    def activate(self, request, *args, **kwargs):
        term = self.get_object()
        term.activate()
        return Response(self.get_serializer(term).data, status=status.HTTP_200_OK)


class CalendarEventViewSet(viewsets.ModelViewSet):
    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("academic_term", "department", "course", "event_type")

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        return [IsAuthenticated()]

    def get_queryset(self) -> QuerySet[CalendarEvent]:
        user = self.request.user
        qs = CalendarEvent.objects.select_related("academic_term", "department", "course")
        if user.role == User.Role.ADMIN:
            return qs.distinct()
        if user.role == User.Role.HOD and user.department_id:
            return qs.filter(
                Q(department_id=user.department_id) | Q(department__isnull=True)
            ).distinct()
        if user.role == User.Role.TEACHER:
            return qs.filter(
                Q(course__assigned_teacher=user)
                | Q(department_id=user.department_id)
                | Q(department__isnull=True)
            ).distinct()
        if user.role == User.Role.STUDENT:
            return qs.filter(
                Q(course__enrollments__student=user)
                | Q(department_id=user.department_id)
                | Q(department__isnull=True)
            ).distinct()
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class TimetableEntryViewSet(viewsets.ModelViewSet):
    serializer_class = TimetableEntrySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("academic_term", "course", "teacher", "entry_type")

    def get_queryset(self) -> QuerySet[TimetableEntry]:
        user = self.request.user
        qs = TimetableEntry.objects.select_related("academic_term", "course", "teacher")
        if user.role == User.Role.ADMIN:
            return qs.distinct()
        if user.role == User.Role.HOD and user.department_id:
            return qs.filter(course__department_id=user.department_id).distinct()
        if user.role == User.Role.TEACHER:
            return qs.filter(
                Q(teacher=user) | Q(course__department_id=user.department_id)
            ).distinct()
        if user.role == User.Role.STUDENT:
            return qs.filter(course__enrollments__student=user).distinct()
        return qs.none()

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
