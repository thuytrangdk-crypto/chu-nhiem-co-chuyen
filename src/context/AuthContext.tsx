import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { UserSession, Role } from '../types';

interface AuthContextType {
  user: UserSession | null;
  role: Role | null;
  token: string | null;
  isLoading: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [isInitialAdminPassword, setIsInitialAdminPassword] = useState<boolean>(false);
  const [openPasswordModal, setOpenPasswordModal] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        const bootstrap = await api.getBootstrap().catch(() => null);
        if (bootstrap && isMounted) {
          setIsInitialAdminPassword(!!bootstrap.isInitialPassword);
        }

        const savedToken = api.getToken();
        if (savedToken) {
          try {
            const state = await api.getState();
            if (!isMounted) return;
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
          } catch (stateErr: any) {
            console.warn('Session restoration failed:', stateErr);
            api.setToken(null);
            if (isMounted) {
              setTokenState(null);
              setUser(null);
              setRole(null);
              setAuthError(stateErr.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            }
          }
        }
      } catch (err: any) {
        console.error('Init bootstrap failed:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (payload: { role: Role; password: string; username?: string }) => {
    setAuthError(null);
    const res = await api.login(payload);
    try {
      const state = await api.getState();
      setTokenState(res.token);
      setRole(state.role || res.role);
      if (res.role === 'student' && state.student) {
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
      } else {
        setUser(res.user);
      }
      localStorage.setItem('gvcn_active_login_role', res.role);
    } catch (loadErr: any) {
      api.setToken(null);
      setTokenState(null);
      setUser(null);
      setRole(null);
      throw new Error(loadErr.message || 'Không thể tải dữ liệu hồ sơ. Vui lòng thử lại.');
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      api.setToken(null);
      setTokenState(null);
      setUser(null);
      setRole(null);
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
        authError,
        setAuthError,
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
