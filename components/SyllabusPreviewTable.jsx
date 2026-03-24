'use client';

import { CheckCircle2, XCircle, ArrowRight, BookOpen, Clock, Activity, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SyllabusPreviewTable({ lessons, onConfirm, onCancel, onChange }) {
  const [localLessons, setLocalLessons] = useState(lessons);

  useEffect(() => {
    setLocalLessons(lessons);
  }, [lessons]);

  const handleUpdate = (idx, field, value) => {
    const updated = [...localLessons];
    updated[idx] = { ...updated[idx], [field]: value };
    setLocalLessons(updated);
    if (onChange) onChange(updated);
  };

  const addRow = () => {
    const newLesson = {
      id: `lesson-new-${Date.now()}`,
      name: '',
      subItems: '',
      gioLT: 0,
      gioTH: 0,
      status: 'Chưa soạn'
    };
    const updated = [...localLessons, newLesson];
    setLocalLessons(updated);
    if (onChange) onChange(updated);
  };

  const removeRow = (idx) => {
    const updated = localLessons.filter((_, i) => i !== idx);
    setLocalLessons(updated);
    if (onChange) onChange(updated);
  };

  const totalLT = localLessons.reduce((sum, l) => sum + (parseFloat(l.gioLT ?? l.tietLT) || 0), 0);
  const totalTH = localLessons.reduce((sum, l) => sum + (parseFloat(l.gioTH ?? l.tietTH) || 0), 0);
  // Quy đổi TH theo hệ số 60/45 cho summary dự kiến
  const totalTHConverted = totalTH * (60 / 45);
  const totalPeriods = totalLT + totalTHConverted;

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/80 shadow-2xl shadow-indigo-100/50 overflow-hidden">
        {/* Header Section */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/50 to-white/0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 text-indigo-700">
              <BookOpen className="w-6 h-6" />
              Bản Phân phối Chương trình (Giao diện Pro)
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest text-[10px]">Đơn vị tính: GIỜ HỆ SỐ 1.0 (Khớp theo file Word của trường)</p>
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
              onClick={() => onConfirm(localLessons)}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-slate-900 text-white font-black text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 hover:-translate-y-0.5"
            >
              Chốt & Xếp Lịch
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="max-h-[550px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-slate-100">
              <tr>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-12">STT</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-1/4">Tên bài học/Chương</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Đề mục chi tiết (cách nhau bởi dấu phẩy)</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-24">Giờ LT</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-24">Giờ TH/KT</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {localLessons.map((lesson, idx) => (
                <tr key={lesson.id || idx} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="px-4 py-4 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <input 
                      type="text"
                      value={lesson.name || lesson.tenBai || ''}
                      onChange={(e) => handleUpdate(idx, 'name', e.target.value)}
                      placeholder="VD: Bài 1: Tổng quan..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <textarea 
                      value={lesson.subItems || lesson.deMuc || ''}
                      onChange={(e) => handleUpdate(idx, 'subItems', e.target.value)}
                      placeholder="VD: 1. Khái niệm, 2. Lịch sử..."
                      rows={1}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none overflow-hidden min-h-[40px]"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input 
                      type="number"
                      step="0.5"
                      value={lesson.gioLT ?? lesson.tietLT ?? 0}
                      onChange={(e) => handleUpdate(idx, 'gioLT', e.target.value)}
                      className="w-16 bg-blue-50/50 border border-blue-100 rounded-xl px-2 py-2 text-center text-sm font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input 
                      type="number"
                      step="0.5"
                      value={lesson.gioTH ?? lesson.tietTH ?? 0}
                      onChange={(e) => handleUpdate(idx, 'gioTH', e.target.value)}
                      className="w-16 bg-emerald-50/50 border border-emerald-100 rounded-xl px-2 py-2 text-center text-sm font-black text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => removeRow(idx)}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Bottom */}
        <div className="p-4 border-t border-slate-100 bg-white/50 flex flex-col items-center gap-3">
          <button 
            onClick={addRow}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all font-bold text-sm flex items-center justify-center gap-2 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            Thêm Bài học/Hoạt động mới
          </button>
          <p className="text-[10px] text-rose-500 font-bold italic">
            * (Lưu ý: Hệ thống sẽ tự động quy đổi Giờ TH sang Tiết TH theo tỷ lệ x60/45 khi xuất Lịch trình chi tiết)
          </p>
        </div>

        {/* Footer Summary */}
        <div className="p-8 bg-slate-50/80 border-t border-white grid grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Tổng Giờ LT</p>
              <p className="text-xl font-black text-blue-700">{totalLT.toFixed(1)} <span className="text-xs">giờ</span></p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Tổng Giờ TH/KT</p>
              <p className="text-xl font-black text-emerald-700">{totalTH.toFixed(1)} <span className="text-xs">giờ</span></p>
            </div>
          </div>

          <div className="bg-indigo-600 p-4 rounded-2xl shadow-xl shadow-indigo-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white backdrop-blur-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-indigo-100">Dự kiến Thời lượng môn</p>
              <p className="text-xl font-black text-white">{Math.round(totalPeriods)} Tiết</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
