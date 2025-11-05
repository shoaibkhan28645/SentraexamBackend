import React from 'react';
import { Card, Row, Col, Statistic, Typography, Skeleton } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../api/users';
import { useDepartments } from '../api/departments';
import { useCourses } from '../api/courses';
import { useAssessments } from '../api/assessments';

const { Title } = Typography;

const DashboardHome: React.FC = () => {
  const { user } = useAuth();
  const { data: usersData, isLoading: usersLoading } = useUsers({ page: 1 });
  const { data: deptsData, isLoading: deptsLoading } = useDepartments({ page: 1 });
  const { data: coursesData, isLoading: coursesLoading } = useCourses({ page: 1 });
  const { data: assessmentsData, isLoading: assessLoading } = useAssessments({ page: 1 });

  return (
    <div>
      <Title level={2}>Welcome, {user?.first_name}!</Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        Here's an overview of your academic dashboard
      </p>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            {usersLoading ? (
              <Skeleton active paragraph={false} />
            ) : (
              <Statistic
                title="Total Users"
                value={usersData?.count ?? 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            {deptsLoading ? (
              <Skeleton active paragraph={false} />
            ) : (
              <Statistic
                title="Departments"
                value={deptsData?.count ?? 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            {coursesLoading ? (
              <Skeleton active paragraph={false} />
            ) : (
              <Statistic
                title="Active Courses"
                value={coursesData?.count ?? 0}
                prefix={<BookOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            {assessLoading ? (
              <Skeleton active paragraph={false} />
            ) : (
              <Statistic
                title="Assessments"
                value={assessmentsData?.count ?? 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Recent Activity" bordered={false}>
            <p>No recent activity</p>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Upcoming Events" bordered={false}>
            <p>No upcoming events</p>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardHome;
