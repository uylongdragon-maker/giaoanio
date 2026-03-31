import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useStore = create(
  persist(
    (set, get) => ({
      currentStep: 1,
      courses: [], // Array of { id, name, lastModified, data }
      activeCourse: null, // { id, name, startDate, dayConfigs, holidayList, syllabus, schedule, courseContext }

      // Actions
      setCurrentStep: (step) => set({ currentStep: step }),
      
      setCourses: (courses) => set({ courses }),
      
      addCourse: (course) => set((state) => ({ 
        courses: [...state.courses, course],
        activeCourse: course,
        currentStep: 2
      })),

      updateActiveCourse: (updates) => set((state) => {
        if (!state.activeCourse) return { activeCourse: updates };
        const newActive = { 
          ...state.activeCourse, 
          ...updates, 
          lastModified: new Date().toISOString() 
        };
        // Auto-sync with courses list
        const updatedCourses = state.courses.map(c => 
          c.id === newActive.id ? newActive : c
        );
        return { 
          activeCourse: newActive,
          courses: updatedCourses
        };
      }),

      setActiveCourse: (course) => set({ 
        activeCourse: course, 
        currentStep: 2 // Jump to scheduler by default when selecting
      }),

      deleteCourse: (id) => set((state) => ({
        courses: state.courses.filter(c => c.id !== id),
        activeCourse: state.activeCourse?.id === id ? null : state.activeCourse
      })),

      resetWorkflow: () => set({ 
        currentStep: 1, 
        activeCourse: null 
      }),

      nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 5) })),
      prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
    }),
    {
      name: 'giao-an-io-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useStore;
