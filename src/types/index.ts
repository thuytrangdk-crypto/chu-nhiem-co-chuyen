export type Role = 'teacher' | 'student';

export interface ClassSettings {
  id: string;
  appName: string;
  schoolName: string;
  className: string;
  homeroomTeacher: string;
  academicYear: string;
  logoUrl?: string;
  initialSetupDone: boolean;
  attentionThresholdViolations: number;
  attentionThresholdAbsences: number;
  syncEnabled: boolean;
  updatedAt: string;
}

export interface Student {
  id: string;
  code: string;
  fullName: string;
  gender: 'Nam' | 'Nữ';
  birthdate: string; // "dd/mm/yyyy"
  parentName?: string;
  parentPhone?: string;
  address?: string;
  notes?: string;
  internalNotes?: string;
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  isGraded: boolean; // true = numerical score (0-10), false = pass/fail evaluation
}

export interface EmulationRule {
  id: string;
  type: 'violation' | 'award';
  name: string;
  points: number;
  active: boolean;
}

export interface EmulationSettings {
  startingScore: number;
  thresholdGood: number;
  thresholdFair: number;
  thresholdPass: number;
}

export interface Incident {
  id: string;
  studentId: string;
  date: string;
  type: 'violation' | 'award';
  ruleName: string;
  content: string;
  points: number;
  notes?: string;
  visibleToStudent: boolean;
  recordedBy?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  youtubeUrl?: string;
  driveUrl?: string;
  isPinned: boolean;
  isPublished: boolean;
  author: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SeatingChart {
  rows: number; // default 4
  desksPerRow: number; // default 7
  seatsPerDesk: number; // default 2
  seats: Record<string, string | null>; // "row_desk_seat" => studentId
  isPublished: boolean;
  updatedAt: string;
}

export interface HonorItem {
  id: string;
  title: string;
  type: 'academic' | 'conduct';
  month: string;
  studentIds: string[];
  notes?: string;
  isPublished: boolean;
  publishedAt: string;
}

export interface UserSession {
  role: Role;
  name: string;
  id?: string;
  code?: string;
  gender?: string;
  birthdate?: string;
  mustChangePassword?: boolean;
}

export interface SupabaseStatus {
  enabled: boolean;
  connected: boolean;
  url?: string;
  lastSyncedAt?: string | null;
}

export interface AppState {
  role: Role;
  classSettings: ClassSettings;
  emulationRules: EmulationRule[];
  emulationSettings: EmulationSettings;
  subjects: Subject[];
  students: Student[];
  student?: Student; // when logged in as student
  attendance: Record<string, Record<string, string>>; // date -> { studentId: status }
  grades: Record<string, Record<string, Record<string, number | null>>>; // month -> { studentId: { subjectCode: score } }
  incidents: Incident[];
  announcements: Announcement[];
  seatingChart: SeatingChart | null;
  honors: HonorItem[];
  gradeSnapshots?: Array<{ id: string; month: string; deletedAt: string; studentCount: number }>;
  supabaseStatus: SupabaseStatus;
}
