'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Download, RefreshCw, Loader2, CheckCircle2, Zap, Layout, Calendar, FileText, ArrowLeft, X, Clock, UploadCloud, BookOpen, LogOut } from 'lucide-react';
import useStore from '@/app/store/useStore';
import SessionPreviewModal from '@/components/SessionPreviewModal';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const LessonRowSchema = z.object({
  segmentTitle: z.string(),
  phut: z.number(),
  noi_dung: z.string(),
  teacherAct: z.string(),
  studentAct: z.string(),
  ghi_chu: z.string().optional(),
});

const LessonSchema = z.object({
  muc_tieu: z.string(),
  lessonRows: z.array(LessonRowSchema),
});

export default function Step5Execution({ aiConfig }) {
  const { activeCourse, updateActiveCourse, resetWorkflow, prevStep } = useStore();
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('theory'); // 'theory', 'practice', 'integrated'
  const [error, setError] = useState('');
  const [previewSession, setPreviewSession] = useState(null);
  const templateInputRef = useRef(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentFinalType, setCurrentFinalType] = useState('');
  const [finalData, setFinalData] = useState(null);

  // Hàm lưu trữ giáo án vào Firebase (UID-based partitioning)
  const saveLessonToFirebase = async (lessonData) => {
    const user = auth.currentUser;
    if (!user) {
      console.warn("Người dùng chưa đăng nhập, không thể lưu Firebase!");
      return;
    }

    try {
      await addDoc(collection(db, "lessons"), {
        userId: user.uid,
        userEmail: user.email,
        title: "Giáo án AI: " + (lessonData.lessonTitle || activeCourse?.title || "Chưa đặt tên"),
        content: lessonData,
        createdAt: serverTimestamp()
      });
      console.log("✅ Đã lưu giáo án vào Firebase!");
    } catch (error) {
      console.error("🚨 Lỗi Firebase:", error);
    }
  };

  const { object, submit, isLoading: isStreaming, error: streamingError } = useObject({
    api: '/api/generate-lesson',
    schema: LessonSchema,
    onFinish: ({ object: finalObject }) => {
      if (currentSessionId && finalObject?.lessonRows) {
        // TỰ ĐỘNG CHUẨN HÓA THỜI GIAN (180 PHÚT/BUỔI) - THUẬT TOÁN SUPREME NORMALIZATION
        const targetTotal = (Number(activeCourse.schedule.find(s => s.id === currentSessionId)?.totalPeriods) || 4) * 45;
        const aiTotal = finalObject.lessonRows.reduce((sum, row) => sum + (Number(row.phut) || 0), 0);
        
        let normalizedRows = [...finalObject.lessonRows];
        if (aiTotal > 0 && aiTotal !== targetTotal) {
          console.log(`SUPREME NORMALIZING: AI ${aiTotal}m -> Target ${targetTotal}m`);
          const ratio = targetTotal / aiTotal;
          let currentRunningTotal = 0;
          
          normalizedRows = normalizedRows.map((row, index) => {
            if (index === normalizedRows.length - 1) {
               return { ...row, phut: targetTotal - currentRunningTotal };
            }
            const newPhut = Math.round((Number(row.phut) || 0) * ratio);
            currentRunningTotal += newPhut;
            return { ...row, phut: newPhut };
          });
        }

        const finalData = {
          muc_tieu: finalObject.muc_tieu,
          lessonRows: normalizedRows,
          lessonType: currentFinalType
        };

        setFinalData(finalData);
        
        const updatedSchedule = activeCourse.schedule.map(s => 
          s.id === currentSessionId ? { ...s, generatedLesson: finalData, status: 'completed', lessonType: currentFinalType } : s
        );
        updateActiveCourse({ schedule: updatedSchedule });
        
        if (previewSession?.id === currentSessionId) {
          setPreviewSession(prev => ({
            ...prev,
            generatedLesson: finalData,
            status: 'completed',
            lessonType: currentFinalType
          }));
        }
      }
    },
    onError: (err) => {
      // handled in useEffect below
    }
  });

  // PHẦN 1: BẮT DÍNH DỮ LIỆU STREAMING KHÔNG CHO BIẾN MẤT
  useEffect(() => {
    if (!isStreaming && object && object.lessonRows) {
      console.log("Stream xong! Kiểm tra và lưu dữ liệu.");
      // Đoạn này ưu tiên finalData (đã chuẩn hóa) nếu có, nếu không thì dùng object
      const dataToSave = finalData || object;
      if (!finalData) setFinalData(object);
      
      saveLessonToFirebase(dataToSave);
    }
  }, [isStreaming, object]);

  useEffect(() => {
    if (streamingError) {
      console.error("Streaming AI Error:", streamingError);
      const msg = streamingError.message.toLowerCase();
      if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted')) {
        alert("🚨 GIỚI HẠN QUOTA: API Key của bạn đã vượt quá lượt dùng miễn phí của Google (thường là 15 lần/phút). Vui lòng đợi 1 phút rồi thử lại, hoặc đổi Key khác trong phần Cấu hình!");
      } else {
        setError("Lỗi kết nối AI: " + streamingError.message);
      }
    }
  }, [streamingError]);

  const handleTemplateUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    try {
      let rawText = "";
      if (file.name.toLowerCase().endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        rawText = result.value;
      } else {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;
        // Client-side AbortController removed

        const res = await fetch('/api/generate-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: aiConfig?.apiKey,
            modelType: aiConfig?.modelType || aiConfig?.model,
            mode: 'analyze_file',
            fileData: { mimeType: file.type, data: base64Data }
          })
        });

        // No timeout clearance needed
        const data = await res.json();
        rawText = data.text || data.summary || "";
      }
      
      const newTemplates = { ...(activeCourse.lessonTemplates || {}) };
      newTemplates[activeTab] = rawText;
      updateActiveCourse({ lessonTemplates: newTemplates });
    } catch (err) {
      setError("Lỗi xử lý file mẫu: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateSchedule = async () => {
    setLoading(true);
    setError('');
    const runChromeAISchedule = async () => {
      if (!window.ai?.languageModel) {
        throw new Error("Chrome Built-in AI chưa được kích hoạt. Vui lòng bật cờ 'Built-in AI' trong chrome://flags.");
      }
      const session = await window.ai.languageModel.create();
      const prompt = `HÃY LÀ CHUYÊN GIA LẬP LỊCH GIÁO DỤC.
DỮ LIỆU: ${JSON.stringify({
        syllabus: activeCourse.syllabus,
        startDate: activeCourse.startDate,
        dayConfigs: activeCourse.dayConfigs,
        holidays: activeCourse.holidayList
      })}
YÊU CẦU: Tạo lịch buổi học (4 tiết/buổi). Trả về JSON ARRAY: [{ "id": string, "date": "YYYY-MM-DD", "sessionTitle": string, "totalPeriods": number, "contents": [{ "subItem": string, "gioLT_used": number, "gioTH_used": number }] }]`;
      const result = await session.prompt(prompt);
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : result);
    };

    try {
      const modelId = aiConfig?.modelType || aiConfig?.model || 'gemini-1.5-flash-002';
      
      if (modelId === 'chrome-nano') {
        const sessions = await runChromeAISchedule();
        updateActiveCourse({ schedule: sessions });
        return;
      }

       const res = await fetch('/api/schedule-ai', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           syllabus: activeCourse.syllabus,
           startDate: activeCourse.startDate,
           dayConfigs: activeCourse.dayConfigs,
           holidayList: activeCourse.holidayList,
           apiKey: aiConfig?.apiKey,
           modelId,
         })
       });
 

      if (!res.ok) {
        const data = await res.json();
        const msg = data.error || '';
        if (msg.includes('CẠN KIỆT AI') && window.ai?.languageModel) {
           console.log("ULTIMATE FALLBACK (SCHEDULER): API failed. Trying Chrome Nano...");
           const sessions = await runChromeAISchedule();
           updateActiveCourse({ schedule: sessions });
        } else {
           throw new Error(msg || 'Lỗi xếp lịch AI');
        }
      } else {
        const data = await res.json();
        updateActiveCourse({ schedule: data.sessions });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDetailedLesson = async (sessionParam) => {
    setLoading(true);
    setError('');
    try {
      let totalLT = 0;
      let totalTH = 0;
      sessionParam.contents.forEach(c => {
        totalLT += (parseFloat(c.gioLT) || 0);
        totalTH += (parseFloat(c.gioTH) || 0);
      });

      let finalType = sessionParam.lessonType;
      if (!finalType || finalType === 'Tự động') {
        if (totalLT > 0 && totalTH > 0) finalType = 'Tích hợp';
        else if (totalTH > 0) finalType = 'Thực hành';
        else finalType = 'Lý thuyết';
      }

      const typeKey = finalType.includes('Tích hợp') || finalType.includes('Tích hợp') ? 'integrated' : 
                      finalType.includes('Thực hành') || finalType.includes('Thực hành') ? 'practice' : 'theory';
      
      const template = (activeCourse.lessonTemplates || {})[typeKey] || "";

      setCurrentSessionId(sessionParam.id);
      setCurrentFinalType(finalType);
      const modelType = aiConfig?.modelType || aiConfig?.model;

      if (modelType === 'chrome-nano') {
        const data = await runChromeAI();
        const updatedSchedule = activeCourse.schedule.map(s => 
          s.id === sessionParam.id ? { ...s, generatedLesson: data, status: 'completed', lessonType: finalType } : s
        );
        updateActiveCourse({ schedule: updatedSchedule });
        setPreviewSession({ 
          ...sessionParam, 
          generatedLesson: data, 
          status: 'completed', 
          lessonType: finalType 
        });
      } else {
        // Validation: Check for API Key
        const userKey = aiConfig?.apiKey;
        if (!userKey) {
          alert("Vui lòng nhập API Key của Google Gemini trong phần 'Cấu hình AI' trước khi soạn!");
          setLoading(false);
          return;
        }

        setFinalData(null); // Reset before new stream

        // STREAMING VIA SDK
        const uniqueLessonNames = Array.from(new Set(sessionParam.contents.map(c => c.lessonName).filter(Boolean)));
        submit({
          apiKey: userKey,
          modelType,
          mode: 'lesson_json',
          formData: {
            lessonName: uniqueLessonNames.join(' & '),
            topics: sessionParam.contents.map(c => c.subItem),
            totalMinutes: (Number(sessionParam.totalPeriods) || 0) * 45,
            notes: (activeCourse.courseContext || "") + `\n\n[MẪU GIÁO ÁN ${finalType.toUpperCase()} RIÊNG BIỆT]:\n` + template,
            lessonType: finalType
          },
          systemPrompt: `BẠN LÀ CHUYÊN GIA BIÊN SOẠN GIÁO ÁN SƯ PHẠM ĐẲNG CẤP.
            Nhiệm vụ: Soạn giáo án CHI TIẾT loại ${finalType.toUpperCase()} dựa trên ĐỀ CƯƠNG và [MẪU GIÁO ÁN].
            CHỈ TRẢ VỀ JSON DUY NHẤT THEO SCHEMA, KHÔNG GIẢI THÍCH.`
        });
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
      setError("AI Generation Error: " + err.message);
      throw err; 
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = (sessionId) => {
    const updatedSchedule = activeCourse.schedule.map(s => 
      s.id === sessionId ? { ...s, generatedLesson: null, status: 'pending' } : s
    );
    updateActiveCourse({ schedule: updatedSchedule });
    setPreviewSession(null);
  };

  const handleSaveLesson = (sessionId, lessonData) => {
    const updatedSchedule = activeCourse.schedule.map(s => 
      s.id === sessionId ? { 
        ...s, 
        generatedLesson: lessonData, 
        status: 'completed',
        lessonType: lessonData.lessonType 
      } : s
    );
    updateActiveCourse({ schedule: updatedSchedule });
  };

  const handleSessionClick = (session) => {
    if (session.status === 'pending') {
      const emptyLesson = {
        muc_tieu: "",
        lessonRows: Array(12).fill(null).map((_, i) => ({
          segmentTitle: i === 0 ? "Ổn định lớp" : i === 1 ? "Kiểm tra bài cũ" : `Nội dung mới (Mục ${i-1})`,
          phut: i === 0 ? 5 : i === 1 ? 10 : 15,
          noi_dung: "",
          teacherAct: "",
          studentAct: ""
        }))
      };
      setPreviewSession({ ...session, generatedLesson: emptyLesson });
    } else {
      setPreviewSession(session);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-in fade-in slide-in-from-bottom-4 bg-slate-50 min-h-screen">
      <div className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-blue-500 rounded-[28px] flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3">
             <Zap className="w-8 h-8 text-white" />
           </div>
           <div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Xử lý & Xuất kết quả</h2>
             <p className="text-slate-500 font-medium text-sm">Giai đoạn cuối: AI sẽ phân bổ lịch trình và soạn chi tiết giáo án cho từng buổi.</p>
           </div>
         </div>
         <div className="flex gap-4">
            {activeCourse.schedule?.length > 0 && (
              <button 
                onClick={handleGenerateSchedule} 
                disabled={loading} 
                className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                {loading ? "ĐANG XẾP LẠI LỊCH..." : "CẬP NHẬT LỊCH DẠY"}
              </button>
            )}
            <button onClick={resetWorkflow} className="px-6 py-4 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-2xl border border-slate-200 font-bold transition-all flex items-center gap-2">
              <LogOut className="w-5 h-5" /> THOÁT
            </button>
            <button onClick={prevStep} className="px-6 py-4 bg-white hover:bg-slate-100 text-slate-500 rounded-2xl border border-slate-200 font-bold transition-all flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" /> QUAY LẠI
            </button>
         </div>
      </div>
      
      <div className="mb-10 bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
        <div className="flex bg-slate-50 border-b border-slate-100 p-2">
          {[
            { id: 'theory', label: 'Lý thuyết (PL10)', icon: BookOpen },
            { id: 'practice', label: 'Thực hành (PL11)', icon: Zap },
            { id: 'integrated', label: 'Tích hợp (PL12)', icon: Layout }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-3 text-sm font-black text-slate-800 uppercase tracking-widest">
               <FileText className="w-5 h-5 text-indigo-500" />
               GIÁO ÁN MẪU - {activeTab === 'theory' ? 'LÝ THUYẾT' : activeTab === 'practice' ? 'THỰC HÀNH' : 'TÍCH HỢP'}
            </label>
            <button 
              onClick={() => templateInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all text-[10px] border border-slate-200"
            >
              {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
              TẢI FILE MẪU ({activeTab.toUpperCase()})
            </button>
            <input 
              type="file" 
              ref={templateInputRef} 
              onChange={(e) => handleTemplateUpload(e.target.files?.[0])}
              hidden 
              accept=".docx,.pdf,.txt,image/*"
            />
          </div>
          <textarea 
            placeholder={`Dán mẫu giáo án ${activeTab === 'theory' ? 'Lý thuyết' : activeTab === 'practice' ? 'Thực hành' : 'Tích hợp'} vào đây...`}
            value={(activeCourse.lessonTemplates || {})[activeTab] || ''}
            onChange={(e) => {
              const nt = { ...(activeCourse.lessonTemplates || {}) };
              nt[activeTab] = e.target.value;
              updateActiveCourse({ lessonTemplates: nt });
            }}
            className="w-full h-32 bg-slate-50 border border-slate-100 rounded-2xl p-6 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
          />
          <p className="mt-3 text-[10px] font-medium text-slate-400 italic font-bold">
            * Hệ thống sẽ tự động chọn mẫu giáo án phù hợp dựa trên số giờ LT/TH trong đề cương môn học.
          </p>
        </div>
      </div>

      {!activeCourse.schedule || activeCourse.schedule.length === 0 ? (
        <div className="bg-white rounded-[60px] border border-slate-200 p-20 text-center relative overflow-hidden group shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent"></div>
          <div className="relative z-10 max-w-lg mx-auto">
             <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-8 border border-slate-100 group-hover:bg-indigo-600 group-hover:border-indigo-500 transition-all duration-700 shadow-2xl">
               <Loader2 className={`w-12 h-12 text-slate-400 group-hover:text-white ${loading ? 'animate-spin' : ''}`} />
             </div>
             <h3 className="text-3xl font-black text-slate-900 mb-4">Sẵn sàng Xuất Tiến Độ</h3>
             <p className="text-slate-500 font-medium mb-10 leading-relaxed">
               Hệ thống sẽ tổng hợp Lịch (B2), Dữ liệu nguồn (B3) và Đề cương (B4) để tạo ra lộ trình giảng dạy chuyên nghiệp.
             </p>
             <button 
               onClick={handleGenerateSchedule}
               disabled={loading}
               className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black px-12 py-6 rounded-3xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all active:scale-95 flex items-center gap-4 mx-auto text-xl"
             >
                {loading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <span className="text-sm font-bold opacity-80 italic">ĐANG XẾP LỊCH (180 PHÚT/BUỔI)... ĐỢI 10-20 GIÂY THẦY CÔ NHÉ!</span>
                  </div>
                ) : (
                  <>
                    <Play className="w-7 h-7" />
                    <span>BẮT ĐẦU SOẠN</span>
                  </>
                )}
             </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in zoom-in-95">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeCourse.schedule.map((session, idx) => {
              const safeContents = session.contents || [];
              const uniqueLessons = Array.from(new Set(safeContents.map(c => c.lessonName)));
              
              const processedContents = safeContents.map(c => {
                const name = (c.subItem || "").toLowerCase();
                let type = c.type || 'Lý thuyết';
                
                const isExam = name.includes("kiểm tra") || name.includes("thi") || name.includes("test") || name.includes("quiz");
                if (isExam) {
                  type = 'Thực hành';
                }
                return { ...c, type };
              });

              const totalLT = (session.contents || []).reduce((sum, c) => sum + (Number(c.gioLT_used) || 0), 0);
              const totalTH = (session.contents || []).reduce((sum, c) => sum + (Number(c.gioTH_used) || 0), 0);
              const totalKT = (session.contents || []).reduce((sum, c) => sum + (Number(c.gioKT_used) || 0), 0);
              const totalThi = (session.contents || []).reduce((sum, c) => sum + (Number(c.gioThi_used) || 0), 0);
              
              let sessionType = "LÝ THUYẾT";
              if (totalTH > 0) sessionType = "THỰC HÀNH";
              if (totalTH > 0 && totalLT > 0) sessionType = "TÍCH HỢP";
              if (totalKT > 0) sessionType = "KIỂM TRA"; 
              if (totalThi > 0) sessionType = "THI";

              return (
                <div 
                  key={session.id}
                  className={`group relative p-6 rounded-[32px] border transition-all cursor-pointer shadow-sm flex flex-col h-full bg-white ${
                    session.status === 'completed' 
                      ? 'border-emerald-200 shadow-emerald-100/50' 
                      : 'border-slate-200 hover:bg-slate-50 hover:border-indigo-200 hover:shadow-indigo-100/30'
                  }`}
                  onClick={() => handleSessionClick(session)}
                >
                  <div className="flex justify-between items-start mb-6">
                     <div className="flex flex-col gap-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{session.date ? new Date(session.date + 'T00:00:00').toLocaleDateString('vi-VN') : '---'}</p>
                       <div className="flex items-center gap-2">
                         <p className="text-xs font-black text-slate-900 uppercase">Buổi {idx + 1}</p>
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            sessionType === 'TÍCH HỢP' || sessionType === 'TÍCH HỢP' ? 'bg-indigo-600 text-white border-indigo-600' :
                            (sessionType === 'THỰC HÀNH' || sessionType === 'THỰC HÀNH') ? 'bg-amber-500 text-white border-amber-500' :
                            sessionType === 'KIỂM TRA' ? 'bg-rose-600 text-white border-rose-600' :
                            sessionType === 'THI' ? 'bg-black text-white border-black' :
                            'bg-slate-800 text-white border-slate-800'
                         }`}>
                            {sessionType}
                         </span>
                       </div>
                     </div>
                     <div className={`p-2 rounded-xl transition-colors ${
                       session.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                     }`}>
                       {session.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                     </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-base font-black text-slate-900 leading-tight mb-1 group-hover:text-indigo-600 transition-colors uppercase">
                      {session.sessionTitle || uniqueLessons.join(' & ')}
                    </h4>
                    
                    {!session.sessionTitle?.toLowerCase().includes("kiểm tra") && !session.sessionTitle?.toLowerCase().includes("thi") && (
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">Kết hợp:</span>
                        <p className="text-[9px] font-bold text-slate-500 truncate">
                          {uniqueLessons.join(', ')}
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-1.5 font-bold">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nội dung buổi học:</p>
                       {processedContents.map((c, i) => (
                         <div key={i} className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                           <span className="text-[9px] font-bold text-slate-600 truncate max-w-[120px]">
                             • {c.subItem}
                           </span>
                           <span className={`text-[8px] font-black uppercase whitespace-nowrap px-1.5 py-0.5 rounded border ${
                             (c.gioTH_used > 0 || c.subItem?.toLowerCase().includes("kiểm tra")) ? 'bg-amber-50 border-amber-100 text-amber-500' : 'bg-white border-slate-100 text-indigo-400'
                           }`}>
                             {c.gioLT_used > 0 && c.gioTH_used > 0 ? `${c.gioLT_used}LT+${c.gioTH_used}TH` : 
                              c.gioLT_used > 0 ? `${c.gioLT_used}h LT` : 
                              c.gioTH_used > 0 ? `${c.gioTH_used}h TH` : 
                              (c.subItem?.toLowerCase().includes("kiểm tra") || c.subItem?.toLowerCase().includes("thi")) ? "45P (KT)" : "GĐ"}
                           </span>
                         </div>
                       ))}
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                     <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{session.totalPeriods || 4} TIẾT (180P)</span>
                        <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border transition-all ${
                           sessionType === "TÍCH HỢP" || sessionType === "TÍCH HỢP" ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
                           (sessionType === "THỰC HÀNH" || sessionType === "THỰC HÀNH") ? "bg-amber-50 border-amber-100 text-amber-600" :
                           sessionType === "KIỂM TRA" ? "bg-rose-50 border-rose-100 text-rose-600" :
                           sessionType === "THI" ? "bg-slate-900 border-slate-700 text-white" :
                           "bg-slate-50 border-slate-100 text-slate-500"
                         }`}>
                          {sessionType}
                       </div>
                     </div>
                     {loading && previewSession?.id === session.id ? (
                       <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                     ) : (
                       <Zap 
                         className={
                           "w-4 h-4 transition-all " + 
                           (session.status === 'completed' 
                             ? "text-emerald-400 scale-110" 
                             : "text-slate-200 group-hover:text-indigo-400")
                         } 
                       />
                     )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {previewSession && (
        <SessionPreviewModal 
          isOpen={!!previewSession}
          onClose={() => setPreviewSession(null)}
          session={
            isStreaming && currentSessionId === previewSession.id && object
              ? { ...previewSession, generatedLesson: { lessonRows: object.lessonRows, muc_tieu: object.muc_tieu }, status: 'generating' }
              : (finalData && currentSessionId === previewSession.id)
                ? { ...previewSession, generatedLesson: finalData, status: 'completed' }
                : previewSession
          }
          onReset={handleResetSession}
          onSave={handleSaveLesson}
          onGenerateAI={(s) => handleGenerateDetailedLesson(s)}
          isGenerating={isStreaming && currentSessionId === previewSession.id}
        />
      )}

      {error && (
        <div className="mt-8 bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center">
          <p className="text-rose-500 font-bold uppercase tracking-widest text-[10px] mb-2">Lỗi phát sinh</p>
          <p className="text-sm text-slate-700 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
