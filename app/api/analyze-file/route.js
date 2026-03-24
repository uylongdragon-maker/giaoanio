import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { apiKey, modelType, fileData } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API Key." }, { status: 400 });
    }

    const actualModel = modelType || 'gemini-1.5-flash';
    let parts;

    if (fileData.rawText) {
      const prompt = `Bạn là chuyên gia bóc tách đề cương. Hãy phân tích bảng HTML và trích xuất TOÀN BỘ dữ liệu thành mảng JSON. 
YÊU CẦU:
1. tenBai: Tên chương/bài lớn.
2. deMuc: Gộp tất cả các dòng mục lục con/chi tiết nằm bên dưới bài đó thành một chuỗi, cách nhau bằng dấu phẩy. VD: '1. Khái niệm, 2. Phân loại'. Nếu không có thì để trống.
3. gioLT: Số Giờ Lý thuyết nguyên bản.
4. gioTH: Tổng số Giờ Thực hành + Kiểm tra + Thi.
TUYỆT ĐỐI KHÔNG QUY ĐỔI. Lấy đúng con số hiển thị trong bảng.

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON ARRAY SAU:
[
  { "tenBai": "Bài 1", "deMuc": "Mục A, Mục B", "gioLT": 2, "gioTH": 4 },
  ...
]

Nội dung HTML cần phân tích:
${fileData.rawText}`;
      parts = [{ text: prompt }];
    } else if (fileData.data && fileData.mimeType) {
      const prompt = `Bạn là chuyên gia bóc tách đề cương. Hãy đọc tài liệu và trích xuất TOÀN BỘ bài học thành mảng JSON.
YÊU CẦU:
1. tenBai: Tên chương/bài lớn.
2. deMuc: Tìm các đề mục con/chi tiết nếu có, gộp chúng lại thành một chuỗi, cách nhau bằng dấu phẩy. VD: '1. Khái niệm, 2. Phân loại'.
3. gioLT: Số Giờ Lý thuyết nguyên bản.
4. gioTH: Tổng Giờ Thực hành + Kiểm tra + Thi (Hệ số 1.0).
TUYỆT ĐỐI KHÔNG QUY ĐỔI. Lấy đúng con số hiển thị trong tài liệu.

BẮT BUỘC trả về JSON Array:
[{"tenBai": "Tên bài 1", "deMuc": "Mục 1, Mục 2", "gioLT": 2, "gioTH": 4}, ...]`;
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
          temperature: 0.1,
          maxOutputTokens: 8192
        }
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Lỗi AI bóc tách");

    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // TRÍCH XUẤT JSON ROBUST (Tìm cặp ngoặc đầu và cuối)
    const firstBracket = responseText.search(/[\[\{]/);
    const lastBracket = Math.max(responseText.lastIndexOf(']'), responseText.lastIndexOf('}'));
    
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      responseText = responseText.substring(firstBracket, lastBracket + 1);
    } else {
      responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    try {
      if (!responseText) throw new Error("AI trả về kết quả rỗng.");
      const parsedData = JSON.parse(responseText);
      const lessonsArray = Array.isArray(parsedData) ? parsedData : (parsedData.lessons || []);
      return NextResponse.json({ lessons: lessonsArray }, { status: 200 });
    } catch (parseError) {
      console.error("Lỗi Parse JSON. Chuỗi gốc từ AI:", responseText);
      return NextResponse.json({ 
        error: "Lỗi AI/Parse", 
        details: parseError.message,
        raw: responseText.substring(0, 500) // Trả về một đoạn để debug
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Analyze File Error:", error);
    return NextResponse.json({ error: "Lỗi AI/Parse", details: error.message }, { status: 500 });
  }
}
