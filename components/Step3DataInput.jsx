'use client';

import { useState } from 'react';
import { UploadCloud, FileSpreadsheet, X, Loader2, ArrowRight, ArrowLeft, Download, AlertCircle, CheckCircle2, Edit3, Trash2, Plus, BookOpen } from 'lucide-react';
import useStore from '@/app/store/useStore';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export default function Step3DataInput() {
  const { activeCourse, updateActiveCourse, nextStep, prevStep } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsedData, setParsedData] = useState(null);
  
  // Knowledge Base Upload State
  const [kbLoading, setKbLoading] = useState(false);
  const [knowledgeBaseText, setKnowledgeBaseText] = useState(activeCourse?.knowledgeBase || '');

  const handleDownloadTemplate = () => {
    const row1 = ["Số TT", "Tên chương, mục", "Thời gian (giờ)", "", "", "", "", "", ""];
    const row2 = ["", "", "Tổng số", "Lý thuyết", "Thực hành, thí nghiệm, thảo luận, bài tập", "KT", "", "Thi", ""];
    const row3 = ["", "", "", "", "", "LT", "TH", "LT", "TH"];
    const sampleRow4 = [1, "Bài 1: Tổng quan", 3, 3, null, null, null, null, null];
    const sampleRow5 = ["", "1. Giới thiệu Lịch sử điện ảnh", "", "", "", "", "", "", ""];
    const sampleRow6 = ["", "2. Nghệ thuật thứ 7", "", "", "", "", "", "", ""];
    const sampleRow7 = [2, "Bài 2: Thực hành cơ bản", 4, 0, 4, null, null, null, null];
    const sampleRow8 = ["", "1. Thao tác nhanh", "", "", "", "", "", "", ""];
    
    const ws = XLSX.utils.aoa_to_sheet([row1, row2, row3, sampleRow4, sampleRow5, sampleRow6, sampleRow7, sampleRow8]);
    
    ws['!merges'] = [
      { s: {r:0, c:0}, e: {r:2, c:0} }, // Số TT
      { s: {r:0, c:1}, e: {r:2, c:1} }, // Tên chương, mục
      { s: {r:0, c:2}, e: {r:0, c:8} }, // Thời gian (giờ)
      { s: {r:1, c:2}, e: {r:2, c:2} }, // Tổng số
      { s: {r:1, c:3}, e: {r:2, c:3} }, // Lý thuyết
      { s: {r:1, c:4}, e: {r:2, c:4} }, // Thực hành
      { s: {r:1, c:5}, e: {r:1, c:6} }, // KT
      { s: {r:1, c:7}, e: {r:1, c:8} }, // Thi
    ];
    ws['!cols'] = [{wch: 8}, {wch: 45}, {wch: 8}, {wch: 8}, {wch: 15}, {wch: 5}, {wch: 5}, {wch: 5}, {wch: 5}];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Phan_Phoi_CT");
    XLSX.writeFile(wb, "Mau_Phan_Phoi_Chuong_Trinh.xlsx");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    
    try {
      const fileName = file.name.toLowerCase();
      let newParsedSyllabus = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let currentLesson = null;
        let lessonIdx = 0;

        for (let i = 3; i < jsonData.length; i++) { // Bắt đầu đọc từ dòng thứ 4 (i=3) do có 3 dòng header
          const row = jsonData[i];
          if (!row || row.length === 0) continue; 
          
          const colA_STT = row[0]; 
          const colB_Name = row[1]; // Tên chương, mục
          const colC_Total = row[2]; // Tổng số
          const colD_LT = row[3]; // LT
          const colE_TH = row[4]; // TH
          const colF_KT_LT = row[5]; // KT LT
          const colG_KT_TH = row[6]; // KT TH
          const colH_Thi_LT = row[7]; // Thi LT
          const colI_Thi_TH = row[8]; // Thi TH

          if (!colB_Name) continue; // Bỏ qua dòng trống

          const name = String(colB_Name).trim();
          const total = parseFloat(colC_Total) || 0;
          const lt = parseFloat(colD_LT) || parseFloat(colF_KT_LT) || parseFloat(colH_Thi_LT) || 0;
          const th = parseFloat(colE_TH) || parseFloat(colG_KT_TH) || parseFloat(colI_Thi_TH) || 0;

          // LOGIC PHÂN BIỆT: Nếu có Tổng số giờ > 0 hoặc có Số TT -> LÀ BÀI HỌC
          if (total > 0 || (colA_STT !== undefined && colA_STT !== null && colA_STT !== "")) {
            if (currentLesson) {
              newParsedSyllabus.push(currentLesson);
            }
            lessonIdx++;
            
            currentLesson = {
              id: `parsed-${Date.now()}-${lessonIdx}`,
              tenBai: name,
              tieuMuc: [],
              gioLT: lt,
              gioTH: th,
              gioKLT: parseFloat(colF_KT_LT) || 0,
              gioKTH: parseFloat(colG_KT_TH) || 0,
              gioTLT: parseFloat(colH_Thi_LT) || 0,
              gioTTH: parseFloat(colI_Thi_TH) || 0
            };
          } 
          // LOGIC PHÂN BIỆT: Nếu Tổng số giờ rỗng (total === 0) và không có STT -> LÀ TIỂU MỤC CON
          else {
            if (currentLesson) {
              let label = name;
              // Nếu tiểu mục bắt đầu bằng số (ví dụ 1. Giới thiệu) -> Đổi thành (LessonIndex.1 Giới thiệu)
              if (label.match(/^[0-9]+[\.\)]/)) {
                 const subNum = label.match(/^([0-9]+)[\.\)]/)[1];
                 const text = label.replace(/^[0-9]+[\.\)]/, "").trim();
                 label = `${lessonIdx}.${subNum} ${text}`;
              }
              currentLesson.tieuMuc.push(label);
            }
          }
        }
        if (currentLesson) newParsedSyllabus.push(currentLesson);
        
      } else {
        throw new Error('Chỉ hỗ trợ file Excel (.xlsx) tải từ hệ thống hoặc đúng Template.');
      }

      if (newParsedSyllabus.length === 0) {
        throw new Error('Không đọc được dữ liệu. Bạn có đang phân cột đúng Mẫu 5 cột không?');
      }
      
      setParsedData(newParsedSyllabus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKBUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setKbLoading(true);
    setError('');
    try {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.docx')) {
        throw new Error("Phần Dữ Liệu Nền (Knowledge Base) chỉ nhận file WORD (.docx)");
      }
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value) {
         setKnowledgeBaseText(result.value);
         updateActiveCourse({ knowledgeBase: result.value });
      } else {
         throw new Error("Không thể rút trích văn bản từ file Word.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setKbLoading(false);
    }
  };

  const handleRowChange = (id, field, value) => {
    setParsedData(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleSubItemChange = (id, index, value) => {
    setParsedData(prev => prev.map(row => {
      if (row.id === id) {
        const newMuc = [...(row.tieuMuc || [])];
        newMuc[index] = value;
        return { ...row, tieuMuc: newMuc };
      }
      return row;
    }));
  };

  const handleAddSubItem = (id) => {
    setParsedData(prev => prev.map(row => 
      row.id === id ? { ...row, tieuMuc: [...(row.tieuMuc || []), "Tiểu mục mới"] } : row
    ));
  };

  const handleRemoveSubItem = (id, index) => {
    setParsedData(prev => prev.map(row => {
      if (row.id === id) {
        const newMuc = [...(row.tieuMuc || [])];
        newMuc.splice(index, 1);
        return { ...row, tieuMuc: newMuc };
      }
      return row;
    }));
  };

  const handleRemoveRow = (id) => {
    setParsedData(prev => prev.filter(row => row.id !== id));
  };

  const handleAddRow = () => {
    setParsedData(prev => [...(prev || []), {
      id: `parsed-${Date.now()}`,
      tenBai: "Chương/Bài học mới",
      tieuMuc: ["Tiểu mục 1"],
      tietLT: 0,
      tietTH: 0
    }]);
  };

  const handleConfirmData = () => {
    if (!parsedData || parsedData.length === 0) return;
    
    // Map data to the format expected by Step 4 and the rest of the app
    const finalSyllabus = parsedData.map(row => ({
      ...row,
      deMuc: (row.tieuMuc || []).join('\n'), // Step 4 expects deMuc string
      status: 'Chưa soạn'
    }));

    updateActiveCourse({ 
      syllabus: finalSyllabus,
      courseContext: `Đã chuẩn hóa ${finalSyllabus.length} bài học. KB size: ${knowledgeBaseText.length} chars` 
    });
    nextStep();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-emerald-500/20 rounded-[22px] flex items-center justify-center border border-emerald-400/20">
             <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
           </div>
           <div>
             <h2 className="text-3xl font-black text-white tracking-tight mb-1 uppercase">Cập nhật Kế hoạch Giảng dạy</h2>
             <p className="text-slate-400 font-medium text-sm">Toán học Local - Không AI - Tái cấu trúc chuỗi cung ứng Dữ liệu cực cứng.</p>
           </div>
         </div>
         <button onClick={prevStep} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400">
           <ArrowLeft className="w-6 h-6" />
         </button>
      </div>

      <div className="space-y-8">
        {!parsedData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 p-8 flex flex-col items-center justify-center text-center shadow-xl group hover:bg-white/10 transition-all">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                <Download className="w-10 h-10 text-emerald-500 drop-shadow-lg" />
              </div>
              <h3 className="text-xl font-black text-white mb-3">Tải Mẫu Phân Phối</h3>
              <p className="text-sm font-medium text-slate-400 mb-8 max-w-[280px]">
                Template 5 Cột cực kỳ chặt chẽ (STT | Bài | Tiểu Mục | Tiết LT | Tiết TH). 
              </p>
              <button 
                onClick={handleDownloadTemplate}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 border border-emerald-400/50"
              >
                <Download className="w-5 h-5" /> EXCEL TEMPLATE ĐÚNG CHUẨN
              </button>
            </div>

            <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 overflow-hidden shadow-xl">
              <label className="relative h-full min-h-[350px] p-8 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center text-center cursor-pointer group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none"></div>
                <div className="w-20 h-20 bg-white/5 rounded-[28px] flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500 mb-6 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10">
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                </div>
                
                <h3 className="text-xl font-black text-white mb-3">Đọc Phân Phối (.XLSX)</h3>
                <p className="text-sm font-medium text-slate-400 mb-2">Hệ thống Client JS tự đọc, không trễ API</p>

                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={loading} />
                
                {loading && (
                  <div className="absolute inset-0 bg-[#0B0F19]/90 backdrop-blur-xl flex flex-col items-center justify-center gap-4 z-50">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                    <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">Đang bóc tách Logic Toán...</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        )}

        {/* Knowledge Base Uploader */}
        <div className="bg-[#0B0F19] rounded-[32px] border border-indigo-500/30 overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
            <div className="p-8 flex flex-col items-center justify-center text-center">
               <BookOpen className="w-12 h-12 text-indigo-400 mb-3" />
               <h3 className="text-xl font-black text-white mb-2">TỪ ĐIỂN MÔN HỌC (Knowledge Base)</h3>
               <p className="text-slate-400 text-sm max-w-[600px] mb-6">
                 Bấm vào đây để tải lên "Đề cương chi tiết" chứa TOÀN BỘ KHÁI NIỆM MÔN HỌC (DOCX). AI sẽ bị nhốt vào đây và chỉ được tư duy theo những gì có trong tài liệu này! Chống Hallucination tuyệt đối.
               </p>

               {!knowledgeBaseText ? (
                 <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-8 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm inline-flex items-center gap-2">
                    <UploadCloud className="w-5 h-5"/>
                    <input type="file" className="hidden" accept=".docx" onChange={handleKBUpload} disabled={kbLoading} />
                    {kbLoading ? "ĐANG LƯU VÀO BỘ TRÍ NHỚ..." : "NẠP TỪ ĐIỂN MÔN HỌC (.DOCX)"}
                 </label>
               ) : (
                 <div className="flex flex-col items-center gap-3">
                   <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-full flex items-center justify-center gap-2">
                     <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                     <span className="text-emerald-300 font-bold text-sm">Đã nạp {Math.round(knowledgeBaseText.length / 1024)} KB tài liệu môn học!</span>
                   </div>
                   <label className="cursor-pointer text-xs font-bold text-slate-500 hover:text-indigo-400 uppercase tracking-widest transition-colors flex items-center gap-1">
                     <Edit3 className="w-3 h-3"/> ĐỔI FILE KHÁC
                     <input type="file" className="hidden" accept=".docx" onChange={handleKBUpload} disabled={kbLoading} />
                   </label>
                 </div>
               )}
            </div>
        </div>

        {/* Editable Table */}
        {parsedData && (
          <div className="bg-[#0B0F19] rounded-[32px] border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5 sticky top-0 z-10 backdrop-blur-xl">
               <div>
                  <h3 className="text-lg font-black text-white uppercase mb-1 flex items-center gap-2">
                     <Edit3 className="w-5 h-5 text-indigo-400" /> Bảng Tiến Độ
                  </h3>
                  <p className="text-sm font-medium text-slate-400">Rà soát và chỉnh sửa số lượng Tiết (LT/TH).</p>
               </div>
               <button 
                  onClick={handleConfirmData}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
               >
                  CHỐT DATA & TIẾP TỤC <ArrowRight className="w-4 h-4" />
               </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4">
               {parsedData.map((row, index) => (
                  <div key={row.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex gap-6 hover:border-white/20 transition-colors">
                     <div className="flex-1 flex flex-col gap-3">
                        <div>
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tên Bài / Chương</label>
                           <input 
                             type="text" value={row.tenBai} onChange={(e) => handleRowChange(row.id, 'tenBai', e.target.value)}
                             className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-black text-white focus:outline-none focus:border-indigo-500/50"
                           />
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Danh sách Tiểu mục</label>
                           <div className="space-y-2">
                             {(row.tieuMuc || []).map((m, mIdx) => (
                                <div key={mIdx} className="flex gap-2">
                                   <input 
                                     type="text" value={m} onChange={(e) => handleSubItemChange(row.id, mIdx, e.target.value)}
                                     className="flex-1 bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none focus:border-indigo-500/50"
                                   />
                                   <button onClick={() => handleRemoveSubItem(row.id, mIdx)} className="w-8 h-8 flex items-center justify-center text-rose-500/50 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                                </div>
                             ))}
                           </div>
                           <button onClick={() => handleAddSubItem(row.id)} className="mt-2 text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1 hover:text-indigo-300"><Plus className="w-3 h-3" /> Thêm tiểu mục</button>
                        </div>
                     </div>

                     <div className="w-40 flex flex-col gap-3 border-l border-white/5 pl-6 justify-center">
                        <div className="flex flex-col gap-1.5">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tiết LT</label>
                           <input type="number" min="0" value={row.gioLT} onChange={(e) => handleRowChange(row.id, 'gioLT', parseFloat(e.target.value) || 0)} className="w-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg px-3 py-2 text-sm font-black text-center focus:outline-none focus:border-indigo-500/50" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tiết TH</label>
                           <input type="number" min="0" value={row.gioTH} onChange={(e) => handleRowChange(row.id, 'gioTH', parseFloat(e.target.value) || 0)} className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg px-3 py-2 text-sm font-black text-center focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <button onClick={() => handleRemoveRow(row.id)} className="mt-auto flex items-center justify-center gap-2 py-2 text-rose-500/50 hover:text-rose-500 text-[10px] font-black uppercase tracking-wider transition-colors"><Trash2 className="w-3.5 h-3.5" /> Xóa Bài</button>
                     </div>
                  </div>
               ))}
               <button onClick={handleAddRow} className="w-full py-6 border-2 border-dashed border-white/10 rounded-2xl text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all font-black uppercase text-sm tracking-widest flex flex-col items-center justify-center gap-2 group"><Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />Thêm bài học tĩnh</button>
            </div>
          </div>
        )}

      </div>

      {error && (
        <div className="mt-8 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 flex items-start gap-4 animate-shake">
          <AlertCircle className="w-6 h-6 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-rose-400 uppercase tracking-tight mb-1">Thiếu cấu trúc bảng chuẩn</h4>
            <p className="text-xs font-bold text-rose-300">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
