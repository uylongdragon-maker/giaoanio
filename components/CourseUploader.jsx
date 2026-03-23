'use client';

import { useState, useRef } from 'react';
import { UploadCloud, File, Loader2, CheckCircle2 } from 'lucide-react';

export default function CourseUploader({ onCourseAnalyzed, apiKey, modelType }) {
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

      showToast("Đang gửi cho AI phân tích...", "info");

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          modelType,
          mode: 'analyze_syllabus',
          fileData: {
            mimeType,
            data: base64Data,
            rawText: rawText
          }
        })
      });

      const data = await res.json();
      console.log("[CourseUploader] AI trả về data:", data); // Debug: kiểm tra số lượng bài học

      if (!res.ok) throw new Error(data.error || 'Lỗi bóc tách từ AI');
      
      if (!data.lessons || data.lessons.length === 0) {
        throw new Error("AI không nhận diện được bài học nào. Vui lòng kiểm tra định dạng file.");
      }

      // Map to consistent lesson shape - handle all possible key names from AI
      const processedLessons = data.lessons.map((ls, idx) => {
        const theoryPeriods = Number(ls.theory ?? ls.lt ?? ls.soTietLT ?? 0);
        const practicalHours = Number(ls.practical ?? ls.th ?? ls.soGioTH ?? 0);
        const practicalPeriods = Math.round((practicalHours * 60) / 45);
        // soTiet may already be the total (from the new prompt format)
        const totalFromLs = Number(ls.totalPeriods ?? ls.soTiet ?? 0);
        const total = totalFromLs || (theoryPeriods + practicalPeriods) || 1;

        return {
          id: `lesson-${idx + 1}`,
          name: ls.name || ls.tenBai || `Bài ${idx + 1}`,
          theoryPeriods,
          practicalPeriods,
          totalPeriods: total,
          status: 'Chưa soạn'
        };
      });

      showToast(`✅ Đã nhận diện ${processedLessons.length} bài học!`, "success");
      if (onCourseAnalyzed) onCourseAnalyzed(processedLessons);

    } catch (err) {
      console.error(err);
      showToast(`Lỗi: ${err.message}`, "error");
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
            <p className="text-sm text-indigo-700 font-medium">AI đang bóc tách phân phối chương trình...</p>
            <p className="text-xs text-indigo-500/70">Quy đổi: 1h Lý thuyết = 1 tiết | 1h Thực hành = (1 × 60)/45 tiết</p>
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
