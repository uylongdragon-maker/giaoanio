'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, User, MessageSquare, PlayCircle, Loader2, CheckCircle2 } from 'lucide-react';


export default function SimulationBox({ apiKey, modelType, lessonData, onApplySimulation }) {
  const [messages, setMessages] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [visualHtml, setVisualHtml] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const runSimulation = async (scenario, type = 'chat') => {
    if (!apiKey) return alert("Vui lòng nhập API Key ở cấu hình!");
    setIsSimulating(true);
    setMessages([]); 
    setVisualHtml(null);

    try {
      const res = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          modelType,
          mode: 'simulate',
          formData: lessonData,
          scenario,
          type
        })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error("[SimulationBox] Lỗi parse JSON:", e);
      }

      if (!res.ok) throw new Error(data.details || data.error || `Lỗi hệ thống (HTTP ${res.status})`);

      // data.dialogue should be [{ role: 'teacher'|'student', content: '...' }]
      if (type === 'visual' && data.html) {
        setVisualHtml(data.html);
      } else if (Array.isArray(data.dialogue)) {
        setMessages(data.dialogue);
      } else {
        throw new Error("AI trả về sai cấu trúc mô phỏng");
      }
    } catch (err) {
      console.error(err);
      alert(`Lỗi: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const scenarios = [
    { id: 'opening', label: 'Hội thoại Mở đầu', type: 'chat', prompt: 'Học sinh rất trầm, cần GV tạo không khí sôi động đầu giờ.' },
    { id: 'visual_camera', label: '🎬 Mô phỏng Góc máy (Visual)', type: 'visual', prompt: 'Hệ thống Camera - Vẽ sơ đồ HTML/CSS minh họa 3 góc máy cơ bản (Toàn, Trung, Cận) và giải thích.' },
    { id: 'visual_lights', label: '💡 Sơ đồ Ánh sáng (Visual)', type: 'visual', prompt: 'Vẽ sơ đồ vị trí đèn 3 điểm (Key, Fill, Back light) bằng HTML/CSS đơn giản.' },
    { id: 'difficult', label: 'Tình huống sư phạm', type: 'chat', prompt: 'Một học sinh bất ngờ đặt câu hỏi ngược lại kiến thức trọng tâm.' }
  ];

  const handleApply = () => {
    if (messages.length === 0) return;
    
    // Tóm tắt lại thành chuỗi để điền vào giáo án
    let teacherContent = "";
    let studentContent = "";

    if (visualHtml) {
      teacherContent = "AI đã tạo sơ đồ trực quan (HTML/CSS).";
      studentContent = visualHtml;
    } else {
      teacherContent = messages.filter(m => m.role === 'teacher').map(m => m.content).join('\n\n');
      studentContent = messages.filter(m => m.role === 'student').map(m => m.content).join('\n\n');
    }

    if (onApplySimulation) {
      onApplySimulation({ teacherContent, studentContent });
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[28px] shadow-sm border border-white/80 overflow-hidden flex flex-col h-[600px]">
      {/* Header */}
      <div className="bg-slate-800 px-5 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <PlayCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Mô phỏng Tiết học</h2>
            <p className="text-white/80 text-xs font-medium">Role-play thực tế với AI</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 shrink-0">
        {scenarios.map(scen => (
          <button
            key={scen.id}
            disabled={isSimulating}
            onClick={() => runSimulation(scen.prompt, scen.type)}
            className={`text-xs font-semibold px-4 py-2 rounded-full transition-all disabled:opacity-50 border shadow-sm ${
              scen.type === 'visual' 
                ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-slate-900' 
                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-500 hover:text-indigo-600'
            }`}
          >
            {scen.label}
          </button>
        ))}
      </div>

      {/* Chat / Visual Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50" ref={scrollRef}>
        {!visualHtml && messages.length === 0 && !isSimulating && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <PlayCircle className="w-12 h-12 text-indigo-400 mb-3 animate-pulse" />
            <p className="text-sm font-bold text-indigo-900 uppercase tracking-widest">Smart Simulation Hub</p>
            <p className="text-xs font-medium text-slate-500 mt-1">Chọn Hội thoại hoặc Mô phỏng trực quan</p>
          </div>
        )}

        {visualHtml && (
          <div className="h-full flex flex-col gap-4 animate-in fade-in zoom-in duration-500">
             <div className="bg-emerald-100/50 border border-emerald-200 p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-800 uppercase">Sơ đồ trực quan đã sẵn sàng</span>
             </div>
             <iframe 
               srcDoc={visualHtml} 
               className="flex-1 w-full bg-white rounded-2xl border border-slate-200 shadow-inner"
               title="Visual Simulation"
             />
          </div>
        )}

        {messages.map((msg, i) => {
          const isTeacher = msg.role === 'teacher';
          return (
            <div key={i} className={`flex gap-3 ${isTeacher ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${isTeacher ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                {isTeacher ? <User className="w-4 h-4 text-indigo-600" /> : <Bot className="w-4 h-4 text-emerald-600" />}
              </div>
              <div className="flex max-w-[80%] flex-col">
                <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isTeacher ? 'text-indigo-600 text-right' : 'text-emerald-600 text-left'}`}>
                  {isTeacher ? 'Giáo viên' : 'Học sinh'}
                </span>
                <div className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                  isTeacher 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-white border border-emerald-100 text-slate-700 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}

        {isSimulating && (
          <div className="flex gap-3 flex-row justify-center mt-4">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-sm text-indigo-600 font-medium animate-pulse">AI đang dựng kịch bản...</span>
          </div>
        )}
      </div>

      {/* Footer / Apply */}
      {(messages.length > 0 || visualHtml) && !isSimulating && (
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button
            onClick={handleApply}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Áp dụng vào Giáo án
          </button>
        </div>
      )}
    </div>
  );
}
