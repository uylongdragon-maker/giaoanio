'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Upload, Sparkles, Send, CheckCircle2, 
  Download, Printer, X, Loader2, ArrowLeft, MessageSquare, 
  ChevronRight, Edit3, Save, BookOpen
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import mammoth from 'mammoth';


export default function InteractiveLessonBuilder({ sessionData, courseData, onComplete, onCancel, aiConfig }) {
  const [step, setStep] = useState(1); // 1: Template, 2: Chat, 3: Preview
  const [loading, setLoading] = useState(false);
  const [lessonTemplate, setLessonTemplate] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [lessonContent, setLessonContent] = useState(''); // NEW: For reference materials
  const [toast, setToast] = useState(null);
  
  const chatEndRef = useRef(null);
  const previewRef = useRef(null);

  // Load existing template from cloud on mount
  useEffect(() => {
    const loadTemplate = async () => {
      if (!auth.currentUser) return;
      const tRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'template');
      const tSnap = await getDoc(tRef);
      if (tSnap.exists()) {
        setLessonTemplate(tSnap.data().html);
        setStep(2); // Jump to chat if template exists
        startAIChat(tSnap.data().html);
      }
    };
    loadTemplate();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Sync session topics to lesson content on mount or change
  useEffect(() => {
    if (sessionData?.topics) {
      setLessonContent(Array.isArray(sessionData.topics) ? sessionData.topics.join(', ') : sessionData.topics);
    }
  }, [sessionData]);

  // --- STEP 1: TEMPLATE HANDLING ---
  const handleTemplateUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const htmlContent = result.value;

      if (!htmlContent) throw new Error("Không thể bóc tách nội dung từ file Word.");

      showToast("Đang bóc tách khung sườn (Skeleton) bằng AI...", "info");
      
      // NEW: Call AI to extract skeleton
      const skeletonRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'extract_skeleton',
          apiKey: aiConfig?.apiKey,
          modelType: aiConfig?.modelType || aiConfig?.model,
          fileData: { rawText: htmlContent }
        })
      });
      
      const skeletonData = await skeletonRes.json();
      if (!skeletonRes.ok) throw new Error(skeletonData.error || "Lỗi bóc tách khung sườn.");

      const skeletonHtml = skeletonData.text;
      setLessonTemplate(skeletonHtml);
      
      // Save to cloud
      if (auth.currentUser) {
        await setDoc(doc(db, 'users', auth.currentUser.uid, 'settings', 'template'), {
          html: skeletonHtml,
          updatedAt: new Date().toISOString()
        });
      }

      showToast("Đã nạp khung sườn giáo án thành công!");
      setStep(2);
      startAIChat(skeletonHtml);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 2: CHAT AI ---
  const startAIChat = async (template) => {
    const initialPrompt = `Đây là thông tin bài học từ Chương trình Đào tạo:
Bài: "${sessionData.title}".
Đề mục chi tiết: "${sessionData.topics || 'Không có'}".
Thời lượng: ${sessionData.periods} tiết (${sessionData.totalMinutes} phút).

Hãy chào thầy cô và xác nhận bạn nắm rõ các đề mục trên. Sau đó đặt 2-3 câu hỏi ngắn gọn để gợi mở ý tưởng giảng dạy.`;

    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: initialPrompt,
          history: [],
          apiKey: aiConfig?.apiKey,
          modelType: aiConfig?.modelType || aiConfig?.model,
          lessonData: {
            id: sessionData.id,
            lessonName: sessionData.title,
            totalMinutes: sessionData.totalMinutes,
            notes: sessionData.topics
          }
        })
      });
      const data = await res.json();
      if (res.ok) {
        setChatHistory([{ role: 'assistant', content: data.text || data.reply || data.content }]);
      }
    } catch (err) {
      showToast("Không thể khởi tạo chat context", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || loading) return;

    const newMsg = { role: 'user', content: userInput };
    const updatedHistory = [...chatHistory, newMsg];
    setChatHistory(updatedHistory);
    setUserInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          history: chatHistory,
          apiKey: aiConfig?.apiKey,
          modelType: aiConfig?.modelType || aiConfig?.model,
          lessonData: {
            id: sessionData.id,
            lessonName: sessionData.title,
            totalMinutes: sessionData.totalMinutes,
            lessonType: 'Lý thuyết' // Mặc định từ sessionData nếu có
          }
        })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error("Lỗi parse JSON từ server:", e);
      }

      if (!res.ok) throw new Error(data.error || `Lỗi hệ thống (HTTP ${res.status})`);

      setChatHistory([...updatedHistory, { role: 'assistant', content: data.text || data.reply || data.content }]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 3: FINAL DRAFT ---
  const compileFinalLesson = async () => {
    setLoading(true);
    try {
      const systemMsg = `Dựa vào các ý tưởng đã thống nhất trong chat, hãy đúc kết thành giáo án hoàn chỉnh. 
SỬ DỤNG KHUNG SƯỜN (SKELETON) SAU:
${lessonTemplate}

NHIỆM VỤ:
1. Giữ nguyên 100% cấu trúc bảng biểu, quốc hiệu và tiêu đề của khung sườn.
2. Sáng tạo nội dung sư phạm chuyên nghiệp để điền vào các ô trống trong bảng.
3. Nội dung phải bám sát đề mục: ${sessionData.topics || 'Không có'}.
4. Trả về mã HTML hoàn chỉnh khớp với khung sườn.`;

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: "Tiến hành soạn thảo nội dung bài giảng chi tiết dựa trên khung sườn và ý tưởng đã thống nhất.",
          history: chatHistory,
          apiKey: aiConfig?.apiKey,
          modelType: aiConfig?.modelType || aiConfig?.model,
          modelId: aiConfig?.modelType || aiConfig?.model,
          mode: 'generate',
          systemPrompt: systemMsg,
          formData: {
            lessonName: sessionData.title,
            topics: sessionData.topics,
            totalMinutes: sessionData.totalMinutes,
            lessonType: 'Lý thuyết',
            notes: lessonContent // Pass the special lesson content here
          }
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.details || data.error || `Lỗi hệ thống (HTTP ${res.status})`);

      setPreviewContent(data.text);
      setStep(3);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- EXPORT LOGIC ---
  const exportWord = () => {
    try {
      // 1. Lấy nội dung HTML từ khung Preview (ví dụ lấy qua ID hoặc State)
      const content = previewRef.current?.innerHTML || previewContent;

      // 2. Bọc HTML vào bộ khung XML chuẩn của Microsoft Word
      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' 
                            xmlns:w='urn:schemas-microsoft-com:office:word' 
                            xmlns='http://www.w3.org/TR/REC-html40'>
                      <head><meta charset='utf-8'><title>Giáo Án</title></head><body>`;
      const footer = "</body></html>";
      const sourceHTML = header + content + footer;

      // 3. Tạo Blob với BOM (\ufeff) để không bị lỗi font tiếng Việt
      const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });

      // 4. Tạo link tải xuống (Ép đuôi .doc để MS Word tự động convert)
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `GiaoAn_${sessionData.title.replace(/\s+/g, '_')}.doc`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Đã tải xuống file Word thành công!");
    } catch (err) {
      showToast("Lỗi khi xuất file Word: " + err.message, 'error');
    }
  };

  const exportPDF = () => {
    window.print();
  };

  const handleFinish = async () => {
    if (onComplete) {
      onComplete(sessionData.id, previewContent, { chatHistory });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F19] text-white font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/10 bg-white/5 backdrop-blur-3xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h2 className="text-xl font-black tracking-tight">{sessionData.title}</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Trình soạn giáo án tương tác AI
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button 
              onClick={() => { if(confirm("Bạn muốn nạp lại mẫu giáo án bài soạn?")) setStep(1); }} 
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" /> Nạp lại mẫu
            </button>
          )}
          <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
            {[1, 2, 3].map((s) => (
              <div 
                key={s}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                  step === s ? 'bg-indigo-600' : 'text-slate-500'
                }`}
              >
                {s}
              </div>
            ))}
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-rose-500/10 rounded-xl transition-all text-slate-400 hover:text-rose-500">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-50 bg-[#0B0F19]/40 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white/10 p-8 rounded-[32px] border border-white/20 flex flex-col items-center gap-4 animate-in zoom-in-95">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              <p className="text-sm font-bold text-white tracking-widest uppercase">AI đang xử lý...</p>
            </div>
          </div>
        )}

        {/* STEP 1: UPLOAD TEMPLATE */}
        {step === 1 && (
          <div className="h-full flex flex-col items-center justify-center p-10 animate-in fade-in slide-in-from-bottom-5">
            <div className="w-full max-w-xl text-center space-y-8">
              <div className="w-24 h-24 bg-indigo-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-indigo-500/20 shadow-2xl relative group">
                <div className="absolute inset-0 bg-indigo-500 blur-[30px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <Upload className="w-10 h-10 text-indigo-400 relative z-10" />
              </div>
              <div>
                <h3 className="text-3xl font-black mb-4">Nạp Mẫu Giáo Án Chuẩn</h3>
                <p className="text-slate-400 font-medium">Tải lên file Word (Phụ lục 10) để AI nắm bắt cấu trúc bảng biểu của bạn. Hệ thống sẽ lưu mẫu này cho những lần sau.</p>
              </div>
              <label className="block">
                <span className="sr-only">Chọn file Word</span>
                <input 
                  type="file" 
                  accept=".docx" 
                  onChange={handleTemplateUpload}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-4 file:px-8 file:rounded-2xl file:border-0 file:text-sm file:font-black file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}

        {/* STEP 2: CHAT INTERFACE */}
        {step === 2 && (
          <div className="h-full flex flex-col max-w-4xl mx-auto animate-in fade-in">
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[80%] p-5 rounded-[28px] text-sm font-medium shadow-xl ${
                    msg.role === 'assistant' 
                      ? 'bg-white/5 border border-white/10 text-white rounded-tl-lg' 
                      : 'bg-indigo-600 text-white rounded-tr-lg'
                  }`}>
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="px-8 py-4 border-t border-white/10 bg-white/5">
              <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <BookOpen className="w-3 h-3" /> Nội dung từ Chương trình môn học:
              </label>
              <textarea 
                value={lessonContent}
                onChange={(e) => setLessonContent(e.target.value)}
                placeholder="Nội dung này sẽ được AI sử dụng để soạn thảo chính xác..."
                className="w-full h-24 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>

            <div className="p-8 border-t border-white/10 bg-white/5 backdrop-blur-3xl">
              <form onSubmit={handleSendMessage} className="flex gap-4 items-center">
                <input 
                  type="text" 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Nhập ý tưởng của thầy/cô tại đây..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button 
                  type="submit"
                  disabled={loading || !userInput.trim()}
                  className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-90 disabled:opacity-50"
                >
                  <Send className="w-6 h-6" />
                </button>
                <button 
                  type="button"
                  onClick={compileFinalLesson}
                  className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-xl flex items-center gap-2 transition-all active:scale-95 group"
                >
                  <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  <span>SOẠN FORM CHUẨN</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW & EDIT */}
        {step === 3 && (
          <div className="h-full flex flex-col animate-in fade-in">
            <div className="flex-1 overflow-y-auto bg-slate-100 p-8 md:p-12">
              <div 
                ref={previewRef}
                 className="max-w-[210mm] document-preview-content mx-auto bg-white shadow-2xl p-[20mm] md:p-[30mm] min-h-[297mm] text-black font-['Times_New_Roman'] outline-none"
                contentEditable="true"
                dangerouslySetInnerHTML={{ __html: previewContent }}
              />
            </div>

            <div className="p-8 border-t border-white/10 bg-[#0B0F19] flex justify-between items-center sticky bottom-0 z-50">
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(2)} className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 font-bold flex items-center gap-2">
                  <ArrowLeft className="w-5 h-5" /> Sửa lại ở Chat
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <button onClick={exportWord} className="px-6 py-4 bg-white/5 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 font-bold flex items-center gap-2 transition-all">
                  <Download className="w-5 h-5" /> Xuất Word
                </button>
                <button onClick={exportPDF} className="px-6 py-4 bg-white/5 hover:bg-slate-700/50 text-slate-300 rounded-2xl border border-white/10 font-bold flex items-center gap-2 transition-all">
                  <Printer className="w-5 h-5" /> In PDF
                </button>
                <button onClick={handleFinish} className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-xl flex items-center gap-2 transition-all active:scale-95">
                  <CheckCircle2 className="w-6 h-6" /> HOÀN THÀNH
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10 ${
          toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
        }`}>
          {toast.type === 'error' ? <X className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <span className="font-bold text-sm tracking-tight">{toast.message}</span>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .max-w-\\[210mm\\] { 
            visibility: visible; 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important;
            box-shadow: none !important;
          }
          .max-w-\\[210mm\\] * { visibility: visible; }
        }
        
        .document-preview-content table[border="1"] {
          width: 100% !important;
          border-collapse: collapse !important;
          margin-bottom: 20px !important;
          border: 1px solid #000 !important;
        }
        .document-preview-content table[border="1"] th, 
        .document-preview-content table[border="1"] td {
          border: 1px solid #000 !important;
          padding: 8px !important;
          vertical-align: top !important;
        }
        .document-preview-content table[border="1"] th {
          font-weight: bold !important;
          text-align: center !important;
          background-color: #f8fafc !important;
        }
        .document-preview-content b, .document-preview-content strong {
          font-weight: bold !important;
        }
        .document-preview-content table[border="0"] {
          border: none !important;
        }
        .document-preview-content table[border="0"] td {
          border: none !important;
        }
      `}</style>
    </div>
  );
}



