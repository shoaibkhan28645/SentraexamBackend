import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, LoginPayload, AuthTokens } from '../types';
import { login as apiLogin, logout as apiLogout } from '../api/auth';
import { getTokens, clearTokens, setTokens } from '../api/client';
import apiClient from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user from API
  const fetchCurrentUser = async () => {
    try {
      const tokens = getTokens();
      if (!tokens?.access) {
        setUser(null);
        return;
      }

      // Since there's no /me endpoint, we'll decode the JWT or fetch user list filtered
      // For now, let's get the user from the accounts list
      // In a real app, you might want to decode JWT or add a /me endpoint to Django
      const { data } = await apiClient.get<User[]>('/auth/accounts/', {
        params: { limit: 1 }, // Get first user (current user based on auth)
      });

      // Better approach: decode JWT to get user ID, then fetch that specific user
      // For now, we'll use a simpler approach and assume the API returns current user data
      // You may need to adjust this based on your Django backend

      // Alternative: Parse JWT token to get user info
      const payload = parseJWT(tokens.access);
      if (payload && payload.user_id) {
        const { data: userData } = await apiClient.get<User>(`/auth/accounts/${payload.user_id}/`);
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Parse JWT to extract user info
  const parseJWT = (token: string): any => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (credentials: LoginPayload) => {
    try {
      const tokens = await apiLogin(credentials);
      setTokens(tokens);
      await fetchCurrentUser();
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
