'use client';

import { X, FileText, Download, CheckCircle2, Calendar, Clock, BookOpen, Bot } from 'lucide-react';
// Note: In this project, Word export is handled in ExportButtons, 
// so we'll likely just show the summary and a close button for now, 
// or implement a simple version of the download if needed.

export default function SessionPreviewModal({ isOpen, onClose, session, onReset }) {
  if (!isOpen || !session) return null;

  const lesson = session.generatedLesson;
  
  // 1. Đồng bộ dữ liệu (Data Binding)
  // Lấy mục tiêu từ trường objectives/muc_tieu hoặc dùng fallback
  const lessonObjective = lesson?.objectives || lesson?.muc_tieu || "Hiểu và thực hiện được các nội dung trọng tâm của bài học.";
  
  // Mapping mảng hoạt động sang định dạng bảng Phụ lục 10
  const lessonRows = (lesson?.activities || []).map((act, i) => ({
    tt: i + 1,
    noi_dung: act.segmentTitle || act.noi_dung || "",
    phut: parseInt(act.time || act.phut) || 0
  }));

  // Hàm xuất bản Word từ dữ liệu JSON hoặc HTML hiện có
  const handleExportWord = () => {
    try {
      let content = "";
      
      // Nếu lesson là HTML string (từ InteractiveLessonBuilder)
      if (typeof lesson === 'string') {
        content = lesson;
      } else if (lesson?.activities) {
        // Nếu lesson là JSON (từ LessonWizard), ta tạo một bảng đơn giản hoặc dùng cấu trúc preview
        // Ở đây ta ưu tiên lấy từ DOM nếu đang hiển thị, hoặc dựng lại HTML cơ bản
        content = document.getElementById('preview-modal-content')?.innerHTML || "";
      }

      if (!content) {
        alert("Không tìm thấy nội dung giáo án để xuất Word.");
        return;
      }

      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' 
                            xmlns:w='urn:schemas-microsoft-com:office:word' 
                            xmlns='http://www.w3.org/TR/REC-html40'>
                      <head><meta charset='utf-8'><title>Giáo Án</title>
                      <style>
                        table { border-collapse: collapse; width: 100%; }
                        td, th { border: 1px solid black; padding: 8px; font-family: "Times New Roman"; }
                      </style>
                      </head><body>`;
      const footer = "</body></html>";
      const sourceHTML = header + content + footer;

      const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `GiaoAn_${Array.from(new Set(session.contents.map(c => c.lessonName))).join('_')}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Lỗi khi xuất Word: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xl p-4 md:p-8">
      <div className="w-full max-w-4xl bg-[#1A1F2E] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-start bg-gradient-to-r from-emerald-500/5 to-transparent">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-500/30 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Đã hoàn tất</span>
              </div>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-4">
              {Array.from(new Set(session.contents.map(c => c.lessonName))).join(' & ')}
            </h2>
            <div className="flex flex-wrap gap-4 text-slate-400 text-sm font-medium">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                {new Date(session.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                {session.totalPeriods} tiết ({session.totalPeriods * 45} phút)
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar" id="preview-modal-content">
          {lesson ? (
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Mục tiêu bài học</h3>
                </div>
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {lessonObjective}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Cấu trúc hoạt động</h3>
                </div>
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                  <ul className="divide-y divide-white/5">
                    {lessonRows.map((row, index) => (
                      <li key={index} className="flex justify-between items-center py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-black border border-indigo-500/20">
                            {row.tt}
                          </span>
                          <span className="text-white font-bold text-sm tracking-tight">{row.noi_dung}</span>
                        </div>
                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest border border-white/5">
                          {row.phut} phút
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <Bot className="w-16 h-16 opacity-20" />
              <p className="font-medium text-lg italic">Dữ liệu chi tiết chưa được đồng bộ.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-white/5 flex justify-end gap-4 overflow-x-auto">
          <button 
            onClick={() => onReset && onReset(session.id)}
            className="px-6 py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold rounded-2xl border border-rose-500/30 flex items-center gap-2 transition-all active:scale-95 shrink-0"
          >
            <X className="w-5 h-5" /> HỦY & SOẠN LẠI
          </button>
          
          <button 
            onClick={onClose}
            className="px-8 py-4 rounded-2xl text-slate-400 font-bold hover:text-white transition-colors"
          >
            Đóng
          </button>
          
          <button 
            onClick={handleExportWord}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center gap-3 transition-all active:scale-95 shrink-0"
          >
            <Download className="w-5 h-5" />
            TẢI LẠI
          </button>
        </div>
      </div>
    </div>
  );
}
