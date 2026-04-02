'use client';

import { useState, useRef } from 'react';
import { UploadCloud, File, Image as ImageIcon, X, Loader2 } from 'lucide-react';

export default function FileUploader({ onFileSummarized, apiKey, modelType }) {
  const [file, setFile] = useState(null);
  const [isReading, setIsReading] = useState(false);
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const processFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsReading(true);

    try {
      let base64Data = null;
      let rawText = null;
      const mimeType = selectedFile.type || 'text/plain';

      if (selectedFile.name.toLowerCase().endsWith('.docx')) {
        // Trích xuất DOCX bằng mammoth ở Frontend
        const mammoth = await import('mammoth');
        const arrayBuffer = await selectedFile.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        rawText = result.value;
      } else {
        // Đối phó với PDF/Ảnh
        const base64Str = await fileToBase64(selectedFile);
        base64Data = base64Str.split(',')[1];
      }
      
      const res = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          modelType,
          mode: 'analyze_file',
          fileData: {
            mimeType,
            data: base64Data, // Dành cho hình ảnh, PDF
            rawText: rawText // Dành cho văn bản đã trích xuất (DOCX, txt)
          }
        })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error("[FileUploader] Lỗi parse JSON từ Backend:", e);
      }

      if (!res.ok) throw new Error(data.details || data.error || `Lỗi hệ thống (HTTP ${res.status})`);
      
      const resultText = data.text || data.summary;
      setSummary(resultText);
      if (onFileSummarized) onFileSummarized(resultText);

    } catch (err) {
      console.error(err);
      alert(`Lỗi đọc file: ${err.message}`);
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
    <div className="bg-white/70 backdrop-blur-xl rounded-[28px] p-6 shadow-sm border border-white/80">
      <h2 className="font-bold text-slate-800 mb-4">Tài liệu Nguồn</h2>
      
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
            <p className="text-sm text-indigo-700 font-medium">AI đang đọc & tóm tắt file...</p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <File className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">Nhấn hoặc kéo file khác để thay đổi</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-60">
            <UploadCloud className="w-12 h-12 text-slate-500" />
            <p className="text-sm font-medium text-slate-600">Kéo thả file Word (DOCX), PDF, hoặc Ảnh vào đây</p>
            <p className="text-xs text-slate-400">AI sẽ tự động học đề cương gốc để điền tự động</p>
          </div>
        )}
      </div>

      {summary && (
        <div className="mt-5 bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
          <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
            ✨ AI Tóm Tắt & Gợi ý
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  );
}
