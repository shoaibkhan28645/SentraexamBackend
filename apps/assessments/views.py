from __future__ import annotations

from django.db import models
from django.db.models import QuerySet
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.settings import api_settings

from apps.users.models import User
from apps.users.permissions import IsAdmin, IsAdminHODOrTeacher, IsAdminOrHOD, IsAdminOrTeacher
from .models import Assessment, AssessmentSubmission
from .serializers import (
    AssessmentApprovalSerializer,
    AssessmentCreateSerializer,
    AssessmentGradeSerializer,
    AssessmentScheduleSerializer,
    AssessmentSerializer,
    AssessmentSubmissionSerializer,
)


class AssessmentViewSet(viewsets.ModelViewSet):
    queryset = Assessment.objects.select_related(
        "course", "course__department", "created_by", "approved_by"
    )
    serializer_class = AssessmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("course", "assessment_type", "status")
    search_fields = ("title", "description")
    ordering_fields = ("scheduled_at", "created_at")

    def get_queryset(self) -> QuerySet[Assessment]:
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs.distinct()
        if user.role == User.Role.HOD and user.department_id:
            return qs.filter(course__department_id=user.department_id).distinct()
        if user.role == User.Role.TEACHER:
            return qs.filter(
                models.Q(created_by=user) | models.Q(course__assigned_teacher=user)
            ).distinct()
        if user.role == User.Role.STUDENT:
            visible_statuses = [
                Assessment.Status.APPROVED,
                Assessment.Status.SCHEDULED,
                Assessment.Status.IN_PROGRESS,
                Assessment.Status.COMPLETED,
            ]
            department_filter = models.Q(status__in=visible_statuses)
            if user.department_id:
                department_filter &= models.Q(course__department_id=user.department_id)
            return qs.filter(
                models.Q(
                    course__enrollments__student=user,
                    status__in=visible_statuses,
                )
                | department_filter
            ).distinct()
        return qs.none()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return AssessmentCreateSerializer
        return self.serializer_class

    def get_permissions(self):
        if self.action in {"create"}:
            return [IsAuthenticated(), IsAdminOrTeacher()]
        if self.action in {"update", "partial_update"}:
            return [IsAuthenticated(), IsAdminOrTeacher()]
        if self.action in {"destroy"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        if self.action in {"approve", "schedule"}:
            return [IsAuthenticated(), IsAdminOrHOD()]
        if self.action == "submit_for_approval":
            return [IsAuthenticated(), IsAdminHODOrTeacher()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        assessment = serializer.save()
        request_user = self.request.user
        assessment.created_by = request_user
        assessment.save(update_fields=["created_by"])

    @action(detail=True, methods=["post"], url_path="submit")
    def submit_for_approval(self, request, *args, **kwargs):
        assessment = self.get_object()
        if request.user.role not in {User.Role.TEACHER, User.Role.HOD, User.Role.ADMIN}:
            return Response(status=status.HTTP_403_FORBIDDEN)
        assessment.submit_for_approval()
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, *args, **kwargs):
        assessment = self.get_object()
        serializer = AssessmentApprovalSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(assessment=assessment)
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def schedule(self, request, *args, **kwargs):
        assessment = self.get_object()
        serializer = AssessmentScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(assessment=assessment)
        return Response(AssessmentSerializer(assessment, context={"request": request}).data)


class AssessmentSubmissionViewSet(viewsets.ModelViewSet):
    queryset = AssessmentSubmission.objects.select_related(
        "assessment", "assessment__course", "student"
    )
    serializer_class = AssessmentSubmissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("assessment", "student", "status")
    parser_classes = [MultiPartParser, FormParser, *api_settings.DEFAULT_PARSER_CLASSES]

    def get_queryset(self) -> QuerySet[AssessmentSubmission]:
        user = self.request.user
        qs = self.queryset
        if user.role in {User.Role.ADMIN, User.Role.HOD}:
            return qs
        if user.role == User.Role.TEACHER:
            return qs.filter(assessment__course__assigned_teacher=user)
        if user.role == User.Role.STUDENT:
            return qs.filter(student=user)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != User.Role.STUDENT:
            raise PermissionDenied("Only students can submit assessments.")
        assessment = serializer.validated_data["assessment"]
        now = timezone.now()
        if assessment.scheduled_at and now < assessment.scheduled_at:
            raise ValidationError("Submissions are not open yet for this assessment.")
        if assessment.closes_at and now > assessment.closes_at:
            raise ValidationError("Submission window has closed for this assessment.")
        submission = serializer.save(student=user, created_by=user, updated_by=user)
        if assessment.submission_format == Assessment.SubmissionFormat.ONLINE:
            questions = assessment.questions or []
            answers = submission.answers or []
            score = 0
            has_subjective = False
            
            for idx, question in enumerate(questions):
                q_type = question.get("type", "MCQ")
                q_marks = question.get("marks", 1) # Default to 1 if not specified
                
                if q_type == "SUBJECTIVE":
                    has_subjective = True
                    continue
                
                # Handle MCQ
                selected = answers[idx]
                options = question.get("options", [])
                if isinstance(selected, int) and 0 <= selected < len(options):
                    if options[selected].get("is_correct"):
                        score += q_marks

            submission.score = score
            # If there are subjective questions, it needs manual grading. 
            # Otherwise, it's fully graded.
            if not has_subjective:
                submission.status = AssessmentSubmission.SubmissionStatus.GRADED
            
            submission.save(update_fields=["score", "status", "updated_at"])

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdminHODOrTeacher])
    def grade(self, request, *args, **kwargs):
        submission = self.get_object()
        serializer = AssessmentGradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(submission=submission)
        return Response(
            AssessmentSubmissionSerializer(submission, context={"request": request}).data
        )
