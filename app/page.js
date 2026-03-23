'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import CourseUploader from '@/components/CourseUploader';
import SchedulingForm from '@/components/SchedulingForm';
import LessonWizard from '@/components/LessonWizard';
import SettingsModal from '@/components/SettingsModal';
import SessionPreviewModal from '@/components/SessionPreviewModal';
import AILandingConfig from '@/components/AILandingConfig';
import SyllabusPreviewTable from '@/components/SyllabusPreviewTable';
import { UploadCloud, Calendar as CalendarIcon, Zap, CheckCircle2, Clock, ArrowRight, Settings, Library, Loader2, PlayCircle, ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  
  const [aiConfig, setAiConfig] = useState(null);
  const [courseData, setCourseData] = useState(null);
  const [setupStep, setSetupStep] = useState('upload'); // upload, preview, config, hub
  const [parsedSyllabus, setParsedSyllabus] = useState([]);
  
  const [selectedSession, setSelectedSession] = useState(null);
  const [previewSession, setPreviewSession] = useState(null); // New for Green cards
  const [showConfig, setShowConfig] = useState(false); 
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setIsClient(true);
    try {
      const storedConfig = localStorage.getItem('giao_an_io_config');
      if (storedConfig) setAiConfig(JSON.parse(storedConfig));
      
      const storedCourse = localStorage.getItem('courseTimetable');
      if (storedCourse) {
        const parsed = JSON.parse(storedCourse);
        setCourseData(parsed);
        if (parsed.schedule) setSetupStep('hub');
        else if (parsed.lessons) {
          setParsedSyllabus(parsed.lessons);
          setSetupStep('config');
        }
      }
    } catch (e) {
      console.warn("Storage parse error", e);
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;
    if (aiConfig) localStorage.setItem('giao_an_io_config', JSON.stringify(aiConfig));
    if (courseData) localStorage.setItem('courseTimetable', JSON.stringify(courseData));
  }, [aiConfig, courseData, isClient]);

  const handleCourseAnalyzed = (lessons) => {
    setParsedSyllabus(lessons);
    setSetupStep('preview');
  };

  const handlePreviewConfirm = () => {
    setSetupStep('config');
  };

  const handleScheduleComplete = (sessions) => {
    setCourseData({ lessons: parsedSyllabus, schedule: sessions });
    setSetupStep('hub');
  };

  const handleWizardComplete = (sessionId, generatedLesson, wizardData) => {
    setCourseData(prev => {
      const updatedSchedule = prev.schedule.map(sess => {
        if (sess.id === sessionId) {
          return { ...sess, status: 'completed', generatedLesson, wizardData };
        }
        return sess;
      });
      return { ...prev, schedule: updatedSchedule };
    });
    
    // Đóng Modal
    setSelectedSession(null);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const clearCourse = () => {
    if (confirm("Bạn có chắc muốn xóa lịch trình hiện tại và tạo lại từ đầu?")) {
      setCourseData(null);
      setParsedSyllabus([]);
      setSetupStep('upload');
      localStorage.removeItem('courseTimetable');
    }
  };

  // Định dạng ngày theo yêu cầu: Thứ X, DD/MM/YYYY
  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const dayOfWeekStr = d.toLocaleDateString('vi-VN', { weekday: 'long' });
    const capitalizedDay = dayOfWeekStr.charAt(0).toUpperCase() + dayOfWeekStr.slice(1);
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${capitalizedDay}, ${dateStr}`;
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
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

  if (courseData && courseData.schedule) {
    totalSessions = courseData.schedule.length;
    const now = new Date('2026-03-23T00:17:29'); // Use provided current time

    courseData.schedule.forEach(s => {
      totalPeriods += (s.totalPeriods || 0);
      
      const sessionDate = new Date(s.date);
      const diffTime = sessionDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (s.status === 'completed') {
        completedPeriods += (s.totalPeriods || 0);
        completedSessions++;
        countCompleted++;
      } else {
        if (diffDays <= 2) {
          countWarning++;
        } else {
          countPending++;
        }
        if (!upNextSession) upNextSession = s;
      }
    });
  }

  const progressPercent = totalPeriods > 0 ? (completedPeriods / totalPeriods) * 100 : 0;

  // --- RENDER LOGIC ---
  if (!aiConfig) {
    return <AILandingConfig onComplete={setAiConfig} />;
  }

  return (
    <div className="min-h-screen relative font-sans text-slate-100 overflow-x-hidden bg-[#0B0F19]">
      {/* Cảnh nền động Glassmorphism - Cosmic Gradient */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-blob"></div>
        <div className="absolute top-[30%] right-[-10%] w-[40vw] h-[40vw] bg-violet-600/20 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] bg-emerald-600/10 rounded-full blur-[150px] mix-blend-screen animate-blob animation-delay-4000"></div>
      </div>

      {/* FIXED LESSON WIZARD MODAL (FULLSCREEN OVERLAY) */}
      {selectedSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-2xl p-4 md:p-6 overflow-y-auto">
          <div className="w-full h-full max-w-7xl mx-auto rounded-[32px] overflow-hidden shadow-2xl animate-fade-in flex flex-col bg-white/90">
            <div className="flex-1 overflow-y-auto w-full h-full relative p-6">
              <LessonWizard 
                aiConfig={aiConfig}
                setAiConfig={setAiConfig}
                sessionData={{
                  id: selectedSession.id,
                  title: selectedSession.contents.map(c => {
                    const isPartial = c.originalLesson && c.periods < (c.originalLesson.totalPeriods || c.originalLesson.soTiet || 0);
                    return isPartial ? `${c.lessonName} (một phần)` : c.lessonName;
                  }).join(' & '),
                  periods: selectedSession.totalPeriods,
                  totalMinutes: selectedSession.totalPeriods * 45
                }}
                courseData={courseData}
                onComplete={handleWizardComplete}
                onCancel={() => setSelectedSession(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* AI CONFIG MODAL (RE-CONFIGURE) */}
      <SettingsModal 
        isOpen={showConfig} 
        onClose={() => setShowConfig(false)}
        aiConfig={aiConfig}
        setAiConfig={setAiConfig}
        showToast={showToast}
      />

      <SessionPreviewModal
        isOpen={!!previewSession}
        onClose={() => setPreviewSession(null)}
        session={previewSession}
      />

      {/* MAIN CONTENT LAYER */}
      <div className="relative z-10 min-h-screen">
        <Header />

        <main className="max-w-7xl mx-auto w-full px-4 pt-6 pb-20">
          <div className="animate-fade-in">
            
            {/* STEP 1: Upload */}
            {setupStep === 'upload' && (
              <div className="max-w-3xl mx-auto mt-12 bg-white/10 backdrop-blur-3xl rounded-[32px] p-2 border border-white/10 shadow-[0_8px_32px_rgb(0,0,0,0.3)]">
                <CourseUploader apiKey={aiConfig?.apiKey} modelType={aiConfig?.modelType} onCourseAnalyzed={handleCourseAnalyzed} />
              </div>
            )}

            {/* STEP 2: Preview Table */}
            {setupStep === 'preview' && (
              <div className="mt-8">
                <SyllabusPreviewTable 
                  lessons={parsedSyllabus} 
                  onConfirm={handlePreviewConfirm} 
                  onCancel={() => setSetupStep('upload')} 
                />
              </div>
            )}

            {/* STEP 3: Schedule Config */}
            {setupStep === 'config' && (
              <div className="max-w-3xl mx-auto mt-12 bg-white/10 backdrop-blur-3xl rounded-[32px] p-2 border border-white/10 shadow-[0_8px_32px_rgb(0,0,0,0.3)]">
                <div className="p-4 border-b border-white/10 flex items-center justify-between mb-2">
                   <button onClick={() => setSetupStep('preview')} className="text-xs font-bold text-slate-400 flex items-center gap-1 hover:text-white transition-colors">
                      <ArrowLeft className="w-3 h-3" /> Quay lại Bảng duyệt
                   </button>
                   <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Bước 3: Cấu hình thời gian</span>
                </div>
                <SchedulingForm lessons={parsedSyllabus} onScheduleComplete={handleScheduleComplete} />
              </div>
            )}

            {/* STEP 4: Smart Hub (CONTROL CENTER) */}
            {setupStep === 'hub' && courseData && courseData.schedule && (
              <div className="flex flex-col gap-6">
                
                {/* DÒNG 1: BENTO WIDGETS */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  
                  {/* WIDGET 1: OVERVIEW & STATS (Span 2) */}
                  <div className="md:col-span-2 lg:col-span-2 bg-white/5 backdrop-blur-2xl rounded-[32px] border border-white/10 shadow-[0_8px_32px_rgb(0,0,0,0.2)] p-6 md:p-8 flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 group-hover:bg-indigo-500/30 transition-all duration-700"></div>
                    <div className="relative z-10">
                      <h2 className="text-3xl font-black text-white tracking-tight mb-1">Xin chào, Thầy/Cô! 👋</h2>
                      <p className="text-slate-400 text-sm font-medium mb-8">Trung tâm điều khiển Smart Timetable</p>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-end text-sm">
                          <span className="font-bold text-slate-300">Tiến độ học kỳ</span>
                          <span className="font-black text-indigo-400 text-lg">{completedPeriods}/{totalPeriods} <span className="text-xs font-normal text-slate-500">tiết</span></span>
                        </div>
                        <div className="w-full bg-slate-800/50 h-3 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000 relative overflow-hidden" 
                            style={{ width: `${progressPercent}%` }}
                          >
                            <div className="absolute top-0 inset-x-0 h-full w-full bg-white/20 -skew-x-12 -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8 relative z-10">
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-white leading-none mb-1">{totalSessions}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest text-center">Tổng số<br/>Giáo án</span>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-emerald-400 leading-none mb-1">{completedSessions}</span>
                        <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest text-center">Đã Đúc<br/>Hoàn tất</span>
                      </div>
                    </div>
                  </div>

                  {/* WIDGET 2: UP NEXT (Span 1) */}
                  <div className="md:col-span-1 lg:col-span-1 bg-gradient-to-br from-indigo-900/40 to-slate-900/40 backdrop-blur-2xl rounded-[32px] border border-indigo-500/30 shadow-[0_8px_32px_rgb(0,0,0,0.3)] p-6 flex flex-col justify-between relative overflow-hidden ring-1 ring-inset ring-white/10">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/40 rounded-full blur-[50px]"></div>
                    <div className="relative z-10 flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30">
                        <PlayCircle className="w-4 h-4 text-indigo-400" />
                      </div>
                      <span className="text-xs font-black text-indigo-300 uppercase tracking-widest">Up Next</span>
                    </div>

                    {upNextSession ? (
                      <div className="relative z-10 mt-auto flex flex-col h-full justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-2">{formatDate(upNextSession.date)}</p>
                          <h3 className="font-bold text-white text-base leading-snug line-clamp-3 mb-4">
                            {upNextSession.contents.map(c => c.lessonName).join(' & ')}
                          </h3>
                        </div>
                        <button 
                          onClick={() => setSelectedSession(upNextSession)}
                          className="w-full mt-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 group relative overflow-hidden"
                        >
                          {/* Pulse effect background */}
                          <div className="absolute inset-0 bg-white/20 rounded-2xl animate-pulse"></div>
                          <Zap className="w-5 h-5 text-indigo-100 relative z-10 group-hover:scale-110 transition-transform" /> 
                          <span className="relative z-10">Soạn Nhanh</span>
                        </button>
                      </div>
                    ) : (
                      <div className="relative z-10 mt-auto text-center py-6">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-300">Đã hoàn thành toàn bộ!</p>
                      </div>
                    )}
                  </div>

                  {/* WIDGET 3: QUICK ACTIONS (Span 1) */}
                  <div className="md:col-span-3 lg:col-span-1 grid grid-cols-3 lg:grid-cols-1 gap-4">
                    <button 
                      onClick={clearCourse}
                      className="bg-white/5 hover:bg-white/10 backdrop-blur-2xl rounded-[24px] border border-white/5 shadow-glass p-4 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                        <UploadCloud className="w-5 h-5 text-rose-400" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center leading-tight mt-1">Hủy &<br/>Upload Lại</span>
                    </button>

                    <button 
                      onClick={() => setShowConfig(true)}
                      className="bg-white/5 hover:bg-white/10 backdrop-blur-2xl rounded-[24px] border border-white/5 shadow-glass p-4 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center group-hover:bg-slate-500/20 transition-colors">
                        <Settings className="w-5 h-5 text-slate-300" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center leading-tight mt-1">Cài đặt<br/>AI</span>
                    </button>

                    <button 
                      onClick={() => alert("Thư viện giáo án đang được hoàn thiện.")}
                      className="bg-white/5 hover:bg-white/10 backdrop-blur-2xl rounded-[24px] border border-white/5 shadow-glass p-4 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                        <Library className="w-5 h-5 text-emerald-400" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center leading-tight mt-1">Thư viện<br/>Giáo án</span>
                    </button>
                  </div>
                </div>

                {/* DÒNG 2: SMART HUB CALENDAR GRID */}
                <div className="bg-white/5 backdrop-blur-2xl rounded-[32px] border border-white/10 shadow-[0_8px_32px_rgb(0,0,0,0.2)] p-6 md:p-8 mt-4 overflow-hidden relative">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-6 h-6 text-indigo-400" />
                      <h2 className="text-xl font-black text-white tracking-tight uppercase">Smart Hub Calendar</h2>
                    </div>
                    <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest bg-white/5 px-6 py-3 rounded-full border border-white/10 group-hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> {countCompleted} Hoạt động</div>
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div> {countWarning} Cần chú ý</div>
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div> {countPending} Chờ xử lý</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                    {courseData.schedule.map((session, idx) => {
                      const sessionDate = new Date(session.date);
                      const now = new Date('2026-03-23T00:17:29');
                      const diffDays = Math.ceil((sessionDate - now) / (1000 * 60 * 60 * 24));
                      
                      let status = "pending";
                      if (session.status === 'completed') status = "completed";
                      else if (diffDays <= 2) status = "warning";

                      const config = {
                        completed: {
                          card: "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
                          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
                          text: "text-emerald-100",
                          sub: "text-emerald-500/70",
                          label: "Đã hoàn tất"
                        },
                        warning: {
                          card: "bg-orange-500/15 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)] animate-pulse",
                          icon: <Zap className="w-5 h-5 text-orange-400" />,
                          text: "text-orange-100",
                          sub: "text-orange-500/70",
                          label: "Cần chú ý"
                        },
                        pending: {
                          card: "bg-white/5 border-white/10 hover:bg-white/10 hover:-translate-y-1 transition-all",
                          icon: <Clock className="w-5 h-5 text-slate-500" />,
                          text: "text-slate-300",
                          sub: "text-slate-500",
                          label: "Chờ xử lý"
                        }
                      }[status] || { card: "", icon: null, text: "", sub: "", label: "" };

                      return (
                        <div 
                          key={session.id}
                          onClick={() => {
                            if (status === 'completed') setPreviewSession(session);
                            else setSelectedSession(session);
                          }}
                          className={`group relative backdrop-blur-xl rounded-[28px] border p-5 cursor-pointer flex flex-col justify-between overflow-hidden transition-all active:scale-[0.98] ${config.card}`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className={`p-2 rounded-2xl bg-white/5 border border-white/10`}>
                              {config.icon}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-tighter opacity-70 ${config.sub}`}>{config.label}</span>
                          </div>
                          
                          <div className="flex-1">
                            <p className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${config.sub}`}>
                              {formatDate(session.date)}
                            </p>
                            <h4 className={`text-sm font-black leading-tight line-clamp-2 ${config.text}`}>
                              {session.contents.map(c => c.lessonName).join(' & ')}
                            </h4>
                            
                            {/* LT/TH Badges */}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {session.contents.map((content, idx) => (
                                <div key={idx} className="flex flex-wrap gap-1">
                                  {content.tietLT > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-200 text-[9px] font-bold border border-blue-400/20 backdrop-blur-sm">
                                      {content.tietLT} tiết LT
                                    </span>
                                  )}
                                  {content.tietTH > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-200 text-[9px] font-bold border border-amber-400/20 backdrop-blur-sm">
                                      {content.tietTH} tiết TH/KT
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className={`text-[10px] font-bold ${config.sub}`}>
                              Tổng {session.totalPeriods} tiết • {session.totalPeriods * 45} phút
                            </span>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-white/5 border border-white/10 group-hover:bg-white/20 transition-all`}>
                              <ArrowRight className="w-3.5 h-3.5 text-white/50" />
                            </div>
                          </div>

                          {/* Hover effect light */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-3xl shadow-2xl backdrop-blur-3xl border border-white/20 animate-in slide-in-from-bottom-10 duration-500 flex items-center gap-3 ${
          toast.type === 'error' ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'
        }`}>
          {toast.type === 'error' ? <Zap className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          <p className="font-bold text-sm tracking-tight">{toast.message}</p>
        </div>
      )}
    </div>
  );
}
