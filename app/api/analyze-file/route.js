import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(req) {
  try {
    const body = await req.json();
    const { apiKey, fileData } = body;

    const googleProvider = google({
      apiKey: (apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim(),
    });

    const prompt = `Bạn là chuyên gia bóc tách chương trình đào tạo chuyên nghiệp. 
Nhiệm vụ: Duyệt qua toàn bộ nội dung và trích xuất danh sách các bài học.

YÊU CẦU DỮ LIỆU:
1. tenBai: Tên bài học hoặc chương lớn.
2. deMuc: Các tiểu mục chi tiết bên trong (cách nhau bởi dấu phẩy).
3. gioLT: Số GIỜ lý thuyết nguyên bản.
4. gioTH: Số GIỜ thực hành/kiểm tra/thi (hệ số 1.0).`;

    let input;
    if (fileData.rawText) {
      input = { prompt: `${prompt}\n\nNội dung cần trích xuất:\n${fileData.rawText}` };
    } else if (fileData.data && fileData.mimeType) {
      // AI SDK supports multi-modal inputs
      input = {
        prompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'file', data: fileData.data, mimeType: fileData.mimeType }
            ]
          }
        ]
      };
    } else {
      return NextResponse.json({ error: "Không có dữ liệu file để phân tích." }, { status: 400 });
    }

    const { object } = await generateObject({
      model: googleProvider('gemini-1.5-flash'),
      schema: z.object({
        lessons: z.array(z.object({
          tenBai: z.string(),
          deMuc: z.string(),
          gioLT: z.number(),
          gioTH: z.number(),
        }))
      }),
      prompt: typeof input.prompt === 'string' ? input.prompt : undefined,
      // fallback for file input if needed, but for now we follow simple prompt for text files
    });

    return NextResponse.json({ lessons: object.lessons }, { status: 200 });

  } catch (error) {
    console.error("LỖI API (analyze-file):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
