# TRỢ LÝ CHỦ NHIỆM (HOMEROOM TEACHER ASSISTANT)

Ứng dụng web toàn diện hỗ trợ Giáo viên Chủ nhiệm (GVCN) và Học sinh quản lý lớp học: nề nếp thi đua, chuyên cần điểm danh, bảng điểm học tập theo tháng, bảng tin đa phương tiện, sơ đồ lớp 56 chỗ và xuất báo cáo Excel chuyên sâu.

---

## 1. TÍNH NĂNG NỔI BẬT

1. **Phân quyền chặt chẽ (RBAC) trên máy chủ & cơ sở dữ liệu:**
   - **Giáo viên chủ nhiệm (GVCN):** Toàn quyền quản lý học sinh, nhập/xuất Excel, ghi nhận vi phạm & khen thưởng, cấu hình quy tắc thi đua, xếp chỗ ngồi, công bố bảng tin và điểm danh.
   - **Học sinh:** Tự động tạo tài khoản khi thêm học sinh (`[mã số]-[ddmmyyyy]`). Chỉ được xem thông tin của chính mình (điểm danh, điểm học tập, thi đua cá nhân), xem bảng tin/sơ đồ lớp/bảng vàng đã công bố. Tuyệt đối không thể can thiệp dữ liệu lớp hay xem thông tin học sinh khác.

2. **Giao diện chuẩn thiết kế nhẹ nhàng:**
   - Nền hồng rất nhạt (`#fff8f9`), thẻ trắng nổi bật, nút hồng tinh tế, các thẻ tròn hiện đại.
   - Thích ứng hoàn hảo trên màn hình máy tính, máy tính bảng, điện thoại và Safari iPhone.

3. **Quản lý học sinh & Hồ sơ cá nhân toàn diện:**
   - Hiển thị linh hoạt dạng Thẻ (Cards view) và dạng Bảng (Table view).
   - Hồ sơ học sinh rộng rãi với 4 ô tổng hợp: Chuyên cần, Học tập (ĐTB), Điểm thi đua còn lại, Hạnh kiểm.
   - 5 tab chi tiết: Thông tin cá nhân, Điểm danh, Học tập, Thi đua & Kỷ luật (chia tỉ lệ 35% biểu mẫu - 65% lịch sử), Sổ tay liên lạc (có ghi chú nội bộ bảo mật của GVCN).
   - In Phiếu liên lạc học sinh tiêu chuẩn.

4. **Bảng điểm học tập & Tính ĐTB tháng:**
   - Nhập điểm trực tiếp trên bảng hoặc nhập từ Excel (hỗ trợ cả dấu chấm và phẩy, số 0 hợp lệ, khoảng trống là chưa có điểm).
   - Tự động tính điểm trung bình tháng cho các môn tính điểm, tự động xếp hạng Top 5 học tập theo giá trị chính xác chưa làm tròn.
   - Xóa bảng điểm tháng có lưu trữ snapshot tự động và phục hồi an toàn.

5. **Sơ đồ lớp 56 chỗ ngồi:**
   - Chuẩn 4 dãy, 7 bàn/dãy, 2 chỗ/bàn. Có bảng đen, bàn giáo viên, cửa ra vào và hướng nhìn rõ ràng.
   - Chống xếp trùng học sinh vào nhiều chỗ, hỗ trợ in sơ đồ lớp.

6. **Xuất Excel đa dạng & Chuẩn 2 Sheet vi phạm:**
   - Xuất danh sách học sinh.
   - Xuất bảng điểm học tập tháng.
   - Xuất báo cáo thi đua cả lớp.
   - **Xuất Excel vi phạm từng học sinh theo đúng 2 Sheet:**
     - *Sheet 1:* "Chi tiết vi phạm" (STT, Ngày xảy ra, Tên lỗi, Nội dung, Điểm trừ, Ghi chú, Người ghi nhận).
     - *Sheet 2:* "Tổng hợp theo lỗi" (Tên lỗi, Số lượt, Tổng điểm trừ, Tổng cộng).

---

## 2. BIẾN MÔI TRƯỜNG (.env)

| Tên biến | Mô tả | Mặc định |
|---|---|---|
| `PORT` | Cổng chạy máy chủ Express | `3000` |
| `NODE_ENV` | Môi trường (`development` hoặc `production`) | `development` |
| `SUPABASE_URL` | Địa chỉ dự án Supabase (tùy chọn) | Trống |
| `SUPABASE_SERVICE_ROLE_KEY` | Khóa dịch vụ quản trị Supabase trên máy chủ | Trống |

---

## 3. CẤU TRÚC SQL SUPABASE (NẾU DÙNG ĐỒNG BỘ ĐÁM MÂY)

Sao chép và chạy đoạn mã SQL sau trong **Supabase SQL Editor** để thiết lập bảng dữ liệu và chính sách bảo mật:

```sql
-- 1. Bảng lưu trữ cấu hình lớp và trạng thái hệ thống
CREATE TABLE IF NOT EXISTS class_settings (
  id TEXT PRIMARY KEY,
  app_name TEXT DEFAULT 'Trợ lý chủ nhiệm',
  school_name TEXT,
  class_name TEXT NOT NULL,
  homeroom_teacher TEXT,
  academic_year TEXT DEFAULT '2026-2027',
  logo_url TEXT,
  attention_threshold_violations INT DEFAULT 2,
  attention_threshold_absences INT DEFAULT 2,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng học sinh
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  birthdate TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT,
  address TEXT,
  notes TEXT,
  internal_notes TEXT,
  auth_hash TEXT,
  auth_salt TEXT,
  must_change_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng điểm danh
CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'present', 'excused', 'unexcused', 'late'
  UNIQUE(date, student_id)
);

-- 4. Bảng điểm học tập theo tháng
CREATE TABLE IF NOT EXISTS student_grades (
  id BIGSERIAL PRIMARY KEY,
  month TEXT NOT NULL,
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  subject_code TEXT NOT NULL,
  score NUMERIC(4,2),
  UNIQUE(month, student_id, subject_code)
);

-- 5. Bảng ghi nhận sự việc thi đua & nề nếp
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL, -- 'violation' hoặc 'award'
  rule_name TEXT NOT NULL,
  content TEXT,
  points NUMERIC(5,2) NOT NULL,
  notes TEXT,
  visible_to_student BOOLEAN DEFAULT TRUE,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bảng thông báo bảng tin
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  youtube_url TEXT,
  drive_url TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bảng sơ đồ lớp học
CREATE TABLE IF NOT EXISTS seating_chart (
  id TEXT PRIMARY KEY DEFAULT 'current_chart',
  seats JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Chỉ mục tối ưu tốc độ truy vấn
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_student_grades_month ON student_grades(month);
CREATE INDEX IF NOT EXISTS idx_incidents_student ON incidents(student_id);
```

---

## 4. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY

### Yêu cầu:
- Node.js >= 18.0.0
- npm hoặc yarn

### Cài đặt dependencies:
```bash
npm install
```

### Chạy ở chế độ phát triển (Development):
```bash
npm run dev
```
Ứng dụng sẽ chạy tại cổng `http://localhost:3000`.

### Kiểm tra build sản phẩm (Production Build):
```bash
npm run build
npm start
```

---

## 5. TÀI KHOẢN ĐĂNG NHẬP MẶC ĐỊNH KHI BẮT ĐẦU

1. **Giáo viên chủ nhiệm (GVCN):**
   - Chọn vai trò: **Giáo Viên Chủ Nhiệm**
   - Mật khẩu khởi tạo ban đầu: `123456`
   - *Lưu ý:* Hãy đổi mật khẩu quản trị ngay sau khi đăng nhập lần đầu tiên trong menu **Cài đặt**.

2. **Học sinh:**
   - Được tạo tự động khi GVCN thêm hoặc nhập Excel học sinh.
   - Tên đăng nhập: `[mã số]-[ddmmyyyy]` (Ví dụ mã `02102013`, sinh ngày 02/10/2013 -> Tên đăng nhập: `02102013-02102013`).
   - Mật khẩu ban đầu: Là ngày sinh 8 chữ số (`02102013`).
   - Học sinh có quyền đổi mật khẩu của mình bất cứ lúc nào.
