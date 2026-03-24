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
      const prompt = `Bạn là chuyên gia bóc tách chương trình đào tạo. Dưới đây là nội dung HTML của một file đề cương. Cấu trúc bảng phân phối thời gian rất phức tạp, có các cột: Tổng số, Lý thuyết, Thực hành, KT (Kiểm tra), Thi.

Nhiệm vụ của bạn:
1. Trích xuất TẤT CẢ các dòng có chứa thời gian học. Bao gồm các 'Bài học', các buổi 'Kiểm tra', và buổi 'Thi kết thúc'. TUYỆT ĐỐI KHÔNG BỎ SÓT DÒNG NÀO.
2. Với mỗi dòng, tìm chính xác số GIỜ học nguyên bản từ bảng.
   - gioLT: Số Giờ Lý thuyết.
   - gioTH: Tổng của (Số Giờ Thực hành + Số Giờ Kiểm tra + Số Giờ Thi).
3. TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ QUY ĐỔI SANG TIẾT. Lấy đúng con số hiển thị trong bảng.

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON ARRAY. Dưới đây là VÍ DỤ MẪU:
[
  { "tenBai": "Bài 1: Tổng quan", "gioLT": 3, "gioTH": 0 },
  { "tenBai": "Bài 2: Kỹ thuật máy quay", "gioLT": 6, "gioTH": 13 },
  { "tenBai": "Kiểm tra 1", "gioLT": 0, "gioTH": 1 },
  { "tenBai": "Thi kết thúc môn học", "gioLT": 0, "gioTH": 3 }
]

Nội dung HTML cần phân tích:
${fileData.rawText}`;
      parts = [{ text: prompt }];
    } else if (fileData.data && fileData.mimeType) {
      const prompt = `Bạn là chuyên gia phân tích chương trình đào tạo. Hãy đọc TOÀN BỘ tài liệu này và trích xuất MỌI BÀI HỌC.

Nhiệm vụ: Trích xuất chính xác số GIỜ học nguyên bản từ bảng (KHÔNG QUY ĐỔI).
- gioLT: Số Giờ Lý thuyết.
- gioTH: Tổng Giờ Thực hành/Kiểm tra/Thi.

BẮT BUỘC trả về JSON Array:
[{"tenBai": "Tên bài 1", "gioLT": 2, "gioTH": 4}, ...]`;
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

    // GỌT VỎ MARKDOWN (QUAN TRỌNG)
    responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsedData = JSON.parse(responseText);
      const lessonsArray = Array.isArray(parsedData) ? parsedData : (parsedData.lessons || []);
      return NextResponse.json({ lessons: lessonsArray }, { status: 200 });
    } catch (parseError) {
      console.error("Lỗi Parse JSON. Chuỗi gốc từ AI:", responseText);
      return NextResponse.json({ 
        error: "Lỗi AI/Parse", 
        details: "Dữ liệu AI trả về sai định dạng JSON." 
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Analyze File Error:", error);
    return NextResponse.json({ error: "Lỗi AI/Parse", details: error.message }, { status: 500 });
  }
}
