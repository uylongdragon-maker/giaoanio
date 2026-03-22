'use client';

import { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import LessonForm from '@/components/LessonForm';
import ActivityCard from '@/components/ActivityCard';
import ExportButtons from '@/components/ExportButtons';
import AIConfig from '@/components/AIConfig';
import AssistantChat from '@/components/AssistantChat';
import FileUploader from '@/components/FileUploader';
import CompetencySelector from '@/components/CompetencySelector';
import SimulationBox from '@/components/SimulationBox';
import { Sparkles, ChevronRight, ChevronLeft, Bot, Loader2, CheckCircle2, FileText, MonitorSmartphone, Cpu, Presentation } from 'lucide-react';

export default function Home() {
  const resultRef = useRef(null);
  const [isClient, setIsClient] = useState(false);

  // States
  const [aiConfig, setAiConfig] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [lessonData, setLessonData] = useState(null);
  const [wizardData, setWizardData] = useState({
    fileSummary: '',
    competencySettings: { resources: [], competencies: [] },
    tech: { tools: '', useAi: true },
    simulation: { teacherContent: '', studentContent: '' }
  });

  const [chatHistory, setChatHistory] = useState([]);
  const [activities, setActivities] = useState([]);
  const [generatedLesson, setGeneratedLesson] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    try {
      if (localStorage.getItem('giaoan_aiConfig')) setAiConfig(JSON.parse(localStorage.getItem('giaoan_aiConfig')));
      if (localStorage.getItem('giaoan_lessonData')) setLessonData(JSON.parse(localStorage.getItem('giaoan_lessonData')));
      if (localStorage.getItem('giaoan_wizardData')) setWizardData(JSON.parse(localStorage.getItem('giaoan_wizardData')));
      if (localStorage.getItem('giaoan_currentStep')) setCurrentStep(Number(localStorage.getItem('giaoan_currentStep')));
      if (localStorage.getItem('giaoan_activities')) setActivities(JSON.parse(localStorage.getItem('giaoan_activities')));
      if (localStorage.getItem('giaoan_generatedLesson')) setGeneratedLesson(JSON.parse(localStorage.getItem('giaoan_generatedLesson')));
    } catch (e) {
      console.warn("Storage parse error", e);
    }
  }, []);

  // Save to localStorage broadly
  useEffect(() => {
    if (!isClient) return;
    if (aiConfig) localStorage.setItem('giaoan_aiConfig', JSON.stringify(aiConfig));
    if (lessonData) localStorage.setItem('giaoan_lessonData', JSON.stringify(lessonData));
    if (wizardData) localStorage.setItem('giaoan_wizardData', JSON.stringify(wizardData));
    localStorage.setItem('giaoan_currentStep', currentStep.toString());
    localStorage.setItem('giaoan_activities', JSON.stringify(activities));
    if (generatedLesson) localStorage.setItem('giaoan_generatedLesson', JSON.stringify(generatedLesson));
  }, [aiConfig, lessonData, wizardData, currentStep, activities, generatedLesson, isClient]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleConfigSaved = (config) => {
    setAiConfig(config);
    showToast('💾 Đã lưu cấu hình AI của bạn!', 'success');
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 6));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleGenerate = async () => {
    if (!aiConfig?.apiKey?.trim() || !lessonData?.lessonName?.trim()) {
      showToast('❌ Vui lòng nhập đủ API Key và Thông tin bài học ở các bước trước!', 'error');
      setCurrentStep(2);
      return;
    }

    setIsGenerating(true);
    setActivities([]);
    setGeneratedLesson(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: aiConfig.apiKey,
          modelType: aiConfig.modelType || 'gemini-3-flash-preview',
          mode: 'generate',
          formData: lessonData,
          wizardData,
          chatHistory
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Lỗi server: ${response.status}`);
      
      let rawOutput = data.result;
      if (!rawOutput) throw new Error('AI không trả về dữ liệu hợp lệ. Vui lòng thử lại.');

      let cleanJson = "";
      try {
        cleanJson = rawOutput.replace(/```json\n?|```/g, '').trim();
        const startObject = cleanJson.indexOf('{');
        const endObject = cleanJson.lastIndexOf('}');
        if (startObject !== -1 && endObject !== -1) {
          cleanJson = cleanJson.substring(startObject, endObject + 1);
        }
      } catch (filterError) {
        console.error("Lỗi khi lọc chuỗi:", filterError);
      }

      try {
        const parsedLesson = JSON.parse(cleanJson);
        if (!parsedLesson.activities || !Array.isArray(parsedLesson.activities)) {
          throw new Error("Dữ liệu trả về không chứa mảng các hoạt động giáo án.");
        }
        
        if (wizardData.simulation.teacherContent) {
          const simTime = "5 phút";
          parsedLesson.activities.push({
            segmentTitle: "Tình huống phụ trợ (Từ AI Co-pilot)",
            time: simTime,
            detailedContent: "Phát sinh tình huống tương tác do AI hỗ trợ lên kịch bản",
            teacherActions: wizardData.simulation.teacherContent,
            studentActions: wizardData.simulation.studentContent
          });
        }

        setGeneratedLesson(parsedLesson);
        setActivities(parsedLesson.activities); 
        
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        showToast(`✅ Đã đúc thành công giáo án chuẩn Phụ lục 10!`, 'success');

      } catch (parseError) {
        console.error("Lỗi Parse JSON:", cleanJson);
        showToast(`AI trả về dữ liệu lỗi định dạng. Bạn hãy ấn "Tạo lại" nhé!`, 'error'); 
      }
    } catch (err) {
      console.error('Generate error:', err);
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const stepsInfo = [
    { title: 'Tài liệu Nguồn', icon: FileText },
    { title: 'Thông tin chung', icon: "/icons/pen-tool" }, // Using inline svg placeholder for mapping dynamically if preferred
    { title: 'Tài nguyên & Năng lực', icon: Cpu },
    { title: 'Công nghệ & Tích hợp', icon: MonitorSmartphone },
    { title: 'AI Co-pilot (Mô phỏng)', icon: Bot },
    { title: 'Tổng hợp & Xuất bản', icon: Presentation }
  ];

  const totalRequiredMinutes = lessonData?.totalMinutes || 0;
  const allocatedMinutes = activities.reduce((sum, act) => sum + (parseInt(act.time) || 0), 0);
  const isTimeValid = allocatedMinutes >= totalRequiredMinutes;
  const progressPercent = totalRequiredMinutes > 0 ? Math.min(100, (allocatedMinutes / totalRequiredMinutes) * 100) : 0;

  if (!isClient) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-12">
      <Header />

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] animate-slide-down px-6 py-3 rounded-full flex items-center gap-2 shadow-lg ${toast.type === 'error' ? 'bg-rose-500 text-white shadow-rose-200' : 'bg-emerald-500 text-white shadow-emerald-200'}`}>
          <div className="text-sm font-semibold">{toast.message}</div>
        </div>
      )}

      <main className="max-w-7xl mx-auto w-full px-4">
        
        {/* === STEPPER HEADER === */}
        <div className="bg-white/70 backdrop-blur-2xl border border-white/80 shadow-sm rounded-3xl p-4 md:p-6 mt-6 mb-6 overflow-x-auto hide-scrollbar">
          <div className="flex justify-between items-center min-w-[700px]">
            {stepsInfo.map((step, idx) => {
              const Icon = typeof step.icon === 'string' ? Sparkles : step.icon;
              const isActive = currentStep === idx + 1;
              const isPast = currentStep > idx + 1;
              return (
                <div key={idx} className="flex flex-col items-center gap-2 flex-1 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                    isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 scale-110' :
                    isPast ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-bold text-center mt-1 transition-colors ${isActive ? 'text-indigo-700' : isPast ? 'text-emerald-600' : 'text-slate-400'}`}>
                    Bước {idx + 1}<br/><span className="font-medium">{step.title}</span>
                  </span>
                  {idx < 5 && (
                    <div className={`hidden md:block absolute top-5 left-[60%] w-[80%] h-0.5 -z-10 ${isPast ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* === MAIN WORKFLOW CONTENT === */}
        <div className="flex flex-col xl:grid xl:grid-cols-12 gap-8">
          
          <div className="xl:col-span-7 space-y-6">
            
            <AIConfig config={aiConfig} onConfigSaved={handleConfigSaved} />

            {currentStep === 1 && (
              <div className="animate-fade-in">
                <FileUploader 
                  apiKey={aiConfig?.apiKey} 
                  modelType={aiConfig?.modelType}
                  onFileSummarized={(summary) => setWizardData({...wizardData, fileSummary: summary})} 
                />
              </div>
            )}

            {currentStep === 2 && (
              <div className="animate-fade-in">
                {wizardData.fileSummary && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4">
                    <p className="text-xs text-emerald-800 font-medium">✨ AI gợi ý từ tài liệu: {wizardData.fileSummary}</p>
                  </div>
                )}
                <LessonForm onDataChange={setLessonData} />
              </div>
            )}

            {currentStep === 3 && (
              <div className="animate-fade-in">
                <CompetencySelector 
                  settings={wizardData.competencySettings} 
                  onChange={(cmd) => setWizardData({...wizardData, competencySettings: cmd})} 
                />
              </div>
            )}

            {currentStep === 4 && (
              <div className="bg-white/70 backdrop-blur-xl rounded-[28px] p-6 shadow-sm border border-white/80 animate-fade-in">
                <h2 className="font-bold text-slate-800 mb-4 text-sm">Công nghệ sử dụng</h2>
                <input
                  type="text"
                  placeholder="Nhập tên ứng dụng (VD: Kahoot, Quizizz, Padlet...)"
                  className="w-full bg-slate-100/80 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 mb-6"
                  value={wizardData.tech.tools}
                  onChange={e => setWizardData({...wizardData, tech: {...wizardData.tech, tools: e.target.value}})}
                />
                <div className="flex items-center justify-between bg-indigo-50 rounded-2xl px-5 py-4 border border-indigo-100">
                  <div>
                    <h3 className="font-bold text-indigo-900 text-sm">Ứng dụng AI vào giảng dạy</h3>
                    <p className="text-xs text-indigo-600 mt-1">AI gợi ý cách áp dụng công cụ thông minh vào lớp học</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={wizardData.tech.useAi} onChange={e => setWizardData({...wizardData, tech: {...wizardData.tech, useAi: e.target.checked}})} />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="animate-fade-in">
                <SimulationBox 
                  apiKey={aiConfig?.apiKey} 
                  modelType={aiConfig?.modelType}
                  lessonData={lessonData}
                  onApplySimulation={(content) => {
                    setWizardData({...wizardData, simulation: content});
                    showToast('✅ Đã lưu kịch bản mô phỏng để gộp vào Phụ lục 10', 'success');
                  }}
                />
              </div>
            )}

            {currentStep === 6 && (
              <div className="bg-indigo-600 rounded-[28px] p-6 md:p-8 flex flex-col items-center justify-center text-center shadow-lg shadow-indigo-200 animate-fade-in">
                <Sparkles className="w-12 h-12 text-indigo-300 mb-4" />
                <h2 className="text-white font-black text-xl mb-2">Sẵn sàng Đúc Giáo án</h2>
                <p className="text-indigo-100 text-sm mb-6 max-w-sm">
                  Dữ liệu từ File nguồn, năng lực, ứng dụng công nghệ và mô phỏng đã gom đủ.
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !aiConfig?.apiKey}
                  className="w-full sm:w-auto bg-white hover:bg-indigo-50 text-indigo-600 font-black py-4 px-8 rounded-full shadow-xl transition-transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-3"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Đang nấu JSON & Đúc Word...</>
                  ) : (
                    <><Bot className="w-5 h-5" /> Đúc Giáo Án Phụ Lục 10</>
                  )}
                </button>
              </div>
            )}

            <div className="flex justify-between items-center bg-white/50 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-slate-100">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Quay lại
              </button>
              
              {currentStep < 6 ? (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all hover:scale-105"
                >
                  Tiếp tục <ChevronRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {currentStep === 6 && generatedLesson && (
              <div ref={resultRef} className="pt-8 animate-slide-up">
                <div className="flex items-center gap-3 mb-6 px-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">Bản Trình Bày (Preview)</h2>
                    <p className="text-sm font-medium text-slate-500">Kéo xuống cuối để Xuất file Word Phụ lục 10</p>
                  </div>
                </div>

                {/* Progress Bar (Time Allocation Validation) */}
                <div className="bg-white/70 backdrop-blur-xl rounded-[28px] p-6 shadow-sm border border-slate-100 mb-6">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 tracking-wide uppercase">Phân bổ Thời gian</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Đã phân bổ: <strong className={isTimeValid ? 'text-emerald-600' : 'text-rose-600'}>{allocatedMinutes} phút</strong> / Tổng: <strong>{totalRequiredMinutes} phút</strong>
                      </p>
                    </div>
                    <span className={`text-2xl font-black ${isTimeValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${isTimeValid ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {!isTimeValid && (
                    <p className="text-xs text-rose-500 mt-3 font-medium">⚠️ Cảnh báo: AI phân bổ thiếu thời gian. Bạn có thể quay lại Bước 5 để nhắc AI hoặc xuất luôn và tự bù giờ bằng tay.</p>
                  )}
                  {isTimeValid && allocatedMinutes > totalRequiredMinutes && (
                    <p className="text-xs text-amber-500 mt-3 font-medium">⚠️ Cảnh báo: AI phân bổ hơi lố thời gian (Vượt quá tổng yêu cầu). Bạn nên check lại thẻ cuối.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 pb-8">
                  {activities.map((act, index) => (
                    <ActivityCard
                      key={index}
                      index={index}
                      activity={act}
                    />
                  ))}
                </div>

                <div className="border-t border-slate-200 mt-4 pt-8">
                  <ExportButtons 
                    activities={activities} 
                    lessonData={lessonData} 
                    generatedLesson={generatedLesson} 
                    isTimeValid={isTimeValid}
                  />
                </div>
              </div>
            )}

          </div>

          <div className="xl:col-span-5 hidden xl:block">
            <div className="sticky top-6">
              <AssistantChat 
                lessonData={lessonData} 
                apiKey={aiConfig?.apiKey} 
                modelType={aiConfig?.modelType}
                onChatUpdate={setChatHistory}
              />
            </div>
          </div>
          <div className="xl:hidden mt-6">
            <AssistantChat 
              lessonData={lessonData} 
              apiKey={aiConfig?.apiKey} 
              modelType={aiConfig?.modelType}
              onChatUpdate={setChatHistory}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
