import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { prompt, fileData, apiKey, modelType, modelId, mode, systemPrompt } = body;

    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key cho việc soạn thảo." }, { status: 400 });

    const MODEL_MAP = {
      'gemini-flash-latest': 'gemini-flash-latest', 
      'gemini-pro-latest': 'gemini-pro-latest',
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-2.0-flash': 'gemini-2.0-flash',
      'gemini-1.5-flash': 'gemini-1.5-flash-latest',
    };

    let requestedModel = (modelId || modelType || 'gemini-flash-latest').toLowerCase().trim();
    if (requestedModel.startsWith('models/')) requestedModel = requestedModel.replace('models/', '');
    let actualModel = MODEL_MAP[requestedModel] || requestedModel;

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    const tryGemini = async (contents, genConfig = {}) => {
      let lastError = null;
      let logs = [];
      let tried = new Set();
      
      // FIXED CONFIGURATION: Use actual model first, then try the most reliable models to avoid spamming the API and triggering tighter rate limits.
      const modelsToTry = [...new Set([actualModel, 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-pro-latest'])];
      
      const callModel = async (mId, isRetry = false) => {
        // We only use v1beta as v1 is consistently 404 for this key
        const endpoint = 'v1beta';
        const fullPath = mId.includes('/') ? mId : `models/${mId}`;
        const url = `https://generativelanguage.googleapis.com/${endpoint}/${fullPath}:generateContent?key=${apiKey.trim()}`;
        
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              contents, 
              generationConfig: { responseMimeType: "application/json", ...genConfig } 
            })
          });
          
          const data = await res.json();
          const logMsg = `[Trial] ${fullPath} ${isRetry ? '(Retry)' : ''} -> ${res.status}`;
          logs.push(logMsg); console.log(logMsg);

          if (res.ok) return { data };
          if (res.status === 429) return { error: 'quota', msg: data.error?.message };
          return { error: 'fail', msg: data.error?.message || `Lỗi ${res.status}`, status: res.status };
        } catch (e) {
          logs.push(`[Error] ${fullPath} -> ${e.message}`);
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

      const finalError = `Google AI Studio báo lỗi: API Key của bạn đã bị vượt quá giới hạn lượt dùng (Rate Limit/Quota 429).\nChi tiết: Vui lòng đợi khoảng 1-2 phút trước khi nhấn lại, hoặc cân nhắc sử dụng một API Key khác nếu bạn đang soạn hàng loạt quá nhanh.\n\nCHI TIẾT MÁY CHỦ:\n${logs.join('\n')}`;
      throw new Error(finalError);
    };

    // Modes logic (skeleton, extracting, etc.)
    if (mode === 'extract_syllabus') {
      const textPrompt = `Extract as JSON ARRAY: ${fileData?.rawText || prompt}`;
      const { data } = await tryGemini([{ parts: [{ text: textPrompt }] }], { temperature: 0.1 });
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      return NextResponse.json({ lessons: JSON.parse(match ? match[0] : text) }, { status: 200 });
    }

    if (mode === 'lesson_json') {
      const fullPrompt = `${systemPrompt || ''}\n\nDỮ LIỆU CỤ THỂ:\n${JSON.stringify(body.formData || {}, null, 2)}`;
      const { data } = await tryGemini([{ parts: [{ text: fullPrompt }] }], { temperature: 0.7 });
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      const cleanedJson = JSON.parse(match ? match[0] : text.replace(/```json/gi, '').replace(/```/g, '').trim());
      return NextResponse.json(cleanedJson, { status: 200 });
    }

    const { data } = await tryGemini([{ parts: [{ text: body.promptText || body.prompt || '' }] }], { temperature: 0.7 });
    return NextResponse.json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || "" }, { status: 200 });

  } catch (error) {
    console.error("LỖI API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
