'use client';

import { useState } from 'react';
import { Settings, Eye, EyeOff, CheckCircle, ChevronDown, KeyRound, Sparkles, Wand2 } from 'lucide-react';

const MODELS = [
  { id: 'gemini-3.1-pro-preview',   modelId: 'gemini-3.1-pro-preview',   label: 'Google Gemini 3.1 Pro (🧠 Thông minh nhất)',   icon: '🤖', provider: 'gemini' },
  { id: 'gemini-3.0-flash-preview', modelId: 'gemini-3-flash-preview', label: 'Google Gemini 3.0 Flash (⚡ Cực nhanh)',      icon: '⚡', provider: 'gemini' },
  { id: 'gemini-2.5-pro',           modelId: 'gemini-2.5-pro',           label: 'Google Gemini 2.5 Pro (🚀 Thế hệ mới)',     icon: '🚀', provider: 'gemini' },
  { id: 'gemini-2.5-flash',         modelId: 'gemini-2.5-flash',         label: 'Google Gemini 2.5 Flash (🔥 Hiệu năng)',    icon: '🔥', provider: 'gemini' },
  { id: 'gemini-2.0-flash',         modelId: 'gemini-2.0-flash',         label: 'Google Gemini 2.0 Flash (✨ Cân bằng)',     icon: '✨', provider: 'gemini' },
  { id: 'deep-research-pro-preview-12-2025', modelId: 'deep-research-pro-preview-12-2025', label: 'Google Deep Research (🔍 Chuyên sâu)', icon: '🔍', provider: 'gemini' },
  { id: 'gemma-3-27b-it',           modelId: 'gemma-3-27b-it',           label: 'Google Gemma 3 27B (🌐 Cởi mở)',           icon: '🌐', provider: 'gemini' },
  { id: 'openai-gpt4o-mini',       modelId: 'gpt-4o-mini',            label: 'OpenAI GPT-4o Mini',                   icon: '✨', provider: 'openai' },
  { id: 'anthropic-sonnet',        modelId: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet',               icon: '📘', provider: 'anthropic' },
];

export default function AILandingConfig({ onComplete }) {
  const [modelType, setModelType] = useState('gemini-1.5-flash-latest');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);

  const selectedModel = MODELS.find(m => m.id === modelType);

  function handleSave() {
    if (!apiKey.trim()) return;
    const config = { apiKey: apiKey.trim(), modelType };
    localStorage.setItem('giao_an_io_config', JSON.stringify(config));
    if (onComplete) onComplete(config);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#0B0F19] relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-blob"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-violet-600/20 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-2000"></div>

      <div className="relative z-10 w-full max-w-2xl bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[48px] p-8 md:p-12 shadow-2xl glass-effect text-center space-y-10 border-t-white/20">
        
        {/* App Logo/Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-3xl flex items-center justify-center rotate-12 shadow-2xl shadow-indigo-500/40">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
        </div>

        <div>
           <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent mb-4 tracking-tight">
            GIAOÁN I.O
           </h1>
           <p className="text-slate-400 text-lg font-medium">Chào mừng Thầy/Cô! Để bắt đầu, hãy thiết lập bộ não AI của bạn.</p>
        </div>

        <div className="space-y-6 text-left">
          {/* Model picker */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300 ml-2">LỰA CHỌN MODEL</label>
            <div className="relative">
              <button
                onClick={() => setIsModelOpen(!isModelOpen)}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl px-6 py-5 text-left flex items-center justify-between transition-all ring-offset-[#0B0F19] focus:ring-2 focus:ring-indigo-500"
              >
                <div className="flex items-center gap-4">
                   <span className="text-2xl">{selectedModel?.icon}</span>
                   <span className="font-semibold text-white">{selectedModel?.label}</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isModelOpen ? 'rotate-180' : ''}`} />
              </button>

              {isModelOpen && (
                <div className="absolute z-50 w-full mt-3 bg-[#1A1F2E]/95 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/5 overflow-hidden animate-in fade-in zoom-in duration-200">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setModelType(m.id); setIsModelOpen(false); }}
                      className={`w-full px-6 py-4 text-left flex items-center gap-4 hover:bg-white/10 transition-colors ${modelType === m.id ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-300'}`}
                    >
                      <span className="text-xl">{m.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold">{m.label}</p>
                        <p className="text-[10px] text-slate-500 font-mono italic uppercase tracking-widest">{m.provider}</p>
                      </div>
                      {modelType === m.id && <CheckCircle className="w-5 h-5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300 ml-2 uppercase flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> DÁN API KEY VÀO ĐÂY
            </label>
            <div className="relative group">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Ví dụ: AIzaSyBxxxx..."
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl px-6 py-5 pr-16 text-white text-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              >
                {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 ml-2 italic">Key được lưu an toàn trên máy tính của bạn, không bao giờ được gửi đi bất cứ đâu khác.</p>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-black py-6 rounded-[32px] text-xl shadow-2xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all flex justify-center items-center gap-3 uppercase tracking-widest"
        >
          <Wand2 className="w-7 h-7" />
          BẮT ĐẦU NGAY
        </button>

      </div>

    </div>
  );
}
