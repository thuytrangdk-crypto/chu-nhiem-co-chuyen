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

// Ensure data directory exists (use /tmp on Vercel serverless)
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create DATA_DIR:', e);
  }
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
    appName: 'GVCN',
    schoolName: 'THCS Nguyễn Huệ',
    className: '9A12',
    homeroomTeacher: 'Võ Kim Chuyền',
    academicYear: '2026-2027',
    logoUrl: '',
    initialSetupDone: true,
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
    { id: 'sub_td', code: 'TD', name: 'Thể dục', isGraded: false },
    { id: 'sub_amnhac', code: 'AN', name: 'Âm nhạc', isGraded: false },
    { id: 'sub_mythuat', code: 'MT', name: 'Mĩ thuật', isGraded: false },
    { id: 'sub_hdtn', code: 'HDTN', name: 'HĐTN-HN', isGraded: false },
  ],
  students: [
    {
      id: 'stu_1792638158145_14ej0a',
      code: '02102013',
      fullName: 'Huỳnh Ngọc Trâm Anh',
      gender: 'Nữ',
      birthdate: '02/10/2013',
      parentName: 'Huỳnh Văn A',
      parentPhone: '0901234567',
      address: 'TP. Hồ Chí Minh',
      notes: 'Lớp phó học tập',
      internalNotes: '',
      authHash: '51e5a4d5071eed20e9434f16a4d3fc84ebafd7314c41d204de4bb43fb690b26805d3b45ced8aaa17a1d8f0469ce0d042f72e2b839a48c30f7637326e0e158193',
      authSalt: '710b1c5f91e274f78d7d5cb3a7e2055c',
      mustChangePassword: false,
      createdAt: '2026-10-22T03:02:38.145Z',
      updatedAt: '2026-10-22T03:02:38.145Z',
    },
    {
      id: 'stu_1792638158157_z2ncek',
      code: '27122013',
      fullName: 'Trần Ngô Quỳnh Anh',
      gender: 'Nữ',
      birthdate: '27/12/2013',
      parentName: 'Trần Văn B',
      parentPhone: '0912345678',
      address: 'TP. Hồ Chí Minh',
      notes: '',
      internalNotes: '',
      authHash: 'ea756fc216823407b918b070ffd0f48669fc35c2478d21417550a6cb4b664446b08b4d978d8e6266f91af0861c87d6e4b0476dc820287fb43dfaf78d2bf4c575',
      authSalt: 'a1afabf52295b435381ab640a5a15199',
      mustChangePassword: false,
      createdAt: '2026-10-22T03:02:38.157Z',
      updatedAt: '2026-10-22T03:02:38.157Z',
    },
    {
      id: 'stu_1792638158168_5xyrq5',
      code: '26052013',
      fullName: 'Nguyễn Gia Bảo',
      gender: 'Nam',
      birthdate: '26/05/2013',
      parentName: 'Nguyễn Văn C',
      parentPhone: '0923456789',
      address: 'TP. Hồ Chí Minh',
      notes: '',
      internalNotes: '',
      authHash: '43d7be760869aca3cce6bd421764b31588fd15b0f27df26675cedcb19454063bbd0b0c0ab2a5526ee134b10e78e906c2020072363b789c78ad3dbe931996a7ed',
      authSalt: 'a8d32cdef1423ce720c9560f48b598fb',
      mustChangePassword: false,
      createdAt: '2026-10-22T03:02:38.168Z',
      updatedAt: '2026-10-22T03:02:38.168Z',
    },
  ],
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

// --- Cloud & Local Database Persistence Layer ---
const SUPABASE_APP_DATA_ID = 'gvcn_class_state_primary';

function saveDatabaseLocally(data: typeof initialDb) {
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
    console.error('Error writing local database file:', err);
  }
}

// Push state to Supabase cloud
async function syncToSupabase(data: typeof initialDb): Promise<boolean> {
  const sUrl = (data.supabaseConfig.url || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || data.supabaseConfig.serviceKey || '').trim();
  if (!sUrl || !sKey) return false;

  try {
    const cleanUrl = sUrl.replace(/\/rest\/v1\/?$/, '');
    const payload = {
      id: SUPABASE_APP_DATA_ID,
      data: {
        version: data.version,
        classSettings: data.classSettings,
        adminAuth: data.adminAuth,
        emulationRules: data.emulationRules,
        emulationSettings: data.emulationSettings,
        subjects: data.subjects,
        students: data.students,
        attendance: data.attendance,
        grades: data.grades,
        incidents: data.incidents,
        announcements: data.announcements,
        seatingChart: data.seatingChart,
        honors: data.honors,
        gradeSnapshots: data.gradeSnapshots,
      },
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${cleanUrl}/rest/v1/app_data`, {
      method: 'POST',
      headers: {
        apikey: sKey,
        Authorization: `Bearer ${sKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 201 || res.status === 200) {
      data.supabaseConfig.lastSyncedAt = new Date().toISOString();
      data.supabaseConfig.syncStatus = 'connected';
      console.log(`☁️ [Supabase Cloud] State synced successfully (${data.students.length} students)`);
      return true;
    } else {
      const errText = await res.text();
      console.warn('⚠️ [Supabase Cloud] Upsert status:', res.status, errText);
      return false;
    }
  } catch (err: any) {
    console.error('❌ [Supabase Cloud] Sync failed:', err.message);
    return false;
  }
}

// Pull state from Supabase cloud
async function loadFromSupabase(): Promise<typeof initialDb | null> {
  const sUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!sUrl || !sKey) return null;

  try {
    const cleanUrl = sUrl.replace(/\/rest\/v1\/?$/, '');
    const res = await fetch(`${cleanUrl}/rest/v1/app_data?id=eq.${SUPABASE_APP_DATA_ID}`, {
      headers: {
        apikey: sKey,
        Authorization: `Bearer ${sKey}`,
      },
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
        const cloudData = rows[0].data;
        console.log(`☁️ [Supabase Cloud] Retrieved cloud state (${cloudData.students?.length || 0} students)`);
        return {
          ...initialDb,
          ...cloudData,
          supabaseConfig: {
            url: sUrl,
            serviceKey: sKey,
            enabled: true,
            lastSyncedAt: rows[0].updated_at || new Date().toISOString(),
            syncStatus: 'connected',
          },
        };
      }
    }
  } catch (err: any) {
    console.error('❌ [Supabase Cloud] Load failed:', err.message);
  }
  return null;
}

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
  saveDatabaseLocally(initialDb);
  return initialDb;
}

function saveDatabase(data: typeof initialDb) {
  saveDatabaseLocally(data);
  // Async push to Supabase cloud
  syncToSupabase(data).catch(err => {
    console.error('Background Supabase sync error:', err);
  });
}

let db = loadDatabase();
let isCloudInitialized = false;
let cloudInitPromise: Promise<void> | null = null;

async function ensureCloudHydrated(): Promise<void> {
  if (isCloudInitialized) return;
  if (!cloudInitPromise) {
    cloudInitPromise = (async () => {
      try {
        const cloudState = await loadFromSupabase();
        if (cloudState && cloudState.students) {
          console.log(`☁️ Hydrating db with Supabase cloud data: ${cloudState.students.length} students, isInitialPassword: ${cloudState.adminAuth?.isInitialPassword}`);
          db = {
            ...db,
            ...cloudState,
            supabaseConfig: {
              ...db.supabaseConfig,
              ...cloudState.supabaseConfig,
              url: process.env.SUPABASE_URL || cloudState.supabaseConfig.url || db.supabaseConfig.url,
              serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
              enabled: true,
              syncStatus: 'connected',
            },
          };
          saveDatabaseLocally(db);
        } else if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          await syncToSupabase(db);
        }
      } catch (err: any) {
        console.error('ensureCloudHydrated error:', err.message);
      } finally {
        isCloudInitialized = true;
      }
    })();
  }
  await cloudInitPromise;
}

// Ensure cloud state is loaded before any API request executes
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (!isCloudInitialized && (req.path.startsWith('/api') || req.path === '/')) {
    await ensureCloudHydrated();
  }
  next();
});

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
    const normalizedUsername = username.trim().toLowerCase();
    const student = db.students.find(s => {
      const cleanDob = (s.birthdate || '').replace(/\D/g, '');
      const expectedUsername = `${s.code}-${cleanDob}`.toLowerCase();
      return expectedUsername === normalizedUsername || (s as any).username?.toLowerCase() === normalizedUsername;
    });

    if (!student) {
      recordFailedLogin(ip);
      res.status(401).json({ error: 'Tài khoản học sinh không tồn tại trong danh sách lớp.' });
      return;
    }

    let valid = false;
    if (student.authHash && student.authSalt) {
      valid = verifyPassword(password, student.authHash, student.authSalt);
    } else {
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
    const student = db.students.find(s => s.id === user.studentId);
    if (!student) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ học sinh.' });
      return;
    }

    const studentAttendance: Record<string, string> = {};
    for (const [date, rec] of Object.entries(db.attendance)) {
      if (rec[student.id]) {
        studentAttendance[date] = rec[student.id];
      }
    }

    const studentGrades: Record<string, Record<string, number | null>> = {};
    for (const [month, monthRec] of Object.entries(db.grades)) {
      if (monthRec[student.id]) {
        studentGrades[month] = monthRec[student.id];
      }
    }

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

    const publishedAnnouncements = db.announcements.filter(a => a.isPublished);
    const seatingChart = db.seatingChart.isPublished ? db.seatingChart : null;
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

  const existing = db.students.find(s => s.code.toLowerCase() === code.trim().toLowerCase());
  if (existing) {
    res.status(400).json({ error: `Mã hồ sơ ${code} đã tồn tại trong lớp.` });
    return;
  }

  const cleanDob = birthdate.replace(/\D/g, '');
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
  const { students, mode = 'replace', updateExisting = true } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    res.status(400).json({ error: 'Không có dữ liệu học sinh để nhập.' });
    return;
  }

  let addedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  if (mode === 'replace') {
    const existingMap = new Map(db.students.map(s => [s.code.trim().toLowerCase(), s]));
    const newStudentsList: typeof db.students = [];

    students.forEach((item, index) => {
      const rowNum = index + 2;
      if (!item.code || !item.fullName || !item.birthdate) {
        errors.push(`Dòng ${rowNum}: Thiếu mã số, họ tên hoặc ngày sinh.`);
        return;
      }
      const cleanCode = String(item.code).trim();
      const cleanDob = String(item.birthdate).trim();
      const cleanGender = (item.gender || '').toLowerCase().includes('nữ') ? 'Nữ' : 'Nam';

      const existing = existingMap.get(cleanCode.toLowerCase());
      if (existing) {
        newStudentsList.push({
          ...existing,
          code: cleanCode,
          fullName: item.fullName.trim() || existing.fullName,
          gender: cleanGender,
          birthdate: cleanDob || existing.birthdate,
          parentName: item.parentName ? item.parentName.trim() : existing.parentName,
          parentPhone: item.parentPhone ? String(item.parentPhone).trim() : existing.parentPhone,
          address: item.address ? item.address.trim() : existing.address,
          notes: item.notes ? item.notes.trim() : existing.notes,
          updatedAt: new Date().toISOString(),
        });
        updatedCount++;
      } else {
        const cleanDobDigits = cleanDob.replace(/\D/g, '') || '123456';
        const { hash, salt } = hashPassword(cleanDobDigits);
        newStudentsList.push({
          id: `stu_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`,
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

    const newIds = new Set(newStudentsList.map(s => s.id));
    for (const [t, s] of sessions.entries()) {
      if (s.studentId && !newIds.has(s.studentId)) {
        sessions.delete(t);
      }
    }

    if (db.seatingChart && db.seatingChart.seats) {
      for (const [k, sId] of Object.entries(db.seatingChart.seats)) {
        if (sId && !newIds.has(sId)) {
          db.seatingChart.seats[k] = null;
        }
      }
    }

    db.students = newStudentsList;
  } else {
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
        const cleanDobDigits = cleanDob.replace(/\D/g, '') || '123456';
        const { hash, salt } = hashPassword(cleanDobDigits);
        db.students.push({
          id: `stu_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`,
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
  }

  saveDatabase(db);
  res.json({
    success: true,
    mode,
    addedCount,
    updatedCount,
    errors,
    totalStudents: db.students.length,
  });
});

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

app.delete('/api/students/:id', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const studentId = req.params.id;
  const index = db.students.findIndex(s => s.id === studentId);
  if (index === -1) {
    res.status(404).json({ error: 'Không tìm thấy học sinh.' });
    return;
  }

  db.students.splice(index, 1);

  for (const date of Object.keys(db.attendance)) {
    delete db.attendance[date][studentId];
  }
  for (const month of Object.keys(db.grades)) {
    delete db.grades[month][studentId];
  }
  db.incidents = db.incidents.filter(inc => inc.studentId !== studentId);

  if (db.seatingChart && db.seatingChart.seats) {
    for (const [key, val] of Object.entries(db.seatingChart.seats)) {
      if (val === studentId) {
        db.seatingChart.seats[key] = null;
      }
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

  db.attendance[date] = records;
  saveDatabase(db);
  res.json({ success: true, attendance: db.attendance[date] });
});

// --- Grades Management ---
app.put('/api/grades/month', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { month, grades } = req.body;
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

app.post('/api/grades/delete-month', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { month } = req.body;
  if (!month || !db.grades[month]) {
    res.status(400).json({ error: 'Không tìm thấy dữ liệu điểm của tháng này.' });
    return;
  }

  const snapshotId = `snap_${Date.now()}`;
  db.gradeSnapshots.push({
    id: snapshotId,
    month,
    deletedAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(db.grades[month])),
  });

  delete db.grades[month];
  db.honors = db.honors.filter(h => h.month !== month);

  saveDatabase(db);
  res.json({
    success: true,
    message: `Đã xóa bảng điểm ${month}. Bản sao lưu ${snapshotId} đã được tạo để khôi phục khi cần.`,
  });
});

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
app.put('/api/seating', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { rows, desksPerRow, seatsPerDesk, seats } = req.body;
  db.seatingChart = {
    ...db.seatingChart,
    rows: Number(rows) || db.seatingChart.rows,
    desksPerRow: Number(desksPerRow) || db.seatingChart.desksPerRow,
    seatsPerDesk: Number(seatsPerDesk) || db.seatingChart.seatsPerDesk,
    seats: seats !== undefined ? seats : db.seatingChart.seats,
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(db);
  res.json({ success: true, seatingChart: db.seatingChart });
});

app.post('/api/seating/publish', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { isPublished } = req.body;
  db.seatingChart.isPublished = !!isPublished;
  db.seatingChart.updatedAt = new Date().toISOString();
  saveDatabase(db);
  res.json({ success: true, seatingChart: db.seatingChart });
});

// --- Honors Management ---
app.post('/api/honors', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const { title, month, studentIds, notes } = req.body;
  if (!title || !studentIds || !Array.isArray(studentIds)) {
    res.status(400).json({ error: 'Vui lòng nhập tiêu đề và danh sách học sinh được vinh danh.' });
    return;
  }

  const honor = {
    id: `honor_${Date.now()}`,
    title: title.trim(),
    month: month || '',
    studentIds,
    notes: notes || '',
    isPublished: true,
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

  // Persist to local .env (strictly ignored by git)
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
  saveDatabase(db);
  res.json({
    success: true,
    supabaseConfig: {
      enabled: db.supabaseConfig.enabled,
      connected: db.supabaseConfig.enabled && !!db.supabaseConfig.url,
      lastSyncedAt: db.supabaseConfig.lastSyncedAt,
    },
  });
});

// Explicit Cloud Sync (Push to Supabase)
app.post('/api/system/sync', authMiddleware, teacherOnly, async (req: Request, res: Response) => {
  try {
    const success = await syncToSupabase(db);
    if (success) {
      db.supabaseConfig.lastSyncedAt = new Date().toISOString();
      db.supabaseConfig.syncStatus = 'connected';
      saveDatabaseLocally(db);
      res.json({
        success: true,
        message: `Đã đồng bộ thành công dữ liệu lớp lên Supabase (${db.students.length} học sinh, ${db.announcements.length} thông báo).`,
        totalStudents: db.students.length,
        lastSyncedAt: db.supabaseConfig.lastSyncedAt,
      });
    } else {
      res.status(500).json({
        error: 'Không thể kết nối đến Supabase để đồng bộ. Vui lòng kiểm tra lại URL và Service Role Key.',
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: `Lỗi đồng bộ: ${err.message}` });
  }
});

// Explicit Cloud Pull (Pull from Supabase)
app.post('/api/system/pull-supabase', authMiddleware, teacherOnly, async (req: Request, res: Response) => {
  try {
    const cloudState = await loadFromSupabase();
    if (!cloudState) {
      res.status(404).json({ error: 'Chưa tìm thấy dữ liệu sao lưu lớp học trên Supabase đám mây.' });
      return;
    }
    db = {
      ...initialDb,
      ...cloudState,
      supabaseConfig: {
        ...db.supabaseConfig,
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'connected',
      },
    };
    saveDatabaseLocally(db);
    res.json({
      success: true,
      message: `Đã nạp thành công ${db.students.length} học sinh từ Supabase đám mây!`,
      totalStudents: db.students.length,
      lastSyncedAt: db.supabaseConfig.lastSyncedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Lỗi tải dữ liệu Supabase: ${err.message}` });
  }
});

// Export Backup JSON
app.get('/api/system/backup', authMiddleware, teacherOnly, (req: Request, res: Response) => {
  const backupData = JSON.parse(JSON.stringify(db));
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

  const safetyBackupFile = path.join(DATA_DIR, `safety_backup_before_purge_${Date.now()}.json`);
  fs.writeFileSync(safetyBackupFile, JSON.stringify(db, null, 2), 'utf-8');

  db.students = [];
  db.attendance = {};
  db.grades = {};
  db.incidents = [];
  if (db.seatingChart) db.seatingChart.seats = {};
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

  const today = new Date().toISOString().split('T')[0];
  db.attendance[today] = {};
  db.students.forEach((s, idx) => {
    if (idx === 7) db.attendance[today][s.id] = 'excused';
    else db.attendance[today][s.id] = 'present';
  });

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
  ];

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

  // Ensure latest cloud data from Supabase is loaded on startup
  ensureCloudHydrated().catch(err => {
    console.warn('Initial cloud hydration check:', err.message);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Trợ Lý Chủ Nhiệm] Server running on http://0.0.0.0:${PORT}`);
  });
}

// In local dev/container environments, start the HTTP server.
// On Vercel, Vercel Serverless Function imports and handles the app instance directly.
if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
