import React, { useState } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Typography,
  Button,
  Space,
  Spin,
  Alert,
  Form,
  Input,
  message,
  Radio,
  Table,
  Modal,
  Image,
  Statistic,
  Row,
  Col,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { EditOutlined, ArrowLeftOutlined, CalendarOutlined, UnorderedListOutlined, WarningOutlined } from '@ant-design/icons';
import { useAssessment, useSubmitAssessmentWork, useAssessmentSubmissions } from '../../../api/assessments';
import { useAuth } from '../../../contexts/AuthContext';
import {
  AssessmentStatus,
  AssessmentType,
  AssessmentSubmissionFormat,
  UserRole,
} from '../../../types/index';
import type { Assessment as AssessmentModel } from '../../../types/index';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const AssessmentDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const assessmentId = id || undefined;
  const { user } = useAuth();
  const [showSubmissions, setShowSubmissions] = useState(false);

  const { data: assessment, isLoading, error } = useAssessment(assessmentId!);

  if (error) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Assessment Details</Title>
        <Alert
          type="error"
          showIcon
          message="Failed to load assessment"
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

  if (!assessment) {
    return (
      <div>
        <Title level={2} style={{ marginBottom: 16 }}>Assessment Details</Title>
        <Alert
          type="warning"
          showIcon
          message="Assessment not found"
          description="The assessment you're looking for doesn't exist or you don't have permission to view it."
        />
      </div>
    );
  }

  const hasInstructions = Boolean(assessment.instructions);
  const hasContent = Boolean(assessment.content && assessment.content.length > 0);
  const hasQuestions = Boolean(assessment.questions && assessment.questions.length > 0);
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.ADMIN || user?.role === UserRole.HOD;

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard/assessments')}
          >
            Back to Assessments
          </Button>
          <Title level={2} style={{ margin: 0 }}>Assessment Details</Title>
        </Space>
        <Space>
          {isTeacher && (
            <Button
              icon={<UnorderedListOutlined />}
              onClick={() => setShowSubmissions(!showSubmissions)}
              type={showSubmissions ? 'default' : 'primary'}
            >
              {showSubmissions ? 'Hide Submissions' : 'View Submissions'}
            </Button>
          )}
          {assessment.status === AssessmentStatus.APPROVED && (
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => navigate(`/dashboard/assessments/${assessment.id}/schedule`)}
            >
              Schedule
            </Button>
          )}
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/assessments/${assessment.id}/edit`)}
          >
            Edit Assessment
          </Button>
        </Space>
      </div>

      {showSubmissions && isTeacher && (
        <SubmissionsPanel assessmentId={assessment.id} assessment={assessment} />
      )}

      <Card>
        <Descriptions
          title="Basic Information"
          bordered
          column={2}
          size="small"
        >
          <Descriptions.Item label="Title">
            <Text strong>{assessment.title}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Course">
            {assessment.course_code || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Type">
            <Tag>{typeLabels[assessment.assessment_type]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={statusColors[assessment.status]}>
              {statusLabels[assessment.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Duration">
            {assessment.duration_minutes ? `${assessment.duration_minutes} minutes` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Total Marks">
            {assessment.total_marks || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Description" span={2}>
            {assessment.description || 'No description provided'}
          </Descriptions.Item>
          {assessment.scheduled_at && (
            <Descriptions.Item label="Scheduled At">
              {new Date(assessment.scheduled_at).toLocaleString()}
            </Descriptions.Item>
          )}
          {assessment.closes_at && (
            <Descriptions.Item label="Closes At">
              {new Date(assessment.closes_at).toLocaleString()}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Created By">
            {assessment.created_by_email || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {new Date(assessment.created_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {new Date(assessment.updated_at).toLocaleString()}
          </Descriptions.Item>
          {assessment.approved_at && (
            <>
              <Descriptions.Item label="Approved By">
                {assessment.approved_by_email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Approved At">
                {new Date(assessment.approved_at).toLocaleString()}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {hasInstructions && (
        <Card title="Instructions" style={{ marginTop: 16 }}>
          <Paragraph>{assessment.instructions}</Paragraph>
        </Card>
      )}

      {hasContent && (
        <Card title="Content" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {(assessment.content || []).map((block, index) => (
              <Card
                key={`${block.title}-${index}`}
                type="inner"
                title={block.title || `Content ${index + 1}`}
              >
                <Tag style={{ marginBottom: 8 }}>{block.content_type}</Tag>
                <Paragraph style={{ marginBottom: 0 }}>{block.body}</Paragraph>
              </Card>
            ))}
          </Space>
        </Card>
      )}

      {hasQuestions && (
        <Card title="Questions" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {(assessment.questions || []).map((question, index) => (
              <Card key={index} type="inner" title={`Question ${index + 1}`}>
                <Paragraph strong>{question.prompt}</Paragraph>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {(question.options || []).map((option, optIndex) => (
                    <Tag
                      key={optIndex}
                      color={option.is_correct ? 'green' : undefined}
                      style={{ width: '100%' }}
                    >
                      {option.text}
                      {option.is_correct ? ' (Correct)' : ''}
                    </Tag>
                  ))}
                </Space>
              </Card>
            ))}
          </Space>
        </Card>
      )}

      <Card title="Assessment Statistics" style={{ marginTop: 16 }}>
        <Descriptions column={3}>
          <Descriptions.Item label="Total Submissions">
            <Text strong>{assessment.total_submissions || 0}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Average Score">
            <Text strong>{assessment.average_score !== undefined && assessment.average_score !== null ? assessment.average_score : '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Submission Rate">
            <Text strong>{assessment.submission_rate !== undefined ? `${assessment.submission_rate}%` : '-'}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <StudentSubmissionPanel assessment={assessment} />
    </div>
  );
};

export default AssessmentDetailPage;

const SubmissionsPanel: React.FC<{ assessmentId: string; assessment?: AssessmentModel }> = ({ assessmentId, assessment }) => {
  const { data: submissionsResponse, isLoading } = useAssessmentSubmissions({ assessment: assessmentId });
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  // Helper to ensure image URL is absolute
  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Prepend backend URL for relative paths
    const backendUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000';
    return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  if (isLoading) {
    return <Card title="Submissions" style={{ marginBottom: 16 }}><Spin /></Card>;
  }

  const submissions = submissionsResponse?.results || [];

  const columns = [
    {
      title: 'Student',
      dataIndex: 'student_email',
      key: 'student',
    },
    {
      title: 'Submitted At',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      render: (score: number | null) => score !== null ? score : 'Not graded',
    },
    {
      title: 'Violations',
      dataIndex: 'total_violations',
      key: 'violations',
      render: (count: number) => (
        <Tag color={count > 0 ? 'red' : 'green'} icon={count > 0 ? <WarningOutlined /> : null}>
          {count} violations
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => setSelectedSubmission(record)}>
          View Details
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card title="Student Submissions" style={{ marginBottom: 16 }}>
        <Table
          columns={columns}
          dataSource={submissions}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={`Submission Details - ${selectedSubmission?.student_email}`}
        open={!!selectedSubmission}
        onCancel={() => setSelectedSubmission(null)}
        footer={null}
        width={900}
      >
        {selectedSubmission && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="Total Violations" value={selectedSubmission.total_violations} />
              </Col>
              <Col span={8}>
                <Statistic title="Score" value={selectedSubmission.score || 'N/A'} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Submitted"
                  value={new Date(selectedSubmission.submitted_at).toLocaleDateString()}
                />
              </Col>
            </Row>

            {/* Answers Section */}
            {assessment && assessment.questions && (
              <Card title="Answers" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {assessment.questions.map((question, index) => {
                    const answer = selectedSubmission.answers?.[index];
                    let answerDisplay = <Text type="secondary">No answer</Text>;

                    if (question.type === 'MCQ') {
                      if (answer !== undefined && answer !== null && answer !== -1) {
                        const option = question.options?.[answer];
                        const isCorrect = option?.is_correct;
                        answerDisplay = (
                          <Space>
                            <Text strong>Selected:</Text>
                            <Tag color={isCorrect ? 'green' : 'red'}>
                              {option?.text || `Option ${answer + 1}`}
                            </Tag>
                          </Space>
                        );
                      }
                    } else {
                      // Subjective or other types
                      if (answer) {
                        answerDisplay = (
                          <div>
                            <Text strong>Response:</Text>
                            <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{answer}</Paragraph>
                          </div>
                        );
                      }
                    }

                    return (
                      <Card key={index} type="inner" size="small" title={`Q${index + 1}: ${question.prompt}`}>
                        {answerDisplay}
                        {question.type === 'MCQ' && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary">Correct Answer: </Text>
                            {question.options?.filter(o => o.is_correct).map((o, i) => (
                              <Tag key={i} color="blue">{o.text}</Tag>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </Space>
              </Card>
            )}

            {selectedSubmission.violations_by_type && Object.keys(selectedSubmission.violations_by_type).length > 0 && (
              <Card title="Violation Breakdown" size="small">
                <Space wrap>
                  {Object.entries(selectedSubmission.violations_by_type).map(([type, count]: [string, any]) => (
                    <Tag key={type} color="red">
                      {type.replace(/_/g, ' ')}: {count}
                    </Tag>
                  ))}
                </Space>
              </Card>
            )}

            {selectedSubmission.proctoring_snapshots && selectedSubmission.proctoring_snapshots.length > 0 && (
              <Card title={`Proctoring Snapshots (${selectedSubmission.proctoring_snapshots.length})`} size="small">
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <Image.PreviewGroup>
                    {selectedSubmission.proctoring_snapshots.map((snap: any) => (
                      <Card
                        key={snap.id}
                        type="inner"
                        size="small"
                        title={new Date(snap.captured_at).toLocaleTimeString()}
                        extra={
                          <Space>
                            {snap.is_violation && <Tag color="red">Violation</Tag>}
                            <Tag>{snap.faces_detected} faces</Tag>
                          </Space>
                        }
                        style={{ marginBottom: 8 }}
                      >
                        <Image
                          src={getImageUrl(snap.image_url)}
                          alt="Proctoring snapshot"
                          width={200}
                          style={{ cursor: 'pointer' }}
                        />
                      </Card>
                    ))}
                  </Image.PreviewGroup>
                </div>
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </>
  );
};

const StudentSubmissionPanel: React.FC<{ assessment: AssessmentModel }> = ({ assessment }) => {
  const { user } = useAuth();
  if (user?.role !== UserRole.STUDENT) {
    return null;
  }

  const isExam =
    assessment.assessment_type === AssessmentType.EXAM &&
    assessment.submission_format === AssessmentSubmissionFormat.ONLINE;
  const requiresText =
    assessment.submission_format === AssessmentSubmissionFormat.TEXT ||
    assessment.submission_format === AssessmentSubmissionFormat.TEXT_AND_FILE;
  const requiresFile =
    assessment.submission_format === AssessmentSubmissionFormat.FILE ||
    assessment.submission_format === AssessmentSubmissionFormat.TEXT_AND_FILE;
  const allowedStatuses = [
    AssessmentStatus.APPROVED,
    AssessmentStatus.SCHEDULED,
    AssessmentStatus.IN_PROGRESS,
  ];
  const submissionWindowOpen = allowedStatuses.includes(assessment.status);

  const [form] = Form.useForm();
  const [file, setFile] = React.useState<File | null>(null);
  const [answers, setAnswers] = React.useState<number[]>(
    () => (assessment.questions || []).map(() => -1)
  );
  React.useEffect(() => {
    setAnswers((assessment.questions || []).map(() => -1));
  }, [assessment.id, assessment.questions?.length]);

  const submitMutation = useSubmitAssessmentWork();

  const handleAssignmentSubmit = async (values: { text_response?: string }) => {
    const trimmedResponse = values.text_response?.trim() ?? '';
    if (requiresText && !trimmedResponse) {
      message.error('Please provide your response.');
      return;
    }
    if (requiresFile && !file) {
      message.error('Please attach a file before submitting.');
      return;
    }

    try {
      await submitMutation.mutateAsync({
        assessmentId: assessment.id,
        textResponse: trimmedResponse || undefined,
        file: file ?? undefined,
      });
      message.success('Submission uploaded successfully.');
      form.resetFields();
      setFile(null);
    } catch (error: any) {
      const data = error.response?.data;
      const detail =
        data?.detail ??
        data?.text_response?.[0] ??
        data?.file_response?.[0] ??
        'Failed to submit assessment.';
      message.error(detail);
    }
  };

  const handleExamSubmit = async () => {
    if (!submissionWindowOpen) {
      return;
    }
    if (answers.some((value) => value < 0)) {
      message.error('Please answer all questions before submitting.');
      return;
    }
    try {
      await submitMutation.mutateAsync({
        assessmentId: assessment.id,
        answers,
      });
      message.success('Exam submitted successfully.');
      setAnswers((assessment.questions || []).map(() => -1));
    } catch (error: any) {
      const detail = error.response?.data?.answers?.[0] || error.response?.data?.detail;
      message.error(detail || 'Failed to submit exam.');
    }
  };

  const renderExamForm = () => (
    <>
      {!submissionWindowOpen && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Submissions are not open"
          description="You can only submit work when the assessment is approved or scheduled."
        />
      )}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {(assessment.questions || []).map((question, index) => (
          <Card key={index} type="inner" title={`Question ${index + 1}`}>
            <Paragraph>{question.prompt}</Paragraph>
            <Form layout="vertical">
              <Form.Item label="Choose an option" required>
                <Radio.Group
                  onChange={(event) => {
                    const next = [...answers];
                    next[index] = event.target.value;
                    setAnswers(next);
                  }}
                  value={answers[index]}
                >
                  {question.options.map((option, optionIndex) => (
                    <Radio key={optionIndex} value={optionIndex}>
                      {option.text}
                    </Radio>
                  ))}
                </Radio.Group>
              </Form.Item>
            </Form>
          </Card>
        ))}
        <Button
          type="primary"
          onClick={handleExamSubmit}
          disabled={!submissionWindowOpen}
          loading={submitMutation.isPending}
        >
          Submit Exam
        </Button>
      </Space>
    </>
  );

  const renderAssignmentForm = () => (
    <>
      {!submissionWindowOpen && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Submissions are not open"
          description="You can only submit work when the assessment is approved or scheduled."
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleAssignmentSubmit}
        disabled={!submissionWindowOpen || submitMutation.isPending}
      >
        {requiresText && (
          <Form.Item
            name="text_response"
            label="Response"
            rules={[{ required: true, message: 'Please enter your response.' }]}
          >
            <TextArea rows={4} placeholder="Share your analysis, answers, or summary..." />
          </Form.Item>
        )}
        {requiresFile && (
          <Form.Item label="Upload Attachment" required={requiresFile}>
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            {file && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {file.name}
              </Text>
            )}
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" loading={submitMutation.isPending}>
          Submit Work
        </Button>
      </Form>
    </>
  );

  return (
    <Card title="Student Actions" style={{ marginTop: 16 }}>
      {isExam ? renderExamForm() : renderAssignmentForm()}
    </Card>
  );
};
