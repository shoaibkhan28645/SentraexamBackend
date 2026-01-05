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
from apps.users.permissions import IsAdmin, IsAdminHODOrTeacher, IsAdminOrHOD, IsAdminOrTeacher, IsTeacher
from .models import Assessment, AssessmentSubmission, ExamAssignment, ExamSession
from .serializers import (
    AssessmentApprovalSerializer,
    AssessmentCreateSerializer,
    AssessmentGradeSerializer,
    AssessmentScheduleSerializer,
    AssessmentSerializer,
    AssessmentSubmissionSerializer,
    AssignStudentsSerializer,
    AutoSaveAnswersSerializer,
    ExamAssignmentSerializer,
    ExamSessionSerializer,
    ReportCheatingSerializer,
    StartExamSessionSerializer,
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
            return [IsAuthenticated(), IsTeacher()]
        if self.action in {"update", "partial_update"}:
            return [IsAuthenticated(), IsTeacher()]
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

    # =========================================================================
    # Student Assignment Endpoints
    # =========================================================================

    @action(detail=True, methods=["post"], url_path="assign")
    def assign_students(self, request, *args, **kwargs):
        """Assign specific students to take this exam."""
        assessment = self.get_object()
        if request.user.role not in {User.Role.ADMIN, User.Role.HOD, User.Role.TEACHER}:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        serializer = AssignStudentsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = serializer.save(assessment=assessment)
        
        return Response({
            "message": f"Assigned {len(created)} new students to the exam.",
            "total_assigned": assessment.assignments.count(),
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="assignments")
    def list_assignments(self, request, *args, **kwargs):
        """List all students assigned to this exam."""
        assessment = self.get_object()
        if request.user.role not in {User.Role.ADMIN, User.Role.HOD, User.Role.TEACHER}:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        assignments = assessment.assignments.select_related("student")
        serializer = ExamAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["delete"], url_path="assignments/(?P<student_id>[^/.]+)")
    def remove_assignment(self, request, student_id=None, *args, **kwargs):
        """Remove a student from the exam assignment list."""
        assessment = self.get_object()
        if request.user.role not in {User.Role.ADMIN, User.Role.HOD, User.Role.TEACHER}:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        deleted, _ = ExamAssignment.objects.filter(
            assessment=assessment, student_id=student_id
        ).delete()
        
        if deleted:
            return Response({"message": "Student removed from assignment."})
        return Response({"error": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # Exam Session Endpoints
    # =========================================================================

    @action(detail=True, methods=["post"], url_path="start-session")
    def start_session(self, request, *args, **kwargs):
        """Start or resume an exam session for the current student."""
        assessment = self.get_object()
        if request.user.role != User.Role.STUDENT:
            return Response(
                {"error": "Only students can start exam sessions."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = StartExamSessionSerializer(
            data={},
            context={"request": request, "assessment": assessment}
        )
        serializer.is_valid(raise_exception=True)
        session = serializer.save(assessment=assessment)
        
        return Response(ExamSessionSerializer(session).data)


class AssessmentSubmissionViewSet(viewsets.ModelViewSet):
    queryset = AssessmentSubmission.objects.select_related(
        "assessment", "assessment__course", "student", "session"
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
        
        # Check if already submitted
        existing_submission = AssessmentSubmission.objects.filter(
            assessment=assessment, student=user
        ).first()
        if existing_submission:
            raise ValidationError("You have already submitted this assessment.")
        
        if assessment.scheduled_at and now < assessment.scheduled_at:
            raise ValidationError("Submissions are not open yet for this assessment.")
        if assessment.closes_at and now > assessment.closes_at:
            raise ValidationError("Submission window has closed for this assessment.")
        
        # Check if student is assigned (for targeted exams)
        if not assessment.assign_to_all:
            if not ExamAssignment.objects.filter(assessment=assessment, student=user).exists():
                raise PermissionDenied("You are not assigned to take this exam.")
        
        # Find existing session (optional - works without session too)
        session = ExamSession.objects.filter(
            assessment=assessment, student=user, status=ExamSession.SessionStatus.IN_PROGRESS
        ).first()
        
        # Create submission
        submission = serializer.save(student=user, created_by=user, updated_by=user, session=session)
        
        # Mark session as submitted (if exists)
        if session:
            session.status = ExamSession.SessionStatus.SUBMITTED
            session.ended_at = timezone.now()
            session.save(update_fields=["status", "ended_at", "updated_at"])
            
            # Mark assignment as completed
            ExamAssignment.objects.filter(
                assessment=assessment, student=user
            ).update(is_completed=True)
        
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
                if idx < len(answers):
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


class ExamSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing exam sessions (read-only for listing, actions for updates)."""
    queryset = ExamSession.objects.select_related("assessment", "student").prefetch_related("cheating_logs")
    serializer_class = ExamSessionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ("assessment", "student", "status")

    def get_queryset(self) -> QuerySet[ExamSession]:
        user = self.request.user
        qs = self.queryset
        if user.role in {User.Role.ADMIN, User.Role.HOD}:
            return qs
        if user.role == User.Role.TEACHER:
            return qs.filter(assessment__course__assigned_teacher=user)
        if user.role == User.Role.STUDENT:
            return qs.filter(student=user)
        return qs.none()

    @action(detail=True, methods=["post"], url_path="report-cheating")
    def report_cheating(self, request, *args, **kwargs):
        """Report a cheating incident during the exam."""
        session = self.get_object()
        
        # Only the student in the session can report (frontend reports)
        if request.user != session.student:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        if session.status != ExamSession.SessionStatus.IN_PROGRESS:
            return Response(
                {"error": "Session is no longer active."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ReportCheatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(session=session)
        
        # Return updated session
        session.refresh_from_db()
        return Response(ExamSessionSerializer(session).data)

    @action(detail=True, methods=["post"], url_path="autosave")
    def autosave(self, request, *args, **kwargs):
        """Auto-save exam answers periodically."""
        session = self.get_object()
        
        if request.user != session.student:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        if session.status != ExamSession.SessionStatus.IN_PROGRESS:
            return Response(
                {"error": "Session is no longer active."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = AutoSaveAnswersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(session=session)
        
        return Response({"message": "Answers saved successfully."})

    @action(detail=True, methods=["get"], url_path="saved-answers")
    def get_saved_answers(self, request, *args, **kwargs):
        """Retrieve auto-saved answers for resuming an exam."""
        session = self.get_object()
        
        if request.user != session.student:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        return Response({
            "answers": session.saved_answers,
            "time_remaining_seconds": ExamSessionSerializer().get_time_remaining_seconds(session),
        })

