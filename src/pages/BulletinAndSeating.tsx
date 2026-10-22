import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  Megaphone,
  LayoutGrid,
  Trophy,
  Plus,
  Pin,
  Trash2,
  Edit2,
  ExternalLink,
  Printer,
  Save,
  CheckCircle2,
  AlertCircle,
  Video,
  Image as ImageIcon,
  Award,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';

export const BulletinAndSeating: React.FC = () => {
  const { role } = useAuth();
  const {
    classSettings,
    students,
    announcements,
    seatingChart,
    grades,
    subjects,
    honors,
    refreshState,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'bulletin' | 'seating' | 'honors'>('bulletin');

  // Bulletin post modal state
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postMediaUrl, setPostMediaUrl] = useState('');
  const [postMediaType, setPostMediaType] = useState<'image' | 'video' | ''>('');
  const [postYoutubeUrl, setPostYoutubeUrl] = useState('');
  const [postDriveUrl, setPostDriveUrl] = useState('');
  const [postPinned, setPostPinned] = useState(false);
  const [postPublished, setPostPublished] = useState(true);
  const [postError, setPostError] = useState<string | null>(null);

  // Seating chart editing state
  const [selectedSeatKey, setSelectedSeatKey] = useState<string | null>(null);
  const [localSeats, setLocalSeats] = useState<Record<string, string | null>>(
    seatingChart?.seats || {}
  );
  const [seatingPublished, setSeatingPublished] = useState(seatingChart?.isPublished || false);
  const [seatingSaving, setSeatingSaving] = useState(false);
  const [seatingSuccess, setSeatingSuccess] = useState(false);

  // Calculate Top 5 Academic students for latest month
  const availableMonths = Object.keys(grades);
  const currentMonth = availableMonths[availableMonths.length - 1] || 'Tháng Mười';
  const monthScores = grades[currentMonth] || {};
  const gradedSubjects = subjects.filter(s => s.isGraded);

  const studentAverages = students
    .map(st => {
      const sGrades = monthScores[st.id] || {};
      let sum = 0;
      let count = 0;
      gradedSubjects.forEach(sub => {
        const val = sGrades[sub.code];
        if (val !== undefined && val !== null) {
          sum += val;
          count++;
        }
      });
      const gpa = count > 0 ? sum / count : null;
      return { student: st, gpa, gradedCount: count };
    })
    .filter(item => item.gpa !== null)
    .sort((a, b) => (b.gpa || 0) - (a.gpa || 0));

  const top5Academic = studentAverages.slice(0, 5);

  // Check if current month honors is already published
  const currentAcademicHonor = honors.find(
    h => h.month === currentMonth && h.type === 'academic' && h.isPublished
  );

  // Handle media file upload
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Tệp đính kèm không được vượt quá 15MB.');
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) {
      alert('Chỉ hỗ trợ tệp hình ảnh (JPG, PNG, WebP) hoặc video (MP4, WebM).');
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      setPostMediaUrl(ev.target?.result as string);
      setPostMediaType(isVideo ? 'video' : 'image');
    };
    reader.readAsDataURL(file);
  };

  // YouTube embed helper
  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) {
      setPostError('Vui lòng nhập đầy đủ tiêu đề và nội dung.');
      return;
    }
    setPostError(null);

    try {
      if (editingPostId) {
        await api.updateAnnouncement(editingPostId, {
          title: postTitle,
          content: postContent,
          mediaUrl: postMediaUrl,
          mediaType: postMediaType,
          youtubeUrl: postYoutubeUrl,
          driveUrl: postDriveUrl,
          isPinned: postPinned,
          isPublished: postPublished,
        });
      } else {
        await api.createAnnouncement({
          title: postTitle,
          content: postContent,
          mediaUrl: postMediaUrl,
          mediaType: postMediaType,
          youtubeUrl: postYoutubeUrl,
          driveUrl: postDriveUrl,
          isPinned: postPinned,
          isPublished: postPublished,
        });
      }
      setIsPostModalOpen(false);
      resetPostForm();
      await refreshState();
    } catch (err: any) {
      setPostError(err.message || 'Không thể lưu bài viết.');
    }
  };

  const resetPostForm = () => {
    setEditingPostId(null);
    setPostTitle('');
    setPostContent('');
    setPostMediaUrl('');
    setPostMediaType('');
    setPostYoutubeUrl('');
    setPostDriveUrl('');
    setPostPinned(false);
    setPostPublished(true);
    setPostError(null);
  };

  const handleEditPost = (post: any) => {
    setEditingPostId(post.id);
    setPostTitle(post.title);
    setPostContent(post.content);
    setPostMediaUrl(post.mediaUrl || '');
    setPostMediaType(post.mediaType || '');
    setPostYoutubeUrl(post.youtubeUrl || '');
    setPostDriveUrl(post.driveUrl || '');
    setPostPinned(post.isPinned);
    setPostPublished(post.isPublished);
    setIsPostModalOpen(true);
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Thầy/Cô có chắc chắn muốn xóa bài viết này không?')) return;
    try {
      await api.deleteAnnouncement(id);
      await refreshState();
    } catch (err: any) {
      alert(err.message || 'Không thể xóa bài viết.');
    }
  };

  // Seating Chart Assignment
  const handleAssignSeat = (seatKey: string, studentId: string | null) => {
    // If student already has another seat, remove them from previous seat first
    const updated = { ...localSeats };
    if (studentId) {
      for (const [key, val] of Object.entries(updated)) {
        if (val === studentId && key !== seatKey) {
          updated[key] = null;
        }
      }
    }
    updated[seatKey] = studentId;
    setLocalSeats(updated);
    setSelectedSeatKey(null);
  };

  const handleSaveSeating = async () => {
    setSeatingSaving(true);
    setSeatingSuccess(false);
    try {
      await api.updateSeatingChart(localSeats, seatingPublished);
      await refreshState();
      setSeatingSuccess(true);
      setTimeout(() => setSeatingSuccess(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Không thể lưu sơ đồ lớp.');
    } finally {
      setSeatingSaving(false);
    }
  };

  const handlePublishHonors = async () => {
    if (top5Academic.length === 0) {
      alert('Chưa có học sinh có điểm trung bình để công bố vinh danh.');
      return;
    }
    if (!window.confirm(`Xác nhận công bố Top 5 Học tập ${currentMonth}?`)) return;

    try {
      await api.createHonor({
        title: `Vinh danh Top Học tập - ${currentMonth}`,
        type: 'academic',
        month: currentMonth,
        studentIds: top5Academic.map(item => item.student.id),
        notes: `Điểm trung bình cao nhất ${currentMonth}`,
        isPublished: true,
      });
      await refreshState();
      alert('Đã công bố vinh danh học tập thành công!');
    } catch (err: any) {
      alert(err.message || 'Không thể công bố vinh danh.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Tab Bar matching screenshot 3 */}
      <div className="bg-white rounded-3xl p-3 sm:p-4 border border-pink-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex bg-[#feeae9] p-1 rounded-2xl w-full sm:w-auto overflow-x-auto border border-[#fbdad8]">
          <button
            onClick={() => setActiveSubTab('bulletin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'bulletin'
                ? 'bg-white text-[#a02040] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Megaphone className="w-4 h-4 text-[#a02040]" />
            <span>Bảng tin Thông báo</span>
          </button>
          <button
            onClick={() => setActiveSubTab('seating')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'seating'
                ? 'bg-white text-[#a02040] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-[#a02040]" />
            <span>Sơ đồ lớp</span>
          </button>
          <button
            onClick={() => setActiveSubTab('honors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'honors'
                ? 'bg-white text-[#a02040] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Trophy className="w-4 h-4 text-[#a02040]" />
            <span>Vinh danh & Thi đua</span>
          </button>
        </div>

        {role === 'teacher' && activeSubTab === 'bulletin' && (
          <button
            onClick={() => {
              resetPostForm();
              setIsPostModalOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#e25d7c] hover:bg-[#d44b6b] text-white text-xs sm:text-sm font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Đăng thông tin mới</span>
          </button>
        )}
      </div>

      {/* TAB 1: BẢNG TIN THÔNG BÁO */}
      {activeSubTab === 'bulletin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Trang thông tin & Bảng tin Lớp {classSettings.className}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Các thông báo, kế hoạch và nhắc nhở từ GVCN đến lớp
                  </p>
                </div>
              </div>
            </div>

            {announcements.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-pink-100 text-gray-400">
                Chưa có thông báo nào được đăng trên bảng tin.
              </div>
            ) : (
              announcements.map(post => {
                const ytEmbed = getYouTubeEmbedUrl(post.youtubeUrl || '');
                return (
                  <div
                    key={post.id}
                    className="bg-white rounded-3xl p-6 border border-pink-100 shadow-xs space-y-4 relative overflow-hidden"
                  >
                    {post.isPinned && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Pin className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
                        <span>Ghim đầu trang</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-black text-gray-900 text-lg leading-snug">
                          {post.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span className="font-semibold text-pink-600">{post.author}</span>
                          <span>•</span>
                          <span>
                            {new Date(post.createdAt).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {role === 'teacher' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleEditPost(post)}
                            title="Sửa bài viết"
                            className="p-1.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            title="Xóa bài viết"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-gray-700 text-sm whitespace-pre-line leading-relaxed">
                      {post.content}
                    </p>

                    {/* Media Attachments */}
                    {post.mediaUrl && (
                      <div className="rounded-2xl overflow-hidden border border-pink-100 max-h-96 flex items-center justify-center bg-gray-50">
                        {post.mediaType === 'video' ? (
                          <video src={post.mediaUrl} controls className="w-full max-h-96 object-contain" />
                        ) : (
                          <img
                            src={post.mediaUrl}
                            alt="Đính kèm"
                            className="w-full max-h-96 object-contain"
                          />
                        )}
                      </div>
                    )}

                    {/* YouTube Video Embed */}
                    {ytEmbed && (
                      <div className="aspect-video w-full rounded-2xl overflow-hidden border border-pink-100 shadow-xs">
                        <iframe
                          src={ytEmbed}
                          title={post.title}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      </div>
                    )}

                    {/* Google Drive Link */}
                    {post.driveUrl && (
                      <div className="p-3 rounded-2xl bg-pink-50/60 border border-pink-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-700">
                          <ExternalLink className="w-4 h-4 text-pink-600 shrink-0" />
                          <span className="truncate font-medium">Tệp đính kèm Google Drive</span>
                        </div>
                        <a
                          href={post.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-lg bg-white border border-pink-200 text-pink-700 text-xs font-bold hover:bg-pink-100 transition-colors"
                        >
                          Mở liên kết
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Honors Preview Widget */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-pink-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm uppercase">Top 5 Học Tập</h4>
                    <p className="text-[11px] text-gray-400">{currentMonth} • ĐTB cao nhất</p>
                  </div>
                </div>
                {role === 'teacher' && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      currentAcademicHonor
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {currentAcademicHonor ? 'Đã công bố' : 'Bản nháp'}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-2.5">
                {top5Academic.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    Chưa có dữ liệu học tập để xếp hạng tháng này.
                  </div>
                ) : (
                  top5Academic.map(({ student, gpa }, idx) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-pink-50/40 hover:bg-pink-50 transition-colors border border-pink-100/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-white shadow-xs'
                              : idx === 1
                              ? 'bg-gray-300 text-gray-700'
                              : idx === 2
                              ? 'bg-amber-600 text-white'
                              : 'bg-pink-200 text-pink-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-gray-800 uppercase">{student.fullName}</p>
                          <p className="text-[10px] text-gray-400">Mã: {student.code}</p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-pink-700 bg-white px-2 py-1 rounded-lg border border-pink-200">
                        {gpa?.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {role === 'teacher' && top5Academic.length > 0 && !currentAcademicHonor && (
                <button
                  onClick={handlePublishHonors}
                  className="w-full mt-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Công bố vinh danh {currentMonth}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SƠ ĐỒ LỚP */}
      {activeSubTab === 'seating' && (
        <div className="space-y-6">
          {/* Seating Top Toolbar */}
          <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                Sơ đồ bố trí chỗ ngồi Lớp {classSettings.className}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Cấu trúc chuẩn 4 dãy bàn x 7 hàng bàn x 2 chỗ/bàn = 56 chỗ ngồi
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {role === 'teacher' && (
                <>
                  <button
                    onClick={() => setSeatingPublished(!seatingPublished)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      seatingPublished
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-gray-100 border-gray-300 text-gray-600'
                    }`}
                  >
                    {seatingPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span>{seatingPublished ? 'Đã công bố cho HS' : 'Chưa công bố (Ẩn)'}</span>
                  </button>

                  <button
                    onClick={handleSaveSeating}
                    disabled={seatingSaving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{seatingSaving ? 'Đang lưu...' : 'Lưu sơ đồ'}</span>
                  </button>
                </>
              )}

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-pink-200 text-pink-700 bg-pink-50 hover:bg-pink-100 text-xs font-bold transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>In sơ đồ</span>
              </button>
            </div>
          </div>

          {seatingSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Đã lưu sơ đồ lớp thành công!</span>
            </div>
          )}

          {/* Seating Room Container */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-pink-100 shadow-xs print:p-0 print:border-none">
            {/* Front of Classroom: Blackboard & Teacher Desk */}
            <div className="mb-8 space-y-4">
              <div className="w-full max-w-xl mx-auto py-2.5 px-6 rounded-xl bg-gray-800 text-white font-bold text-center text-xs tracking-wider shadow-inner">
                BẢNG ĐEN LỚP HỌC
              </div>

              <div className="flex items-center justify-between max-w-2xl mx-auto px-4">
                <div className="px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-semibold text-xs flex items-center gap-2">
                  <span>🚪 CỬA RA VÀO</span>
                </div>
                <div className="px-6 py-2.5 rounded-xl bg-pink-100 border border-pink-300 text-pink-800 font-bold text-xs shadow-xs">
                  BÀN GIÁO VIÊN
                </div>
              </div>

              <div className="text-center text-[11px] text-gray-400 italic">
                ↓ Hướng nhìn từ bục giảng xuống lớp học ↓
              </div>
            </div>

            {/* 4 Rows Grid (Dãy 1 -> Dãy 4) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4">
              {[1, 2, 3, 4].map(colIdx => (
                <div key={colIdx} className="bg-pink-50/40 rounded-2xl p-3 border border-pink-100">
                  <div className="text-center font-bold text-xs uppercase text-pink-800 mb-3 pb-1 border-b border-pink-200">
                    DÃY {colIdx}
                  </div>

                  <div className="space-y-2.5">
                    {[1, 2, 3, 4, 5, 6, 7].map(deskIdx => (
                      <div
                        key={deskIdx}
                        className="bg-white rounded-xl p-2 border border-pink-100/80 shadow-2xs"
                      >
                        <div className="text-[10px] text-gray-400 font-semibold mb-1">
                          Bàn {deskIdx}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[1, 2].map(seatIdx => {
                            const seatKey = `${colIdx}_${deskIdx}_${seatIdx}`;
                            const studentId = localSeats[seatKey];
                            const student = students.find(s => s.id === studentId);
                            const isSelected = selectedSeatKey === seatKey;

                            return (
                              <div
                                key={seatKey}
                                onClick={() => {
                                  if (role === 'teacher') setSelectedSeatKey(seatKey);
                                }}
                                className={`p-2 rounded-lg text-center transition-all min-h-[50px] flex flex-col items-center justify-center ${
                                  student
                                    ? 'bg-pink-100/70 border border-pink-300 text-pink-900'
                                    : 'bg-gray-50 border border-dashed border-gray-200 text-gray-400'
                                } ${role === 'teacher' ? 'cursor-pointer hover:border-pink-500' : ''} ${
                                  isSelected ? 'ring-2 ring-pink-500 shadow-sm' : ''
                                }`}
                              >
                                {student ? (
                                  <>
                                    <span className="font-bold text-[11px] line-clamp-1 uppercase">
                                      {student.fullName}
                                    </span>
                                    <span className="text-[9px] text-pink-600 font-mono">
                                      {student.code}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-medium italic">Chỗ trống</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Seat Assignment Modal/Drawer for Selected Seat */}
            {selectedSeatKey && role === 'teacher' && (
              <div className="mt-6 p-4 rounded-2xl bg-pink-50 border border-pink-200 max-w-lg mx-auto">
                <div className="flex items-center justify-between pb-2 border-b border-pink-200 mb-3">
                  <h4 className="font-bold text-sm text-pink-900">
                    Xếp học sinh vào vị trí: Dãy {selectedSeatKey.split('_')[0]}, Bàn{' '}
                    {selectedSeatKey.split('_')[1]}, Chỗ {selectedSeatKey.split('_')[2]}
                  </h4>
                  <button
                    onClick={() => setSelectedSeatKey(null)}
                    className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    Đóng
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                      onChange={e => handleAssignSeat(selectedSeatKey, e.target.value || null)}
                      defaultValue={localSeats[selectedSeatKey] || ''}
                    >
                      <option value="">-- Để trống chỗ ngồi này --</option>
                      {students.map(s => {
                        // Check if student is seated elsewhere
                        const seatedKey = Object.entries(localSeats).find(
                          ([k, v]) => v === s.id && k !== selectedSeatKey
                        )?.[0];
                        return (
                          <option key={s.id} value={s.id}>
                            {s.fullName} ({s.code}) {seatedKey ? `[Đã ngồi ${seatedKey}]` : ''}
                          </option>
                        );
                      })}
                    </select>

                    {localSeats[selectedSeatKey] && (
                      <button
                        onClick={() => handleAssignSeat(selectedSeatKey, null)}
                        className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100"
                      >
                        Bỏ xếp chỗ
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    * Nếu chọn học sinh đang ngồi ở vị trí khác, hệ thống sẽ tự động chuyển bạn sang vị trí mới này (không bị trùng chỗ).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VINH DANH & THI ĐUA */}
      {activeSubTab === 'honors' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-pink-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Bảng Vàng Danh Dự & Thi Đua Lớp {classSettings.className}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Vinh danh Top 5 học tập theo ĐTB tháng và Khen thưởng nề nếp thi đua
                  </p>
                </div>
              </div>

              {role === 'teacher' && (
                <button
                  onClick={handlePublishHonors}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-xs transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Công bố Top 5 {currentMonth}</span>
                </button>
              )}
            </div>

            {/* Top 5 Academic Section */}
            <div className="mt-6">
              <h4 className="font-bold text-sm text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>🌟 TOP 5 HỌC SINH CÓ ĐIỂM TRUNG BÌNH CAO NHẤT ({currentMonth})</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {top5Academic.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-gray-400 text-xs">
                    Chưa có điểm môn học để tính bảng vàng tháng này.
                  </div>
                ) : (
                  top5Academic.map(({ student, gpa }, idx) => (
                    <div
                      key={student.id}
                      className="bg-gradient-to-b from-white to-pink-50/50 rounded-2xl p-4 border border-pink-200 shadow-xs flex flex-col items-center text-center relative overflow-hidden"
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mb-2 ${
                          idx === 0
                            ? 'bg-amber-400 text-white shadow-sm ring-4 ring-amber-100'
                            : idx === 1
                            ? 'bg-gray-300 text-gray-800'
                            : idx === 2
                            ? 'bg-amber-600 text-white'
                            : 'bg-pink-200 text-pink-800'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <h5 className="font-bold text-xs uppercase text-gray-900 mt-1 line-clamp-1">
                        {student.fullName}
                      </h5>
                      <span className="text-[10px] text-gray-400 font-mono">{student.code}</span>
                      <div className="mt-3 px-3 py-1 rounded-xl bg-pink-600 text-white font-extrabold text-sm shadow-xs">
                        ĐTB: {gpa?.toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Conduct Honors Section */}
            <div className="mt-10 pt-6 border-t border-pink-100">
              <h4 className="font-bold text-sm text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>🎖️ GƯƠNG MẪU NỀ NẾP & PHONG TRÀO THI ĐUA</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {students.slice(0, 3).map((st, i) => (
                  <div
                    key={st.id}
                    className="p-4 rounded-2xl bg-white border border-pink-100 shadow-xs flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs uppercase text-gray-900">{st.fullName}</h5>
                      <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                        Tích cực nề nếp & phong trào
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT POST MODAL */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 border border-pink-100 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg mb-4">
              {editingPostId ? 'Chỉnh sửa bài viết' : 'Đăng thông báo mới'}
            </h3>

            {postError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {postError}
              </div>
            )}

            <form onSubmit={handleSavePost} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Tiêu đề thông báo *
                </label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={e => setPostTitle(e.target.value)}
                  placeholder="Ví dụ: Kế hoạch tuần 7, Nhắc nhở họp phụ huynh..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nội dung chi tiết *
                </label>
                <textarea
                  rows={4}
                  required
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  placeholder="Nhập nội dung bài viết..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Ảnh hoặc Video từ máy tính
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-pink-100 file:text-pink-700 hover:file:bg-pink-200"
                />
                {postMediaUrl && (
                  <div className="mt-2 text-xs text-emerald-600 flex items-center justify-between">
                    <span>Đã đính kèm tệp ({postMediaType})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPostMediaUrl('');
                        setPostMediaType('');
                      }}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Gỡ tệp
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Đường dẫn YouTube
                </label>
                <input
                  type="url"
                  value={postYoutubeUrl}
                  onChange={e => setPostYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Đường dẫn Google Drive
                </label>
                <input
                  type="url"
                  value={postDriveUrl}
                  onChange={e => setPostDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postPinned}
                    onChange={e => setPostPinned(e.target.checked)}
                    className="w-4 h-4 text-pink-600 rounded-md border-gray-300 focus:ring-pink-500"
                  />
                  <span>Ghim lên đầu bảng tin</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postPublished}
                    onChange={e => setPostPublished(e.target.checked)}
                    className="w-4 h-4 text-pink-600 rounded-md border-gray-300 focus:ring-pink-500"
                  />
                  <span>Công bố cho học sinh xem</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 rounded-xl shadow-xs"
                >
                  {editingPostId ? 'Cập nhật bài viết' : 'Đăng bài'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
