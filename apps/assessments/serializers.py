from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.users.models import User
from .models import Assessment, AssessmentSubmission


class AssessmentSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    approved_by_email = serializers.EmailField(source="approved_by.email", read_only=True)

    class Meta:
        model = Assessment
        fields = (
            "id",
            "course",
            "course_code",
            "title",
            "assessment_type",
            "description",
            "duration_minutes",
            "total_marks",
            "status",
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
    class Meta:
        model = Assessment
        fields = (
            "course",
            "title",
            "assessment_type",
            "description",
            "duration_minutes",
            "total_marks",
            "status",
            "scheduled_at",
            "closes_at",
        )

    def validate(self, attrs):
        scheduled_at = attrs.get("scheduled_at")
        closes_at = attrs.get("closes_at")
        if scheduled_at and closes_at and scheduled_at >= closes_at:
            raise serializers.ValidationError("Close time must be after scheduled time.")
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        assessment = super().create(validated_data)
        if request and request.user.is_authenticated:
            assessment.created_by = request.user
            assessment.save(update_fields=["created_by"])
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
            "submitted_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("student", "student_email", "status", "submitted_at", "created_at", "updated_at")


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
