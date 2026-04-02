import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 60; 

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      syllabus, 
      startDate, 
      dayConfigs, 
      holidayList, 
      apiKey, 
      modelId 
    } = body;

    const googleProvider = createGoogleGenerativeAI({
      apiKey: (apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim(),
    });

    const calculateSessionsMeta = () => {
        let totalRequired = 0;
        syllabus.forEach(item => {
          const hLt = parseFloat(item.gioLT) || 0;
          const others = (parseFloat(item.gioTH) || 0) + (parseFloat(item.gioKLT) || 0) + (parseFloat(item.gioKTH) || 0) + (parseFloat(item.gioTLT) || 0) + (parseFloat(item.gioTTH) || 0);
          totalRequired += hLt + (others * 60 / 45);
        });
        const totalPeriodsNeeded = Math.ceil(totalRequired);
        let sessions = [], dateBase = String(startDate);
        if (dateBase.includes('T')) dateBase = dateBase.split('T')[0];
        let currentDate = new Date(dateBase + 'T00:00:00'), accumulated = 0, safe = 0;
        while (accumulated < totalPeriodsNeeded && safe < 1000) {
          const dayOfWeek = currentDate.getDay(), pLimit = parseInt(dayConfigs[dayOfWeek]) || 0, dateISO = currentDate.toISOString().split('T')[0];
          if (pLimit > 0 && !holidayList?.includes(dateISO)) {
            sessions.push({ date: dateISO, pLimit, totalPeriods: pLimit });
            accumulated += pLimit;
          }
          currentDate.setDate(currentDate.getDate() + 1); safe++;
        }
        return sessions;
    };

    const targetSessions = calculateSessionsMeta();
    
    const miniSyllabus = syllabus.map(item => ({
       tenBai: item.tenBai,
       gioLT: item.gioLT,
       gioTH: item.gioTH
    }));

    const result = await generateObject({
      model: googleProvider('gemini-2.5-flash'),
      schema: z.object({
        sessions: z.array(z.object({
          sessionTitle: z.string(),
          contents: z.array(z.object({
            tenBai: z.string(),
            gioLT_used: z.number(),
            gioTH_used: z.number(),
          }))
        }))
      }),
      prompt: `Xếp Lịch. Đầu vào: ${JSON.stringify(miniSyllabus)}. Khung rỗng: ${JSON.stringify(targetSessions)}. Khớp tên bài và chia giờ. Output JSON ngắn gọn.`,
    });

    // Trả về JSON một cục luôn, không stream. Ánh xạ lại subItem từ syllabus gốc để UI không bị trống.
    const finalSessions = targetSessions.map((meta, idx) => {
      const sessionData = result.object.sessions[idx] || { sessionTitle: `Buổi ${idx + 1}`, contents: [] };
      const enrichedContents = (sessionData.contents || []).map(c => {
         const original = syllabus.find(s => s.tenBai === c.tenBai);
         return { 
           ...c, 
           subItem: original?.subItem || c.tenBai,
           lessonName: original?.tenBai || c.tenBai 
         };
      });
      return {
        ...meta,
        id: `session-${idx + 1}`,
        status: 'pending',
        ...sessionData,
        contents: enrichedContents
      };
    });

    return NextResponse.json({ sessions: finalSessions });

  } catch (error) {
    console.error("LỖI API SCHEDULE:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
