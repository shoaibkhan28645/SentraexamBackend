from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.users.models import User
from .models import Assessment, AssessmentSubmission


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
        )
        read_only_fields = (
            "created_by",
            "created_by_email",
            "approved_by",
            "approved_by_email",
            "approved_at",
            "created_at",
            "updated_at",
        )


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
        )
        read_only_fields = (
            "student",
            "student_email",
            "status",
            "submitted_at",
            "created_at",
            "updated_at",
        )

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
            if not isinstance(answers, list) or not answers:
                raise serializers.ValidationError(
                    {"answers": "Please answer every question before submitting."}
                )
            if len(answers) != len(questions):
                raise serializers.ValidationError(
                    {"answers": "An answer is required for each question."}
                )
            for idx, selected in enumerate(answers):
                question = questions[idx]
                q_type = question.get("type", "MCQ")  # Default to MCQ for backward compatibility
                
                if q_type == "MCQ":
                    options = question.get("options", [])
                    # Allow None (unanswered)
                    if selected is not None:
                        if not isinstance(selected, int) or selected < 0 or selected >= len(options):
                            raise serializers.ValidationError(
                                {"answers": f"Question {idx + 1} contains an invalid selection."}
                            )
                elif q_type == "SUBJECTIVE":
                    # Allow blank/None for subjective
                    pass
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
        return assessment
