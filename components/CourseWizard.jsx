'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { 
  KeyRound, BookOpen, UploadCloud, Table, Calendar, 
  Sparkles, ChevronRight, ChevronLeft, Loader2, CheckCircle2, 
  Settings, Bot, Zap, ArrowRight, Save
} from 'lucide-react';
import CourseUploader from '@/components/CourseUploader';
import SyllabusPreviewTable from '@/components/SyllabusPreviewTable';
import SchedulingForm from '@/components/SchedulingForm';
import { generateTimetable } from '@/app/utils/scheduler';

const MODELS = [
  { id: 'gemini-1.5-flash', modelId: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (⚡ Gợi ý)', icon: '⚡' },
  { id: 'gemini-1.5-pro',   modelId: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro (🧠 Chi tiết)',     icon: '🧠' },
];

export default function CourseWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState(null);

  // Data states
  const [apiKey, setApiKey] = useState('');
  const [courseName, setCourseName] = useState('');
  const [syllabus, setSyllabus] = useState([]);
  const [scheduleConfig, setScheduleConfig] = useState(null);
  const [modelType, setModelType] = useState('gemini-1.5-flash');
  const [finalSchedule, setFinalSchedule] = useState(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        // Load existing API Key if any
        loadSettings(user.uid);
      }
    });
    return () => unsub();
  }, []);

  const loadSettings = async (uid) => {
    try {
      const docRef = doc(db, 'users', uid, 'settings', 'ai_config');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setApiKey(data.apiKey || '');
        if (data.modelType) setModelType(data.modelType);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', userId, 'settings', 'ai_config'), {
        apiKey: apiKey.trim(),
        modelType,
        updatedAt: new Date().toISOString()
      });
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseAnalyzed = (lessons) => {
    setSyllabus(lessons);
    setStep(4);
  };

  const handleScheduleComplete = async (startDate, dayConfigs, holidayList) => {
    setLoading(true);
    setError('');
    // Client-side AbortController removed for stability

    try {
      const res = await fetch('/api/schedule-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syllabus,
          startDate,
          dayConfigs,
          holidayList,
          apiKey,
          modelId: MODELS.find(m => m.id === modelType)?.modelId || 'gemini-1.5-flash'
        })
      });

      const data = await res.json();
      // No timeout clearance needed
      if (!res.ok) throw new Error(data.error || "Không thể xếp lịch bằng AI.");

      setFinalSchedule({ sessions: data.sessions, config: { startDate, dayConfigs, holidayList } });
      setStep(6);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const finalizeCourse = async () => {
    setLoading(true);
    try {
      const courseRef = await addDoc(collection(db, 'users', userId, 'courses'), {
        name: courseName,
        syllabus: syllabus,
        schedule: finalSchedule.sessions,
        config: finalSchedule.config,
        createdAt: new Date().toISOString(),
        status: 'active'
      });
      onComplete(courseRef.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: 'API Key', icon: KeyRound },
    { title: 'Thông tin', icon: BookOpen },
    { title: 'Tải Đề cương', icon: UploadCloud },
    { title: 'Kiểm duyệt', icon: Table },
    { title: 'Lịch dạy', icon: Calendar },
    { title: 'Hoàn tất', icon: CheckCircle2 }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto py-10 px-6">
      {/* Stepper Header */}
      <div className="flex justify-between items-center mb-12 relative">
        <div className="absolute top-5 left-0 w-full h-0.5 bg-white/5 -z-10"></div>
        <div className="absolute top-5 left-0 h-0.5 bg-indigo-500 transition-all duration-500 -z-10" style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}></div>
        
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === i + 1;
          const isPast = step > i + 1;
          return (
            <div key={i} className="flex flex-col items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-110 shadow-lg shadow-indigo-500/40' : 
                isPast ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'
              }`}>
                {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                {s.title}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs py-4 px-6 rounded-3xl mb-8 font-bold flex items-center gap-3">
          <Zap className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl glass-effect min-h-[400px] flex flex-col justify-center animate-fade-in relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/10 transition-all"></div>

        {step === 1 && (
          <div className="space-y-8 animate-slide-up">
            <div className="text-center">
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Thiết lập bộ não AI</h2>
              <p className="text-slate-400 font-medium">Chọn model và nhập Gemini API Key để bắt đầu.</p>
            </div>

            {/* Model Selection Dropdown */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">1. Chọn Model AI</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModelType(m.id)}
                    className={`flex items-center gap-3 px-6 py-4 rounded-3xl border transition-all text-left ${
                      modelType === m.id 
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-2 ring-indigo-500/20' 
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xl">{m.icon}</span>
                    <span className="font-bold text-sm tracking-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">2. Nhập API Key</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Dán API Key của bạn vào đây..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-3xl px-8 py-6 text-white text-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600"
                />
                <KeyRound className="absolute right-8 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
              </div>
            </div>

            <button
              onClick={saveApiKey}
              disabled={!apiKey || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 group"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> <span>LƯU CẤU HÌNH & TIẾP TỤC</span> <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-slide-up">
            <div className="text-center">
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Thông tin Môn học</h2>
              <p className="text-slate-400 font-medium">Bạn đang chuẩn bị giáo án cho môn học nào?</p>
            </div>
            <input
              type="text"
              placeholder="VD: Kỹ Thuật Máy Quay, Tin Học... "
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-3xl px-8 py-6 text-white text-xl font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600"
            />
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-5 rounded-3xl transition-all">Quay lại</button>
              <button
                onClick={() => setStep(3)}
                disabled={!courseName}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 group"
              >
                <span>TIẾP THEO</span> <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-slide-up">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Tải Chương trình</h2>
              <p className="text-slate-400 font-medium">AI sẽ bóc tách các bài học từ file đề cương của bạn.</p>
            </div>
            <CourseUploader 
              apiKey={apiKey} 
              modelId={MODELS.find(m => m.id === modelType)?.modelId || modelType}
              onCourseAnalyzed={handleCourseAnalyzed} 
              onCancel={() => setStep(2)} 
              onOpenSettings={() => setStep(1)}
            />
          </div>
        )}

        {step === 4 && (
          <div className="animate-slide-up max-w-[100%] overflow-x-auto">
            <SyllabusPreviewTable 
              lessons={syllabus} 
              onConfirm={(updated) => { setSyllabus(updated); setStep(5); }} 
              onCancel={() => setStep(3)} 
              onChange={setSyllabus}
            />
          </div>
        )}

        {step === 5 && (
          <div className="animate-slide-up">
            <div className="mb-8 text-center text-white">
              <h2 className="text-3xl font-black tracking-tight mb-2 flex items-center justify-center gap-3">
                <Calendar className="w-8 h-8 text-indigo-400" /> Cấu hình Lịch dạy
              </h2>
            </div>
            <SchedulingForm 
              lessons={syllabus} 
              onScheduleComplete={handleScheduleComplete} 
            />
            <button onClick={() => setStep(4)} className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all">Quay lại bảng duyệt</button>
          </div>
        )}

        {step === 6 && finalSchedule && (
          <div className="space-y-8 animate-slide-up text-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Tuyệt vời! Lịch đã sẵn sàng</h2>
            <p className="text-slate-400 font-medium max-w-md mx-auto">
              Hệ thống đã phân bổ <strong>{finalSchedule.sessions.length} buổi dạy</strong> dựa trên chương trình của bạn. 
              Mọi dữ liệu sẽ được lưu trữ an toàn trong tài khoản SaaS của bạn.
            </p>
            
            <div className="bg-white/5 rounded-3xl p-6 border border-white/5 text-left space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Môn học:</span>
                <span className="text-white font-bold">{courseName}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Tổng số bài:</span>
                <span className="text-white font-bold">{syllabus.length} bài</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Ngày bắt đầu:</span>
                <span className="text-white font-bold">{new Date(finalSchedule.config.startDate).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>

            <button
              onClick={finalizeCourse}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-6 rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 group"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Zap className="w-6 h-6" /> <span>CHUYỂN SANG TRẠM ĐIỀU KHIỂN (SMART HUB)</span> <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
