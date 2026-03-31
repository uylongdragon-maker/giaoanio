import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    console.log("Đang xử lý API analyze-file...");
    const body = await req.json();
    const { apiKey, modelType, modelId, fileData } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API Key." }, { status: 400 });
    }

    const MODEL_MAP = {
      'gemini-1.5-flash':         'gemini-1.5-flash-latest',
      'gemini-1.5-pro':           'gemini-1.5-pro-latest',
      'gemini-3-flash-preview':   'gemini-1.5-flash-latest',
      'gemini-3.0-flash-preview': 'gemini-1.5-flash-latest',
      'gemini-3.1-pro-preview':   'gemini-1.5-pro-latest',
      'gemini-2.5-pro':           'gemini-1.5-pro-latest',
      'gemini-2.5-flash':         'gemini-1.5-flash-latest',
      'gemini-2.0-flash':         'gemini-1.5-flash-latest',
      'gemini-2.0-flash-exp':     'gemini-2.0-flash-exp',
    };

    let requestedModel = (modelId || modelType || 'gemini-1.5-flash').toLowerCase().trim();
    if (requestedModel.startsWith('models/')) {
      requestedModel = requestedModel.replace('models/', '');
    }
    const actualModel = MODEL_MAP[requestedModel] || requestedModel;

    // --- UTILITY: ROBUST GEMINI CALLER (MULTI-VERSION & MULTI-MODEL RETRY) ---
    const tryGemini = async (contents, genConfig = {}) => {
      const modelsToTry = [
        actualModel, 
        'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest',
        'gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.5-flash-8b-latest', 'gemini-1.5-flash-8b',
        'gemini-1.5-pro-latest', 'gemini-1.5-pro', 'gemini-1.5-pro-001',
        'gemini-2.0-flash-exp', 
        'gemini-1.0-pro-latest', 'gemini-1.0-pro', 'gemini-pro'
      ];
      const endpoints = ['v1beta', 'v1'];
      let lastError = null;
      let lastErrorData = null;

      for (const endpoint of endpoints) {
        for (const mId of modelsToTry) {
          try {
            console.log(`[Gemini-File-Retry] Thử ${endpoint}/${mId}...`);
            const url = `https://generativelanguage.googleapis.com/${endpoint}/models/${mId}:generateContent?key=${apiKey.trim()}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents,
                generationConfig: { 
                  ...(endpoint === 'v1beta' ? { responseMimeType: "application/json" } : {}),
                  ...genConfig 
                }
              })
            });
            const data = await res.json();
            if (res.ok) return { res, data };
            
            lastErrorData = data;
            lastError = data.error?.message || `Lỗi AI (${res.status})`;
            console.warn(`[Gemini-File-Retry] Thất bại: ${endpoint}/${mId} -> ${lastError}`);
            if (lastError.includes("API key not valid")) throw new Error(lastError);
          } catch (e) {
            lastError = e.message;
            if (lastError.includes("API key not valid")) throw new Error(lastError);
          }
        }
      }
      console.error("[Gemini-File-Retry] TẤT CẢ CỨU CÁNH ĐỀU THẤT BẠI. Lỗi cuối cùng:", lastErrorData);

      // DIAGNOSTIC
      let availableModels = [];
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
        const listRes = await fetch(listUrl);
        const listData = await listRes.json();
        availableModels = listData.models?.map(m => m.name.replace('models/', '')) || [];
      } catch (diagErr) {}

      const diagMsg = availableModels.length > 0 
        ? `\nCác model khả dụng: ${availableModels.join(', ')}`
        : `\nKhông thể liệt kê model (Cần kiểm tra API Key)`;

      throw new Error(`${lastError}. ${diagMsg}`);
    };


    let parts;
    // ... construction continues ...

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
      const { data } = await tryGemini([{ parts }], { temperature: 0.1, maxOutputTokens: 8192 });
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      if (!responseText) {
        throw new Error("AI không trả về nội dung.");
      }

      // TRÍCH XUẤT JSON ROBUST
      let lessonsArray = [];
      try {
        const startIdx = responseText.indexOf('[');
        const endIdx = responseText.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
          const jsonStr = responseText.substring(startIdx, endIdx + 1);
          lessonsArray = JSON.parse(jsonStr);
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
