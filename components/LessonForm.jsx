'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Clock, Calculator, FileText, ChevronDown } from 'lucide-react';

const LESSON_TYPES = [
  { value: 'ly-thuyet', label: 'Lý thuyết' },
  { value: 'thuc-hanh', label: 'Thực hành' },
  { value: 'ly-thuyet-thuc-hanh', label: 'Lý thuyết + Thực hành' },
];

export default function LessonForm({ data, onDataChange, isLocked }) {
  const [form, setForm] = useState({
    lessonType: data?.lessonType || 'ly-thuyet-thuc-hanh',
    lessonName: data?.lessonName || '',
    theoryHours: data?.totalMinutes ? String(data.totalMinutes / 45) : '',
    practiceHours: '',
    notes: data?.notes || '',
  });
  const [isTypeOpen, setIsTypeOpen] = useState(false);

  const theoryTiets = parseFloat(form.theoryHours) || 0;
  const practiceTiets = parseFloat(form.practiceHours)
    ? parseFloat((parseFloat(form.practiceHours) * (60 / 45)).toFixed(1))
    : 0;
  const totalTiets = parseFloat((theoryTiets + practiceTiets).toFixed(1));
  const totalMinutes = Math.round(totalTiets * 45);

  useEffect(() => {
    if (onDataChange) {
      onDataChange({ ...form, theoryTiets, practiceTiets, totalTiets, totalMinutes });
    }
  }, [form]);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  /* M3 borderless soft input */
  const inputClass =
    'w-full bg-slate-100/80 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none placeholder-slate-400 font-medium text-slate-800';

  const selectedType = LESSON_TYPES.find((t) => t.value === form.lessonType);

  return (
    <div className="space-y-5">
      {/* Lesson Type – pill dropdown */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">
          <BookOpen className="w-3 h-3 inline mr-1" />Loại giáo án
        </label>
        <div className="relative">
          <button
            onClick={() => setIsTypeOpen(!isTypeOpen)}
            className={`${inputClass} text-left flex items-center justify-between`}
          >
            <span>{selectedType?.label}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isTypeOpen ? 'rotate-180' : ''}`} />
          </button>
          {isTypeOpen && (
            <div className="absolute z-40 w-full mt-2 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-200 overflow-hidden border border-slate-100">
              {LESSON_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { handleChange('lessonType', t.value); setIsTypeOpen(false); }}
                  className={`w-full px-5 py-3.5 text-left text-sm hover:bg-indigo-50 transition-colors ${form.lessonType === t.value ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lesson Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">
          <FileText className="w-3 h-3 inline mr-1" />Tên bài học / Module
        </label>
        <input
          type="text"
          value={form.lessonName}
          onChange={(e) => handleChange('lessonName', e.target.value)}
          placeholder="Ví dụ: Bài 1. Giới thiệu lập trình Python..."
          className={`\${inputClass} \${isLocked ? 'opacity-50 cursor-not-allowed bg-slate-200' : ''}`}
          disabled={isLocked}
        />
      </div>

      {/* Hours grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">
            <Clock className="w-3 h-3 inline mr-1" />Giờ lý thuyết
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.theoryHours}
            onChange={(e) => handleChange('theoryHours', e.target.value)}
            placeholder="0"
            className={`\${inputClass} \${isLocked ? 'opacity-50 cursor-not-allowed bg-slate-200' : ''}`}
            disabled={isLocked}
          />
          {theoryTiets > 0 && (
            <p className="text-xs text-indigo-500 mt-1.5 font-semibold">= {theoryTiets} tiết</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">
            <Clock className="w-3 h-3 inline mr-1" />Giờ thực hành
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.practiceHours}
            onChange={(e) => handleChange('practiceHours', e.target.value)}
            placeholder="0"
            className={`\${inputClass} \${isLocked ? 'opacity-50 cursor-not-allowed bg-slate-200' : ''}`}
            disabled={isLocked}
          />
          {practiceTiets > 0 && (
            <p className="text-xs text-violet-500 mt-1.5 font-semibold">= {practiceTiets} tiết</p>
          )}
        </div>
      </div>

      {/* Live calculation – M3 tonal surface */}
      {totalMinutes > 0 && (
        <div className="bg-indigo-50 rounded-[24px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-widest">Tổng hợp thời lượng</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { val: theoryTiets, label: 'Tiết LT', color: 'text-indigo-600' },
              { val: practiceTiets, label: 'Tiết TH', color: 'text-violet-600' },
              { val: totalTiets, label: 'Tổng tiết', color: 'text-pink-600' },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-2xl p-3 text-center shadow-sm">
                <p className={`text-xl font-black ${item.color}`}>{item.val}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-3xl font-black text-slate-900">
              {totalMinutes}
              <span className="text-base font-semibold text-slate-400 ml-1.5">phút</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Tổng thời lượng giảng dạy</p>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">
          Ghi chú thêm <span className="normal-case text-slate-400">(tùy chọn)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Mục tiêu bài học, đối tượng học sinh, yêu cầu cần đạt..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  );
}
