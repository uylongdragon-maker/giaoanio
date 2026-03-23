'use client';

import { useState } from 'react';
import { Calendar, CheckCircle2, Sparkles, Clock } from 'lucide-react';
import { generateTimetable } from '../app/utils/scheduler';

export default function SchedulingForm({ lessons, onScheduleComplete }) {
  const [startDate, setStartDate] = useState('');
  // dayConfigs: { [dayIndex]: periods }
  const [dayConfigs, setDayConfigs] = useState({
    1: 3, 2: 3, 3: 3, 4: 3, 5: 3
  });

  const daysOfWeek = [
    { value: 1, label: 'Thứ 2' },
    { value: 2, label: 'Thứ 3' },
    { value: 3, label: 'Thứ 4' },
    { value: 4, label: 'Thứ 5' },
    { value: 5, label: 'Thứ 6' },
    { value: 6, label: 'Thứ 7' },
    { value: 0, label: 'CN' },
  ];

  const handleDayToggle = (dayVal) => {
    const newConfigs = { ...dayConfigs };
    if (newConfigs[dayVal] !== undefined) {
      delete newConfigs[dayVal];
    } else {
      newConfigs[dayVal] = 3; // Default 3 periods
    }
    setDayConfigs(newConfigs);
  };

  const handlePeriodChange = (dayVal, val) => {
    setDayConfigs({
      ...dayConfigs,
      [dayVal]: parseInt(val) || 1
    });
  };

  const totalPeriods = lessons.reduce((sum, l) => sum + (l.tietLT || 0) + (l.tietTH || 0), 0);
  
  const calculateProjectedEnd = () => {
    if (!startDate || totalPeriods === 0) return null;
    let tempDate = new Date(startDate);
    let remaining = totalPeriods;
    let safetyGuard = 0;

    while (remaining > 0 && safetyGuard < 500) {
      const dayOfWeek = tempDate.getDay();
      const periodsToday = dayConfigs[dayOfWeek] || 0;
      remaining -= periodsToday;
      if (remaining > 0) tempDate.setDate(tempDate.getDate() + 1);
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

    const sessions = generateTimetable(lessons, startDate, dayConfigs);
    onScheduleComplete(sessions);
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[28px] p-6 shadow-sm border border-white/80 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-100 rounded-xl">
          <Calendar className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">Cấu hình Lịch giảng dạy</h2>
          <p className="text-sm text-slate-500">Môn học có <strong>{totalPeriods} tiết</strong> cần phân bổ.</p>
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
              <p className="text-[9px] text-emerald-600/70 italic font-medium">Dựa trên cấu hình bên dưới</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-widest text-[10px]">Phân bổ tiết học hàng tuần</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {daysOfWeek.map(day => {
              const isActive = dayConfigs[day.value] !== undefined;
              return (
                <div key={day.value} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${isActive ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                  <button
                    onClick={() => handleDayToggle(day.value)}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}
                  >
                    {isActive ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-[10px] font-bold">{day.label.split(' ')[1] || 'CN'}</span>}
                  </button>
                  
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${isActive ? 'text-indigo-900' : 'text-slate-400'}`}>{day.label}</p>
                    {isActive && (
                      <div className="flex items-center gap-2 mt-1">
                         <input 
                           type="number" 
                           min="1" max="10"
                           value={dayConfigs[day.value]}
                           onChange={e => handlePeriodChange(day.value, e.target.value)}
                           className="w-12 bg-white border border-indigo-200 rounded-lg text-center text-xs font-black text-indigo-700 py-1"
                         />
                         <span className="text-[10px] text-indigo-400 font-medium tracking-tight">tiết / buổi</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
