import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    console.log("Đang xử lý API generate...");
    const body = await req.json();
    const { apiKey, modelType, modelId, mode = 'generate', fileData, prompt, history, systemPrompt } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API Key." }, { status: 400 });
    }

    const MODEL_MAP = {
      'gemini-3-flash-preview':   'gemini-3-flash-preview',
      'gemini-3.0-flash-preview': 'gemini-3-flash-preview',
      'gemini-3.1-pro-preview':   'gemini-3.1-pro-preview',
      'gemini-2.5-pro':           'gemini-2.5-pro',
      'gemini-2.5-flash':         'gemini-2.5-flash',
      'gemini-2.0-flash':         'gemini-2.0-flash',
      'openai-gpt4o-mini':        'gpt-4o-mini',
      'openai-gpt4o':             'gpt-4o',
      'anthropic-sonnet':         'claude-3-5-sonnet-20240620'
    };

    const requestedModel = modelId || modelType || 'gemini-2.5-pro';
    const actualModel = MODEL_MAP[requestedModel] || requestedModel;


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

4. Trích xuất TOÀN BỘ nội dung/đề mục chi tiết của bài học đó vào trường 'deMuc'. Hãy lấy càng chi tiết càng tốt từ cột 'Nội dung' hoặc 'Đề mục'.
5. BẮT BUỘC trả về JSON Array, KHÔNG có wrapper, KHÔNG có markdown:
[
  { "tenBai": "Bài 1: Tổng quan", "deMuc": "1. Khái niệm cảm biến... 2. Phân loại máy ảnh...", "tietLT": 3, "tietTH": 0 },
  { "tenBai": "Bài 2: Kỹ thuật ống kính", "deMuc": "1. Tiêu cự... 2. Khẩu độ...", "tietLT": 6, "tietTH": 17 }
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

      const tryAnalyze = async (modelId) => {
        return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
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
      };

      console.log(`[AI-Analyze] Đang gọi ${actualModel}...`);
      let res = await tryAnalyze(actualModel);
      let data = await res.json();

      if (!res.ok) throw new Error(data.error?.message || "Lỗi AI bóc tách");

      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      // GỌT VỎ MARKDOWN (QUAN TRỌNG)
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanJson);
        const lessonsArray = Array.isArray(parsed) ? parsed : (parsed.lessons || []);
        return NextResponse.json({ lessons: lessonsArray }, { status: 200 });
      } catch (e) {
        console.error("Lỗi Parse JSON. Chuỗi gốc từ AI:", responseText);
        return NextResponse.json({ 
          error: "Lỗi AI/Parse", 
          details: "Dữ liệu AI trả về sai định dạng JSON." 
        }, { status: 500 });
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

    let finalPrompt = body.promptText || body.prompt;
    
    if (!finalPrompt && mode === 'generate') {
      const { formData, wizardData } = body;
      const breakdown = (formData?.tietLT || formData?.tietTH) 
        ? `Cấu trúc buổi học: ${formData.tietLT || 0} tiết Lý thuyết, ${formData.tietTH || 0} tiết Thực hành/Kiểm tra.`
        : '';
      const topicsContext = formData?.topics?.length > 0
        ? `\nBẮT BUỘC chỉ tập trung giảng dạy các đề mục sau: ${formData.topics.join(', ')}. Tuyệt đối không lan man sang các phần khác của chương.` 
        : '';

      finalPrompt = `Bạn là một Chuyên gia Sư phạm xuất sắc. Hãy soạn giáo án chi tiết CHUẨN PHỤ LỤC 10 bài: "${formData?.lessonName || 'Bài học'}", loại bài: ${formData?.lessonType || 'Lý thuyết'}. 
Tổng thời gian: ${formData?.totalMinutes || 45} phút. ${breakdown} ${topicsContext}
Ghi chú: "${formData?.notes || 'Không có'}".
Tài nguyên & Năng lực: ${wizardData?.competencies?.join(', ') || 'Chưa định nghĩa'}.
${chatContext}
YÊU CẦU CỐT LÕI (BẮT BUỘC TUÂN THỦ 100%):
1. QUY TẮC PHÂN BỔ NỘI DUNG:
   - Nếu có Tiết Lý thuyết: Tập trung vào truyền đạt kiến thức, dẫn dắt, giải thích.
   - Nếu có Tiết Thực hành/Kiểm tra: Tập trung vào hoạt động rèn luyện, bài tập, chấm điểm, đánh giá.
    - Cột Hoạt động GV: CHỈ GHI ĐỘNG TỪ HÀNH ĐỘNG KHỞI TẠO (VD: Trình chiếu, Phát vấn, Dẫn dắt, Chốt kiến thức, Chia nhóm...). Không ghi dòng diễn giải lê thê.
    - Cột Hoạt động HS: CHỈ GHI ĐỘNG TỪ HÀNH ĐỘNG ĐÁP TRẢ (VD: Ghi chép, Thảo luận, Trả lời, Lắng nghe, Ghi nhận...).
    - QUY TẮC DÀN TRANG: Sử dụng bảng (table) chuẩn HTML cho toàn bộ cấu trúc giáo án để đảm bảo xuất file Word không bị lệch. Sử dụng border="1" cho các bảng nội dung chính.
    - QUY TẮC THỂ THỨC & BỐ CỤC: Bắt buộc tuân thủ 100% thể thức trình bày và bố cục của mẫu đã nạp. Không được tự ý thay đổi vị trí các thành phần.
   - Tổng quỹ thời gian của buổi này là đúng ${formData?.totalMinutes || 45} phút. Tự động tính toán để tổng thời gian các hoạt động BẮT BUỘC bằng đúng ${formData?.totalMinutes || 45} phút.
   - Chia thành các hoạt động không quá 15 phút. Tuyệt đối bám sát nội dung và thời gian này.
2. QUY TẮC PHÂN TIẾT RÕ RÀNG: Ghi rõ hoạt động này thuộc "Tiết 1", "Tiết 2"... tương ứng với số phút đã tính.
3. QUY TẮC TIẾN TRÌNH DẠY HỌC (BẮT BUỘC): Khi tạo bảng tiến trình, BẮT BUỘC sử dụng chính xác cấu trúc HTML sau, chỉ thay thế nội dung bên trong:
<table border="1" style="border-collapse: collapse; width: 100%;">
  <tr>
    <th rowspan="2">TT</th>
    <th rowspan="2">NỘI DUNG</th>
    <th colspan="2">HOẠT ĐỘNG DẠY HỌC</th>
    <th rowspan="2">THỜI GIAN</th>
  </tr>
  <tr>
    <th>HOẠT ĐỘNG CỦA GIÁO VIÊN</th>
    <th>HOẠT ĐỘNG CỦA HỌC SINH</th>
  </tr>
  <tr>
    <td>1</td>
    <td>Dẫn nhập...</td>
    <td>Giáo viên làm gì...</td>
    <td>Học sinh làm gì...</td>
    <td>5 phút</td>
  </tr>
</table>

4. QUY TẮC NỘI DUNG: Ghi cực kỳ chi tiết kiến thức chuyên môn sẽ truyền đạt.
5. QUY TẮC HÀNH ĐỘNG DỨT KHOÁT:
5. NHIỆM VỤ BẮT BUỘC: Đúc kết nội dung giáo án và TRẢ VỀ DUY NHẤT MÃ HTML THUẦN TÚY. Cấu trúc HTML phải bám sát 100% vào Mẫu Template được cung cấp (nếu có). 

6. LƯU Ý KỸ THUẬT: 
   - Chỉ điền nội dung vào các ô trống phù hợp, giữ nguyên các bảng biểu, quốc hiệu, tiêu đề gốc. 
   - TUYỆT ĐỐI KHÔNG trả về định dạng JSON. 
    - TUYỆT ĐỐI KHÔNG bọc kết quả trong các thẻ markdown (như \`\`\`html ... \`\`\`). 
   - CHỈ trả về mã HTML bắt đầu bằng thẻ mở và kết thúc bằng thẻ đóng.
   - Nội dung phải chuyên nghiệp, sư phạm, trình bày đẹp bằng font chữ Times New Roman.`;
    }

    // Nếu có systemPrompt (từ frontend), hãy bám sát nó
    if (systemPrompt && mode === 'generate') {
      const titleContext = body.formData?.lessonName ? `BÀI HỌC: ${body.formData.lessonName}\n` : '';
      const notesContext = body.formData?.notes ? `TÀI LIỆU THAM KHẢO: ${body.formData.notes}\n` : '';
      
      finalPrompt = `${titleContext}${notesContext}${systemPrompt}\n\nNHIỆM VỤ BỔ SUNG: ${finalPrompt || 'Tiến hành soạn thảo.'}\n\nLỆNH THÉP: 
1. Đúc kết nội dung giáo án và TRẢ VỀ DUY NHẤT MÃ HTML THUẦN TÚY. 
2. Mọi thẻ <table> cho "Nguồn tài liệu tham khảo" và "Tiến trình dạy học" PHẢI có border="1" để tạo khung kẻ bảng.
3. Bảng ký tên cuối trang PHẢI có border="0". 
4. CÁC TIÊU ĐỀ (Mục tiêu, Đồ dùng, Nguồn tài liệu tham khảo, Trưởng khoa, Giảng viên) PHẢI IN ĐẬM và VIẾT HOA.
5. Cấu trúc phải bám sát 100% vào Mẫu Template về cả thể thức và bố cục.`;
    }

    let responseText = '';

    const safeModelType = modelType || '';

    // ── 1. GOOGLE GEMINI (ROBUST RETRY & FALLBACK) ──────────────────────────
    if (safeModelType.startsWith('gemini')) {
      const tryFetch = async (endpoint, modelId) => {
        const url = `https://generativelanguage.googleapis.com/${endpoint}/models/${modelId}:generateContent?key=${apiKey.trim()}`;
        const payload = {
          contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        };
        return await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      };

      // Thử model chính
      console.log(`[AI] Đang gọi Gemini (${actualModel})...`);
      let res = await tryFetch('v1beta', actualModel);
      let data = await res.json();

      if (!res.ok) {
        console.error("LỖI GOOGLE API:", data);
        return NextResponse.json({ 
          success: false, 
          error: data.error?.message || `Google API trả về lỗi ${res.status}` 
        }, { status: res.status });
      }

      responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        console.error("Dữ liệu trả về bị rỗng:", JSON.stringify(data));
        return NextResponse.json({ error: "Google không trả về kết quả. Có thể nội dung đã bị block an toàn." }, { status: 500 });
      }
    }

    // ── 2. OPENAI ───────────────────────────────────────────────────
    else if (safeModelType.startsWith('openai') || safeModelType.startsWith('gpt')) {
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
    else if (safeModelType.startsWith('anthropic') || safeModelType.startsWith('claude')) {
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

    // ── HẬU XỬ LÝ: TỰ ĐỘNG BÓC TÁCH NẾU AI TRẢ VỀ JSON HOẶC MARKDOWN NHẦM ──
    try {
      let cleanText = responseText.replace(/```(json|html|markdown)?/gi, '').replace(/```/g, '').trim();
      
      if (cleanText.startsWith('{') && cleanText.indexOf('}') !== -1) {
        // Trích xuất phần JSON thực sự (phòng trường hợp có text rác xung quanh)
        const st = cleanText.indexOf('{');
        const en = cleanText.lastIndexOf('}');
        const jsonOnly = cleanText.substring(st, en + 1);
        
        try {
          const parsed = JSON.parse(jsonOnly);
          
          if (mode === 'simulate') {
            if (parsed.dialogue) return NextResponse.json({ dialogue: parsed.dialogue }, { status: 200 });
            if (parsed.html) return NextResponse.json({ html: parsed.html }, { status: 200 });
          } else if (mode === 'generate') {
            // Unwrapping cho giáo án
            responseText = parsed.html || parsed.giao_an_html || parsed.content || parsed.text || responseText;
          }
        } catch (parseError) {
          // Nếu không parse được JSON, dùng cleanText đã gọt markdown
          responseText = cleanText;
        }
      } else {
        // Không phải JSON, nhưng có thể đã gọt được markdown
        responseText = cleanText;
      }
    } catch (e) {
      console.error("Lỗi hậu xử lý AI response:", e);
    }

    return NextResponse.json({ text: responseText }, { status: 200 });

  } catch (error) {
    console.error("LỖI API (generate):", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
