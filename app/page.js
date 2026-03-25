"use client";

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import Header from '@/components/Header';
import SettingsModal from '@/components/SettingsModal';
import SessionPreviewModal from '@/components/SessionPreviewModal';
import Login from '@/components/Login';
import CourseWizard from '@/components/CourseWizard';
import InteractiveLessonBuilder from '@/components/InteractiveLessonBuilder';
import { 
  UploadCloud, Calendar as CalendarIcon, Zap, CheckCircle2, Clock, 
  ArrowRight, Settings, Library, Loader2, PlayCircle, ArrowLeft, 
  BookOpen, ChevronRight, LogOut, Sparkles
} from 'lucide-react';
export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [aiConfig, setAiConfig] = useState(null);
  const [activeCourse, setActiveCourse] = useState(null);
  
  const [selectedSession, setSelectedSession] = useState(null);
  const [previewSession, setPreviewSession] = useState(null);
  const [showConfig, setShowConfig] = useState(false); 
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setIsClient(true);
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await refreshUserData(currentUser.uid);
      } else {
        setAiConfig(null);
        setActiveCourse(null);
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, []);

  const refreshUserData = async (uid) => {
    try {
      const configRef = doc(db, 'users', uid, 'settings', 'ai_config');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        setAiConfig(configSnap.data());
      }
      const coursesRef = collection(db, 'users', uid, 'courses');
      const q = query(coursesRef, where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const courseDoc = querySnapshot.docs[0];
        setActiveCourse({ id: courseDoc.id, ...courseDoc.data() });
      } else {
        setActiveCourse(null);
      }
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  };

  const handleWizardComplete = async (courseId) => {
    if (user) await refreshUserData(user.uid);
  };

  const handleLessonGenerationComplete = async (sessionId, generatedLesson, wizardData) => {
    if (!user || !activeCourse) return;

    try {
      const updatedSchedule = activeCourse.schedule.map(sess => {
        if (sess.id === sessionId) {
          return { ...sess, status: 'completed', generatedLesson, wizardData };
        }
        return sess;
      });

      const courseRef = doc(db, 'users', user.uid, 'courses', activeCourse.id);
      await updateDoc(courseRef, { schedule: updatedSchedule });
      
      setActiveCourse(prev => ({ ...prev, schedule: updatedSchedule }));
      setSelectedSession(null);
      showToast("Đã hoàn thành giáo án và cập nhật lịch trình!");
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const clearCourse = async () => {
    if (confirm("Hệ thống sẽ lưu trữ môn cũ và cho phép bạn tạo lộ trình mới. Tiếp tục?")) {
      try {
        const courseRef = doc(db, 'users', user.uid, 'courses', activeCourse.id);
        await updateDoc(courseRef, { status: 'archived' });
        setActiveCourse(null);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const dayOfWeekStr = d.toLocaleDateString('vi-VN', { weekday: 'long' });
    const capitalizedDay = dayOfWeekStr.charAt(0).toUpperCase() + dayOfWeekStr.slice(1);
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${capitalizedDay}, ${dateStr}`;
  };

  if (!isClient || loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
          <p className="text-slate-500 font-black tracking-widest text-[10px] uppercase">Đang tải dữ liệu SaaS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!activeCourse) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center py-10">
        <div className="w-full max-w-7xl flex justify-end px-6 mb-4">
           <button onClick={() => auth.signOut()} className="text-xs font-bold text-slate-500 hover:text-white flex items-center gap-2 transition-colors">
              <LogOut className="w-3 h-3" /> Đăng xuất ({user.email})
           </button>
        </div>
        <CourseWizard onComplete={handleWizardComplete} />
      </div>
    );
  }

  // --- BENTO GRID COMPUTATIONS ---
  let totalPeriods = 0;
  let completedPeriods = 0;
  let totalSessions = 0;
  let completedSessions = 0;
  let upNextSession = null;
  let countCompleted = 0;
  let countWarning = 0;
  let countPending = 0;

  if (activeCourse && activeCourse.schedule) {
    totalSessions = activeCourse.schedule.length;
    const now = new Date(); 

    activeCourse.schedule.forEach(s => {
      totalPeriods += (s.totalPeriods || 0);
      
      const sessionDate = new Date(s.date);
      const diffTime = sessionDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (s.status === 'completed') {
        completedPeriods += (s.totalPeriods || 0);
        completedSessions++;
        countCompleted++;
      } else {
        if (diffDays <= 2) countWarning++;
        else countPending++;
        if (!upNextSession) upNextSession = s;
      }
    });
  }

  const progressPercent = totalPeriods > 0 ? (completedPeriods / totalPeriods) * 100 : 0;

  return (
    <div className="min-h-screen relative font-sans text-slate-100 overflow-x-hidden bg-[#0B0F19]">
      {/* Dynamic Cosmic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-blob"></div>
        <div className="absolute top-[30%] right-[-10%] w-[40vw] h-[40vw] bg-violet-600/20 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] bg-emerald-600/10 rounded-full blur-[150px] mix-blend-screen animate-blob animation-delay-4000"></div>
      </div>

      {/* INTERACTIVE LESSON BUILDER MODAL */}
      {selectedSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xl p-0 overflow-hidden">
          <div className="w-full h-full max-w-full mx-auto animate-in zoom-in-95 duration-300 flex flex-col bg-[#0B0F19] relative shadow-2xl">
              <InteractiveLessonBuilder 
                aiConfig={aiConfig}
                sessionData={{
                  id: selectedSession.id,
                  title: selectedSession.contents.map(c => c.subItem || c.lessonName).join(', '),
                  periods: selectedSession.totalPeriods,
                  totalMinutes: Math.round(selectedSession.totalPeriods * 45),
                  topics: selectedSession.contents.map(c => c.subItem).filter(Boolean)
                }}
                courseData={activeCourse}
                onComplete={handleLessonGenerationComplete}
                onCancel={() => setSelectedSession(null)}
              />
          </div>
        </div>
      )}

      <SettingsModal 
        isOpen={showConfig} 
        onClose={() => setShowConfig(false)}
        aiConfig={aiConfig}
        setAiConfig={(newConfig) => {
          setAiConfig(newConfig);
          if (user) {
            const configRef = doc(db, 'users', user.uid, 'settings', 'ai_config');
            if (newConfig) {
              setDoc(configRef, newConfig);
            } else {
              deleteDoc(configRef);
            }
          }
        }}
        showToast={showToast}
      />

      <SessionPreviewModal
        isOpen={!!previewSession}
        onClose={() => setPreviewSession(null)}
        session={previewSession}
      />

      {/* MAIN CONTENT LAYER */}
      <div className="relative z-10 min-h-screen">
        <header className="max-w-7xl mx-auto px-6 pt-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3">
               <Sparkles className="w-6 h-6 text-white" />
             </div>
             <div>
               <h1 className="text-xl font-black text-white tracking-tight">GIAOÁN I.O <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full ml-2 border border-indigo-500/30 font-bold uppercase tracking-widest">SaaS Cloud</span></h1>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{activeCourse.name} • Version 2.0</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right hidden md:block">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Đang đăng nhập</p>
               <p className="text-xs font-bold text-white">{user.email}</p>
             </div>
             <button onClick={() => auth.signOut()} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400 hover:text-rose-400 shadow-xl group">
               <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
             </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto w-full px-6 pt-10 pb-20">
          <div className="animate-fade-in flex flex-col gap-8">
            
            {/* ROW 1: BENTO WIDGETS */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              
              {/* WIDGET 1: OVERVIEW */}
              <div className="md:col-span-2 bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 shadow-2xl p-8 md:p-10 flex flex-col justify-between overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 group-hover:bg-indigo-500/20 transition-all duration-700"></div>
                <div className="relative z-10">
                  <h2 className="text-4xl font-black text-white tracking-tight mb-2">Chào mừng trở lại! ✨</h2>
                  <p className="text-slate-400 font-medium mb-10">Bạn đã hoàn thành {completedSessions} trên tổng số {totalSessions} buổi giảng dạy.</p>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-end text-sm">
                      <span className="font-black uppercase tracking-widest text-slate-500 text-[10px]">Tiến độ học kỳ</span>
                      <span className="font-black text-indigo-400 text-xl">{completedPeriods.toFixed(0)}/{totalPeriods.toFixed(0)} <span className="text-xs font-normal text-slate-600">tiết</span></span>
                    </div>
                    <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden border border-white/5 p-1">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 rounded-full transition-all duration-1000 relative" 
                        style={{ width: `${progressPercent}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-12 relative z-10">
                  <div className="bg-white/5 rounded-[28px] p-6 border border-white/5 flex flex-col">
                    <span className="text-4xl font-black text-white mb-2 leading-none">{totalSessions}</span>
                    <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest leading-tight">Buổi học<br/>Tổng thể</span>
                  </div>
                  <div className="bg-emerald-500/5 rounded-[28px] p-6 border border-emerald-500/10 flex flex-col">
                    <span className="text-4xl font-black text-emerald-400 mb-2 leading-none">{completedSessions}</span>
                    <span className="text-[10px] uppercase font-black text-emerald-600 tracking-widest leading-tight">Giáo án<br/>Hoàn tất</span>
                  </div>
                </div>
              </div>

              {/* WIDGET 2: UP NEXT */}
              <div className="bg-gradient-to-br from-indigo-600/20 to-violet-600/20 backdrop-blur-3xl rounded-[40px] border border-indigo-500/30 shadow-2xl p-8 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/30 rounded-full blur-[60px] animate-pulse"></div>
                <div className="relative z-10 flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30 group-hover:rotate-12 transition-transform">
                    <PlayCircle className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Tiếp theo</span>
                </div>

                {upNextSession ? (
                  <div className="relative z-10 mt-auto flex flex-col h-full justify-between pt-4">
                    <div>
                      <p className="text-[11px] font-black text-slate-500 mb-2 uppercase tracking-tight">{formatDate(upNextSession.date)}</p>
                      <h3 className="font-black text-white text-xl leading-snug line-clamp-3 mb-8 group-hover:text-indigo-200 transition-colors">
                        {upNextSession.contents.map(c => c.subItem || c.lessonName).join(' • ')}
                      </h3>
                    </div>
                    <button 
                      onClick={() => setSelectedSession(upNextSession)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-3xl shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 overflow-hidden relative group/btn"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
                      <Zap className="w-6 h-6 text-white group-hover:scale-110 transition-transform" /> 
                      <span>SOẠN NHANH</span>
                    </button>
                  </div>
                ) : (
                  <div className="relative z-10 mt-auto text-center py-10">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500/40 mx-auto mb-4" />
                    <p className="text-base font-black text-slate-400 tracking-tight">Mọi thứ đã xong!</p>
                  </div>
                )}
              </div>

              {/* WIDGET 3: CLOUD ACTIONS */}
              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={clearCourse}
                  className="bg-white/5 hover:bg-rose-500/10 backdrop-blur-3xl rounded-[28px] border border-white/5 p-6 flex items-center gap-5 transition-all group shadow-xl active:scale-95"
                >
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors shrink-0">
                    <UploadCloud className="w-6 h-6 text-rose-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-white uppercase tracking-tight mb-1">Môn học mới</p>
                    <p className="text-[10px] font-medium text-slate-500">Khởi tạo lộ trình khác</p>
                  </div>
                </button>

                <button 
                  onClick={() => setShowConfig(true)}
                  className="bg-white/5 hover:bg-indigo-500/10 backdrop-blur-3xl rounded-[28px] border border-white/5 p-6 flex items-center gap-5 transition-all group shadow-xl active:scale-95"
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors shrink-0">
                    <Settings className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-white uppercase tracking-tight mb-1">Cấu hình AI</p>
                    <p className="text-[10px] font-medium text-slate-500">Đổi API Key/Model</p>
                  </div>
                </button>

                <button 
                  onClick={() => alert("Cloud Library đang được đồng bộ hóa.")}
                  className="bg-white/5 hover:bg-emerald-500/10 backdrop-blur-3xl rounded-[28px] border border-white/5 p-6 flex items-center gap-5 transition-all group shadow-xl active:scale-95"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors shrink-0">
                    <Library className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-white uppercase tracking-tight mb-1">Thư viện Cloud</p>
                    <p className="text-[10px] font-medium text-slate-500">Tất cả giáo án đã lưu</p>
                  </div>
                </button>
              </div>
            </div>

            {/* ROW 2: SMART HUB CALENDAR GRID */}
            <div className="bg-white/5 backdrop-blur-3xl rounded-[48px] border border-white/10 shadow-3xl p-8 md:p-12 overflow-hidden relative group/calendar">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent blur-sm"></div>
              
              <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-hover/calendar:rotate-[-5deg] transition-transform">
                    <CalendarIcon className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight uppercase">Smart Hub Calendar</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Quản lý lộ trình giảng dạy cá nhân</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest bg-white/5 px-8 yy-4 rounded-3xl border border-white/10 p-4">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> {countCompleted} Đã đúc</div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div> {countWarning} Gấp</div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div> {countPending} Chờ</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {activeCourse.schedule.map((session) => {
                  const sessionDate = new Date(session.date);
                  const now = new Date();
                  const diffDays = Math.ceil((sessionDate - now) / (1000 * 60 * 60 * 24));
                  
                  let status = "pending";
                  if (session.status === 'completed') status = "completed";
                  else if (diffDays <= 2) status = "warning";

                  const config = {
                    completed: {
                      card: "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15 shadow-emerald-500/5",
                      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
                      text: "text-emerald-50",
                      sub: "text-emerald-500/60",
                      btn: "bg-emerald-500/20 text-emerald-300"
                    },
                    warning: {
                      card: "bg-orange-500/10 border-orange-500/40 hover:bg-orange-500/15 shadow-orange-500/10 animate-pulse-slow",
                      icon: <Zap className="w-5 h-5 text-orange-400" />,
                      text: "text-orange-50",
                      sub: "text-orange-500/70",
                      btn: "bg-orange-600 text-white"
                    },
                    pending: {
                      card: "bg-white/5 border-white/10 hover:bg-white/10 hover:-translate-y-1 transition-all",
                      icon: <Clock className="w-5 h-5 text-slate-500" />,
                      text: "text-slate-300",
                      sub: "text-slate-500",
                      btn: "bg-white/10 text-slate-300"
                    }
                  }[status] || config.pending;

                  return (
                    <div 
                      key={session.id}
                      onClick={() => status === 'completed' ? setPreviewSession(session) : setSelectedSession(session)}
                      className={`group/card relative backdrop-blur-2xl rounded-[32px] border p-6 cursor-pointer flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-2xl ${config.card}`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-6">
                           <p className={`text-[10px] font-black uppercase tracking-tight ${config.sub}`}>
                              {formatDate(session.date)}
                           </p>
                           <div className="p-1.5 rounded-xl bg-black/20">
                             {config.icon}
                           </div>
                        </div>

                        <h4 className={`text-base font-black leading-tight line-clamp-2 mb-4 group-hover/card:text-white transition-colors ${config.text}`}>
                          {session.contents.map(c => c.lessonName).join(' & ')}
                        </h4>

                        <div className="space-y-3">
                          {session.contents.map((content, sidx) => (
                            <div key={sidx} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-black/20 border border-white/5">
                               <p className={`text-[10px] font-bold leading-tight ${config.text}`}>
                                  {content.subItem || content.lessonName}
                                </p>
                                <div className="flex gap-1">
                                  {content.tietLT > 0 && <span className="px-1.5 py-0.5 rounded-lg bg-indigo-500/30 text-indigo-200 text-[8px] font-black border border-indigo-400/20">{content.tietLT.toFixed(1)} LT</span>}
                                  {content.tietTH > 0 && <span className="px-1.5 py-0.5 rounded-lg bg-emerald-500/30 text-emerald-200 text-[8px] font-black border border-emerald-400/20">{content.tietTH.toFixed(1)} TH</span>}
                                </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-black/10 flex items-center justify-between">
                         <span className={`text-[9px] font-black tracking-widest uppercase ${config.sub}`}>{Math.round(session.totalPeriods * 45)} phút</span>
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${config.btn} group-hover/card:scale-110`}>
                           <ArrowRight className="w-4 h-4" />
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-10 right-10 z-[200] px-8 py-5 rounded-[28px] shadow-3xl backdrop-blur-3xl border border-white/20 animate-in slide-in-from-bottom-20 duration-500 flex items-center gap-4 bg-[#0B0F19]/90`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${toast.type === 'error' ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
            {toast.type === 'error' ? <Zap className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          </div>
          <div>
            <p className="font-black text-sm tracking-tight text-white uppercase">{toast.type === 'error' ? 'Lỗi hệ thống' : 'Thành công'}</p>
            <p className="text-xs font-bold text-slate-400">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

