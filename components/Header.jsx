import { Sparkles, Bot } from 'lucide-react';

export default function Header() {
  return (
    <header className="pt-8 pb-4 px-4 w-full flex flex-col items-center justify-center text-center">
      <div className="inline-flex items-center justify-center gap-3 bg-white/60 backdrop-blur-xl px-5 py-2.5 rounded-full shadow-sm border border-white/80 mb-4 animate-fade-in">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">
          GIÁO ÁN I.O
        </span>
      </div>
      
      <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight leading-tight mb-4 flex items-center gap-3">
        <span>Soạn giáo án với</span> 
        <span className="text-indigo-600 relative inline-block">
          AI
          <Bot className="w-6 h-6 absolute -bottom-1 -right-6 text-indigo-400 opacity-60" />
        </span>
      </h1>
      
      <p className="max-w-xl mx-auto text-sm md:text-base text-slate-500 font-medium leading-relaxed">
        Phân tích tài liệu, lập kế hoạch giảng dạy, lên kịch bản mô phỏng và **xuất bản chuẩn Phụ lục 10** với công nghệ Trí tuệ nhân tạo.
      </p>
    </header>
  );
}
