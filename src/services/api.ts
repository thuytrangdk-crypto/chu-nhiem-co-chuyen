const API_BASE = '/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('tln_auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('tln_auth_token', token);
    } else {
      localStorage.removeItem('tln_auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        this.setToken(null);
      }
      const errorMsg = data.error || `Lỗi máy chủ (${response.status})`;
      throw new Error(errorMsg);
    }

    return data;
  }

  // --- Bootstrap (Public) ---
  async getBootstrap() {
    return this.request('/bootstrap');
  }

  // --- Auth ---
  async login(payload: { role: 'teacher' | 'student'; password: string; username?: string }) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async changeTeacherPassword(payload: { currentPassword?: string; newPassword: string; confirmPassword: string }) {
    return this.request('/auth/change-teacher-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async changeStudentPassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    return this.request('/auth/change-student-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async resetStudentPassword(studentId: string) {
    return this.request(`/students/${studentId}/reset-password`, {
      method: 'POST',
    });
  }

  // --- Main App State ---
  async getState() {
    return this.request('/state');
  }

  // --- Settings ---
  async updateGeneralSettings(settings: any) {
    return this.request('/settings/general', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async updateEmulationSettings(payload: { rules?: any[]; settings?: any }) {
    return this.request('/settings/emulation', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async updateSubjects(subjects: any[]) {
    return this.request('/settings/subjects', {
      method: 'PUT',
      body: JSON.stringify({ subjects }),
    });
  }

  // --- Students ---
  async createStudent(student: any) {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(student),
    });
  }

  async batchImportStudents(
    students: any[],
    options?: { mode?: 'replace' | 'append'; updateExisting?: boolean } | boolean
  ) {
    let mode: 'replace' | 'append' = 'replace';
    let updateExisting = true;
    if (typeof options === 'boolean') {
      updateExisting = options;
    } else if (options) {
      if (options.mode) mode = options.mode;
      if (options.updateExisting !== undefined) updateExisting = options.updateExisting;
    }
    return this.request('/students/batch-import', {
      method: 'POST',
      body: JSON.stringify({ students, mode, updateExisting }),
    });
  }

  async updateStudent(id: string, student: any) {
    return this.request(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(student),
    });
  }

  async deleteStudent(id: string) {
    return this.request(`/students/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Attendance ---
  async saveAttendance(date: string, records: Record<string, string>) {
    return this.request('/attendance', {
      method: 'POST',
      body: JSON.stringify({ date, records }),
    });
  }

  // --- Grades ---
  async saveMonthlyGrades(month: string, grades: Record<string, Record<string, number | null>>) {
    return this.request('/grades/month', {
      method: 'PUT',
      body: JSON.stringify({ month, grades }),
    });
  }

  async deleteMonthlyGrades(month: string) {
    return this.request('/grades/delete-month', {
      method: 'POST',
      body: JSON.stringify({ month }),
    });
  }

  async restoreGradeSnapshot(snapshotId: string) {
    return this.request('/grades/restore-snapshot', {
      method: 'POST',
      body: JSON.stringify({ snapshotId }),
    });
  }

  // --- Incidents ---
  async createIncident(incident: any) {
    return this.request('/incidents', {
      method: 'POST',
      body: JSON.stringify(incident),
    });
  }

  async updateIncident(id: string, incident: any) {
    return this.request(`/incidents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(incident),
    });
  }

  async deleteIncident(id: string) {
    return this.request(`/incidents/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Announcements ---
  async createAnnouncement(post: any) {
    return this.request('/announcements', {
      method: 'POST',
      body: JSON.stringify(post),
    });
  }

  async updateAnnouncement(id: string, post: any) {
    return this.request(`/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(post),
    });
  }

  async deleteAnnouncement(id: string) {
    return this.request(`/announcements/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Seating Chart ---
  async updateSeatingChart(seats: Record<string, string | null>, isPublished: boolean) {
    return this.request('/seating-chart', {
      method: 'PUT',
      body: JSON.stringify({ seats, isPublished }),
    });
  }

  // --- Honors ---
  async createHonor(honor: any) {
    return this.request('/honors', {
      method: 'POST',
      body: JSON.stringify(honor),
    });
  }

  async deleteHonor(id: string) {
    return this.request(`/honors/${id}`, {
      method: 'DELETE',
    });
  }

  // --- System, Supabase, Backup, Clean ---
  async testSupabase(url: string, serviceKey: string) {
    return this.request('/system/test-supabase', {
      method: 'POST',
      body: JSON.stringify({ url, serviceKey }),
    });
  }

  async saveSupabaseConfig(url: string, serviceKey: string, enabled: boolean) {
    return this.request('/system/save-supabase-config', {
      method: 'POST',
      body: JSON.stringify({ url, serviceKey, enabled }),
    });
  }

  async syncCloud(): Promise<{ success: boolean; message: string; lastSyncedAt: string; totalStudents: number }> {
    return this.request('/system/sync', {
      method: 'POST',
    });
  }

  async pullCloud(): Promise<{ success: boolean; message: string; lastSyncedAt: string; totalStudents: number }> {
    return this.request('/system/pull-supabase', {
      method: 'POST',
    });
  }

  async restoreBackup(backupData: any) {
    return this.request('/system/restore', {
      method: 'POST',
      body: JSON.stringify({ backupData }),
    });
  }

  async cleanClass(confirmText: string) {
    return this.request('/system/clean-class', {
      method: 'POST',
      body: JSON.stringify({ confirmText }),
    });
  }

  async seedSample() {
    return this.request('/system/seed-sample', {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
