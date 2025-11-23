import React, { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, message, Typography, Alert, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CheckOutlined, CalendarOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import {
  useAssessments,
  useDeleteAssessment,
  useApproveAssessment,
  useSubmitAssessmentForApproval,
} from '../../../api/assessments';
import type { Assessment } from '../../../types/index';
import {
  AssessmentStatus,
  AssessmentType,
  AssessmentSubmissionFormat,
  UserRole,
} from '../../../types/index';
import type { ColumnType } from 'antd/es/table';

const { Title } = Typography;

const AssessmentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useAssessments({
    search,
    status: statusFilter,
    assessment_type: typeFilter,
    page,
  });

  const deleteMutation = useDeleteAssessment();
  const approveMutation = useApproveAssessment();
  const submitMutation = useSubmitAssessmentForApproval();

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Assessments</Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load assessments"
          description={(error as any)?.message || 'Please check your connection or login again.'}
        />
      </div>
    );
  }

  const handleDelete = async (assessment: Assessment) => {
    try {
      await deleteMutation.mutateAsync(assessment.id);
      message.success('Assessment deleted successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to delete assessment');
    }
  };

  const handleApprove = async (assessmentId: string) => {
    try {
      await approveMutation.mutateAsync(assessmentId);
      message.success('Assessment approved successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to approve assessment');
    }
  };

  const handleSubmitForApproval = async (assessmentId: string) => {
    try {
      await submitMutation.mutateAsync(assessmentId);
      message.success('Assessment submitted for approval');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to submit assessment for approval');
    }
  };

  const statusColors: Record<AssessmentStatus, string> = {
    [AssessmentStatus.DRAFT]: 'default',
    [AssessmentStatus.SUBMITTED]: 'orange',
    [AssessmentStatus.APPROVED]: 'blue',
    [AssessmentStatus.SCHEDULED]: 'purple',
    [AssessmentStatus.IN_PROGRESS]: 'cyan',
    [AssessmentStatus.COMPLETED]: 'green',
    [AssessmentStatus.CANCELLED]: 'red',
  };

  const statusLabels: Record<AssessmentStatus, string> = {
    [AssessmentStatus.DRAFT]: 'Draft',
    [AssessmentStatus.SUBMITTED]: 'Submitted',
    [AssessmentStatus.APPROVED]: 'Approved',
    [AssessmentStatus.SCHEDULED]: 'Scheduled',
    [AssessmentStatus.IN_PROGRESS]: 'In Progress',
    [AssessmentStatus.COMPLETED]: 'Completed',
    [AssessmentStatus.CANCELLED]: 'Cancelled',
  };

  const typeLabels: Record<AssessmentType, string> = {
    [AssessmentType.EXAM]: 'Exam',
    [AssessmentType.QUIZ]: 'Quiz',
    [AssessmentType.ASSIGNMENT]: 'Assignment',
    [AssessmentType.PROJECT]: 'Project',
  };

  const submissionFormatLabels: Record<AssessmentSubmissionFormat, string> = {
    [AssessmentSubmissionFormat.ONLINE]: 'Online Exam',
    [AssessmentSubmissionFormat.TEXT]: 'Text Response',
    [AssessmentSubmissionFormat.FILE]: 'File Upload',
    [AssessmentSubmissionFormat.TEXT_AND_FILE]: 'Text + File',
  };

  const columns: ColumnType<Assessment>[] = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
    },
    {
      title: 'Course',
      dataIndex: 'course_code',
      key: 'course',
      render: (code) => code || '-',
    },
    {
      title: 'Type',
      dataIndex: 'assessment_type',
      key: 'type',
      render: (type: AssessmentType) => (
        <Tag>{typeLabels[type]}</Tag>
      ),
      filters: [
        { text: 'Exam', value: AssessmentType.EXAM },
        { text: 'Quiz', value: AssessmentType.QUIZ },
        { text: 'Assignment', value: AssessmentType.ASSIGNMENT },
        { text: 'Project', value: AssessmentType.PROJECT },
      ],
    },
    {
      title: 'Submission',
      dataIndex: 'submission_format',
      key: 'submission_format',
      render: (format: AssessmentSubmissionFormat) => submissionFormatLabels[format],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: AssessmentStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
      filters: [
        { text: 'Draft', value: AssessmentStatus.DRAFT },
        { text: 'Submitted', value: AssessmentStatus.SUBMITTED },
        { text: 'Approved', value: AssessmentStatus.APPROVED },
        { text: 'Scheduled', value: AssessmentStatus.SCHEDULED },
        { text: 'In Progress', value: AssessmentStatus.IN_PROGRESS },
        { text: 'Completed', value: AssessmentStatus.COMPLETED },
        { text: 'Cancelled', value: AssessmentStatus.CANCELLED },
      ],
    },
    {
      title: 'Duration',
      dataIndex: 'duration_minutes',
      key: 'duration',
      render: (minutes) => minutes ? `${minutes} min` : '-',
      align: 'center',
    },
    {
      title: 'Total Marks',
      dataIndex: 'total_marks',
      key: 'marks',
      render: (marks) => marks || '-',
      align: 'center',
    },
    {
      title: 'Scheduled',
      dataIndex: 'scheduled_at',
      key: 'scheduled',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/assessments/${record.id}/edit`)}
          >
            Edit
          </Button>
          {record.status === AssessmentStatus.DRAFT && (
            <Button
              type="link"
              icon={<CheckOutlined />}
              onClick={() => handleSubmitForApproval(record.id)}
              loading={submitMutation.isPending}
            >
              Submit
            </Button>
          )}
          {record.status === AssessmentStatus.SUBMITTED && (
            <Button
              type="link"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record.id)}
              loading={approveMutation.isPending}
            >
              Approve
            </Button>
          )}
          {record.status === AssessmentStatus.APPROVED && (
            <Button
              type="link"
              icon={<CalendarOutlined />}
              onClick={() => navigate(`/dashboard/assessments/${record.id}/schedule`)}
            >
              Schedule
            </Button>
          )}
          <Popconfirm
            title="Delete Assessment"
            description={`Are you sure you want to delete ${record.title}?`}
            okText="Delete"
            okType="danger"
            okButtonProps={{ loading: deleteMutation.isPending }}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
          {user?.role === UserRole.STUDENT && record.submission_format === AssessmentSubmissionFormat.ONLINE && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => navigate(`/dashboard/assessments/${record.id}/take`)}
            >
              Take
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Assessments</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/dashboard/assessments/new')}
        >
          Add Assessment
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} size="middle">
        <Input
          placeholder="Search assessments..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />
        <Select
          placeholder="Filter by status"
          style={{ width: 150 }}
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
        >
          <Select.Option value={AssessmentStatus.DRAFT}>Draft</Select.Option>
          <Select.Option value={AssessmentStatus.SUBMITTED}>Submitted</Select.Option>
          <Select.Option value={AssessmentStatus.APPROVED}>Approved</Select.Option>
          <Select.Option value={AssessmentStatus.SCHEDULED}>Scheduled</Select.Option>
          <Select.Option value={AssessmentStatus.IN_PROGRESS}>In Progress</Select.Option>
          <Select.Option value={AssessmentStatus.COMPLETED}>Completed</Select.Option>
          <Select.Option value={AssessmentStatus.CANCELLED}>Cancelled</Select.Option>
        </Select>
        <Select
          placeholder="Filter by type"
          style={{ width: 150 }}
          value={typeFilter}
          onChange={setTypeFilter}
          allowClear
        >
          <Select.Option value={AssessmentType.EXAM}>Exam</Select.Option>
          <Select.Option value={AssessmentType.QUIZ}>Quiz</Select.Option>
          <Select.Option value={AssessmentType.ASSIGNMENT}>Assignment</Select.Option>
          <Select.Option value={AssessmentType.PROJECT}>Project</Select.Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={data?.results || []}
        loading={isLoading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.count || 0,
          onChange: (newPage) => setPage(newPage),
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} assessments`,
        }}
      />
    </div>
  );
};

export default AssessmentsListPage;
