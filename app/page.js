'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import Header from '@/components/Header';
import SettingsModal from '@/components/SettingsModal';
import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';
import Step2Scheduler from '@/components/Step2Scheduler';
import Step3DataInput from '@/components/Step3DataInput';
import Step4Editor from '@/components/Step4Editor';
import Step5Execution from '@/components/Step5Execution';
import useStore from '@/app/store/useStore';
import { 
  Loader2, LogOut, Sparkles, CheckCircle2, 
  ChevronRight, Calendar, FileText, Activity, Zap 
} from 'lucide-react';

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiConfig, setAiConfig] = useState(null);
  const [showConfig, setShowConfig] = useState(false); 
  const [toast, setToast] = useState(null);

  const { currentStep, setCurrentStep, activeCourse } = useStore();

  useEffect(() => {
    setIsClient(true);
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await refreshUserData(currentUser.uid);
      } else {
        setAiConfig(null);
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
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (!isClient || loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
          <p className="text-slate-500 font-black tracking-widest text-[10px] uppercase">Đang khởi tạo Workflow...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const steps = [
    { id: 1, name: 'Quản lý', icon: LayoutGridIcon },
    { id: 2, name: 'Lập lịch', icon: Calendar },
    { id: 3, name: 'Dữ liệu', icon: FileText },
    { id: 4, name: 'Đề cương', icon: Activity },
    { id: 5, name: 'Kết quả', icon: Zap }
  ];

  return (
    <div className="min-h-screen relative font-sans text-slate-100 overflow-x-hidden bg-[#0B0F19]">
      {/* Background blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-emerald-600/10 rounded-full blur-[100px] mix-blend-screen animate-blob animation-delay-4000"></div>
      </div>

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

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* HEADER */}
        <header className="max-w-7xl mx-auto w-full px-6 pt-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3">
               <Sparkles className="w-6 h-6 text-white" />
             </div>
             <div>
               <h1 className="text-xl font-black text-white tracking-tight uppercase">GIAOÁN I.O <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full ml-2 border border-indigo-500/30 font-bold uppercase tracking-widest">Workflow 2.0</span></h1>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hệ thống Soạn giáo án Thông minh</p>
             </div>
          </div>
          
          {/* STEPPER */}
          <div className="hidden lg:flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isActive = currentStep === s.id;
              const isPast = currentStep > s.id;
              const canClick = s.id === 1 || (activeCourse !== null);
              
              return (
                <div key={s.id} className="flex items-center">
                  <button 
                    onClick={() => canClick && setCurrentStep(s.id)}
                    disabled={!canClick}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                      isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 
                      isPast ? 'text-emerald-400 hover:bg-white/5' : 
                      canClick ? 'text-slate-500 hover:bg-white/5' : 'text-slate-800 opacity-50 cursor-not-allowed'
                    } ${canClick ? 'cursor-pointer' : ''}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{s.name}</span>
                    {isPast && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                  {idx < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-800 mx-1" />}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
             <button onClick={() => setShowConfig(true)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400 flex items-center gap-2">
               <Zap className="w-5 h-5" /> <span className="hidden md:block text-xs font-bold font-black">AI CONFIG</span>
             </button>
             <button onClick={() => auth.signOut()} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400 hover:text-rose-400 shadow-xl group">
               <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
             </button>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 w-full mt-6">
          {currentStep === 1 && <Dashboard />}
          {currentStep === 2 && <Step2Scheduler />}
          {currentStep === 3 && <Step3DataInput />}
          {currentStep === 4 && <Step4Editor />}
          {currentStep === 5 && <Step5Execution aiConfig={aiConfig} />}
        </main>
      </div>

      {/* TOAST */}
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

function LayoutGridIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}
