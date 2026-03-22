'use client';

import { useState } from 'react';
import { Clock, User, Users, ChevronDown, ChevronUp } from 'lucide-react';

const TONES = [
  { header: 'bg-indigo-600',  surface: 'bg-indigo-50',  accent: 'text-indigo-700',  ring: 'focus:ring-indigo-500',  iconBg: 'bg-indigo-100',  iconColor: 'text-indigo-600'  },
  { header: 'bg-violet-600',  surface: 'bg-violet-50',  accent: 'text-violet-700',  ring: 'focus:ring-violet-500',  iconBg: 'bg-violet-100',  iconColor: 'text-violet-600'  },
  { header: 'bg-fuchsia-600', surface: 'bg-fuchsia-50', accent: 'text-fuchsia-700', ring: 'focus:ring-fuchsia-500', iconBg: 'bg-fuchsia-100', iconColor: 'text-fuchsia-600' },
  { header: 'bg-pink-600',    surface: 'bg-pink-50',    accent: 'text-pink-700',    ring: 'focus:ring-pink-500',    iconBg: 'bg-pink-100',    iconColor: 'text-pink-600'    },
  { header: 'bg-rose-600',    surface: 'bg-rose-50',    accent: 'text-rose-700',    ring: 'focus:ring-rose-500',    iconBg: 'bg-rose-100',    iconColor: 'text-rose-600'    },
];

export default function ActivityCard({ activity, index, onChange }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const tone = TONES[index % TONES.length];

  const handleChange = (field, value) => {
    if (onChange) onChange(index, { ...activity, [field]: value });
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[28px] mb-4 overflow-hidden shadow-sm hover:shadow-md transition-shadow">

      {/* ── Colored header strip ─────────────────────────────────────────── */}
      <div className={`${tone.header} px-6 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-black text-white text-sm shrink-0">
            {index + 1}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm leading-tight">{activity.segmentTitle || `Hoạt động ${index + 1}`}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3 text-white/70" />
              <span className="text-white/90 text-xs font-semibold">{activity.time || '—'}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition-colors shrink-0"
          aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Card body ────────────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="px-6 md:px-8 py-6 md:py-8 space-y-6">

          {/* ── Full-width content block ────────────────────────────────── */}
          <div className={`w-full ${tone.surface} rounded-2xl px-6 py-5`}>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              📋 Nội dung chi tiết
            </h4>
            <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">
              {activity.detailedContent}
            </p>
          </div>

          {/* ── GV / HS – mandatory 2-col grid ─────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Teacher column */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <div className={`w-6 h-6 rounded-full ${tone.iconBg} flex items-center justify-center shrink-0`}>
                  <User className={`w-3 h-3 ${tone.iconColor}`} />
                </div>
                Hoạt động Giáo viên
              </label>
              {/* Tonal background text block */}
              <div className="bg-slate-100 rounded-xl p-4">
                <textarea
                  value={activity.teacherActions || ''}
                  onChange={(e) => handleChange('teacherActions', e.target.value)}
                  placeholder="Giáo viên thực hiện..."
                  rows={6}
                  className={`w-full bg-transparent border-none outline-none resize-none text-sm text-slate-800 leading-relaxed placeholder-slate-400 focus:ring-0`}
                />
              </div>
            </div>

            {/* Student column */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <div className={`w-6 h-6 rounded-full ${tone.iconBg} flex items-center justify-center shrink-0`}>
                  <Users className={`w-3 h-3 ${tone.iconColor}`} />
                </div>
                Hoạt động Học sinh
              </label>
              {/* Tonal background text block */}
              <div className="bg-slate-100 rounded-xl p-4">
                <textarea
                  value={activity.studentActions || ''}
                  onChange={(e) => handleChange('studentActions', e.target.value)}
                  placeholder="Học sinh thực hiện..."
                  rows={6}
                  className={`w-full bg-transparent border-none outline-none resize-none text-sm text-slate-800 leading-relaxed placeholder-slate-400 focus:ring-0`}
                />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
