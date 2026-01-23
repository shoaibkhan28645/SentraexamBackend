import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Card,
    Button,
    Typography,
    Radio,
    Input,
    Space,
    Modal,
    message,
    Spin,
    Statistic,
    Alert,
    Divider,
    Result,
    Checkbox,
} from 'antd';
import {
    FullscreenOutlined,
    FullscreenExitOutlined,
    StopOutlined,
    CameraOutlined,
} from '@ant-design/icons';
import { useAssessment, useSubmitAssessmentWork, useStartExamSession } from '../../../api/assessments';
import WebcamProctor from '../../../components/WebcamProctor';
import type { WebcamProctorHandle } from '../../../components/WebcamProctor';
import FaceRegistrationModal, { useFaceRegistrationRequired } from '../../../components/FaceRegistrationModal';
import { useVideoRecording } from '../../../hooks/useVideoRecording';
import { useUploadRecording } from '../../../api/proctoring';
import type { ProctoringViolation } from '../../../api/proctoring';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Countdown } = Statistic;

const MAX_WARNINGS = 3;

const ExamTakingPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: assessment, isLoading } = useAssessment(id!);
    const submitMutation = useSubmitAssessmentWork();
    const startSessionMutation = useStartExamSession();
    const uploadRecordingMutation = useUploadRecording();

    const [answers, setAnswers] = useState<(number | string | null)[]>([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cheatingAttempts, setCheatingAttempts] = useState(0);
    const [examStarted, setExamStarted] = useState(false);
    const [examCancelled, setExamCancelled] = useState(false);
    const [deadline, setDeadline] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [proctoringConsent, setProctoringConsent] = useState(false);
    const [proctoringViolations, setProctoringViolations] = useState(0);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [startingSession, setStartingSession] = useState(false);
    const [showFaceRegistration, setShowFaceRegistration] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const isSubmittingRef = useRef(false);
    const webcamRef = useRef<WebcamProctorHandle>(null);

    // Video recording hook
    const { startRecording, stopRecording, isRecording } = useVideoRecording();

    // Check if face registration is required
    const {
        isRequired: isFaceRegistrationRequired,
        isLoading: isLoadingFaceStatus
    } = useFaceRegistrationRequired(
        !!(assessment as any)?.proctoring_settings?.require_face_verification
    );

    // Initialize answers array when assessment loads
    useEffect(() => {
        if (assessment?.questions) {
            setAnswers(new Array(assessment.questions.length).fill(null));

            // Check for existing session
            const storedEndTime = localStorage.getItem(`exam_end_${id}`);
            const storedCancelled = localStorage.getItem(`exam_cancelled_${id}`);

            if (storedCancelled === 'true') {
                setExamCancelled(true);
                setExamStarted(true);
                return;
            }

            if (storedEndTime) {
                const endTimestamp = parseInt(storedEndTime, 10);
                if (endTimestamp > Date.now()) {
                    setDeadline(endTimestamp);
                    setExamStarted(true);
                } else {
                    setDeadline(Date.now());
                }
            }
        }
    }, [assessment, id]);

    // Anti-cheating: Visibility Change & Blur
    useEffect(() => {
        if (!examStarted || examCancelled || isSubmittingRef.current) return;

        const handleVisibilityChange = () => {
            if (document.hidden && !isSubmittingRef.current) {
                handleCheatingAttempt('Tab switching detected!');
            }
        };

        const handleBlur = () => {
            if (!isSubmittingRef.current) {
                handleCheatingAttempt('Window focus lost!');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [examStarted, examCancelled]);

    const handleCheatingAttempt = useCallback((reason: string) => {
        if (examCancelled) return;

        setCheatingAttempts((prevCount) => {
            const newCount = prevCount + 1;

            // Only show warning, never cancel
            Modal.warning({
                title: 'Warning: Suspicious Activity Detected!',
                content: (
                    <div>
                        <p>{reason}</p>
                        <p>You are not allowed to switch tabs or leave the exam window.</p>
                        <p style={{ color: 'red', fontWeight: 'bold' }}>
                            Warning {newCount} - All violations are recorded
                        </p>
                        <p style={{ fontSize: 12, color: '#666' }}>
                            Your teacher will review all violations after submission.
                        </p>
                    </div>
                ),
                okText: 'I Understand',
            });

            return newCount;
        });
    }, [examCancelled]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch((err) => {
                message.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            });
        }
    };

    // Handle proctoring violation from webcam
    const handleProctoringViolation = useCallback((_violation: ProctoringViolation) => {
        setProctoringViolations((prev) => prev + 1);
        // Violations are handled by the WebcamProctor component (warnings)
    }, []);

    // Start recording when camera stream becomes available after exam starts
    useEffect(() => {
        if (examStarted && sessionId && webcamRef.current && !isRecording) {
            // Wait a bit for webcam to initialize
            const timeout = setTimeout(() => {
                const stream = webcamRef.current?.getStream();
                if (stream) {
                    const success = startRecording(stream);
                    if (success) {
                        console.log('Exam video recording started');
                    }
                }
            }, 2000);
            return () => clearTimeout(timeout);
        }
    }, [examStarted, sessionId, isRecording, startRecording]);

    // Start exam
    const startExam = async () => {
        if (!proctoringConsent) {
            message.warning('Please consent to webcam proctoring to start the exam.');
            return;
        }

        if (isLoadingFaceStatus) return;

        // Check for face registration
        if (isFaceRegistrationRequired) {
            setShowFaceRegistration(true);
            return;
        }

        setStartingSession(true);

        try {
            // Call backend to start/resume exam session
            const session = await startSessionMutation.mutateAsync(id!);

            // Set real session ID for proctoring
            setSessionId(session.id);

            // Use server-provided deadline for accurate timing
            const serverDeadline = new Date(session.server_deadline).getTime();
            setDeadline(serverDeadline);
            localStorage.setItem(`exam_end_${id}`, serverDeadline.toString());

            // Restore saved answers if resuming session
            if (session.saved_answers?.length) {
                setAnswers(session.saved_answers);
            }

            // Clear any previous cancelled state
            localStorage.removeItem(`exam_cancelled_${id}`);

            // Enter fullscreen and start exam
            toggleFullscreen();
            setExamStarted(true);
        } catch (error: any) {
            console.error('Failed to start exam session:', error);
            const errorMessage = error.response?.data?.detail ||
                error.response?.data?.[0] ||
                'Failed to start exam. Please try again.';
            message.error(errorMessage);
        } finally {
            setStartingSession(false);
        }
    };

    const handleAnswerChange = (index: number, value: number | string) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    const handleSubmit = useCallback(async () => {
        if (!assessment || submitting || isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setSubmitting(true);

        try {
            // Stop recording and upload video
            if (isRecording && sessionId) {
                const recordingResult = await stopRecording();
                if (recordingResult) {
                    console.log(`Uploading recording: ${recordingResult.duration}s, ${(recordingResult.blob.size / 1024 / 1024).toFixed(2)}MB`);
                    try {
                        await uploadRecordingMutation.mutateAsync({
                            sessionId,
                            videoBlob: recordingResult.blob,
                            duration: recordingResult.duration,
                        });
                        console.log('Recording uploaded successfully');
                    } catch (uploadError) {
                        console.error('Failed to upload recording:', uploadError);
                        // Continue with submission even if upload fails
                    }
                }
            }

            // Prepare answers - ensure all questions have an answer
            const preparedAnswers = answers.map((answer, idx) => {
                const question = assessment.questions?.[idx];
                if (answer === null) {
                    // For unanswered MCQ, send -1 (will be marked wrong)
                    // For unanswered subjective, send empty string
                    return question?.type === 'SUBJECTIVE' ? '' : -1;
                }
                return answer;
            });

            console.log('Submitting exam with answers:', preparedAnswers);

            await submitMutation.mutateAsync({
                assessmentId: assessment.id,
                answers: preparedAnswers,
            });

            message.success('Exam submitted successfully!');

            // Clear local storage
            localStorage.removeItem(`exam_end_${id}`);
            localStorage.removeItem(`exam_cancelled_${id}`);

            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            navigate('/dashboard/assessments');
        } catch (error: any) {
            console.error('Submission error:', error);
            const errorMessage = error.response?.data?.detail ||
                error.response?.data?.answers?.[0] ||
                JSON.stringify(error.response?.data) ||
                'Failed to submit exam';
            message.error(errorMessage);
            isSubmittingRef.current = false;
            setSubmitting(false);
        }
    }, [assessment, submitting, answers, submitMutation, id, navigate, isRecording, sessionId, stopRecording, uploadRecordingMutation]);

    if (isLoading || !assessment) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="Loading Exam..." />
            </div>
        );
    }

    // Show cancelled state
    if (examCancelled) {
        const handleResetExam = () => {
            localStorage.removeItem(`exam_cancelled_${id}`);
            localStorage.removeItem(`exam_end_${id}`);
            setExamCancelled(false);
            setExamStarted(false);
            setCheatingAttempts(0);
            setProctoringViolations(0);
        };

        return (
            <div style={{ maxWidth: 600, margin: '100px auto' }}>
                <Result
                    status="error"
                    icon={<StopOutlined />}
                    title="Exam Cancelled"
                    subTitle="Your exam has been cancelled due to multiple violations of exam rules."
                    extra={[
                        <Button type="primary" key="back" onClick={() => navigate('/dashboard/assessments')}>
                            Return to Assessments
                        </Button>,
                        <Button key="reset" onClick={handleResetExam}>
                            Reset & Try Again
                        </Button>,
                    ]}
                />
            </div>
        );
    }


    if (!examStarted) {
        return (
            <div style={{ maxWidth: 600, margin: '100px auto', textAlign: 'center' }}>
                <Card>
                    <Title level={2}>{assessment.title}</Title>
                    <Paragraph>{assessment.description}</Paragraph>
                    <Divider />
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <Alert
                            message="Exam Rules"
                            description={
                                <ul style={{ textAlign: 'left' }}>
                                    <li>You must stay in fullscreen mode.</li>
                                    <li>Do not switch tabs or open other applications.</li>
                                    <li><strong>After {MAX_WARNINGS} warnings, your exam will be cancelled.</strong></li>
                                    <li>Duration: {assessment.duration_minutes} minutes.</li>
                                </ul>
                            }
                            type="warning"
                            showIcon
                        />
                        <Alert
                            message={
                                <Space>
                                    <CameraOutlined />
                                    <span>Webcam Proctoring Required</span>
                                </Space>
                            }
                            description={
                                <div style={{ textAlign: 'left' }}>
                                    <p>This exam uses AI-powered webcam proctoring to ensure exam integrity.</p>
                                    <ul>
                                        <li>Your webcam will be active throughout the exam.</li>
                                        <li>AI will detect if you look away or if multiple faces are visible.</li>
                                        <li>Snapshots are captured periodically for verification.</li>
                                        {isFaceRegistrationRequired && (
                                            <li><strong>Face registration is required before starting.</strong></li>
                                        )}
                                    </ul>
                                </div>
                            }
                            type="info"
                            showIcon
                        />
                        <div style={{ textAlign: 'left', padding: '12px', background: '#fafafa', borderRadius: 8 }}>
                            <Checkbox
                                checked={proctoringConsent}
                                onChange={(e) => setProctoringConsent(e.target.checked)}
                            >
                                I consent to webcam proctoring during this exam. I understand that my face will be monitored.
                            </Checkbox>
                        </div>
                        <Button
                            type="primary"
                            size="large"
                            onClick={startExam}
                            block
                            disabled={!proctoringConsent || startingSession || isLoadingFaceStatus}
                            loading={startingSession || isLoadingFaceStatus}
                        >
                            {isFaceRegistrationRequired ? 'Register Face & Start Exam' : 'Start Exam'}
                        </Button>
                    </Space>
                </Card>

                <FaceRegistrationModal
                    open={showFaceRegistration}
                    onCancel={() => setShowFaceRegistration(false)}
                    onSuccess={() => {
                        setShowFaceRegistration(false);
                        startExam(); // Retry start after registration
                    }}
                />
            </div>
        );
    }


    return (
        <div
            ref={containerRef}
            style={{
                padding: 24,
                background: '#f0f2f5',
                minHeight: '100vh',
                userSelect: 'none'
            }}
        >
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                {/* Header with Timer and Controls */}
                <Card style={{ marginBottom: 24, position: 'sticky', top: 24, zIndex: 100 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>{assessment.title}</Title>
                            <Text type="secondary">Total Marks: {assessment.total_marks}</Text>
                        </div>
                        <Space size="large" wrap>
                            <div style={{ textAlign: 'center' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Time Remaining</Text>
                                <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                                    <Countdown
                                        value={deadline}
                                        format="HH:mm:ss"
                                        onFinish={handleSubmit}
                                    />
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Warnings</Text>
                                <div style={{
                                    fontSize: 24,
                                    fontWeight: 'bold',
                                    color: cheatingAttempts >= 2 ? 'red' : cheatingAttempts >= 1 ? 'orange' : 'green'
                                }}>
                                    {cheatingAttempts}/{MAX_WARNINGS}
                                </div>
                            </div>
                            {proctoringViolations > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>AI Violations</Text>
                                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
                                        {proctoringViolations}
                                    </div>
                                </div>
                            )}
                            <Button
                                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                                onClick={toggleFullscreen}
                            >
                                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            </Button>
                        </Space>
                    </div>
                </Card>

                {/* Questions List */}
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {assessment.questions?.map((question: any, index: number) => (
                        <Card
                            key={index}
                            title={<Space><Text strong>{index + 1}.</Text><Text>{question.prompt}</Text></Space>}
                            extra={<Text type="secondary">({question.marks || 1} marks)</Text>}
                        >
                            {question.type === 'SUBJECTIVE' ? (
                                <TextArea
                                    rows={6}
                                    placeholder="Type your answer here..."
                                    value={answers[index] as string || ''}
                                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        message.warning('Pasting is not allowed!');
                                    }}
                                />
                            ) : (
                                <Radio.Group
                                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                                    value={answers[index]}
                                >
                                    <Space direction="vertical">
                                        {question.options?.map((option: any, optIndex: number) => (
                                            <Radio key={optIndex} value={optIndex}>
                                                {option.text}
                                            </Radio>
                                        ))}
                                    </Space>
                                </Radio.Group>
                            )}
                        </Card>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, marginBottom: 48 }}>
                        <Button
                            type="primary"
                            size="large"
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={examCancelled}
                        >
                            Submit Exam
                        </Button>
                    </div>
                </Space>
            </div>

            {/* Webcam Proctoring Component */}
            {sessionId && (
                <WebcamProctor
                    ref={webcamRef}
                    sessionId={sessionId}
                    snapshotIntervalSeconds={(assessment as any).proctoring_settings?.snapshot_interval_seconds || 5}
                    motionThreshold={(assessment as any).proctoring_settings?.motion_threshold || 30}
                    requireFaceVerification={!!(assessment as any).proctoring_settings?.require_face_verification}
                    onViolation={handleProctoringViolation}
                    enabled={examStarted && !examCancelled && !submitting}
                />
            )}
        </div>
    );
};

export default ExamTakingPage;
