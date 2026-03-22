'use client';

import { Monitor, Wifi, PenTool } from 'lucide-react';

const RESOURCES = [
  { id: 'projector', label: 'Máy chiếu / Tivi', icon: Monitor },
  { id: 'internet', label: 'Kết nối Internet', icon: Wifi },
  { id: 'stationery', label: 'Giấy A0, Bút lông', icon: PenTool },
];

const COMPETENCIES = [
  { id: 'problem-solving', label: 'Giải quyết vấn đề' },
  { id: 'digital', label: 'Năng lực số' },
  { id: 'teamwork', label: 'Hợp tác' },
  { id: 'self-learning', label: 'Tự chủ & Tự học' },
  { id: 'creative', label: 'Sáng tạo' },
  { id: 'communication', label: 'Giao tiếp' }
];

export default function CompetencySelector({ settings, onChange }) {
  const selectedResources = settings?.resources || [];
  const selectedCompetencies = settings?.competencies || [];

  const toggleResource = (id) => {
    const next = selectedResources.includes(id) 
      ? selectedResources.filter(r => r !== id)
      : [...selectedResources, id];
    onChange({ ...settings, resources: next });
  };

  const toggleComp = (id) => {
    const next = selectedCompetencies.includes(id) 
      ? selectedCompetencies.filter(c => c !== id)
      : [...selectedCompetencies, id];
    onChange({ ...settings, competencies: next });
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[28px] p-6 shadow-sm border border-white/80 space-y-8">
      
      {/* Tài nguyên */}
      <div>
        <h2 className="font-bold text-slate-800 mb-4 text-sm">Tài nguyên học tập (Resource Cards)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {RESOURCES.map(res => {
            const Icon = res.icon;
            const isSelected = selectedResources.includes(res.id);
            return (
              <button
                key={res.id}
                onClick={() => toggleResource(res.id)}
                className={`flex flex-col items-center justify-center p-5 rounded-3xl border-2 transition-all ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${isSelected ? 'bg-indigo-200' : 'bg-slate-100'}`}>
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} />
                </div>
                <span className="text-xs font-bold text-center">{res.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mục tiêu Năng lực */}
      <div>
        <h2 className="font-bold text-slate-800 mb-4 text-sm">Mục tiêu Năng lực (Capacity Chips)</h2>
        <div className="flex flex-wrap gap-3">
          {COMPETENCIES.map(comp => {
            const isSelected = selectedCompetencies.includes(comp.id);
            return (
              <button
                key={comp.id}
                onClick={() => toggleComp(comp.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                  isSelected 
                    ? 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {comp.label}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
