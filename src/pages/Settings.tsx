import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { EmulationRule } from '../types';
import {
  SlidersHorizontal,
  Scale,
  BookOpen,
  Database,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Cloud,
  Download,
  Upload,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  Copy,
  Info,
  RefreshCw,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { role, setOpenPasswordModal } = useAuth();
  const {
    classSettings,
    emulationRules,
    emulationSettings,
    subjects,
    supabaseStatus,
    refreshState,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'general' | 'emulation' | 'subjects' | 'system'>('general');

  // General Settings state
  const [appName, setAppName] = useState(classSettings.appName || 'Trợ lý chủ nhiệm');
  const [schoolName, setSchoolName] = useState(classSettings.schoolName || '');
  const [className, setClassName] = useState(classSettings.className || '');
  const [homeroomTeacher, setHomeroomTeacher] = useState(classSettings.homeroomTeacher || '');
  const [academicYear, setAcademicYear] = useState(classSettings.academicYear || '2026-2027');
  const [logoUrl, setLogoUrl] = useState(classSettings.logoUrl || '');
  const [vThreshold, setVThreshold] = useState(classSettings.attentionThresholdViolations || 2);
  const [aThreshold, setAThreshold] = useState(classSettings.attentionThresholdAbsences || 2);

  // Emulation Settings state
  const [rules, setRules] = useState<EmulationRule[]>(emulationRules);
  const [startingScore, setStartingScore] = useState(emulationSettings.startingScore || 200);
  const [thresholdGood, setThresholdGood] = useState(emulationSettings.thresholdGood || 180);
  const [thresholdFair, setThresholdFair] = useState(emulationSettings.thresholdFair || 150);
  const [thresholdPass, setThresholdPass] = useState(emulationSettings.thresholdPass || 120);

  // New Rule state
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'violation' | 'award'>('violation');
  const [newRulePoints, setNewRulePoints] = useState(-2);

  // Edit Existing Rule state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleName, setEditingRuleName] = useState('');
  const [editingRuleType, setEditingRuleType] = useState<'violation' | 'award'>('violation');
  const [editingRulePoints, setEditingRulePoints] = useState<number>(-2);

  // Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseEnabled, setSupabaseEnabled] = useState(supabaseStatus.enabled);
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabaseTestMsg, setSupabaseTestMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Clean Class Confirmation state
  const [cleanConfirmText, setCleanConfirmText] = useState('');
  const [cleanLoading, setCleanLoading] = useState(false);

  // Notification state
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Save General Settings
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await api.updateGeneralSettings({
        appName,
        schoolName,
        className,
        homeroomTeacher,
        academicYear,
        logoUrl,
        attentionThresholdViolations: vThreshold,
        attentionThresholdAbsences: aThreshold,
      });
      await refreshState();
      setStatusMsg({ type: 'ok', text: 'Đã lưu thông tin cài đặt chung thành công!' });
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err.message || 'Lỗi lưu cài đặt.' });
    }
  };

  // Save Emulation Rules & Settings
  const handleSaveEmulation = async () => {
    setStatusMsg(null);
    if (thresholdGood <= thresholdFair || thresholdFair <= thresholdPass) {
      setStatusMsg({
        type: 'err',
        text: 'Ngưỡng xếp loại không hợp lệ: Yêu cầu ngưỡng Tốt > Khá > Đạt.',
      });
      return;
    }

    try {
      await api.updateEmulationSettings({
        rules,
        settings: {
          startingScore,
          thresholdGood,
          thresholdFair,
          thresholdPass,
        },
      });
      await refreshState();
      setStatusMsg({ type: 'ok', text: 'Đã lưu quy tắc và thang điểm thi đua thành công!' });
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err.message || 'Lỗi lưu quy tắc thi đua.' });
    }
  };

  const handleAddRule = async () => {
    if (!newRuleName.trim()) return;
    const finalPoints =
      newRuleType === 'violation' ? -Math.abs(Number(newRulePoints) || 1) : Math.abs(Number(newRulePoints) || 1);
    const newRule: EmulationRule = {
      id: `rule_${Date.now()}`,
      name: newRuleName.trim(),
      type: newRuleType,
      points: finalPoints,
      active: true,
    };
    const updated = [newRule, ...rules];
    setRules(updated);
    setNewRuleName('');
    try {
      await api.updateEmulationSettings({
        rules: updated,
        settings: {
          startingScore,
          thresholdGood,
          thresholdFair,
          thresholdPass,
        },
      });
      await refreshState();
      setStatusMsg({ type: 'ok', text: 'Đã thêm và lưu tiêu chí mới thành công!' });
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (err: any) {
      console.warn('Auto-save rule failed:', err);
    }
  };

  const handleStartEditRule = (rule: EmulationRule) => {
    setEditingRuleId(rule.id);
    setEditingRuleName(rule.name);
    setEditingRuleType(rule.type);
    setEditingRulePoints(rule.points);
  };

  const handleCancelEditRule = () => {
    setEditingRuleId(null);
    setEditingRuleName('');
  };

  const handleSaveEditRule = async (id: string) => {
    if (!editingRuleName.trim()) return;
    const finalPoints =
      editingRuleType === 'violation'
        ? -Math.abs(Number(editingRulePoints) || 1)
        : Math.abs(Number(editingRulePoints) || 1);

    const updated = rules.map(r =>
      r.id === id
        ? {
            ...r,
            name: editingRuleName.trim(),
            type: editingRuleType,
            points: finalPoints,
          }
        : r
    );
    setRules(updated);
    setEditingRuleId(null);

    try {
      await api.updateEmulationSettings({
        rules: updated,
        settings: {
          startingScore,
          thresholdGood,
          thresholdFair,
          thresholdPass,
        },
      });
      await refreshState();
      setStatusMsg({ type: 'ok', text: 'Đã lưu chỉnh sửa tiêu chí thành công!' });
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err.message || 'Lỗi lưu tiêu chí.' });
    }
  };

  const handleDeleteRule = async (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    if (editingRuleId === id) setEditingRuleId(null);
    try {
      await api.updateEmulationSettings({
        rules: updated,
        settings: {
          startingScore,
          thresholdGood,
          thresholdFair,
          thresholdPass,
        },
      });
      await refreshState();
      setStatusMsg({ type: 'ok', text: 'Đã xóa tiêu chí thành công!' });
      setTimeout(() => setStatusMsg(null), 2000);
    } catch (err: any) {
      console.warn('Auto-save delete failed:', err);
    }
  };

  const handleToggleRuleActive = async (id: string) => {
    const updated = rules.map(r => (r.id === id ? { ...r, active: !r.active } : r));
    setRules(updated);
    try {
      await api.updateEmulationSettings({
        rules: updated,
        settings: {
          startingScore,
          thresholdGood,
          thresholdFair,
          thresholdPass,
        },
      });
      await refreshState();
    } catch (err: any) {}
  };

  // Test Supabase
  const handleTestSupabase = async () => {
    setSupabaseTesting(true);
    setSupabaseTestMsg(null);
    try {
      const res = await api.testSupabase(supabaseUrl, supabaseKey);
      setSupabaseTestMsg({ type: 'ok', text: res.message || 'Kết nối thành công!' });
    } catch (err: any) {
      setSupabaseTestMsg({ type: 'err', text: err.message || 'Lỗi kết nối Supabase.' });
    } finally {
      setSupabaseTesting(false);
    }
  };

  const handleSaveSupabase = async () => {
    if (!supabaseUrl) {
      alert('Vui lòng nhập Supabase Project URL.');
      return;
    }
    try {
      await api.saveSupabaseConfig(supabaseUrl, supabaseKey, true);
      setSupabaseEnabled(true);
      await refreshState();
      setSupabaseTestMsg({
        type: 'ok',
        text: 'Đã lưu và kích hoạt kết nối Supabase thành công! Đèn trạng thái đã chuyển sang màu xanh.',
      });
    } catch (err: any) {
      alert(err.message || 'Lỗi lưu Supabase.');
    }
  };

  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const handleSyncCloud = async () => {
    setIsCloudSyncing(true);
    setSupabaseTestMsg(null);
    try {
      const res = await api.syncCloud();
      await refreshState();
      setSupabaseTestMsg({
        type: 'ok',
        text: res.message || 'Đồng bộ toàn bộ lớp học lên đám mây Supabase thành công!',
      });
    } catch (err: any) {
      setSupabaseTestMsg({
        type: 'err',
        text: err.message || 'Không thể đồng bộ lên Supabase.',
      });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handlePullCloud = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn tải lại toàn bộ dữ liệu từ Supabase đám mây về máy chủ?')) {
      return;
    }
    setIsCloudSyncing(true);
    setSupabaseTestMsg(null);
    try {
      const res = await api.pullCloud();
      await refreshState();
      setSupabaseTestMsg({
        type: 'ok',
        text: res.message || 'Tải dữ liệu từ đám mây Supabase thành công!',
      });
    } catch (err: any) {
      setSupabaseTestMsg({
        type: 'err',
        text: err.message || 'Không thể tải dữ liệu từ Supabase.',
      });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Safe Clean Class
  const handleCleanClass = async () => {
    const requiredPhrase = `XÓA LỚP ${classSettings.className}`;
    if (cleanConfirmText !== requiredPhrase) {
      alert(`Vui lòng nhập chính xác cụm từ: "${requiredPhrase}" để xác nhận.`);
      return;
    }

    if (
      !window.confirm(
        'CẢNH BÁO: Thao tác này sẽ xóa toàn bộ danh sách học sinh, điểm danh, điểm số và thi đua.\nMột bản sao lưu an toàn tự động sẽ được tạo trước khi xóa. Bạn có chắc chắn muốn tiếp tục?'
      )
    ) {
      return;
    }

    setCleanLoading(true);
    try {
      const res = await api.cleanClass(cleanConfirmText);
      await refreshState();
      alert(res.message || 'Đã làm sạch dữ liệu lớp.');
      setCleanConfirmText('');
    } catch (err: any) {
      alert(err.message || 'Không thể làm sạch dữ liệu lớp.');
    } finally {
      setCleanLoading(false);
    }
  };

  // Backup & Restore
  const handleDownloadBackup = () => {
    window.location.href = '/api/system/backup';
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!json.classSettings) {
          alert('Tệp sao lưu không hợp lệ.');
          return;
        }
        if (
          !window.confirm(
            `Xác nhận khôi phục dữ liệu từ bản sao lưu này?\nLớp trong file: ${json.classSettings.className} - Năm học: ${json.classSettings.academicYear}`
          )
        ) {
          return;
        }
        const res = await api.restoreBackup(json);
        await refreshState();
        alert(res.message || 'Khôi phục hoàn tất!');
      } catch (err: any) {
        alert(err.message || 'Lỗi khi khôi phục bản sao lưu.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Settings Top Container matching screenshot 7 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Sub-Tabs Left Navigation */}
        <div className="md:col-span-4 lg:col-span-3 bg-white rounded-3xl p-3 border border-pink-100 shadow-xs space-y-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'general'
                ? 'bg-pink-100 text-pink-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Cài đặt chung</span>
          </button>
          <button
            onClick={() => setActiveTab('emulation')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'emulation'
                ? 'bg-pink-100 text-pink-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/50'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Quy tắc thi đua</span>
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'system'
                ? 'bg-pink-100 text-pink-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/50'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Dữ liệu & Supabase</span>
          </button>
        </div>

        {/* Sub-Tab Content Area */}
        <div className="md:col-span-8 lg:col-span-9 bg-white rounded-3xl p-6 sm:p-8 border border-pink-100 shadow-xs">
          {statusMsg && (
            <div
              className={`mb-6 p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2 ${
                statusMsg.type === 'ok'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {statusMsg.type === 'ok' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* 1. CÀI ĐẶT CHUNG (Matching Screenshot 7) */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-pink-50">
                <h3 className="font-black text-gray-900 text-lg uppercase">
                  Thông tin chung của Lớp & Sổ chủ nhiệm
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Thông tin này sẽ được đồng bộ đồng nhất lên toàn bộ giao diện, phiếu liên lạc và báo cáo Excel
                </p>
              </div>

              <form onSubmit={handleSaveGeneral} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      Tên ứng dụng
                    </label>
                    <input
                      type="text"
                      required
                      value={appName}
                      onChange={e => setAppName(e.target.value)}
                      placeholder="Trợ lý chủ nhiệm"
                      className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      Tên lớp *
                    </label>
                    <input
                      type="text"
                      required
                      value={className}
                      onChange={e => setClassName(e.target.value)}
                      placeholder="Ví dụ: 8A3 hoặc 9A14"
                      className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 text-xs sm:text-sm font-bold text-pink-700 focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      Năm học *
                    </label>
                    <input
                      type="text"
                      required
                      value={academicYear}
                      onChange={e => setAcademicYear(e.target.value)}
                      placeholder="2026-2027"
                      className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      Giáo viên chủ nhiệm *
                    </label>
                    <input
                      type="text"
                      required
                      value={homeroomTeacher}
                      onChange={e => setHomeroomTeacher(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Thị Thùy Trang"
                      className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 text-xs sm:text-sm font-bold text-gray-900 focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                    Tên trường học
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    placeholder="Ví dụ: Trường THCS Đồng Khởi"
                    className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                {/* Secure Password change indicator (Requirement 3: no cleartext password in settings) */}
                <div className="p-4 rounded-2xl bg-pink-50/50 border border-pink-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                        Mật khẩu quản trị GVCN
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Mật khẩu được mã hóa an toàn trên máy chủ (không lưu dạng rõ).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenPasswordModal(true)}
                    className="px-4 py-2 rounded-xl bg-white border border-pink-200 text-pink-700 hover:bg-pink-100 text-xs font-bold transition-colors"
                  >
                    Đổi mật khẩu GV
                  </button>
                </div>

                {/* Attention threshold configuration */}
                <div className="pt-2">
                  <h4 className="font-bold text-xs text-gray-700 uppercase mb-2">
                    Tiêu chuẩn cảnh báo "Học sinh cần chú ý" trên Tổng quan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">
                        Cảnh báo khi số lượt vi phạm kỷ luật đạt từ:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={vThreshold}
                        onChange={e => setVThreshold(parseInt(e.target.value) || 2)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">
                        Cảnh báo khi số buổi vắng/muộn đạt từ:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={aThreshold}
                        onChange={e => setAThreshold(parseInt(e.target.value) || 2)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu thông tin</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 2. QUY TẮC THI ĐUA (Requirement 8) */}
          {activeTab === 'emulation' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-pink-50 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-gray-900 text-lg uppercase">
                    Quy tắc thi đua & Ngưỡng xếp loại rèn luyện
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Cấu hình điểm khởi đầu và 4 bậc: Tốt, Khá, Đạt, Chưa đạt (A &gt; B &gt; C)
                  </p>
                </div>
                <button
                  onClick={handleSaveEmulation}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu quy tắc</span>
                </button>
              </div>

              {/* Thresholds box */}
              <div className="p-4 rounded-2xl bg-pink-50/50 border border-pink-200 space-y-4">
                <span className="text-xs font-bold text-pink-900 uppercase">
                  Thang điểm & Ngưỡng hạnh kiểm kỳ
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-gray-600 mb-1">Điểm khởi đầu:</label>
                    <input
                      type="number"
                      step="any"
                      value={startingScore}
                      onChange={e => setStartingScore(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-300 font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-700 font-semibold mb-1">
                      Từ (A) trở lên là Tốt:
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={thresholdGood}
                      onChange={e => setThresholdGood(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-xl border border-emerald-300 font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-700 font-semibold mb-1">
                      Từ (B) đến &lt; A là Khá:
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={thresholdFair}
                      onChange={e => setThresholdFair(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-xl border border-blue-300 font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-700 font-semibold mb-1">
                      Từ (C) đến &lt; B là Đạt:
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={thresholdPass}
                      onChange={e => setThresholdPass(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-xl border border-amber-300 font-bold bg-white"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 italic">
                  * Dưới ngưỡng C ({thresholdPass}đ) sẽ được xếp loại: <strong>Chưa đạt</strong>.
                </p>
              </div>

              {/* Add New Rule */}
              <div className="p-4 rounded-2xl bg-white border border-pink-100 shadow-2xs space-y-3">
                <span className="text-xs font-bold text-gray-700 uppercase">
                  Thêm tiêu chí thi đua mới
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <select
                      value={newRuleType}
                      onChange={e => setNewRuleType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white font-medium"
                    >
                      <option value="violation">Lỗi vi phạm (- điểm)</option>
                      <option value="award">Khen thưởng (+ điểm)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      value={newRuleName}
                      onChange={e => setNewRuleName(e.target.value)}
                      placeholder="Tên lỗi hoặc việc tốt..."
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="any"
                      value={newRulePoints}
                      onChange={e => setNewRulePoints(parseFloat(e.target.value) || 0)}
                      placeholder="Điểm"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddRule}
                      className="w-full h-full py-2 bg-[#e25d7c] hover:bg-[#d44b6b] text-white rounded-xl text-xs font-bold flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Rules List */}
              <div className="divide-y divide-pink-50 max-h-96 overflow-y-auto border border-pink-100 rounded-2xl bg-white shadow-2xs">
                {rules.map(r => {
                  const isEditing = editingRuleId === r.id;

                  if (isEditing) {
                    return (
                      <div
                        key={r.id}
                        className="p-3 bg-pink-50/60 border-l-4 border-l-pink-500 space-y-2 text-xs animate-fadeIn"
                      >
                        <div className="flex items-center justify-between font-bold text-gray-700">
                          <span className="flex items-center gap-1.5 text-pink-700">
                            <Edit2 className="w-3.5 h-3.5 text-pink-600" />
                            Chỉnh sửa tiêu chí thi đua
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-3">
                            <select
                              value={editingRuleType}
                              onChange={e => {
                                const newType = e.target.value as 'violation' | 'award';
                                setEditingRuleType(newType);
                                if (newType === 'violation' && editingRulePoints > 0) {
                                  setEditingRulePoints(-editingRulePoints);
                                } else if (newType === 'award' && editingRulePoints < 0) {
                                  setEditingRulePoints(Math.abs(editingRulePoints));
                                }
                              }}
                              className="w-full px-2.5 py-1.5 rounded-xl border border-pink-200 text-xs bg-white font-medium focus:ring-2 focus:ring-pink-300 focus:outline-hidden"
                            >
                              <option value="violation">Lỗi vi phạm (- điểm)</option>
                              <option value="award">Khen thưởng (+ điểm)</option>
                            </select>
                          </div>
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              value={editingRuleName}
                              onChange={e => setEditingRuleName(e.target.value)}
                              placeholder="Tên tiêu chí vi phạm / khen thưởng..."
                              className="w-full px-3 py-1.5 rounded-xl border border-pink-200 text-xs bg-white font-medium focus:ring-2 focus:ring-pink-300 focus:outline-hidden"
                              autoFocus
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              step="any"
                              value={editingRulePoints}
                              onChange={e => setEditingRulePoints(parseFloat(e.target.value) || 0)}
                              placeholder="Điểm"
                              className="w-full px-2 py-1.5 rounded-xl border border-pink-200 text-xs font-bold bg-white text-center focus:ring-2 focus:ring-pink-300 focus:outline-hidden"
                            />
                          </div>
                          <div className="sm:col-span-2 flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => handleSaveEditRule(r.id)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                              title="Lưu thay đổi"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Lưu</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditRule}
                              className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors"
                              title="Hủy bỏ"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Hủy</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={r.id}
                      className="p-3 flex items-center justify-between text-xs hover:bg-pink-50/20 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={r.active}
                          onChange={() => handleToggleRuleActive(r.id)}
                          className="rounded text-pink-600 focus:ring-pink-500 shrink-0 cursor-pointer"
                        />
                        <span
                          className={`font-bold shrink-0 ${
                            r.type === 'violation' ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {r.type === 'violation' ? '[Vi phạm]' : '[Khen thưởng]'}
                        </span>
                        <span
                          className={`font-semibold truncate ${
                            r.active ? 'text-gray-800' : 'text-gray-400 line-through'
                          }`}
                        >
                          {r.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`font-black min-w-[36px] text-right mr-1 ${
                            r.points < 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {r.points > 0 ? `+${r.points}đ` : `${r.points}đ`}
                        </span>

                        {/* Nút Chỉnh sửa tiêu chí cạnh thùng rác */}
                        <button
                          type="button"
                          onClick={() => handleStartEditRule(r)}
                          title="Chỉnh sửa tiêu chí"
                          className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Nút Thùng rác (Xóa tiêu chí) */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(r.id)}
                          title="Xóa tiêu chí"
                          className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. DỮ LIỆU & SUPABASE (Requirements 12 & 6) */}
          {activeTab === 'system' && (
            <div className="space-y-8">
              {/* Supabase Integration */}
              <div className="space-y-4">
                <div className="pb-3 border-b border-pink-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-pink-600" />
                    <h3 className="font-black text-gray-900 text-base uppercase">
                      Đồng bộ đám mây Supabase
                    </h3>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      supabaseStatus.connected
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {supabaseStatus.connected ? 'Đã kết nối' : 'Lưu trữ máy chủ (Chưa gắn Supabase)'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-pink-50/50 border border-pink-100 text-xs space-y-3">
                  <div className="flex items-start gap-2 text-gray-700">
                    <Info className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                    <div>
                      Dùng Supabase để lưu trữ tập trung dữ liệu toàn lớp, cho phép truy cập từ máy tính và điện thoại cùng một nguồn dữ liệu thật. Khi chưa cấu hình, ứng dụng hoạt động trên cơ sở dữ liệu bền vững của máy chủ.
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block font-bold text-gray-700 uppercase text-[11px] mb-1">
                        Supabase Project URL
                      </label>
                      <input
                        type="url"
                        value={supabaseUrl}
                        onChange={e => setSupabaseUrl(e.target.value)}
                        placeholder="https://xyzcompany.supabase.co"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 uppercase text-[11px] mb-1">
                        Supabase Service Role Key (Bảo mật máy chủ)
                      </label>
                      <input
                        type="password"
                        value={supabaseKey}
                        onChange={e => setSupabaseKey(e.target.value)}
                        placeholder="eyJhbGciOi... (Hoặc đã cấu hình qua biến môi trường SUPABASE_SERVICE_ROLE_KEY)"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono bg-white"
                      />
                      <p className="text-[10px] text-emerald-700 font-medium mt-1">
                        🔒 Khóa bí mật chỉ được lưu trên môi trường máy chủ backend (SUPABASE_SERVICE_ROLE_KEY), tuyệt đối không lưu vào mã nguồn, tệp cơ sở dữ liệu hay commit lên Git.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={supabaseTesting || (!supabaseStatus.connected && (!supabaseUrl || !supabaseKey))}
                        onClick={handleTestSupabase}
                        className="px-4 py-2 rounded-xl border border-pink-300 text-pink-700 bg-white hover:bg-pink-100 text-xs font-bold disabled:opacity-50"
                      >
                        {supabaseTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveSupabase}
                        className="px-4 py-2 rounded-xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white text-xs font-bold transition-colors"
                      >
                        Lưu cấu hình Supabase
                      </button>

                      {supabaseStatus.connected && (
                        <>
                          <button
                            type="button"
                            disabled={isCloudSyncing}
                            onClick={handleSyncCloud}
                            title="Lưu trữ vĩnh viễn danh sách lớp hiện tại lên Supabase"
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                            <span>{isCloudSyncing ? 'Đang đồng bộ...' : 'Đồng bộ lên Supabase'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isCloudSyncing}
                            onClick={handlePullCloud}
                            title="Tải lại toàn bộ dữ liệu từ đám mây Supabase về máy"
                            className="px-4 py-2 rounded-xl border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Tải từ Supabase</span>
                          </button>
                        </>
                      )}
                    </div>

                    {supabaseTestMsg && (
                      <div
                        className={`p-3 rounded-xl text-xs font-medium ${
                          supabaseTestMsg.type === 'ok'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {supabaseTestMsg.text}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Backup & Restore */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-black text-gray-900 text-base uppercase">
                  Sao lưu & Khôi phục dữ liệu
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white border border-pink-100 shadow-2xs space-y-2">
                    <h4 className="font-bold text-xs uppercase text-gray-800">
                      Tải bản sao lưu toàn bộ (.json)
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Lưu trữ an toàn học sinh, điểm danh, điểm số, bảng tin về máy tính cá nhân.
                    </p>
                    <button
                      onClick={handleDownloadBackup}
                      className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 hover:bg-pink-100 text-xs font-bold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải file sao lưu ngay</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-pink-100 shadow-2xs space-y-2">
                    <h4 className="font-bold text-xs uppercase text-gray-800">
                      Khôi phục từ bản sao lưu
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Chọn file backup .json đã tải trước đó để khôi phục lớp học.
                    </p>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreFile}
                      className="mt-2 text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-pink-600 file:text-white hover:file:bg-pink-700 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Safe Clean Class Purge (Requirement 6) */}
              <div className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-3">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Khu vực nguy hiểm: Làm sạch dữ liệu lớp học</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  Chức năng này dùng khi kết thúc năm học để dọn sạch dữ liệu cũ. Toàn bộ danh sách học sinh, điểm danh, điểm học tập và thi đua của lớp sẽ bị xóa. Hệ thống sẽ tự động sao lưu an toàn một bản dự phòng trước khi xóa.
                </p>

                <div className="space-y-2 pt-2">
                  <label className="block text-[11px] font-bold text-rose-900">
                    Để xác nhận, vui lòng gõ chính xác: <code>XÓA LỚP {classSettings.className}</code>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={cleanConfirmText}
                      onChange={e => setCleanConfirmText(e.target.value)}
                      placeholder={`Gõ: XÓA LỚP ${classSettings.className}`}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-rose-300 text-xs bg-white focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      disabled={cleanConfirmText !== `XÓA LỚP ${classSettings.className}` || cleanLoading}
                      onClick={handleCleanClass}
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-40"
                    >
                      {cleanLoading ? 'Đang xóa...' : 'Xác nhận làm sạch lớp'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
