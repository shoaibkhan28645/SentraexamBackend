import { useQuery } from '@tanstack/react-query';
import apiClient from './client';

// ============================================================================
// Dashboard Types
// ============================================================================

export interface TeacherCourse {
    id: string;
    code: string;
    title: string;
    department: string | null;
    student_count: number;
}

export interface TeacherAssessment {
    id: string;
    title: string;
    course_code: string;
    assessment_type: string;
    status: string;
    scheduled_at: string | null;
    total_submissions: number;
}

export interface TeacherDashboardData {
    courses: TeacherCourse[];
    total_courses: number;
    assessments: TeacherAssessment[];
    total_students: number;
}

export interface HodTeacher {
    id: number;
    email: string;
    name: string;
    assigned_courses: string[];
}

export interface HodCourse {
    id: string;
    code: string;
    title: string;
    assigned_teacher: string | null;
    teacher_name: string | null;
    student_count: number;
}

export interface HodDashboardData {
    department: {
        id: string | null;
        name: string;
        code: string | null;
    };
    teachers: HodTeacher[];
    total_teachers: number;
    total_students: number;
    courses: HodCourse[];
    total_courses: number;
}

export interface StudentEnrollment {
    id: string;
    course_id: string;
    course_code: string;
    course_title: string;
    teacher: string | null;
    enrolled_at: string | null;
}

export interface StudentExam {
    id: string;
    title: string;
    course_code: string;
    assessment_type: string;
    scheduled_at: string | null;
    closes_at: string | null;
    duration_minutes: number;
    total_marks: number;
    status: string;
    student_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
}

export interface StudentDashboardData {
    enrollments: StudentEnrollment[];
    total_enrollments: number;
    upcoming_exams: StudentExam[];
    past_exams: StudentExam[];
    attendance_percentage: number | null;
}

export interface AdminUserCounts {
    total: number;
    admins: number;
    hods: number;
    teachers: number;
    students: number;
}

export interface AdminUser {
    id: number;
    email: string;
    name: string;
    role: string;
    department: string | null;
    created_at: string | null;
    is_active: boolean;
}

export interface AdminDepartment {
    id: string;
    name: string;
    code: string;
    user_count: number;
    course_count: number;
}

export interface AdminDashboardData {
    user_counts: AdminUserCounts;
    recent_users: AdminUser[];
    departments: AdminDepartment[];
    total_departments: number;
    total_assessments: number;
    total_submissions: number;
}

// ============================================================================
// Dashboard API Functions
// ============================================================================

export const getTeacherDashboard = async (): Promise<TeacherDashboardData> => {
    const { data } = await apiClient.get<TeacherDashboardData>('/auth/dashboard/teacher/');
    return data;
};

export const useTeacherDashboard = () => {
    return useQuery({
        queryKey: ['dashboard', 'teacher'],
        queryFn: getTeacherDashboard,
    });
};

export const getHodDashboard = async (): Promise<HodDashboardData> => {
    const { data } = await apiClient.get<HodDashboardData>('/auth/dashboard/hod/');
    return data;
};

export const useHodDashboard = () => {
    return useQuery({
        queryKey: ['dashboard', 'hod'],
        queryFn: getHodDashboard,
    });
};

export const getStudentDashboard = async (): Promise<StudentDashboardData> => {
    const { data } = await apiClient.get<StudentDashboardData>('/auth/dashboard/student/');
    return data;
};

export const useStudentDashboard = () => {
    return useQuery({
        queryKey: ['dashboard', 'student'],
        queryFn: getStudentDashboard,
    });
};

export const getAdminDashboard = async (): Promise<AdminDashboardData> => {
    const { data } = await apiClient.get<AdminDashboardData>('/auth/dashboard/admin/');
    return data;
};

export const useAdminDashboard = () => {
    return useQuery({
        queryKey: ['dashboard', 'admin'],
        queryFn: getAdminDashboard,
    });
};
