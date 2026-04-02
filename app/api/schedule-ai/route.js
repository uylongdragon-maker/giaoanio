import { NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const runtime = 'edge';
export const maxDuration = 300;

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

    if (!apiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: "Thiếu Gemini API Key cho việc xếp lịch AI." }, { status: 401 });
    }

    const googleProvider = google({
      apiKey: (apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim(),
    });

    const modelName = 'gemini-1.5-flash';

    const calculateSessions = () => {
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
            sessions.push({ id: `session-${sessions.length + 1}`, date: dateISO, pLimit, totalPeriods: pLimit, status: 'pending' });
            accumulated += pLimit;
          }
          currentDate.setDate(currentDate.getDate() + 1); safe++;
        }
        return sessions;
    };

    const targetSessions = calculateSessions();
    const fullPrompt = `Bạn là chuyên gia sư phạm xếp lịch giảng dạy. 
NHIỆM VỤ: Phân bổ nội dung từ ĐỀ CƯƠNG vào các buổi trong LỊCH TRÌNH.

DỮ LIỆU ĐẦU VÀO:
- ĐỀ CƯƠNG: ${JSON.stringify(syllabus)}
- LỊCH TRÌNH: ${JSON.stringify(targetSessions)} (mỗi buổi có pLimit là số tiết, thường là 4 tiết = 180 phút).

QUY TẮC BẮT BUỘC:
1. TỔNG THỜI LƯỢNG: Mỗi buổi học (Session) PHẢI được lấp đầy đúng số tiết pLimit của buổi đó.
2. TỶ LỆ QUY ĐỔI: 1 giờ Lý thuyết (gioLT) = 1 Tiết (45p). 1 giờ khác (TH/KT/Thi) = 1.33 Tiết (60p).
3. CHIA NHỎ BÀI HỌC: Nếu một bài lớn hơn pLimit, PHẢI chia ra nhiều buổi.
4. KIỂM TRA/THI: Kiểm tra = 1 tiết. Thi = 1 buổi (180p/4 tiết).
5. TRẢ VỀ: Một mảng các buổi học. Mỗi đối tượng trong mảng phải có cấu trúc:
   {
     "sessionTitle": "Tên tổng quát của buổi học",
     "contents": [
       { "tenBai": "Tên bài", "subItem": "Tiểu mục", "gioLT_used": X, "gioTH_used": Y }
     ]
   }
   LƯU Ý: Phải trả về đúng số lượng buổi học như trong LỊCH TRÌNH đầu vào.`;

    const { object } = await generateObject({
      model: googleProvider(modelName),
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
      prompt: fullPrompt,
      temperature: 0.1,
    });

    const aiSessions = object.sessions || [];
    
    // Merge AI contents back into targetSessions to preserve metadata (totalPeriods, date, id)
    const finalSessions = targetSessions.map((meta, idx) => {
      const aiData = aiSessions[idx] || {};
      return {
        ...meta,
        contents: aiData.contents || [],
        sessionTitle: aiData.sessionTitle || (aiData.contents?.[0]?.tenBai ? `Bài học: ${aiData.contents[0].tenBai}` : `Buổi học ${idx + 1}`)
      };
    });

    return NextResponse.json({ sessions: finalSessions }, { status: 200 });

  } catch (error) {
    console.error("LỖI API SCHEDULE:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
