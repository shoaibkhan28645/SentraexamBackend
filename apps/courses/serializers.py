from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.users.models import User
from .models import Course, CourseEnrollment


class CourseSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    assigned_teacher_email = serializers.EmailField(
        source="assigned_teacher.email", read_only=True
    )

    class Meta:
        model = Course
        fields = (
            "id",
            "department",
            "department_name",
            "code",
            "title",
            "description",
            "credits",
            "status",
            "assigned_teacher",
            "assigned_teacher_email",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("approved_by", "approved_at", "created_at", "updated_at")


class CourseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = (
            "department",
            "code",
            "title",
            "description",
            "credits",
            "status",
            "assigned_teacher",
        )

    def validate_assigned_teacher(self, value):
        if value and value.role not in {User.Role.TEACHER, User.Role.HOD}:
            raise serializers.ValidationError("Assigned teacher must have teacher or HOD role.")
        return value

    def validate(self, attrs):
        department = attrs.get("department") or getattr(self.instance, "department", None)
        teacher = attrs.get("assigned_teacher") or getattr(self.instance, "assigned_teacher", None)
        if department and teacher and teacher.department_id and teacher.department_id != department.id:
            raise serializers.ValidationError("Assigned teacher must belong to the selected department.")
        return attrs


class CourseApprovalSerializer(serializers.ModelSerializer):
    approved = serializers.BooleanField(write_only=True)

    class Meta:
        model = Course
        fields = ("approved",)

    def update(self, instance, validated_data):
        request = self.context["request"]
        approved = validated_data["approved"]
        if approved:
            instance.status = Course.Status.ACTIVE
            instance.approved_by = request.user
            instance.approved_at = timezone.now()
        else:
            instance.status = Course.Status.DRAFT
            instance.approved_by = None
            instance.approved_at = None
        instance.save(
            update_fields=["status", "approved_by", "approved_at", "updated_at"]
        )
        return instance


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    student_email = serializers.EmailField(source="student.email", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)

    class Meta:
        model = CourseEnrollment
        fields = (
            "id",
            "course",
            "course_code",
            "student",
            "student_email",
            "status",
            "enrolled_at",
            "completed_at",
        )
        read_only_fields = ("enrolled_at", "completed_at")

    def update(self, instance, validated_data):
        status = validated_data.get("status")
        if status and status == CourseEnrollment.EnrollmentStatus.COMPLETED:
            instance.completed_at = timezone.now()
        return super().update(instance, validated_data)
