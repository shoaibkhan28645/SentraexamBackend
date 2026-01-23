import React from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Tag, Spin, Alert, Space, Progress, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
    BookOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    PlayCircleOutlined,
    CalendarOutlined,
} from '@ant-design/icons';
import { useStudentDashboard } from '../../api/dashboard';
import type { StudentExam } from '../../api/dashboard';

const { Title, Text } = Typography;

const StudentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { data, isLoading, error } = useStudentDashboard();

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <Spin size="large" tip="Loading dashboard..." />
            </div>
        );
    }

    if (error) {
        return (
            <Alert
                type="error"
                message="Failed to load dashboard"
                description="Please try refreshing the page."
                showIcon
            />
        );
    }

    const getStatusTag = (exam: StudentExam) => {
        if (exam.student_status === 'SUBMITTED') {
            return <Tag color="green" icon={<CheckCircleOutlined />}>Submitted</Tag>;
        }
        if (exam.student_status === 'IN_PROGRESS') {
            return <Tag color="orange" icon={<PlayCircleOutlined />}>In Progress</Tag>;
        }
        return <Tag color="blue" icon={<ClockCircleOutlined />}>Not Started</Tag>;
    };

    const examColumns = [
        {
            title: 'Exam',
            dataIndex: 'title',
            key: 'title',
            render: (title: string) => <Text strong>{title}</Text>,
        },
        {
            title: 'Course',
            dataIndex: 'course_code',
            key: 'course_code',
            render: (code: string) => <Tag>{code}</Tag>,
        },
        {
            title: 'Scheduled',
            dataIndex: 'scheduled_at',
            key: 'scheduled_at',
            render: (date: string | null) =>
                date ? new Date(date).toLocaleString() : '-',
        },
        {
            title: 'Duration',
            dataIndex: 'duration_minutes',
            key: 'duration_minutes',
            render: (mins: number) => `${mins} min`,
        },
        {
            title: 'Status',
            key: 'student_status',
            render: (_: any, record: StudentExam) => getStatusTag(record),
        },
        {
            title: 'Action',
            key: 'action',
            render: (_: any, record: StudentExam) => {
                if (record.student_status === 'SUBMITTED') {
                    return <Text type="secondary">Completed</Text>;
                }
                return (
                    <a onClick={() => navigate(`/dashboard/assessments/${record.id}`)}>
                        {record.student_status === 'IN_PROGRESS' ? 'Continue' : 'View'}
                    </a>
                );
            },
        },
    ];

    const enrollmentColumns = [
        {
            title: 'Course Code',
            dataIndex: 'course_code',
            key: 'course_code',
            render: (code: string) => <Text strong>{code}</Text>,
        },
        {
            title: 'Course Title',
            dataIndex: 'course_title',
            key: 'course_title',
        },
        {
            title: 'Teacher',
            dataIndex: 'teacher',
            key: 'teacher',
            render: (teacher: string | null) => teacher || '-',
        },
        {
            title: 'Enrolled',
            dataIndex: 'enrolled_at',
            key: 'enrolled_at',
            render: (date: string | null) =>
                date ? new Date(date).toLocaleDateString() : '-',
        },
    ];

    return (
        <div>
            <Title level={2}>Student Dashboard</Title>
            <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
                Your courses, exams, and progress
            </Text>

            {/* Stats Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="Enrolled Courses"
                            value={data?.total_enrollments || 0}
                            prefix={<BookOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="Upcoming Exams"
                            value={data?.upcoming_exams?.length || 0}
                            prefix={<CalendarOutlined />}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <div style={{ textAlign: 'center' }}>
                            <Text type="secondary">Attendance</Text>
                            {data?.attendance_percentage !== null ? (
                                <Progress
                                    type="circle"
                                    percent={data?.attendance_percentage || 0}
                                    size={80}
                                    style={{ marginTop: 8 }}
                                />
                            ) : (
                                <div style={{ marginTop: 16 }}>
                                    <Text type="secondary">Not available</Text>
                                </div>
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Upcoming Exams */}
            <Card
                title={
                    <Space>
                        <CalendarOutlined />
                        <span>Upcoming Exams</span>
                    </Space>
                }
                style={{ marginBottom: 24 }}
            >
                {data?.upcoming_exams?.length ? (
                    <Table
                        columns={examColumns}
                        dataSource={data.upcoming_exams}
                        rowKey="id"
                        pagination={false}
                        size="small"
                    />
                ) : (
                    <Empty description="No upcoming exams" />
                )}
            </Card>

            {/* Past Exams */}
            <Card
                title={
                    <Space>
                        <CheckCircleOutlined />
                        <span>Past Exams</span>
                    </Space>
                }
                style={{ marginBottom: 24 }}
            >
                {data?.past_exams?.length ? (
                    <Table
                        columns={examColumns}
                        dataSource={data.past_exams}
                        rowKey="id"
                        pagination={{ pageSize: 5 }}
                        size="small"
                    />
                ) : (
                    <Empty description="No past exams" />
                )}
            </Card>

            {/* My Courses */}
            <Card
                title={
                    <Space>
                        <BookOutlined />
                        <span>My Courses</span>
                    </Space>
                }
            >
                {data?.enrollments?.length ? (
                    <Table
                        columns={enrollmentColumns}
                        dataSource={data.enrollments}
                        rowKey="id"
                        pagination={{ pageSize: 5 }}
                        size="small"
                    />
                ) : (
                    <Empty description="Not enrolled in any courses" />
                )}
            </Card>
        </div>
    );
};

export default StudentDashboard;
