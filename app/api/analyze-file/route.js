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
      const prompt = `Bạn là chuyên gia phân tích chương trình đào tạo. Dưới đây là nội dung HTML của một file đề cương. Cấu trúc bảng phân phối thời gian rất phức tạp, có các cột: Tổng số, Lý thuyết, Thực hành, KT (Kiểm tra), Thi.

Nhiệm vụ của bạn:
1. Trích xuất TẤT CẢ các dòng có chứa thời gian học. Bao gồm các 'Bài học', các buổi 'Kiểm tra', và buổi 'Thi kết thúc'. TUYỆT ĐỐI KHÔNG BỎ SÓT DÒNG NÀO.
2. Với mỗi dòng, tìm chính xác số Giờ Lý Thuyết, Giờ Thực Hành, Giờ Kiểm Tra, Giờ Thi. (Lưu ý: Bảng HTML có thể bị xô lệch cột do merge cell, hãy dựa vào ngữ cảnh để lấy đúng số).
3. TỰ ĐỘNG QUY ĐỔI TỪ GIỜ SANG TIẾT theo công thức bắt buộc:
   - tietLT = Số Giờ Lý thuyết.
   - tietTH = Math.round( (Số Giờ Thực hành + Số Giờ Kiểm tra + Số Giờ Thi) * 60 / 45 ).

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON ARRAY. Dưới đây là VÍ DỤ MẪU CHUẨN ĐÚNG VỚI CẤU TRÚC FILE NÀY:
[
  { "tenBai": "Bài 1: Tổng quan", "tietLT": 3, "tietTH": 0 },
  { "tenBai": "Bài 2: Kỹ thuật máy quay", "tietLT": 6, "tietTH": 17 },
  { "tenBai": "Kiểm tra 1", "tietLT": 0, "tietTH": 1 },
  { "tenBai": "Bài 3: Kỹ thuật chụp ảnh", "tietLT": 6, "tietTH": 17 },
  { "tenBai": "Kiểm tra 2", "tietLT": 0, "tietTH": 1 },
  { "tenBai": "Thi kết thúc môn học", "tietLT": 0, "tietTH": 3 }
]

Nội dung HTML cần phân tích:
${fileData.rawText}`;
      parts = [{ text: prompt }];
    } else if (fileData.data && fileData.mimeType) {
      const prompt = `Bạn là chuyên gia phân tích chương trình đào tạo. Hãy đọc TOÀN BỘ tài liệu này và trích xuất MỌI BÀI HỌC có trong đó.

KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ BÀI NÀO. KHÔNG ĐƯỢC TÓM TẮT CHUNG CHUNG.
Quy đổi: tietLT = Giờ LT. tietTH = Math.round(((Giờ TH + Giờ KT + Giờ Thi) * 60) / 45).
BẮT BUỘC trả về JSON Array:
[{"tenBai": "Tên bài 1", "tietLT": 2, "tietTH": 1}, ...]`;
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
