from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.users.models import User
from .models import Assessment, AssessmentSubmission, ExamAssignment, ExamSession, CheatingLog


class AssessmentContentSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    body = serializers.CharField()
    content_type = serializers.ChoiceField(
        choices=("INSTRUCTION", "QUESTION", "RESOURCE"),
    )


class AssessmentQuestionOptionSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=512)
    is_correct = serializers.BooleanField()


class AssessmentQuestionSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=("MCQ", "SUBJECTIVE"), required=False, default="MCQ")
    prompt = serializers.CharField(max_length=1024)
    options = AssessmentQuestionOptionSerializer(many=True, required=False)
    marks = serializers.IntegerField(min_value=1, required=False, default=1)


class AssessmentSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    approved_by_email = serializers.EmailField(source="approved_by.email", read_only=True)
    content = AssessmentContentSerializer(many=True, read_only=True)
    questions = AssessmentQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Assessment
        fields = (
            "id",
            "course",
            "course_code",
            "title",
            "assessment_type",
            "description",
            "instructions",
            "content",
            "questions",
            "duration_minutes",
            "total_marks",
            "status",
            "submission_format",
            "scheduled_at",
            "closes_at",
            "created_by",
            "created_by_email",
            "approved_by",
            "approved_by_email",
            "approved_at",
            "created_at",
            "updated_at",
            "total_submissions",
            "average_score",
            "submission_rate",
        )
        read_only_fields = (
            "created_by",
            "created_by_email",
            "approved_by",
            "approved_by_email",
            "approved_at",
            "created_at",
            "updated_at",
            "total_submissions",
            "average_score",
            "submission_rate",
        )

    def get_total_submissions(self, obj) -> int:
        return obj.submissions.count()

    def get_average_score(self, obj) -> float | None:
        from django.db.models import Avg
        avg = obj.submissions.aggregate(Avg("score"))["score__avg"]
        return round(avg, 2) if avg is not None else None

    def get_submission_rate(self, obj) -> float:
        total_submissions = obj.submissions.count()
        if obj.assign_to_all:
            # Count all students enrolled in the course
            total_students = obj.course.enrollments.count()
        else:
            # Count only assigned students
            total_students = obj.assignments.count()
        
        if total_students == 0:
            return 0.0
        
        return round((total_submissions / total_students) * 100, 1)


class AssessmentCreateSerializer(serializers.ModelSerializer):
    content = AssessmentContentSerializer(many=True, required=True)
    questions = AssessmentQuestionSerializer(many=True, required=False)

    class Meta:
        model = Assessment
        fields = (
            "course",
            "title",
            "assessment_type",
            "description",
            "instructions",
            "content",
            "questions",
            "duration_minutes",
            "total_marks",
            "status",
            "submission_format",
            "scheduled_at",
            "closes_at",
        )

    def validate(self, attrs):
        scheduled_at = attrs.get("scheduled_at")
        closes_at = attrs.get("closes_at")
        if scheduled_at and closes_at and scheduled_at >= closes_at:
            raise serializers.ValidationError("Close time must be after scheduled time.")
        if not attrs.get("content"):
            raise serializers.ValidationError("At least one content block is required.")

        assessment_type = attrs.get("assessment_type") or getattr(
            self.instance, "assessment_type", None
        )
        submission_format = attrs.get("submission_format") or getattr(
            self.instance, "submission_format", Assessment.SubmissionFormat.TEXT
        )
        questions = attrs.get("questions")
        if assessment_type == Assessment.AssessmentType.EXAM:
            if submission_format != Assessment.SubmissionFormat.ONLINE:
                raise serializers.ValidationError(
                    {"submission_format": "Exams must use the online exam submission format."}
                )
            questions = questions or getattr(self.instance, "questions", [])
            if not questions:
                raise serializers.ValidationError({"questions": "Exams must include questions."})
            
            for idx, question in enumerate(questions):
                q_type = question.get("type")
                if q_type == "MCQ":
                    options = question.get("options") or []
                    if len(options) < 2:
                        raise serializers.ValidationError(
                            {"questions": f"Question {idx + 1} (MCQ) must have at least two options."}
                        )
                    correct_options = [opt for opt in options if opt.get("is_correct")]
                    if len(correct_options) != 1:
                        raise serializers.ValidationError(
                            {"questions": f"Question {idx + 1} (MCQ) must have exactly one correct option."}
                        )
                elif q_type == "SUBJECTIVE":
                    # Subjective questions don't need options validation
                    pass
        else:
            if submission_format == Assessment.SubmissionFormat.ONLINE:
                raise serializers.ValidationError(
                    {"submission_format": "Only exams can use the online exam submission format."}
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        content = validated_data.pop("content", [])
        questions = validated_data.pop("questions", [])
        if validated_data.get("assessment_type") != Assessment.AssessmentType.EXAM:
            questions = []
        assessment = super().create(validated_data)
        assessment.content = content
        assessment.questions = questions
        assessment.save(update_fields=["content", "questions"])
        if request and request.user.is_authenticated:
            assessment.created_by = request.user
            assessment.save(update_fields=["created_by"])
        return assessment

    def update(self, instance, validated_data):
        content = validated_data.pop("content", None)
        questions = validated_data.pop("questions", None)
        assessment = super().update(instance, validated_data)
        update_fields = ["updated_at"]
        if content is not None:
            assessment.content = content
            update_fields.append("content")
        if questions is not None:
            if (
                validated_data.get("assessment_type", instance.assessment_type)
                != Assessment.AssessmentType.EXAM
            ):
                questions = []
            assessment.questions = questions
            update_fields.append("questions")
        if len(update_fields) > 1:
            assessment.save(update_fields=update_fields)
        return assessment


class AssessmentApprovalSerializer(serializers.Serializer):
    approve = serializers.BooleanField()

    def save(self, assessment: Assessment):
        user = self.context["request"].user
        if self.validated_data["approve"]:
            assessment.approve(user)
        else:
            assessment.status = Assessment.Status.DRAFT
            assessment.approved_by = None
            assessment.approved_at = None
            assessment.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
        return assessment


class AssessmentScheduleSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()
    closes_at = serializers.DateTimeField()

    def validate(self, attrs):
        if attrs["scheduled_at"] >= attrs["closes_at"]:
            raise serializers.ValidationError("Close time must be after scheduled time.")
        if attrs["scheduled_at"] < timezone.now():
            raise serializers.ValidationError("Scheduled time must be in the future.")
        return attrs

    def save(self, assessment: Assessment):
        scheduled_at = self.validated_data["scheduled_at"]
        closes_at = self.validated_data["closes_at"]
        assessment.schedule(scheduled_at, closes_at)
        return assessment


class AssessmentSubmissionSerializer(serializers.ModelSerializer):
    assessment_title = serializers.CharField(source="assessment.title", read_only=True)
    student_email = serializers.EmailField(source="student.email", read_only=True)
    text_response = serializers.CharField(required=False, allow_blank=True)
    file_response = serializers.FileField(required=False, allow_null=True)
    answers = serializers.ListField(
        child=serializers.JSONField(),  # Allow mixed types (int for MCQ, str for Subjective)
        required=False,
        allow_empty=True,
    )
    
    # Proctoring statistics for teachers
    total_violations = serializers.SerializerMethodField()
    violations_by_type = serializers.SerializerMethodField()
    proctoring_snapshots = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentSubmission
        fields = (
            "id",
            "assessment",
            "assessment_title",
            "student",
            "student_email",
            "status",
            "score",
            "feedback",
            "text_response",
            "file_response",
            "answers",
            "submitted_at",
            "created_at",
            "updated_at",
            # Proctoring fields
            "total_violations",
            "violations_by_type",
            "proctoring_snapshots",
        )
        read_only_fields = (
            "student",
            "student_email",
            "status",
            "submitted_at",
            "created_at",
            "updated_at",
            "total_violations",
            "violations_by_type",
            "proctoring_snapshots",
        )
    
    def get_total_violations(self, obj):
        """Get total number of proctoring violations for this submission's session."""
        if not obj.session:
            return 0
        from apps.proctoring.models import ProctoringViolation
        return ProctoringViolation.objects.filter(session=obj.session).count()
    
    def get_violations_by_type(self, obj):
        """Get breakdown of violations by type."""
        if not obj.session:
            return {}
        from apps.proctoring.models import ProctoringViolation
        from django.db.models import Count
        violations = ProctoringViolation.objects.filter(
            session=obj.session
        ).values('violation_type').annotate(count=Count('id'))
        return {v['violation_type']: v['count'] for v in violations}
    
    def get_proctoring_snapshots(self, obj):
        """Get list of proctoring snapshots with timestamps."""
        if not obj.session:
            return []
        from apps.proctoring.models import ProctoringSnapshot
        snapshots = ProctoringSnapshot.objects.filter(
            session=obj.session
        ).order_by('captured_at')[:50]  # Limit to 50 snapshots
        
        request = self.context.get('request')
        return [{
            'id': str(snap.id),
            'captured_at': snap.captured_at,
            'image_url': request.build_absolute_uri(snap.image.url) if request else snap.image.url,
            'is_violation': snap.is_violation,
            'faces_detected': snap.faces_detected,
        } for snap in snapshots]

    def validate(self, attrs):
        assessment = attrs.get("assessment") or getattr(self.instance, "assessment", None)
        if not assessment:
            return attrs
        submission_format = assessment.submission_format
        text_response = attrs.get("text_response", "")
        file_response = attrs.get("file_response")

        if submission_format == Assessment.SubmissionFormat.ONLINE:
            questions = assessment.questions or []
            answers = attrs.get("answers")
            if not isinstance(answers, list):
                raise serializers.ValidationError(
                    {"answers": "Answers must be a list."}
                )
            # Allow partial submissions - pad with nulls if needed
            while len(answers) < len(questions):
                answers.append(None)
            
            for idx, selected in enumerate(answers):
                if idx >= len(questions):
                    break
                question = questions[idx]
                q_type = question.get("type", "MCQ")  # Default to MCQ for backward compatibility
                
                if q_type == "MCQ":
                    options = question.get("options", [])
                    # Allow None, -1, or valid index
                    if selected is not None and selected != -1:
                        if not isinstance(selected, int) or selected < 0 or selected >= len(options):
                            raise serializers.ValidationError(
                                {"answers": f"Question {idx + 1} contains an invalid selection."}
                            )
                elif q_type == "SUBJECTIVE":
                    # Allow blank/None for subjective
                    pass
            attrs["answers"] = answers
            attrs["text_response"] = ""
            attrs["file_response"] = None
        if submission_format == Assessment.SubmissionFormat.TEXT and not text_response.strip():
            raise serializers.ValidationError({"text_response": "Text response is required."})
        if submission_format == Assessment.SubmissionFormat.FILE and not file_response:
            raise serializers.ValidationError({"file_response": "File upload is required."})
        if submission_format == Assessment.SubmissionFormat.TEXT_AND_FILE:
            errors = {}
            if not text_response.strip():
                errors["text_response"] = "Text response is required."
            if not file_response:
                errors["file_response"] = "File upload is required."
            if errors:
                raise serializers.ValidationError(errors)
        if submission_format != Assessment.SubmissionFormat.ONLINE:
            attrs["answers"] = []
        return attrs


class AssessmentGradeSerializer(serializers.Serializer):
    score = serializers.DecimalField(max_digits=5, decimal_places=2)
    feedback = serializers.CharField(required=False, allow_blank=True)

    def save(self, submission: AssessmentSubmission):
        submission.mark_graded(
            score=self.validated_data["score"],
            feedback=self.validated_data.get("feedback", ""),
        )
        return submission


# ============================================================================
# Exam Assignment Serializers
# ============================================================================

class ExamAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for viewing exam assignments."""
    student_email = serializers.EmailField(source="student.email", read_only=True)
    student_name = serializers.SerializerMethodField()
    assessment_title = serializers.CharField(source="assessment.title", read_only=True)

    class Meta:
        model = ExamAssignment
        fields = (
            "id",
            "assessment",
            "assessment_title",
            "student",
            "student_email",
            "student_name",
            "assigned_at",
            "is_completed",
            "created_at",
        )
        read_only_fields = ("assigned_at", "is_completed", "created_at")

    def get_student_name(self, obj) -> str:
        return f"{obj.student.first_name} {obj.student.last_name}".strip() or obj.student.email


class AssignStudentsSerializer(serializers.Serializer):
    """Serializer for assigning students to an exam."""
    student_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text="List of student IDs to assign to the exam"
    )
    
    def validate_student_ids(self, value):
        students = User.objects.filter(id__in=value, role=User.Role.STUDENT)
        if students.count() != len(value):
            raise serializers.ValidationError("One or more student IDs are invalid.")
        return value

    def save(self, assessment: Assessment):
        student_ids = self.validated_data["student_ids"]
        students = User.objects.filter(id__in=student_ids, role=User.Role.STUDENT)
        
        # Create assignments for students that don't already have one
        created = []
        for student in students:
            obj, is_new = ExamAssignment.objects.get_or_create(
                assessment=assessment,
                student=student,
            )
            if is_new:
                created.append(obj)
        
        # If assigning specific students, set assign_to_all to False
        if not assessment.assign_to_all:
            pass  # Already set
        else:
            assessment.assign_to_all = False
            assessment.save(update_fields=["assign_to_all", "updated_at"])
        
        return created


# ============================================================================
# Exam Session Serializers
# ============================================================================

class CheatingLogSerializer(serializers.ModelSerializer):
    """Serializer for cheating incident logs."""
    
    class Meta:
        model = CheatingLog
        fields = ("id", "incident_type", "occurred_at", "details")
        read_only_fields = ("id", "occurred_at")


class ExamSessionSerializer(serializers.ModelSerializer):
    """Serializer for exam sessions."""
    student_email = serializers.EmailField(source="student.email", read_only=True)
    assessment_title = serializers.CharField(source="assessment.title", read_only=True)
    cheating_logs = CheatingLogSerializer(many=True, read_only=True)
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = ExamSession
        fields = (
            "id",
            "assessment",
            "assessment_title",
            "student",
            "student_email",
            "started_at",
            "ended_at",
            "server_deadline",
            "cheating_count",
            "status",
            "saved_answers",
            "cheating_logs",
            "time_remaining_seconds",
        )
        read_only_fields = (
            "started_at",
            "ended_at",
            "server_deadline",
            "cheating_count",
            "status",
        )

    def get_time_remaining_seconds(self, obj) -> int:
        if obj.status != ExamSession.SessionStatus.IN_PROGRESS:
            return 0
        remaining = obj.server_deadline - timezone.now()
        return max(0, int(remaining.total_seconds()))


class StartExamSessionSerializer(serializers.Serializer):
    """Serializer for starting an exam session."""
    
    def validate(self, attrs):
        request = self.context.get("request")
        assessment = self.context.get("assessment")
        
        if not request or not assessment:
            raise serializers.ValidationError("Invalid request context.")
        
        user = request.user
        
        # Check if student is allowed to take this exam
        if not assessment.assign_to_all:
            if not ExamAssignment.objects.filter(
                assessment=assessment, student=user
            ).exists():
                raise serializers.ValidationError(
                    "You are not assigned to take this exam."
                )
        
        # Check if exam is in valid status
        valid_statuses = [Assessment.Status.SCHEDULED, Assessment.Status.IN_PROGRESS]
        if assessment.status not in valid_statuses:
            raise serializers.ValidationError("This exam is not currently available.")
        
        # Check timing
        now = timezone.now()
        if assessment.scheduled_at and now < assessment.scheduled_at:
            raise serializers.ValidationError("This exam has not started yet.")
        if assessment.closes_at and now > assessment.closes_at:
            raise serializers.ValidationError("This exam has already closed.")
        
        # Check for existing session
        existing = ExamSession.objects.filter(
            assessment=assessment, student=user
        ).first()
        
        if existing:
            if existing.status == ExamSession.SessionStatus.IN_PROGRESS:
                # Resume existing session
                attrs["existing_session"] = existing
            elif existing.status == ExamSession.SessionStatus.SUBMITTED:
                # Already submitted - cannot retake
                raise serializers.ValidationError(
                    "You have already submitted this exam. Retakes are not allowed."
                )
            else:
                # Terminated session
                raise serializers.ValidationError(
                    "This exam session was terminated and cannot be resumed."
                )
        
        return attrs

    def save(self, assessment: Assessment):
        request = self.context["request"]
        user = request.user
        
        # Check for existing session to resume
        if "existing_session" in self.validated_data:
            return self.validated_data["existing_session"]
        
        # Create new session
        server_deadline = timezone.now() + timedelta(minutes=assessment.duration_minutes)
        
        session = ExamSession.objects.create(
            assessment=assessment,
            student=user,
            server_deadline=server_deadline,
        )
        
        # Mark assignment as started (if exists)
        ExamAssignment.objects.filter(
            assessment=assessment, student=user
        ).update(is_completed=False)
        
        return session


class ReportCheatingSerializer(serializers.Serializer):
    """Serializer for reporting a cheating incident."""
    incident_type = serializers.ChoiceField(choices=CheatingLog.IncidentType.choices)
    details = serializers.JSONField(required=False, default=dict)

    def save(self, session: ExamSession):
        log = CheatingLog.objects.create(
            session=session,
            incident_type=self.validated_data["incident_type"],
            details=self.validated_data.get("details", {}),
        )
        
        # Increment cheating count
        session.cheating_count += 1
        session.save(update_fields=["cheating_count", "updated_at"])
        
        # Auto-terminate after 3 incidents
        if session.cheating_count >= 3:
            session.status = ExamSession.SessionStatus.TERMINATED
            session.ended_at = timezone.now()
            session.save(update_fields=["status", "ended_at", "updated_at"])
        
        return log


class AutoSaveAnswersSerializer(serializers.Serializer):
    """Serializer for auto-saving exam answers."""
    answers = serializers.ListField(
        child=serializers.JSONField(),
        allow_empty=True,
    )

    def save(self, session: ExamSession):
        session.saved_answers = self.validated_data["answers"]
        session.save(update_fields=["saved_answers", "updated_at"])
        return session
