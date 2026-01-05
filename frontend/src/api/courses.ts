import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  Course,
  CreateCoursePayload,
  PaginatedResponse,
  CourseEnrollment
} from '../types';

// List courses
export const listCourses = async (params?: {
  department?: string;
  status?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Course>> => {
  const { data } = await apiClient.get<PaginatedResponse<Course>>('/courses/', { params });
  return data;
};

export const useCourses = (params?: {
  department?: string;
  status?: string;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['courses', params],
    queryFn: () => listCourses(params),
  });
};

// Get single course
export const getCourse = async (id: string): Promise<Course> => {
  const { data } = await apiClient.get<Course>(`/courses/${id}/`);
  return data;
};

export const useCourse = (id: string) => {
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourse(id),
    enabled: !!id,
  });
};

// Create course
export const createCourse = async (payload: CreateCoursePayload): Promise<Course> => {
  const { data } = await apiClient.post<Course>('/courses/', payload);
  return data;
};

export const useCreateCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
};

// Update course
export const updateCourse = async (
  id: string,
  payload: Partial<CreateCoursePayload>
): Promise<Course> => {
  const { data } = await apiClient.patch<Course>(`/courses/${id}/`, payload);
  return data;
};

export const useUpdateCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCoursePayload> }) =>
      updateCourse(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', variables.id] });
    },
  });
};

// Delete course
export const deleteCourse = async (id: string): Promise<void> => {
  await apiClient.delete(`/courses/${id}/`);
};

export const useDeleteCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
};

// Approve course
export const approveCourse = async (id: string): Promise<Course> => {
  const { data } = await apiClient.post<Course>(`/courses/${id}/approve/`);
  return data;
};

export const useApproveCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveCourse,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', id] });
    },
  });
};

// Course enrollments
export const listCourseEnrollments = async (params?: {
  course?: string;
  student?: number;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<CourseEnrollment>> => {
  const { data } = await apiClient.get<PaginatedResponse<CourseEnrollment>>(
    '/courses/enrollments/',
    { params }
  );
  return data;
};

export const useCourseEnrollments = (params?: {
  course?: string;
  student?: number;
  status?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['course-enrollments', params],
    queryFn: () => listCourseEnrollments(params),
  });
};

// Create course enrollment
export const createCourseEnrollment = async (payload: {
  course: string;
  student: number;
  status?: string;
}): Promise<CourseEnrollment> => {
  const { data } = await apiClient.post<CourseEnrollment>('/courses/enrollments/', payload);
  return data;
};

export const useCreateCourseEnrollment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCourseEnrollment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-enrollments'] });
      // Also invalidate the specific course enrollment query if possible
      queryClient.invalidateQueries({
        queryKey: ['course-enrollments', { course: variables.course }],
      });
    },
  });
};

