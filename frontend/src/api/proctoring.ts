import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// Types
export interface GazeResult {
    yaw: number;
    pitch: number;
    is_looking_away: boolean;
    direction: 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown';
}

export interface ConfidenceBreakdown {
    detection_confidence: number;
    temporal_consistency: number;
    severity_weight: number;
    context_match: number;
}

export interface ConfidenceScore {
    overall_confidence: number;
    breakdown: ConfidenceBreakdown;
    is_reliable: boolean;
}

export interface ProctoringViolation {
    id: string;
    session: string;
    snapshot: string | null;
    violation_type:
    | 'NO_FACE'
    | 'MULTIPLE_FACES'
    | 'LOOKING_AWAY'
    | 'FACE_NOT_MATCHED'
    | 'OBJECT_DETECTED'
    | 'PHONE_DETECTED'
    | 'BOOK_DETECTED'
    | 'LAPTOP_DETECTED'
    | 'PERSON_LEFT'
    | 'INTERMITTENT_FACE'
    | 'PERSISTENT_GAZE_AWAY'
    | 'MULTIPLE_PERSONS_PATTERN'
    | 'IDENTITY_MISMATCH_PATTERN';
    violation_type_display: string;
    severity: number;
    occurred_at: string;
    details: Record<string, unknown>;
    confidence_score: number;
    confidence_breakdown: ConfidenceBreakdown;
    acknowledged: boolean;
    is_false_positive: boolean;
    created_at: string;
}

export interface SnapshotUploadResponse {
    snapshot_id: string;
    faces_detected: number;
    gaze_result: GazeResult | null;
    face_verified: boolean;
    face_verification_confidence: number;
    violations: ProctoringViolation[];
    total_violations: number;
    violations_exceeded: boolean;
    is_terminated: boolean;
}

export interface ProctoringStatus {
    session_id: string;
    total_snapshots: number;
    total_violations: number;
    violation_counts: Record<string, number>;
    is_terminated: boolean;
    face_registered: boolean;
    latest_violation: ProctoringViolation | null;
}

export interface FaceRegistrationResponse {
    message: string;
    face_reference_id: string;
    quality_score: number;
}

export interface FaceStatus {
    face_registered: boolean;
    registered_at: string | null;
    quality_score: number | null;
}

// ============================================================================
// FACE REGISTRATION
// ============================================================================

export const registerFace = async (imageBlob: Blob): Promise<FaceRegistrationResponse> => {
    const formData = new FormData();
    formData.append('image', imageBlob, 'face.jpg');

    const { data } = await apiClient.post<FaceRegistrationResponse>(
        '/proctoring/register-face/',
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );
    return data;
};

export const useRegisterFace = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (imageBlob: Blob) => registerFace(imageBlob),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['face-status'] });
        },
    });
};

export const getFaceStatus = async (): Promise<FaceStatus> => {
    const { data } = await apiClient.get<FaceStatus>('/proctoring/face-status/');
    return data;
};

export const useFaceStatus = () => {
    return useQuery({
        queryKey: ['face-status'],
        queryFn: getFaceStatus,
    });
};

// ============================================================================
// SNAPSHOT UPLOAD
// ============================================================================

export const uploadSnapshot = async (
    sessionId: string,
    imageBlob: Blob,
    motionScore?: number
): Promise<SnapshotUploadResponse> => {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('image', imageBlob, 'snapshot.jpg');
    if (motionScore !== undefined) {
        formData.append('motion_score', motionScore.toString());
    }

    const { data } = await apiClient.post<SnapshotUploadResponse>(
        '/proctoring/snapshot/',
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );
    return data;
};

export const useUploadSnapshot = () => {
    return useMutation({
        mutationFn: ({
            sessionId,
            imageBlob,
            motionScore
        }: {
            sessionId: string;
            imageBlob: Blob;
            motionScore?: number;
        }) => uploadSnapshot(sessionId, imageBlob, motionScore),
    });
};

// ============================================================================
// SESSION STATUS & VIOLATIONS
// ============================================================================

export const getProctoringStatus = async (sessionId: string): Promise<ProctoringStatus> => {
    const { data } = await apiClient.get<ProctoringStatus>(
        `/proctoring/session/${sessionId}/status/`
    );
    return data;
};

export const useProctoringStatus = (sessionId: string) => {
    return useQuery({
        queryKey: ['proctoring-status', sessionId],
        queryFn: () => getProctoringStatus(sessionId),
        enabled: !!sessionId,
        refetchInterval: 30000,
    });
};

export const getSessionViolations = async (
    sessionId: string,
    includeFalsePositives = false
): Promise<ProctoringViolation[]> => {
    const { data } = await apiClient.get<ProctoringViolation[]>(
        `/proctoring/session/${sessionId}/violations/`,
        {
            params: { include_false_positives: includeFalsePositives }
        }
    );
    return data;
};

export const useSessionViolations = (sessionId: string, includeFalsePositives = false) => {
    return useQuery({
        queryKey: ['proctoring-violations', sessionId, includeFalsePositives],
        queryFn: () => getSessionViolations(sessionId, includeFalsePositives),
        enabled: !!sessionId,
    });
};

// ============================================================================
// VIOLATION ACTIONS
// ============================================================================

export const acknowledgeViolation = async (violationId: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>(
        `/proctoring/violation/${violationId}/acknowledge/`
    );
    return data;
};

export const useAcknowledgeViolation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: acknowledgeViolation,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proctoring-violations'] });
            queryClient.invalidateQueries({ queryKey: ['proctoring-status'] });
        },
    });
};

export const reviewViolation = async (
    violationId: string,
    isFalsePositive: boolean,
    reviewNotes?: string
): Promise<{ message: string; is_false_positive: boolean }> => {
    const { data } = await apiClient.post<{ message: string; is_false_positive: boolean }>(
        `/proctoring/violation/${violationId}/review/`,
        {
            is_false_positive: isFalsePositive,
            review_notes: reviewNotes || '',
        }
    );
    return data;
};

export const useReviewViolation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            violationId,
            isFalsePositive,
            reviewNotes
        }: {
            violationId: string;
            isFalsePositive: boolean;
            reviewNotes?: string;
        }) => reviewViolation(violationId, isFalsePositive, reviewNotes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proctoring-violations'] });
            queryClient.invalidateQueries({ queryKey: ['proctoring-status'] });
        },
    });
};

// ============================================================================
// SESSION END
// ============================================================================

export const endSessionProctoring = async (sessionId: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>(
        `/proctoring/session/${sessionId}/end/`
    );
    return data;
};

export const useEndSessionProctoring = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: endSessionProctoring,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['proctoring-status'] });
            queryClient.invalidateQueries({ queryKey: ['proctoring-violations'] });
        },
    });
};
