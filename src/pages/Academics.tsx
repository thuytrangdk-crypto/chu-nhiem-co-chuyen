import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Subject } from '../types';
import {
  downloadGradebookTemplate,
  parseGradebookExcel,
  exportGradebookExcel,
} from '../utils/excel';
import {
  BookOpen,
  Search,
  Download,
  Upload,
  Settings as SettingsIcon,
  Trash2,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';

const MONTHS_LIST = [
  'Tháng Chín',
  'Tháng Mười',
  'Tháng Mười Một',
  'Tháng Mười Hai',
  'Tháng Một',
  'Tháng Hai',
  'Tháng Ba',
  'Tháng Tư',
  'Tháng Năm',
];

export const Academics: React.FC = () => {
  const { role } = useAuth();
  const {
    classSettings,
    students,
    subjects,
    grades,
    honors,
    state,
    refreshState,
  } = useApp();

  const [selectedMonth, setSelectedMonth] = useState('Tháng Mười');
  const [search, setSearch] = useState('');
  const [isSubjectConfigOpen, setIsSubjectConfigOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  // Local editing grades buffer
  const [localGrades, setLocalGrades] = useState<Record<string, Record<string, number | null>>>(
    grades[selectedMonth] || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync local buffer when month or remote grades change
  React.useEffect(() => {
    setLocalGrades(grades[selectedMonth] || {});
  }, [selectedMonth, grades]);

  // Subject Config local list
  const [subjectList, setSubjectList] = useState<Subject[]>(subjects);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubGraded, setNewSubGraded] = useState(true);

  // Import State
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<
    Record<string, Record<string, number | null>> | null
  >(null);
  const [importingLoading, setImportingLoading] = useState(false);

  const gradedSubjects = subjects.filter(s => s.isGraded);
  const currentMonthHonors = honors.find(
    h => h.month === selectedMonth && h.type === 'academic' && h.isPublished
  );

  // Filter students
  const filteredStudents = students.filter(
    s =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  // Handle score change
  const handleScoreChange = (studentId: string, subjectCode: string, valueStr: string) => {
    const updated = { ...localGrades };
    if (!updated[studentId]) updated[studentId] = {};

    if (valueStr.trim() === '' || valueStr.trim() === '-') {
      updated[studentId][subjectCode] = null;
    } else {
      const cleanVal = valueStr.replace(',', '.');
      const num = parseFloat(cleanVal);
      if (!isNaN(num) && num >= 0 && num <= 10) {
        updated[studentId][subjectCode] = Math.round(num * 100) / 100;
      }
    }
    setLocalGrades(updated);
  };

  // Save current month grades to server
  const handleSaveMonthGrades = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.saveMonthlyGrades(selectedMonth, localGrades);
      await refreshState();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Không thể lưu điểm.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Month Grades with Snapshot
  const handleDeleteMonthGrades = async () => {
    if (
      !window.confirm(
        `Thầy/Cô có chắc chắn muốn xóa toàn bộ bảng điểm của ${selectedMonth}?\nHệ thống sẽ tự động lưu lại một bản sao lưu (Snapshot) để khôi phục khi cần.`
      )
    ) {
      return;
    }

    try {
      const res = await api.deleteMonthlyGrades(selectedMonth);
      await refreshState();
      alert(res.message || 'Đã xóa bảng điểm thành công.');
    } catch (err: any) {
      alert(err.message || 'Không thể xóa bảng điểm.');
    }
  };

  // Restore snapshot
  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!window.confirm('Xác nhận khôi phục bảng điểm từ bản sao lưu này?')) return;
    try {
      const res = await api.restoreGradeSnapshot(snapshotId);
      await refreshState();
      setIsRestoreModalOpen(false);
      alert(res.message || 'Khôi phục thành công.');
    } catch (err: any) {
      alert(err.message || 'Không thể khôi phục bảng điểm.');
    }
  };

  // Handle Import File
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { grades: parsed, errors } = await parseGradebookExcel(file, subjects);
      // Map studentCode -> studentId
      const mapped: Record<string, Record<string, number | null>> = {};
      for (const [sCode, scores] of Object.entries(parsed)) {
        const student = students.find(s => s.code.toLowerCase() === sCode.toLowerCase());
        if (student) {
          mapped[student.id] = scores;
        }
      }
      setImportPreview(mapped);
      setImportErrors(errors);
    } catch (err: any) {
      alert(err.message || 'Không thể đọc file điểm.');
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview) return;
    setImportingLoading(true);
    try {
      const merged = { ...localGrades, ...importPreview };
      await api.saveMonthlyGrades(selectedMonth, merged);
      await refreshState();
      setIsImportModalOpen(false);
      setImportPreview(null);
      alert('Nhập điểm từ file Excel thành công!');
    } catch (err: any) {
      alert(err.message || 'Lỗi nhập điểm.');
    } finally {
      setImportingLoading(false);
    }
  };

  // Save Subjects Configuration
  const handleSaveSubjects = async () => {
    try {
      await api.updateSubjects(subjectList);
      await refreshState();
      setIsSubjectConfigOpen(false);
      alert('Đã cập nhật danh sách môn học thành công.');
    } catch (err: any) {
      alert(err.message || 'Không thể lưu môn học.');
    }
  };

  const handleAddSubject = () => {
    if (!newSubName.trim() || !newSubCode.trim()) {
      alert('Vui lòng nhập tên và mã môn học.');
      return;
    }
    const exists = subjectList.find(
      s => s.code.toLowerCase() === newSubCode.trim().toLowerCase()
    );
    if (exists) {
      alert(`Mã môn ${newSubCode} đã tồn tại.`);
      return;
    }
    setSubjectList([
      ...subjectList,
      {
        id: `sub_${Date.now()}`,
        code: newSubCode.trim().toUpperCase(),
        name: newSubName.trim(),
        isGraded: newSubGraded,
      },
    ]);
    setNewSubName('');
    setNewSubCode('');
  };

  const handleDeleteSubject = (id: string) => {
    setSubjectList(subjectList.filter(s => s.id !== id));
  };

  // Compute month student GPAs
  const calculateGPA = (studentId: string) => {
    const sScores = localGrades[studentId] || {};
    let sum = 0;
    let count = 0;
    gradedSubjects.forEach(sub => {
      const val = sScores[sub.code];
      if (val !== undefined && val !== null) {
        sum += val;
        count++;
      }
    });
    return count > 0 ? (sum / count).toFixed(2) : '-';
  };

  // Next / Prev Month
  const currentMonthIdx = MONTHS_LIST.indexOf(selectedMonth);
  const handlePrevMonth = () => {
    if (currentMonthIdx > 0) setSelectedMonth(MONTHS_LIST[currentMonthIdx - 1]);
  };
  const handleNextMonth = () => {
    if (currentMonthIdx < MONTHS_LIST.length - 1) setSelectedMonth(MONTHS_LIST[currentMonthIdx + 1]);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card matching screenshot 5 */}
      <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black text-gray-900 text-base sm:text-lg tracking-tight uppercase">
                Bảng Điểm Học Tập
              </h2>
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-pink-100 text-pink-700">
                Lớp {classSettings.className}
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-600">
                Năm học {classSettings.academicYear}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              ⓘ ĐTB theo tháng theo dõi nội bộ của GVCN
            </p>
          </div>
        </div>

        {/* Month Selector & Publish Button */}
        <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
          {/* Month pill selector */}
          <div className="flex items-center bg-pink-50/70 border border-pink-200 rounded-2xl p-1">
            <button
              onClick={handlePrevMonth}
              disabled={currentMonthIdx <= 0}
              className="p-1.5 rounded-xl text-gray-600 hover:text-pink-600 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent px-3 py-1 text-xs font-bold text-gray-800 focus:outline-hidden cursor-pointer"
            >
              {MONTHS_LIST.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              onClick={handleNextMonth}
              disabled={currentMonthIdx >= MONTHS_LIST.length - 1}
              className="p-1.5 rounded-xl text-gray-600 hover:text-pink-600 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Honors Publish Status */}
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
              currentMonthHonors
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            {currentMonthHonors ? 'Đã công bố vinh danh' : 'Chưa công bố vinh danh'}
          </span>
        </div>
      </div>

      {/* Action Toolbar matching screenshot 5 */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-pink-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên học sinh, mã hồ sơ..."
            className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-500 bg-pink-50/20"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>

        {/* Buttons matching screenshot 5 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadGradebookTemplate(students, subjects, selectedMonth)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải mẫu Excel</span>
          </button>

          {role === 'teacher' && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nhập Excel điểm tháng</span>
            </button>
          )}

          <button
            onClick={() =>
              exportGradebookExcel(students, subjects, localGrades, selectedMonth, classSettings)
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-pink-200 text-pink-700 bg-pink-50 hover:bg-pink-100 text-xs font-bold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

          {role === 'teacher' && (
            <>
              <button
                onClick={() => {
                  setSubjectList(subjects);
                  setIsSubjectConfigOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-bold transition-colors"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>Cấu hình môn</span>
              </button>

              <button
                onClick={handleDeleteMonthGrades}
                title="Xóa bảng điểm tháng này (có sao lưu tự động)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xóa bảng điểm tháng</span>
              </button>

              <button
                onClick={() => setIsRestoreModalOpen(true)}
                title="Khôi phục điểm từ bản sao lưu"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs font-bold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục điểm</span>
              </button>

              <button
                onClick={handleSaveMonthGrades}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                <span>{isSaving ? 'Đang lưu...' : 'Lưu bảng điểm'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Đã lưu bảng điểm {selectedMonth} thành công!</span>
        </div>
      )}

      {/* Main Gradebook Editable Table matching screenshot 5 */}
      <div className="bg-white rounded-3xl border border-pink-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-pink-50/80 sticky top-0 z-20 shadow-2xs font-bold text-gray-800">
              <tr>
                <th className="py-3 px-3 text-center w-12 border-b border-pink-100">STT</th>
                <th className="py-3 px-3 w-28 border-b border-pink-100">MÃ HỒ SƠ</th>
                <th className="py-3 px-4 min-w-[200px] border-b border-pink-100">HỌ VÀ TÊN</th>
                {gradedSubjects.map(sub => (
                  <th
                    key={sub.id}
                    className="py-3 px-2 text-center w-20 border-b border-pink-100 uppercase"
                  >
                    {sub.name}
                  </th>
                ))}
                <th className="py-3 px-3 text-center w-24 bg-pink-100/90 font-black text-pink-900 border-b border-pink-200">
                  ĐTB THÁNG
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={gradedSubjects.length + 4}
                    className="py-12 text-center text-gray-400 font-medium"
                  >
                    Không có học sinh nào.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const sScores = localGrades[student.id] || {};
                  const gpa = calculateGPA(student.id);

                  return (
                    <tr key={student.id} className="hover:bg-pink-50/30 transition-colors">
                      <td className="py-2 px-3 text-center font-semibold text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-pink-700">
                        {student.code}
                      </td>
                      <td className="py-2 px-4 font-bold text-gray-900 uppercase">
                        {student.fullName}
                      </td>

                      {gradedSubjects.map(sub => {
                        const val = sScores[sub.code];
                        const displayVal = val !== undefined && val !== null ? val : '';

                        return (
                          <td key={sub.id} className="py-1.5 px-1.5 text-center">
                            {role === 'teacher' ? (
                              <input
                                type="text"
                                value={displayVal}
                                onChange={e =>
                                  handleScoreChange(student.id, sub.code, e.target.value)
                                }
                                placeholder="-"
                                className="w-14 text-center py-1.5 px-1 rounded-lg border border-pink-100 hover:border-pink-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-bold text-gray-900 text-xs bg-white"
                              />
                            ) : (
                              <span className="font-bold text-gray-700">
                                {displayVal || '-'}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      <td className="py-2 px-3 text-center font-black text-pink-700 bg-pink-50/30">
                        {gpa}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUBJECT CONFIGURATION MODAL */}
      {isSubjectConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 border border-pink-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-pink-50 mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Cấu hình danh mục môn học</h3>
              <button
                onClick={() => setIsSubjectConfigOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Add new subject inline */}
              <div className="p-3.5 rounded-2xl bg-pink-50/50 border border-pink-100 space-y-2.5">
                <span className="text-xs font-bold text-pink-900 uppercase">Thêm môn học mới</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    placeholder="Tên môn (Toán)"
                    className="col-span-2 px-3 py-1.5 rounded-xl border border-gray-300 text-xs"
                  />
                  <input
                    type="text"
                    value={newSubCode}
                    onChange={e => setNewSubCode(e.target.value)}
                    placeholder="Mã (TOAN)"
                    className="px-3 py-1.5 rounded-xl border border-gray-300 text-xs uppercase font-mono"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={newSubGraded}
                      onChange={e => setNewSubGraded(e.target.checked)}
                      className="rounded text-pink-600"
                    />
                    <span>Tính điểm (0-10, đưa vào ĐTB)</span>
                  </label>
                  <button
                    onClick={handleAddSubject}
                    className="px-3 py-1.5 rounded-xl bg-pink-600 text-white text-xs font-bold hover:bg-pink-700"
                  >
                    + Thêm môn
                  </button>
                </div>
              </div>

              {/* Existing Subjects list */}
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto border border-gray-200 rounded-2xl">
                {subjectList.map(s => (
                  <div key={s.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-pink-700 w-12">{s.code}</span>
                      <span className="font-bold text-gray-800">{s.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.isGraded
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {s.isGraded ? 'Tính điểm số' : 'Đánh giá nhận xét'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteSubject(s.id)}
                      className="text-gray-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsSubjectConfigOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveSubjects}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#e25d7c] hover:bg-[#d44b6b] rounded-xl shadow-xs transition-colors"
                >
                  Lưu cấu hình
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT GRADEBOOK MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-xl p-6 border border-pink-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-pink-50 mb-4">
              <h3 className="font-bold text-gray-900 text-lg">
                Nhập bảng điểm Excel - {selectedMonth}
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Chọn tệp Excel bảng điểm
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportFile}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-pink-600 file:text-white hover:file:bg-pink-700 cursor-pointer"
                />
              </div>

              {importErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs space-y-1">
                  <span className="font-bold">Lỗi phát hiện khi đọc điểm:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {importErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs">
                  ✓ Đã nhận diện thành công điểm của {Object.keys(importPreview).length} học sinh sẵn sàng nhập!
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!importPreview || importingLoading}
                  onClick={handleExecuteImport}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#e25d7c] hover:bg-[#d44b6b] rounded-xl shadow-xs disabled:opacity-50 transition-colors"
                >
                  {importingLoading ? 'Đang lưu...' : 'Tiến hành nạp điểm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE SNAPSHOT MODAL */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 border border-pink-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-pink-50 mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Khôi phục bảng điểm từ bản sao lưu</h3>
              <button
                onClick={() => setIsRestoreModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {(state?.gradeSnapshots?.length || 0) === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Chưa có bản sao lưu nào được tạo. Khi thầy/cô bấm "Xóa bảng điểm tháng", hệ thống sẽ tự động tạo bản lưu tại đây.
                </div>
              ) : (
                state?.gradeSnapshots?.map(snap => (
                  <div
                    key={snap.id}
                    className="p-3.5 rounded-2xl border border-pink-100 hover:bg-pink-50/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-gray-800 uppercase">{snap.month}</p>
                      <p className="text-[11px] text-gray-400">
                        Sao lưu lúc: {new Date(snap.deletedAt).toLocaleString('vi-VN')} •{' '}
                        {snap.studentCount} học sinh
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestoreSnapshot(snap.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white text-xs font-bold shadow-2xs transition-colors"
                    >
                      Khôi phục
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
