import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp, NavTab } from '../context/AppContext';
import {
  LayoutDashboard,
  Megaphone,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  Settings as SettingsIcon,
  KeyRound,
  Cloud,
  LogOut,
  X,
  UserCheck,
} from 'lucide-react';

interface Props {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<Props> = ({ isOpenMobile, onCloseMobile }) => {
  const { role, user, logout, setOpenPasswordModal } = useAuth();
  const { activeTab, setActiveTab, classSettings, supabaseStatus, openStudentProfile } = useApp();

  const handleNav = (tab: NavTab) => {
    if (tab === 'students' && role === 'student' && user?.id) {
      openStudentProfile(user.id);
    } else {
      setActiveTab(tab);
    }
    onCloseMobile();
  };

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; teacherOnly?: boolean }> = [
    {
      id: 'dashboard',
      label: 'Tổng quan',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'bulletin',
      label: 'Bảng tin & Sơ đồ lớp',
      icon: <Megaphone className="w-5 h-5" />,
    },
    {
      id: 'students',
      label: role === 'student' ? 'Hồ sơ của tôi' : 'Học sinh',
      icon: <GraduationCap className="w-5 h-5" />,
    },
    {
      id: 'academics',
      label: role === 'student' ? 'Điểm của tôi' : 'Học tập',
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      id: 'attendance',
      label: role === 'student' ? 'Chuyên cần của tôi' : 'Điểm danh',
      icon: <CalendarCheck className="w-5 h-5" />,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-pink-100 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } shadow-sm md:shadow-none`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Top Brand Header */}
          <div className="p-4 border-b border-pink-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#e25d7c] text-white flex items-center justify-center shadow-xs shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-bold text-sm tracking-tight text-gray-900 uppercase">
                    {classSettings.appName || 'Trợ lý chủ nhiệm'}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200">
                      Lớp {classSettings.className}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onCloseMobile}
                className="md:hidden text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GVCN & School Info */}
            <div className="mt-3 text-xs text-gray-600 space-y-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-[#e25d7c] shrink-0"></span>
                <span className="font-medium text-gray-500">GVCN:</span>
                <span className="font-semibold text-gray-800 truncate">
                  {classSettings.homeroomTeacher || 'Chưa cập nhật'}
                </span>
              </div>
              {classSettings.schoolName && (
                <div className="text-[11px] text-gray-400 truncate pl-3.5">
                  {classSettings.schoolName}
                </div>
              )}
            </div>

            {/* Supabase Status Pill */}
            <div
              onClick={() => {
                if (role === 'teacher') handleNav('settings');
              }}
              className={`mt-3 flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                supabaseStatus.connected
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-700 hover:bg-emerald-100/60'
                  : 'bg-amber-50/70 border-amber-200 text-amber-700 hover:bg-amber-100/60'
              }`}
              title={
                supabaseStatus.connected
                  ? 'Supabase đã kết nối đồng bộ đám mây'
                  : 'Đang lưu trữ máy chủ nội bộ. Bấm để cấu hình Supabase Cloud.'
              }
            >
              <div className="flex items-center gap-1.5 truncate">
                <Cloud className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {supabaseStatus.connected ? 'Supabase: Đã kết nối' : 'Supabase: Chưa kết nối'}
                </span>
              </div>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  supabaseStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              ></span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1 flex-1">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-pink-100/80 text-pink-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/60'
                  }`}
                >
                  <span className={`${isActive ? 'text-pink-600' : 'text-gray-400'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* System Section Header */}
            <div className="pt-4 pb-1 px-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Hệ thống
              </span>
            </div>

            {/* Password Change Button */}
            <button
              onClick={() => {
                setOpenPasswordModal(true);
                onCloseMobile();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-pink-50/60 rounded-xl transition-all"
            >
              <KeyRound className="w-4 h-4 text-gray-400" />
              <span>{role === 'teacher' ? 'Đổi mật khẩu GV' : 'Đổi mật khẩu'}</span>
            </button>

            {/* Supabase Cloud Link */}
            <button
              onClick={() => {
                if (role === 'teacher') handleNav('settings');
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-pink-50/60 rounded-xl transition-all"
            >
              <div className="flex items-center gap-3">
                <Cloud className="w-4 h-4 text-gray-400" />
                <span>Supabase Cloud</span>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  supabaseStatus.connected ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              ></span>
            </button>

            {/* Settings for Teacher */}
            {role === 'teacher' && (
              <button
                onClick={() => handleNav('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === 'settings'
                    ? 'bg-pink-100/80 text-pink-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-pink-50/60'
                }`}
              >
                <SettingsIcon
                  className={`w-4 h-4 ${
                    activeTab === 'settings' ? 'text-pink-600' : 'text-gray-400'
                  }`}
                />
                <span>Cài đặt</span>
              </button>
            )}
          </nav>
        </div>

        {/* Bottom User & Logout Card */}
        <div className="p-3 border-t border-pink-50 bg-pink-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-pink-200 text-pink-700 font-bold text-xs flex items-center justify-center shrink-0">
                {role === 'teacher' ? 'GV' : 'HS'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-gray-800 truncate">
                  {role === 'teacher' ? 'Giáo viên' : user?.name || 'Học sinh'}
                </p>
                <p className="text-[10px] text-gray-500 truncate">
                  {role === 'teacher' ? 'Quyền quản lý' : `Mã: ${user?.code || 'HS'}`}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Đăng xuất"
              className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
