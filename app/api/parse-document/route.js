import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(req) {
  try {
    const body = await req.json();
    const { apiKey, fileData } = body;

    const googleProvider = createGoogleGenerativeAI({
      apiKey: (apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim(),
    });

    const prompt = `Bạn là chuyên gia bóc tách chương trình đào tạo chuyên nghiệp. 
Nhiệm vụ: Duyệt qua toàn bộ nội dung file Đề cương/Tiến độ tải lên và Nhắm thẳng vào bảng "Nội dung và phân phối thời gian" để bóc tách thành mảng JSON chuẩn xác.

TUYỆT ĐỐI KHÔNG SÁNG TẠO HAY THÊM THẮT! Chỉ trích xuất từ văn bản gốc.

YÊU CẦU DỮ LIỆU:
1. tenBai: Tên bài học hoặc chương lớn.
2. tieuMuc: Mảng các tiểu mục (Ví dụ: ['1.1 Khái niệm', '1.2 Phân loại']). Nếu không có thì là mảng rỗng [].
3. tietLT: Số TIẾT lý thuyết (Không phải giờ). (Lưu ý: Nếu bảng ghi là "Giờ" thì mặc định 1 giờ LT = 1 tiết LT. Chỉ ghi nhận số gốc).
4. tietTH: Số TIẾT thực hành/kiểm tra/thi.`;

    let input;
    if (fileData.rawText) {
      input = { prompt: `${prompt}\n\nNội dung cần trích xuất:\n${fileData.rawText}` };
    } else if (fileData.data && fileData.mimeType) {
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

    const generateArgs = {
      model: googleProvider('gemini-1.5-pro'),
      schema: z.object({
        subjectName: z.string().describe("Tên môn học/mô đun"),
        curriculum: z.array(z.object({
          tenBai: z.string(),
          tieuMuc: z.array(z.string()).describe("Mảng các tiểu mục (Ví dụ: ['1.1 Khái niệm', '1.2 Phân loại'])"),
          tietLT: z.number().default(0),
          tietTH: z.number().default(0)
        }))
      }),
    };

    if (fileData.rawText) {
      generateArgs.prompt = input.prompt;
    } else {
      generateArgs.messages = input.messages;
    }

    const { object } = await generateObject(generateArgs);

    return NextResponse.json({ 
      subjectName: object.subjectName, 
      curriculum: object.curriculum 
    }, { status: 200 });

  } catch (error) {
    console.error("LỖI API (parse-document):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
