'use client';

import { useState, useRef } from 'react';
import { UploadCloud, File, Loader2, CheckCircle2, Settings } from 'lucide-react';

export default function CourseUploader({ onCourseAnalyzed, apiKey, modelId, onOpenSettings }) {
  const [file, setFile] = useState(null);
  const [isReading, setIsReading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    if (type !== 'info') {
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const processFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsReading(true);
    showToast("Đang đọc file...", "info");

    try {
      let rawText = null;
      let base64Data = null;
      const mimeType = selectedFile.type || 'application/octet-stream';
      const fileName = selectedFile.name.toLowerCase();

      if (fileName.endsWith('.docx')) {
        // ── Strategy 1: DOCX → convert to HTML to preserve table structure ──
        showToast("Đang bóc cấu trúc bảng từ file Word...", "info");
        const mammoth = await import('mammoth');
        const arrayBuffer = await selectedFile.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        rawText = result.value; // HTML string with <table>, <p>, <ul> preserved

        console.log("[CourseUploader] HTML Content trích xuất:", rawText.substring(0, 400) + "...");

        if (!rawText || rawText.trim().length < 10) {
          throw new Error("File DOCX rỗng hoặc không đọc được nội dung.");
        }

      } else if (fileName.endsWith('.txt')) {
        // ── Strategy 2: Plain text files → read directly ──
        rawText = await selectedFile.text();

      } else {
        // ── Strategy 3: PDF/Image → send as Base64 for Gemini Vision ──
        showToast("Đang chuyển file thành ảnh cho AI...", "info");
        const dataUrl = await fileToBase64(selectedFile);
        if (dataUrl && dataUrl.includes(',')) {
          base64Data = dataUrl.split(',')[1];
        } else {
          throw new Error("Không thể trích xuất dữ liệu từ file.");
        }
      }

      const runChromeAIAnalyze = async (text) => {
        if (!window.ai?.languageModel) {
          throw new Error("Chrome Built-in AI chưa được kích hoạt. Vui lòng bật cờ 'Built-in AI' trong chrome://flags.");
        }
        const session = await window.ai.languageModel.create();
        const fullPrompt = `Bạn là chuyên gia bóc tách chương trình đào tạo. 
Trích xuất danh sách bài học từ nội dung này. 
Yêu cầu JSON array: [{"tenBai": "...", "deMuc": "...", "gioLT": X, "gioTH": Y}]
Nội dung: ${text}`;
        const result = await session.prompt(fullPrompt);
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        const lessons = JSON.parse(jsonMatch ? jsonMatch[0] : result);
        return { lessons };
      };

      if (modelId === 'chrome-nano') {
        if (!rawText) throw new Error("Chrome Nano chỉ hỗ trợ đọc trực tiếp văn bản (Word/Text). Vui lòng dùng Gemini cho PDF/Ảnh.");
        data = await runChromeAIAnalyze(rawText);
      } else {
        // No client-side timeout to allow full backend processing

        const res = await fetch('/api/analyze-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            modelId,
            mode: 'analyze_syllabus',
            fileData: {
              mimeType,
              data: base64Data,
              rawText: rawText
            }
          })
        });

        // No timeout clearance needed

        try {
          data = await res.json();
        } catch (e) {
          console.error("[CourseUploader] Lỗi parse JSON từ Backend:", e);
        }

        if (!res.ok) {
          const errMsg = data.error || '';
          if (errMsg.includes('CẠN KIỆT AI') && window.ai?.languageModel && rawText) {
            console.log("ULTIMATE SYLLABUS FALLBACK: API failed. Trying Chrome Nano...");
            data = await runChromeAIAnalyze(rawText);
          } else {
            throw new Error(errMsg || `Lỗi bóc tách từ AI (HTTP ${res.status})`);
          }
        }
      }
      
      if (!data.lessons || data.lessons.length === 0) {
        throw new Error("AI không nhận diện được bài học nào. Vui lòng kiểm tra định dạng file.");
      }

      showToast(`✅ Đã nhận diện ${data.lessons.length} bài học!`, "success");
      if (onCourseAnalyzed) onCourseAnalyzed(data.lessons);

    } catch (err) {
      console.error(err);
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        showToast("Yêu cầu bị ngắt (AbortError). Vui lòng kiểm tra kết nối mạng.", "error");
      } else {
        showToast(`Lỗi: ${err.message}`, "error");
      }
      setFile(null);
    } finally {
      setIsReading(false);
    }
  };

  const fileToBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[28px] p-6 shadow-sm border border-white/80 relative">
      <button 
        onClick={onOpenSettings}
        className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/50 hover:bg-white/80 border border-slate-200/50 hover:border-indigo-200 transition-all text-[10px] font-bold text-slate-500 hover:text-indigo-600 backdrop-blur-sm shadow-sm z-10"
      >
        <Settings className="w-3.5 h-3.5" /> Cài đặt API Key
      </button>

      {/* Toast Notification */}
      {toast && (
        <div className={`absolute -top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 ${
          toast.type === 'error' ? 'bg-rose-500 text-white' :
          toast.type === 'success' ? 'bg-emerald-500 text-white' :
          'bg-indigo-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-slate-800">Khởi Tạo Môn Học</h2>
        <p className="text-sm text-slate-500 mt-1">Tải lên Đề cương chi tiết hoặc Chương trình môn học</p>
      </div>
      
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isReading ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50'}`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          hidden 
          accept=".pdf,image/*,.txt,.doc,.docx"
          onChange={(e) => processFile(e.target.files?.[0])} 
        />
        
        {isReading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-sm text-indigo-700 font-medium italic">Đang bóc tách phân phối chương trình... Có thể mất 1-2 phút, thầy cô kiên nhẫn nhé!</p>
            <p className="text-xs text-indigo-500/70 text-balance px-4">Quy đổi: Tiết LT = Giờ LT | Tiết TH = (Giờ TH + Giờ KT) × 60/45</p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">Click để tải lại file khác</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-60">
            <UploadCloud className="w-12 h-12 text-slate-500" />
            <p className="text-sm font-medium text-slate-600">Kéo thả file Đề cương (DOCX, PDF, Ảnh) vào đây</p>
            <p className="text-xs text-slate-400">AI sẽ tự động đọc bài học và tính số tiết chuẩn</p>
          </div>
        )}
      </div>
    </div>
  );
}
