import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();

    const apiKey = body.apiKey;
    const modelType = body.modelType;
    const mode = body.mode || 'generate';

    if (!apiKey || !modelType) {
      return NextResponse.json({ error: "Thiếu API Key hoặc chưa chọn Model AI." }, { status: 400 });
    }

    const MODEL_MAP = {
      'gemini-3-flash-preview':   'gemini-3-flash-preview',
      'gemini-3.0-flash-preview': 'gemini-3-flash-preview',
      'gemini-3.1-pro-preview':   'gemini-3.1-pro-preview',
      'openai-gpt4o-mini':        'gpt-4o-mini',
      'openai-gpt4o':             'gpt-4o',
      'anthropic-sonnet':         'claude-3-5-sonnet-20240620'
    };

    const actualModel = MODEL_MAP[modelType];
    if (!actualModel) {
      return NextResponse.json({ error: `Model ID không hợp lệ: ${modelType}` }, { status: 400 });
    }

    // ══════════════════════════════════════════════════════════════════════
    // MODE 1: Phân tích file tài liệu nguồn (Bước 1)
    // ══════════════════════════════════════════════════════════════════════
    if (mode === 'analyze_file') {
      if (!modelType.startsWith('gemini')) {
        return NextResponse.json({ error: "Tính năng Đọc File hiện chỉ hỗ trợ mô hình Google Gemini." }, { status: 400 });
      }
      
      const fileData = body.fileData; // { mimeType, data (base64), rawText }
      if (!fileData || (!fileData.data && !fileData.rawText)) {
        return NextResponse.json({ error: "Không tìm thấy dữ liệu file." }, { status: 400 });
      }

      const prompt = "Hãy đọc tài liệu đính kèm và tóm tắt ngắn gọn: 1. Nội dung chính của bài. 2. Mục tiêu trọng tâm. 3. Đề xuất các năng lực cần phát triển cho sinh viên. (Đừng dài dòng, trả về văn bản Text thông thường).";

      let partsObj = [];
      if (fileData.rawText) {
        // Đối với DOCX hoặc file text được đọc từ Frontend
        partsObj = [
          { text: `NỘI DUNG TÀI LIỆU:\n${fileData.rawText}\n\nYÊU CẦU THEO SAU:\n${prompt}` }
        ];
      } else {
        // Đối với Ảnh, PDF (truyền raw base64 qua inlineData)
        partsObj = [
          { inlineData: { mimeType: fileData.mimeType, data: fileData.data } },
          { text: prompt }
        ];
      }

      const url = `https://generativelanguage.googleapis.com/v1alpha/models/${actualModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            role: "user", 
            parts: partsObj
          }],
          generationConfig: { maxOutputTokens: 2048 }
        })
      });

      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.error?.message || "Lỗi đọc file từ Gemini API" }, { status: res.status });
      
      const summaryText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!summaryText) return NextResponse.json({ error: "AI không trích xuất được dữ liệu." }, { status: 500 });

      return NextResponse.json({ summary: summaryText }, { status: 200 });
    }

    // ══════════════════════════════════════════════════════════════════════
    // MODE 2: Mô phỏng bài giảng (Bước 5)
    // ══════════════════════════════════════════════════════════════════════
    if (mode === 'simulate') {
      const scenario = body.scenario || "Hãy đóng vai học sinh nghịch ngợm đặt câu hỏi khó.";
      const lessonName = body.formData?.lessonName || "Bài học chung";
      
      const prompt = `Bạn là một Công cụ Mô phỏng Lớp học Sư phạm. 
Bài học: "${lessonName}".
Tình huống cần mô phỏng: ${scenario}

YÊU CẦU:
1. Hãy viết một đoạn hội thoại mô phỏng (khoảng 5-7 lượt chat qua lại).
2. Tác nhân chính gồm: "teacher" (Giáo viên) và "student" (Học sinh).
3. Lời thoại phải tự nhiên, mang tính gợi mở sư phạm, đúng chuyên môn.

CHỈ TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON VỚI FORMAT SAU (KHÔNG DÙNG MARKDOWN):
{
  "dialogue": [
    { "role": "teacher", "content": "..." },
    { "role": "student", "content": "..." }
  ]
}`;

      body.promptText = prompt;
    }

    // ══════════════════════════════════════════════════════════════════════
    // MODE 3: GENERATE (Mặc định - Phụ lục 10)
    // ══════════════════════════════════════════════════════════════════════
    let chatContext = '';
    if (body.chatHistory && body.chatHistory.length > 0) {
      chatContext = `\nĐÂY LÀ ĐOẠN THẢO LUẬN TRƯỚC ĐÓ CỦA TA VỚI GIÁO VIÊN. HÃY BÁM VÀO ĐỂ SOẠN GIÁO ÁN:\n${body.chatHistory.map(msg => `${msg.role === 'user' ? 'Giáo viên' : 'Bạn (AI)'}: ${msg.content}`).join('\n')}\n`;
    }

    let finalPrompt = body.promptText;
    
    if (!finalPrompt && mode === 'generate') {
      finalPrompt = `Bạn là một Chuyên gia Sư phạm xuất sắc. Hãy soạn giáo án chi tiết CHUẨN PHỤ LỤC 10 bài: "${body.formData?.lessonName || 'Bài học'}", loại bài: ${body.formData?.lessonType || 'Lý thuyết'}. Tổng thời gian: ${body.formData?.totalMinutes || 45} phút. Ghi chú: "${body.formData?.notes || 'Không có'}".
Tài nguyên & Năng lực: ${body.wizardData?.competencies?.join(', ') || 'Chưa định nghĩa'}.
${chatContext}
YÊU CẦU CỐT LÕI (BẮT BUỘC TUÂN THỦ 100%):
1. QUY TẮC "BĂM NHỎ" THỜI GIAN VÀ CHIA BUỔI:
   - Nếu tổng thời gian > 180 phút, BẮT BUỘC chia thành các "Buổi học" (Mỗi buổi tối đa 4 tiết = 180 phút). 
   - Chia nhỏ nội dung bài giảng, MỖI HOẠT ĐỘNG KHÔNG ĐƯỢC QUÁ 15 PHÚT. Tự động tính toán để tổng thời gian các hoạt động bằng đúng ${body.formData?.totalMinutes || 45} phút.
2. QUY TẮC PHÂN TIẾT RÕ RÀNG: Trong cột Tên hoạt động ("segmentTitle"), phải ghi rõ hoạt động này thuộc "Tiết 1", "Tiết 2"... tương ứng với số phút đã tính.
3. QUY TẮC NỘI DUNG: Ghi cực kỳ chi tiết kiến thức chuyên môn sẽ truyền đạt trong ô "detailedContent".
4. QUY TẮC HÀNH ĐỘNG DỨT KHOÁT:
   - Cột Hoạt động GV ("teacherActions"): CHỈ GHI ĐỘNG TỪ HÀNH ĐỘNG KHỞI TẠO (VD: Trình chiếu, Phát vấn, Dẫn dắt, Chốt kiến thức, Chia nhóm...). Không ghi dòng diễn giải lê thê.
   - Cột Hoạt động HS ("studentActions"): CHỈ GHI ĐỘNG TỪ HÀNH ĐỘNG ĐÁP TRẢ (VD: Ghi chép, Thảo luận, Trả lời, Lắng nghe, Ghi nhận...).
5. CHỈ TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON (JSON OBJECT) HỢP LỆ. KHÔNG DÙNG MARKDOWN BLOCK (\`\`\`json).
6. NỘI DUNG BẮT BUỘC THEO ĐÚNG CẤU TRÚC KEYS SAU:
{
  "lessonInfo": {
    "lessonNumber": "Số giáo án",
    "chapterName": "Tên chương",
    "lessonName": "${body.formData?.lessonName || 'Tên bài học'}",
    "executionDate": "Ngày thực hiện"
  },
  "objectives": "Mục tiêu bài học (Bám sát ${body.wizardData?.competencies?.join(', ') || ''})",
  "materials": "Đồ dùng dạy học",
  "activities": [
    {
      "segmentTitle": "Buổi 1 - Tiết 1 - Tên hoạt động (1. Ổn định, 2. Khởi động...)",
      "time": "15 phút",
      "detailedContent": "Nội dung kiến thức hạt nhân (ghi cực kỳ chi tiết)...",
      "teacherActions": "Trình chiếu... / Phát vấn...",
      "studentActions": "Lắng nghe... / Thảo luận..."
    }
  ]
}
7. CHUỖI JSON ĐƯỢC ĐÓNG NGOẶC HỢP LỆ VÀ NẰM TRONG 1 OBJECT.`;
    }

    let responseText = '';

    // ── 1. GOOGLE GEMINI ───────────────────────────────────
    if (modelType.startsWith('gemini')) {
      const url = `https://generativelanguage.googleapis.com/v1alpha/models/${actualModel}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192
          }
        })
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Google API Error Response:", data);
        return NextResponse.json({ error: data.error?.message || `Lỗi xác thực từ Google API HTTP ${res.status}.` }, { status: res.status });
      }

      responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        console.error("Dữ liệu trả về bị rỗng:", JSON.stringify(data));
        return NextResponse.json({ error: "Google không trả về kết quả. Có thể nội dung đã bị block an toàn." }, { status: 500 });
      }
    }

    // ── 2. OPENAI ───────────────────────────────────────────────────
    else if (modelType.startsWith('openai') || modelType.startsWith('gpt')) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: actualModel,
          messages: [
            { role: 'system', content: 'Bạn là chuyên gia sư phạm Việt Nam.' },
            { role: 'user', content: finalPrompt }
          ],
          temperature: 0.7,
          max_tokens: 8192
        })
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data.error?.message || `Lỗi từ OpenAI API HTTP ${res.status}` }, { status: res.status });
      }
      responseText = data?.choices?.[0]?.message?.content;
      
      if (!responseText) {
        return NextResponse.json({ error: "OpenAI không trả về kết quả hợp lệ." }, { status: 500 });
      }
    }

    // ── 3. ANTHROPIC CLAUDE ─────────────────────────────────────────
    else if (modelType.startsWith('anthropic') || modelType.startsWith('claude')) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: actualModel,
          max_tokens: 8192,
          system: 'Bạn là chuyên gia sư phạm Việt Nam.',
          messages: [
            { role: 'user', content: finalPrompt }
          ]
        })
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data.error?.message || `Lỗi từ Anthropic API HTTP ${res.status}` }, { status: res.status });
      }
      responseText = data?.content?.[0]?.text;

      if (!responseText) {
        return NextResponse.json({ error: "Anthropic Claude không trả về kết quả hợp lệ." }, { status: 500 });
      }
    }

    // ── NẾU LÀ MODE SIMULATE HOẶC GENERATE, PARSE THỬ TRƯỚC KHI TRẢ VỀ ĐỂ ĐẢM BẢO CHUẨN JSON ──
    try {
      let cleanJson = responseText.replace(/```(json)?\n?|```/g, '').trim();
      const st = cleanJson.indexOf('{');
      const en = cleanJson.lastIndexOf('}');
      if (st !== -1 && en !== -1) cleanJson = cleanJson.substring(st, en + 1);
      
      const parsedObj = JSON.parse(cleanJson);
      
      if (mode === 'simulate') {
        return NextResponse.json({ dialogue: parsedObj.dialogue || [] }, { status: 200 });
      }
    } catch (e) {
      console.error("Parse check failed on backend, continuing to send raw text", e);
    }

    return NextResponse.json({ result: responseText }, { status: 200 });

  } catch (error) {
    console.error("Lỗi 500 tại Server:", error);
    return NextResponse.json({ error: `Lỗi Backend cục bộ: ${error.message}` }, { status: 500 });
  }
}
