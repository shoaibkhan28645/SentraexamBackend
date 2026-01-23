import React from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Tag, Spin, Alert, Space } from 'antd';
import {
    BookOutlined,
    TeamOutlined,
    FileTextOutlined,
    CalendarOutlined,
} from '@ant-design/icons';
import { useTeacherDashboard } from '../../api/dashboard';

const { Title, Text } = Typography;

const TeacherDashboard: React.FC = () => {
    const { data, isLoading, error } = useTeacherDashboard();

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

    const courseColumns = [
        {
            title: 'Code',
            dataIndex: 'code',
            key: 'code',
            render: (code: string) => <Text strong>{code}</Text>,
        },
        {
            title: 'Course Title',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Department',
            dataIndex: 'department',
            key: 'department',
            render: (dept: string | null) => dept || '-',
        },
        {
            title: 'Students',
            dataIndex: 'student_count',
            key: 'student_count',
            render: (count: number) => <Tag color="blue">{count}</Tag>,
        },
    ];

    const assessmentColumns = [
        {
            title: 'Assessment',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: 'Course',
            dataIndex: 'course_code',
            key: 'course_code',
            render: (code: string) => <Tag>{code}</Tag>,
        },
        {
            title: 'Type',
            dataIndex: 'assessment_type',
            key: 'assessment_type',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const colors: Record<string, string> = {
                    DRAFT: 'default',
                    SUBMITTED: 'orange',
                    APPROVED: 'blue',
                    SCHEDULED: 'purple',
                    IN_PROGRESS: 'cyan',
                    COMPLETED: 'green',
                };
                return <Tag color={colors[status] || 'default'}>{status}</Tag>;
            },
        },
        {
            title: 'Scheduled',
            dataIndex: 'scheduled_at',
            key: 'scheduled_at',
            render: (date: string | null) =>
                date ? new Date(date).toLocaleDateString() : '-',
        },
        {
            title: 'Submissions',
            dataIndex: 'total_submissions',
            key: 'total_submissions',
        },
    ];

    return (
        <div>
            <Title level={2}>Teacher Dashboard</Title>
            <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
                Overview of your classes and assessments
            </Text>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="My Courses"
                            value={data?.total_courses || 0}
                            prefix={<BookOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="Total Students"
                            value={data?.total_students || 0}
                            prefix={<TeamOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="Assessments"
                            value={data?.assessments?.length || 0}
                            prefix={<FileTextOutlined />}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                    <Card
                        title={
                            <Space>
                                <BookOutlined />
                                <span>My Classes</span>
                            </Space>
                        }
                    >
                        <Table
                            columns={courseColumns}
                            dataSource={data?.courses || []}
                            rowKey="id"
                            pagination={false}
                            size="small"
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card
                        title={
                            <Space>
                                <CalendarOutlined />
                                <span>Recent Assessments</span>
                            </Space>
                        }
                    >
                        <Table
                            columns={assessmentColumns}
                            dataSource={data?.assessments || []}
                            rowKey="id"
                            pagination={{ pageSize: 5 }}
                            size="small"
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default TeacherDashboard;
