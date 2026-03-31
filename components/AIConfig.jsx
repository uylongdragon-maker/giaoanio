'use client';

import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, CheckCircle, ChevronDown, KeyRound, Sparkles } from 'lucide-react';

const MODELS = [
  // ── Google Gemini ──────────────────────────────────
  { id: 'gemini-2.5-flash',         modelId: 'gemini-2.5-flash',                label: 'Gemini 2.5 Flash (🚀 Đỉnh cao mới)',   icon: '🚀', provider: 'gemini' },
  { id: 'gemini-2.5-pro',           modelId: 'gemini-2.5-pro',                  label: 'Gemini 2.5 Pro (🌌 Toàn năng)',        icon: '🌌', provider: 'gemini' },
  { id: 'gemini-2.0-flash',         modelId: 'gemini-2.0-flash',                label: 'Gemini 2.0 Flash (✨ Cân bằng)',       icon: '✨', provider: 'gemini' },
  { id: 'gemini-1.5-pro',           modelId: 'gemini-1.5-pro-latest',           label: 'Gemini 1.5 Pro (🧠 Thông minh)',       icon: '🤖', provider: 'gemini' },
  { id: 'gemini-1.5-flash',         modelId: 'gemini-1.5-flash-latest',         label: 'Gemini 1.5 Flash (⚡ Tốc độ)',         icon: '⚡', provider: 'gemini' },
  // ── OpenAI ─────────────────────────────────────────
  { id: 'openai-gpt4o-mini', modelId: 'gpt-4o-mini',                label: 'OpenAI GPT-4o Mini',                   icon: '✨', provider: 'openai' },
  { id: 'openai-gpt4o',      modelId: 'gpt-4o',                     label: 'OpenAI GPT-4o',                        icon: '🌟', provider: 'openai' },
  // ── Anthropic Claude ───────────────────────────────
  { id: 'anthropic-sonnet',  modelId: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet',                   icon: '🧠', provider: 'anthropic' },
];

const STORAGE_KEY = 'giao_an_io_config';

export default function AIConfig({ onConfigSaved }) {
  const [modelType, setModelType] = useState('gemini-1.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isModelOpen, setIsModelOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        
        // MIGRATION: Map legacy IDs to new ones
        const MIGRATION_MAP = {
          'gemini-3.0-flash-preview': 'gemini-1.5-flash',
          'gemini-3-flash-preview':   'gemini-1.5-flash',
          'gemini-3.1-pro-preview':   'gemini-1.5-pro',
          'gemini-2.5-pro':           'gemini-1.5-pro',
          'gemini-1.5-flash-latest':  'gemini-1.5-flash',
          'gemini-1.5-pro-latest':    'gemini-1.5-pro',
        };

        let mType = config.modelType;
        if (MIGRATION_MAP[mType]) {
          console.log(`[AIConfig] Migrating legacy model ${mType} to ${MIGRATION_MAP[mType]}`);
          mType = MIGRATION_MAP[mType];
          // Update localStorage immediately with the new model
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, modelType: mType }));
        }

        // Fallback if the model is still not in our valid list
        if (!MODELS.find(m => m.id === mType)) {
          mType = 'gemini-1.5-flash';
        }

        setModelType(mType);
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
    if (!apiKey.trim()) return;
    const config = { apiKey: apiKey.trim(), modelType };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setMaskedKey(maskKey(apiKey.trim()));
    setSaved(true);
    setApiKey('');
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
    { key: 'gemini',    label: 'Google Gemini' },
    { key: 'anthropic', label: 'Anthropic Claude' },
    { key: 'openai',    label: 'OpenAI' },
  ];

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[28px] shadow-sm overflow-hidden">
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
              <p className="text-xs text-amber-500 mt-0.5">⚠ Chưa cấu hình API Key</p>
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
              AI Model
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
                    return (
                      <div key={group.key}>
                        {/* Provider heading */}
                        <div className="px-5 pt-3 pb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.label}</span>
                        </div>
                        {groupModels.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => { setModelType(m.id); setIsModelOpen(false); }}
                            className={`w-full px-5 py-3 text-left text-sm flex items-center gap-3 hover:bg-indigo-50 transition-colors ${modelType === m.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'}`}
                          >
                            <span className="text-base">{m.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{m.label}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{m.modelId}</p>
                            </div>
                            {modelType === m.id && <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />}
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

          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">
              <KeyRound className="w-3 h-3 inline mr-1" />API Key
            </label>

            {saved && (
              <div className="flex items-center gap-2 bg-emerald-50 rounded-2xl px-4 py-3 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-slate-600 font-mono flex-1 overflow-hidden text-ellipsis">{maskedKey}</span>
                <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-600 font-semibold transition-colors shrink-0">
                  Xóa
                </button>
              </div>
            )}

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={saved ? 'Nhập key mới để thay thế...' : 'Dán API Key vào đây...'}
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

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-full shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 disabled:shadow-none disabled:transform-none transition-all flex justify-center items-center gap-2 text-sm"
          >
            <Sparkles className="w-5 h-5" />
            {saved ? 'Cập nhật cấu hình' : 'Lưu cấu hình'}
          </button>

          <p className="text-center text-xs text-slate-400">
            🔒 Key chỉ lưu trên trình duyệt, không gửi lên server của chúng tôi.
          </p>
        </div>
      )}
    </div>
  );
}
