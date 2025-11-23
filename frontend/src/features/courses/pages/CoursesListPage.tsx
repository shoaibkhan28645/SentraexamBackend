import React, { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, message, Typography, Alert, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCourses, useDeleteCourse, useApproveCourse } from '../../../api/courses';
import type { Course } from '../../../types/index';
import { CourseStatus } from '../../../types/index';
import type { ColumnType } from 'antd/es/table';

const { Title } = Typography;

const CoursesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useCourses({
    search,
    status: statusFilter,
    page,
  });

  const deleteMutation = useDeleteCourse();
  const approveMutation = useApproveCourse();

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Courses</Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load courses"
          description={(error as any)?.message || 'Please check your connection or login again.'}
        />
      </div>
    );
  }

  const handleDelete = async (course: Course) => {
    try {
      await deleteMutation.mutateAsync(course.id);
      message.success('Course deleted successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to delete course');
    }
  };

  const handleApprove = async (courseId: number) => {
    try {
      await approveMutation.mutateAsync(courseId);
      message.success('Course approved successfully');
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to approve course');
    }
  };

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

  const columns: ColumnType<Course>[] = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a, b) => a.title.localeCompare(b.title),
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      key: 'department',
      render: (name) => name || '-',
    },
    {
      title: 'Credits',
      dataIndex: 'credits',
      key: 'credits',
      align: 'center',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: CourseStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
      filters: [
        { text: 'Draft', value: CourseStatus.DRAFT },
        { text: 'Pending Approval', value: CourseStatus.PENDING_APPROVAL },
        { text: 'Active', value: CourseStatus.ACTIVE },
        { text: 'Archived', value: CourseStatus.ARCHIVED },
      ],
    },
    {
      title: 'Teacher',
      dataIndex: 'assigned_teacher_email',
      key: 'teacher',
      render: (email) => email || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/courses/${record.id}/edit`)}
          >
            Edit
          </Button>
          {record.status === CourseStatus.PENDING_APPROVAL && (
            <Button
              type="link"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record.id)}
              loading={approveMutation.isPending}
            >
              Approve
            </Button>
          )}
          <Popconfirm
            title="Delete Course"
            description={`Are you sure you want to delete ${record.code} - ${record.title}?`}
            okText="Delete"
            okType="danger"
            okButtonProps={{ loading: deleteMutation.isPending }}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Courses</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/dashboard/courses/new')}
        >
          Add Course
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} size="middle">
        <Input
          placeholder="Search courses..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />
        <Select
          placeholder="Filter by status"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
        >
          <Select.Option value={CourseStatus.DRAFT}>Draft</Select.Option>
          <Select.Option value={CourseStatus.PENDING_APPROVAL}>Pending Approval</Select.Option>
          <Select.Option value={CourseStatus.ACTIVE}>Active</Select.Option>
          <Select.Option value={CourseStatus.ARCHIVED}>Archived</Select.Option>
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
          showTotal: (total) => `Total ${total} courses`,
        }}
      />
    </div>
  );
};

export default CoursesListPage;