import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { syllabus, startDate, dayConfigs, holidayList, apiKey, modelId } = body;

    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key cho việc xếp lịch AI." }, { status: 400 });
    if (!syllabus || syllabus.length === 0 || !startDate || !dayConfigs) {
      return NextResponse.json({ error: "Thiếu dữ liệu đầu vào cần thiết." }, { status: 400 });
    }

    const calculateSessions = () => {
        let totalRequired = 0;
        syllabus.forEach(item => {
          const hLt = (parseFloat(item.gioLT) || 0) + (parseFloat(item.gioKLT) || 0) + (parseFloat(item.gioTLT) || 0);
          const hTh = (parseFloat(item.gioTH) || 0) + (parseFloat(item.gioKTH) || 0) + (parseFloat(item.gioTTH) || 0);
          totalRequired += hLt + (hTh * 4 / 3);
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
    const MODEL_MAP = {
      'gemini-flash-latest': 'gemini-flash-latest', 
      'gemini-pro-latest': 'gemini-pro-latest',
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-1.5-flash': 'gemini-1.5-flash-latest',
    };

    let requestedModel = (modelId || 'gemini-flash-latest').toLowerCase().trim();
    if (requestedModel.startsWith('models/')) requestedModel = requestedModel.replace('models/', '');
    let actualModel = MODEL_MAP[requestedModel] || requestedModel;

    const fullPrompt = `ĐỀ CƯƠNG: ${JSON.stringify(syllabus, null, 2)}\n\nLỊCH TRÌNH: ${JSON.stringify(targetSessions, null, 2)}\n\nNHIỆM VỤ: Phân bổ Đề cương vào Lịch trình (1h LT=1 Tiết, 1h TH=1.33 Tiết). TRẢ VỀ JSON ARRAY.`;

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    const tryScheduleWithRetry = async () => {
      let lastError = null;
      let logs = [];
      let tried = new Set();

      // FIXED CONFIGURATION: Focus on reliable models
      const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro-latest'];

      const callModel = async (mId, isRetry = false) => {
        // Enforce v1beta as v1 is consistently failing for this user's key
        const endpoint = 'v1beta';
        const combo = `${mId}@${endpoint}`;
        if (tried.has(combo) && !isRetry) return null;
        tried.add(combo);
        
        try {
          const fullPath = mId.includes('/') ? mId : `models/${mId}`;
          const url = `https://generativelanguage.googleapis.com/${endpoint}/${fullPath}:generateContent?key=${apiKey.trim()}`;
          
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
            })
          });
          
          const data = await res.json();
          const logMsg = `[Trial] ${fullPath} ${isRetry ? '(Retry)' : ''} -> ${res.status}`;
          logs.push(logMsg); console.log(logMsg);

          if (res.ok) return data;
          if (res.status === 429) return { error: 'quota', msg: data.error?.message };
          return { error: 'fail', msg: data.error?.message || `Lỗi ${res.status}`, status: res.status };
        } catch (e) { 
          logs.push(`[Error] ${mId} -> ${e.message}`);
          return { error: 'fail', msg: e.message }; 
        }
      };

      // AGGRESSIVE BACKOFF LOOP FOR QUOTA EXHAUSTION
      for (const mId of modelsToTry) {
        let retryCount = 0;
        // Allows up to 4 retries per model, with massive delays
        while (retryCount < 4) {
          const result = await callModel(mId, retryCount > 0);
          if (result && !result.error) return result;
          
          if (result?.error === 'quota') { 
            // 429 Hit: Wait 5s, 10s, 20s, 30s
            const waitTime = [5000, 10000, 20000, 30000][retryCount];
            console.warn(`[Quota 429] Limit reached for ${mId}. Waiting ${waitTime/1000}s...`);
            await delay(waitTime); 
            retryCount++; 
            continue; 
          }
          
          if (result?.msg) lastError = result.msg;
          break; // If it's a 404/400, move to the next model immediately
        }
      }

      const finalError = `Google AI Studio báo lỗi: API Key của bạn đã bị vượt quá giới hạn lượt dùng (Rate Limit/Quota 429).\nChi tiết: Vui lòng đợi khoảng 1-2 phút trước khi nhấn lại, hoặc cân nhắc sử dụng một API Key khác nếu bạn đang xếp lịch hàng loạt quá nhanh.\n\nCHI TIẾT MÁY CHỦ:\n${logs.join('\n')}`;
      throw new Error(finalError);
    };

    const data = await tryScheduleWithRetry();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const sessions = JSON.parse(jsonMatch ? jsonMatch[0] : responseText.replace(/```json/gi, '').replace(/```/g, '').trim());
    return NextResponse.json({ sessions }, { status: 200 });

  } catch (error) {
    console.error("LỖI API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
