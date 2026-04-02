import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const maxDuration = 300;

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages, apiKey, lessonData } = body;

    if (!apiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: "Thiếu Gemini API Key cho Chat AI." }, { status: 401 });
    }

    const googleProvider = google({
      apiKey: (apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim(),
    });

    const systemPrompt = `Bạn là chuyên gia sư phạm. Hãy tư vấn giúp giáo viên hoàn thành giáo án chuyên nghiệp nhất. 
Thông tin môn học hiện tại: ${JSON.stringify(lessonData || {})}. 
Hãy trả lời ngắn gọn, súc tích và mang tính chuyên môn cao. Trả lời bằng Markdown.`;

    const result = await streamText({
      model: googleProvider('gemini-1.5-flash'),
      messages,
      system: systemPrompt,
    });

    return result.toDataStreamResponse();

  } catch (error) {
    console.error("LỖI API CHAT:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
