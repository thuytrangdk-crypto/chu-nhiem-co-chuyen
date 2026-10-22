import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  CalendarCheck,
  CheckCircle2,
  Calendar,
  Save,
  CheckCheck,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const Attendance: React.FC = () => {
  const { role } = useAuth();
  const { students, attendance, classSettings, refreshState } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [localRecords, setLocalRecords] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync local attendance records when date or remote data changes
  useEffect(() => {
    setLocalRecords(attendance[selectedDate] || {});
  }, [selectedDate, attendance]);

  // Handle single student status selection
  const handleSetStatus = (studentId: string, status: string) => {
    setLocalRecords(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  // Set all students to present
  const handleMarkAllPresent = () => {
    const allPresent: Record<string, string> = {};
    students.forEach(s => {
      allPresent[s.id] = 'present';
    });
    setLocalRecords(allPresent);
  };

  // Save attendance to backend
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.saveAttendance(selectedDate, localRecords);
      await refreshState();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Không thể lưu điểm danh.');
    } finally {
      setIsSaving(false);
    }
  };

  // Summary counts
  let countPresent = 0;
  let countExcused = 0;
  let countUnexcused = 0;
  let countLate = 0;

  students.forEach(s => {
    const st = localRecords[s.id];
    if (st === 'present') countPresent++;
    else if (st === 'excused') countExcused++;
    else if (st === 'unexcused') countUnexcused++;
    else if (st === 'late') countLate++;
  });

  // Export monthly attendance report
  const handleExportAttendanceReport = () => {
    const dates = Object.keys(attendance).sort();
    const rows: any[][] = [
      [`TRƯỜNG: ${classSettings.schoolName || '---'}`],
      [`LỚP: ${classSettings.className} - NĂM HỌC: ${classSettings.academicYear}`],
      [`BÁO CÁO ĐIỂM DANH CHUYÊN CẦN`],
      [],
      ['STT', 'Mã hồ sơ', 'Họ và tên', ...dates, 'Tổng vắng', 'Tổng muộn'],
    ];

    students.forEach((s, idx) => {
      let vCount = 0;
      let mCount = 0;
      const dateCells = dates.map(d => {
        const val = attendance[d]?.[s.id];
        if (val === 'present') return 'x';
        if (val === 'excused') {
          vCount++;
          return 'P';
        }
        if (val === 'unexcused') {
          vCount++;
          return 'K';
        }
        if (val === 'late') {
          mCount++;
          return 'M';
        }
        return '-';
      });

      rows.push([idx + 1, s.code, s.fullName, ...dateCells, vCount, mCount]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chuyen_Can');
    XLSX.writeFile(wb, `Diem_Danh_Lop_${classSettings.className}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar Card matching screenshot 6 */}
      <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Date Selector & Counter Pills */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="pl-9 pr-3.5 py-2 rounded-2xl border-2 border-pink-200 text-xs sm:text-sm font-bold text-gray-800 bg-white focus:outline-hidden focus:border-pink-600 focus:ring-2 focus:ring-pink-100 shadow-2xs"
            />
            <Calendar className="w-4 h-4 text-pink-600 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          <span className="hidden sm:inline text-xs text-gray-400">
            Chọn ngày cần kiểm tra hoặc điểm danh
          </span>

          {/* Counter pills matching screenshot 6 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Có mặt: {countPresent}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Có phép: {countExcused}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              Kh.phép: {countUnexcused}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Muộn: {countLate}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          <button
            onClick={handleExportAttendanceReport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-pink-200 text-pink-700 bg-pink-50 hover:bg-pink-100 text-xs font-bold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất báo cáo</span>
          </button>

          {role === 'teacher' && (
            <>
              <button
                onClick={handleMarkAllPresent}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold transition-colors shadow-2xs"
              >
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                <span>Tất cả có mặt</span>
              </button>

              <button
                onClick={handleSaveAttendance}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu điểm danh'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Đã lưu điểm danh ngày {selectedDate} thành công!</span>
        </div>
      )}

      {/* Grid of Student Attendance Cards matching screenshot 6 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {students.length === 0 ? (
          <div className="col-span-full bg-white rounded-3xl p-12 text-center border border-pink-100 text-gray-400">
            Chưa có học sinh nào trong lớp.
          </div>
        ) : (
          students.map(student => {
            const currentStatus = localRecords[student.id];

            return (
              <div
                key={student.id}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-pink-100/90 shadow-2xs hover:border-pink-200 transition-all flex flex-col justify-between"
              >
                {/* Header: Initial Box, Name, ID */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 font-black text-lg flex items-center justify-center shrink-0 shadow-inner">
                    {student.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-extrabold text-gray-900 text-xs sm:text-sm uppercase truncate">
                      {student.fullName}
                    </h4>
                    <span className="text-[11px] text-gray-400 font-mono">
                      ID: {student.code}
                    </span>
                  </div>
                </div>

                {/* 4 Status Segmented Buttons matching screenshot 6 */}
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-pink-50">
                  {/* Có mặt */}
                  <button
                    disabled={role !== 'teacher'}
                    onClick={() => handleSetStatus(student.id, 'present')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                      currentStatus === 'present'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <span>✓</span>
                    <span>Có mặt</span>
                  </button>

                  {/* Có phép */}
                  <button
                    disabled={role !== 'teacher'}
                    onClick={() => handleSetStatus(student.id, 'excused')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                      currentStatus === 'excused'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    <span>✉</span>
                    <span>Có phép</span>
                  </button>

                  {/* Không phép */}
                  <button
                    disabled={role !== 'teacher'}
                    onClick={() => handleSetStatus(student.id, 'unexcused')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                      currentStatus === 'unexcused'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-600 hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    <span>✕</span>
                    <span>Kh.phép</span>
                  </button>

                  {/* Muộn */}
                  <button
                    disabled={role !== 'teacher'}
                    onClick={() => handleSetStatus(student.id, 'late')}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                      currentStatus === 'late'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    <span>⏰</span>
                    <span>Muộn</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
