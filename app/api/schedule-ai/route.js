import { NextResponse } from 'next/server';

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
      modelId, 
      openAIKey 
    } = body;

    let requestedModel = (modelId || 'gemini-1.5-flash').toLowerCase().trim();
    if (requestedModel.startsWith('models/')) requestedModel = requestedModel.replace('models/', '');
    
    const isOpenAI = requestedModel.includes('gpt');
    const isGemini = !isOpenAI;

    if (isGemini && !apiKey) {
      return NextResponse.json({ error: "Thiếu Gemini API Key cho việc xếp lịch AI." }, { status: 400 });
    }
    if (isOpenAI && !openAIKey) {
      return NextResponse.json({ error: "Thiếu OpenAI API Key cho việc xếp lịch AI." }, { status: 400 });
    }

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
5. TRẢ VỀ: JSON ARRAY của các buổi học. Mỗi đối tượng trong mảng phải có cấu trúc:
   {
     "sessionTitle": "Tên tổng quát của buổi học",
     "contents": [
       { "tenBai": "Tên bài", "subItem": "Tiểu mục", "gioLT_used": X, "gioTH_used": Y }
     ]
   }
   LƯU Ý: Phải trả về đúng số lượng buổi học như trong LỊCH TRÌNH đầu vào.`;

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    // --- GEMINI HANDLER ---
    const tryGemini = async () => {
      const modelsToTry = [requestedModel, 'gemini-2.0-flash', 'gemini-1.5-flash-002', 'gemini-1.5-flash', 'gemini-1.5-pro-002', 'gemini-1.5-pro'];
      let requestedModelError = null;
      let lastError = "Hệ thống AI đang bận";

      for (const mId of modelsToTry) {
        for (const v of ['v1beta']) {
          let retryCount = 0;
          while (retryCount < 2) {
            try {
              const url = `https://generativelanguage.googleapis.com/${v}/models/${mId}:generateContent?key=${apiKey.trim()}`;
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: fullPrompt }] }],
                  generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
                })
              });
              const data = await res.json();

              if (!res.ok) {
                const errMsg = data.error?.message || "Lỗi API";
                if (mId === requestedModel && !requestedModelError) requestedModelError = errMsg;
                
                const isRetryable = res.status === 429 || res.status >= 500;
                if (isRetryable && retryCount < 1) {
                  retryCount++;
                  const waitTime = [3000, 7000][retryCount - 1];
                  console.warn(`[Sched Quota] Waiting ${waitTime/1000}s for ${mId}...`);
                  await delay(waitTime);
                  continue;
                }
                throw new Error(errMsg);
              }

              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (!text) throw new Error("AI không phản hồi nội dung.");

              return { success: true, data: text };
            } catch (err) {
              lastError = err.message;
              break; 
            }
          }
        }
      }
      throw new Error(`LỖI KẾT NỐI AI / SAI KEY: Hệ thống xếp lịch không thể gọi Gemini. Vui lòng kiểm tra API Key tại aistudio.google.com. Chi tiết: ${requestedModelError || lastError}`);
    };

    // --- OPENAI HANDLER ---
    const tryOpenAI = async () => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAIKey.trim()}` },
        body: JSON.stringify({
          model: requestedModel,
          messages: [{ role: 'user', content: fullPrompt }],
          response_format: { type: "json_object" }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OpenAI Error ${res.status}`);
      return data.choices[0].message.content;
    };

    let responseText = "";
    if (requestedModel.includes('gpt')) {
      responseText = await tryOpenAI();
    } else {
      const result = await tryGemini();
      responseText = result.data || "[]";
    }

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const aiSessions = JSON.parse(jsonMatch ? jsonMatch[0] : responseText.replace(/```json/gi, '').replace(/```/g, '').trim());
      
      // Merge AI contents back into targetSessions to preserve metadata (totalPeriods, date, id)
      const finalSessions = targetSessions.map((meta, idx) => {
        const aiData = aiSessions[idx] || {};
        return {
          ...meta,
          contents: aiData.contents || [],
          // Fallback title if AI didn't provide one for the session as a whole
          sessionTitle: aiData.sessionTitle || (aiData.contents?.[0]?.tenBai ? `Bài học: ${aiData.contents[0].tenBai}` : `Buổi học ${idx + 1}`)
        };
      });

      return NextResponse.json({ sessions: finalSessions }, { status: 200 });
    } catch (e) {
      console.error("Schedule Parse Error:", responseText);
      return NextResponse.json({ error: "AI không trả về đúng định dạng lịch trình (JSON ARRAY)." }, { status: 500 });
    }

  } catch (error) {
    console.error("LỖI API SCHEDULE:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
