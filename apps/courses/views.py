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
            # Teachers can only see ACTIVE courses (their assigned or any active)
            return qs.filter(
                models.Q(assigned_teacher=user, status=Course.Status.ACTIVE) | 
                models.Q(status=Course.Status.ACTIVE)
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
    queryset = CourseEnrollment.objects.select_related("course", "student", "created_by", "course__department")
    serializer_class = CourseEnrollmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("course", "student", "status")
    search_fields = ("course__code", "student__email")

    def get_permissions(self):
        if self.action == "create":
            # Allow students to request enrollment
            return [IsAuthenticated()]
        if self.action in {"approve", "reject"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdminHODOrTeacher()]
        return [IsAuthenticated()]

    def get_queryset(self) -> QuerySet[CourseEnrollment]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.HOD:
            # HOD sees enrollments for courses in their department
            return qs.filter(course__department=user.department)
        if user.role == User.Role.TEACHER:
            return qs.filter(course__assigned_teacher=user)
        if user.role == User.Role.STUDENT:
            return qs.filter(student=user)
        return qs.none()

    def perform_create(self, serializer):
        from apps.notifications.models import Notification
        
        user = self.request.user
        if user.role == User.Role.STUDENT:
            # Students can directly enroll in courses from their department
            enrollment = serializer.save(
                student=user,
                status=CourseEnrollment.EnrollmentStatus.ENROLLED,
                created_by=user,
                updated_by=user,
            )
            # Create notification for student
            Notification.objects.create(
                user=user,
                subject="Course Enrollment Successful",
                body=f"You have been successfully enrolled in '{enrollment.course.title}' ({enrollment.course.code}).",
                metadata={
                    "enrollment_id": str(enrollment.id),
                    "course_id": str(enrollment.course.id),
                    "type": "enrollment_success",
                }
            )
        else:
            # Admin/HOD/Teacher enrollments
            serializer.save(created_by=user, updated_by=user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["post"])
    def approve(self, request, *args, **kwargs):
        """Approve a pending enrollment request."""
        from apps.notifications.models import Notification
        
        enrollment = self.get_object()
        if enrollment.status != CourseEnrollment.EnrollmentStatus.PENDING:
            return Response(
                {"detail": "Only pending enrollments can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Check HOD can only approve for their department
        if request.user.role == User.Role.HOD:
            if enrollment.course.department_id != request.user.department_id:
                return Response(
                    {"detail": "You can only approve enrollments for courses in your department."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        
        enrollment.status = CourseEnrollment.EnrollmentStatus.ENROLLED
        enrollment.save(update_fields=["status", "updated_at"])
        
        # Notify the student
        Notification.objects.create(
            user=enrollment.student,
            subject="Enrollment Approved",
            body=f"Your enrollment request for '{enrollment.course.title}' has been approved.",
            metadata={
                "course_id": str(enrollment.course.id),
                "enrollment_id": str(enrollment.id),
                "action": "enrollment_approved",
            },
        )
        
        return Response(self.get_serializer(enrollment).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def reject(self, request, *args, **kwargs):
        """Reject a pending enrollment request."""
        from apps.notifications.models import Notification
        
        enrollment = self.get_object()
        if enrollment.status != CourseEnrollment.EnrollmentStatus.PENDING:
            return Response(
                {"detail": "Only pending enrollments can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Check HOD can only reject for their department
        if request.user.role == User.Role.HOD:
            if enrollment.course.department_id != request.user.department_id:
                return Response(
                    {"detail": "You can only reject enrollments for courses in your department."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        
        student = enrollment.student
        course_title = enrollment.course.title
        
        # Delete the enrollment
        enrollment.delete()
        
        # Notify the student
        Notification.objects.create(
            user=student,
            subject="Enrollment Rejected",
            body=f"Your enrollment request for '{course_title}' has been rejected.",
            metadata={
                "action": "enrollment_rejected",
            },
        )
        
        return Response({"detail": "Enrollment request rejected."}, status=status.HTTP_200_OK)

