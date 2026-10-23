import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Menu, Sparkles, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<Props> = ({ onToggleMobileMenu }) => {
  const { role } = useAuth();
  const { classSettings, supabaseStatus, refreshState, isLoading, error } = useApp();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      if (role === 'teacher') {
        const res = await api.syncCloud();
        await refreshState();
        setSyncFeedback(res.message || 'Đồng bộ Supabase thành công!');
      } else {
        await refreshState();
        setSyncFeedback('Đã tải lại dữ liệu mới nhất!');
      }
    } catch (err: any) {
      console.warn('Sync notice:', err.message);
      // Fallback to regular state refresh
      await refreshState().catch(() => {});
      setSyncFeedback(err.message || 'Đã làm mới dữ liệu');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-pink-100 px-4 py-2.5 flex items-center justify-between shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-pink-50 transition-colors"
          aria-label="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800 text-sm md:text-base">
            {classSettings.appName || 'Trợ lý chủ nhiệm'}
          </span>
          <span className="text-gray-400 font-light">•</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-pink-100 text-pink-700">
            Lớp {classSettings.className}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* School Year Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Năm học {classSettings.academicYear}</span>
        </div>

        {/* Sync Success Feedback Toast */}
        {syncFeedback && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate max-w-[200px]">{syncFeedback}</span>
          </div>
        )}

        {/* Sync / Refresh Button */}
        <button
          onClick={handleSync}
          disabled={isLoading || isSyncing}
          title="Đồng bộ dữ liệu với máy chủ & đám mây Supabase"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-pink-200 text-xs font-medium text-pink-700 hover:bg-pink-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">
            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}
          </span>
        </button>

        {error && (
          <div
            title={error}
            className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-200"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Lỗi kết nối</span>
          </div>
        )}
      </div>
    </header>
  );
};
