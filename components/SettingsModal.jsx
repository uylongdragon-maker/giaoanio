'use client';

import { X } from 'lucide-react';
import AIConfig from './AIConfig';

export default function SettingsModal({ isOpen, onClose, aiConfig, setAiConfig, showToast }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4">
      <div className="w-full max-w-xl animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-6 px-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Smart Config</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-slate-900/60 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden">
          <AIConfig onConfigSaved={(cfg) => {
            setAiConfig(cfg);
            onClose();
            if (showToast) showToast("Cấu hình AI đã được cập nhật!", "success");
          }} />
        </div>
      </div>
    </div>
  );
}
