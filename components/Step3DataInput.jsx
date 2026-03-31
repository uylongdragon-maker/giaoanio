'use client';

import { useState } from 'react';
import { UploadCloud, FileText, File as FileIcon, X, Loader2, ArrowRight, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import useStore from '@/app/store/useStore';
import mammoth from 'mammoth';

export default function Step3DataInput() {
  const { activeCourse, updateActiveCourse, nextStep, prevStep } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'paste'

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    
    try {
      const fileName = file.name.toLowerCase();
      let extractedText = '';

      if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (fileName.endsWith('.pdf')) {
        // PDF-PARSE usually runs on server-side. For client-side, we might need a different approach or a server action.
        // However, the user asked for "thư viện thuần (như pdf-parse)". 
        // I will implement a fetch to a local API route to parse PDF to be safe, or try to use pdf-parse if it works in browser (it usually doesn't).
        // Let's create a simple API route for PDF parsing if needed, but for now I'll try to use a FormData upload to our current generate API if it supports it.
        // Wait, the user said "KHÔNG gọi AI ở bước bóc tách này".
        // I'll create a dedicated API route /api/parse-pdf for this.
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi bóc tách PDF');
        extractedText = data.text;
      } else if (fileName.endsWith('.txt')) {
        extractedText = await file.text();
      } else {
        throw new Error('Định dạng file không hỗ trợ (.docx, .pdf, .txt)');
      }

      if (!extractedText.trim()) throw new Error('Không tìm thấy nội dung trong file.');
      
      updateActiveCourse({ courseContext: extractedText });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-10 flex items-center justify-between">
         <div>
           <h2 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">Nhập Dữ liệu Nguồn</h2>
           <p className="text-slate-400 font-medium text-sm">Cung cấp Đề cương hoặc Chương trình môn học để AI nắm bắt nội dung chuyên môn.</p>
         </div>
         <button onClick={prevStep} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400">
           <ArrowLeft className="w-6 h-6" />
         </button>
      </div>

      <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
        <div className="flex border-b border-white/10">
          <button 
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-6 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'upload' ? 'bg-indigo-600/20 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            Tải File (.docx, .pdf, .txt)
          </button>
          <button 
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-6 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'paste' ? 'bg-indigo-600/20 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            Dán Văn bản Trực tiếp
          </button>
        </div>

        <div className="p-10">
          {activeTab === 'upload' ? (
            <div className="space-y-8">
              {!activeCourse.courseContext && (
                <label className="group relative h-[300px] rounded-[32px] border-2 border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center gap-6 cursor-pointer overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent"></div>
                  <div className="w-20 h-20 bg-white/5 rounded-[28px] flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500">
                    <UploadCloud className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-white">Bấm hoặc kéo thả file vào đây</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2 italic">Hỗ trợ: .docx, .pdf, .txt</p>
                  </div>
                  <input type="file" className="hidden" accept=".docx,.pdf,.txt" onChange={handleFileUpload} disabled={loading} />
                  {loading && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50">
                      <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                      <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">Đang bóc tách dữ liệu...</p>
                    </div>
                  )}
                </label>
              )}

              {activeCourse.courseContext && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                        <FileText className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Đã nạp dữ liệu</p>
                        <p className="text-xs font-bold text-slate-300">Nội dung đã sẵn sàng để làm mồi cho AI</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => updateActiveCourse({ courseContext: '' })}
                      className="p-3 bg-white/5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-xl border border-white/5 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 max-h-[300px] overflow-y-auto scrollbar-hide text-sm text-slate-400 leading-relaxed font-medium">
                    {activeCourse.courseContext}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <textarea 
                value={activeCourse.courseContext}
                onChange={(e) => updateActiveCourse({ courseContext: e.target.value })}
                placeholder="Dán nội dung đề cương, chương trình môn học tại đây..."
                className="w-full h-[400px] bg-white/5 border border-white/10 rounded-3xl px-8 py-6 text-slate-300 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none scrollbar-hide"
              />
            </div>
          )}

          {error && (
            <div className="mt-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              <p className="text-xs font-black text-rose-400 uppercase tracking-tight">{error}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 flex justify-end gap-6">
        <button 
          onClick={nextStep}
          disabled={!activeCourse.courseContext}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black px-12 py-5 rounded-3xl shadow-[0_15px_40px_rgba(79,70,229,0.3)] transition-all active:scale-95 flex items-center gap-3 group"
        >
          <span>CHUYỂN SANG BƯỚC 4</span>
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
