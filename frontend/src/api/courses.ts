import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import type { Course, PaginatedResponse } from '../types';

export const listCourses = async (params?: {
  department?: number;
  status?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<Course>> => {
  const { data } = await apiClient.get<PaginatedResponse<Course>>('/courses/', { params });
  return data;
};

export const useCourses = (params?: {
  department?: number;
  status?: string;
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: ['courses', params],
    queryFn: () => listCourses(params),
  });
};

