import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure data directory exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'db.json');

// --- Hashing & Security Helpers ---
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 10000, 64, 'sha256').toString('hex');
  return { hash, salt: generatedSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  return check === hash;
}

// In-memory sessions store
interface Session {
  token: string;
  role: 'teacher' | 'student';
  userId: string;
  studentId?: string;
  createdAt: number;
  expiresAt: number;
}
const sessions: Map<string, Session> = new Map();

// Rate limiting for login attempts
const loginAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt) return true;
  if (attempt.lockedUntil > now) return false;
  if (attempt.lockedUntil <= now && attempt.lockedUntil > 0) {
    loginAttempts.delete(ip);
    return true;
  }
  return attempt.count < 15;
}

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  attempt.count += 1;
  if (attempt.count >= 10) {
    attempt.lockedUntil = now + 15 * 60 * 1000; // 15 mins lock
  }
  loginAttempts.set(ip, attempt);
}

function resetLoginRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

// --- Initial Database Structure ---
const defaultTeacherPass = hashPassword('123456');

const initialDb = {
  version: 1,
  classSettings: {
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
  },
  adminAuth: {
    hash: defaultTeacherPass.hash,
    salt: defaultTeacherPass.salt,
    isInitialPassword: true,
    updatedAt: new Date().toISOString(),
  },
  supabaseConfig: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    enabled: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    lastSyncedAt: null as string | null,
    syncStatus: 'idle',
  },
  emulationRules: [
    { id: 'rule_1', type: 'violation', name: 'Nghỉ học không phép', points: -5, active: true },
    { id: 'rule_2', type: 'violation', name: 'Đi học muộn', points: -2, active: true },
    { id: 'rule_3', type: 'violation', name: 'Không làm bài tập / không chép bài', points: -3, active: true },
    { id: 'rule_4', type: 'violation', name: 'Nói chuyện riêng / mất trật tự', points: -2, active: true },
    { id: 'rule_5', type: 'violation', name: 'Không đồng phục / vi phạm tác phong', points: -2, active: true },
    { id: 'rule_6', type: 'violation', name: 'Sử dụng điện thoại trong giờ học', points: -5, active: true },
    { id: 'rule_7', type: 'award', name: 'Điểm 9, 10 trong giờ học', points: 5, active: true },
    { id: 'rule_8', type: 'award', name: 'Phát biểu xây dựng bài tích cực', points: 2, active: true },
    { id: 'rule_9', type: 'award', name: 'Việc tốt / Giúp đỡ bạn bè', points: 5, active: true },
    { id: 'rule_10', type: 'award', name: 'Đạt giải phong trào / thi đua', points: 10, active: true },
  ],
  emulationSettings: {
    startingScore: 200,
    thresholdGood: 180, // >= 180 Tốt
    thresholdFair: 150, // >= 150 Khá
    thresholdPass: 120, // >= 120 Đạt, < 120 Chưa đạt
  },
  subjects: [
    { id: 'sub_toan', code: 'TOAN', name: 'Toán', isGraded: true },
    { id: 'sub_van', code: 'VAN', name: 'Ngữ văn', isGraded: true },
    { id: 'sub_anh', code: 'ANH', name: 'Tiếng Anh', isGraded: true },
    { id: 'sub_khtn', code: 'KHTN', name: 'KHTN', isGraded: true },
    { id: 'sub_lsdl', code: 'LSDL', name: 'LS&ĐL', isGraded: true },
    { id: 'sub_gdcd', code: 'GDCD', name: 'GDCD', isGraded: true },
    { id: 'sub_tin', code: 'TIN', name: 'Tin học', isGraded: true },
    { id: 'sub_cn', code: 'CN', name: 'Công nghệ', isGraded: true },
    { id: 'sub_td', code: 'TD', name: 'Thể dục', isGraded: false }, // Đánh giá Đạt/Chưa đạt
    { id: 'sub_amnhac', code: 'AN', name: 'Âm nhạc', isGraded: false },
    { id: 'sub_mythuat', code: 'MT', name: 'Mĩ thuật', isGraded: false },
    { id: 'sub_hdtn', code: 'HDTN', name: 'HĐTN-HN', isGraded: false },
  ],
  students: [] as Array<any>,
  attendance: {} as Record<string, Record<string, string>>, // date: { studentId: status }
  grades: {} as Record<string, Record<string, Record<string, number | null>>>, // month: { studentId: { subjectCode: grade } }
  incidents: [] as Array<any>,
  announcements: [] as Array<any>,
  seatingChart: {
    rows: 4,
    desksPerRow: 7,
    seatsPerDesk: 2,
    seats: {} as Record<string, string | null>, // "row_desk_seat" -> studentId
    isPublished: false,
    updatedAt: new Date().toISOString(),
  },
  honors: [] as Array<any>,
  gradeSnapshots: [] as Array<{
    id: string;
    month: string;
    deletedAt: string;
    data: Record<string, Record<string, number | null>>;
  }>,
};

// Read / Write DB
function loadDatabase(): typeof initialDb {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      const sUrl = process.env.SUPABASE_URL || parsed.supabaseConfig?.url || '';
      const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const isConnected = !!(sUrl && sKey);

      return {
        ...initialDb,
        ...parsed,
        supabaseConfig: {
          url: sUrl,
          serviceKey: sKey,
          enabled: isConnected,
          lastSyncedAt: parsed.supabaseConfig?.lastSyncedAt || (isConnected ? new Date().toISOString() : null),
          syncStatus: isConnected ? 'connected' : 'idle',
        },
      };
    }
  } catch (err) {
    console.error('Error loading database:', err);
  }
  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(data: typeof initialDb) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    // CRITICAL: Scrub secret keys completely from data before saving to db.json
    const scrubbedData = {
      ...data,
      supabaseConfig: {
        url: data.supabaseConfig.url || process.env.SUPABASE_URL || '',
        serviceKey: '', // NEVER write secret key to data/db.json
        enabled: !!((data.supabaseConfig.url || process.env.SUPABASE_URL) && (data.supabaseConfig.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY)),
        lastSyncedAt: data.supabaseConfig.lastSyncedAt,
        syncStatus: data.supabaseConfig.syncStatus,
      },
    };
    fs.writeFileSync(tempFile, JSON.stringify(scrubbedData, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing database:', err);
  }
}

let db = loadDatabase();

// --- Auth Middleware ---
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Chưa đăng nhập. Vui lòng đăng nhập lại.' });
    return;
  }
  const token = authHeader.substring(7);
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.' });
    return;
  }
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
    return;
  }
  (req as any).user = session;
  next();
}

function teacherOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as Session;
  if (!user || user.role !== 'teacher') {
    res.status(403).json({ error: 'Bạn không có quyền quản trị GVCN.' });
    return;
  }
  next();
}

// --- API Routes ---

// Health & Sync Status
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConnected: db.supabaseConfig.enabled && !!db.supabaseConfig.url,
    totalStudents: db.students.length,
    initialSetupDone: db.classSettings.initialSetupDone,
  });
});

// Auth Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkLoginRateLimit(ip)) {
    res.status(429).json({ error: 'Quá nhiều lần thử đăng nhập sai. Vui lòng thử lại sau 15 phút.' });
    return;
  }

  const { role, password, username } = req.body;

  if (role === 'teacher') {
    if (!password) {
      res.status(400).json({ error: 'Vui lòng nhập mật khẩu quản trị GVCN.' });
      return;
    }
    const isValid = verifyPassword(password, db.adminAuth.hash, db.adminAuth.salt);
    if (!isValid) {
      recordFailedLogin(ip);
      res.status(401).json({ error: 'Mật khẩu quản trị không đúng.' });
      return;
    }
    resetLoginRateLimit(ip);
    const token = crypto.randomBytes(32).toString('hex');
    const session: Session = {
      token,
      role: 'teacher',
      userId: 'teacher_admin',
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    sessions.set(token, session);
    res.json({
      token,
      role: 'teacher',
      isInitialPassword: db.adminAuth.isInitialPassword,
      user: {
        role: 'teacher',
        name: db.classSettings.homeroomTeacher || 'Giáo viên Chủ nhiệm',
      },
    });
    return;
  }

  if (role === 'student') {
    if (!username || !password) {
      res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
      return;
    }
    // Match username: format [mã số]-[ddmmyyyy] (case-insensitive)
    const normalizedUsername = username.trim().toLowerCase();
    const student = db.students.find(s => {
      const cleanDob = (s.birthdate || '').replace(/\D/g, ''); // ddmmyyyy
      const expectedUsername = `${s.code}-${cleanDob}`.toLowerCase();
      return expectedUsername === normalizedUsername || s.username?.toLowerCase() === normalizedUsername;
    });

    if (!student) {
      recordFailedLogin(ip);
      res.status(401).json({ error: 'Tài khoản học sinh không tồn tại trong danh sách lớp.' });
      return;
    }

    // Verify password
    let valid = false;
    if (student.authHash && student.authSalt) {
      valid = verifyPassword(password, student.authHash, student.authSalt);
    } else {
      // Default password is birthdate in ddmmyyyy format
      const defaultPass = (student.birthdate || '').replace(/\D/g, '');
      valid = password === defaultPass;
    }

    if (!valid) {
      recordFailedLogin(ip);
      res.status(401).json({ error: 'Mật khẩu học sinh không đúng.' });
      return;
    }

    resetLoginRateLimit(ip);
    const token = crypto.randomBytes(32).toString('hex');
    const session: Session = {
      token,
      role: 'student',
      userId: student.id,
      studentId: student.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days
    };
    sessions.set(token, session);

    res.json({
      token,
      role: 'student',
      mustChangePassword: student.mustChangePassword || false,
      user: {
        id: student.id,
        code: student.code,
        name: student.fullName,
        gender: student.gender,
        birthdate: student.birthdate,
      },
    });
    return;
  }

  res.status(400).json({ error: 'Vai trò đăng nhập không hợp lệ.' });
});

// Auth Logout
app.post('/api/auth/logout', authMiddleware, (req: Request, res: Response) => {
  const token = req.headers.authorization?.substring(7);
  if (token) {
    sessions.delete(token);
  }
  res.json({ success: true });
});

// Change Teacher Password
app.post('/api/auth/change-teacher-password', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: 'Xác nhận mật khẩu mới không khớp.' });
    return;
  }
  // If not initial setup, verify current password
  if (!db.adminAuth.isInitialPassword) {
    const isValid = verifyPassword(currentPassword, db.adminAuth.hash, db.adminAuth.salt);
    if (!isValid) {
      res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
      return;
    }
  }

  const { hash, salt } = hashPassword(newPassword);
  db.adminAuth = {
    hash,
    salt,
    isInitialPassword: false,
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(db);

  // Invalidate other sessions
  const currentToken = req.headers.authorization?.substring(7);
  for (const [t, s] of sessions.entries()) {
    if (s.role === 'teacher' && t !== currentToken) {
      sessions.delete(t);
    }
  }

  res.json({ success: true, message: 'Đổi mật khẩu GVCN thành công.' });
});

// Change Student Password
app.post('/api/auth/change-student-password', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as Session;
  if (user.role !== 'student' || !user.studentId) {
    res.status(403).json({ error: 'Chỉ học sinh mới sử dụng chức năng này.' });
    return;
  }
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: 'Mật khẩu xác nhận không khớp.' });
    return;
  }

  const student = db.students.find(s => s.id === user.studentId);
  if (!student) {
    res.status(404).json({ error: 'Không tìm thấy hồ sơ học sinh.' });
    return;
  }

  let isCurrentValid = false;
  if (student.authHash && student.authSalt) {
    isCurrentValid = verifyPassword(currentPassword, student.authHash, student.authSalt);
  } else {
    const defaultPass = (student.birthdate || '').replace(/\D/g, '');
    isCurrentValid = currentPassword === defaultPass;
  }

  if (!isCurrentValid) {
    res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' });
    return;
  }

  const { hash, salt } = hashPassword(newPassword);
  student.authHash = hash;
  student.authSalt = salt;
  student.mustChangePassword = false;
  saveDatabase(db);

  res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
});

// Teacher resets student password
app.post('/api/students/:id/reset-password', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) {
    res.status(404).json({ error: 'Không tìm thấy học sinh.' });
    return;
  }
  const defaultPass = (student.birthdate || '').replace(/\D/g, '');
  const { hash, salt } = hashPassword(defaultPass);
  student.authHash = hash;
  student.authSalt = salt;
  student.mustChangePassword = true;
  saveDatabase(db);

  // Invalidate any active sessions of this student
  for (const [t, s] of sessions.entries()) {
    if (s.studentId === student.id) {
      sessions.delete(t);
    }
  }

  res.json({
    success: true,
    message: `Đã đặt lại mật khẩu về ngày sinh (${defaultPass}). Học sinh sẽ được yêu cầu đổi lại sau khi đăng nhập.`,
  });
});

// --- Public/Bootstrap Data Endpoint for App Initial Load ---
app.get('/api/bootstrap', (req: Request, res: Response) => {
  // Public data accessible on login screen & initial setup
  res.json({
    classSettings: {
      appName: db.classSettings.appName,
      schoolName: db.classSettings.schoolName,
      className: db.classSettings.className,
      homeroomTeacher: db.classSettings.homeroomTeacher,
      academicYear: db.classSettings.academicYear,
      logoUrl: db.classSettings.logoUrl,
      initialSetupDone: db.classSettings.initialSetupDone,
      syncEnabled: db.supabaseConfig.enabled,
    },
    supabaseStatus: {
      enabled: db.supabaseConfig.enabled,
      connected: db.supabaseConfig.enabled && !!db.supabaseConfig.url,
      lastSyncedAt: db.supabaseConfig.lastSyncedAt,
    },
    isInitialPassword: db.adminAuth.isInitialPassword,
  });
});

// --- Main App State Endpoint (Role Protected) ---
app.get('/api/state', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as Session;

  if (user.role === 'teacher') {
    // Return full teacher view
    res.json({
      role: 'teacher',
      classSettings: db.classSettings,
      emulationRules: db.emulationRules,
      emulationSettings: db.emulationSettings,
      subjects: db.subjects,
      students: db.students.map(s => {
        const { authHash, authSalt, ...safe } = s;
        return safe;
      }),
      attendance: db.attendance,
      grades: db.grades,
      incidents: db.incidents,
      announcements: db.announcements,
      seatingChart: db.seatingChart,
      honors: db.honors,
      gradeSnapshots: db.gradeSnapshots.map(snap => ({
        id: snap.id,
        month: snap.month,
        deletedAt: snap.deletedAt,
        studentCount: Object.keys(snap.data || {}).length,
      })),
      supabaseStatus: {
        enabled: db.supabaseConfig.enabled,
        connected: db.supabaseConfig.enabled && !!db.supabaseConfig.url,
        url: db.supabaseConfig.url ? `${db.supabaseConfig.url.slice(0, 15)}...` : '',
        lastSyncedAt: db.supabaseConfig.lastSyncedAt,
      },
    });
    return;
  }

  if (user.role === 'student') {
    // Student can ONLY access their own data and published class items!
    const student = db.students.find(s => s.id === user.studentId);
    if (!student) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ học sinh.' });
      return;
    }

    // Filter attendance for this student only
    const studentAttendance: Record<string, string> = {};
    for (const [date, rec] of Object.entries(db.attendance)) {
      if (rec[student.id]) {
        studentAttendance[date] = rec[student.id];
      }
    }

    // Filter grades for this student only
    const studentGrades: Record<string, Record<string, number | null>> = {};
    for (const [month, monthRec] of Object.entries(db.grades)) {
      if (monthRec[student.id]) {
        studentGrades[month] = monthRec[student.id];
      }
    }

    // Filter incidents visible to student (exclude private teacher notes)
    const studentIncidents = db.incidents
      .filter(inc => inc.studentId === student.id && inc.visibleToStudent !== false)
      .map(inc => ({
        id: inc.id,
        date: inc.date,
        type: inc.type,
        ruleName: inc.ruleName,
        content: inc.content,
        points: inc.points,
        recordedBy: inc.recordedBy,
      }));

    // Announcements: only published ones
    const publishedAnnouncements = db.announcements.filter(a => a.isPublished);

    // Seating chart: only if published
    const seatingChart = db.seatingChart.isPublished ? db.seatingChart : null;

    // Honors: only published ones
    const publishedHonors = db.honors.filter(h => h.isPublished);

    const { authHash, authSalt, internalNotes, ...safeStudent } = student;

    res.json({
      role: 'student',
      classSettings: {
        appName: db.classSettings.appName,
        schoolName: db.classSettings.schoolName,
        className: db.classSettings.className,
        homeroomTeacher: db.classSettings.homeroomTeacher,
        academicYear: db.classSettings.academicYear,
        logoUrl: db.classSettings.logoUrl,
      },
      student: safeStudent,
      emulationSettings: db.emulationSettings,
      subjects: db.subjects,
      attendance: studentAttendance,
      grades: studentGrades,
      incidents: studentIncidents,
      announcements: publishedAnnouncements,
      seatingChart,
      honors: publishedHonors,
    });
    return;
  }

  res.status(403).json({ error: 'Không xác định quyền.' });
});

// --- Settings Management (Teacher Only) ---
app.put('/api/settings/general', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { appName, schoolName, className, homeroomTeacher, academicYear, logoUrl, attentionThresholdViolations, attentionThresholdAbsences } = req.body;
  db.classSettings = {
    ...db.classSettings,
    appName: appName?.trim() || 'Trợ lý chủ nhiệm',
    schoolName: schoolName?.trim() || '',
    className: className?.trim() || 'Lớp mới',
    homeroomTeacher: homeroomTeacher?.trim() || 'Giáo viên',
    academicYear: academicYear?.trim() || '2026-2027',
    logoUrl: logoUrl || '',
    attentionThresholdViolations: Number(attentionThresholdViolations) || 2,
    attentionThresholdAbsences: Number(attentionThresholdAbsences) || 2,
    initialSetupDone: true,
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(db);
  res.json({ success: true, classSettings: db.classSettings });
});

// Emulation Rules & Thresholds
app.put('/api/settings/emulation', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { rules, settings } = req.body;
  if (rules && Array.isArray(rules)) {
    db.emulationRules = rules;
  }
  if (settings) {
    const { startingScore, thresholdGood, thresholdFair, thresholdPass } = settings;
    if (thresholdGood <= thresholdFair || thresholdFair <= thresholdPass) {
      res.status(400).json({ error: 'Ngưỡng xếp loại phải thoả mãn: Tốt > Khá > Đạt.' });
      return;
    }
    db.emulationSettings = {
      startingScore: Number(startingScore) || 200,
      thresholdGood: Number(thresholdGood) || 180,
      thresholdFair: Number(thresholdFair) || 150,
      thresholdPass: Number(thresholdPass) || 120,
    };
  }
  saveDatabase(db);
  res.json({
    success: true,
    rules: db.emulationRules,
    settings: db.emulationSettings,
  });
});

// Subjects Management
app.put('/api/settings/subjects', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { subjects } = req.body;
  if (!Array.isArray(subjects) || subjects.length === 0) {
    res.status(400).json({ error: 'Danh sách môn học không được để trống.' });
    return;
  }
  db.subjects = subjects;
  saveDatabase(db);
  res.json({ success: true, subjects: db.subjects });
});

// --- Students Management (Teacher Only) ---
app.post('/api/students', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { code, fullName, gender, birthdate, parentName, parentPhone, address, notes, internalNotes } = req.body;
  if (!code || !fullName || !birthdate) {
    res.status(400).json({ error: 'Vui lòng nhập đầy đủ mã hồ sơ, họ tên và ngày sinh.' });
    return;
  }

  // Check unique student code
  const existing = db.students.find(s => s.code.toLowerCase() === code.trim().toLowerCase());
  if (existing) {
    res.status(400).json({ error: `Mã hồ sơ ${code} đã tồn tại trong lớp.` });
    return;
  }

  const cleanDob = birthdate.replace(/\D/g, ''); // ddmmyyyy
  const defaultPass = cleanDob;
  const { hash, salt } = hashPassword(defaultPass);

  const newStudent = {
    id: `stu_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    code: code.trim(),
    fullName: fullName.trim(),
    gender: gender === 'Nữ' ? 'Nữ' : 'Nam',
    birthdate: birthdate.trim(),
    parentName: parentName?.trim() || '',
    parentPhone: parentPhone?.trim() || '',
    address: address?.trim() || '',
    notes: notes?.trim() || '',
    internalNotes: internalNotes?.trim() || '',
    authHash: hash,
    authSalt: salt,
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.students.push(newStudent);
  saveDatabase(db);

  const { authHash, authSalt, ...safe } = newStudent;
  res.json({ success: true, student: safe });
});

// Batch Import Students
app.post('/api/students/batch-import', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { students, updateExisting } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    res.status(400).json({ error: 'Không có dữ liệu học sinh để nhập.' });
    return;
  }

  let addedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  students.forEach((item, index) => {
    const rowNum = index + 2;
    if (!item.code || !item.fullName || !item.birthdate) {
      errors.push(`Dòng ${rowNum}: Thiếu mã số, họ tên hoặc ngày sinh.`);
      return;
    }
    const cleanCode = String(item.code).trim();
    const cleanDob = String(item.birthdate).trim();
    const cleanGender = (item.gender || '').toLowerCase().includes('nữ') ? 'Nữ' : 'Nam';

    const existingIdx = db.students.findIndex(s => s.code.toLowerCase() === cleanCode.toLowerCase());
    if (existingIdx >= 0) {
      if (updateExisting) {
        const current = db.students[existingIdx];
        db.students[existingIdx] = {
          ...current,
          fullName: item.fullName.trim() || current.fullName,
          gender: cleanGender,
          birthdate: cleanDob || current.birthdate,
          parentName: item.parentName ? item.parentName.trim() : current.parentName,
          parentPhone: item.parentPhone ? String(item.parentPhone).trim() : current.parentPhone,
          address: item.address ? item.address.trim() : current.address,
          notes: item.notes ? item.notes.trim() : current.notes,
          updatedAt: new Date().toISOString(),
        };
        updatedCount++;
      }
    } else {
      const cleanDobDigits = cleanDob.replace(/\D/g, '');
      const { hash, salt } = hashPassword(cleanDobDigits);
      db.students.push({
        id: `stu_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        code: cleanCode,
        fullName: item.fullName.trim(),
        gender: cleanGender,
        birthdate: cleanDob,
        parentName: item.parentName ? item.parentName.trim() : '',
        parentPhone: item.parentPhone ? String(item.parentPhone).trim() : '',
        address: item.address ? item.address.trim() : '',
        notes: item.notes ? item.notes.trim() : '',
        internalNotes: '',
        authHash: hash,
        authSalt: salt,
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      addedCount++;
    }
  });

  saveDatabase(db);
  res.json({
    success: true,
    addedCount,
    updatedCount,
    errors,
    totalStudents: db.students.length,
  });
});

// Update Student
app.put('/api/students/:id', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const index = db.students.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy học sinh.' });
    return;
  }
  const current = db.students[index];
  const { code, fullName, gender, birthdate, parentName, parentPhone, address, notes, internalNotes } = req.body;

  if (code && code.trim().toLowerCase() !== current.code.toLowerCase()) {
    const dup = db.students.find(s => s.id !== current.id && s.code.toLowerCase() === code.trim().toLowerCase());
    if (dup) {
      res.status(400).json({ error: `Mã số ${code} đã tồn tại cho học sinh khác.` });
      return;
    }
  }

  db.students[index] = {
    ...current,
    code: code ? code.trim() : current.code,
    fullName: fullName ? fullName.trim() : current.fullName,
    gender: gender ? (gender === 'Nữ' ? 'Nữ' : 'Nam') : current.gender,
    birthdate: birthdate ? birthdate.trim() : current.birthdate,
    parentName: parentName !== undefined ? parentName.trim() : current.parentName,
    parentPhone: parentPhone !== undefined ? parentPhone.trim() : current.parentPhone,
    address: address !== undefined ? address.trim() : current.address,
    notes: notes !== undefined ? notes.trim() : current.notes,
    internalNotes: internalNotes !== undefined ? internalNotes.trim() : current.internalNotes,
    updatedAt: new Date().toISOString(),
  };

  saveDatabase(db);
  const { authHash, authSalt, ...safe } = db.students[index];
  res.json({ success: true, student: safe });
});

// Delete Student
app.delete('/api/students/:id', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const studentId = req.params.id;
  const index = db.students.findIndex(s => s.id === studentId);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy học sinh.' });
    return;
  }

  db.students.splice(index, 1);

  // Clean attendance
  for (const date of Object.keys(db.attendance)) {
    delete db.attendance[date][studentId];
  }
  // Clean grades
  for (const month of Object.keys(db.grades)) {
    delete db.grades[month][studentId];
  }
  // Clean incidents
  db.incidents = db.incidents.filter(inc => inc.studentId !== studentId);

  // Clean seating
  for (const [key, val] of Object.entries(db.seatingChart.seats)) {
    if (val === studentId) {
      db.seatingChart.seats[key] = null;
    }
  }

  saveDatabase(db);
  res.json({ success: true, message: 'Đã xóa học sinh và dữ liệu liên quan thành công.' });
});

// --- Attendance Management ---
app.post('/api/attendance', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { date, records } = req.body;
  if (!date || !records) {
    res.status(400).json({ error: 'Thiếu ngày hoặc dữ liệu điểm danh.' });
    return;
  }

  db.attendance[date] = records; // { [studentId]: "present" | "excused" | "unexcused" | "late" }
  saveDatabase(db);
  res.json({ success: true, attendance: db.attendance[date] });
});

// --- Grades Management ---
app.put('/api/grades/month', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { month, grades } = req.body; // grades: { [studentId]: { [subjectCode]: number | null } }
  if (!month || !grades) {
    res.status(400).json({ error: 'Thiếu tháng hoặc dữ liệu điểm.' });
    return;
  }

  if (!db.grades[month]) {
    db.grades[month] = {};
  }
  for (const [studentId, subjectScores] of Object.entries(grades)) {
    db.grades[month][studentId] = {
      ...(db.grades[month][studentId] || {}),
      ...(subjectScores as Record<string, number | null>),
    };
  }

  saveDatabase(db);
  res.json({ success: true, grades: db.grades[month] });
});

// Delete Monthly Grades with snapshot
app.post('/api/grades/delete-month', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { month } = req.body;
  if (!month || !db.grades[month]) {
    res.status(400).json({ error: 'Không tìm thấy dữ liệu điểm của tháng này.' });
    return;
  }

  // Backup snapshot before delete
  const snapshotId = `snap_${Date.now()}`;
  db.gradeSnapshots.push({
    id: snapshotId,
    month,
    deletedAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(db.grades[month])),
  });

  delete db.grades[month];

  // Remove corresponding honors if any
  db.honors = db.honors.filter(h => h.month !== month);

  saveDatabase(db);
  res.json({
    success: true,
    message: `Đã xóa bảng điểm ${month}. Bản sao lưu ${snapshotId} đã được tạo để khôi phục khi cần.`,
  });
});

// Restore Monthly Grades from Snapshot
app.post('/api/grades/restore-snapshot', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { snapshotId } = req.body;
  const snapshot = db.gradeSnapshots.find(s => s.id === snapshotId);
  if (!snapshot) {
    res.status(404).json({ error: 'Không tìm thấy bản sao lưu.' });
    return;
  }

  db.grades[snapshot.month] = JSON.parse(JSON.stringify(snapshot.data));
  saveDatabase(db);

  res.json({
    success: true,
    message: `Đã khôi phục thành công bảng điểm ${snapshot.month}.`,
    grades: db.grades[snapshot.month],
  });
});

// --- Incidents (Discipline & Emulation) Management ---
app.post('/api/incidents', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { studentId, date, type, ruleName, content, points, notes, visibleToStudent } = req.body;
  if (!studentId || !date || points === undefined) {
    res.status(400).json({ error: 'Vui lòng điền đủ ngày, học sinh và điểm.' });
    return;
  }

  const newIncident = {
    id: `inc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    studentId,
    date,
    type: type || (points < 0 ? 'violation' : 'award'),
    ruleName: ruleName || 'Quy tắc thi đua',
    content: content || '',
    points: Number(points),
    notes: notes || '',
    visibleToStudent: visibleToStudent !== false,
    recordedBy: db.classSettings.homeroomTeacher || 'GVCN',
    createdAt: new Date().toISOString(),
  };

  db.incidents.unshift(newIncident);
  saveDatabase(db);
  res.json({ success: true, incident: newIncident });
});

app.put('/api/incidents/:id', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const index = db.incidents.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy ghi nhận sự việc.' });
    return;
  }
  const current = db.incidents[index];
  const { date, type, ruleName, content, points, notes, visibleToStudent } = req.body;

  db.incidents[index] = {
    ...current,
    date: date || current.date,
    type: type || current.type,
    ruleName: ruleName || current.ruleName,
    content: content !== undefined ? content : current.content,
    points: points !== undefined ? Number(points) : current.points,
    notes: notes !== undefined ? notes : current.notes,
    visibleToStudent: visibleToStudent !== undefined ? visibleToStudent : current.visibleToStudent,
    updatedAt: new Date().toISOString(),
  };

  saveDatabase(db);
  res.json({ success: true, incident: db.incidents[index] });
});

app.delete('/api/incidents/:id', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const index = db.incidents.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy sự việc.' });
    return;
  }
  db.incidents.splice(index, 1);
  saveDatabase(db);
  res.json({ success: true, message: 'Đã xóa sự việc thành công.' });
});

// --- Announcements (Bulletin Board) ---
app.post('/api/announcements', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { title, content, mediaUrl, mediaType, youtubeUrl, driveUrl, isPinned, isPublished } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'Vui lòng nhập tiêu đề và nội dung bài viết.' });
    return;
  }

  const post = {
    id: `post_${Date.now()}`,
    title: title.trim(),
    content: content.trim(),
    mediaUrl: mediaUrl || '',
    mediaType: mediaType || '',
    youtubeUrl: youtubeUrl?.trim() || '',
    driveUrl: driveUrl?.trim() || '',
    isPinned: !!isPinned,
    isPublished: isPublished !== false,
    author: db.classSettings.homeroomTeacher || 'GVCN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.announcements.unshift(post);
  saveDatabase(db);
  res.json({ success: true, announcement: post });
});

app.put('/api/announcements/:id', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const index = db.announcements.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy thông báo.' });
    return;
  }
  db.announcements[index] = {
    ...db.announcements[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(db);
  res.json({ success: true, announcement: db.announcements[index] });
});

app.delete('/api/announcements/:id', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  db.announcements = db.announcements.filter(a => a.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// --- Seating Chart ---
app.put('/api/seating-chart', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { seats, isPublished } = req.body;
  db.seatingChart = {
    ...db.seatingChart,
    seats: seats || db.seatingChart.seats,
    isPublished: isPublished !== undefined ? isPublished : db.seatingChart.isPublished,
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(db);
  res.json({ success: true, seatingChart: db.seatingChart });
});

// --- Honors / Vinh Danh ---
app.post('/api/honors', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { title, type, month, studentIds, notes, isPublished } = req.body;
  const honor = {
    id: `honor_${Date.now()}`,
    title: title?.trim() || 'Vinh danh tháng',
    type: type || 'academic', // 'academic' (Top 5) or 'conduct' (Thi đua)
    month: month || '',
    studentIds: studentIds || [],
    notes: notes || '',
    isPublished: isPublished !== false,
    publishedAt: new Date().toISOString(),
  };
  db.honors.unshift(honor);
  saveDatabase(db);
  res.json({ success: true, honor });
});

app.delete('/api/honors/:id', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  db.honors = db.honors.filter(h => h.id !== req.params.id);
  saveDatabase(db);
  res.json({ success: true });
});

// --- Supabase & Database Backup / Restore / Purge ---
app.post('/api/system/test-supabase', authMiddleware, teacherOnly, async (req: Request, res: Response) => {
  const url = req.body.url || process.env.SUPABASE_URL || db.supabaseConfig.url;
  const serviceKey = req.body.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || db.supabaseConfig.serviceKey;
  if (!url || !serviceKey) {
    res.status(400).json({ error: 'Vui lòng cung cấp Supabase URL và Service Key (hoặc thiết lập biến môi trường SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY).' });
    return;
  }
  try {
    let cleanUrl = String(url).trim().replace(/\/+$/, '');
    cleanUrl = cleanUrl.replace(/\/rest\/v1\/?$/, '');
    const cleanKey = String(serviceKey).trim().replace(/^["']|["']$/g, '');
    const testUrl = `${cleanUrl}/rest/v1/`;
    const response = await fetch(testUrl, {
      headers: {
        apikey: cleanKey,
        Authorization: `Bearer ${cleanKey}`,
      },
    });

    if (response.ok || response.status === 200) {
      res.json({ success: true, message: 'Kết nối Supabase thành công!' });
      return;
    }

    if (response.status === 401) {
      res.status(400).json({
        error:
          'Kết nối Supabase thất bại (Mã HTTP: 401 - Sai API Key). Khóa Service Role Key phải là chuỗi mã JWT rất dài bắt đầu bằng "ey..." (khoảng 150 - 220 ký tự). Vui lòng không dùng Mật khẩu database hay JWT Secret.',
      });
      return;
    }

    res.status(400).json({
      error: `Kết nối Supabase thất bại (Mã HTTP: ${response.status}). Vui lòng kiểm tra lại URL hoặc Key.`,
    });
  } catch (err: any) {
    res.status(400).json({
      error: `Không thể kết nối đến Supabase: ${err.message || 'Lỗi mạng hoặc URL không hợp lệ'}`,
    });
  }
});

app.post('/api/system/save-supabase-config', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { url, serviceKey, enabled } = req.body;
  let cleanUrl = url ? String(url).trim().replace(/\/+$/, '') : '';
  cleanUrl = cleanUrl.replace(/\/rest\/v1\/?$/, '');
  const cleanKey = serviceKey ? String(serviceKey).trim().replace(/^["']|["']$/g, '') : '';
  
  const finalUrl = cleanUrl || process.env.SUPABASE_URL || db.supabaseConfig.url;
  const finalKey = cleanKey || process.env.SUPABASE_SERVICE_ROLE_KEY || db.supabaseConfig.serviceKey;
  const isEnabled = enabled !== undefined ? !!enabled : !!(finalUrl && finalKey);

  if (finalUrl) process.env.SUPABASE_URL = finalUrl;
  if (finalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = finalKey;

  // Persist to local .env (which is strictly ignored by git)
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    const lines = envContent.split('\n').filter(l => !l.startsWith('SUPABASE_URL=') && !l.startsWith('SUPABASE_SERVICE_ROLE_KEY='));
    lines.push(`SUPABASE_URL="${finalUrl}"`);
    lines.push(`SUPABASE_SERVICE_ROLE_KEY="${finalKey}"`);
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
  } catch (err) {
    console.error('Error writing .env file:', err);
  }

  db.supabaseConfig = {
    url: finalUrl,
    serviceKey: finalKey,
    enabled: isEnabled,
    lastSyncedAt: isEnabled ? new Date().toISOString() : null,
    syncStatus: isEnabled ? 'connected' : 'disabled',
  };
  saveDatabase(db); // Note: saveDatabase scrubs serviceKey so it never touches db.json!
  res.json({
    success: true,
    supabaseConfig: {
      enabled: db.supabaseConfig.enabled,
      connected: db.supabaseConfig.enabled && !!db.supabaseConfig.url,
      lastSyncedAt: db.supabaseConfig.lastSyncedAt,
    },
  });
});

// Export Backup JSON
app.get('/api/system/backup', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const backupData = JSON.parse(JSON.stringify(db));
  // Remove secret keys from export
  delete backupData.supabaseConfig?.serviceKey;
  res.setHeader('Content-Disposition', `attachment; filename="backup_lop_${db.classSettings.className}_${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(backupData);
});

// Restore Backup JSON
app.post('/api/system/restore', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { backupData } = req.body;
  if (!backupData || !backupData.classSettings) {
    res.status(400).json({ error: 'Tệp sao lưu không đúng định dạng của Trợ lý chủ nhiệm.' });
    return;
  }
  // Keep admin password and supabase secrets safe
  const currentAuth = db.adminAuth;
  const currentSupabase = db.supabaseConfig;

  db = {
    ...initialDb,
    ...backupData,
    adminAuth: currentAuth,
    supabaseConfig: {
      ...backupData.supabaseConfig,
      serviceKey: currentSupabase.serviceKey,
    },
  };
  saveDatabase(db);
  res.json({ success: true, message: 'Khôi phục dữ liệu từ bản sao lưu thành công!' });
});

// Safe Purge / Clean Class (Requires Confirmation)
app.post('/api/system/clean-class', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { confirmText } = req.body;
  const requiredText = `XÓA LỚP ${db.classSettings.className}`;
  if (confirmText !== requiredText) {
    res.status(400).json({ error: `Vui lòng gõ chính xác cụm từ: "${requiredText}" để xác nhận thao tác.` });
    return;
  }

  // Backup current state to a safety file before purging
  const safetyBackupFile = path.join(DATA_DIR, `safety_backup_before_purge_${Date.now()}.json`);
  fs.writeFileSync(safetyBackupFile, JSON.stringify(db, null, 2), 'utf-8');

  // Purge students, grades, attendance, incidents, seating, honors
  db.students = [];
  db.attendance = {};
  db.grades = {};
  db.incidents = [];
  db.seatingChart.seats = {};
  db.honors = [];
  db.gradeSnapshots = [];

  saveDatabase(db);
  res.json({
    success: true,
    message: 'Đã làm sạch dữ liệu lớp học thành công. Bản sao lưu an toàn đã được lưu trước khi xóa.',
  });
});

// --- Seed Sample Data (Optional button for teacher to test easily) ---
app.post('/api/system/seed-sample', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  if (db.students.length > 0) {
    res.status(400).json({ error: 'Lớp đã có học sinh, không thể nạp mẫu để tránh ghi đè dữ liệu.' });
    return;
  }

  const sampleStudents = [
    { code: '02102013', fullName: 'Huỳnh Ngọc Trâm Anh', gender: 'Nữ', birthdate: '02/10/2013', parentPhone: '0901234567' },
    { code: '27122013', fullName: 'Trần Ngô Quỳnh Anh', gender: 'Nữ', birthdate: '27/12/2013', parentPhone: '0912345678' },
    { code: '03052013', fullName: 'Vũ Phi Anh', gender: 'Nữ', birthdate: '03/05/2013', parentPhone: '0923456789' },
    { code: '18022013', fullName: 'Nguyễn Phương Anh', gender: 'Nữ', birthdate: '18/02/2013', parentPhone: '0934567890' },
    { code: '26052013', fullName: 'Nguyễn Gia Bảo', gender: 'Nam', birthdate: '26/05/2013', parentPhone: '0945678901' },
    { code: '12082013', fullName: 'Phạm Đình Bình', gender: 'Nam', birthdate: '12/08/2013', parentPhone: '0956789012' },
    { code: '15092013', fullName: 'Vũ Trọng Đức', gender: 'Nam', birthdate: '15/09/2013', parentPhone: '0967890123' },
    { code: '20102013', fullName: 'Võ Hoàng Dương Long', gender: 'Nam', birthdate: '20/10/2013', parentPhone: '0978901234' },
    { code: '16102013', fullName: 'Đỗ Nhã Quyên', gender: 'Nữ', birthdate: '16/10/2013', parentPhone: '0989012345' },
    { code: '19042013', fullName: 'Đỗ Xuân Tùng', gender: 'Nam', birthdate: '19/04/2013', parentPhone: '0990123456' },
    { code: '08072013', fullName: 'Đặng Hoàng Phát', gender: 'Nam', birthdate: '08/07/2013', parentPhone: '0911223344' },
    { code: '11112013', fullName: 'Lê Bảo Châu', gender: 'Nữ', birthdate: '11/11/2013', parentPhone: '0922334455' },
  ];

  sampleStudents.forEach(item => {
    const cleanDob = item.birthdate.replace(/\D/g, '');
    const { hash, salt } = hashPassword(cleanDob);
    db.students.push({
      id: `stu_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      code: item.code,
      fullName: item.fullName,
      gender: item.gender,
      birthdate: item.birthdate,
      parentName: 'Phụ huynh ' + item.fullName,
      parentPhone: item.parentPhone,
      address: 'TP. Hồ Chí Minh',
      notes: '',
      internalNotes: '',
      authHash: hash,
      authSalt: salt,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  // Sample attendance today
  const today = new Date().toISOString().split('T')[0];
  db.attendance[today] = {};
  db.students.forEach((s, idx) => {
    if (idx === 7) db.attendance[today][s.id] = 'excused';
    else db.attendance[today][s.id] = 'present';
  });

  // Sample announcements
  db.announcements = [
    {
      id: 'post_1',
      title: 'Chào mừng năm học mới 2026 - 2027',
      content: 'Chào mừng tất cả các em học sinh và phụ huynh đến với năm học mới! Chúc các em luôn chăm ngoan, học giỏi và đạt nhiều thành tích xuất sắc.',
      mediaUrl: '',
      mediaType: '',
      youtubeUrl: '',
      driveUrl: '',
      isPinned: true,
      isPublished: true,
      author: db.classSettings.homeroomTeacher || 'GVCN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'post_2',
      title: 'Thi đua Tuần 6: Lớp xuất sắc xếp hạng Nhất',
      content: 'Tuần 6 vừa qua, lớp chúng ta đã xuất sắc đạt 483,4 điểm xếp hạng I toàn trường 3 tuần liên tiếp! Biểu dương tinh thần tự giác nề nếp của tất cả các bạn.',
      mediaUrl: '',
      mediaType: '',
      youtubeUrl: '',
      driveUrl: '',
      isPinned: false,
      isPublished: true,
      author: db.classSettings.homeroomTeacher || 'GVCN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Sample grades for month 10
  const curMonth = 'Tháng Mười';
  db.grades[curMonth] = {};
  db.students.forEach((s, i) => {
    db.grades[curMonth][s.id] = {
      TOAN: 8.5 + (i % 3) * 0.5,
      VAN: 7.5 + (i % 4) * 0.5,
      ANH: 8.0 + (i % 2) * 1.0,
      KHTN: 8.0 + (i % 3) * 0.5,
      LSDL: 8.5,
      GDCD: 9.0,
      TIN: 9.5,
      CN: 8.5,
    };
  });

  // Sample incidents
  if (db.students.length > 2) {
    db.incidents.push({
      id: 'inc_sample_1',
      studentId: db.students[7].id,
      date: today,
      type: 'violation',
      ruleName: 'Nghỉ học có phép',
      content: 'Phụ huynh xin phép cho em nghỉ ốm',
      points: 0,
      notes: 'Đã báo GVCN',
      visibleToStudent: true,
      recordedBy: db.classSettings.homeroomTeacher || 'GVCN',
      createdAt: new Date().toISOString(),
    });
    db.incidents.push({
      id: 'inc_sample_2',
      studentId: db.students[8].id,
      date: today,
      type: 'violation',
      ruleName: 'Không làm bài tập / không chép bài',
      content: 'Thiếu vở bài tập môn Toán',
      points: -3,
      notes: 'Nhắc nhở nộp bù vào ngày mai',
      visibleToStudent: true,
      recordedBy: db.classSettings.homeroomTeacher || 'GVCN',
      createdAt: new Date().toISOString(),
    });
  }

  saveDatabase(db);
  res.json({ success: true, message: 'Đã tạo dữ liệu mẫu thử nghiệm thành công.' });
});

// --- Serve Frontend (Vite in Dev or Static in Prod) ---
async function startServer() {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Trợ Lý Chủ Nhiệm] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
