import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Role } from '../types';
import { GraduationCap, ShieldCheck, User, KeyRound, ArrowRight, AlertCircle, Info } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role>('teacher');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bootstrap info
  const [bootstrapInfo, setBootstrapInfo] = useState<{
    appName: string;
    schoolName: string;
    className: string;
    isInitialPassword?: boolean;
  }>({
    appName: 'Trợ lý chủ nhiệm',
    schoolName: '',
    className: '',
    isInitialPassword: false,
  });

  useEffect(() => {
    api.getBootstrap().then(data => {
      if (data?.classSettings) {
        setBootstrapInfo({
          appName: data.classSettings.appName || 'Trợ lý chủ nhiệm',
          schoolName: data.classSettings.schoolName || '',
          className: data.classSettings.className || '',
          isInitialPassword: data.isInitialPassword,
        });
      }
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (selectedRole === 'teacher') {
        await login({ role: 'teacher', password });
      } else {
        await login({ role: 'student', username, password });
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập không thành công.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#feeae9] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Top Header Card with soft #feb5c0 */}
        <div className="bg-[#feb5c0] rounded-t-3xl pt-8 pb-6 px-6 text-[#701a2c] text-center shadow-md relative overflow-hidden border-b border-[#f9a3b0]/30">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="mx-auto w-16 h-16 rounded-2xl bg-white/50 backdrop-blur-xs flex items-center justify-center shadow-xs mb-3 text-[#701a2c]">
            <GraduationCap className="w-9 h-9" />
          </div>

          <h2 className="text-2xl font-black tracking-wide uppercase text-[#5a1020]">
            {selectedRole === 'teacher' ? 'GVCN' : 'HỌC SINH'}
          </h2>
          <p className="text-[#781b2e] text-sm mt-1 font-semibold">
            {bootstrapInfo.schoolName ? `${bootstrapInfo.schoolName} • ` : ''}
            Lớp {bootstrapInfo.className || 'Chủ nhiệm'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-b-3xl p-6 sm:p-8 shadow-xl border border-[#fbdad8] -mt-2">
          {/* Role Segmented Selector */}
          <div className="flex bg-[#feeae9] p-1 rounded-2xl mb-6 border border-[#fbdad8]">
            <button
              type="button"
              onClick={() => {
                setSelectedRole('teacher');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                selectedRole === 'teacher'
                  ? 'bg-white text-[#c02d4f] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#c02d4f]" />
              <span>Giáo Viên Chủ Nhiệm</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedRole('student');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                selectedRole === 'student'
                  ? 'bg-white text-[#c02d4f] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <User className="w-4 h-4 shrink-0 text-[#c02d4f]" />
              <span>Học Sinh</span>
            </button>
          </div>

          {/* Initial Password Notice */}
          {selectedRole === 'teacher' && bootstrapInfo.isInitialPassword && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Khởi tạo ban đầu:</strong> Mật khẩu quản trị mặc định là <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">123456</code>. Thầy/Cô vui lòng đổi mật khẩu mới trong menu Cài đặt sau khi đăng nhập.
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedRole === 'teacher' ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Mật khẩu quản trị
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu GVCN"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[#fbdad8] focus:outline-hidden focus:border-[#e27388] focus:ring-4 focus:ring-[#feeae9] text-sm font-medium text-gray-800 placeholder-gray-400 transition-all pr-11"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-[#e27388]">
                    <KeyRound className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Dùng mật khẩu riêng đã thiết lập cho ứng dụng.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Ví dụ: 02102013-02102013 hoặc HS001-02102013"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[#fbdad8] focus:outline-hidden focus:border-[#e27388] focus:ring-4 focus:ring-[#feeae9] text-sm font-medium text-gray-800 placeholder-gray-400 transition-all"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Định dạng: <code>[mã số]-[ddmmyyyy]</code> (mã hồ sơ và ngày sinh)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mặc định là ngày sinh (ddmmyyyy)"
                      className="w-full px-4 py-3 rounded-2xl border-2 border-[#fbdad8] focus:outline-hidden focus:border-[#e27388] focus:ring-4 focus:ring-[#feeae9] text-sm font-medium text-gray-800 placeholder-gray-400 transition-all pr-11"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-[#e27388]">
                      <KeyRound className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Mật khẩu ban đầu là ngày sinh gồm 8 số (ví dụ: 02102013)
                  </p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-2xl font-bold text-white bg-[#e25d7c] hover:bg-[#d84d6d] active:scale-[0.99] shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <span>{loading ? 'Đang xác thực...' : 'Đăng Nhập Vào Hệ Thống'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Hệ thống quản lý lớp học dành riêng cho Giáo viên Chủ nhiệm
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
