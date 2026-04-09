import { streamObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

// Schema cho từng hàng hoạt động giáo án
const LessonRowSchema = z.object({
  segmentTitle: z.string().describe('Tiêu đề hoạt động (VD: "Ổn định lớp", "1. Giảng bài mới")'),
  phut: z.number().describe('Thời lượng (Số nguyên phút, tối đa 15)'),
  noiDungChinh: z.string().describe('Tiêu đề lớn của nội dung, VD: "1. Tổng quan về máy ảnh"'),
  tieuMucCon: z.array(z.string()).describe('Mảng các tiểu mục nhỏ bên trong, VD: ["1.1 Lịch sử phát triển", "1.2 Phân loại máy ảnh"]'),
  teacherAct: z.string().describe('Hoạt động CHI TIẾT của Giáo viên, dùng đánh số: "1. Bước một\n2. Bước hai"'),
  studentAct: z.string().describe('Hoạt động CHI TIẾT của Học sinh, dùng đánh số: "1. Bước một\n2. Bước hai"'),
  ghi_chu: z.string().describe('Ghi chú').optional(),
});

const LessonSchema = z.object({
  muc_tieu: z.string().describe('Mục tiêu bài học tổng quát theo Phụ lục 10'),
  lessonRows: z.array(LessonRowSchema),
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      modelId, 
      modelType, 
      apiKey, 
      mode, 
      systemPrompt, 
      formData,
    } = body;
    
    let requestedModel = (modelId || modelType || 'gemini-1.5-flash').toLowerCase().trim();
    if (requestedModel.startsWith('models/')) requestedModel = requestedModel.replace('models/', '');
    
    // Normalize model for AI SDK (ÉP DÙNG 2.5-FLASH THEO YÊU CẦU DỰ ÁN)
    const modelName = 'gemini-2.5-flash';

    if (!apiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: "Thiếu Gemini API Key từ Client (BYOK) hoặc Server (Env)." }, { status: 401 });
    }

    // 1. Khởi tạo Google Provider động với Key của người dùng hoặc Env
    const google = createGoogleGenerativeAI({
      apiKey: (apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim(),
    });

    const fullPrompt = `${systemPrompt || ''}\n\nDỮ LIỆU CỤ THỂ:\n${JSON.stringify(formData || {}, null, 2)}`;

    // Chỉ áp dụng Streaming cho mode lesson_json hoặc lesson_row
    if (mode === 'lesson_json' || mode === 'lesson_row') {
      // ===== PROMPT "KỶ LUẬT THÉP" =====
      const totalMinutes = formData?.totalMinutes || 180;
      const minActivities = Math.max(12, Math.ceil(totalMinutes / 15));

      const FORMAT_RULES = `
QUY TẮC ĐỊNH DẠNG NỘI DUNG (BẮT BUỘC áp dụng cho mọi trường noi_dung, teacherAct, studentAct):
F1. PHÂN CẤP SỐ: Dùng cấu trúc "1.\n1.1. ...\n1.2. ..." để thể hiện tiểu mục bên trong một hoạt động lớn.
F2. XUỐNG DÒNG: Mỗi tiểu mục PHẢI nằm trên một dòng riêng, ngăn cách bằng ký tự \n thực sự trong chuỗi JSON.
F3. CẤU TRÚC MẪU cho trường noi_dung:\n  "1. Tiêu đề lớn\n1.1. Nội dung nhỏ thứ nhất\n1.2. Nội dung nhỏ thứ hai"
F4. KHÔNG DÙNG markdown phức tạp (không dùng **, ##, bảng, HTML). Chỉ dùng số thứ tự và ký tự \n.
F5. teacherAct và studentAct cũng dùng danh sách đánh số: "1. Bước một\n2. Bước hai\n3. Bước ba"`;

      const steelSystemPrompt = mode === 'lesson_json'
        ? `Bạn là Hệ thống Soạn Giáo án Tự động tuân thủ TUYỆT ĐỐI các quy tắc toán học và cấu trúc sau:
1. TỔNG THỜI GIAN: Bắt buộc phải khớp chính xác 100% với yêu cầu (đúng ${totalMinutes} phút). Tổng các cột phut PHẢI bằng ${totalMinutes}.
2. GIỚI HẠN THỜI GIAN: KHÔNG CÓ BẤT KỲ HOẠT ĐỘNG NÀO ĐƯỢC VƯỢT QUÁ 15 PHÚT. Để đạt đủ ${totalMinutes} phút, bạn PHẢI phân rã thành ÍT NHẤT ${minActivities} hoạt động liên tục.
3. CẤU TRÚC ĐỀ MỤC: Ở mỗi hoạt động, các đề mục nhỏ PHẢI ĐƯỢC GỘP CHUNG vào cùng một ô nội dung. KHÔNG được chẻ mỗi đề mục nhỏ thành một hàng (row) riêng biệt trên bảng.
4. LOGIC SƯ PHẠM: Xây dựng chuỗi hoạt động hợp lý: Ổn định lớp (3–5p) → Kiểm tra bài cũ (5–10p) → Giảng lý thuyết (nhiều bước nhỏ ≤15p mỗi bước) → Đưa ví dụ → Học sinh làm nháp → Chữa bài → Thực hành → Củng cố → Dặn dò.
5. OUTPUT: Chỉ trả về JSON hợp lệ theo schema được cung cấp. KHÔNG giải thích thêm.
${FORMAT_RULES}`
        : `${systemPrompt || ''}\n${FORMAT_RULES}`;

      const steelPrompt = mode === 'lesson_json'
        ? `Dữ liệu đầu vào: Lịch trình buổi học gồm ${totalMinutes} phút (tổng bắt buộc = ${totalMinutes} phút).
Nội dung cần dạy: ${JSON.stringify(formData?.topics || formData?.contents || formData || {})}.
Hãy phân bổ thời gian (max 15p/hoạt động, ít nhất ${minActivities} hoạt động), gom các ý nhỏ vào chung một mục và trình bày nội dung theo phân cấp số (1. / 1.1. / 1.2.) với ký tự xuống dòng \n giữa các mục.`
        : fullPrompt;

      const result = await streamObject({
        model: google(modelName),
        schema: mode === 'lesson_row' ? LessonRowSchema : LessonSchema,
        system: steelSystemPrompt,
        prompt: steelPrompt,
        temperature: 0.7,
      });

      return result.toTextStreamResponse();
    }

    // --- BLOCKING LOGIC FOR OTHER MODES (analyze_file, extract_syllabus, etc.) ---
    const isGemini = !requestedModel.includes('gpt') && !requestedModel.includes('claude');
    let responseText = "";

    if (isGemini) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.7, response_mime_type: "application/json" }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Lỗi API Gemini (Blocking)");
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      return NextResponse.json({ error: "Chế độ này hiện chỉ hỗ trợ Gemini." }, { status: 400 });
    }

    // Post-processing for JSON modes
    if (mode === 'extract_syllabus' || mode === 'analyze_syllabus' || mode === 'analyze_file') {
      const match = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      const jsonStr = match ? match[0] : responseText;
      try {
        const parsed = JSON.parse(jsonStr);
        return NextResponse.json(parsed, { status: 200 });
      } catch (e) {
        return NextResponse.json({ error: "AI không trả về đúng định dạng JSON." }, { status: 500 });
      }
    }

    return NextResponse.json({ text: responseText }, { status: 200 });

  } catch (error) {
    console.error("LỖI API GENERATE (ROUTE):", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
