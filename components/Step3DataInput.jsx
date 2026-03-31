'use client';

import { useState } from 'react';
import { UploadCloud, FileSpreadsheet, X, Loader2, ArrowRight, ArrowLeft, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import useStore from '@/app/store/useStore';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export default function Step3DataInput() {
  const { activeCourse, updateActiveCourse, nextStep, prevStep } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDownloadTemplate = () => {
    const header = [
      "STT", 
      "Tên bài học/Chương", 
      "Nội dung chi tiết (Đề mục)", 
      "LT", "TH", "Kiểm tra LT", "Kiểm tra TH", "Thi LT", "Thi TH"
    ];
    // Add some guiding data
    const sampleRow1 = [1, "Chương 1: Giới thiệu chung", "1.1 Khái niệm cơ bản\n1.2 Tầm quan trọng", 2, 0, 0, 0, 0, 0];
    const sampleRow2 = [2, "Bài 1: Thực hành nhập môn", "- Làm quen luồng công việc\n- Set up dự án", 0, 4, 0, 0, 0, 0];
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([header, sampleRow1, sampleRow2]);
    ws['!cols'] = [
      {wch: 5}, {wch: 30}, {wch: 40}, 
      {wch: 8}, {wch: 8}, {wch: 12}, {wch: 12}, {wch: 8}, {wch: 8}
    ];
    
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
      let parsedSyllabus = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip header row(s). Assume row 0 is header.
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0 || !row[1]) continue; 
          
          parsedSyllabus.push({
            id: `lesson-xls-${Date.now()}-${i}`,
            tenBai: row[1] ? String(row[1]) : '',
            deMuc: row[2] ? String(row[2]) : '',
            gioLT: parseFloat(row[3]) || 0,
            gioTH: parseFloat(row[4]) || 0,
            gioKLT: parseFloat(row[5]) || 0,
            gioKTH: parseFloat(row[6]) || 0,
            gioTLT: parseFloat(row[7]) || 0,
            gioTTH: parseFloat(row[8]) || 0,
            status: 'Chưa soạn'
          });
        }
      } else if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tables = doc.querySelectorAll('table');
        
        if (tables.length === 0) {
          throw new Error("Không tìm thấy bảng (table) nào trong file Word. Vui lòng dùng biểu bảng hoặc tải Mẫu Excel.");
        }
        
        // Find the largest table assuming it's the syllabus
        let targetTable = tables[0];
        for (const t of tables) {
          if (t.rows.length > targetTable.rows.length) targetTable = t;
        }
        
        // Assume format matches our Exported Word: STT | Tên bài | Đề mục | LT | TH | ...
        for (let i = 0; i < targetTable.rows.length; i++) {
          const row = targetTable.rows[i];
          const cells = row.cells;
          if (cells.length < 5) continue;
          
          const cell1Text = cells[1]?.textContent?.trim() || '';
          // Skip header row if it contains header keywords
          if (cell1Text.toLowerCase().includes("tên bài") || cell1Text.toLowerCase().includes("nội dung")) continue;
          if (!cell1Text) continue;

          parsedSyllabus.push({
            id: `lesson-word-${Date.now()}-${i}`,
            tenBai: cell1Text,
            deMuc: cells[2]?.textContent?.trim() || '',
            gioLT: parseFloat(cells[3]?.textContent) || 0,
            gioTH: parseFloat(cells[4]?.textContent) || 0,
            gioKLT: parseFloat(cells[5]?.textContent) || 0,
            gioKTH: parseFloat(cells[6]?.textContent) || 0,
            gioTLT: parseFloat(cells[7]?.textContent) || 0,
            gioTTH: parseFloat(cells[8]?.textContent) || 0,
            status: 'Chưa soạn'
          });
        }
      } else {
        throw new Error('Chỉ hỗ trợ file Excel (.xlsx) hoặc Word (.docx) chuẩn cấu trúc bảng.');
      }

      if (parsedSyllabus.length === 0) {
        throw new Error('Không bóc tách được dữ liệu. Hãy đảm bảo dùng đúng file Mẫu Tiến độ.');
      }
      
      updateActiveCourse({ 
        syllabus: parsedSyllabus,
        courseContext: `Đã tự động nạp ${parsedSyllabus.length} bài học.` 
      });
      nextStep(); // Chuyển thẳng bước 4 (Bảng Preview) vì đây là Local Automation

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-10 flex items-center justify-between">
         <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-emerald-500/20 rounded-[22px] flex items-center justify-center border border-emerald-400/20">
             <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
           </div>
           <div>
             <h2 className="text-3xl font-black text-white tracking-tight mb-1 uppercase">Cập nhật Kế hoạch Giảng dạy</h2>
             <p className="text-slate-400 font-medium text-sm">Hệ thống sẽ bóc tách bảng tự động (Local Automation) - Không tổn hao AI Quota.</p>
           </div>
         </div>
         <button onClick={prevStep} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400">
           <ArrowLeft className="w-6 h-6" />
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Lựa chọn 1: Tải Mẫu */}
        <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 p-8 flex flex-col items-center justify-center text-center shadow-xl group hover:bg-white/10 transition-all">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
            <Download className="w-10 h-10 text-emerald-500 drop-shadow-lg" />
          </div>
          <h3 className="text-xl font-black text-white mb-3">Chưa có File chuẩn?</h3>
          <p className="text-sm font-medium text-slate-400 mb-8 max-w-[280px]">
            Tải mẫu Excel đã được định dạng chuẩn xác để hệ thống có thể đọc hiểu trong 1 giây.
          </p>
          <button 
            onClick={handleDownloadTemplate}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 border border-emerald-400/50"
          >
            <Download className="w-5 h-5" /> TẢI MẪU PHÂN PHỐI
          </button>
        </div>

        {/* Lựa chọn 2: Upload File */}
        <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 overflow-hidden shadow-xl">
          <label className="relative h-full min-h-[350px] p-8 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center text-center cursor-pointer group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none"></div>
            
            <div className="w-20 h-20 bg-white/5 rounded-[28px] flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500 mb-6 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10">
              <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-indigo-400 transition-colors" />
            </div>
            
            <h3 className="text-xl font-black text-white mb-3">Tải lên File Hoàn chỉnh</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                .XLSX
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                .DOCX
              </span>
            </div>

            <input type="file" className="hidden" accept=".xlsx,.xls,.docx" onChange={handleFileUpload} disabled={loading} />
            
            {loading && (
              <div className="absolute inset-0 bg-[#0B0F19]/90 backdrop-blur-xl flex flex-col items-center justify-center gap-4 z-50">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">Đang bóc tách Local Automation...</p>
              </div>
            )}
          </label>
        </div>

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

      {activeCourse.syllabus?.length > 0 && (
        <div className="mt-8 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <div>
              <h4 className="text-sm font-black text-emerald-400 uppercase tracking-tight">Đã bóc tách {activeCourse.syllabus.length} bài học</h4>
              <p className="text-xs font-bold text-emerald-300">Không sử dụng AI (Tiết kiệm 100% Request Quota)</p>
            </div>
          </div>
          <button 
            onClick={nextStep}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            ĐẾN BẢNG CHỐT TIẾT <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
