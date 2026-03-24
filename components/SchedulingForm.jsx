'use client';

import { useState } from 'react';
import { Calendar, CheckCircle2, Sparkles, Clock } from 'lucide-react';
import { generateTimetable } from '../app/utils/scheduler';

export default function SchedulingForm({ lessons, onScheduleComplete }) {
  const [startDate, setStartDate] = useState('');
  const [dayConfigs, setDayConfigs] = useState({}); // { [dayIndex]: periods }
  const [holidays, setHolidays] = useState('');

  const daysOfWeek = [
    { label: 'Thứ 2', value: 1 },
    { label: 'Thứ 3', value: 2 },
    { label: 'Thứ 4', value: 3 },
    { label: 'Thứ 5', value: 4 },
    { label: 'Thứ 6', value: 5 },
    { label: 'Thứ 7', value: 6 },
    { label: 'Chủ Nhật', value: 0 }
  ];

  const handleDayToggle = (dayValue) => {
    setDayConfigs(prev => {
      const newConfigs = { ...prev };
      if (newConfigs[dayValue] !== undefined) {
        delete newConfigs[dayValue];
      } else {
        newConfigs[dayValue] = 3; // Default to 3 periods if none set
      }
      return newConfigs;
    });
  };

  const handlePeriodChange = (dayValue, value) => {
    setDayConfigs(prev => ({
      ...prev,
      [dayValue]: parseInt(value) || 0
    }));
  };

  const parseHolidays = () => {
    return holidays.split(',').map(h => {
      let p = h.trim().split('/');
      if (p.length === 3) {
        // Chuyển từ DD/MM/YYYY sang Date object
        const d = new Date(`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`);
        return d.toDateString();
      }
      return null;
    }).filter(h => h !== null);
  };

  const totalPeriods = lessons.reduce((sum, l) => {
    const glt = parseFloat(l.gioLT ?? l.tietLT) || 0;
    const gth = parseFloat(l.gioTH ?? l.tietTH) || 0;
    return sum + glt + (gth * (60 / 45)); // Quy đổi 60/45 cho TH/KT
  }, 0);
  
  const calculateProjectedEnd = () => {
    if (!startDate || totalPeriods === 0) return null;
    let tempDate = new Date(startDate);
    let remaining = totalPeriods;
    let safetyGuard = 0;
    const holidayList = parseHolidays();

    while (remaining > 0.01 && safetyGuard < 500) {
      const dateStr = tempDate.toDateString();
      const dayOfWeek = tempDate.getDay();
      
      if (!holidayList.includes(dateStr)) {
        const periodsToday = dayConfigs[dayOfWeek] || 0;
        remaining -= periodsToday;
      }
      
      if (remaining > 0.01) tempDate.setDate(tempDate.getDate() + 1);
      safetyGuard++;
    }
    return tempDate;
  };

  const projectedEnd = calculateProjectedEnd();

  const handleSchedule = () => {
    if (!startDate) {
      alert("Vui lòng chọn ngày bắt đầu.");
      return;
    }
    const activeDays = Object.keys(dayConfigs).map(Number);
    if (activeDays.length === 0) {
      alert("Vui lòng chọn ít nhất 1 ngày trong tuần.");
      return;
    }

    onScheduleComplete(startDate, dayConfigs, parseHolidays());
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[28px] p-6 shadow-sm border border-white/80 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-100 rounded-xl">
          <Calendar className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">Cấu hình Lịch giảng dạy Pro</h2>
          <p className="text-sm text-slate-500">Môn học có <strong>{Math.round(totalPeriods)} tiết quy đổi</strong> cần phân bổ.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-widest text-[10px]">Ngày bắt đầu</label>
            <input 
              type="date" 
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 text-slate-800 outline-none transition-all hover:bg-white"
            />
          </div>
          {projectedEnd && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex flex-col justify-center">
              <label className="block text-[10px] font-black text-emerald-600 mb-0.5 uppercase tracking-widest">Dự tính kết thúc</label>
              <p className="text-sm font-black text-emerald-800">
                {projectedEnd.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
              <p className="text-[9px] text-emerald-600/70 italic font-medium">Dựa trên cấu hình & ngày nghỉ</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-widest text-[10px]">Phân bổ tiết học hàng tuần</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {daysOfWeek.map(day => {
              const isActive = dayConfigs[day.value] !== undefined;
              return (
                <div key={day.value} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${isActive ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                  <button
                    onClick={() => handleDayToggle(day.value)}
                    className={`w-full py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}
                  >
                    {day.label}
                  </button>
                  
                  {isActive && (
                    <div className="flex items-center gap-1">
                       <input 
                         type="number" 
                         min="1" max="10"
                         value={dayConfigs[day.value]}
                         onChange={e => handlePeriodChange(day.value, e.target.value)}
                         className="w-10 bg-white border border-indigo-200 rounded-lg text-center text-xs font-black text-indigo-700 py-1"
                       />
                       <span className="text-[9px] text-indigo-400 font-bold uppercase">tiết</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
          <label className="block text-xs font-black text-rose-600 mb-2 uppercase tracking-widest">Danh hiệu Ngày nghỉ (Lễ, Tết...)</label>
          <textarea 
            placeholder="VD: 30/04/2026, 01/05/2026..."
            value={holidays}
            onChange={e => setHolidays(e.target.value)}
            rows={1}
            className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800 outline-none focus:ring-2 focus:ring-rose-500 transition-all placeholder:text-rose-300"
          />
          <p className="text-[10px] text-rose-400 mt-2 font-medium italic">* Phân tách các ngày bằng dấu phẩy theo định dạng DD/MM/YYYY</p>
        </div>

        <button
          onClick={handleSchedule}
          className="w-full bg-indigo-600 hover:bg-slate-900 text-white font-black py-5 px-6 rounded-[24px] shadow-xl shadow-indigo-100 transition-all hover:-translate-y-1 flex items-center justify-center gap-3 mt-4 group"
        >
          <Sparkles className="w-6 h-6 group-hover:animate-spin" /> 
          HOÀN TẤT & KHỞI TẠO SMART HUB
        </button>
      </div>
    </div>
  );
}
