import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  Assessment,
  CreateAssessmentPayload,
  PaginatedResponse,
  AssessmentSubmission,
  SubmitAssessmentPayload,
} from '../types';

// List assessments
export const listAssessments = async (params?: {
  course?: number;
  assessment_type?: string;
  status?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Assessment>> => {
  const { data } = await apiClient.get<PaginatedResponse<Assessment>>('/assessments/', {
    params,
  });
  return data;
};

export const useAssessments = (params?: {
  course?: number;
  assessment_type?: string;
  status?: string;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['assessments', params],
    queryFn: () => listAssessments(params),
  });
};

// Get single assessment
export const getAssessment = async (id: string): Promise<Assessment> => {
  const { data } = await apiClient.get<Assessment>(`/assessments/${id}/`);
  return data;
};

export const useAssessment = (id: string) => {
  return useQuery({
    queryKey: ['assessment', id],
    queryFn: () => getAssessment(id),
    enabled: !!id,
  });
};

// Create assessment
export const createAssessment = async (payload: CreateAssessmentPayload): Promise<Assessment> => {
  const { data } = await apiClient.post<Assessment>('/assessments/', payload);
  return data;
};

export const useCreateAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAssessment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
};

// Update assessment
export const updateAssessment = async (
  id: string,
  payload: Partial<CreateAssessmentPayload>
): Promise<Assessment> => {
  const { data } = await apiClient.patch<Assessment>(`/assessments/${id}/`, payload);
  return data;
};

export const useUpdateAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateAssessmentPayload> }) =>
      updateAssessment(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', variables.id] });
    },
  });
};

// Delete assessment
export const deleteAssessment = async (id: string): Promise<void> => {
  await apiClient.delete(`/assessments/${id}/`);
};

export const useDeleteAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAssessment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
};

// Submit assessment for approval
export const submitAssessmentForApproval = async (id: string): Promise<Assessment> => {
  const { data } = await apiClient.post<Assessment>(`/assessments/${id}/submit/`);
  return data;
};

export const useSubmitAssessmentForApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitAssessmentForApproval,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', id] });
    },
  });
};

// Approve assessment
export const approveAssessment = async (id: string): Promise<Assessment> => {
  const { data } = await apiClient.post<Assessment>(`/assessments/${id}/approve/`);
  return data;
};

export const useApproveAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveAssessment,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', id] });
    },
  });
};

// Schedule assessment
export const scheduleAssessment = async (
  id: string,
  scheduledAt: string,
  closesAt: string
): Promise<Assessment> => {
  const { data } = await apiClient.post<Assessment>(`/assessments/${id}/schedule/`, {
    scheduled_at: scheduledAt,
    closes_at: closesAt,
  });
  return data;
};

export const useScheduleAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt, closesAt }: { id: string; scheduledAt: string; closesAt: string }) =>
      scheduleAssessment(id, scheduledAt, closesAt),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', variables.id] });
    },
  });
};

// Assessment submissions
export const listAssessmentSubmissions = async (params?: {
  assessment?: string;
  student?: number;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<AssessmentSubmission>> => {
  const { data } = await apiClient.get<PaginatedResponse<AssessmentSubmission>>(
    '/assessments/submissions/',
    { params }
  );
  return data;
};

export const useAssessmentSubmissions = (params?: {
  assessment?: string;
  student?: number;
  status?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['assessment-submissions', params],
    queryFn: () => listAssessmentSubmissions(params),
  });
};

export const submitAssessmentWork = async (
  payload: SubmitAssessmentPayload
): Promise<AssessmentSubmission> => {
  if (payload.file) {
    const formData = new FormData();
    formData.append('assessment', payload.assessmentId);
    if (payload.textResponse) {
      formData.append('text_response', payload.textResponse);
    }
    formData.append('file_response', payload.file);
    const { data } = await apiClient.post<AssessmentSubmission>(
      '/assessments/submissions/',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data;
  }

  const body: Record<string, unknown> = { assessment: payload.assessmentId };
  if (payload.textResponse) {
    body.text_response = payload.textResponse;
  }
  if (payload.answers) {
    body.answers = payload.answers;
  }
  const { data } = await apiClient.post<AssessmentSubmission>('/assessments/submissions/', body);
  return data;
};

export const useSubmitAssessmentWork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitAssessmentWork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment-submissions'] });
    },
  });
};

// Grade submission
export const gradeSubmission = async (
  submissionId: string,
  score: number,
  feedback?: string
): Promise<AssessmentSubmission> => {
  const { data } = await apiClient.post<AssessmentSubmission>(
    `/assessments/submissions/${submissionId}/grade/`,
    { score, feedback }
  );
  return data;
};

export const useGradeSubmission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, score, feedback }: { submissionId: string; score: number; feedback?: string }) =>
      gradeSubmission(submissionId, score, feedback),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessment-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
};
