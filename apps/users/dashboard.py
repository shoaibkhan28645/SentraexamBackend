"""Dashboard API views for role-specific data."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Count, Avg, Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.assessments.models import Assessment, AssessmentSubmission, ExamSession
from apps.courses.models import Course, CourseEnrollment
from apps.departments.models import Department

User = get_user_model()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_dashboard(request):
    """
    Dashboard data for teachers.
    Returns: assigned courses, upcoming assessments, student counts.
    """
    user = request.user
    if user.role not in [User.Role.TEACHER, User.Role.ADMIN, User.Role.HOD]:
        return Response(
            {"detail": "Only teachers can access this dashboard."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Get courses assigned to teacher
    courses = Course.objects.filter(assigned_teacher=user).select_related("department")
    
    # Get assessments for those courses
    assessments = Assessment.objects.filter(
        course__assigned_teacher=user
    ).select_related("course").order_by("-scheduled_at")[:10]
    
    # Count students in teacher's courses
    student_ids = CourseEnrollment.objects.filter(
        course__assigned_teacher=user,
        status=CourseEnrollment.EnrollmentStatus.ENROLLED
    ).values_list("student_id", flat=True).distinct()
    
    # Build response
    courses_data = [
        {
            "id": str(c.id),
            "code": c.code,
            "title": c.title,
            "department": c.department.name if c.department else None,
            "student_count": CourseEnrollment.objects.filter(
                course=c, 
                status=CourseEnrollment.EnrollmentStatus.ENROLLED
            ).count(),
        }
        for c in courses
    ]
    
    assessments_data = [
        {
            "id": str(a.id),
            "title": a.title,
            "course_code": a.course.code,
            "assessment_type": a.assessment_type,
            "status": a.status,
            "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None,
            "total_submissions": AssessmentSubmission.objects.filter(assessment=a).count(),
        }
        for a in assessments
    ]
    
    return Response({
        "courses": courses_data,
        "total_courses": len(courses_data),
        "assessments": assessments_data,
        "total_students": len(set(student_ids)),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hod_dashboard(request):
    """
    Dashboard data for Heads of Departments.
    Returns: department info, teachers, students, course assignments.
    """
    user = request.user
    if user.role not in [User.Role.HOD, User.Role.ADMIN]:
        return Response(
            {"detail": "Only HODs can access this dashboard."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    department = user.department
    if not department and user.role != User.Role.ADMIN:
        return Response(
            {"detail": "You are not assigned to a department."},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # For admin, show all data; for HOD, filter by department
    dept_filter = {} if user.role == User.Role.ADMIN else {"department": department}
    
    # Get teachers in department
    teachers = User.objects.filter(
        role=User.Role.TEACHER, **dept_filter
    ).select_related("department")
    
    # Get students in department
    students = User.objects.filter(
        role=User.Role.STUDENT, **dept_filter
    )
    
    # Get courses in department
    course_filter = {} if user.role == User.Role.ADMIN else {"department": department}
    courses = Course.objects.filter(**course_filter).select_related(
        "department", "assigned_teacher"
    )
    
    teachers_data = [
        {
            "id": t.id,
            "email": t.email,
            "name": f"{t.first_name} {t.last_name}".strip() or t.email,
            "assigned_courses": list(
                Course.objects.filter(assigned_teacher=t).values_list("code", flat=True)
            ),
        }
        for t in teachers
    ]
    
    courses_data = [
        {
            "id": str(c.id),
            "code": c.code,
            "title": c.title,
            "assigned_teacher": c.assigned_teacher.email if c.assigned_teacher else None,
            "teacher_name": f"{c.assigned_teacher.first_name} {c.assigned_teacher.last_name}".strip() if c.assigned_teacher else None,
            "student_count": CourseEnrollment.objects.filter(
                course=c,
                status=CourseEnrollment.EnrollmentStatus.ENROLLED
            ).count(),
        }
        for c in courses
    ]
    
    return Response({
        "department": {
            "id": str(department.id) if department else None,
            "name": department.name if department else "All Departments",
            "code": department.code if department else None,
        },
        "teachers": teachers_data,
        "total_teachers": len(teachers_data),
        "total_students": students.count(),
        "courses": courses_data,
        "total_courses": len(courses_data),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_dashboard(request):
    """
    Dashboard data for students.
    Returns: enrolled courses, upcoming exams, attendance data.
    """
    user = request.user
    if user.role not in [User.Role.STUDENT, User.Role.ADMIN]:
        return Response(
            {"detail": "Only students can access this dashboard."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    student = user if user.role == User.Role.STUDENT else None
    if not student:
        return Response({
            "enrollments": [],
            "upcoming_exams": [],
            "past_exams": [],
            "attendance_percentage": None,
        })
    
    # Get enrolled courses
    enrollments = CourseEnrollment.objects.filter(
        student=student,
        status=CourseEnrollment.EnrollmentStatus.ENROLLED
    ).select_related("course", "course__department", "course__assigned_teacher")
    
    # Get assessments for enrolled courses
    enrolled_course_ids = enrollments.values_list("course_id", flat=True)
    
    from django.utils import timezone
    now = timezone.now()
    
    # Upcoming exams (scheduled in the future)
    upcoming_exams = Assessment.objects.filter(
        course_id__in=enrolled_course_ids,
        status__in=[Assessment.Status.SCHEDULED, Assessment.Status.APPROVED],
        scheduled_at__gte=now
    ).select_related("course").order_by("scheduled_at")[:10]
    
    # Past exams
    past_exams = Assessment.objects.filter(
        course_id__in=enrolled_course_ids,
    ).exclude(
        status=Assessment.Status.DRAFT
    ).select_related("course").order_by("-scheduled_at")[:10]
    
    # Get student's submissions
    submissions = AssessmentSubmission.objects.filter(student=student).values_list(
        "assessment_id", flat=True
    )
    
    enrollments_data = [
        {
            "id": str(e.id),
            "course_id": str(e.course.id),
            "course_code": e.course.code,
            "course_title": e.course.title,
            "teacher": e.course.assigned_teacher.email if e.course.assigned_teacher else None,
            "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else None,
        }
        for e in enrollments
    ]
    
    def get_exam_data(exam):
        has_submission = str(exam.id) in [str(s) for s in submissions]
        session = ExamSession.objects.filter(
            assessment=exam, student=student
        ).first()
        
        return {
            "id": str(exam.id),
            "title": exam.title,
            "course_code": exam.course.code,
            "assessment_type": exam.assessment_type,
            "scheduled_at": exam.scheduled_at.isoformat() if exam.scheduled_at else None,
            "closes_at": exam.closes_at.isoformat() if exam.closes_at else None,
            "duration_minutes": exam.duration_minutes,
            "total_marks": exam.total_marks,
            "status": exam.status,
            "student_status": (
                "SUBMITTED" if has_submission else
                "IN_PROGRESS" if session and session.status == ExamSession.SessionStatus.IN_PROGRESS else
                "NOT_STARTED"
            ),
        }
    
    return Response({
        "enrollments": enrollments_data,
        "total_enrollments": len(enrollments_data),
        "upcoming_exams": [get_exam_data(e) for e in upcoming_exams],
        "past_exams": [get_exam_data(e) for e in past_exams],
        "attendance_percentage": None,  # Placeholder - implement if attendance model exists
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    """
    Dashboard data for administrators.
    Returns: user counts by role, recent registrations, system stats.
    """
    user = request.user
    if user.role != User.Role.ADMIN:
        return Response(
            {"detail": "Only administrators can access this dashboard."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Count users by role
    user_counts = User.objects.values("role").annotate(count=Count("id"))
    role_counts = {item["role"]: item["count"] for item in user_counts}
    
    # Recent registrations
    recent_users = User.objects.order_by("-created_at")[:10].select_related("department")
    
    # Department stats
    departments = Department.objects.annotate(
        user_count=Count("users"),
        course_count=Count("courses")
    )
    
    # Assessment stats
    total_assessments = Assessment.objects.count()
    total_submissions = AssessmentSubmission.objects.count()
    
    recent_users_data = [
        {
            "id": u.id,
            "email": u.email,
            "name": f"{u.first_name} {u.last_name}".strip() or u.email,
            "role": u.role,
            "department": u.department.name if u.department else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "is_active": u.is_active,
        }
        for u in recent_users
    ]
    
    departments_data = [
        {
            "id": str(d.id),
            "name": d.name,
            "code": d.code,
            "user_count": d.user_count,
            "course_count": d.course_count,
        }
        for d in departments
    ]
    
    return Response({
        "user_counts": {
            "total": sum(role_counts.values()),
            "admins": role_counts.get(User.Role.ADMIN, 0),
            "hods": role_counts.get(User.Role.HOD, 0),
            "teachers": role_counts.get(User.Role.TEACHER, 0),
            "students": role_counts.get(User.Role.STUDENT, 0),
        },
        "recent_users": recent_users_data,
        "departments": departments_data,
        "total_departments": len(departments_data),
        "total_assessments": total_assessments,
        "total_submissions": total_submissions,
    })
