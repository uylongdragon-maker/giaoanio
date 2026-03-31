'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2, Bot, User } from 'lucide-react';

export default function AssistantChat({ lessonData, apiKey, modelType, onChatUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const [hasGreeted, setHasGreeted] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Update parent with chat history
    if (onChatUpdate) {
      onChatUpdate(messages);
    }
  }, [messages]);

  // Initial greeting when lesson name is typed
  useEffect(() => {
    if (lessonData?.lessonName && lessonData.lessonName.trim().length > 5 && !hasGreeted && messages.length === 0) {
      setHasGreeted(true);
      setMessages([
        {
          role: 'assistant',
          content: `Chào bạn, mình đã nắm được bạn muốn soạn bài "${lessonData.lessonName}" theo chuẩn Phụ lục 10. Bạn có muốn nhấn mạnh phần nào trong mục tiêu bài học hoặc thêm trò chơi khởi động nào không? Hãy chia sẻ ý tưởng để mình đúc giáo án nhé!`,
        }
      ]);
    }
  }, [lessonData?.lessonName, hasGreeted, messages.length]);

  async function handleSend(e) {
    e?.preventDefault();
    if (!input.trim() || !apiKey) return;

    const userMsg = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history: messages,
          lessonData,
          apiKey,
          modelType: modelType || 'gemini-1.5-flash'
        }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch (e) {
        console.error("[AssistantChat] Lỗi parse JSON:", e);
      }

      if (!response.ok) throw new Error(data.details || data.error || `Lỗi hệ thống (HTTP ${response.status})`);

      setMessages([...newHistory, { role: 'assistant', content: data.text }]);
    } catch (err) {
      setMessages([...newHistory, { role: 'assistant', content: `❌ Lỗi: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[28px] shadow-sm border border-white/80 overflow-hidden flex flex-col h-[600px]">
      {/* Header */}
      <div className="bg-indigo-600 px-5 py-4 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-white text-base">Trợ lý Phụ lục 10</h2>
          <p className="text-white/80 text-xs font-medium">Chat để lên ý tưởng giáo án</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <Bot className="w-12 h-12 text-indigo-400 mb-3" />
            <p className="text-sm font-medium text-slate-500">Nhập tên bài học bên trái<br/>hoặc gửi tin nhắn để bắt đầu</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-100' : 'bg-slate-200'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-indigo-600" /> : <Bot className="w-4 h-4 text-slate-600" />}
              </div>
              <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-[15px] leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isTyping && (
          <div className="flex gap-3 flex-row">
            <div className="w-8 h-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center">
              <Bot className="w-4 h-4 text-slate-600" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-800 flex items-center gap-1.5 rounded-tl-sm">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 bg-white/50 border-t border-slate-100 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!apiKey || isTyping}
            placeholder={apiKey ? "Nhập ý tưởng của bạn..." : "Vui lòng nhập API Key trước"}
            className="w-full bg-slate-100/80 border-none rounded-full pl-5 pr-12 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none placeholder-slate-400 font-medium text-slate-800 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping || !apiKey}
            className="absolute right-1 top-1 bottom-1 w-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 transition-colors"
          >
            {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -ml-0.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
