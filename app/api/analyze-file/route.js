import { NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(req) {
  try {
    console.log("Đang xử lý API analyze-file...");
    const body = await req.json();
    const { apiKey, modelType, modelId, fileData } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API Key." }, { status: 400 });
    }

    const MODEL_MAP = {
      'gemini-1.5-flash':         'gemini-1.5-flash-002',
      'gemini-1.5-pro':           'gemini-1.5-pro-002',
      'gemini-2.0-flash':         'gemini-2.0-flash',
    };

    let requestedModel = (modelId || modelType || 'gemini-1.5-flash').toLowerCase().trim();
    if (requestedModel.startsWith('models/')) requestedModel = requestedModel.replace('models/', '');
    const actualModel = MODEL_MAP[requestedModel] || requestedModel;

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    const tryGemini = async (contents, genConfig = {}) => {
      const modelsToTry = [actualModel, 'gemini-2.0-flash', 'gemini-1.5-flash-002', 'gemini-1.5-flash', 'gemini-1.5-pro-002', 'gemini-1.5-pro'];
      let requestedModelError = null;
      let lastError = "Hệ thống AI đang bận";
      
      for (const mId of modelsToTry) {
        for (const v of ['v1beta']) {
          let retryCount = 0;
          while (retryCount < 2) {
            try {
              const url = `https://generativelanguage.googleapis.com/${v}/models/${mId}:generateContent?key=${apiKey.trim()}`;
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  contents, 
                  generationConfig: { 
                    response_mime_type: "application/json", 
                    ...genConfig 
                  } 
                })
              });
              
              const data = await res.json();
              
              if (!res.ok) {
                const errMsg = data.error?.message || "Lỗi API";
                if (mId === actualModel && !requestedModelError) requestedModelError = errMsg;
                
                const isRetryable = res.status === 429 || res.status >= 500;
                if (isRetryable && retryCount < 1) {
                  retryCount++;
                  const waitTime = [5000, 10000][retryCount - 1];
                  console.warn(`[File Quota 429] Waiting ${waitTime/1000}s for ${mId}...`);
                  await delay(waitTime);
                  continue;
                }
                throw new Error(errMsg);
              }

              if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error("AI không trả về nội dung hợp lệ.");
              }

              return { success: true, data: data.candidates[0].content.parts[0].text };
            } catch (err) {
              lastError = err.message;
              break; 
            }
          }
        }
      }
      throw new Error(`LỖI KẾT NỐI AI / SAI KEY: Không thể bóc tách file bằng Cloud AI. Kiểm tra Key tại AI Studio. (${requestedModelError || lastError})`);
    };

    let parts;
    const prompt = `Bạn là chuyên gia bóc tách chương trình đào tạo chuyên nghiệp. 
Nhiệm vụ: Duyệt qua toàn bộ nội dung file và trích xuất danh sách các bài học.

YÊU CẦU DỮ LIỆU:
1. tenBai: Tên bài học hoặc chương lớn.
2. deMuc: Các tiểu mục chi tiết bên trong (cách nhau bởi dấu phẩy).
3. gioLT: Số GIỜ lý thuyết nguyên bản.
4. gioTH: Số GIỜ thực hành/kiểm tra/thi (hệ số 1.0).

QUY TẮC:
- Trả về DUY NHẤT một mảng JSON Array các object bài học.
- Sản phẩm cuối cùng phải là: [{"tenBai": "...", "deMuc": "...", "gioLT": X, "gioTH": Y}, ...]
- Không bao gồm bất kỳ văn bản giải thích nào khác.`;

    if (fileData.rawText) {
      parts = [{ text: `${prompt}\n\nNội dung cần trích xuất:\n${fileData.rawText}` }];
    } else if (fileData.data && fileData.mimeType) {
      parts = [{ text: prompt }, { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }];
    } else {
      return NextResponse.json({ error: "Không có dữ liệu file để phân tích." }, { status: 400 });
    }

    try {
      console.log(`[AI-Analyze] Đang bắt đầu với model: ${actualModel}...`);
      const result = await tryGemini([{ parts }], { temperature: 0.1, maxOutputTokens: 8192 });
      
      const responseText = result.data || "";
      if (!responseText) throw new Error("AI không trả về nội dung.");

      let lessonsArray = [];
      try {
        const startIdx = responseText.indexOf('[');
        const endIdx = responseText.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
          lessonsArray = JSON.parse(responseText.substring(startIdx, endIdx + 1));
        } else {
          const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          lessonsArray = Array.isArray(parsed) ? parsed : (parsed.lessons || parsed.data || []);
        }
      } catch (e) {
        console.error("Lỗi parse JSON (analyze-file):", responseText);
        throw new Error("Dữ liệu AI trả về không đúng cấu trúc JSON mong muốn.");
      }

      if (!Array.isArray(lessonsArray) || lessonsArray.length === 0) {
        throw new Error("Không thể trích xuất được danh sách bài học nào.");
      }

      return NextResponse.json({ lessons: lessonsArray }, { status: 200 });
    } catch (err) {
      console.error("LỖI XỬ LÝ AI (analyze-file):", err);
      return NextResponse.json({ 
        success: false, 
        error: err.message || "Lỗi xử lý AI bóc tách.",
        details: "AI trả về dữ liệu không đúng cấu trúc JSON mong muốn."
      }, { status: 500 });
    }

  } catch (error) {
    console.error("LỖI API (analyze-file):", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
