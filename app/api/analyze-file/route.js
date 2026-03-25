import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    console.log("Đang xử lý API analyze-file...");
    const body = await req.json();
    const { apiKey, modelType, modelId, fileData } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API Key." }, { status: 400 });
    }

    const actualModel = modelId || modelType || 'gemini-3.0-flash-preview';
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

    // QUY TẮC CHỌN MODEL ROBUST
    let modelToTry = actualModel;
    if (modelToTry === 'gemini-1.5-flash') modelToTry = 'gemini-1.5-flash-latest';
    
    const tryFetch = async (endpoint, modelId) => {
      const url = `https://generativelanguage.googleapis.com/${endpoint}/models/${modelId}:generateContent?key=${apiKey.trim()}`;
      
      const payload = {
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 8192
        }
      };

      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    };

    // THỬ MODEL ĐƯỢC CHỌN (Ví dụ: gemini-3.0-flash-preview)
    console.log("Đang gọi Gemini...");
    let res = await tryFetch('v1beta', actualModel);
    let data = await res.json();

    if (!res.ok) {
      console.error("LỖI GOOGLE API:", data);
      return NextResponse.json({ 
        success: false, 
        error: data.error?.message || `Google API trả về lỗi ${res.status}` 
      }, { status: res.status });
    }

    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!responseText) {
      return NextResponse.json({ 
        error: "Lỗi AI (Rỗng)", 
        details: "AI không trả về nội dung. Có thể do nội dung bị chặn hoặc model bận." 
      }, { status: 500 });
    }

    // TRÍCH XUẤT JSON ROBUST
    let cleanJson = responseText;
    const firstBracket = responseText.search(/[\[\{]/);
    const lastBracket = Math.max(responseText.lastIndexOf(']'), responseText.lastIndexOf('}'));
    
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleanJson = responseText.substring(firstBracket, lastBracket + 1);
    } else {
      cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    try {
      const parsedData = JSON.parse(cleanJson);
      const lessonsArray = Array.isArray(parsedData) ? parsedData : (parsedData.lessons || []);
      
      if (lessonsArray.length === 0) {
        throw new Error("Mảng bài học trống.");
      }

      return NextResponse.json({ lessons: lessonsArray }, { status: 200 });
    } catch (parseError) {
      console.error("Lỗi Parse JSON. Chuỗi gốc từ AI:", responseText);
      return NextResponse.json({ 
        error: "Lỗi AI (Định dạng)", 
        details: "AI trả về dữ liệu không đúng cấu trúc JSON mong muốn.",
        raw: responseText.substring(0, 200)
      }, { status: 500 });
    }

  } catch (error) {
    console.error("LỖI API (analyze-file):", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
