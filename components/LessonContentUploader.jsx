'use client';

import { useState, useRef } from 'react';
import { UploadCloud, FileText, Loader2, CheckCircle2, ChevronDown, ChevronUp, BookOpen, Sparkles, X, AlertCircle } from 'lucide-react';

/**
 * LessonContentUploader
 * Upload tài liệu bài học → AI trích chỉ mục cấu trúc (sections + keyPoints)
 * Dữ liệu này sẽ được dùng làm "grounding context" khi sinh giáo án
 * → Tiết kiệm token, tránh hallucination
 */
export default function LessonContentUploader({ apiKey, lessonName, onIndexReady }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | reading | indexing | done | error
  const [lessonIndex, setLessonIndex] = useState(null);
  const [expandedSection, setExpandedSection] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processFile(dropped);
  };

  const processFile = async (selectedFile) => {
    const allowed = ['.pdf', '.docx', '.txt', '.doc'];
    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setErrorMsg('Chỉ hỗ trợ DOCX, PDF, TXT. Vui lòng chọn lại.');
      setStatus('error');
      return;
    }

    setFile(selectedFile);
    setErrorMsg('');
    setLessonIndex(null);

    // -- Bước 1: Đọc văn bản từ file (client-side, không tốn API)
    setStatus('reading');
    let rawText = '';

    try {
      if (ext === '.docx' || ext === '.doc') {
        const mammoth = await import('mammoth');
        const buffer = await selectedFile.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        // Strip HTML tags để chỉ giữ text thuần
        rawText = result.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      } else if (ext === '.txt') {
        rawText = await selectedFile.text();
      } else if (ext === '.pdf') {
        // PDF: gửi dạng base64, backend tự xử lý với Gemini Vision lần này KHÔNG làm
        // Thay vào đó hướng dẫn user dùng DOCX/TXT nếu PDF mà không có text layer
        rawText = await extractTextFromPDF(selectedFile);
      }

      if (!rawText || rawText.trim().length < 30) {
        throw new Error('Không đọc được văn bản từ file. File có thể là ảnh scan hoặc bị mã hóa.');
      }
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
      return;
    }

    // -- Bước 2: Gọi API tạo chỉ mục (tốn rất ít token)
    setStatus('indexing');

    try {
      const res = await fetch('/api/extract-lesson-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, rawText, lessonName }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Lỗi khi tạo chỉ mục');

      setLessonIndex(data.index);
      setStatus('done');
      setExpandedSection(0);

      // Thông báo cho LessonWizard
      if (onIndexReady) {
        onIndexReady({ rawText, index: data.index });
      }
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  // Đọc PDF dạng text (chỉ hoạt động với PDF có text layer)
  const extractTextFromPDF = async (pdfFile) => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const buffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let fullText = '';
      for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';
      }
      return fullText.trim();
    } catch {
      throw new Error('Không thể đọc PDF. Vui lòng chuyển sang định dạng DOCX hoặc TXT.');
    }
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setLessonIndex(null);
    setErrorMsg('');
    if (onIndexReady) onIndexReady(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-indigo-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-indigo-50 bg-gradient-to-r from-indigo-50/80 to-transparent">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-200">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-sm text-indigo-900">Tài liệu Bài học</h3>
          <p className="text-[10px] text-indigo-500 font-medium mt-0.5">Upload giáo trình → AI lập chỉ mục → Soạn bài chính xác, ít tốn token</p>
        </div>
        {status === 'done' && (
          <button onClick={reset} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Drop zone — chỉ hiển thị khi chưa có file hoặc lỗi */}
        {(status === 'idle' || status === 'error') && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-200 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group"
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".docx,.doc,.pdf,.txt"
              onChange={handleFileChange}
            />
            <UploadCloud className="w-8 h-8 text-indigo-300 group-hover:text-indigo-500 transition-colors mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">Kéo thả hoặc click để chọn file</p>
            <p className="text-[10px] text-slate-400 mt-1">DOCX · PDF · TXT — Tối đa ~200 trang</p>
            {status === 'error' && (
              <div className="mt-3 flex items-center justify-center gap-2 text-rose-500 text-xs font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Trạng thái đang đọc / indexing */}
        {(status === 'reading' || status === 'indexing') && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
                <FileText className="w-7 h-7 text-indigo-600" />
              </div>
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin absolute -bottom-1 -right-1 bg-white rounded-full p-0.5" />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-700 text-sm">
                {status === 'reading' ? '📖 Đang đọc file...' : '🧠 AI đang lập chỉ mục...'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {status === 'reading'
                  ? 'Trích xuất văn bản từ tài liệu của thầy/cô'
                  : 'Gemini Flash phân tích cấu trúc bài học (tốn ít token)'}
              </p>
              {file && (
                <p className="text-[10px] text-indigo-500 font-medium mt-2 truncate max-w-[200px]">
                  📄 {file.name}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Kết quả: Chỉ mục bài học */}
        {status === 'done' && lessonIndex && (
          <div className="space-y-2">
            {/* Tóm tắt tổng quan */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Tóm tắt AI</span>
              </div>
              <p className="text-xs text-indigo-900 font-medium leading-relaxed">{lessonIndex.summary}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-indigo-400 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>{lessonIndex.sections?.length || 0} mục đã được lập chỉ mục từ <strong className="text-indigo-700">{file?.name}</strong></span>
              </div>
            </div>

            {/* Accordion các mục */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
              {lessonIndex.sections?.map((section, idx) => (
                <div
                  key={idx}
                  className={`border rounded-xl overflow-hidden transition-all ${
                    expandedSection === idx ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <button
                    onClick={() => setExpandedSection(expandedSection === idx ? -1 : idx)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                  >
                    <span className="text-xs font-bold text-slate-700 flex-1 pr-2 leading-snug">
                      {section.heading}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
                        {section.keyPoints?.length} ý
                      </span>
                      {expandedSection === idx
                        ? <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      }
                    </div>
                  </button>
                  {expandedSection === idx && (
                    <div className="px-3 pb-3 border-t border-indigo-100">
                      <ul className="space-y-1 mt-2">
                        {section.keyPoints?.map((kp, ki) => (
                          <li key={ki} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                            <span>{kp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Indicator dành cho generation */}
            <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-[10px] text-emerald-800 font-bold">
                Chỉ mục sẵn sàng! Khi soạn giáo án, AI sẽ dùng nội dung thực từ file thay vì tự bịa → Chính xác hơn, ít token hơn.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
