import { streamObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

// Schema tối giản: AI chỉ điền hoatDongGV và hoatDongHS cho từng hàng
const LessonRowSchema = z.object({
  hoatDongGV: z.string().describe("Hoat dong cua giao vien cho de muc nay (van tat 2-4 cau)"),
  hoatDongHS: z.string().describe("Hoat dong cua hoc sinh cho de muc nay (van tat 2-4 cau)"),
});

const LessonSchema = z.object({
  muc_tieu: z.string().describe("Muc tieu bai hoc (Kien thuc, ky nang, thai do)"),
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
QUY TẮC ĐỊNH DẠNG:
F1. teacherAct và studentAct nên dùng danh sách đánh số hoặc gạch đầu dòng nếu có nhiều bước.
F2. KHÔNG DÙNG markdown phức tạp (không dùng **, ##, bảng, HTML).`;

      const steelSystemPrompt = mode === 'lesson_json'
        ? `Ban la TRO LY SOAN GIAO AN. Nhiem vu: Viet HOAT DONG cua GV va HS cho tung hang trong khung xuong giao an.

QUY TAC BAT BUOC:
1. TRA VE DUNG SO HANG: Khung xuong co bao nhieu hang, tra ve day du bay nhieu doi tuong trong lessonRows.
2. TUONG UNG TUNG HANG: hoatDongGV va hoatDongHS phai duoc viet dua tren noi dung "noiDungChinh" va "segmentTitle" cua dung hang do.
3. VAN TAT - SUC TICH: Moi truong viet 2-4 cau. Ghi hoat dong cu the, theo thu tu thuc hien.
4. LIEN QUAN NOI DUNG: Hoat dong phai gan voi noi dung de muc cu the, khong chung chung mo ho.
5. NGON NGU: Tieng Viet ro rang, hanh dong bat dau bang dong tu (Giai thich, Huong dan, Lang nghe, Ghi chep, Thuc hanh...).
${FORMAT_RULES}`
        : `${systemPrompt || ''}\n${FORMAT_RULES}`;

      // Grounding context tu tai lieu bai hoc hoac Tu dien do giao vien upload
      const hasGrounding = !!(formData?.lessonIndex || formData?.lessonRawText || formData?.knowledgeBase);
      const groundingBlock = hasGrounding ? `
===== TAI LIEU NGUON (Tra cuu de viet hoat dong chinh xac voi noi dung mon hoc) =====
${formData?.knowledgeBase ? `[DE CUONG MON HOC]:\n${formData.knowledgeBase.substring(0, 6000)}\n` : ''}${formData?.lessonIndex?.sections
  ? formData.lessonIndex.sections.map((s, i) =>
      `${i + 1}. ${s.heading}\n   Y chinh: ${(s.keyPoints || []).join(' | ')}`
    ).join('\n')
  : ''}${formData?.lessonRawText ? `\nTrich dan bo sung:\n${formData.lessonRawText.substring(0, 2000)}` : ''}
===== HET TAI LIEU NGUON =====` : '';

      const skeletonRows = (formData?.skeleton || []);
      const steelPrompt = mode === 'lesson_json'
        ? `[KHUNG XUONG GIAO AN] - Cac hang can dien hoat dong GV/HS:
${skeletonRows.map((row, i) => `Hang ${i + 1}: [${row.segmentTitle}] - Noi dung: ${row.noiDungChinh || ''} ${(row.tieuMucCon || []).join(', ')}`).join('\n')}

Ten buoi hoc: ${formData?.lessonName || 'Bai hoc'}
Tong thoi gian: ${formData?.totalMinutes || 180} phut

${groundingBlock}

NHIEM VU: Viet hoatDongGV va hoatDongHS cho TUNG HANG theo dung thu tu tren. Moi hang 2-4 cau ngan.
Tong so hang tra ve phai la dung ${skeletonRows.length} hang.
Cung dat muc_tieu chuan su pham cho toan buoi.`
        : fullPrompt;

      const result = await streamObject({
        model: google(modelName),
        schema: mode === 'lesson_row' ? LessonRowSchema : LessonSchema,
        system: steelSystemPrompt,
        prompt: steelPrompt,
        temperature: 0.6,
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
