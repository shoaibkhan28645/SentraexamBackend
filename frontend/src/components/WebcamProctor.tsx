import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle, useLayoutEffect } from 'react';
import { Alert, Badge, Space, Typography, Modal, Tooltip } from 'antd';
import {
    CameraOutlined,
    EyeOutlined,
    WarningOutlined,
    ExclamationCircleOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { useUploadSnapshot, useEndSessionProctoring } from '../api/proctoring';
import type { ProctoringViolation, GazeResult } from '../api/proctoring';

const { Text } = Typography;

interface WebcamProctorProps {
    sessionId: string;
    snapshotIntervalSeconds?: number;
    motionThreshold?: number;
    onViolation?: (violation: ProctoringViolation) => void;
    onTerminated?: () => void;
    enabled?: boolean;
    requireFaceVerification?: boolean;
}

// Expose these methods via ref to parent components
export interface WebcamProctorHandle {
    getStream: () => MediaStream | null;
    isStreamingState: () => boolean;
}

interface MotionDetector {
    lastFrameData: ImageData | null;
    calculateMotion: (canvas: HTMLCanvasElement) => number;
}

const createMotionDetector = (): MotionDetector => {
    let lastFrameData: ImageData | null = null;

    return {
        get lastFrameData() {
            return lastFrameData;
        },
        calculateMotion(canvas: HTMLCanvasElement): number {
            const ctx = canvas.getContext('2d');
            if (!ctx) return 0;

            const currentFrameData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            if (!lastFrameData) {
                lastFrameData = currentFrameData;
                return 0;
            }

            // Compare pixels
            let diffCount = 0;
            const threshold = 30; // pixel difference threshold
            const data1 = lastFrameData.data;
            const data2 = currentFrameData.data;

            for (let i = 0; i < data1.length; i += 4) {
                const rDiff = Math.abs(data1[i] - data2[i]);
                const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
                const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
                const avgDiff = (rDiff + gDiff + bDiff) / 3;

                if (avgDiff > threshold) {
                    diffCount++;
                }
            }

            lastFrameData = currentFrameData;

            // Return percentage of pixels that changed
            const totalPixels = canvas.width * canvas.height;
            return (diffCount / totalPixels) * 100;
        },
    };
};

const WebcamProctor = forwardRef<WebcamProctorHandle, WebcamProctorProps>(({
    sessionId,
    snapshotIntervalSeconds = 5,
    motionThreshold = 30,
    onViolation,
    enabled = true,
    requireFaceVerification = true,
}, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const motionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const motionDetectorRef = useRef<MotionDetector>(createMotionDetector());
    const lastCaptureTimeRef = useRef<number>(0);

    const [isStreamingState, setisStreamingState] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [violationCount, setViolationCount] = useState(0);
    const [lastViolation, setLastViolation] = useState<ProctoringViolation | null>(null);
    const [lastViolationMessage, setLastViolationMessage] = useState<string | null>(null);
    const [currentGaze, setCurrentGaze] = useState<GazeResult | null>(null);
    const [faceVerified, setFaceVerified] = useState(true);
    const [faceVerificationConfidence, setFaceVerificationConfidence] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const uploadMutation = useUploadSnapshot();
    const endProctoringMutation = useEndSessionProctoring();

    // Expose stream access to parent components via ref
    useImperativeHandle(ref, () => ({
        getStream: () => streamRef.current,
        isStreamingState: () => isStreamingState,
    }), [isStreamingState]);

    // Start webcam stream
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                    frameRate: { ideal: 15 },
                },
                audio: false,
            });

            console.log('Camera stream acquired', { hasVideoRef: !!videoRef.current });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setisStreamingState(true);
                setCameraError(null);
                console.log('Stream assigned to video element, setisStreamingState(true) called');
            } else {
                console.error('Video ref is null, cannot start streaming state');
            }
        } catch (error: any) {
            console.error('Camera error:', error);
            setCameraError(
                error.name === 'NotAllowedError'
                    ? 'Camera permission denied. Please allow camera access for proctoring.'
                    : 'Failed to access camera. Please check your camera settings.'
            );
        }
    }, []);

    // Stop webcam stream
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setisStreamingState(false);
    }, []);

    // Calculate motion score
    const getMotionScore = useCallback((): number => {
        if (!canvasRef.current) return 0;
        return motionDetectorRef.current.calculateMotion(canvasRef.current);
    }, []);

    // Capture and upload snapshot
    const captureSnapshot = useCallback(
        async (motionScore: number = 0) => {
            // console.log("captureSnapshot called", { motionScore });

            if (!videoRef.current || !canvasRef.current || !isStreamingState || !sessionId) {
                console.log("Skipping snapshot: Missing refs or state", {
                    hasVideo: !!videoRef.current,
                    hasCanvas: !!canvasRef.current,
                    isStreaming: isStreamingState,
                    hasSession: !!sessionId
                });
                return;
            }

            // Prevent too frequent captures (min 2 seconds)
            const now = Date.now();
            if (now - lastCaptureTimeRef.current < 2000) {
                return;
            }
            lastCaptureTimeRef.current = now;

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (!context) return;

            // Set canvas size to match video
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;

            // Draw current video frame to canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas to blob
            canvas.toBlob(
                async (blob) => {
                    if (!blob || isUploading) return;

                    setIsUploading(true);
                    console.log(`[WebcamProctor] Uploading snapshot... Motion: ${motionScore}`);

                    try {
                        const response = await uploadMutation.mutateAsync({
                            sessionId,
                            imageBlob: blob,
                            motionScore,
                        });

                        console.log('[WebcamProctor] Snapshot uploaded. Response:', response);

                        // Update gaze result
                        if (response.gaze_result) {
                            setCurrentGaze(response.gaze_result);
                        }

                        // Update face verification status
                        setFaceVerified(response.face_verified);
                        setFaceVerificationConfidence(response.face_verification_confidence);

                        // Handle violations
                        if (response.violations.length > 0) {
                            console.log('[WebcamProctor] Violations detected:', response.violations);
                            setViolationCount(response.total_violations);
                            setLastViolation(response.violations[0]);

                            response.violations.forEach((v) => {
                                onViolation?.(v);
                                showViolationWarning(v);
                            });
                        }

                        // Debugging total violations count update
                        if (response.total_violations !== violationCount) {
                            console.log(`[WebcamProctor] Updating total violations: ${violationCount} -> ${response.total_violations}`);
                            setViolationCount(response.total_violations);
                        }

                        // Check if violations exceeded
                        if (response.violations_exceeded) {
                            Modal.error({
                                title: 'Violation Limit Exceeded',
                                content: (
                                    <div>
                                        <p>
                                            You have exceeded the maximum number of violations (
                                            {response.total_violations}).
                                        </p>
                                        <p>Your exam session may be flagged for review.</p>
                                    </div>
                                ),
                                okText: 'I Understand',
                                centered: true,
                            });
                        }
                    } catch (error) {
                        console.error('[WebcamProctor] Failed to upload snapshot:', error);
                    } finally {
                        setIsUploading(false);
                    }
                },
                'image/jpeg',
                0.85
            );
        },
        [isStreamingState, sessionId, uploadMutation, onViolation, isUploading, violationCount]
    );

    // Use stable ref for captureSnapshot to avoid resetting intervals
    const captureSnapshotRef = useRef(captureSnapshot);
    useLayoutEffect(() => {
        captureSnapshotRef.current = captureSnapshot;
    });

    // Show violation warning modal
    const showViolationWarning = (violation: ProctoringViolation) => {
        const messages: Record<string, string> = {
            NO_FACE: 'Your face is not visible. Please position yourself in front of the camera.',
            MULTIPLE_FACES: 'Multiple faces detected! Only the exam taker should be visible.',
            LOOKING_AWAY: `You appear to be looking ${violation.details?.direction || 'away'}. Please keep your eyes on the screen.`,
            FACE_NOT_MATCHED: '⚠️ Face verification failed! Please ensure you are the registered student.',
            OBJECT_DETECTED: 'Suspicious object detected. Please remove any unauthorized items.',
            PHONE_DETECTED: '📱 Phone detected! Remove all mobile devices from the camera view.',
            BOOK_DETECTED: '📚 Book or notes detected! Remove all study materials from view.',
            LAPTOP_DETECTED: '💻 Secondary device detected! Only one screen allowed during exam.',
            PERSON_LEFT: '⚠️ You have left the camera frame. Please return to your position.',
            INTERMITTENT_FACE: '⚠️ Your face keeps disappearing. Please stay in frame.',
            PERSISTENT_GAZE_AWAY: '👀 You have been looking away consistently. Please focus on the exam.',
            MULTIPLE_PERSONS_PATTERN: '👥 Multiple people have been detected helping you.',
            IDENTITY_MISMATCH_PATTERN: '🚨 Face verification has failed multiple times. Identity mismatch suspected.',
        };

        const violationMessage = messages[violation.violation_type] || 'Proctoring violation detected.';
        setLastViolationMessage(violationMessage);

        // Show severity-appropriate modal
        const isSevere = violation.severity >= 4;

        Modal[isSevere ? 'error' : 'warning']({
            title: (
                <Space>
                    <ExclamationCircleOutlined style={{ color: isSevere ? '#ff4d4f' : '#faad14' }} />
                    {isSevere ? 'Serious Violation Detected' : 'AI Proctoring Warning'}
                </Space>
            ),
            content: (
                <div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>{violationMessage}</p>
                    <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                        This is violation #{violationCount + 1}. Excessive violations may result in exam
                        disqualification.
                    </p>
                    {violation.confidence_score && (
                        <p style={{ color: '#888', fontSize: 12 }}>
                            Detection confidence: {(violation.confidence_score * 100).toFixed(0)}%
                        </p>
                    )}
                </div>
            ),
            okText: 'I Understand',
            centered: true,
        });
    };

    // Motion detection loop
    useEffect(() => {
        if (isStreamingState && enabled) {
            motionIntervalRef.current = setInterval(() => {
                const motionScore = getMotionScore();

                // If significant motion detected, capture immediately
                if (motionScore > motionThreshold) {
                    console.log(`Motion detected: ${motionScore.toFixed(1)}%`);
                    captureSnapshotRef.current(motionScore);
                }
            }, 500); // Check motion every 500ms

            return () => {
                if (motionIntervalRef.current) {
                    clearInterval(motionIntervalRef.current);
                }
            };
        }
    }, [isStreamingState, enabled, getMotionScore, motionThreshold]);

    // Regular snapshot interval
    useEffect(() => {
        console.log('Snapshot interval effect triggered', { isStreamingState, enabled });
        if (isStreamingState && enabled) {
            // Capture first snapshot after 3 seconds
            const initialTimeout = setTimeout(() => {
                captureSnapshotRef.current(0);
            }, 3000);

            // Then capture at regular intervals
            intervalRef.current = setInterval(
                () => captureSnapshotRef.current(0),
                snapshotIntervalSeconds * 1000
            );

            return () => {
                clearTimeout(initialTimeout);
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        }
    }, [isStreamingState, enabled, snapshotIntervalSeconds]);

    // Note: Video recording is now handled by parent component via useVideoRecording hook
    // and accessing the stream via ref.getStream()

    // Track sessionId in ref for cleanup
    const sessionIdRef = useRef<string | null>(null);
    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);

    // Start camera on mount
    useEffect(() => {
        if (enabled) {
            console.log('WebcamProctor: Starting camera, enabled=', enabled);
            startCamera();
        }

        return () => {
            console.log('WebcamProctor: Cleanup running');
            stopCamera();
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (motionIntervalRef.current) {
                clearInterval(motionIntervalRef.current);
            }
        };
        // Note: intentionally minimal deps to prevent cleanup on every render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // Separate effect for session cleanup on actual unmount
    useEffect(() => {
        return () => {
            // This cleanup only runs on actual component unmount
            if (sessionIdRef.current) {
                console.log('WebcamProctor: Ending proctoring session on unmount');
                endProctoringMutation.mutate(sessionIdRef.current);
            }
        };
        // Empty deps = only runs on unmount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (cameraError) {
        return (
            <Alert
                type="error"
                message="Camera Required"
                description={cameraError}
                showIcon
                icon={<CameraOutlined />}
            />
        );
    }

    // Determine gaze indicator color
    const getGazeColor = () => {
        if (!currentGaze) return '#52c41a';
        if (currentGaze.is_looking_away) return '#ff4d4f';
        return '#52c41a';
    };

    // Get gaze direction display
    const getGazeDisplay = () => {
        if (!currentGaze) return 'Detecting...';
        if (currentGaze.direction === 'center') return '👀 Focused';
        return `⚠️ Looking ${currentGaze.direction}`;
    };

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 1000,
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                width: 200,
            }}
        >
            {/* Video preview */}
            <div style={{ position: 'relative', width: '100%', height: 150 }}>
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                    }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Status indicators */}
                <div
                    style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                    }}
                >
                    <Badge
                        status={isStreamingState ? 'processing' : 'default'}
                        color={isStreamingState ? '#52c41a' : '#999'}
                    />
                    <Text style={{ color: '#fff', fontSize: 11, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                        {isUploading ? 'Analyzing...' : 'Live'}
                    </Text>
                </div>

                {/* Face verification indicator */}
                {requireFaceVerification && (
                    <Tooltip title={faceVerified ? 'Identity verified' : 'Identity mismatch!'}>
                        <div
                            style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                background: faceVerified ? 'rgba(82, 196, 26, 0.9)' : 'rgba(255, 77, 79, 0.9)',
                                borderRadius: 12,
                                padding: '2px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            <UserOutlined style={{ color: '#fff', fontSize: 12 }} />
                            {faceVerificationConfidence > 0 && (
                                <Text style={{ color: '#fff', fontSize: 10 }}>
                                    {(faceVerificationConfidence * 100).toFixed(0)}%
                                </Text>
                            )}
                        </div>
                    </Tooltip>
                )}

                {/* Proctoring indicator */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                    }}
                >
                    <EyeOutlined style={{ color: getGazeColor(), fontSize: 20 }} />
                </div>
            </div>

            {/* Status panel */}
            <div
                style={{
                    padding: '10px 12px',
                    background: violationCount >= 3 ? '#2a0000' : violationCount > 0 ? '#fff1f0' : '#f6ffed',
                    borderTop: '1px solid #f0f0f0',
                }}
            >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    {/* Suspicious indicator when violations >= 3 */}
                    {violationCount >= 3 && (
                        <div
                            style={{
                                background: 'linear-gradient(90deg, #ff4d4f 0%, #cf1322 100%)',
                                borderRadius: 6,
                                padding: '6px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                animation: 'pulse 1.5s ease-in-out infinite',
                            }}
                        >
                            <ExclamationCircleOutlined style={{ color: '#fff', fontSize: 14 }} />
                            <Text strong style={{ color: '#fff', fontSize: 13, letterSpacing: 1 }}>
                                SUSPICIOUS
                            </Text>
                        </div>
                    )}

                    {/* Gaze status */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ fontSize: 12, color: violationCount >= 3 ? '#ff7875' : getGazeColor() }}>{getGazeDisplay()}</Text>
                    </div>

                    {/* Violation counter */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        {violationCount > 0 && <WarningOutlined style={{ color: '#ff4d4f' }} />}
                        <Text
                            type={violationCount > 0 ? 'danger' : 'secondary'}
                            style={{ fontSize: 12, color: violationCount >= 3 ? '#ff7875' : undefined }}
                        >
                            {violationCount > 0 ? `⚠️ ${violationCount} warnings` : '✓ Proctoring active'}
                        </Text>
                    </div>

                    {/* Last violation preview */}
                    {lastViolationMessage && violationCount > 0 && (
                        <Text type="danger" style={{ fontSize: 10, lineHeight: 1.2, color: violationCount >= 3 ? '#ff7875' : undefined }}>
                            {lastViolationMessage.substring(0, 50)}...
                        </Text>
                    )}
                </Space>
            </div>
        </div>
    );
});

WebcamProctor.displayName = 'WebcamProctor';

export default WebcamProctor;
