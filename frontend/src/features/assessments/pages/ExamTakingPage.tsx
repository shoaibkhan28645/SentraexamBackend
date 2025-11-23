import React, { useState, useEffect, useRef } from 'react';
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
} from 'antd';
import {
    FullscreenOutlined,
    FullscreenExitOutlined,
} from '@ant-design/icons';
import { useAssessment, useSubmitAssessmentWork } from '../../../api/assessments';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Countdown } = Statistic;

const ExamTakingPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: assessment, isLoading } = useAssessment(id!);
    const submitMutation = useSubmitAssessmentWork();

    const [answers, setAnswers] = useState<(number | string | null)[]>([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cheatingAttempts, setCheatingAttempts] = useState(0);
    const [examStarted, setExamStarted] = useState(false);
    const [deadline, setDeadline] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize answers array when assessment loads
    useEffect(() => {
        if (assessment?.questions) {
            setAnswers(new Array(assessment.questions.length).fill(null));

            // Check for existing session
            const storedEndTime = localStorage.getItem(`exam_end_${id}`);
            if (storedEndTime) {
                const endTimestamp = parseInt(storedEndTime, 10);
                if (endTimestamp > Date.now()) {
                    setDeadline(endTimestamp);
                    setExamStarted(true); // Auto-resume if time remains
                } else {
                    // Time expired
                    setDeadline(Date.now()); // Set to now so it shows 0
                    // Optionally auto-submit if time expired while away
                }
            } else {
                // Will be set when exam starts
            }
        }
    }, [assessment, id]);

    // Anti-cheating: Visibility Change & Blur
    useEffect(() => {
        if (!examStarted) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                handleCheatingAttempt('Tab switching detected!');
            }
        };

        const handleBlur = () => {
            handleCheatingAttempt('Window focus lost!');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [examStarted]);

    const handleCheatingAttempt = (reason: string) => {
        setCheatingAttempts((prev) => {
            const newCount = prev + 1;
            Modal.warning({
                title: 'Cheating Detected!',
                content: (
                    <div>
                        <p>{reason}</p>
                        <p>You are not allowed to switch tabs or leave the exam window.</p>
                        <p style={{ color: 'red', fontWeight: 'bold' }}>
                            Warning {newCount}/3
                        </p>
                    </div>
                ),
                okText: 'I Understand',
            });

            if (newCount >= 3) {
                message.error('Too many violations. Exam will be submitted automatically.');
                // Use setTimeout to break out of the state update cycle and ensure submit runs
                setTimeout(() => {
                    handleSubmit();
                }, 1000);
            }
            return newCount;
        });
    };

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

    // Enforce fullscreen to start
    const startExam = () => {
        toggleFullscreen();
        setExamStarted(true);

        // Set end time in localStorage
        const endTime = Date.now() + assessment!.duration_minutes * 60 * 1000;
        localStorage.setItem(`exam_end_${id}`, endTime.toString());
        setDeadline(endTime);
    };

    const handleAnswerChange = (index: number, value: number | string) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    const handleSubmit = async () => {
        if (!assessment || submitting) return;
        setSubmitting(true);

        try {
            await submitMutation.mutateAsync({
                assessmentId: assessment.id,
                answers: answers as any[], // Backend handles mixed types now
            });
            message.success('Exam submitted successfully!');

            // Clear local storage
            localStorage.removeItem(`exam_end_${id}`);

            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            navigate('/dashboard/assessments');
        } catch (error: any) {
            message.error(error.response?.data?.detail || 'Failed to submit exam');
            setSubmitting(false);
        }
    };

    if (isLoading || !assessment) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="Loading Exam..." />
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
                                    <li>Violations will be recorded and may lead to disqualification.</li>
                                    <li>Duration: {assessment.duration_minutes} minutes.</li>
                                </ul>
                            }
                            type="warning"
                            showIcon
                        />
                        <Button type="primary" size="large" onClick={startExam} block>
                            Start Exam
                        </Button>
                    </Space>
                </Card>
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
                userSelect: 'none' // Prevent copy-pasting
            }}
        >
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                {/* Header with Timer and Controls */}
                <Card style={{ marginBottom: 24, position: 'sticky', top: 24, zIndex: 100 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>{assessment.title}</Title>
                            <Text type="secondary">Total Marks: {assessment.total_marks}</Text>
                        </div>
                        <Space size="large">
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
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: cheatingAttempts > 0 ? 'red' : 'green' }}>
                                    {cheatingAttempts}/3
                                </div>
                            </div>
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
                                    value={answers[index] as string}
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
                        <Button type="primary" size="large" onClick={handleSubmit} loading={submitting}>
                            Submit Exam
                        </Button>
                    </div>
                </Space>
            </div>
        </div>
    );
};

export default ExamTakingPage;
