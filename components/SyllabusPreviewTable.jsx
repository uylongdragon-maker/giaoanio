'use client';

import { CheckCircle2, XCircle, ArrowRight, BookOpen, Clock, Activity, Plus, Trash2, Download } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SyllabusPreviewTable({ lessons, onConfirm, onCancel, onChange }) {
  const [localLessons, setLocalLessons] = useState(lessons);
  const [isExporting, setIsExporting] = useState(false);

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
      tenBai: '',
      deMuc: '',
      gioLT: 0,
      gioTH: 0,
      gioKLT: 0,
      gioKTH: 0,
      gioTLT: 0,
      gioTTH: 0,
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

  // Chỉ có Lý thuyết (LT) là hệ số 1 (45 phút)
  const totalLT = localLessons.reduce((sum, l) => sum + (parseFloat(l.gioLT) || 0), 0);
  
  // Thực hành, Kiểm tra, Thi (TH, KLT, KTH, TLT, TTH) đều là hệ số 60/45 (60 phút)
  const totalOther = localLessons.reduce((sum, l) => sum + 
    (parseFloat(l.gioTH) || 0) + 
    (parseFloat(l.gioKLT) || 0) + 
    (parseFloat(l.gioKTH) || 0) + 
    (parseFloat(l.gioTLT) || 0) + 
    (parseFloat(l.gioTTH) || 0), 0);
  
  // Quy đổi theo hệ số 60/45 (1.3333)
  const totalOtherConverted = totalOther * (60 / 45);
  const totalPeriods = totalLT + totalOtherConverted;

  const handleExportWord = () => {
    setIsExporting(true);
    try {
      // Build a professional HTML table for the syllabus
      const rowsHtml = localLessons.map((l, i) => {
        const subItems = l.deMuc ? l.deMuc.split('\n').filter(item => item.trim() !== '') : [];
        const rs = subItems.length + 1;
        const sum = (parseFloat(l.gioLT)||0) + (parseFloat(l.gioTH)||0) + (parseFloat(l.gioKLT)||0) + (parseFloat(l.gioKTH)||0) + (parseFloat(l.gioTLT)||0) + (parseFloat(l.gioTTH)||0);

        let html = `
        <tr>
          <td align="center" rowspan="${rs}">${i + 1}</td>
          <td><b>${l.tenBai || ''}</b></td>
          <td align="center" rowspan="${rs}"><b>${sum > 0 ? sum : ''}</b></td>
          <td align="center" rowspan="${rs}">${(parseFloat(l.gioLT) > 0) ? l.gioLT : ''}</td>
          <td align="center" rowspan="${rs}">${(parseFloat(l.gioTH) > 0) ? l.gioTH : ''}</td>
          <td align="center" rowspan="${rs}">${(parseFloat(l.gioKLT) > 0) ? l.gioKLT : ''}</td>
          <td align="center" rowspan="${rs}">${(parseFloat(l.gioKTH) > 0) ? l.gioKTH : ''}</td>
          <td align="center" rowspan="${rs}">${(parseFloat(l.gioTLT) > 0) ? l.gioTLT : ''}</td>
          <td align="center" rowspan="${rs}">${(parseFloat(l.gioTTH) > 0) ? l.gioTTH : ''}</td>
        </tr>`;

        subItems.forEach(item => {
          html += `
        <tr>
          <td>${item}</td>
        </tr>`;
        });
        
        return html;
      }).join('');

      const tableHtml = `
        <h2 style="text-align: center; text-transform: uppercase; font-family: 'Times New Roman';">BẢN PHÂN PHỐI CHƯƠNG TRÌNH</h2>
        <table border="1" style="border-collapse: collapse; width: 100%; font-family: 'Times New Roman'; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2; text-align: center;">
              <th rowspan="3" width="5%">Số TT</th>
              <th rowspan="3" width="30%">Tên chương, mục</th>
              <th colspan="7">Thời gian (giờ)</th>
            </tr>
            <tr style="background-color: #f2f2f2; text-align: center;">
              <th rowspan="2" width="5%">Tổng số</th>
              <th rowspan="2" width="5%">Lý thuyết</th>
              <th rowspan="2" width="15%">Thực hành, thí nghiệm, thảo luận, bài tập</th>
              <th colspan="2">KT</th>
              <th colspan="2">Thi</th>
            </tr>
            <tr style="background-color: #f2f2f2; text-align: center;">
              <th width="5%">LT</th>
              <th width="5%">TH</th>
              <th width="5%">LT</th>
              <th width="5%">TH</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background-color: #f9f9f9;">
              <td colspan="3" align="right">TỔNG CỘNG HỆ SỐ 1.0 (Giờ):</td>
              <td align="center" colspan="2">${(totalLT + totalOther).toFixed(1)} h</td>
              <td align="center" colspan="2">${(localLessons.reduce((s,l)=>s+(parseFloat(l.gioKLT)||0)+(parseFloat(l.gioKTH)||0), 0)).toFixed(1)} h</td>
              <td align="center" colspan="2">${(localLessons.reduce((s,l)=>s+(parseFloat(l.gioTLT)||0)+(parseFloat(l.gioTTH)||0), 0)).toFixed(1)} h</td>
            </tr>
            <tr style="font-weight: bold; color: #4f46e5;">
              <td colspan="7" align="right">QUY ĐỔI TỔNG TIẾT (LT + Khác*1.33):</td>
              <td align="center" colspan="2">${Math.round(totalPeriods)} TIẾT</td>
            </tr>
          </tfoot>
        </table>
        <p style="font-style: italic; font-size: 9pt; margin-top: 10px;">* Đề cương được bóc tách và xếp lịch tự động bởi hệ thống GIAOÁN I.O</p>
      `;

      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                      <head><meta charset='utf-8'><title>Phân Phối Chương Trình</title>
                      <style>table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid black; padding: 8px; font-family: "Times New Roman"; }</style>
                      </head><body>`;
      const footer = "</body></html>";
      const blob = new Blob(['\ufeff', header + tableHtml + footer], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Phan_Phoi_Chuong_Trinh_${Date.now()}.doc`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Lỗi xuất Word: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

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
              onClick={handleExportWord}
              disabled={isExporting || localLessons.length === 0}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Xuất Đề Cương (Word)
            </button>
            <button 
              onClick={onCancel}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-sm transition-all flex items-center gap-2 border border-slate-200"
            >
              <XCircle className="w-4 h-4" />
              Hủy & Up lại
            </button>
            <div className="group relative">
              <button 
                onClick={() => onConfirm(localLessons)}
                disabled={totalPeriods === 0}
                className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-sm transition-all flex items-center gap-2 shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5"
              >
                Chốt & Xếp Lịch
                <ArrowRight className="w-4 h-4" />
              </button>
              {totalPeriods === 0 && (
                <div className="absolute -top-12 right-0 w-max bg-slate-800 text-white text-[11px] font-bold py-2 px-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl after:absolute after:-bottom-1 after:right-8 after:w-2 after:h-2 after:bg-slate-800 after:rotate-45">
                  Vui lòng điền số giờ (LT/TH) cho bài học
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="max-h-[550px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-slate-100 shadow-sm">
              <tr>
                <th rowSpan="3" className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-12 border-b border-r border-slate-200">Số TT</th>
                <th rowSpan="3" className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-800 w-[280px] border-b border-r border-slate-200 bg-indigo-50/50">Tên chương, mục</th>
                <th colSpan="7" className="px-2 py-2 text-[10px] font-black uppercase tracking-widest text-slate-800 text-center border-b border-slate-200 bg-slate-50">Thời gian (giờ)</th>
                <th rowSpan="3" className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-8 border-b border-l border-slate-200"></th>
              </tr>
              <tr>
                <th rowSpan="2" className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-indigo-600 text-center w-14 border-b border-r border-slate-200 bg-indigo-50/30">Tổng số</th>
                <th rowSpan="2" className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-blue-600 text-center w-16 border-b border-r border-slate-200 bg-blue-50/30">Lý thuyết</th>
                <th rowSpan="2" className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-emerald-600 text-center w-28 border-b border-r border-slate-200 bg-emerald-50/30">Thực hành, thí nghiệm, bài tập</th>
                <th colSpan="2" className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-amber-600 text-center border-b border-r border-slate-200 bg-amber-50/30">KT</th>
                <th colSpan="2" className="px-2 py-2 text-[9px] font-black uppercase tracking-widest text-rose-600 text-center border-b border-slate-200 bg-rose-50/30">Thi</th>
              </tr>
              <tr>
                <th className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-amber-500 text-center w-14 border-b border-r border-slate-200 bg-amber-50/10">LT</th>
                <th className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-amber-600 text-center w-14 border-b border-r border-slate-200 bg-amber-100/10">TH</th>
                <th className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-rose-500 text-center w-14 border-b border-r border-slate-200 bg-rose-50/10">LT</th>
                <th className="px-2 py-2 text-[8px] font-black uppercase tracking-widest text-rose-600 text-center w-14 border-b border-slate-200 bg-rose-100/10">TH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {localLessons.map((lesson, idx) => (
                <tr key={lesson.id || idx} className="hover:bg-indigo-50/10 transition-colors group">
                  <td className="px-4 py-4 text-xs font-bold text-slate-400 text-center border-r border-slate-100 align-top">{idx + 1}</td>
                  <td className="px-4 py-3 border-r border-slate-100 align-top">
                    <input 
                      type="text"
                      value={lesson.tenBai || ''}
                      onChange={(e) => handleUpdate(idx, 'tenBai', e.target.value)}
                      placeholder="Tên chương/bài chính..."
                      className="w-full bg-indigo-50/50 border border-indigo-100 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-900 outline-none focus:ring-1 focus:ring-indigo-500 transition-all mb-2 shadow-sm"
                    />
                    <textarea 
                      value={lesson.deMuc || ''}
                      onChange={(e) => handleUpdate(idx, 'deMuc', e.target.value)}
                      placeholder="1. Đề mục con (xuống dòng cho nhiều mục)"
                      rows={lesson.deMuc ? Math.max(2, lesson.deMuc.split('\n').length) : 2}
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none min-h-[40px] leading-relaxed"
                    />
                  </td>
                  <td className="px-1 py-3 text-center border-r border-slate-100 align-top">
                    <div className="w-11 mx-auto bg-slate-100/50 border border-slate-200 rounded-lg px-1 py-1.5 text-center text-xs font-black text-slate-500">
                      {(parseFloat(lesson.gioLT)||0) + (parseFloat(lesson.gioTH)||0) + (parseFloat(lesson.gioKLT)||0) + (parseFloat(lesson.gioKTH)||0) + (parseFloat(lesson.gioTLT)||0) + (parseFloat(lesson.gioTTH)||0)}
                    </div>
                  </td>
                  <td className="px-1 py-3 text-center border-r border-slate-100 align-top">
                    <input 
                      type="number"
                      step="0.5"
                      value={lesson.gioLT ?? 0}
                      onChange={(e) => handleUpdate(idx, 'gioLT', e.target.value)}
                      className="w-11 mx-auto bg-blue-50/30 border border-blue-100 rounded-lg px-1 py-1.5 text-center text-xs font-black text-blue-600 outline-none block"
                    />
                  </td>
                  <td className="px-1 py-3 text-center border-r border-slate-100 align-top">
                    <input 
                      type="number"
                      step="0.5"
                      value={lesson.gioTH ?? 0}
                      onChange={(e) => handleUpdate(idx, 'gioTH', e.target.value)}
                      className="w-14 mx-auto bg-emerald-50/30 border border-emerald-100 rounded-lg px-1 py-1.5 text-center text-xs font-black text-emerald-600 outline-none block"
                    />
                  </td>
                  <td className="px-1 py-3 text-center border-r border-slate-100 align-top">
                    <input 
                      type="number"
                      step="0.5"
                      value={lesson.gioKLT ?? 0}
                      onChange={(e) => handleUpdate(idx, 'gioKLT', e.target.value)}
                      className="w-11 mx-auto bg-amber-50/30 border border-amber-100 rounded-lg px-1 py-1.5 text-center text-xs font-black text-amber-500 outline-none block"
                    />
                  </td>
                  <td className="px-1 py-3 text-center border-r border-slate-100 align-top">
                    <input 
                      type="number"
                      step="0.5"
                      value={lesson.gioKTH ?? 0}
                      onChange={(e) => handleUpdate(idx, 'gioKTH', e.target.value)}
                      className="w-11 mx-auto bg-amber-100/30 border border-amber-200 rounded-lg px-1 py-1.5 text-center text-xs font-black text-amber-700 outline-none block"
                    />
                  </td>
                  <td className="px-1 py-3 text-center border-r border-slate-100 align-top">
                    <input 
                      type="number"
                      step="0.5"
                      value={lesson.gioTLT ?? 0}
                      onChange={(e) => handleUpdate(idx, 'gioTLT', e.target.value)}
                      className="w-11 mx-auto bg-rose-50/30 border border-rose-100 rounded-lg px-1 py-1.5 text-center text-xs font-black text-rose-500 outline-none block"
                    />
                  </td>
                  <td className="px-1 py-3 text-center border-r border-slate-100 align-top">
                    <input 
                      type="number"
                      step="0.5"
                      value={lesson.gioTTH ?? 0}
                      onChange={(e) => handleUpdate(idx, 'gioTTH', e.target.value)}
                      className="w-11 mx-auto bg-rose-100/30 border border-rose-200 rounded-lg px-1 py-1.5 text-center text-xs font-black text-rose-700 outline-none block"
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button 
                      onClick={() => removeRow(idx)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
              <p className="text-xl font-black text-emerald-700">{totalOther.toFixed(1)} <span className="text-xs">giờ</span></p>
            </div>
          </div>

          <div className="bg-indigo-600 p-4 rounded-2xl shadow-xl shadow-indigo-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white backdrop-blur-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-indigo-100">Quy đổi hệ số (1.33)</p>
              <p className="text-xl font-black text-white">{Math.round(totalPeriods)} Tiết</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
