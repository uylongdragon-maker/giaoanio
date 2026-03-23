'use client';

import { CheckCircle2, XCircle, ArrowRight, BookOpen, Clock, Activity } from 'lucide-react';

export default function SyllabusPreviewTable({ lessons, onConfirm, onCancel }) {
  const totalLT = lessons.reduce((sum, l) => sum + (l.tietLT || 0), 0);
  const totalTH = lessons.reduce((sum, l) => sum + (l.tietTH || 0), 0);
  const totalPeriods = totalLT + totalTH;

  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/80 shadow-2xl shadow-indigo-100/50 overflow-hidden">
        {/* Header Section */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/50 to-white/0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              Kiểm tra Phân phối Chương trình
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-1">AI đã trích xuất được <span className="text-indigo-600 font-bold">{lessons.length} bài học/mục</span></p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-sm transition-all flex items-center gap-2 border border-slate-200"
            >
              <XCircle className="w-4 h-4" />
              Hủy & Up lại
            </button>
            <button 
              onClick={onConfirm}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-slate-900 text-white font-black text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 hover:-translate-y-0.5"
            >
              Chốt & Xếp Lịch
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">STT</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tên bài học/Nội dung</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tiết LT</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tiết TH/KT</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lessons.map((lesson, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">{idx + 1}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-900 transition-colors">{lesson.name || lesson.tenBai}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {lesson.tietLT > 0 ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 text-xs font-black border border-blue-100">
                        {lesson.tietLT}
                      </span>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {lesson.tietTH > 0 ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600 text-xs font-black border border-amber-100">
                        {lesson.tietTH}
                      </span>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-black text-slate-800">{lesson.totalPeriods || (lesson.tietLT + lesson.tietTH)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-8 bg-slate-50/80 border-t border-white grid grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:ring-2 hover:ring-blue-100 transition-all">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Tổng Lý Thuyết</p>
              <p className="text-xl font-black text-blue-700">{totalLT} tiết</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:ring-2 hover:ring-amber-100 transition-all">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Tổng Thực Hành/KT</p>
              <p className="text-xl font-black text-amber-700">{totalTH} tiết</p>
            </div>
          </div>

          <div className="bg-indigo-600 p-4 rounded-2xl shadow-xl shadow-indigo-100 flex items-center gap-4 transform hover:scale-105 transition-all outline outline-offset-4 outline-transparent hover:outline-indigo-100">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white backdrop-blur-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-indigo-100">Tổng Cộng Toàn Môn</p>
              <p className="text-xl font-black text-white">{totalPeriods} Tiết</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
