import { X, HelpCircle, BookOpen, Clock, Bot, Download } from 'lucide-react';

export default function UserGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 sm:p-8 shrink-0 flex items-start justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-white/20">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">Cẩm Nang Sử Dụng</h2>
            </div>
            <p className="text-indigo-100 font-medium ml-12">Hệ Thống Soạn Giáo Án Thông Minh</p>
          </div>

          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/10 hover:bg-black/20 text-white flex items-center justify-center transition-colors relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto customize-scrollbar bg-slate-50 relative">
          <div className="space-y-8 max-w-2xl mx-auto">
            
            {/* Step 1 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative group">
              <div className="absolute -left-3 -top-3 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white flex items-center justify-center font-black text-sm shadow-lg rotate-[-5deg] group-hover:rotate-0 transition-all">
                1
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                <span className="text-indigo-500">Khởi tạo & Nạp dữ liệu</span>
              </h3>
              <ul className="space-y-2 text-slate-600 font-medium text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>Nhập tên môn học, ngày bắt đầu và cấu hình số tiết mỗi buổi.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>Bấm <strong>"Tải lên"</strong> để hệ thống tự động đọc và trích xuất Đề cương (file Word/PDF) thành bảng phân bổ bài học. Bạn có thể sửa tay lại số tiết nếu cần.</span>
                </li>
              </ul>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative group">
              <div className="absolute -left-3 -top-3 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white flex items-center justify-center font-black text-sm shadow-lg rotate-[5deg] group-hover:rotate-0 transition-all">
                2
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                <span className="text-indigo-500">Xếp Lịch Tự Động</span>
              </h3>
              <ul className="space-y-2 text-slate-600 font-medium text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>Bấm nút <strong>"Xuất tiến độ"</strong>. Hệ thống sẽ dùng thuật toán chuẩn xác để tự động chia các bài học vào từng buổi (đảm bảo đúng quy chuẩn: 1h Lý thuyết = 45p, 1h Thực hành = 60p).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>Bạn sẽ thấy danh sách các buổi học hiện ra với nhãn màu rõ ràng (Lý thuyết, Thực hành, Tích hợp, Thi).</span>
                </li>
              </ul>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative group border-l-4 border-l-indigo-400">
              <div className="absolute -left-3 -top-3 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white flex items-center justify-center font-black text-sm shadow-lg rotate-[-5deg] group-hover:rotate-0 transition-all">
                3
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                <span className="text-indigo-500">Soạn Giáo Án Chi Tiết (AI)</span>
                <Bot className="w-5 h-5 text-indigo-400" />
              </h3>
              <ul className="space-y-2 text-slate-600 font-medium text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>Tại mỗi buổi học, bấm nút <strong>"Soạn GA"</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>Trợ lý AI sẽ tự động phân bổ thời gian (không quá 15 phút/hoạt động) và trình bày nội dung chi tiết.</span>
                </li>
                <li className="flex items-start gap-2 mt-4 bg-indigo-50 text-indigo-800 p-3 rounded-xl border border-indigo-100">
                  <span className="font-black text-indigo-600 mt-0.5 shrink-0">Lưu ý:</span>
                  <span>Bạn hoàn toàn có thể click trực tiếp vào các ô chữ để sửa nội dung, sửa số phút, hoặc bấm <strong>"+ Thêm tiểu mục"</strong> để tùy biến giáo án theo ý mình.</span>
                </li>
              </ul>
            </div>

            {/* Step 4 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative group">
              <div className="absolute -left-3 -top-3 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white flex items-center justify-center font-black text-sm shadow-lg rotate-[5deg] group-hover:rotate-0 transition-all">
                4
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                <span className="text-indigo-500">Lưu & Xuất File</span>
                <Download className="w-5 h-5 text-emerald-500" />
              </h3>
              <ul className="space-y-2 text-slate-600 font-medium text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>Khi đã ưng ý, hệ thống sẽ tự động lưu giáo án của bạn.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>Cuối cùng, bấm <strong>"Xuất Word"</strong> để tải file giáo án .docx chuẩn định dạng biểu mẫu của trường (Phụ lục 12).</span>
                </li>
              </ul>
            </div>
            
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-white p-4 border-t border-slate-100 shrink-0 flex justify-center">
           <button 
             onClick={onClose}
             className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all w-full max-w-sm shadow-lg shadow-slate-200"
           >
             Đã hiểu, Bắt đầu ngay!
           </button>
        </div>
      </div>
    </div>
  );
}
