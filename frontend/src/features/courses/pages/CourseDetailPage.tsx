import React from 'react';
import { Card, Descriptions, Tag, Typography, Button, Space, Spin, Alert } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useCourse } from '../../../api/courses';
import { CourseStatus } from '../../../types/index';

const { Title, Text } = Typography;

const CourseDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const courseId = id ? parseInt(id, 10) : undefined;

  const { data: course, isLoading, error } = useCourse(courseId!);

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Course Details</Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load course"
          description={(error as any)?.message || 'Please check your connection or login again.'}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!course) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Course Details</Title>
        <Alert
          type="warning"
          showIcon
          message="Course not found"
          description="The course you're looking for doesn't exist or you don't have permission to view it."
        />
      </div>
    );
  }

  const statusColors: Record<CourseStatus, string> = {
    [CourseStatus.DRAFT]: 'default',
    [CourseStatus.PENDING_APPROVAL]: 'orange',
    [CourseStatus.ACTIVE]: 'green',
    [CourseStatus.ARCHIVED]: 'red',
  };

  const statusLabels: Record<CourseStatus, string> = {
    [CourseStatus.DRAFT]: 'Draft',
    [CourseStatus.PENDING_APPROVAL]: 'Pending Approval',
    [CourseStatus.ACTIVE]: 'Active',
    [CourseStatus.ARCHIVED]: 'Archived',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard/courses')}
          >
            Back to Courses
          </Button>
          <Title level={2} style={{ margin: 0 }}>Course Details</Title>
        </Space>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => navigate(`/dashboard/courses/${course.id}/edit`)}
        >
          Edit Course
        </Button>
      </div>

      <Card>
        <Descriptions
          title="Basic Information"
          bordered
          column={2}
          size="small"
        >
          <Descriptions.Item label="Course Code">
            <Text strong>{course.code}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Course Title">
            <Text strong>{course.title}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Department">
            {course.department_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Credits">
            {course.credits}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={statusColors[course.status]}>
              {statusLabels[course.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Assigned Teacher">
            {course.assigned_teacher_email || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Description" span={2}>
            {course.description || 'No description provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {new Date(course.created_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {new Date(course.updated_at).toLocaleString()}
          </Descriptions.Item>
          {course.approved_at && (
            <>
              <Descriptions.Item label="Approved By">
                {course.approved_by_email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Approved At">
                {new Date(course.approved_at).toLocaleString()}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* Additional sections can be added here for enrollments, assessments, etc. */}
      <Card title="Course Statistics" style={{ marginTop: 16 }}>
        <Descriptions column={3}>
          <Descriptions.Item label="Total Enrollments">
            <Text strong>0</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Active Assessments">
            <Text strong>0</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Completion Rate">
            <Text strong>-</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default CourseDetailPage;