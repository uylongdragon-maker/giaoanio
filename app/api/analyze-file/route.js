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
      const prompt = `Bạn là "Server AI Client" chuyên gia bóc tách cấu trúc đề cương đào tạo. Hãy phân tích nội dung HTML/Text này và trích xuất dữ liệu bài học một cách chính xác tuyệt đối.

YÊU CẦU TRÍCH XUẤT:
1. tenBai: Tên bài học, chương hoặc học phần lớn.
2. deMuc: Danh sách các đề mục nhỏ, tiểu mục hoặc nội dung chi tiết bên trong bài đó. Gộp thành chuỗi, cách nhau bằng dấu phẩy. VD: "1. Khái niệm, 2. Quy trình".
3. gioLT: Số GIỜ Lý thuyết nguyên bản (chưa quy đổi). Lấy đúng con số trong bảng.
4. gioTH: Số GIỜ Thực hành, Thảo luận, Kiểm tra, Thi (Hệ số 1.0). Cộng dồn nếu các mục này nằm cùng một bài.
   
QUY TẮC QUAN TRỌNG:
- TUYỆT ĐỐI KHÔNG TỰ QUY ĐỔI SANG TIẾT. Chỉ lấy số GIỜ thô từ tài liệu.
- Phải bóc tách hết tất cả các bài, không bỏ sót dòng nào có chứa thời lượng.
- Nếu một bài có nhiều dòng đề mục, hãy gộp chúng lại vào trường 'deMuc'.

BẮT BUỘC TRẢ VỀ JSON ARRAY (KHÔNG CÓ TEXT GIẢI THÍCH):
[
  { "tenBai": "Bài 1...", "deMuc": "Mục 1, Mục 2...", "gioLT": 2, "gioTH": 4 },
  ...
]

Nội dung cần phân tích:
${fileData.rawText}`;
      parts = [{ text: prompt }];
    } else if (fileData.data && fileData.mimeType) {
      const prompt = `Bạn là "Server AI Client" chuyên gia bóc tách tài liệu từ hình ảnh/PDF. Hãy đọc và trích xuất TOÀN BỘ bài học thành mảng JSON.

YÊU CẦU:
1. tenBai: Tên bài học/chương.
2. deMuc: Các đề mục con chi tiết (cách nhau bởi dấu phẩy).
3. gioLT: Số GIỜ Lý thuyết (nguyên bản).
4. gioTH: Tổng số GIỜ Thực hành + Kiểm tra + Thi (nguyên bản, hệ số 1.0).

QUY TẮC:
- Lấy đúng con số GIỜ hiển thị, KHÔNG tự quy đổi sang tiết.
- Bóc tách đầy đủ, không tóm tắt.

BẮT BUỘC trả về JSON Array:
[{"tenBai": "...", "deMuc": "...", "gioLT": 2, "gioTH": 4}, ...]`;
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
