'use client';

import { Plus, BookOpen, Trash2, ArrowRight, Clock, Star, LayoutGrid, List } from 'lucide-react';
import useStore from '@/app/store/useStore';
import { useState } from 'react';

export default function Dashboard() {
  const { courses, setActiveCourse, deleteCourse, addCourse } = useStore();
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  const handleCreateNew = () => {
    const id = `course-${Date.now()}`;
    const newCourse = {
      id,
      name: 'Môn học mới',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      status: 'draft',
      startDate: new Date().toISOString().split('T')[0],
      dayConfigs: { 1: 4, 3: 4 }, // Default Mon, Wed 4 periods
      holidayList: [],
      syllabus: [],
      schedule: [],
      courseContext: ''
    };
    addCourse(newCourse);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Quản lý Môn học</h1>
          <p className="text-slate-400 font-medium">Chào mừng trở lại! Bạn muốn tiếp tục bài giảng nào?</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* CREATE NEW CARD */}
        <button 
          onClick={handleCreateNew}
          className="group relative h-[280px] rounded-[40px] border-2 border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center gap-4 active:scale-95 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center border border-white/5 group-hover:bg-indigo-600 group-hover:border-indigo-500 group-hover:scale-110 transition-all duration-500 shadow-xl">
            <Plus className="w-8 h-8 text-slate-400 group-hover:text-white transition-colors" />
          </div>
          <div className="text-center relative z-10">
            <span className="text-lg font-black text-white block">Tạo Môn học mới</span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Khởi tạo nhanh workflow</span>
          </div>
        </button>

        {/* COURSE CARDS */}
        {courses.map((course) => (
          <div 
            key={course.id}
            className="group relative h-[280px] bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 p-8 flex flex-col justify-between hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-2 cursor-pointer shadow-2xl overflow-hidden"
            onClick={() => setActiveCourse(course)}
          >
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/20 transition-all"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-400/20">
                  <BookOpen className="w-6 h-6 text-indigo-400" />
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Xóa môn học này?')) deleteCourse(course.id);
                  }}
                  className="p-2 bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-xl border border-white/5 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <h3 className="text-xl font-black text-white leading-tight mb-2 group-hover:text-indigo-200 transition-colors line-clamp-2">
                {course.name}
              </h3>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <Clock className="w-3 h-3" /> 
                {new Date(course.lastModified).toLocaleDateString('vi-VN')}
              </div>
            </div>

            <div className="relative z-10 pt-6 border-t border-white/5 flex items-center justify-between mt-auto">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-[10px] font-black">AI</div>
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-[10px] font-black">W</div>
              </div>
              <div className="flex items-center gap-2 text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span className="text-xs font-black uppercase tracking-widest">Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="mt-20 text-center py-20 bg-white/5 rounded-[60px] border border-white/10 backdrop-blur-3xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent"></div>
          <div className="relative z-10 max-w-md mx-auto">
             <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center mx-auto mb-6 border border-white/10">
               <Star className="w-10 h-10 text-slate-600 animate-pulse" />
             </div>
             <h2 className="text-2xl font-black text-white mb-4">Chưa có lộ trình nào</h2>
             <p className="text-slate-400 font-medium mb-8 text-sm leading-relaxed">
               Bắt đầu hành trình soạn giáo án chuyên nghiệp bằng cách tạo môn học đầu tiên của bạn.
             </p>
             <button 
               onClick={handleCreateNew}
               className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-10 py-5 rounded-3xl shadow-[0_15px_40px_rgba(79,70,229,0.3)] transition-all active:scale-95 flex items-center gap-3 mx-auto"
             >
               <Plus className="w-6 h-6" /> TẠO MÔN HỌC ĐẦU TIÊN
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
