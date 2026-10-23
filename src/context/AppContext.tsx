import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import {
  AppState,
  ClassSettings,
  Student,
  Subject,
  EmulationRule,
  EmulationSettings,
  Incident,
  Announcement,
  SeatingChart,
  HonorItem,
  SupabaseStatus,
} from '../types';

export type NavTab =
  | 'dashboard'
  | 'bulletin'
  | 'students'
  | 'student_profile'
  | 'academics'
  | 'attendance'
  | 'settings';

interface AppContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  selectedStudentId: string | null;
  openStudentProfile: (studentId: string) => void;
  state: AppState | null;
  isLoading: boolean;
  error: string | null;
  refreshState: () => Promise<void>;
  classSettings: ClassSettings;
  students: Student[];
  subjects: Subject[];
  emulationRules: EmulationRule[];
  emulationSettings: EmulationSettings;
  attendance: Record<string, Record<string, string>>;
  grades: Record<string, Record<string, Record<string, number | null>>>;
  incidents: Incident[];
  announcements: Announcement[];
  seatingChart: SeatingChart | null;
  honors: HonorItem[];
  supabaseStatus: SupabaseStatus;
  currentStudent: Student | null; // For student role or selected student
  emergencyBackup: { count: number; date: string } | null;
  restoreEmergencyBackup: () => Promise<boolean>;
  dismissEmergencyBackup: () => void;
}

const defaultSettings: ClassSettings = {
  id: 'CLASS_CURRENT',
  appName: 'Trợ lý chủ nhiệm',
  schoolName: '',
  className: 'Chưa đặt tên lớp',
  homeroomTeacher: 'Chưa cập nhật GVCN',
  academicYear: '2026-2027',
  logoUrl: '',
  initialSetupDone: false,
  attentionThresholdViolations: 2,
  attentionThresholdAbsences: 2,
  syncEnabled: false,
  updatedAt: new Date().toISOString(),
};

const defaultEmulationSettings: EmulationSettings = {
  startingScore: 200,
  thresholdGood: 180,
  thresholdFair: 150,
  thresholdPass: 120,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, token } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [emergencyBackup, setEmergencyBackup] = useState<{ count: number; date: string; data: any[] } | null>(null);

  const refreshState = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data: AppState = await api.getState();
      setState(data);

      // Auto-cache to browser localStorage for teacher
      if (role === 'teacher' && data.students && data.students.length > 3) {
        try {
          const cachePayload = {
            count: data.students.length,
            date: new Date().toLocaleString('vi-VN'),
            timestamp: Date.now(),
            students: data.students,
          };
          localStorage.setItem('gvcn_browser_backup_data', JSON.stringify(cachePayload));
        } catch (e) {
          console.warn('Could not save local browser cache:', e);
        }
      } else if (role === 'teacher' && data.students && data.students.length <= 3) {
        // If current server students are only default samples (<=3), check if browser has a larger cached roster
        try {
          const cachedRaw = localStorage.getItem('gvcn_browser_backup_data');
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (parsed && Array.isArray(parsed.students) && parsed.students.length > 3) {
              setEmergencyBackup({
                count: parsed.students.length,
                date: parsed.date || 'Gần đây',
                data: parsed.students,
              });
            }
          }
        } catch (e) {
          console.warn('Could not read local browser cache:', e);
        }
      }
    } catch (err: any) {
      console.error('Failed to load state:', err);
      setError(err.message || 'Không thể tải dữ liệu.');
    } finally {
      setIsLoading(false);
    }
  }, [token, role]);

  const restoreEmergencyBackup = async (): Promise<boolean> => {
    if (!emergencyBackup || !emergencyBackup.data || emergencyBackup.data.length === 0) return false;
    try {
      setIsLoading(true);
      await api.batchImportStudents(emergencyBackup.data, { mode: 'replace', updateExisting: true });
      await refreshState();
      setEmergencyBackup(null);
      return true;
    } catch (err: any) {
      setError(`Lỗi khôi phục bản sao lưu: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const dismissEmergencyBackup = () => {
    setEmergencyBackup(null);
  };

  useEffect(() => {
    if (token) {
      refreshState();
    } else {
      setState(null);
    }
  }, [token, refreshState]);

  // Handle open student profile
  const openStudentProfile = (studentId: string) => {
    setSelectedStudentId(studentId);
    setActiveTab('student_profile');
  };

  const classSettings = state?.classSettings || defaultSettings;
  const students = state?.students || (state?.student ? [state.student] : []);
  const subjects = state?.subjects || [];
  const emulationRules = state?.emulationRules || [];
  const emulationSettings = state?.emulationSettings || defaultEmulationSettings;
  const attendance = state?.attendance || {};
  const grades = state?.grades || {};
  const incidents = state?.incidents || [];
  const announcements = state?.announcements || [];
  const seatingChart = state?.seatingChart || null;
  const honors = state?.honors || [];
  const supabaseStatus = state?.supabaseStatus || { enabled: false, connected: false };

  // Current student object
  const currentStudent =
    role === 'student'
      ? state?.student || null
      : students.find(s => s.id === selectedStudentId) || null;

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedStudentId,
        openStudentProfile,
        state,
        isLoading,
        error,
        refreshState,
        classSettings,
        students,
        subjects,
        emulationRules,
        emulationSettings,
        attendance,
        grades,
        incidents,
        announcements,
        seatingChart,
        honors,
        supabaseStatus,
        currentStudent,
        emergencyBackup: emergencyBackup ? { count: emergencyBackup.count, date: emergencyBackup.date } : null,
        restoreEmergencyBackup,
        dismissEmergencyBackup,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
