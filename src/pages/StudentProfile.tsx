import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Student, Incident } from '../types';
import { exportStudentViolationsExcel } from '../utils/excel';
import {
  ArrowLeft,
  Printer,
  Edit,
  KeyRound,
  CalendarCheck,
  BookOpen,
  Scale,
  Star,
  User,
  Clock,
  PlusCircle,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Phone,
  MapPin,
  FileText,
  Lock,
} from 'lucide-react';

export const StudentProfile: React.FC = () => {
  const { role } = useAuth();
  const {
    currentStudent,
    classSettings,
    setActiveTab,
    attendance,
    grades,
    subjects,
    incidents,
    emulationRules,
    emulationSettings,
    refreshState,
  } = useApp();

  const [activeTabKey, setActiveTabKey] = useState<
    'info' | 'attendance' | 'grades' | 'discipline' | 'contact'
  >('discipline');

  // Discipline Form State
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [incidentContent, setIncidentContent] = useState('');
  const [incidentPoints, setIncidentPoints] = useState<number>(-2);
  const [incidentNotes, setIncidentNotes] = useState('');
  const [visibleToStudent, setVisibleToStudent] = useState(true);
  const [isSavingIncident, setIsSavingIncident] = useState(false);
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null);

  // Period filter for discipline history
  const [disciplinePeriod, setDisciplinePeriod] = useState<string>('all');

  // Printable report card modal
  const [isReportCardOpen, setIsReportCardOpen] = useState(false);
  const [teacherRemarks, setTeacherRemarks] = useState(
    'Em có ý thức rèn luyện tốt, chăm chỉ học tập và chấp hành tốt nội quy lớp học.'
  );

  // Edit Student Modal State
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editGender, setEditGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [editBirthdate, setEditBirthdate] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editInternalNotes, setEditInternalNotes] = useState('');
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  const handleOpenEditStudent = () => {
    if (!currentStudent) return;
    setEditFullName(currentStudent.fullName);
    setEditCode(currentStudent.code);
    setEditGender(currentStudent.gender);
    setEditBirthdate(currentStudent.birthdate);
    setEditParentName(currentStudent.parentName || '');
    setEditParentPhone(currentStudent.parentPhone || '');
    setEditAddress(currentStudent.address || '');
    setEditNotes(currentStudent.notes || '');
    setEditInternalNotes(currentStudent.internalNotes || '');
    setIsEditStudentOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) return;
    if (!editFullName.trim() || !editCode.trim()) {
      alert('Vui lòng điền Họ và tên đầy đủ và Mã học sinh.');
      return;
    }
    setIsSavingStudent(true);
    try {
      await api.updateStudent(currentStudent.id, {
        fullName: editFullName.trim(),
        code: editCode.trim(),
        gender: editGender,
        birthdate: editBirthdate.trim(),
        parentName: editParentName.trim(),
        parentPhone: editParentPhone.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
        internalNotes: editInternalNotes.trim(),
      });
      await refreshState();
      setIsEditStudentOpen(false);
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật hồ sơ học sinh.');
    } finally {
      setIsSavingStudent(false);
    }
  };

  if (!currentStudent) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-pink-100">
        <p className="text-gray-500 font-semibold">Chưa chọn học sinh.</p>
        <button
          onClick={() => setActiveTab('students')}
          className="mt-4 px-4 py-2 bg-[#e25d7c] hover:bg-[#d44b6b] text-white rounded-xl text-xs font-bold transition-colors"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  // --- Calculations for Student ---
  // 1. Attendance stats
  let presentDays = 0;
  let excusedDays = 0;
  let unexcusedDays = 0;
  let lateDays = 0;
  const attendanceLogs: Array<{ date: string; status: string }> = [];

  Object.entries(attendance).forEach(([date, rec]) => {
    const st = rec[currentStudent.id];
    if (st) {
      attendanceLogs.push({ date, status: st });
      if (st === 'present') presentDays++;
      else if (st === 'excused') excusedDays++;
      else if (st === 'unexcused') unexcusedDays++;
      else if (st === 'late') lateDays++;
    }
  });
  attendanceLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 2. Academic GPA
  const availableMonths = Object.keys(grades);
  const latestMonth = availableMonths[availableMonths.length - 1] || 'Tháng Mười';
  const latestScores = grades[latestMonth]?.[currentStudent.id] || {};
  const gradedSubjects = subjects.filter(s => s.isGraded);

  let gpaSum = 0;
  let gpaCount = 0;
  gradedSubjects.forEach(sub => {
    const val = latestScores[sub.code];
    if (val !== undefined && val !== null) {
      gpaSum += val;
      gpaCount++;
    }
  });
  const latestGpa = gpaCount > 0 ? (gpaSum / gpaCount).toFixed(2) : null;

  // 3. Emulation score & Incidents
  const studentIncidents = incidents.filter(i => {
    const isThisStudent = i.studentId === currentStudent.id;
    if (role === 'student') {
      return isThisStudent && i.visibleToStudent !== false;
    }
    return isThisStudent;
  });

  const totalBonus = studentIncidents
    .filter(i => i.points > 0)
    .reduce((acc, cur) => acc + cur.points, 0);

  const totalPenalty = studentIncidents
    .filter(i => i.points < 0)
    .reduce((acc, cur) => acc + Math.abs(cur.points), 0);

  const currentScore = emulationSettings.startingScore + totalBonus - totalPenalty;

  // Conduct rank calculation
  let conductRank = 'Chưa đạt';
  let conductColor = 'text-rose-600 bg-rose-50 border-rose-200';
  if (currentScore >= emulationSettings.thresholdGood) {
    conductRank = 'Tốt';
    conductColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (currentScore >= emulationSettings.thresholdFair) {
    conductRank = 'Khá';
    conductColor = 'text-blue-700 bg-blue-50 border-blue-200';
  } else if (currentScore >= emulationSettings.thresholdPass) {
    conductRank = 'Đạt';
    conductColor = 'text-amber-700 bg-amber-50 border-amber-200';
  }

  // Filter incidents by period
  const filteredIncidents = studentIncidents.filter(i => {
    if (disciplinePeriod === 'all') return true;
    return i.date.startsWith(disciplinePeriod);
  });

  // Handle Emulation Rule selection in form
  const handleRuleChange = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    const matched = emulationRules.find(r => r.id === ruleId);
    if (matched) {
      setIncidentPoints(matched.points);
      if (!incidentContent) setIncidentContent(matched.name);
    }
  };

  // Save Incident
  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDate || incidentPoints === undefined) {
      alert('Vui lòng điền đủ ngày và số điểm.');
      return;
    }
    setIsSavingIncident(true);
    try {
      const ruleName =
        emulationRules.find(r => r.id === selectedRuleId)?.name || 'Quy tắc rèn luyện';

      if (editingIncidentId) {
        await api.updateIncident(editingIncidentId, {
          date: incidentDate,
          type: incidentPoints < 0 ? 'violation' : 'award',
          ruleName,
          content: incidentContent,
          points: incidentPoints,
          notes: incidentNotes,
          visibleToStudent,
        });
      } else {
        await api.createIncident({
          studentId: currentStudent.id,
          date: incidentDate,
          type: incidentPoints < 0 ? 'violation' : 'award',
          ruleName,
          content: incidentContent,
          points: incidentPoints,
          notes: incidentNotes,
          visibleToStudent,
        });
      }

      await refreshState();
      // Reset form
      setEditingIncidentId(null);
      setSelectedRuleId('');
      setIncidentContent('');
      setIncidentNotes('');
      setIncidentPoints(-2);
    } catch (err: any) {
      alert(err.message || 'Không thể lưu ghi nhận sự việc.');
    } finally {
      setIsSavingIncident(false);
    }
  };

  const handleEditIncident = (inc: Incident) => {
    setEditingIncidentId(inc.id);
    setIncidentDate(inc.date);
    setIncidentPoints(inc.points);
    setIncidentContent(inc.content);
    setIncidentNotes(inc.notes || '');
    setVisibleToStudent(inc.visibleToStudent !== false);
    const matchRule = emulationRules.find(r => r.name === inc.ruleName);
    if (matchRule) setSelectedRuleId(matchRule.id);
  };

  const handleDeleteIncident = async (id: string) => {
    if (!window.confirm('Xác nhận xóa ghi nhận sự việc này?')) return;
    try {
      await api.deleteIncident(id);
      await refreshState();
    } catch (err: any) {
      alert(err.message || 'Không thể xóa sự việc.');
    }
  };

  const handleResetPassword = async () => {
    if (
      !window.confirm(
        `Xác nhận đặt lại mật khẩu cho học sinh "${currentStudent.fullName}"?\nMật khẩu sẽ được hoàn về ngày sinh (ddmmyyyy). Học sinh sẽ được yêu cầu đổi lại sau khi đăng nhập.`
      )
    ) {
      return;
    }
    try {
      const res = await api.resetStudentPassword(currentStudent.id);
      alert(res.message || 'Đã đặt lại mật khẩu thành công.');
    } catch (err: any) {
      alert(err.message || 'Lỗi đặt lại mật khẩu.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb Bar matching screenshot 8 */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-pink-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('students')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-pink-50 text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs font-medium">Hồ sơ học sinh:</span>
              <span className="font-extrabold text-gray-900 text-sm sm:text-base uppercase tracking-tight">
                {currentStudent.fullName}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              Mã định danh: {currentStudent.code}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {role === 'teacher' && (
            <>
              <button
                onClick={handleOpenEditStudent}
                title="Chỉnh sửa thông tin học sinh"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-pink-200 text-[#a02040] bg-[#fce7eb] hover:bg-[#fad3db] text-xs font-bold transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Sửa thông tin</span>
              </button>

              <button
                onClick={handleResetPassword}
                title="Đặt lại mật khẩu về ngày sinh"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs font-bold transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đặt lại mật khẩu</span>
              </button>

              <button
                onClick={() => setIsReportCardOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-bold transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Phiếu liên lạc</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Student Header Box matching screenshot 8 */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-pink-100 shadow-xs text-center relative overflow-hidden">
        {/* Warning if full name is numeric or matches student code */}
        {(/^\d+$/.test(currentStudent.fullName) || currentStudent.fullName === currentStudent.code) && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2 max-w-2xl mx-auto">
            <span>
              Học sinh đang hiển thị mã số (<strong>{currentStudent.fullName}</strong>) thay vì họ tên đầy đủ.
            </span>
            {role === 'teacher' && (
              <button
                onClick={handleOpenEditStudent}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs"
              >
                Cập nhật Họ tên ngay
              </button>
            )}
          </div>
        )}

        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-wide">
          {currentStudent.fullName}
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-xs font-semibold text-gray-500">
          <span
            className={
              currentStudent.gender === 'Nữ' ? 'text-pink-600 font-bold' : 'text-blue-600 font-bold'
            }
          >
            {currentStudent.gender}
          </span>
          <span>•</span>
          <span>Ngày sinh: {currentStudent.birthdate}</span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono border border-blue-200">
            ID: {currentStudent.code}
          </span>
        </div>

        {/* 4 Summary Boxes matching screenshot 8 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 max-w-4xl mx-auto">
          {/* Box 1: Điểm danh */}
          <div className="bg-pink-50/50 rounded-2xl p-4 border border-pink-100 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-pink-700 text-xs font-bold uppercase mb-1">
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Điểm danh</span>
            </div>
            <div className="text-2xl font-black text-gray-900">
              {excusedDays + unexcusedDays + lateDays}
            </div>
            <span className="text-[11px] text-gray-500 font-medium">vắng/muộn</span>
          </div>

          {/* Box 2: Học tập */}
          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold uppercase mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Học tập</span>
            </div>
            <div className="text-2xl font-black text-emerald-800">
              {latestGpa || 'Chưa có'}
            </div>
            <span className="text-[11px] text-gray-500 font-medium">ĐTB môn ({latestMonth})</span>
          </div>

          {/* Box 3: Điểm thi đua */}
          <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-purple-700 text-xs font-bold uppercase mb-1">
              <Scale className="w-3.5 h-3.5" />
              <span>Điểm thi đua còn lại</span>
            </div>
            <div className="text-2xl font-black text-purple-900">
              {currentScore}{' '}
              <span className="text-xs text-gray-400 font-medium">
                / {emulationSettings.startingScore}đ
              </span>
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
              {totalPenalty === 0 ? 'Chưa có điểm trừ' : `Trừ: -${totalPenalty}đ • Thưởng: +${totalBonus}đ`}
            </span>
          </div>

          {/* Box 4: Xếp loại rèn luyện / Hạnh kiểm */}
          <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold uppercase mb-1">
              <Star className="w-3.5 h-3.5" />
              <span>Hạnh kiểm</span>
            </div>
            <div className="text-2xl font-black text-amber-700">{conductRank}</div>
            <span className="text-[11px] text-gray-500 font-medium">Quy chuẩn nội bộ</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar matching screenshot 8 */}
      <div className="bg-white rounded-3xl p-2 border border-pink-100 shadow-xs flex overflow-x-auto">
        <button
          onClick={() => setActiveTabKey('info')}
          className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTabKey === 'info'
              ? 'bg-pink-100/80 text-pink-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/50'
          }`}
        >
          Thông tin cá nhân
        </button>
        <button
          onClick={() => setActiveTabKey('attendance')}
          className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTabKey === 'attendance'
              ? 'bg-pink-100/80 text-pink-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/50'
          }`}
        >
          Điểm danh ({attendanceLogs.length})
        </button>
        <button
          onClick={() => setActiveTabKey('grades')}
          className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTabKey === 'grades'
              ? 'bg-pink-100/80 text-pink-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/50'
          }`}
        >
          Học tập & Điểm số
        </button>
        <button
          onClick={() => setActiveTabKey('discipline')}
          className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTabKey === 'discipline'
              ? 'bg-pink-100/80 text-pink-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/50'
          }`}
        >
          Thi đua & Kỷ luật
        </button>
        <button
          onClick={() => setActiveTabKey('contact')}
          className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTabKey === 'contact'
              ? 'bg-pink-100/80 text-pink-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/50'
          }`}
        >
          Sổ tay & Liên hệ
        </button>
      </div>

      {/* TAB CONTENT: THI ĐUA & KỶ LUẬT (Requirement 7: 35% Left Form, 65% Right History) */}
      {activeTabKey === 'discipline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (~35% = lg:col-span-4): Form ghi nhận sự việc */}
          {role === 'teacher' ? (
            <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-pink-100 shadow-xs sticky top-16">
              <div className="flex items-center gap-2 pb-3 border-b border-pink-50 mb-4">
                <PlusCircle className="w-5 h-5 text-pink-600" />
                <h3 className="font-bold text-gray-900 text-sm uppercase">
                  {editingIncidentId ? 'Sửa ghi nhận sự việc' : '+ Ghi nhận sự việc'}
                </h3>
              </div>

              <form onSubmit={handleSaveIncident} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Ngày xảy ra *
                  </label>
                  <input
                    type="date"
                    required
                    value={incidentDate}
                    onChange={e => setIncidentDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Quy tắc thi đua *
                  </label>
                  <select
                    value={selectedRuleId}
                    onChange={e => handleRuleChange(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-pink-500 font-medium"
                  >
                    <option value="">-- Chọn tiêu chí có sẵn --</option>
                    <optgroup label="Lỗi vi phạm nề nếp">
                      {emulationRules
                        .filter(r => r.type === 'violation')
                        .map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.points}đ)
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Khen thưởng & Gương mẫu">
                      {emulationRules
                        .filter(r => r.type === 'award')
                        .map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name} (+{r.points}đ)
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Nội dung chi tiết
                  </label>
                  <input
                    type="text"
                    value={incidentContent}
                    onChange={e => setIncidentContent(e.target.value)}
                    placeholder="Mô tả sự việc..."
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Điểm cộng / trừ (Nhập số âm nếu trừ) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={incidentPoints}
                    onChange={e => setIncidentPoints(parseFloat(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Ghi chú thêm
                  </label>
                  <textarea
                    rows={2}
                    value={incidentNotes}
                    onChange={e => setIncidentNotes(e.target.value)}
                    placeholder="Ghi chú nhắc nhở phụ huynh hoặc biện pháp xử lý..."
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-pink-500"
                  ></textarea>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="visCheck"
                    checked={visibleToStudent}
                    onChange={e => setVisibleToStudent(e.target.checked)}
                    className="rounded text-pink-600 focus:ring-pink-500"
                  />
                  <label htmlFor="visCheck" className="text-xs text-gray-600 cursor-pointer">
                    Cho phép học sinh xem sự việc này
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {editingIncidentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIncidentId(null);
                        setIncidentContent('');
                        setIncidentNotes('');
                      }}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                    >
                      Hủy sửa
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingIncident}
                    className="flex-1 py-2.5 rounded-xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isSavingIncident ? 'Đang lưu...' : editingIncidentId ? 'Cập nhật' : 'Lưu ghi nhận'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-pink-100 shadow-xs">
              <h3 className="font-bold text-gray-900 text-sm uppercase mb-2">Quy chế rèn luyện</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Học sinh được cộng điểm khi phát biểu xây dựng bài, làm việc tốt và bị trừ điểm nếu vi phạm nội quy. Kết quả thi đua được tổng hợp và xếp loại theo tuần và kỳ.
              </p>
            </div>
          )}

          {/* Right Column (~65% = lg:col-span-8): History & Export Excel */}
          <div className="lg:col-span-8 space-y-4">
            {/* Filter & Export Bar matching screenshot 8 */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-pink-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase">Kỳ đánh giá:</span>
                <select
                  value={disciplinePeriod}
                  onChange={e => setDisciplinePeriod(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-white font-medium focus:ring-2 focus:ring-pink-500"
                >
                  <option value="all">Tất cả thời gian</option>
                  <option value="2026-10">Tháng 10/2026</option>
                  <option value="2026-11">Tháng 11/2026</option>
                  <option value="2026-12">Tháng 12/2026</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    exportStudentViolationsExcel(
                      currentStudent,
                      studentIncidents,
                      disciplinePeriod === 'all' ? 'Toàn bộ năm học' : `Tháng ${disciplinePeriod}`,
                      classSettings
                    )
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Xuất Excel vi phạm</span>
                </button>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">
                    Điểm thi đua còn lại
                  </span>
                  <span className="text-lg font-black text-gray-900">
                    {currentScore}{' '}
                    <span className="text-xs text-gray-400 font-medium">
                      / {emulationSettings.startingScore}đ
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Incident History List */}
            <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-pink-50 mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pink-600" />
                  <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                    Lịch sử sự việc thi đua & kỷ luật ({filteredIncidents.length})
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-rose-600 font-semibold">Điểm trừ: -{totalPenalty}đ</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-emerald-600 font-semibold">Thưởng: +{totalBonus}đ</span>
                </div>
              </div>

              <div className="divide-y divide-pink-50/80 overflow-y-auto max-h-[500px]">
                {filteredIncidents.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-xs">
                    Chưa có sự việc thi đua nào trong kỳ này.
                  </div>
                ) : (
                  filteredIncidents.map(inc => {
                    const isViolation = inc.points < 0 || inc.type === 'violation';
                    return (
                      <div
                        key={inc.id}
                        className="py-3 px-2 flex items-start justify-between hover:bg-pink-50/40 rounded-xl transition-colors group"
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
                              <ShieldAlert className="w-4 h-4" />
                            ) : (
                              <Star className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900">
                                {inc.ruleName}
                              </span>
                              {!inc.visibleToStudent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600 flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Ẩn với HS
                                </span>
                              )}
                            </div>
                            {inc.content && (
                              <p className="text-xs text-gray-600 mt-0.5">{inc.content}</p>
                            )}
                            {inc.notes && (
                              <p className="text-[11px] text-gray-400 italic mt-0.5">
                                Ghi chú: {inc.notes}
                              </p>
                            )}
                            <div className="text-[10px] text-gray-400 mt-1">
                              Ngày: {inc.date} • Người ghi: {inc.recordedBy || 'GVCN'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span
                            className={`text-sm font-extrabold ${
                              isViolation ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {inc.points > 0 ? `+${inc.points}đ` : `${inc.points}đ`}
                          </span>

                          {role === 'teacher' && (
                            <div className="hidden group-hover:flex items-center gap-1">
                              <button
                                onClick={() => handleEditIncident(inc)}
                                className="p-1 text-gray-400 hover:text-pink-600"
                                title="Sửa"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteIncident(inc.id)}
                                className="p-1 text-gray-400 hover:text-rose-600"
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: THÔNG TIN CÁ NHÂN */}
      {activeTabKey === 'info' && (
        <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-xs max-w-3xl space-y-4">
          <h3 className="font-bold text-gray-900 text-sm uppercase pb-3 border-b border-pink-50">
            Hồ sơ lý lịch học sinh
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-2xl bg-pink-50/40 border border-pink-100">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Mã học sinh</span>
              <p className="text-gray-900 font-bold font-mono text-sm mt-0.5">{currentStudent.code}</p>
            </div>
            <div className="p-3 rounded-2xl bg-pink-50/40 border border-pink-100">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Họ và tên</span>
              <p className="text-gray-900 font-bold uppercase text-sm mt-0.5">{currentStudent.fullName}</p>
            </div>
            <div className="p-3 rounded-2xl bg-pink-50/40 border border-pink-100">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Giới tính</span>
              <p className="text-gray-900 font-bold mt-0.5">{currentStudent.gender}</p>
            </div>
            <div className="p-3 rounded-2xl bg-pink-50/40 border border-pink-100">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Ngày sinh</span>
              <p className="text-gray-900 font-bold mt-0.5">{currentStudent.birthdate}</p>
            </div>
            <div className="p-3 rounded-2xl bg-pink-50/40 border border-pink-100">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Phụ huynh</span>
              <p className="text-gray-900 font-bold mt-0.5">
                {currentStudent.parentName || 'Chưa cập nhật'}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-pink-50/40 border border-pink-100">
              <span className="font-bold text-gray-400 uppercase text-[10px]">SĐT Phụ huynh</span>
              <p className="text-gray-900 font-bold mt-0.5">
                {currentStudent.parentPhone || 'Chưa cập nhật'}
              </p>
            </div>
            <div className="col-span-full p-3 rounded-2xl bg-pink-50/40 border border-pink-100">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Địa chỉ</span>
              <p className="text-gray-900 font-medium mt-0.5">
                {currentStudent.address || 'Chưa cập nhật'}
              </p>
            </div>
            <div className="col-span-full p-3 rounded-2xl bg-pink-50/40 border border-pink-100">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Ghi chú</span>
              <p className="text-gray-900 font-medium mt-0.5">
                {currentStudent.notes || 'Không có'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ĐIỂM DANH */}
      {activeTabKey === 'attendance' && (
        <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-pink-50">
            <h3 className="font-bold text-gray-900 text-sm uppercase">
              Nhật ký chuyên cần ({attendanceLogs.length} ngày đã ghi nhận)
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                Có mặt: {presentDays}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold">
                Có phép: {excusedDays}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold">
                Không phép: {unexcusedDays}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold">
                Muộn: {lateDays}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {attendanceLogs.length === 0 ? (
              <div className="col-span-full py-8 text-center text-gray-400 text-xs">
                Chưa có dữ liệu điểm danh.
              </div>
            ) : (
              attendanceLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl border border-pink-100 text-center bg-pink-50/20"
                >
                  <span className="text-xs font-semibold text-gray-700 block">{log.date}</span>
                  <span
                    className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      log.status === 'present'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.status === 'excused'
                        ? 'bg-blue-100 text-blue-800'
                        : log.status === 'unexcused'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {log.status === 'present'
                      ? 'Có mặt'
                      : log.status === 'excused'
                      ? 'Có phép'
                      : log.status === 'unexcused'
                      ? 'Kh.phép'
                      : 'Muộn'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: HỌC TẬP & ĐIỂM SỐ */}
      {activeTabKey === 'grades' && (
        <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-xs space-y-4">
          <h3 className="font-bold text-gray-900 text-sm uppercase pb-3 border-b border-pink-50">
            Kết quả học tập theo tháng
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-pink-50 text-gray-700 font-bold">
                  <th className="p-3">Tháng</th>
                  {gradedSubjects.map(sub => (
                    <th key={sub.id} className="p-3 text-center">
                      {sub.name}
                    </th>
                  ))}
                  <th className="p-3 text-center bg-pink-100/80 font-black">ĐTB Tháng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-50">
                {availableMonths.map(month => {
                  const mScores = grades[month]?.[currentStudent.id] || {};
                  let sum = 0;
                  let count = 0;
                  gradedSubjects.forEach(s => {
                    const v = mScores[s.code];
                    if (v !== undefined && v !== null) {
                      sum += v;
                      count++;
                    }
                  });
                  const gpa = count > 0 ? (sum / count).toFixed(2) : '-';

                  return (
                    <tr key={month} className="hover:bg-pink-50/20">
                      <td className="p-3 font-bold text-gray-800">{month}</td>
                      {gradedSubjects.map(s => {
                        const val = mScores[s.code];
                        return (
                          <td key={s.id} className="p-3 text-center font-bold">
                            {val !== undefined && val !== null ? val : '-'}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center font-black text-pink-700 bg-pink-50/50">
                        {gpa}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SỔ TAY & LIÊN HỆ */}
      {activeTabKey === 'contact' && (
        <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-xs space-y-4 max-w-2xl">
          <h3 className="font-bold text-gray-900 text-sm uppercase pb-3 border-b border-pink-50">
            Sổ tay theo dõi & Liên hệ phụ huynh
          </h3>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-pink-50/40 border border-pink-100 space-y-2">
              <span className="font-bold text-gray-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-pink-600" />
                <span>Liên hệ nhanh</span>
              </span>
              <p className="text-gray-600">
                Phụ huynh: <strong>{currentStudent.parentName || 'Chưa có thông tin'}</strong>
              </p>
              <p className="text-gray-600">
                Điện thoại: <strong>{currentStudent.parentPhone || 'Chưa có số'}</strong>
              </p>
            </div>

            {role === 'teacher' && (
              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-2">
                <span className="font-bold text-rose-800 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-600" />
                  <span>Ghi chú nội bộ giáo viên chủ nhiệm</span>
                </span>
                <p className="text-rose-900 font-medium">
                  {currentStudent.internalNotes || 'Không có ghi chú nội bộ nào.'}
                </p>
                <p className="text-[10px] text-gray-400 italic">
                  * Ghi chú này chỉ giáo viên chủ nhiệm được thấy, bảo mật tuyệt đối với học sinh.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRINTABLE REPORT CARD MODAL (PHIẾU LIÊN LẠC) */}
      {isReportCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 border border-pink-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 print:hidden mb-6">
              <h3 className="font-black text-gray-900 text-lg">In Phiếu Liên Lạc Học Sinh</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-bold hover:bg-pink-700"
                >
                  <Printer className="w-4 h-4" />
                  <span>In ngay</span>
                </button>
                <button
                  onClick={() => setIsReportCardOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="space-y-6 text-gray-800 font-sans print:p-0">
              <div className="text-center space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  {classSettings.schoolName || 'TRƯỜNG TRUNG HỌC CƠ SỞ'}
                </p>
                <h2 className="text-xl font-black uppercase text-pink-700">
                  PHIẾU LIÊN LẠC HỌC SINH
                </h2>
                <p className="text-xs text-gray-500">
                  Lớp: <strong>{classSettings.className}</strong> • Năm học:{' '}
                  <strong>{classSettings.academicYear}</strong>
                </p>
              </div>

              <div className="border border-gray-300 rounded-xl p-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span>
                    Họ và tên học sinh: <strong className="uppercase">{currentStudent.fullName}</strong>
                  </span>
                  <span>
                    Mã hồ sơ: <strong>{currentStudent.code}</strong>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>
                    Ngày sinh: <strong>{currentStudent.birthdate}</strong>
                  </span>
                  <span>
                    Giới tính: <strong>{currentStudent.gender}</strong>
                  </span>
                </div>
                <div>
                  Giáo viên chủ nhiệm: <strong>{classSettings.homeroomTeacher}</strong>
                </div>
              </div>

              {/* Attendance & Conduct summary */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="border border-gray-300 rounded-xl p-3">
                  <h4 className="font-bold uppercase text-gray-700 mb-1">Chuyên cần</h4>
                  <p>Số buổi có mặt: {presentDays}</p>
                  <p>Vắng có phép: {excusedDays}</p>
                  <p>Vắng không phép: {unexcusedDays}</p>
                  <p>Đi muộn: {lateDays}</p>
                </div>
                <div className="border border-gray-300 rounded-xl p-3">
                  <h4 className="font-bold uppercase text-gray-700 mb-1">Rèn luyện & Nề nếp</h4>
                  <p>
                    Điểm thi đua:{' '}
                    <strong>
                      {currentScore} / {emulationSettings.startingScore}đ
                    </strong>
                  </p>
                  <p>
                    Xếp loại hạnh kiểm: <strong className="text-pink-700">{conductRank}</strong>
                  </p>
                  <p>
                    ĐTB học tập ({latestMonth}): <strong>{latestGpa || 'Đang cập nhật'}</strong>
                  </p>
                </div>
              </div>

              {/* Remarks area */}
              <div className="border border-gray-300 rounded-xl p-3 text-xs">
                <h4 className="font-bold uppercase text-gray-700 mb-1">
                  Nhận xét của Giáo viên Chủ nhiệm
                </h4>
                <textarea
                  rows={3}
                  value={teacherRemarks}
                  onChange={e => setTeacherRemarks(e.target.value)}
                  className="w-full text-xs border-none p-1 focus:outline-hidden resize-none print:border-none"
                ></textarea>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs">
                <div>
                  <p className="font-bold uppercase">Ý kiến Phụ huynh học sinh</p>
                  <p className="text-[11px] text-gray-400 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                  <div className="h-16"></div>
                </div>
                <div>
                  <p className="font-bold uppercase">Giáo viên Chủ nhiệm</p>
                  <p className="text-[11px] text-gray-400 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                  <div className="h-16 flex items-end justify-center font-bold">
                    {classSettings.homeroomTeacher}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa thông tin học sinh */}
      {isEditStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-pink-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-pink-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Cập nhật hồ sơ học sinh</h3>
              </div>
              <button
                onClick={() => setIsEditStudentOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Họ và tên đầy đủ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  placeholder="Ví dụ: Huỳnh Ngọc Trâm Anh"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Mã học sinh / ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={e => setEditCode(e.target.value)}
                    placeholder="Mã định danh"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-mono font-semibold focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Giới tính
                  </label>
                  <select
                    value={editGender}
                    onChange={e => setEditGender(e.target.value as 'Nam' | 'Nữ')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Ngày sinh (dd/mm/yyyy)
                  </label>
                  <input
                    type="text"
                    value={editBirthdate}
                    onChange={e => setEditBirthdate(e.target.value)}
                    placeholder="02/10/2013"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Số điện thoại PH
                  </label>
                  <input
                    type="tel"
                    value={editParentPhone}
                    onChange={e => setEditParentPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Họ tên phụ huynh
                </label>
                <input
                  type="text"
                  value={editParentName}
                  onChange={e => setEditParentName(e.target.value)}
                  placeholder="Họ tên cha hoặc mẹ"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Địa chỉ thường trú
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={e => setEditAddress(e.target.value)}
                  placeholder="Địa chỉ nhà"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Chức vụ / Ghi chú công khai
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Lớp trưởng, tổ trưởng, học sinh bán trú..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Ghi chú nội bộ GVCN (Học sinh không nhìn thấy)
                </label>
                <textarea
                  rows={2}
                  value={editInternalNotes}
                  onChange={e => setEditInternalNotes(e.target.value)}
                  placeholder="Lưu ý riêng về gia cảnh, tính cách..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-pink-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditStudentOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-5 py-2.5 rounded-xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSavingStudent ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
