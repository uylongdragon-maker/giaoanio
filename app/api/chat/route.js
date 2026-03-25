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
      'gemini-3-flash-preview':   'gemini-3-flash-preview',
      'gemini-3.0-flash-preview': 'gemini-3-flash-preview',
      'gemini-3.1-pro-preview':   'gemini-3.1-pro-preview',
      'openai-gpt4o-mini':        'gpt-4o-mini',
      'openai-gpt4o':             'gpt-4o',
      'anthropic-sonnet':         'claude-3-5-sonnet-20240620'
    };

    const actualModel = MODEL_MAP[modelType] || 'gemini-3-flash-preview';

    let replyText = '';

    const safeModelType = modelType || '';

    // ── 1. GOOGLE GEMINI ───────────────────────────────────
    if (safeModelType.startsWith('gemini')) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`;

      // Chuyển history thành format của Gemini
      const geminiContents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Tôi hiểu thưa bạn. Hãy bắt đầu.' }] }
      ];
      
      history.forEach(msg => {
        geminiContents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      });
      geminiContents.push({ role: 'user', parts: [{ text: message }] });

      console.log("Đang gọi Gemini...");
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: geminiContents })
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("LỖI GEMINI API (chat):", data);
        throw new Error(data.error?.message || 'Lỗi Gemini API');
      }
      replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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
