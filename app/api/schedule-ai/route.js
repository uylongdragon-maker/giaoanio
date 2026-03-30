import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { syllabus, startDate, dayConfigs, holidayList, apiKey, modelId } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API Key cho việc xếp lịch AI." }, { status: 400 });
    }

    const prompt = `Bạn là một chuyên gia quản lý đào tạo và lập lịch giảng dạy thông minh. 
Nhiệm vụ của bạn là phân bổ danh sách bài học vào các buổi dạy cụ thể dựa trên các quy tắc sau:

1. QUY TẮC QUY ĐỔI THỜI GIAN:
   - 1 giờ Lý thuyết (gioLT) = 1 Tiết Lý thuyết (45 phút).
   - 1 giờ Thực hành, Kiểm tra, Thi (gioTH) = 1 giờ * 60 / 45 = 1.33 Tiết.
   - Tổng số tiết của bài = gioLT + (gioTH * 1.33).

2. QUY TẮC PHÂN BỔ BUỔI DẠY:
   - Một buổi dạy tối đa 180 phút, tương đương 4 Tiết (45 phút/tiết).
   - Các buổi dạy PHẢI ĐỦ TIẾT (tối ưu là 4 tiết).
   - Nếu một bài học có số tiết lẻ hoặc dư, hãy điền vào buổi học đang bị thiếu tiết để đảm bảo đủ 180 phút/buổi.
   - Không được vượt quá 4 tiết mỗi buổi.

3. THÔNG TIN ĐẦU VÀO:
   - Danh sách bài học (Syllabus): ${JSON.stringify(syllabus)}
   - Ngày bắt đầu: ${startDate}
   - Cấu hình số tiết mỗi thứ trong tuần: ${JSON.stringify(dayConfigs)} (Ví dụ: {1: 4} là Thứ 2 có 4 tiết).
   - Danh sách ngày nghỉ: ${JSON.stringify(holidayList)}

4. YÊU CẦU ĐẦU RA:
   Trả về một mảng JSON các buổi học (sessions) theo định dạng sau:
   [
     {
       "id": "session-1",
       "date": "YYYY-MM-DD",
       "totalPeriods": 4,
       "contents": [
         {
           "lessonName": "Tên bài",
           "subItem": "Đề mục cụ thể đã phân bổ vào buổi này",
           "tietLT": 2,
           "tietTH": 2,
           "type": "LT hoặc TH"
         }
       ]
     },
     ...
   ]

LƯU Ý QUAN TRỌNG:
- Hãy chia nhỏ các bài học lớn thành các phần nhỏ (subItem) để rải đều vào các buổi.
- Đảm bảo tính logic sư phạm: Lý thuyết thường đi trước Thực hành của cùng một nội dung.
- BẮT BUỘC chỉ trả về mảng JSON, không có văn bản giải thích.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId || 'gemini-1.5-pro'}:generateContent?key=${apiKey.trim()}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Lỗi API AI khi xếp lịch.");
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    let sessions = JSON.parse(responseText);

    return NextResponse.json({ sessions }, { status: 200 });

  } catch (error) {
    console.error("LỖI API (schedule-ai):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
