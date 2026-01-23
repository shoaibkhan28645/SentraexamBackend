from __future__ import annotations

import logging

from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from apps.users.models import User
from apps.assessments.models import ExamSession
from .models import (
    ProctoringSnapshot,
    ProctoringViolation,
    ProctoringSettings,
    StudentFaceReference
)
from .serializers import (
    ProctoringSnapshotSerializer,
    ProctoringSnapshotUploadSerializer,
    ProctoringViolationSerializer,
    ProctoringSettingsSerializer,
    ProctoringStatusSerializer,
    StudentFaceReferenceSerializer,
    FaceRegistrationSerializer,
    ViolationReviewSerializer,
)
from .services import (
    analyze_snapshot,
    analyze_snapshot_with_gemini, # Use for registration check
    detect_violations,
    get_temporal_analyzer,
    clear_temporal_analyzer,
)

logger = logging.getLogger(__name__)


class ProctoringViewSet(viewsets.ViewSet):
    """
    ViewSet for proctoring operations during exams.
    Uses YOLOv8 for person/phone detection (free, local).
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @action(detail=False, methods=["post"], url_path="register-face")
    def register_face(self, request):
        """
        Register student's face before exam.
        Validates clarity using Gemini.
        """
        serializer = FaceRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        image = serializer.validated_data["image"]
        user = request.user
        
        if user.role != User.Role.STUDENT:
            return Response(
                {"error": "Only students can register their face"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify face using Gemini (Lightweight check)
        try:
            image.seek(0)
            image_bytes = image.read()
            # Perform quick analysis
            analysis = analyze_snapshot_with_gemini(image_bytes)
            
            if analysis["faces_detected"] == 0:
                return Response(
                    {"error": "No face detected. Please ensure your face is clearly visible."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if analysis["faces_detected"] > 1:
                return Response(
                     {"error": "Multiple faces detected. Please be alone in the frame."},
                     status=status.HTTP_400_BAD_REQUEST
                )

            # Quality score (just basic assumption if recognized)
            quality_score = 0.9 if analysis["faces_detected"] == 1 else 0.0

        except Exception as e:
            logger.error(f"Face registration analysis failed: {e}")
            return Response(
                {"error": "Failed to analyze image quality. Please try again."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Deactivate previous
        StudentFaceReference.objects.filter(student=user, is_active=True).update(is_active=False)
        
        # Save new
        face_ref = StudentFaceReference.objects.create(
            student=user,
            image=image,
            is_active=True,
            quality_score=quality_score,
            # face_encoding remains null as we use GenAI verification now
        )
        
        logger.info(f"Face registered for student {user.id}")
        
        return Response({
            "message": "Face registered successfully",
            "face_reference_id": str(face_ref.id),
            "quality_score": quality_score,
        })

    @action(detail=False, methods=["get"], url_path="face-status")
    def face_status(self, request):
        user = request.user
        face_ref = StudentFaceReference.objects.filter(student=user, is_active=True).first()
        return Response({
            "face_registered": face_ref is not None,
            "registered_at": face_ref.captured_at if face_ref else None,
            "quality_score": face_ref.quality_score if face_ref else None,
        })

    @action(detail=False, methods=["post"], url_path="snapshot")
    def upload_snapshot(self, request):
        serializer = ProctoringSnapshotUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        session_id = serializer.validated_data["session_id"]
        image = serializer.validated_data["image"]
        motion_score = serializer.validated_data.get("motion_score", 0.0)
        
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if session.student != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        
        # Settings
        try:
            settings = session.assessment.proctoring_settings
            settings_dict = {
                "detect_no_face": settings.detect_no_face,
                "detect_multiple_faces": settings.detect_multiple_faces,
                "detect_looking_away": settings.detect_looking_away,
                "detect_objects": settings.detect_objects,
                "require_face_verification": settings.require_face_verification,
            }
            max_violations = settings.max_violations_before_terminate
        except ProctoringSettings.DoesNotExist:
            settings_dict = {}
            max_violations = 10
        
        # Get reference image file if needed
        reference_image_file = None
        if settings_dict.get("require_face_verification"):
            face_ref = StudentFaceReference.objects.filter(student=request.user, is_active=True).first()
            if face_ref and face_ref.image:
                reference_image_file = face_ref.image

        # Create snapshot record
        snapshot = ProctoringSnapshot.objects.create(
            session=session,
            image=image,
            motion_score=motion_score,
        )
        
        # Analyze
        # Pass the image and reference (if any)
        analysis_result = analyze_snapshot(
            image,
            session_id=str(session_id),
            settings_config=settings_dict,
            reference_image_file=reference_image_file
        )
        
        # Results are already keyed by 'analysis_result' and 'violations' from analyze_snapshot return
        
        if "error" in analysis_result:
             # Even if error, we might return success but log it, or partial
             logger.error(f"Analysis error: {analysis_result['error']}")
             # We rely on the services.py to handle fallback, so this might be a structural error
             analysis_data = {}
             violations = []
        else:
             analysis_data = analysis_result.get("analysis_result", {})
             violations = analysis_result.get("violations", [])

        # Update Snapshot
        gaze = analysis_data.get("gaze_result") or {}
        face_ver = analysis_data.get("face_verification") or {}
        
        snapshot.analysis_result = analysis_data
        snapshot.faces_detected = analysis_data.get("faces_detected", 0)
        snapshot.gaze_direction = gaze.get("direction", "unknown")
        snapshot.gaze_yaw = gaze.get("yaw", 0.0)
        snapshot.gaze_pitch = gaze.get("pitch", 0.0)
        snapshot.face_verified = face_ver.get("is_match", True)
        snapshot.face_verification_confidence = face_ver.get("confidence", 0.0)
        snapshot.is_violation = len(violations) > 0
        snapshot.processed = True
        snapshot.save()
        
        # Save violations
        created_violations = []
        for v in violations:
            conf_data = v.get("confidence_score", {})
            # Handle float vs dict if scorer logic varies (services.py puts float in confidence_score key logic)
            # Actually services.py logic was: v["confidence_score"] = float
            
            vio_obj = ProctoringViolation.objects.create(
                session=session,
                snapshot=snapshot,
                violation_type=v["type"],
                severity=v["severity"],
                details=v["details"],
                confidence_score=v.get("confidence_score", 1.0),
                confidence_breakdown=v.get("confidence_breakdown", {}),
            )
            created_violations.append(vio_obj)

        total_violations = ProctoringViolation.objects.filter(session=session, is_false_positive=False).count()
        
        return Response({
            "snapshot_id": str(snapshot.id),
            "faces_detected": snapshot.faces_detected,
            "gaze_result": gaze,
            "face_verified": snapshot.face_verified,
            "face_verification_confidence": snapshot.face_verification_confidence,
            "violations": ProctoringViolationSerializer(created_violations, many=True).data,
            "total_violations": total_violations,
            "is_terminated": False,
            "violations_exceeded": total_violations >= max_violations
        })

    # ... Keep other methods (session_status, etc) same or minimal update ...
    # IMPORTANT: Since I am replacing the WHOLE file content, I must ensure I don't lose the other methods.
    # The 'ReplacementContent' below must include the other methods.
    
    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)/status")
    def session_status(self, request, session_id=None):
        try: 
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist: 
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if request.user.role == User.Role.STUDENT and session.student != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
            
        violations = ProctoringViolation.objects.filter(session=session, is_false_positive=False)
        violation_counts = violations.values("violation_type").annotate(count=Count("id"))
        
        face_registered = StudentFaceReference.objects.filter(student=session.student, is_active=True).exists()
        
        return Response({
            "session_id": str(session_id),
            "total_snapshots": ProctoringSnapshot.objects.filter(session=session).count(),
            "total_violations": violations.count(),
            "violation_counts": {v["violation_type"]: v["count"] for v in violation_counts},
            "is_terminated": session.status == ExamSession.SessionStatus.TERMINATED,
            "face_registered": face_registered,
            "latest_violation": ProctoringViolationSerializer(violations.first()).data if violations.exists() else None
        })

    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)/violations")
    def session_violations(self, request, session_id=None):
        session = ExamSession.objects.get(id=session_id)
        if request.user.role == User.Role.STUDENT and session.student != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        
        include_fp = request.query_params.get("include_false_positives", "false") == "true"
        qs = ProctoringViolation.objects.filter(session=session)
        if not include_fp: qs = qs.filter(is_false_positive=False)
        return Response(ProctoringViolationSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)/snapshots")
    def session_snapshots(self, request, session_id=None):
        session = ExamSession.objects.get(id=session_id)
        if request.user.role == User.Role.STUDENT: return Response(status=status.HTTP_403_FORBIDDEN)
        
        qs = ProctoringSnapshot.objects.filter(session=session)
        if request.query_params.get("violations_only") == "true": qs = qs.filter(is_violation=True)
        return Response(ProctoringSnapshotSerializer(qs, many=True).data)

    @action(detail=False, methods=["post"], url_path="violation/(?P<violation_id>[^/.]+)/acknowledge")
    def acknowledge_violation(self, request, violation_id=None):
        v = ProctoringViolation.objects.get(id=violation_id)
        if v.session.student != request.user: return Response(status=status.HTTP_403_FORBIDDEN)
        v.acknowledged = True
        v.save()
        return Response({"message": "Acknowledged"})

    @action(detail=False, methods=["post"], url_path="violation/(?P<violation_id>[^/.]+)/review")
    def review_violation(self, request, violation_id=None):
        if request.user.role == User.Role.STUDENT: return Response(status=status.HTTP_403_FORBIDDEN)
        v = ProctoringViolation.objects.get(id=violation_id)
        serializer = ViolationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v.is_false_positive = serializer.validated_data["is_false_positive"]
        v.review_notes = serializer.validated_data.get("review_notes", "")
        v.reviewed_by = request.user
        v.save()
        return Response({"message": "Reviewed"})

    @action(detail=False, methods=["post"], url_path="session/(?P<session_id>[^/.]+)/end")
    def end_session_proctoring(self, request, session_id=None):
        session = ExamSession.objects.get(id=session_id)
        if session.student != request.user: return Response(status=status.HTTP_403_FORBIDDEN)
        clear_temporal_analyzer(str(session_id))
        return Response({"message": "Ended"})

    @action(detail=False, methods=["post"], url_path="recording/upload")
    def upload_recording(self, request):
        """Upload video recording for a session."""
        from .models import SessionRecording
        
        session_id = request.data.get("session_id")
        video_file = request.FILES.get("video")
        duration = request.data.get("duration", 0)
        
        if not session_id or not video_file:
            return Response(
                {"error": "session_id and video file are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if session.student != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        
        # Create or update recording
        recording, created = SessionRecording.objects.get_or_create(
            session=session,
            defaults={"upload_status": SessionRecording.UploadStatus.UPLOADING}
        )
        
        try:
            recording.video_file = video_file
            recording.file_size_bytes = video_file.size
            recording.duration_seconds = int(duration)
            recording.upload_status = SessionRecording.UploadStatus.COMPLETE
            recording.save()
            
            logger.info(f"Recording uploaded for session {session_id}")
            
            return Response({
                "recording_id": str(recording.id),
                "status": "complete",
                "file_size": recording.file_size_bytes,
                "duration": recording.duration_seconds,
            })
        except Exception as e:
            recording.mark_failed(str(e))
            logger.error(f"Failed to save recording: {e}")
            return Response(
                {"error": "Failed to save recording"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)/recording")
    def get_session_recording(self, request, session_id=None):
        """Get recording info for a session (teachers only)."""
        from .models import SessionRecording
        
        try:
            session = ExamSession.objects.get(id=session_id)
        except ExamSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Only allow teachers/admins or the student themselves
        if request.user.role == User.Role.STUDENT and session.student != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            recording = SessionRecording.objects.get(session=session)
            video_url = None
            if recording.video_file:
                video_url = request.build_absolute_uri(recording.video_file.url)
            
            return Response({
                "recording_id": str(recording.id),
                "video_url": video_url,
                "duration_seconds": recording.duration_seconds,
                "file_size_bytes": recording.file_size_bytes,
                "upload_status": recording.upload_status,
                "created_at": recording.created_at.isoformat(),
            })
        except SessionRecording.DoesNotExist:
            return Response({
                "recording_id": None,
                "video_url": None,
                "message": "No recording available"
            })

