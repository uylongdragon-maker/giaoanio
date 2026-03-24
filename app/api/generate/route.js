import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { apiKey, modelType, mode, fileData } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API Key." }, { status: 400 });
    }

    const actualModel = modelType || 'gemini-3-flash-preview';

    // ══════════════════════════════════════════════════════════════════════
    // MODE 1: ANALYZE SYLLABUS (Bóc tách phân phối chương trình)
    // ══════════════════════════════════════════════════════════════════════
    if (mode === 'analyze_syllabus') {
      if (!fileData) {
        return NextResponse.json({ error: "Thiếu dữ liệu file." }, { status: 400 });
      }

      // --- Build prompt and content parts based on the input type ---
      let parts;

      if (fileData.rawText) {
        // FAST PATH: HTML/text already extracted client-side (DOCX via mammoth)
        const prompt = `Bạn là chuyên gia phân tích chương trình đào tạo. Dưới đây là nội dung HTML của một file đề cương. Cấu trúc bảng phân phối thời gian rất phức tạp, có các cột: Tổng số, Lý thuyết, Thực hành, KT (Kiểm tra), Thi.

Nhiệm vụ của bạn:
1. Trích xuất TẤT CẢ các dòng có chứa thời gian học. Bao gồm các 'Bài học', các buổi 'Kiểm tra', và buổi 'Thi kết thúc'. TUYỆT ĐỐI KHÔNG BỎ SÓT DÒNG NÀO.
2. Với mỗi dòng, tìm chính xác số Giờ Lý Thuyết, Giờ Thực Hành, Giờ Kiểm Tra, Giờ Thi. (Lưu ý: Bảng HTML có thể bị xô lệch cột do merge cell, hãy dựa vào ngữ cảnh để lấy đúng số).
3. TỰ ĐỘNG QUY ĐỔI TỪ GIỜ SANG TIẾT theo công thức bắt buộc:
   - tietLT = Số Giờ Lý thuyết.
   - tietTH = Math.round( (Số Giờ Thực hành + Số Giờ Kiểm tra + Số Giờ Thi) * 60 / 45 ).

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON ARRAY. Dưới đây là VÍ DỤ MẪU CHUẨN ĐÚNG VỚI CẤU TRÚC FILE NÀY:
[
  { "tenBai": "Bài 1: Tổng quan", "tietLT": 3, "tietTH": 0 },
  { "tenBai": "Bài 2: Kỹ thuật máy quay", "tietLT": 6, "tietTH": 17 },
  { "tenBai": "Kiểm tra 1", "tietLT": 0, "tietTH": 1 },
  { "tenBai": "Bài 3: Kỹ thuật chụp ảnh", "tietLT": 6, "tietTH": 17 },
  { "tenBai": "Kiểm tra 2", "tietLT": 0, "tietTH": 1 },
  { "tenBai": "Thi kết thúc môn học", "tietLT": 0, "tietTH": 3 }
]

Nội dung HTML cần phân tích:
${fileData.rawText}`;

        parts = [{ text: prompt }];

      } else if (fileData.data && fileData.mimeType) {
        // VISION PATH: PDF or Image, needs Gemini Vision
        const prompt = `Bạn là chuyên gia phân tích chương trình đào tạo. Hãy đọc TOÀN BỘ tài liệu này và trích xuất MỌI BÀI HỌC có trong đó.

KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ BÀI NÀO. KHÔNG ĐƯỢC TÓM TẮT CHUNG CHUNG.
Quy đổi: theory = Giờ LT. practical = Math.round((Giờ TH * 60) / 45).
BẮT BUỘC trả về JSON Array, KHÔNG có wrapper, KHÔNG có markdown:
[{"name": "Tên bài 1", "theory": 2, "practical": 1}, ...]`;

        parts = [
          { text: prompt },
          { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }
        ];
      } else {
        return NextResponse.json({ error: "Không có dữ liệu file để phân tích." }, { status: 400 });
      }

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 8192
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Lỗi AI bóc tách");

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const cleanJson = text.replace(/```(json)?\n?|```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanJson);
        
        // Handle both Array format (new) and Object format {lessons:[]} (old)
        const lessonsArray = Array.isArray(parsed) ? parsed : (parsed.lessons || []);
        return NextResponse.json({ lessons: lessonsArray }, { status: 200 });
      } catch (e) {
        // Fallback: try to extract array or object
        const startArr = cleanJson.indexOf('[');
        const endArr = cleanJson.lastIndexOf(']');
        const startObj = cleanJson.indexOf('{');
        const endObj = cleanJson.lastIndexOf('}');
        
        if (startArr !== -1 && endArr !== -1) {
          const extracted = JSON.parse(cleanJson.substring(startArr, endArr + 1));
          return NextResponse.json({ lessons: extracted }, { status: 200 });
        } else if (startObj !== -1 && endObj !== -1) {
          const extracted = JSON.parse(cleanJson.substring(startObj, endObj + 1));
          return NextResponse.json(extracted, { status: 200 });
        }
        throw e;
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // MODE 2: SIMULATE (Mô phỏng lớp học)
    // ══════════════════════════════════════════════════════════════════════
    if (mode === 'simulate') {
      const { lessonName, scenario, type } = body;
      let prompt = "";
      
      if (type === 'visual') {
        prompt = `Bạn là một Công cụ Vẽ Sơ đồ Trực quan bằng HTML/CSS.
Bài học: "${lessonName}".
Yêu cầu vẽ: ${scenario}

YÊU CẦU KỸ THUẬT:
1. Hãy tạo một đoạn mã HTML và CSS (inline style hoặc <style> block) để minh họa trực quan yêu cầu trên.
2. Sử dụng màu sắc rõ nét, các khối div bo góc, icon (nếu cần dùng SVG đơn giản), và label chú thích.
3. Mã phải chạy được ngay trong một iframe (đầy đủ <html><body>...</body></html>).
4. Phải mang tính sư phạm, dễ hiểu cho học sinh.

CHỈ TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON VỚI FORMAT SAU (KHÔNG DÙNG MARKDOWN):
{
  "html": "<html>...</html>"
}`;
      } else {
        prompt = `Bạn là một Công cụ Mô phỏng Lớp học Sư phạm. 
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
      }

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
      const { formData, wizardData } = body;
      const breakdown = (formData?.tietLT || formData?.tietTH) 
        ? `Cấu trúc buổi học: ${formData.tietLT || 0} tiết Lý thuyết, ${formData.tietTH || 0} tiết Thực hành/Kiểm tra.`
        : '';

      finalPrompt = `Bạn là một Chuyên gia Sư phạm xuất sắc. Hãy soạn giáo án chi tiết CHUẨN PHỤ LỤC 10 bài: "${formData?.lessonName || 'Bài học'}", loại bài: ${formData?.lessonType || 'Lý thuyết'}. 
Tổng thời gian: ${formData?.totalMinutes || 45} phút. ${breakdown}
Ghi chú: "${formData?.notes || 'Không có'}".
Tài nguyên & Năng lực: ${wizardData?.competencies?.join(', ') || 'Chưa định nghĩa'}.
${chatContext}
YÊU CẦU CỐT LÕI (BẮT BUỘC TUÂN THỦ 100%):
1. QUY TẮC PHÂN BỔ NỘI DUNG:
   - Nếu có Tiết Lý thuyết: Tập trung vào truyền đạt kiến thức, dẫn dắt, giải thích.
   - Nếu có Tiết Thực hành/Kiểm tra: Tập trung vào hoạt động rèn luyện, bài tập, chấm điểm, đánh giá.
   - Tổng quỹ thời gian của buổi này là đúng ${formData?.totalMinutes || 45} phút. Tự động tính toán để tổng thời gian các hoạt động BẮT BUỘC bằng đúng ${formData?.totalMinutes || 45} phút.
   - Chia thành các hoạt động không quá 15 phút. Tuyệt đối bám sát nội dung và thời gian này.
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
        if (parsedObj.dialogue) return NextResponse.json({ dialogue: parsedObj.dialogue }, { status: 200 });
        if (parsedObj.html) return NextResponse.json({ html: parsedObj.html }, { status: 200 });
        return NextResponse.json({ dialogue: [] }, { status: 200 });
      }
    } catch (e) {
      console.error("Parse check failed on backend, continuing to send raw text", e);
    }

    return NextResponse.json({ result: responseText }, { status: 200 });

  } catch (error) {
    console.error("Lỗi 500 tại Server:", error);
    return NextResponse.json({ 
      error: "Lỗi AI/Parse", 
      details: error.message 
    }, { status: 500 });
  }
}
