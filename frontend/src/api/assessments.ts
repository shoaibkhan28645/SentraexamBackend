import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import type { Assessment, PaginatedResponse } from '../types';

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

