import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { BulletinAndSeating } from './pages/BulletinAndSeating';
import { Students } from './pages/Students';
import { StudentProfile } from './pages/StudentProfile';
import { Academics } from './pages/Academics';
import { Attendance } from './pages/Attendance';
import { Settings } from './pages/Settings';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, role, isLoading: authLoading, openPasswordModal, setOpenPasswordModal } = useAuth();
  const { activeTab, setActiveTab } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fff5f7] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
        <p className="text-xs font-semibold text-gray-500">Đang khởi tạo Trợ lý chủ nhiệm...</p>
      </div>
    );
  }

  if (!user || !role) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#feeae9] flex flex-col md:flex-row text-gray-800 font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'bulletin' && <BulletinAndSeating />}
          {activeTab === 'students' && <Students />}
          {activeTab === 'student_profile' && <StudentProfile />}
          {activeTab === 'academics' && <Academics />}
          {activeTab === 'attendance' && <Attendance />}
          {activeTab === 'settings' && role === 'teacher' && <Settings />}
        </main>
      </div>

      {/* Global Password Change Modal */}
      <PasswordChangeModal
        isOpen={openPasswordModal}
        onClose={() => setOpenPasswordModal(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
