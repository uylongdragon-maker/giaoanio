import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { message, history, lessonData, apiKey, modelType } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API Key." }, { status: 400 });
    }

    const systemPrompt = `Bạn là Trợ lý AI chuyên môn Tư vấn Sư phạm và Thiết kế Giáo án (Đặc biệt là hệ thống Phụ lục 10).
Thông tin bài học hiện tại:
- Tên bài: ${lessonData?.lessonName || 'Chưa nhập'}
- Loại bài: ${lessonData?.lessonType || 'Lý thuyết'}
- Thời gian: ${lessonData?.totalMinutes || 45} phút
- Ghi chú: ${lessonData?.notes || 'Không có'}

Mục tiêu trò chuyện:
1. Hỏi đáp, góp ý, hoặc đưa ra các ý tưởng (như trò chơi khởi động, câu hỏi tình huống, bài tập vận dụng) cho bài học trên.
2. Bạn CHỈ hồi đáp bằng văn bản bình thường (KHÔNG trả về cấu trúc JSON tốn kém).
3. LUÔN LUÔN giao tiếp thân thiện, ngắn gọn, chuyên nghiệp và truyền cảm hứng.
4. Tránh lặp lại câu hỏi nếu giáo viên đã chốt ý tưởng.`;

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

    // ── 1. GOOGLE GEMINI ───────────────────────────────────
    if (modelType.startsWith('gemini')) {
      const url = `https://generativelanguage.googleapis.com/v1alpha/models/${actualModel}:generateContent?key=${apiKey}`;

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

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: geminiContents })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Lỗi Gemini API');
      replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    // ── 2. OPENAI ───────────────────────────────────────────────────
    else if (modelType.startsWith('openai')) {
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
    else if (modelType.startsWith('anthropic')) {
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
    
    return NextResponse.json({ reply: replyText }, { status: 200 });

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
