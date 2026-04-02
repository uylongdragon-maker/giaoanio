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
    
    const result = await generateObject({
      model: googleProvider('gemini-1.5-flash'),
      schema: z.object({
        sessions: z.array(z.object({
          sessionTitle: z.string(),
          contents: z.array(z.object({
            tenBai: z.string(),
            subItem: z.string(),
            gioLT_used: z.number(),
            gioTH_used: z.number(),
          }))
        }))
      }),
      prompt: `Bạn là chuyên gia sư phạm. Phân bổ nội dung từ ĐỀ CƯƠNG: ${JSON.stringify(syllabus)} vào các buổi LỊCH TRÌNH: ${JSON.stringify(targetSessions)}. Mỗi buổi PHẢI đủ số tiết pLimit.`,
    });

    // Trả về JSON một cục luôn, không stream
    const finalSessions = targetSessions.map((meta, idx) => ({
      ...meta,
      id: `session-${idx + 1}`,
      status: 'pending',
      ...result.object.sessions[idx]
    }));

    return NextResponse.json({ sessions: finalSessions });

  } catch (error) {
    console.error("LỖI API SCHEDULE:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
