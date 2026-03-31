'use client';

import { useState } from 'react';
import { BookOpen, AlertTriangle, ArrowRight, ArrowLeft, Info, Activity } from 'lucide-react';
import useStore from '@/app/store/useStore';
import SyllabusPreviewTable from '@/components/SyllabusPreviewTable';

export default function Step4Editor() {
  const { activeCourse, updateActiveCourse, nextStep, prevStep } = useStore();

  const handleSyllabusConfirm = (updatedSyllabus) => {
    updateActiveCourse({ syllabus: updatedSyllabus });
    nextStep();
  };

  const handleSyllabusChange = (updatedSyllabus) => {
    updateActiveCourse({ syllabus: updatedSyllabus });
  };

  // Calculate total periods from syllabus
  const totalLT = activeCourse.syllabus.reduce((sum, l) => sum + (parseFloat(l.gioLT) || 0), 0);
  const totalOther = activeCourse.syllabus.reduce((sum, l) => sum + 
    (parseFloat(l.gioTH) || 0) + 
    (parseFloat(l.gioKLT) || 0) + 
    (parseFloat(l.gioKTH) || 0) + 
    (parseFloat(l.gioTLT) || 0) + 
    (parseFloat(l.gioTTH) || 0), 0);
    
  const totalPeriods = totalLT + Math.round(totalOther * 60 / 45);

  // Calculate total capacity from Step 2
  const totalCapacity = Object.entries(activeCourse.dayConfigs).reduce((sum, [day, periods]) => {
     return sum; // Placeholder
  }, 0);

  const actualDates = activeCourse.startDate ? [] : [];

  const plannedPeriods = activeCourse.schedule?.length > 0
    ? activeCourse.schedule.reduce((sum, s) => sum + s.totalPeriods, 0)
    : 0; 

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-10 flex items-center justify-between">
         <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-indigo-500/20 rounded-[22px] flex items-center justify-center border border-indigo-400/20">
             <Activity className="w-7 h-7 text-indigo-400" />
           </div>
           <div>
             <h2 className="text-3xl font-black text-white tracking-tight mb-1 uppercase">Bảng nội dung chuyên môn</h2>
             <p className="text-slate-400 font-medium text-sm">Xây dựng đề cương chi tiết. AI sẽ dựa vào đây để soạn giáo án từng buổi.</p>
           </div>
         </div>
         <div className="flex gap-4">
           <button onClick={prevStep} className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400 font-bold flex items-center gap-2">
             <ArrowLeft className="w-5 h-5" /> QUAY LẠI BƯỚC 3
           </button>
         </div>
      </div>

      <div className="mb-8 p-6 bg-amber-500/5 border border-amber-500/20 rounded-[32px] flex items-start gap-5">
        <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center shrink-0 border border-amber-500/20">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Cảnh báo hệ thống</p>
          <p className="text-sm font-bold text-slate-300 leading-relaxed">
            Tổng thời lượng hiện tại: <span className="text-white font-black">{totalPeriods} Tiết</span> ({totalLT}h LT + {totalOther}h TH/KT/Thi). 
            Hãy đảm bảo số tiết quy đổi đã khớp với kế hoạch giảng dạy trong học kỳ.
          </p>
        </div>
      </div>

      <SyllabusPreviewTable 
        lessons={activeCourse.syllabus}
        onConfirm={handleSyllabusConfirm}
        onCancel={() => {}}
        onChange={handleSyllabusChange}
      />

      <div className="mt-12 flex justify-end">
        <button 
          onClick={nextStep}
          disabled={activeCourse.syllabus.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black px-12 py-6 rounded-3xl shadow-[0_15px_40px_rgba(79,70,229,0.3)] transition-all active:scale-95 flex items-center gap-3 group"
        >
          <span>CHUYỂN SANG BƯỚC 5: XỬ LÝ & XUẤT</span>
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
