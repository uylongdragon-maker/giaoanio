'use client';

import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, CheckCircle, ChevronDown, KeyRound, Sparkles } from 'lucide-react';

const MODELS = [
  { id: 'gemini-2.0-flash',         modelId: 'gemini-2.0-flash',           label: 'Gemini 2.0 Flash (🚀 Tối ưu nhất)',  icon: '🚀', provider: 'gemini' },
  { id: 'gemini-1.5-flash-002',     modelId: 'gemini-1.5-flash-002',       label: 'Gemini 1.5 Flash-002 (⚡ Ổn định)',    icon: '⚡', provider: 'gemini' },
  { id: 'gemini-1.5-pro-002',       modelId: 'gemini-1.5-pro-002',         label: 'Gemini 1.5 Pro-002 (🧠 Chi tiết)',     icon: '🧠', provider: 'gemini' },
];

const STORAGE_KEY = 'giao_an_io_config';

export default function AIConfig({ onConfigSaved }) {
  const [modelType, setModelType] = useState('gemini-2.0-flash');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isModelOpen, setIsModelOpen] = useState(false);

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        
        // AGGRESSIVE MIGRATION: Clear legacy/deprecated models
        const modelType = config.modelType || '';
        const isLegacy = modelType.includes('latest') || 
                         modelType.includes('preview') || 
                         modelType.includes('exp') ||
                         modelType === 'gemini-1.5-flash' || 
                         modelType === 'gemini-1.5-pro' ||
                         modelType === 'gemini-2.0-flash' ||
                         modelType === 'gemini-3.0-flash-preview' ||
                         modelType === 'gemini-3.1-pro-preview';
        
        if (isLegacy || !MODELS.find(m => m.id === modelType)) {
          console.warn("[Migration] Detecting legacy model:", modelType, "Redirecting to gemini-1.5-flash-002");
          config.modelType = 'gemini-1.5-flash-002';
          localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        }

        setModelType(config.modelType || 'gemini-2.0-flash');
        setApiKey(config.apiKey || '');
        setMaskedKey(maskKey(config.apiKey || ''));
        setSaved(true);
      }
    } catch (e) {
      console.error("[AIConfig] Load error:", e);
    }
  }, []);

  function maskKey(key) {
    if (!key || key.length < 8) return '••••••••';
    return '•'.repeat(Math.max(0, key.length - 4)) + key.slice(-4);
  }

  function handleSave() {
    const config = { 
      apiKey: apiKey.trim(), 
      modelType
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setMaskedKey(maskKey(apiKey.trim()));
    setSaved(true);
    setIsExpanded(false);
    if (onConfigSaved) onConfigSaved(config);
  }

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY);
    setSaved(false);
    setMaskedKey('');
    setApiKey('');
    setIsExpanded(true);
    if (onConfigSaved) onConfigSaved(null);
  }

  const selectedModel = MODELS.find((m) => m.id === modelType);

  // Group models by provider for the dropdown
  const providerGroups = [
    { key: 'gemini', label: 'Google Gemini (Standard)' },
  ];

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[28px] shadow-sm overflow-hidden border border-white/40">
      {/* Header toggle row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-slate-800 text-base">Cấu hình AI</h2>
            {saved && !isExpanded && (
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle className="w-3 h-3" />
                {selectedModel?.icon} {selectedModel?.label.split('(')[0].trim()} · {maskedKey}
              </p>
            )}
            {!saved && !isExpanded && (
              <p className="text-xs text-amber-500 mt-0.5">⚠ Chưa hoàn tất cấu hình</p>
            )}
          </div>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-slate-100' : 'bg-transparent'}`}>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-slate-100">
          {/* Model picker */}
          <div className="pt-4">
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">
              AI Mô hình (Model)
            </label>
            <div className="relative">
              <button
                onClick={() => setIsModelOpen(!isModelOpen)}
                className="w-full bg-slate-100/80 border-none rounded-2xl px-5 py-4 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
              >
                <span className="text-sm font-medium">
                  {selectedModel?.icon} {selectedModel?.label}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isModelOpen ? 'rotate-180' : ''}`} />
              </button>

              {isModelOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white/98 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-200 overflow-y-auto max-h-[300px] border border-slate-100">
                  {providerGroups.map((group) => {
                    const groupModels = MODELS.filter((m) => m.provider === group.key);
                    if (groupModels.length === 0) return null;
                    return (
                      <div key={group.key}>
                        <div className="px-5 pt-3 pb-1 border-b border-slate-50">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.label}</span>
                        </div>
                        {groupModels.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => { setModelType(m.id); setIsModelOpen(false); }}
                            className={`w-full px-5 py-3 text-left text-sm flex items-center gap-3 hover:bg-emerald-50 transition-colors ${modelType === m.id ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700'}`}
                          >
                            <span className="text-base">{m.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{m.label}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{m.modelId}</p>
                            </div>
                            {modelType === m.id && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  <div className="h-2" />
                </div>
              )}
            </div>
          </div>

          {/* API Key (Hide if Chrome Nano) */}
          {selectedModel?.provider !== 'chrome' && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">
                <KeyRound className="w-3 h-3 inline mr-1" />API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={saved ? 'Key hiện tại đã được lưu...' : 'Dán API Key vào đây...'}
                  className="w-full bg-slate-100/80 border-none rounded-2xl px-5 py-4 pr-14 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none placeholder-slate-400 text-slate-800"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-full shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 text-sm mt-2"
          >
            <Sparkles className="w-5 h-5" />
            LƯU LẠI CƠ CHẾ AI
          </button>

          <p className="text-center text-xs text-slate-400">
            🔒 Key được lưu an toàn trên trình duyệt.
          </p>
        </div>
      )}
    </div>
  );
}
