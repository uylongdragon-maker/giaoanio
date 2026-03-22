'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, User, MessageSquare, PlayCircle, Loader2, CheckCircle2 } from 'lucide-react';

export default function SimulationBox({ apiKey, modelType, lessonData, onApplySimulation }) {
  const [messages, setMessages] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const runSimulation = async (scenario) => {
    if (!apiKey) return alert("Vui lòng nhập API Key ở cấu hình!");
    setIsSimulating(true);
    setMessages([]); // Khởi tạo lại chat khi chọn tình huống mới

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          modelType,
          mode: 'simulate',
          formData: lessonData,
          scenario
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi mô phỏng');

      // data.dialogue should be [{ role: 'teacher'|'student', content: '...' }]
      if (Array.isArray(data.dialogue)) {
        setMessages(data.dialogue);
      } else {
        throw new Error("AI trả về sai cấu trúc hội thoại");
      }
    } catch (err) {
      console.error(err);
      alert(`Lỗi: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const scenarios = [
    { id: 'opening', label: 'Mô phỏng mở đầu', prompt: 'Học sinh rất trầm, cần GV tạo không khí sôi động đầu giờ.' },
    { id: 'problem', label: 'Mô phỏng giải quyết vấn đề', prompt: 'Một học sinh bất ngờ đặt câu hỏi ngược lại kiến thức trọng tâm.' },
    { id: 'difficult', label: 'Tình huống sư phạm khó', prompt: 'Đóng vai một học sinh nghịch ngợm ở phút 30 và gây rối, gợi ý cách GV xử lý.' }
  ];

  const handleApply = () => {
    if (messages.length === 0) return;
    
    // Tóm tắt lại thành chuỗi để điền vào giáo án
    const teacherContent = messages.filter(m => m.role === 'teacher').map(m => m.content).join('\n\n');
    const studentContent = messages.filter(m => m.role === 'student').map(m => m.content).join('\n\n');

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
            onClick={() => runSimulation(scen.prompt)}
            className="text-xs bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            {scen.label}
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50" ref={scrollRef}>
        {messages.length === 0 && !isSimulating && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <MessageSquare className="w-12 h-12 text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-500">Chọn một tình huống bên trên<br/>để bắt đầu mô phỏng tiết học</p>
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
      {messages.length > 0 && !isSimulating && (
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
