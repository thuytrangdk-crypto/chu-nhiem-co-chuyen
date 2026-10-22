import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Student } from '../types';
import {
  exportStudentList,
  exportClassEmulationExcel,
  downloadStudentTemplate,
  parseStudentExcel,
} from '../utils/excel';
import {
  Search,
  LayoutGrid,
  List,
  FileSpreadsheet,
  Download,
  Upload,
  UserPlus,
  AlertTriangle,
  Calendar,
  Phone,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  KeyRound,
} from 'lucide-react';

export const Students: React.FC = () => {
  const { role } = useAuth();
  const {
    students,
    classSettings,
    attendance,
    incidents,
    emulationSettings,
    openStudentProfile,
    refreshState,
  } = useApp();

  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Nam' | 'Nữ'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [birthdate, setBirthdate] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Import Excel Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingFile, setImportingFile] = useState<File | null>(null);
  const [previewStudents, setPreviewStudents] = useState<Array<Partial<Student>>>([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  // Filter students
  const filteredStudents = students.filter(s => {
    const matchSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase());
    const matchGender = genderFilter === 'all' || s.gender === genderFilter;
    return matchSearch && matchGender;
  });

  // Today attendance map
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = attendance[today] || {};

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setCode('');
    setFullName('');
    setGender('Nam');
    setBirthdate('');
    setParentName('');
    setParentPhone('');
    setAddress('');
    setNotes('');
    setInternalNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStudent(student);
    setCode(student.code);
    setFullName(student.fullName);
    setGender(student.gender);
    setBirthdate(student.birthdate);
    setParentName(student.parentName || '');
    setParentPhone(student.parentPhone || '');
    setAddress(student.address || '');
    setNotes(student.notes || '');
    setInternalNotes(student.internalNotes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim() || !fullName.trim() || !birthdate.trim()) {
      setFormError('Vui lòng điền đủ Mã hồ sơ, Họ và tên và Ngày sinh.');
      return;
    }

    try {
      if (editingStudent) {
        await api.updateStudent(editingStudent.id, {
          code,
          fullName,
          gender,
          birthdate,
          parentName,
          parentPhone,
          address,
          notes,
          internalNotes,
        });
      } else {
        await api.createStudent({
          code,
          fullName,
          gender,
          birthdate,
          parentName,
          parentPhone,
          address,
          notes,
          internalNotes,
        });
      }
      setIsModalOpen(false);
      await refreshState();
    } catch (err: any) {
      setFormError(err.message || 'Không thể lưu học sinh.');
    }
  };

  const handleDeleteStudent = async (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Xác nhận xóa học sinh "${student.fullName}" (Mã: ${student.code})?\nMọi dữ liệu điểm danh, điểm số và thi đua của học sinh này sẽ bị xóa khỏi lớp.`
      )
    ) {
      return;
    }
    try {
      await api.deleteStudent(student.id);
      await refreshState();
    } catch (err: any) {
      alert(err.message || 'Không thể xóa học sinh.');
    }
  };

  // Excel Import Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingFile(file);
    try {
      const parsed = await parseStudentExcel(file);
      setPreviewStudents(parsed);
      setImportErrors([]);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi đọc file Excel.');
    }
  };

  const handleExecuteImport = async () => {
    if (previewStudents.length === 0) return;
    setImportLoading(true);
    try {
      const res = await api.batchImportStudents(previewStudents, updateExisting);
      await refreshState();
      alert(
        `Nhập Excel thành công!\n- Thêm mới: ${res.addedCount} học sinh\n- Cập nhật: ${res.updatedCount} học sinh${
          res.errors?.length ? `\n- Bỏ qua: ${res.errors.length} dòng lỗi` : ''
        }`
      );
      setIsImportModalOpen(false);
      setPreviewStudents([]);
      setImportingFile(null);
    } catch (err: any) {
      alert(err.message || 'Nhập danh sách học sinh thất bại.');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar matching screenshot 4 */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-pink-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search & Gender filter */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
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

          <select
            value={genderFilter}
            onChange={e => setGenderFilter(e.target.value as any)}
            className="px-3 py-2 rounded-2xl border border-gray-200 text-xs sm:text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-pink-500 font-medium"
          >
            <option value="all">Tất cả giới tính</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex bg-pink-50 p-1 rounded-2xl border border-pink-100">
            <button
              onClick={() => setViewMode('cards')}
              title="Dạng thẻ"
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === 'cards' ? 'bg-white text-pink-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Dạng bảng"
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === 'table' ? 'bg-white text-pink-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportStudentList(students, classSettings)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={() =>
              exportClassEmulationExcel(
                students,
                incidents,
                classSettings,
                emulationSettings,
                'Toàn năm'
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 text-xs font-bold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Excel thi đua</span>
          </button>

          {role === 'teacher' && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-pink-200 text-pink-700 bg-pink-50 hover:bg-pink-100 text-xs font-bold transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Nhập Excel</span>
              </button>

              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white text-xs font-bold shadow-xs transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Thêm HS</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredStudents.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-pink-100 text-gray-400">
          <p className="text-base font-semibold">Không tìm thấy học sinh nào.</p>
          <p className="text-xs mt-1">
            {students.length === 0
              ? 'Lớp chưa có học sinh. Thầy/Cô hãy thêm học sinh hoặc nhập từ file Excel!'
              : 'Hãy thử tìm kiếm với từ khóa hoặc bộ lọc khác.'}
          </p>
        </div>
      )}

      {/* DẠNG THẺ (CARDS VIEW - DEFAULT MATCHING SCREENSHOT 4) */}
      {viewMode === 'cards' && filteredStudents.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredStudents.map(student => {
            // Check attention
            const vCount = incidents.filter(
              i => i.studentId === student.id && (i.points < 0 || i.type === 'violation')
            ).length;
            let absCount = 0;
            Object.values(attendance).forEach(d => {
              if (d[student.id] === 'excused' || d[student.id] === 'unexcused' || d[student.id] === 'late') {
                absCount++;
              }
            });
            const hasWarning =
              vCount >= (classSettings.attentionThresholdViolations || 2) ||
              absCount >= (classSettings.attentionThresholdAbsences || 2);

            const todayStatus = todayRecords[student.id];

            return (
              <div
                key={student.id}
                onClick={() => openStudentProfile(student.id)}
                className="bg-white rounded-2xl p-4 border border-pink-100/80 shadow-2xs hover:shadow-md hover:border-pink-300 transition-all cursor-pointer flex flex-col items-center text-center relative group"
              >
                {/* Warning Badge at top-right */}
                {hasWarning && (
                  <div
                    title="Học sinh cần chú ý (nhiều vi phạm hoặc nghỉ học)"
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs"
                  >
                    <AlertTriangle className="w-3 h-3" />
                  </div>
                )}

                {/* Initial Avatar Box matching screenshot 4 */}
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 font-black text-xl flex items-center justify-center mb-3 shadow-inner group-hover:scale-105 transition-transform">
                  {student.fullName.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <h4 className="font-black text-gray-900 text-xs sm:text-sm line-clamp-2 uppercase min-h-[36px] flex items-center">
                  {student.fullName}
                </h4>

                {/* Gender & DOB */}
                <p className="text-[11px] text-gray-500 font-medium mt-1">
                  <span className={student.gender === 'Nữ' ? 'text-pink-600 font-semibold' : 'text-blue-600 font-semibold'}>
                    {student.gender}
                  </span>{' '}
                  • {student.birthdate}
                </p>

                {/* Student Code Badge */}
                <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                  ID: {student.code}
                </span>

                {/* Today Attendance Status Pill */}
                <div className="mt-3 w-full pt-2 border-t border-pink-50 flex items-center justify-center">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      todayStatus === 'present'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : todayStatus === 'excused'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : todayStatus === 'unexcused'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : todayStatus === 'late'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {todayStatus === 'present'
                      ? 'Có mặt'
                      : todayStatus === 'excused'
                      ? 'Vắng có phép'
                      : todayStatus === 'unexcused'
                      ? 'Vắng K.phép'
                      : todayStatus === 'late'
                      ? 'Đi muộn'
                      : 'Chưa điểm danh'}
                  </span>
                </div>

                {/* Quick actions for teacher on hover */}
                {role === 'teacher' && (
                  <div className="absolute inset-x-2 bottom-2 bg-white/95 backdrop-blur-xs rounded-xl p-1 hidden group-hover:flex items-center justify-center gap-2 border border-pink-100 shadow-xs">
                    <button
                      onClick={e => handleOpenEdit(student, e)}
                      title="Sửa thông tin"
                      className="p-1 text-gray-500 hover:text-pink-600"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => handleDeleteStudent(student, e)}
                      title="Xóa học sinh"
                      className="p-1 text-gray-500 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DẠNG BẢNG (TABLE VIEW) */}
      {viewMode === 'table' && filteredStudents.length > 0 && (
        <div className="bg-white rounded-3xl border border-pink-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-pink-50/70 border-b border-pink-100 text-gray-700 font-bold">
                  <th className="py-3 px-3 text-center w-12">STT</th>
                  <th className="py-3 px-3">Mã hồ sơ</th>
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-3">Giới tính</th>
                  <th className="py-3 px-3">Ngày sinh</th>
                  <th className="py-3 px-4">Phụ huynh & SĐT</th>
                  <th className="py-3 px-3 text-center">Điểm danh hôm nay</th>
                  {role === 'teacher' && <th className="py-3 px-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-50">
                {filteredStudents.map((s, idx) => {
                  const todayStatus = todayRecords[s.id];
                  return (
                    <tr
                      key={s.id}
                      onClick={() => openStudentProfile(s.id)}
                      className="hover:bg-pink-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 text-center font-medium text-gray-500">{idx + 1}</td>
                      <td className="py-3 px-3 font-mono font-bold text-pink-700">{s.code}</td>
                      <td className="py-3 px-4 font-bold text-gray-900 uppercase">{s.fullName}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold ${
                            s.gender === 'Nữ' ? 'text-pink-600' : 'text-blue-600'
                          }`}
                        >
                          {s.gender}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-600 font-medium">{s.birthdate}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {s.parentName || s.parentPhone ? (
                          <div className="text-xs">
                            <span className="font-semibold text-gray-800">{s.parentName}</span>
                            {s.parentPhone && (
                              <span className="text-gray-500 ml-1">({s.parentPhone})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Chưa có</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            todayStatus === 'present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : todayStatus === 'excused'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : todayStatus === 'unexcused'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : todayStatus === 'late'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {todayStatus === 'present'
                            ? 'Có mặt'
                            : todayStatus === 'excused'
                            ? 'Vắng có phép'
                            : todayStatus === 'unexcused'
                            ? 'Vắng K.phép'
                            : todayStatus === 'late'
                            ? 'Đi muộn'
                            : 'Chưa ĐD'}
                        </span>
                      </td>
                      {role === 'teacher' && (
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={e => handleOpenEdit(s, e)}
                              className="p-1 text-gray-400 hover:text-pink-600"
                              title="Sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={e => handleDeleteStudent(s, e)}
                              className="p-1 text-gray-400 hover:text-rose-600"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT STUDENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 border border-pink-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-pink-50 mb-4">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingStudent ? 'Sửa thông tin học sinh' : 'Thêm học sinh mới'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Mã hồ sơ *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Ví dụ: 02102013 hoặc HS001"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Giữ nguyên số 0 ở đầu</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Giới tính *
                  </label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-pink-500 font-medium"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Ví dụ: NGUYỄN VĂN AN"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-bold uppercase focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Ngày sinh (dd/mm/yyyy) *
                </label>
                <input
                  type="text"
                  required
                  value={birthdate}
                  onChange={e => setBirthdate(e.target.value)}
                  placeholder="Ví dụ: 02/10/2013"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Họ tên phụ huynh
                  </label>
                  <input
                    type="text"
                    value={parentName}
                    onChange={e => setParentName(e.target.value)}
                    placeholder="Tên cha / mẹ"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    SĐT Phụ huynh
                  </label>
                  <input
                    type="text"
                    value={parentPhone}
                    onChange={e => setParentPhone(e.target.value)}
                    placeholder="Số điện thoại"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Địa chỉ thường trú
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Số nhà, đường, phường, quận..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Ghi chú chung
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Năng khiếu, sức khỏe..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-700 uppercase mb-1">
                  Ghi chú nội bộ (Chỉ GVCN xem)
                </label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  placeholder="Ghi chú hoàn cảnh gia đình hoặc lưu ý riêng biệt..."
                  className="w-full px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50/20 text-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#e25d7c] hover:bg-[#d44b6b] rounded-xl shadow-xs transition-colors"
                >
                  {editingStudent ? 'Cập nhật' : 'Thêm vào lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl p-6 border border-pink-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-pink-50 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-pink-600" />
                <h3 className="font-bold text-gray-900 text-lg">Nhập danh sách học sinh từ Excel</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-pink-50/60 border border-pink-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-gray-700">
                  <p className="font-bold">Chưa có tệp Excel đúng mẫu?</p>
                  <p className="text-gray-500 mt-0.5">
                    Tải mẫu Excel chuẩn có sẵn các cột mã hồ sơ, họ tên, ngày sinh, phụ huynh...
                  </p>
                </div>
                <button
                  onClick={downloadStudentTemplate}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-pink-300 text-pink-700 text-xs font-bold hover:bg-pink-100 transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải mẫu Excel</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Chọn tệp Excel (.xlsx, .xls)
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileSelect}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-pink-600 file:text-white hover:file:bg-pink-700 cursor-pointer"
                />
              </div>

              {previewStudents.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">
                      Xem trước ({previewStudents.length} học sinh sẵn sàng nhập):
                    </span>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={e => setUpdateExisting(e.target.checked)}
                        className="rounded-sm text-pink-600"
                      />
                      <span>Cập nhật nếu trùng mã</span>
                    </label>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-pink-100 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-pink-50 sticky top-0 font-bold text-gray-700">
                        <tr>
                          <th className="p-2">STT</th>
                          <th className="p-2">Mã</th>
                          <th className="p-2">Họ và tên</th>
                          <th className="p-2">Phái</th>
                          <th className="p-2">Ngày sinh</th>
                          <th className="p-2">SĐT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pink-50">
                        {previewStudents.slice(0, 20).map((p, idx) => (
                          <tr key={idx} className="hover:bg-pink-50/20">
                            <td className="p-2 text-gray-400">{idx + 1}</td>
                            <td className="p-2 font-mono font-bold text-pink-700">{p.code}</td>
                            <td className="p-2 font-bold uppercase">{p.fullName}</td>
                            <td className="p-2">{p.gender}</td>
                            <td className="p-2">{p.birthdate}</td>
                            <td className="p-2 text-gray-500">{p.parentPhone || '---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewStudents.length > 20 && (
                    <p className="text-[11px] text-gray-400 mt-1 italic">
                      ... và {previewStudents.length - 20} học sinh khác nữa
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={previewStudents.length === 0 || importLoading}
                  onClick={handleExecuteImport}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#e25d7c] hover:bg-[#d44b6b] rounded-xl shadow-xs disabled:opacity-50 transition-colors"
                >
                  {importLoading ? 'Đang nhập dữ liệu...' : `Tiến hành nhập (${previewStudents.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
