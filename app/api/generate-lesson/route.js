import { streamObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

// Schema cho từng hàng hoạt động giáo án
const LessonRowSchema = z.object({
  segmentTitle: z.string().describe('Tiêu đề hoạt động (VD: "Ổn định lớp", "1.1. Máy ảnh là gì?")'),
  phut: z.number().describe('Thời lượng (Số nguyên phút)'),
  noi_dung: z.string().describe('Tóm tắt nội dung kiến thức'),
  teacherAct: z.string().describe('Hoạt động CHI TIẾT của Giáo viên (Dùng số thứ tự 1, 2, 3...)'),
  studentAct: z.string().describe('Hoạt động CHI TIẾT của Học sinh (Dùng số thứ tự 1, 2, 3...)'),
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

    // Chỉ áp dụng Streaming cho mode lesson_json
    if (mode === 'lesson_json') {
      const result = await streamObject({
        model: google(modelName),
        schema: LessonSchema,
        prompt: fullPrompt,
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
