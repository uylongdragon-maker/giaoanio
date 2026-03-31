import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    console.log("Đang xử lý API chat...");
    const { message, history, lessonData, apiKey, modelType } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API Key." }, { status: 400 });
    }

    const systemPrompt = `Bạn là chuyên gia sư phạm đang TRÒ CHUYỆN trực tiếp với giáo viên. 
Thông tin bài học hiện tại:
- Tên bài: ${lessonData?.lessonName || 'Chưa nhập'}
- Loại bài: ${lessonData?.lessonType || 'Lý thuyết'}
- Thời gian: ${lessonData?.totalMinutes || 45} phút
- Ghi chú: ${lessonData?.notes || 'Không có'}

NHIỆM VỤ BẮT BUỘC (LỆNH THÉP):
1. Nhiệm vụ của bạn là tư vấn, đề xuất phương pháp và kịch bản dạy học một cách ngắn gọn, súc tích.
2. BẮT BUỘC trả lời bằng văn bản tự nhiên (Natural Language) hoặc Markdown cơ bản. 
3. TUYỆT ĐỐI KHÔNG ĐƯỢC trả về định dạng JSON. 
4. TUYỆT ĐỐI KHÔNG xuất code HTML ở bước này. Chỉ đóng vai trò người tư vấn, hỏi đáp.`;

    const MODEL_MAP = {
      'gemini-1.5-flash':         'gemini-1.5-flash-latest',
      'gemini-1.5-pro':           'gemini-1.5-pro-latest',
      'gemini-3-flash-preview':   'gemini-1.5-flash-latest',
      'gemini-3.0-flash-preview': 'gemini-1.5-flash-latest',
      'gemini-3.1-pro-preview':   'gemini-1.5-pro-latest',
      'gemini-2.5-pro':           'gemini-1.5-pro-latest',
      'gemini-2.5-flash':         'gemini-1.5-flash-latest',
      'gemini-2.0-flash':         'gemini-1.5-flash-latest',
      'gemini-2.0-flash-exp':     'gemini-2.0-flash-exp',
      'openai-gpt4o-mini':        'gpt-4o-mini',
      'openai-gpt4o':             'gpt-4o',
      'anthropic-sonnet':         'claude-3-5-sonnet-20240620',
    };

    let requestedModel = (modelType || 'gemini-1.5-flash').toLowerCase().trim();
    if (requestedModel.startsWith('models/')) {
      requestedModel = requestedModel.replace('models/', '');
    }
    const actualModel = MODEL_MAP[requestedModel] || requestedModel;

    let replyText = '';

    const safeModelType = modelType || '';

    // ── 1. GOOGLE GEMINI (ROBUST RETRY) ───────────────────────────────────
    if (safeModelType.startsWith('gemini')) {
      const tryChatWithRetry = async () => {
        const modelsToTry = [
          actualModel, 
          'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest',
          'gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.5-flash-8b-latest', 'gemini-1.5-flash-8b',
          'gemini-1.5-pro-latest', 'gemini-1.5-pro', 'gemini-1.5-pro-001',
          'gemini-2.0-flash-exp', 
          'gemini-1.0-pro-latest', 'gemini-1.0-pro', 'gemini-pro'
        ];
        const endpoints = ['v1beta', 'v1'];
        
        const geminiContents = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Tôi hiểu thưa bạn. Hãy bắt đầu.' }] }
        ];
        history.forEach(msg => {
          geminiContents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
        });
        geminiContents.push({ role: 'user', parts: [{ text: message }] });

        let lastError = null;
        let lastErrorData = null;

        for (const endpoint of endpoints) {
          for (const mId of modelsToTry) {
            try {
              console.log(`[AI-Chat] Thử ${endpoint}/models/${mId}...`);
              const url = `https://generativelanguage.googleapis.com/${endpoint}/models/${mId}:generateContent?key=${apiKey.trim()}`;
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  contents: geminiContents,
                  generationConfig: { 
                    ...(endpoint === 'v1beta' ? { responseMimeType: "application/json" } : {}),
                    temperature: 0.7 
                  }
                })
              });
              const data = await res.json();
              if (res.ok) return { res, data };
              
              lastErrorData = data;
              lastError = data.error?.message || `Lỗi Gemini API (${res.status})`;
              console.warn(`[AI-Chat] Thất bại: ${endpoint}/${mId} -> ${lastError}`);
              if (lastError.includes("API key not valid")) throw new Error(lastError);
            } catch (e) {
              lastError = e.message;
              if (lastError.includes("API key not valid")) throw new Error(lastError);
            }
          }
        }
        console.error("[AI-Chat] TẤT CẢ CỨU CÁNH ĐỀU THẤT BẠI. Lỗi cuối cùng:", lastErrorData);
        
        let availableModels = [];
        try {
          const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
          const listRes = await fetch(listUrl);
          const listData = await listRes.json();
          availableModels = listData.models?.map(m => m.name.replace('models/', '')) || [];
        } catch (diagErr) {}

        const diagMsg = availableModels.length > 0 ? `\nModel khả dụng: ${availableModels.join(', ')}` : "";
        throw new Error(`${lastError} ${diagMsg}`);
      };

      try {
        const { res, data } = await tryChatWithRetry();
        replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (err) {
        console.error("LỖI CHAT GEMINI SAU RETRY:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // ── 2. OPENAI ───────────────────────────────────────────────────
    else if (safeModelType.startsWith('openai')) {
      const messages = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }];
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: actualModel, messages })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Lỗi OpenAI API');
      replyText = data?.choices?.[0]?.message?.content;
    }

    // ── 3. ANTHROPIC CLAUDE ─────────────────────────────────────────
    else if (safeModelType.startsWith('anthropic')) {
      const messages = [...history, { role: 'user', content: message }];
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: actualModel, max_tokens: 4096, system: systemPrompt, messages })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Lỗi Anthropic API');
      replyText = data?.content?.[0]?.text;
    }

    if (!replyText) throw new Error("AI trả về kết quả rỗng.");
    
    return NextResponse.json({ text: replyText }, { status: 200 });

  } catch (error) {
    console.error("LỖI API (chat):", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
