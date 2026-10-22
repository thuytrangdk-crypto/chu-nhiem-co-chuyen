import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  Users,
  UserX,
  AlertTriangle,
  Award,
  ChevronRight,
  Clock,
  Sparkles,
  PlusCircle,
  FileSpreadsheet,
  Settings as SettingsIcon,
  CheckCircle2,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { role } = useAuth();
  const {
    classSettings,
    students,
    attendance,
    incidents,
    openStudentProfile,
    setActiveTab,
    refreshState,
  } = useApp();

  const totalStudents = students.length;
  const boysCount = students.filter(s => s.gender === 'Nam').length;
  const girlsCount = students.filter(s => s.gender === 'Nữ').length;

  // Today attendance
  const today = new Date().toISOString().split('T')[0];
  const todayRecord = attendance[today] || {};
  let absentToday = 0;
  let lateToday = 0;
  Object.values(todayRecord).forEach(st => {
    if (st === 'excused' || st === 'unexcused') absentToday++;
    if (st === 'late') lateToday++;
  });

  // Recent 7 days incidents
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekViolations = incidents.filter(i => {
    const isPenalty = i.points < 0 || i.type === 'violation';
    return isPenalty && new Date(i.date) >= sevenDaysAgo;
  }).length;

  const totalAwards = incidents.filter(i => i.points > 0 || i.type === 'award').length;

  // Attention students (criteria: violations >= threshold or absences >= threshold)
  const violationThreshold = classSettings.attentionThresholdViolations || 2;
  const absenceThreshold = classSettings.attentionThresholdAbsences || 2;

  const attentionList = students
    .map(st => {
      // count student violations
      const vCount = incidents.filter(
        i => i.studentId === st.id && (i.points < 0 || i.type === 'violation')
      ).length;

      // count student absences/lates
      let absCount = 0;
      Object.values(attendance).forEach(dateObj => {
        const val = dateObj[st.id];
        if (val === 'excused' || val === 'unexcused' || val === 'late') absCount++;
      });

      const needsAttention = vCount >= violationThreshold || absCount >= absenceThreshold;
      return { student: st, vCount, absCount, needsAttention };
    })
    .filter(item => item.needsAttention);

  // Recent activity (latest 10 incidents)
  const recentActivities = [...incidents]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const handleSeed = async () => {
    try {
      await api.seedSample();
      await refreshState();
    } catch (err: any) {
      alert(err.message || 'Không thể tạo dữ liệu mẫu');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner matching soft pastel pink from reference */}
      <div className="bg-gradient-to-r from-[#feb5c0] via-[#fda8b7] to-[#fca5b5] rounded-3xl p-6 sm:p-7 text-[#5a1020] border border-[#f89fae]/50 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/30 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#5a1020]">
              {classSettings.appName || 'Trợ Lý Chủ Nhiệm'} • Lớp {classSettings.className}
            </h2>
            <p className="text-[#781b2e] text-sm mt-1 font-medium">
              Giáo viên chủ nhiệm:{' '}
              <strong className="text-[#5a1020] font-bold">
                {classSettings.homeroomTeacher || 'Chưa cập nhật GVCN'}
              </strong>
            </p>
          </div>

          <div className="self-start sm:self-auto flex items-center gap-2 bg-white/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/60 text-xs font-bold text-[#5a1020] shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Năm học {classSettings.academicYear}</span>
          </div>
        </div>
      </div>

      {/* When class is brand new (0 students) */}
      {totalStudents === 0 && role === 'teacher' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-pink-200 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">
            Chào mừng Thầy/Cô đến với Trợ Lý Chủ Nhiệm Lớp {classSettings.className}!
          </h3>
          <p className="text-gray-500 text-sm max-w-lg mx-auto mt-2">
            Hệ thống hiện tại chưa có danh sách học sinh. Thầy/Cô có thể cấu hình tên trường/lớp, thêm học sinh trực tiếp, nhập từ file Excel, hoặc bấm nạp dữ liệu mẫu thử nghiệm để trải nghiệm ngay.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-pink-200 text-pink-700 bg-pink-50 hover:bg-pink-100 text-xs font-bold transition-colors"
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Cài đặt thông tin lớp</span>
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white text-xs font-bold shadow-xs transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm học sinh / Nhập Excel</span>
            </button>
            <button
              onClick={handleSeed}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Nạp 12 học sinh mẫu để thử</span>
            </button>
          </div>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sĩ số */}
        <div className="bg-white rounded-2xl p-5 border border-pink-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Sĩ số lớp
            </span>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">
              {totalStudents}
            </div>
            <div className="text-xs font-medium text-gray-500 mt-1">
              <span className="text-pink-600 font-semibold">{boysCount}</span> Nam •{' '}
              <span className="text-pink-600 font-semibold">{girlsCount}</span> Nữ
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Vắng hôm nay */}
        <div className="bg-white rounded-2xl p-5 border border-pink-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Vắng (Hôm nay)
            </span>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">
              {absentToday}
            </div>
            <div className="text-xs font-semibold text-rose-600 mt-1">
              {absentToday > 0 ? 'Cần kiểm tra lý do' : 'Đầy đủ sĩ số'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <UserX className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Vi phạm tuần */}
        <div className="bg-white rounded-2xl p-5 border border-pink-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Vi phạm (Tuần)
            </span>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">
              {weekViolations}
            </div>
            <div className="text-xs font-medium text-gray-500 mt-1">
              Lượt trừ điểm nề nếp
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Khen thưởng */}
        <div className="bg-white rounded-2xl p-5 border border-pink-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Khen thưởng
            </span>
            <div className="text-3xl font-extrabold text-gray-900 mt-1">
              {totalAwards}
            </div>
            <div className="text-xs font-medium text-emerald-600 mt-1">
              Lượt cộng điểm gương mẫu
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2 Main Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Học sinh cần chú ý */}
        <div className="bg-white rounded-3xl border border-pink-100 shadow-xs p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-pink-50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-base">Học sinh cần chú ý</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                    {attentionList.length} em
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Nghỉ học nhiều, có lỗi vi phạm hoặc cần liên hệ phụ huynh
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 divide-y divide-pink-50/80 overflow-y-auto max-h-[420px]">
            {attentionList.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                Không có học sinh nào chạm ngưỡng cảnh báo. Nề nếp lớp rất tốt!
              </div>
            ) : (
              attentionList.map(({ student, vCount, absCount }) => (
                <div
                  key={student.id}
                  onClick={() => openStudentProfile(student.id)}
                  className="py-3 px-2 flex items-center justify-between hover:bg-pink-50/50 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-700 font-bold text-sm flex items-center justify-center shrink-0">
                      {student.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-pink-600 transition-colors uppercase">
                        {student.fullName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {vCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Vi phạm: {vCount}
                          </span>
                        )}
                        {absCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Vắng/muộn: {absCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-pink-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Hoạt động gần đây */}
        <div className="bg-white rounded-3xl border border-pink-100 shadow-xs p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-pink-50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Hoạt động gần đây</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Nhật ký thi đua, khen thưởng và trao đổi
                </p>
              </div>
            </div>
            {role === 'teacher' && (
              <button
                onClick={() => setActiveTab('students')}
                className="text-xs font-semibold text-pink-600 hover:text-pink-700"
              >
                Xem tất cả
              </button>
            )}
          </div>

          <div className="mt-4 divide-y divide-pink-50/80 overflow-y-auto max-h-[420px]">
            {recentActivities.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                Chưa có sự việc thi đua nào được ghi nhận gần đây.
              </div>
            ) : (
              recentActivities.map(inc => {
                const targetStudent = students.find(s => s.id === inc.studentId);
                const isViolation = inc.points < 0 || inc.type === 'violation';

                return (
                  <div
                    key={inc.id}
                    onClick={() => {
                      if (targetStudent) openStudentProfile(targetStudent.id);
                    }}
                    className="py-3 px-2 flex items-start justify-between hover:bg-pink-50/50 rounded-xl cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isViolation
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {isViolation ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <Award className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 text-xs sm:text-sm uppercase group-hover:text-pink-600 transition-colors">
                            {targetStudent ? targetStudent.fullName : 'Học sinh'}
                          </h4>
                        </div>
                        <p className="text-xs text-gray-700 font-medium mt-0.5">
                          {inc.ruleName}
                        </p>
                        {inc.content && (
                          <p className="text-[11px] text-gray-500 line-clamp-1">{inc.content}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-[11px] font-medium text-gray-400 block">
                        {inc.date}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          isViolation ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {inc.points > 0 ? `+${inc.points}đ` : `${inc.points}đ`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
