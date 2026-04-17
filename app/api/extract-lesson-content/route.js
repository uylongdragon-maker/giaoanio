import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 120;

// Schema chỉ mục bài học — nhẹ, không sinh giáo án đầy đủ
const LessonIndexSchema = z.object({
  lessonTitle: z.string().describe('Tên bài học trích từ tài liệu'),
  summary: z.string().describe('Tóm tắt mục tiêu/nội dung tổng quan của bài trong 2-3 câu'),
  sections: z.array(z.object({
    heading: z.string().describe('Tiêu đề mục/phần (VD: "1. Khái niệm cơ bản", "2. Phương pháp...")'),
    keyPoints: z.array(z.string()).describe('Danh sách 3-7 ý chính ngắn gọn của mục này'),
    rawContent: z.string().describe('Đoạn nội dung gốc của mục này, giữ nguyên không tóm lược'),
  })).describe('Danh sách các mục/chương trong bài học'),
});

export async function POST(req) {
  try {
    const { apiKey, rawText, lessonName } = await req.json();

    if (!rawText || rawText.trim().length < 20) {
      return NextResponse.json({ error: 'Nội dung file quá ngắn hoặc rỗng.' }, { status: 400 });
    }

    const google = createGoogleGenerativeAI({
      apiKey: (apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim(),
    });

    // Giới hạn độ dài để tránh vượt context window của flash
    const truncatedText = rawText.length > 60000 ? rawText.substring(0, 60000) + '\n...[Đã cắt bớt]' : rawText;

    const { object } = await generateObject({
      model: google('gemini-1.5-flash'),   // Flash: rẻ, nhanh, đủ cho indexing
      schema: LessonIndexSchema,
      prompt: `Bạn là trợ lý phân tích tài liệu giảng dạy. 
Nhiệm vụ: Đọc nội dung bài học dưới đây và tạo chỉ mục cấu trúc (KHÔNG soạn giáo án, KHÔNG thêm nội dung ngoài tài liệu).

Tên bài học (nếu có): ${lessonName || '(chưa rõ)'}

Yêu cầu:
1. Chia nội dung thành các mục/phần theo cấu trúc trong tài liệu
2. Với mỗi mục: liệt kê các ý chính dưới dạng bullet points ngắn gọn
3. Giữ lại đoạn nội dung gốc của từng mục trong "rawContent" để dùng làm nguồn khi soạn giáo án
4. KHÔNG bịa thêm nội dung không có trong tài liệu

Nội dung tài liệu:
---
${truncatedText}
---`,
    });

    return NextResponse.json({ index: object }, { status: 200 });

  } catch (error) {
    console.error('[extract-lesson-content] Lỗi:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
