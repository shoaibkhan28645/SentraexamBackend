import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { UserRole } from '../types';

// Layouts
import DashboardLayout from '../layouts/DashboardLayout';
import AuthLayout from '../layouts/AuthLayout';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';
import ActivateAccountPage from '../pages/auth/ActivateAccountPage';
import PasswordResetPage from '../pages/auth/PasswordResetPage';

// Dashboard Pages
import DashboardHome from '../pages/DashboardHome';

// User Pages
import UsersListPage from '../features/users/pages/UsersListPage';
import UserCreatePage from '../features/users/pages/UserCreatePage';
import UserEditPage from '../features/users/pages/UserEditPage';

// Department Pages
import DepartmentsListPage from '../features/departments/pages/DepartmentsListPage';
import DepartmentCreatePage from '../features/departments/pages/DepartmentCreatePage';
import DepartmentEditPage from '../features/departments/pages/DepartmentEditPage';

// Protected Route Component
import ProtectedRoute from '../components/ProtectedRoute';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    ),
  },
  {
    path: '/activate/:token',
    element: (
      <AuthLayout>
        <ActivateAccountPage />
      </AuthLayout>
    ),
  },
  {
    path: '/reset-password/:token',
    element: (
      <AuthLayout>
        <PasswordResetPage />
      </AuthLayout>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardHome />,
      },
      // Users routes (Admin only)
      {
        path: 'users',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <UsersListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users/new',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <UserCreatePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <UserEditPage />
          </ProtectedRoute>
        ),
      },
      // Departments routes (Admin/HOD)
      {
        path: 'departments',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.HOD]}>
            <DepartmentsListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'departments/new',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <DepartmentCreatePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'departments/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <DepartmentEditPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
];
