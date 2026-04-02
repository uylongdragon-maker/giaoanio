import { useState, useEffect } from 'react';
import { X, FileText, Download, CheckCircle2, Calendar, Clock, BookOpen, Bot, Plus, Loader2, RefreshCw, Scale, Zap } from 'lucide-react';

const normalizeTime = (rows, target) => {
  const currentTotal = rows.reduce((sum, r) => sum + (Number(r.phut) || 0), 0);
  if (currentTotal === 0 || currentTotal === target) return rows;
  const ratio = target / currentTotal;
  let runningTotal = 0;
  return rows.map((r, i) => {
    if (i === rows.length - 1) return { ...r, phut: target - runningTotal };
    const newPhut = Math.round((Number(r.phut) || 0) * ratio);
    runningTotal += newPhut;
    return { ...r, phut: newPhut };
  });
};

export default function SessionPreviewModal({ isOpen, onClose, session, onReset, onSave, onGenerateAI, isGenerating: isGeneratingProp }) {
  const [editedObjective, setEditedObjective] = useState('');
  const [editedActivities, setEditedActivities] = useState([]);
  const [lessonType, setLessonType] = useState('Lý thuyết'); // 'Lý thuyết', 'Thực hành', 'Tích hợp'
  const [generating, setGenerating] = useState(false);
  const isGenerating = isGeneratingProp || generating;
  const [error, setError] = useState('');

  const totalMinutes = editedActivities.reduce((sum, act) => sum + (Number(act.phut) || 0), 0);
  const periods = Number(session?.totalPeriods) || 4;
  const targetMinutes = periods * 45;

  // Sync state when session or generatedLesson changes
  useEffect(() => {
    const lesson = session?.generatedLesson;
    setEditedObjective(lesson?.objectives || lesson?.muc_tieu || "");
    setEditedActivities(lesson?.activities || lesson?.lessonRows || []);
    
    // Content-Driven Pedagocial Classification
    const contents = session.contents || [];
    const processedSubs = contents.map(c => {
      const name = (c.subItem || "").toLowerCase();
      let type = c.type || 'Lý thuyết';
      if (name.includes("kiểm tra") || name.includes("thi") || name.includes("test") || name.includes("quiz")) {
        type = 'Thực hành';
      }
      return { ...c, type };
    });

    const subTypes = new Set(processedSubs.map(c => c.type).filter(Boolean).map(t => t.normalize('NFC')));
    let finalType = 'Lý thuyết';
    if (subTypes.size > 1) finalType = 'Tích hợp';
    else if (subTypes.has('Thực hành'.normalize('NFC'))) finalType = 'Thực hành';
    
    setLessonType(finalType);
  }, [session, session?.generatedLesson]);

  if (!isOpen || !session) return null;

  const handleUpdateActivity = (idx, field, value) => {
    const updated = [...editedActivities];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditedActivities(updated);
  };

  const addActivity = () => {
    setEditedActivities([...editedActivities, { segmentTitle: "Hoạt động mới", phut: 15, noi_dung: "", teacherAct: "", studentAct: "" }]);
  };

  const removeActivity = (idx) => {
    setEditedActivities(editedActivities.filter((_, i) => i !== idx));
  };

  const handleGenerateAI = async () => {
    if (onGenerateAI) {
      setGenerating(true);
      setError('');
      try {
        await onGenerateAI({ ...session, lessonType });
      } catch (err) {
        setError(err.message || 'Lỗi không xác định khi soạn giáo án.');
      } finally {
        setGenerating(false);
      }
    }
  };

  const handleNormalize = () => {
    const target = (Number(session?.totalPeriods) || 4) * 45;
    setEditedActivities(normalizeTime(editedActivities, target));
  };

  const handleSave = () => {
    if (onSave) {
      onSave(session.id, {
        objectives: editedObjective,
        activities: editedActivities,
        lessonType: lessonType
      });
      onClose();
    }
  };

  const handleExportWord = () => {
    try {
      const isTheory = lessonType.normalize('NFC') === 'Lý thuyết'.normalize('NFC');
      
      const rowsHtml = editedActivities.map((row, i) => `
        <tr style="min-height: 40px;">
          <td align="center" style="border: 1px solid black; padding: 10px;">${i + 1}</td>
          <td style="border: 1px solid black; padding: 10px;">
            <b>${row.segmentTitle || ""}</b><br/>
            <span style="font-size: 10pt;">${row.noi_dung || ""}</span>
          </td>
          <td style="border: 1px solid black; padding: 10px;">${row.teacherAct || ""}</td>
          <td style="border: 1px solid black; padding: 10px;">${row.studentAct || ""}</td>
          <td align="center" style="border: 1px solid black; padding: 10px;">${row.phut || 0}</td>
          <td style="border: 1px solid black; padding: 10px;"></td>
        </tr>
      `).join('');

      const contentHtml = `
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-family: 'Times New Roman';">GIÁO ÁN: ${ (session.sessionTitle || lessonType).toUpperCase() }</h2>
          <p style="margin: 5px; font-family: 'Times New Roman'; font-size: 11pt;"><i>(Kèm theo mẫu ${isTheory ? 'Phụ lục 10' : lessonType.normalize('NFC') === 'Thực hành'.normalize('NFC') ? 'Phụ lục 11' : 'Phụ lục 12'})</i></p>
        </div>

        ${(!session.sessionTitle?.toLowerCase().includes("kiểm tra") && !session.sessionTitle?.toLowerCase().includes("thi")) ? `
          <div style="margin-bottom: 15px; font-family: 'Times New Roman'; font-size: 11pt;">
            <p style="margin: 2px;"><b>Bao gồm:</b> ${Array.from(new Set(session.contents.map(c => c.lessonName))).join(', ')}</p>
          </div>
        ` : ''}

        <div style="margin-bottom: 20px;">
          <p style="font-family: 'Times New Roman';"><b>I. MỤC TIÊU BÀI HỌC:</b></p>
          <div style="margin-left: 20px; font-family: 'Times New Roman';">${editedObjective.replace(/\n/g, '<br/>')}</div>
        </div>

        <p style="font-family: 'Times New Roman';"><b>II. NỘI DUNG CHI TIẾT:</b></p>
        
        {isGenerating && (
          <div className="flex items-center gap-2 mb-3 bg-amber-50 text-amber-600 px-4 py-2 rounded-xl text-xs font-bold animate-pulse border border-amber-100 italic">
            <Zap className="w-3 h-3" />
            ĐANG ĐỒNG BỘ LUỒNG AI (REAL-TIME)...
          </div>
        )}

        <table border="1" style="border-collapse: collapse; width: 100%; font-family: 'Times New Roman'; font-size: 10pt;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th width="5%" style="border: 1px solid black; padding: 8px;">STT</th>
              <th width="25%" style="border: 1px solid black; padding: 8px;">Nội dung hoạt động</th>
              <th width="25%" style="border: 1px solid black; padding: 8px;">Hoạt động của GV</th>
              <th width="25%" style="border: 1px solid black; padding: 8px;">Hoạt động của HS</th>
              <th width="10%" style="border: 1px solid black; padding: 8px;">Thời gian (phút)</th>
              <th width="10%" style="border: 1px solid black; padding: 8px;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
      
      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                      <head><meta charset='utf-8'>
                      <style>
                        table { border-collapse: collapse; width: 100%; } 
                        td, th { border: 1px solid black; padding: 8px; vertical-align: top; }
                        h2 { text-transform: uppercase; }
                      </style>
                      </head><body>`;
      const footer = "</body></html>";
      
      const blob = new Blob(['\ufeff', header + contentHtml + footer], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `GiaoAn_${lessonType}_${session.id}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Lỗi xuất Word: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 md:p-8">
      <div className="w-full max-w-5xl bg-white rounded-[32px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`px-3 py-1 rounded-full border flex items-center gap-2 ${session.status === 'completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                {session.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {session.status === 'completed' ? 'Đã hoàn tất' : 'Chưa hoàn tất'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                {session.sessionTitle || Array.from(new Set(session.contents.map(c => c.lessonName).filter(Boolean))).join(' & ')}
              </h2>
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border shadow-sm ${
                lessonType?.normalize('NFC') === 'Tích hợp'.normalize('NFC') ? 'bg-indigo-600 text-white border-indigo-600' :
                (lessonType?.normalize('NFC') === 'Thực hành'.normalize('NFC') || session.sessionTitle?.toLowerCase().includes("kiểm tra")) ? 'bg-amber-500 text-white border-amber-500' :
                'bg-slate-800 text-white border-slate-800'
              }`}>
                {lessonType}
              </span>
            </div>
            
            {/* Hide combined lessons for exams */}
            {!session.sessionTitle?.toLowerCase().includes("kiểm tra") && !session.sessionTitle?.toLowerCase().includes("thi") && (
              <div className="flex items-center gap-2 mt-2">
                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Bao gồm:</span>
                 <p className="text-[10px] font-bold text-slate-500">
                   {Array.from(new Set(session.contents.map(c => c.lessonName).filter(Boolean))).join(', ')}
                 </p>
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-slate-500 text-xs font-bold">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3 text-indigo-500" />
                {new Date(session.date + 'T00:00:00').toLocaleDateString('vi-VN')}
              </div>
              <div className="flex items-center gap-2">
                {periods} tiết ({targetMinutes} phút)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                totalMinutes === targetMinutes 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' 
                  : totalMinutes > targetMinutes 
                    ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' 
                    : 'bg-amber-50 border-amber-200 text-amber-600'
              }`}>
                <Clock className="w-3 h-3" />
                {totalMinutes} / {targetMinutes} PHÚT
              </div>
              {totalMinutes !== targetMinutes && (
                <span className={`text-[9px] font-black mt-1 uppercase italic ${totalMinutes > targetMinutes ? 'text-rose-500' : 'text-amber-500'}`}>
                   {totalMinutes > targetMinutes ? `⚠️ LỐ BIÊN ĐỘ: +${totalMinutes - targetMinutes}p` : `⚠️ CHƯA ĐỦ: -${targetMinutes - totalMinutes}p`}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Lesson Type Selector */}
        <div className="px-8 py-3 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between">
           <div className="flex items-center gap-4">
             <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Loại giáo án:</span>
             <div className="bg-white p-1 rounded-xl border border-indigo-100 flex gap-1 shadow-sm">
               {['Lý thuyết', 'Thực hành', 'Tích hợp'].map((t) => (
                 <button
                   key={t}
                   onClick={() => setLessonType(t)}
                   className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                     lessonType === t 
                       ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                       : 'text-indigo-400 hover:bg-slate-50'
                   }`}
                 >
                   {t}
                 </button>
               ))}
             </div>
           </div>
           <p className="text-[10px] font-bold text-indigo-400 italic">
             * {lessonType === 'Lý thuyết' ? 'Mẫu Phụ lục 10' : lessonType === 'Thực hành' ? 'Mẫu Phụ lục 11' : 'Mẫu Phụ lục 12'}
           </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-white">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-in shake duration-500">
              <X className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-1">Lỗi soạn bài</p>
                <p className="text-xs text-rose-700 font-medium leading-relaxed">{error}</p>
                <p className="text-[10px] text-rose-400 mt-2 italic">* Thầy/cô thử bấm "SOẠN LẠI" sau 30s-1p nếu gặp lỗi Quota (429).</p>
              </div>
              <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="space-y-8">
            {/* Mục tiêu */}
            <section className="bg-indigo-50/30 rounded-[32px] p-6 border border-indigo-100 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-indigo-100">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">I. Mục tiêu bài học</h3>
                    <p className="text-[10px] font-bold text-indigo-400 italic">* AI tự động đề xuất dựa trên nội dung bài học</p>
                  </div>
                </div>
              </div>
              <textarea 
                value={editedObjective}
                onChange={(e) => setEditedObjective(e.target.value)}
                className="w-full bg-white rounded-2xl p-5 border border-indigo-100 text-slate-700 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[120px] shadow-inner"
                placeholder="AI sẽ soạn mục tiêu (Kiến thức, Kỹ năng, Thái độ) tại đây..."
              />
            </section>

            {/* Hoạt động - Table Layout */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest text-slate-900">II. Nội dung chi tiết ({lessonType === 'Lý thuyết' ? 'PL10' : lessonType === 'Thực hành' ? 'PL11' : 'PL12'})</h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleGenerateAI} 
                    disabled={isGenerating}
                    className={`px-4 py-2 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 text-xs ${
                      isGenerating 
                        ? 'bg-slate-400 text-slate-100 cursor-not-allowed shadow-none' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                    }`}
                  >
                    {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    {isGenerating ? "ĐANG SOẠN (VUI LÒNG ĐỢI)..." : `SOẠN LẠI ${lessonType.toUpperCase()} BẰNG AI`}
                  </button>
                  <button onClick={addActivity} className="w-9 h-9 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center border border-slate-200">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="relative border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center border-b border-slate-200">STT</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px] border-b border-slate-200">Nội dung hoạt động</th>
                      {lessonType !== 'Lý thuyết' && (
                        <>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[150px] border-b border-slate-200">Hoạt động GV</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[150px] border-b border-slate-200">Hoạt động HS</th>
                        </>
                      )}
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-center border-b border-slate-200">Thời gian</th>
                      <th className="px-4 py-3 w-10 border-b border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 relative">
                    {editedActivities.map((act, index) => (
                      <tr key={index} className={`group hover:bg-slate-50 transition-colors ${act.phut > 15 ? 'bg-rose-50/30' : ''}`}>
                        <td className="px-4 py-4 align-top text-center border-b border-slate-100">
                          <span className="text-xs font-black text-slate-300">{index + 1}</span>
                        </td>
                        <td className="px-4 py-4 align-top space-y-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                             <input 
                              type="text"
                              value={act.segmentTitle || act.noi_dung || ""}
                              onChange={(e) => handleUpdateActivity(index, 'segmentTitle', e.target.value)}
                              className="w-full bg-transparent border-none text-slate-900 font-bold text-sm outline-none focus:ring-0 p-0"
                              placeholder="Tên hoạt động..."
                            />
                            {act.phut > 15 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-rose-600 text-white text-[9px] font-black rounded-lg animate-bounce shadow-lg shadow-rose-200 whitespace-nowrap">
                                <Clock className="w-2.5 h-2.5" />
                                LỐ 15 PHÚT!
                              </div>
                            )}
                          </div>
                          <textarea 
                            value={act.noi_dung || ""}
                            onChange={(e) => handleUpdateActivity(index, 'noi_dung', e.target.value)}
                            className="w-full bg-transparent border-none text-slate-500 text-xs outline-none focus:ring-0 p-0 min-h-[40px] resize-none"
                            placeholder="Mô tả chi tiết..."
                          />
                        </td>
                        {lessonType !== 'Lý thuyết' && (
                          <>
                            <td className="px-4 py-4 align-top border-b border-slate-100">
                              <textarea 
                                value={act.teacherAct || ""}
                                onChange={(e) => handleUpdateActivity(index, 'teacherAct', e.target.value)}
                                className="w-full bg-transparent border-none text-slate-600 text-xs outline-none focus:ring-0 p-0 min-h-[60px] resize-none italic"
                                placeholder="..."
                              />
                            </td>
                            <td className="px-4 py-4 align-top border-b border-slate-100">
                              <textarea 
                                value={act.studentAct || ""}
                                onChange={(e) => handleUpdateActivity(index, 'studentAct', e.target.value)}
                                className="w-full bg-transparent border-none text-slate-600 text-xs outline-none focus:ring-0 p-0 min-h-[60px] resize-none italic"
                                placeholder="..."
                              />
                            </td>
                          </>
                        )}
                        <td className="px-4 py-4 align-top border-b border-slate-100 text-center">
                          <div className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1 border transition-all ${
                            act.phut > 15 ? 'bg-rose-100 border-rose-300 text-rose-600 shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}>
                            <input 
                              type="number" 
                              value={act.phut}
                              onChange={(e) => handleUpdateActivity(index, 'phut', parseInt(e.target.value) || 0)}
                              className="w-8 bg-transparent border-none text-center font-bold text-xs outline-none focus:ring-0 p-0"
                            />
                            <span className="text-[10px] font-black opacity-50">'</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top border-b border-slate-100 text-right">
                          <button onClick={() => removeActivity(index)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {editedActivities.length === 0 && !generating && (
                      <tr>
                        <td colSpan={lessonType === 'Lý thuyết' ? 4 : 6} className="px-4 py-12 text-center text-slate-400 italic text-sm">
                          Chưa có nội dung. Hãy thử bấm "Soạn bằng AI".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="flex flex-col">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thời lượng tổng cộng (Quy chuẩn):</span>
               <div className="flex items-center gap-2">
                 <span className={`text-xl font-black ${totalMinutes === targetMinutes ? 'text-emerald-600' : 'text-slate-900'}`}>{totalMinutes} Phút</span>
                 {totalMinutes === targetMinutes ? (
                   <div className="flex items-center gap-1 text-[9px] font-black bg-emerald-600 text-white px-3 py-1 rounded-full uppercase shadow-md shadow-emerald-100">
                     <CheckCircle2 className="w-3 h-3" /> ĐÚNG {targetMinutes}P
                   </div>
                 ) : (
                   <div className={`flex items-center gap-1 text-[9px] font-black text-white px-3 py-1 rounded-full uppercase whitespace-nowrap shadow-md ${totalMinutes > targetMinutes ? 'bg-rose-600 shadow-rose-100' : 'bg-amber-600 shadow-amber-100'}`}>
                     {totalMinutes > targetMinutes ? `LỐ ${totalMinutes - targetMinutes}P` : `THIẾU ${targetMinutes - totalMinutes}P`}
                   </div>
                 )}
               </div>
             </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {totalMinutes !== targetMinutes && (
              <button 
                onClick={handleNormalize}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95 text-xs shadow-lg shadow-amber-200 animate-pulse"
              >
                <Scale className="w-4 h-4" /> CÂN BẰNG THỜI GIAN
              </button>
            )}
            <button 
              onClick={() => onReset && onReset(session.id)}
              disabled={generating}
              className="px-5 py-3 bg-white hover:bg-rose-50 disabled:opacity-50 text-slate-400 hover:text-rose-600 font-bold rounded-xl border border-slate-200 hover:border-rose-200 flex items-center gap-2 transition-all active:scale-95 text-xs"
            >
              <RefreshCw className="w-4 h-4" /> HỦY & SOẠN LẠI
            </button>
            <button 
              onClick={handleExportWord}
              disabled={totalMinutes !== targetMinutes || generating}
              className={`flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                (totalMinutes === targetMinutes && !generating)
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-slate-100' 
                  : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" /> XUẤT WORD
            </button>
            <button 
              onClick={handleSave}
              disabled={generating}
              className="flex-1 md:flex-none px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> LƯU GIÁO ÁN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
