import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { UserSession, Role } from '../types';

interface AuthContextType {
  user: UserSession | null;
  role: Role | null;
  token: string | null;
  isLoading: boolean;
  isInitialAdminPassword: boolean;
  login: (payload: { role: Role; password: string; username?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUserSession: (session: Partial<UserSession>) => void;
  openPasswordModal: boolean;
  setOpenPasswordModal: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [token, setTokenState] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialAdminPassword, setIsInitialAdminPassword] = useState<boolean>(false);
  const [openPasswordModal, setOpenPasswordModal] = useState<boolean>(false);

  useEffect(() => {
    // Check initial bootstrap and restore session if token exists
    const initAuth = async () => {
      try {
        const bootstrap = await api.getBootstrap();
        setIsInitialAdminPassword(!!bootstrap.isInitialPassword);

        if (token) {
          const state = await api.getState();
          setRole(state.role);
          if (state.role === 'teacher') {
            setUser({
              role: 'teacher',
              name: state.classSettings?.homeroomTeacher || 'Giáo viên Chủ nhiệm',
            });
          } else if (state.role === 'student' && state.student) {
            setUser({
              role: 'student',
              name: state.student.fullName,
              id: state.student.id,
              code: state.student.code,
              gender: state.student.gender,
              birthdate: state.student.birthdate,
              mustChangePassword: state.student.mustChangePassword,
            });
            if (state.student.mustChangePassword) {
              setOpenPasswordModal(true);
            }
          }
        }
      } catch (err) {
        console.error('Session restoration failed:', err);
        api.setToken(null);
        setTokenState(null);
        setUser(null);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [token]);

  const login = async (payload: { role: Role; password: string; username?: string }) => {
    setIsLoading(true);
    try {
      const res = await api.login(payload);
      setTokenState(res.token);
      setRole(res.role);
      setUser(res.user);
      if (res.mustChangePassword) {
        setOpenPasswordModal(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } finally {
      setTokenState(null);
      setUser(null);
      setRole(null);
      setIsLoading(false);
    }
  };

  const updateUserSession = (data: Partial<UserSession>) => {
    setUser(prev => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isLoading,
        isInitialAdminPassword,
        login,
        logout,
        updateUserSession,
        openPasswordModal,
        setOpenPasswordModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
