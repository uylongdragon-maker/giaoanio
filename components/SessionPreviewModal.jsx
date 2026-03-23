'use client';

import { X, FileText, Download, CheckCircle2, Calendar, Clock, BookOpen, Bot } from 'lucide-react';
// Note: In this project, Word export is handled in ExportButtons, 
// so we'll likely just show the summary and a close button for now, 
// or implement a simple version of the download if needed.

export default function SessionPreviewModal({ isOpen, onClose, session }) {
  if (!isOpen || !session) return null;

  const lesson = session.generatedLesson;

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
              {session.contents.map(c => c.lessonName).join(' & ')}
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
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {lesson ? (
            <div className="space-y-8">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Mục tiêu bài học</h3>
                </div>
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5 text-slate-300 text-sm leading-relaxed">
                  {lesson.objectives || "Không có dữ liệu mục tiêu."}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Cấu trúc hoạt động</h3>
                </div>
                <div className="space-y-4">
                  {lesson.activities?.map((act, i) => (
                    <div key={i} className="bg-white/5 rounded-2xl p-5 border border-white/5 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black flex-shrink-0 border border-indigo-500/20">
                        {i + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{act.time}</span>
                          <h4 className="font-bold text-white text-sm">{act.segmentTitle}</h4>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{act.detailedContent}</p>
                      </div>
                    </div>
                  ))}
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
        <div className="p-8 border-t border-white/5 bg-white/5 flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-8 py-4 rounded-2xl text-slate-400 font-bold hover:text-white transition-colors"
          >
            Đóng
          </button>
          <button 
            onClick={() => {
              // Note: The actual Word export logic would go here
              // For now we notify that this would trigger the export
              alert("Tính năng tải lại file Word đang được xử lý...");
            }}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center gap-3 transition-all active:scale-95"
          >
            <Download className="w-5 h-5" />
            TẢI LẠI FILE WORD
          </button>
        </div>
      </div>
    </div>
  );
}
