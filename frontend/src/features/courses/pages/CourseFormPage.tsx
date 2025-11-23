import React from 'react';
import { Form, Input, InputNumber, Select, Button, message, Typography, Card, Space, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourse, useCreateCourse, useUpdateCourse } from '../../../api/courses';
import { useDepartments } from '../../../api/departments';
import { useUsers } from '../../../api/users';
import type { CreateCoursePayload, CourseStatus } from '../../../types/index';
import { UserRole } from '../../../types/index';

const { Title } = Typography;
const { TextArea } = Input;

const CourseFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const courseId = id ? parseInt(id, 10) : undefined;

  const [form] = Form.useForm();

  const { data: course, isLoading: courseLoading } = useCourse(courseId!);
  const { data: departments } = useDepartments();
  const { data: teachers } = useUsers({ role: UserRole.TEACHER });

  const createMutation = useCreateCourse();
  const updateMutation = useUpdateCourse();

  React.useEffect(() => {
    if (course && isEdit) {
      form.setFieldsValue({
        ...course,
        department: course.department,
        assigned_teacher: course.assigned_teacher,
      });
    }
  }, [course, isEdit, form]);

  const handleSubmit = async (values: any) => {
    try {
      const payload: CreateCoursePayload = {
        department: values.department,
        code: values.code,
        title: values.title,
        description: values.description,
        credits: values.credits,
        assigned_teacher: values.assigned_teacher || null,
        status: values.status as CourseStatus,
      };

      if (isEdit && courseId) {
        await updateMutation.mutateAsync({ id: courseId, payload });
        message.success('Course updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        message.success('Course created successfully');
      }

      navigate('/dashboard/courses');
    } catch (error: any) {
      message.error(error.response?.data?.detail || `Failed to ${isEdit ? 'update' : 'create'} course`);
    }
  };

  if (courseLoading && isEdit) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        {isEdit ? 'Edit Course' : 'Create Course'}
      </Title>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            credits: 3,
            status: 'DRAFT',
          }}
        >
          <Form.Item
            name="department"
            label="Department"
            rules={[{ required: true, message: 'Please select a department' }]}
          >
            <Select
              placeholder="Select department"
              loading={!departments}
              disabled={isEdit}
            >
              {departments?.results?.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="code"
            label="Course Code"
            rules={[
              { required: true, message: 'Please enter course code' },
              { max: 20, message: 'Course code must be less than 20 characters' },
            ]}
          >
            <Input placeholder="e.g., CS101" />
          </Form.Item>

          <Form.Item
            name="title"
            label="Course Title"
            rules={[
              { required: true, message: 'Please enter course title' },
              { max: 200, message: 'Course title must be less than 200 characters' },
            ]}
          >
            <Input placeholder="e.g., Introduction to Computer Science" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ max: 1000, message: 'Description must be less than 1000 characters' }]}
          >
            <TextArea
              rows={4}
              placeholder="Enter course description..."
            />
          </Form.Item>

          <Form.Item
            name="credits"
            label="Credits"
            rules={[{ required: true, message: 'Please enter number of credits' }]}
          >
            <InputNumber
              min={1}
              max={10}
              placeholder="3"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="assigned_teacher"
            label="Assigned Teacher"
          >
            <Select
              placeholder="Select teacher (optional)"
              allowClear
              loading={!teachers}
            >
              {teachers?.results?.map((teacher) => (
                <Select.Option key={teacher.id} value={teacher.id}>
                  {teacher.first_name} {teacher.last_name} ({teacher.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select status' }]}
          >
            <Select placeholder="Select status">
              <Select.Option value="DRAFT">Draft</Select.Option>
              <Select.Option value="PENDING_APPROVAL">Pending Approval</Select.Option>
              <Select.Option value="ACTIVE">Active</Select.Option>
              <Select.Option value="ARCHIVED">Archived</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {isEdit ? 'Update Course' : 'Create Course'}
              </Button>
              <Button onClick={() => navigate('/dashboard/courses')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CourseFormPage;