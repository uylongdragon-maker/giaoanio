'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, ArrowRight, ArrowLeft, Info, Percent } from 'lucide-react';
import useStore from '@/app/store/useStore';
import { getActualTeachingDates } from '@/app/utils/scheduler';

const DAYS_VN = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export default function Step2Scheduler() {
  const { activeCourse, updateActiveCourse, nextStep, prevStep } = useStore();
  const [newHoliday, setNewHoliday] = useState('');

  const handleConfigChange = (day, value) => {
    const newConfigs = { ...activeCourse.dayConfigs, [day]: parseInt(value) || 0 };
    updateActiveCourse({ dayConfigs: newConfigs });
  };

  const addHoliday = () => {
    if (!newHoliday) return;
    const dateISO = new Date(newHoliday).toISOString().split('T')[0];
    if (!activeCourse.holidayList.includes(dateISO)) {
      updateActiveCourse({ holidayList: [...activeCourse.holidayList, dateISO] });
    }
    setNewHoliday('');
  };

  const removeHoliday = (dateStr) => {
    updateActiveCourse({ holidayList: activeCourse.holidayList.filter(d => d !== dateStr) });
  };

  // Preview dates (assume a default of 30 periods for preview if syllabus is empty)
  const totalRequired = activeCourse.syllabus?.length > 0 
    ? activeCourse.syllabus.reduce((sum, l) => {
        const lt = parseFloat(l.gioLT) || 0;
        const others = (parseFloat(l.gioTH) || 0) + (parseFloat(l.gioKLT) || 0) + (parseFloat(l.gioKTH) || 0) + (parseFloat(l.gioTLT) || 0) + (parseFloat(l.gioTTH) || 0);
        return sum + lt + Math.round(others * 60 / 45);
      }, 0)
    : 30;

  const previewDates = getActualTeachingDates(
    activeCourse.startDate, 
    activeCourse.dayConfigs, 
    activeCourse.holidayList,
    totalRequired
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-10 flex items-center justify-between">
         <div>
           <h2 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">Cấu hình Lộ trình giảng dạy</h2>
           <p className="text-slate-400 font-medium text-sm">Thiết lập thời gian biểu và các ngày nghỉ lễ để AI tính toán lịch trình chính xác.</p>
         </div>
         <button onClick={prevStep} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400">
           <ArrowLeft className="w-6 h-6" />
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: FORM */}
        <div className="lg:col-span-2 space-y-8">
          {/* COURSE NAME */}
          <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 p-8 shadow-2xl">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 block">1. Tên môn học</label>
            <input 
              type="text"
              value={activeCourse.name}
              onChange={(e) => updateActiveCourse({ name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-3xl px-8 py-6 text-white text-xl font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="VD: Kỹ thuật Truyền hình..."
            />
          </div>

          {/* START DATE & CONFIG */}
          <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 p-8 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 block flex items-center gap-2">
                   <Calendar className="w-3 h-3" /> 2. Ngày bắt đầu
                </label>
                <input 
                  type="date"
                  value={activeCourse.startDate}
                  onChange={(e) => updateActiveCourse({ startDate: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 block flex items-center gap-2">
                   <Clock className="w-3 h-3" /> 3. Tiết dạy mỗi buổi
                </label>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between">
                   <span className="text-sm font-bold text-indigo-300 italic">Mặc định: 4 tiết = 180 phút</span>
                   <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">180'</div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Cấu hình thứ trong tuần (Số tiết dạy)</label>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <div key={d} className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-center text-slate-500">{d === 0 ? 'CN' : `T${d + 1}`}</span>
                    <input 
                      type="number"
                      min="0"
                      max="10"
                      value={activeCourse.dayConfigs[d] || 0}
                      onChange={(e) => handleConfigChange(d, e.target.value)}
                      className={`w-full bg-white/5 border rounded-xl py-3 text-center text-sm font-black transition-all ${
                        activeCourse.dayConfigs[d] > 0 ? 'border-indigo-500 text-white bg-indigo-500/10' : 'border-white/10 text-slate-600'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* HOLIDAYS */}
          <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 p-8 shadow-2xl">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 block flex items-center gap-2">
               <Info className="w-3 h-3" /> 4. Ngày nghỉ / Lễ
            </label>
            <div className="flex gap-4 mb-6">
              <input 
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button 
                onClick={addHoliday}
                className="px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl flex items-center gap-2"
              >
                <Plus className="w-5 h-5" /> THÊM
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {activeCourse.holidayList.map((dateStr) => (
                <div key={dateStr} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3 group animate-in zoom-in-95">
                  <span className="text-xs font-bold text-slate-300">
                    {new Date(dateStr + 'T00:00:00').toLocaleDateString('vi-VN')}
                  </span>
                  <button onClick={() => removeHoliday(dateStr)} className="text-slate-600 hover:text-rose-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {activeCourse.holidayList.length === 0 && (
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">Chưa có ngày nghỉ nào được chọn</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PREVIEW */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600/20 to-violet-600/20 backdrop-blur-3xl rounded-[40px] border border-indigo-500/30 p-8 shadow-2xl h-full flex flex-col">
            <div className="flex items-center gap-3 mb-8">
               <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30">
                 <Calendar className="w-5 h-5 text-indigo-400" />
               </div>
               <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Dự kiến Lịch dạy thực tế</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-hide max-h-[500px]">
              {previewDates.map((date, idx) => (
                <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Buổi {idx + 1}</span>
                    <span className="text-sm font-black text-white">
                      {date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[10px] font-black text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 group-hover:text-white transition-colors">
                    {activeCourse.dayConfigs[date.getDay()]} tiết
                  </div>
                </div>
              ))}
              {previewDates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                  <Calendar className="w-12 h-12 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">Vui lòng cấu hình ngày bắt đầu và ít nhất 1 thứ trong tuần</p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tổng dung lượng</p>
                  <p className="text-3xl font-black text-white">{previewDates.reduce((sum, d) => sum + activeCourse.dayConfigs[d.getDay()], 0)} TIẾT</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Trạng thái</p>
                   <p className="text-xs font-bold text-emerald-400">Hợp lệ để tiếp tục</p>
                </div>
              </div>

              <button 
                onClick={nextStep}
                disabled={previewDates.length === 0 || !activeCourse.name}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-6 rounded-3xl shadow-[0_15px_40px_rgba(79,70,229,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 group"
              >
                <span>TIẾP TỤC BƯỚC 3</span>
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
