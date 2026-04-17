'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Download, RefreshCw, Loader2, CheckCircle2, Zap, Layout, Calendar, FileText, ArrowLeft, X, Clock, UploadCloud, BookOpen, LogOut } from 'lucide-react';
import useStore from '@/app/store/useStore';
import SessionPreviewModal from '@/components/SessionPreviewModal';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { z } from 'zod';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateScheduleAlgorithm } from '@/app/utils/scheduleAlgorithm';

// Schema dong bo voi backend: AI chi tra ve hoatDongGV va hoatDongHS
const AILessonRowSchema = z.object({
  hoatDongGV: z.string(),
  hoatDongHS: z.string(),
});

const AILessonSchema = z.object({
  muc_tieu: z.string(),
  lessonRows: z.array(AILessonRowSchema),
});

export default function Step5Execution({ aiConfig }) {
  const { activeCourse, updateActiveCourse, resetWorkflow, prevStep } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewSession, setPreviewSession] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentFinalType, setCurrentFinalType] = useState('');
  const [finalData, setFinalData] = useState(null);
  const [pendingRowIndex, setPendingRowIndex] = useState(null);
  // Giữ skeleton gốc để merge với kết quả AI (tránh AI ghi đè thời gian)
  const [skeletonRef, setSkeletonRef] = useState([]);

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

  const { object: rowObject, submit: submitRow, isLoading: isRowStreaming } = useObject({
    api: '/api/generate-lesson',
    schema: AILessonRowSchema,
    onFinish: ({ object: finalRow }) => {
      if (currentSessionId && pendingRowIndex !== null && finalRow) {
        const updatedSchedule = activeCourse.schedule.map(s => {
          if (s.id === currentSessionId) {
            const newRows = [...(s.generatedLesson?.activities || s.generatedLesson?.lessonRows || [])];
            newRows[pendingRowIndex] = { 
               ...newRows[pendingRowIndex], 
               teacherAct: finalRow.hoatDongGV || newRows[pendingRowIndex]?.teacherAct,
               studentAct: finalRow.hoatDongHS || newRows[pendingRowIndex]?.studentAct,
               phut: finalRow.tgian || newRows[pendingRowIndex]?.phut
            };
            return { ...s, generatedLesson: { ...s.generatedLesson, activities: newRows, lessonRows: newRows } };
          }
          return s;
        });
        updateActiveCourse({ schedule: updatedSchedule });
        
        if (previewSession?.id === currentSessionId) {
          setPreviewSession(prev => {
            const newRows = [...(prev.generatedLesson?.activities || prev.generatedLesson?.lessonRows || [])];
            newRows[pendingRowIndex] = { ...newRows[pendingRowIndex], ...finalRow };
            return { ...prev, generatedLesson: { ...prev.generatedLesson, activities: newRows, lessonRows: newRows } };
          });
        }
        setPendingRowIndex(null);
      }
    }
  });

  const { object, submit, isLoading: isStreaming, error: streamingError } = useObject({
    api: '/api/generate-lesson',
    schema: AILessonSchema,
    onFinish: ({ object: resultObj }) => {
      if (resultObj && resultObj.lessonRows) {
        // MERGE: Chi cap nhat hoatDongGV va hoatDongHS tu AI
        // Giu nguyen tat ca cac truong khac tu skeleton goc
        const baseSkeleton = skeletonRef.length > 0 ? skeletonRef : (previewSession?.generatedLesson?.lessonRows || []);
        
        const processedRows = baseSkeleton.map((skelRow, i) => {
          const aiRow = resultObj.lessonRows[i] || {};
          return {
            ...skelRow,                              // Giu nguyen tat ca tu skeleton
            teacherAct: aiRow.hoatDongGV || skelRow.teacherAct || "",  // Chi update GV
            studentAct: aiRow.hoatDongHS || skelRow.studentAct || "",  // Chi update HS
          };
        });

        const lessonData = {
          muc_tieu: resultObj.muc_tieu || "Muc tieu bai hoc",
          lessonRows: processedRows,
          lessonType: currentFinalType
        };

        setFinalData(lessonData);
        
        const updatedSchedule = activeCourse.schedule.map(s => 
          s.id === currentSessionId ? { ...s, generatedLesson: lessonData, status: 'completed', lessonType: currentFinalType } : s
        );
        updateActiveCourse({ schedule: updatedSchedule });
        
        setPreviewSession(prev => ({
          ...prev,
          generatedLesson: lessonData,
          status: 'completed',
          lessonType: currentFinalType
        }));
      }
    },
    onError: (err) => {
      console.error("Streaming error:", err);
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

  // Removed – template upload no longer needed after UI cleanup
  const handleTemplateUpload = () => {};


  const handleGenerateSchedule = () => {
    setLoading(true);
    setError('');
    try {
      if (!activeCourse.syllabus || activeCourse.syllabus.length === 0) {
        throw new Error('Chưa có đề cương. Hãy quay lại Bước 3 để tải file phân phối chương trình.');
      }
      if (!activeCourse.startDate) {
        throw new Error('Chưa có ngày bắt đầu. Hãy quay lại Bước 2 để thiết lập lịch.');
      }
      const hasDayConfig = Object.values(activeCourse.dayConfigs || {}).some(v => v > 0);
      if (!hasDayConfig) {
        throw new Error('Chưa cấu hình thứ dạy trong tuần. Hãy quay lại Bước 2.');
      }

      // ==== THUẬT TOÁN LÕI — PURE JS, TỨC THỜI ====
      console.time('⚡ scheduleAlgorithm');
      const sessions = generateScheduleAlgorithm(
        activeCourse.syllabus,
        activeCourse.startDate,
        activeCourse.dayConfigs,
        activeCourse.holidayList || [],
        4 // 4 tiết = 180p/buổi
      );
      console.timeEnd('⚡ scheduleAlgorithm');
      console.log(`✅ Đã xếp ${sessions.length} buổi học (0 AI Quota used)`);

      if (sessions.length === 0) {
        throw new Error('Thuật toán không tạo được buổi nào. Kiểm tra lại đề cương và cấu hình ngày dạy.');
      }

      updateActiveCourse({ schedule: sessions });
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
        if (totalLT > 0 && totalTH > 0) finalType = 'Tích hợp';
        else if (totalTH > 0) finalType = 'Thực hành';
        else finalType = 'Lý thuyết';
      }

      const typeKey = finalType.includes('Tích hợp') || finalType.includes('Tích hợp') ? 'integrated' : 
                      finalType.includes('Thực hành') || finalType.includes('Thực hành') ? 'practice' : 'theory';
      
      const template = (activeCourse.lessonTemplates || {})[typeKey] || "";

      setCurrentSessionId(sessionParam.id);
      setCurrentFinalType(finalType);
      const modelType = aiConfig?.modelType || aiConfig?.model;

      if (sessionParam.targetRowIndex !== undefined) {
        // GENERATE SINGLE ROW
        const idx = sessionParam.targetRowIndex;
        const currentRows = sessionParam.currentRows || [];
        const rowData = currentRows[idx];
        setPendingRowIndex(idx);
        submitRow({
          apiKey: aiConfig?.apiKey,
          modelType,
          mode: 'lesson_row', // Optional mode, route handles it via prompt
          formData: {
            context: `Giáo án cho buổi: ${sessionParam.sessionTitle}. Loại: ${finalType}. 
                     Mục tiêu: ${sessionParam.generatedLesson?.muc_tieu || ""}. 
                     Hoạt động trước đó: ${idx > 0 ? currentRows[idx-1].segmentTitle : "Bắt đầu"}.`,
            activityTitle: rowData.segmentTitle,
            lessonType: finalType
          },
          systemPrompt: `BẠN LÀ CHUYÊN GIA BIÊN SOẠN GIÁO ÁN.
            Hãy soạn CHI TIẾT cho hoạt động: "${rowData.segmentTitle}".
            Nội dung bao gồm: Mô tả nội dung kiến thức (noi_dung), Hoạt động GV (teacherAct), Hoạt động HS (studentAct).
            Thời gian (phut) đề xuất (thường 10-20p).
            CHỈ TRẢ VỀ JSON DUY NHẤT THEO SCHEMA CHO 1 HÀNG, KHÔNG GIẢI THÍCH.`
        });
        return;
      }

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

        // Lấy skeleton từ previewSession (state này có dữ liệu do handleSessionClick tạo ra)
        const currentPreviewSession = previewSession;
        const skeleton = currentPreviewSession?.generatedLesson?.lessonRows || [];
        
        // Lưu skeleton ref để dùng trong onFinish (merge thời gian)
        setSkeletonRef(skeleton);

        // STREAMING VIA SDK
        const uniqueLessonNames = Array.from(new Set(sessionParam.contents.map(c => c.lessonName).filter(Boolean)));
        submit({
          apiKey: userKey,
          modelType,
          mode: 'lesson_json',
          formData: {
            lessonName: uniqueLessonNames.join(' & '),
            skeleton: skeleton,   // Gửi skeleton THỰC SỰ từ previewSession
            totalMinutes: (Number(sessionParam.totalPeriods) || 0) * 45,
            knowledgeBase: activeCourse.knowledgeBase || "",
            lessonType: finalType
          }
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
      const targetTotal = session.totalMinutes || 180;
      const skeleton = [];
      const subItemsText = (session.slicedSubItems || []).join(', ');
      
      const isExam = session.sessionTitle?.toLowerCase().includes("thi");

      if (isExam) {
        // TRƯỜNG HỢP THI/KIỂM TRA: Giữ nguyên khối 180p
        skeleton.push({
          segmentTitle: "1. Tổ chức Thi / Kiểm tra",
          noiDungChinh: session.sessionTitle,
          tieuMucCon: session.slicedSubItems || [],
          phut: targetTotal,
          teacherAct: "Cấp phát đề, coi thi",
          studentAct: "Làm bài tập trung"
        });
      } else {
        // TRƯỜNG HỢP HỌC TẬP: Chia theo Tiến trình sư phạm (Pedagogical Flow)
        // Ratios: Dẫn nhập(5p), Kiến thức mới(25%), Thảo luận(15%), Thực hành(40%), Kết thúc(15%)
        const introTime = 5;
        const available = targetTotal - introTime;
        
        const steps = [
          { title: "1. Dẫn nhập / Ổn định", desc: "Tạo tâm thế, kiểm tra kiến thức cũ", ratio: 0, fixed: 5 },
          { title: "2. Hình thành kiến thức mới", desc: `Giảng giải nội dung chính: ${subItemsText}`, ratio: 0.30 },
          { title: "3. Thảo luận / Vấn đáp tương tác", desc: "Phân tích sâu, giải đáp thắc mắc về nội dung bài học", ratio: 0.15 },
          { title: "4. Luyện tập / Thực hành", desc: `Vận dụng kiến thức vào bài tập: ${subItemsText}`, ratio: 0.40 },
          { title: "5. Tổng kết / Giao nhiệm vụ", desc: "Chốt kiến thức, hướng dẫn tự học", ratio: 0.15 }
        ];

        steps.forEach(step => {
          let stepPhut = step.fixed || Math.round(available * step.ratio);
          skeleton.push({
            segmentTitle: step.title,
            noiDungChinh: step.desc,
            tieuMucCon: (step.title.includes("2.") || step.title.includes("4.")) ? (session.slicedSubItems || []) : [],
            phut: stepPhut,
            teacherAct: "", studentAct: ""
          });
        });

        // Cân bằng thời gian cuối cùng
        const currentTotal = skeleton.reduce((sum, s) => sum + s.phut, 0);
        if (currentTotal !== targetTotal) {
          skeleton[skeleton.length - 1].phut += (targetTotal - currentTotal);
        }
      }

      const emptyLesson = {
        muc_tieu: "Đang chờ AI soạn mục tiêu tiêu chuẩn sư phạm...",
        lessonRows: skeleton
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
      
      <div className="mb-12 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Layout className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Cấu hình soạn bài linh hoạt</h3>
            <p className="text-xs text-slate-500 font-medium">Hệ thống đã tự động chia nhỏ buổi học thành các module hơp lý (không quá 45 phút/phần). AI sẽ tập trung soạn nội dung hoạt động cho Thầy/Cô.</p>
          </div>
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
              const sessionType = 'CHƯƠNG TRÌNH';
              const badgeColor = 'bg-blue-600';

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
                       {safeContents.map((c, i) => (
                         <div key={i} className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                           <span className="text-[9px] font-bold text-slate-600 truncate max-w-[120px]">
                             • {c.subItem}
                           </span>
                           <span className={`text-[8px] font-black uppercase whitespace-nowrap px-1.5 py-0.5 rounded border bg-white border-slate-100 text-indigo-400`}>
                             {c.allocatedMinutes}P
                           </span>
                         </div>
                       ))}
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                     <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{session.totalPeriods || 4} TIẾT (180P)</span>
                       <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg text-white transition-all bg-indigo-500`}>
                         NỘI DUNG
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
              ? { 
                  ...previewSession, 
                  generatedLesson: { 
                    ...previewSession.generatedLesson,
                    // LIVE PREVIEW: Chi update GV/HS tu AI, giu nguyen tat ca cac truong khac tu skeleton
                    lessonRows: (skeletonRef.length > 0 ? skeletonRef : (previewSession.generatedLesson?.lessonRows || [])).map((skelRow, i) => {
                      const aiRow = object?.lessonRows?.[i];
                      return {
                        ...skelRow,
                        teacherAct: aiRow?.hoatDongGV || skelRow.teacherAct || "",
                        studentAct: aiRow?.hoatDongHS || skelRow.studentAct || "",
                      };
                    })
                  }, 
                  status: 'generating' 
                }
              : (finalData && currentSessionId === previewSession.id)
                ? { ...previewSession, generatedLesson: finalData, status: 'completed' }
                : previewSession
          }
          onReset={handleResetSession}
          onSave={handleSaveLesson}
          onGenerateAI={(s) => handleGenerateDetailedLesson(s)}
          isGenerating={(isStreaming || isRowStreaming) && currentSessionId === previewSession.id}
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
