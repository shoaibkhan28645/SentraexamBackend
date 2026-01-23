import React from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Tag, Spin, Alert, Space } from 'antd';
import {
    UserOutlined,
    TeamOutlined,
    CrownOutlined,
    ReadOutlined,
    BankOutlined,
    FileTextOutlined,
    CheckSquareOutlined,
} from '@ant-design/icons';
import { useAdminDashboard } from '../../api/dashboard';

const { Title, Text } = Typography;

const AdminDashboard: React.FC = () => {
    const { data, isLoading, error } = useAdminDashboard();

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

    const userColumns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => <Text strong>{name}</Text>,
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => {
                const colors: Record<string, string> = {
                    ADMIN: 'red',
                    HOD: 'purple',
                    TEACHER: 'blue',
                    STUDENT: 'green',
                };
                return <Tag color={colors[role] || 'default'}>{role}</Tag>;
            },
        },
        {
            title: 'Department',
            dataIndex: 'department',
            key: 'department',
            render: (dept: string | null) => dept || '-',
        },
        {
            title: 'Status',
            dataIndex: 'is_active',
            key: 'is_active',
            render: (active: boolean) =>
                active ? (
                    <Tag color="green">Active</Tag>
                ) : (
                    <Tag color="red">Inactive</Tag>
                ),
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string | null) =>
                date ? new Date(date).toLocaleDateString() : '-',
        },
    ];

    const departmentColumns = [
        {
            title: 'Department',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => <Text strong>{name}</Text>,
        },
        {
            title: 'Code',
            dataIndex: 'code',
            key: 'code',
            render: (code: string) => <Tag>{code}</Tag>,
        },
        {
            title: 'Users',
            dataIndex: 'user_count',
            key: 'user_count',
        },
        {
            title: 'Courses',
            dataIndex: 'course_count',
            key: 'course_count',
        },
    ];

    return (
        <div>
            <Title level={2}>Administrator Dashboard</Title>
            <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
                System overview and user management
            </Text>

            {/* User Stats Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={8} lg={4}>
                    <Card>
                        <Statistic
                            title="Total Users"
                            value={data?.user_counts?.total || 0}
                            prefix={<TeamOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8} lg={4}>
                    <Card>
                        <Statistic
                            title="Admins"
                            value={data?.user_counts?.admins || 0}
                            prefix={<CrownOutlined />}
                            valueStyle={{ color: '#cf1322' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8} lg={4}>
                    <Card>
                        <Statistic
                            title="HODs"
                            value={data?.user_counts?.hods || 0}
                            prefix={<UserOutlined />}
                            valueStyle={{ color: '#722ed1' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8} lg={4}>
                    <Card>
                        <Statistic
                            title="Teachers"
                            value={data?.user_counts?.teachers || 0}
                            prefix={<ReadOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8} lg={4}>
                    <Card>
                        <Statistic
                            title="Students"
                            value={data?.user_counts?.students || 0}
                            prefix={<TeamOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8} lg={4}>
                    <Card>
                        <Statistic
                            title="Departments"
                            value={data?.total_departments || 0}
                            prefix={<BankOutlined />}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* System Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12}>
                    <Card>
                        <Statistic
                            title="Total Assessments"
                            value={data?.total_assessments || 0}
                            prefix={<FileTextOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12}>
                    <Card>
                        <Statistic
                            title="Total Submissions"
                            value={data?.total_submissions || 0}
                            prefix={<CheckSquareOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Recent Users */}
            <Card
                title={
                    <Space>
                        <UserOutlined />
                        <span>Recent Registrations</span>
                    </Space>
                }
                style={{ marginBottom: 24 }}
            >
                <Table
                    columns={userColumns}
                    dataSource={data?.recent_users || []}
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    size="small"
                />
            </Card>

            {/* Departments */}
            <Card
                title={
                    <Space>
                        <BankOutlined />
                        <span>Departments Overview</span>
                    </Space>
                }
            >
                <Table
                    columns={departmentColumns}
                    dataSource={data?.departments || []}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                />
            </Card>
        </div>
    );
};

export default AdminDashboard;
