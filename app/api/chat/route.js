import { NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(req) {
  try {
    const body = await req.json();
    const { message, history, lessonData, apiKey, openAIKey, anthropicKey, modelType } = body;

    const requestedModel = (modelType || 'gemini-1.5-flash').toLowerCase().trim();
    const isGemini = !requestedModel.includes('gpt') && !requestedModel.includes('claude');
    const isOpenAI = requestedModel.includes('gpt');
    const isClaude = requestedModel.includes('claude');

    if (isGemini && !apiKey) return NextResponse.json({ error: "Thiếu Gemini API Key." }, { status: 400 });
    if (isOpenAI && !openAIKey) return NextResponse.json({ error: "Thiếu OpenAI API Key." }, { status: 400 });
    if (isClaude && !anthropicKey) return NextResponse.json({ error: "Thiếu Anthropic API Key." }, { status: 400 });

    const systemPrompt = `Bạn là chuyên gia sư phạm. Hãy tư vấn giúp giáo viên hoàn thành giáo án chuyên nghiệp nhất. 
Thông tin môn học hiện tại: ${JSON.stringify(lessonData || {})}. 
Hãy trả lời ngắn gọn, súc tích và mang tính chuyên môn cao.`;

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    // --- GEMINI HANDLER ---
    const tryGemini = async (contents) => {
      const modelsToTry = [requestedModel, 'gemini-2.0-flash', 'gemini-1.5-flash-002', 'gemini-1.5-flash', 'gemini-1.5-pro-002', 'gemini-1.5-pro'];
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
                  systemInstruction: { parts: [{ text: systemPrompt }] },
                  generationConfig: { temperature: 0.7 } 
                })
              });

              const data = await res.json();
              
              if (!res.ok) {
                const errMsg = data.error?.message || "Lỗi API";
                if (mId === requestedModel && !requestedModelError) requestedModelError = errMsg;
                
                const isRetryable = res.status === 429 || res.status >= 500;
                if (isRetryable && retryCount < 1) {
                  retryCount++;
                  const waitTime = [5000, 10000][retryCount - 1];
                  console.warn(`[Chat Quota 429] Waiting ${waitTime/1000}s for ${mId}...`);
                  await delay(waitTime);
                  continue;
                }
                throw new Error(errMsg);
              }

              if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error("AI không trả về phản hồi.");
              }

              return { success: true, data: data.candidates[0].content.parts[0].text };
            } catch (err) {
              lastError = err.message;
              break;
            }
          }
        }
      }
      throw new Error(`LỖI KẾT NỐI AI / SAI KEY: Trợ lý AI không phản hồi. Kiểm tra Key tại aistudio.google.com. (${requestedModelError || lastError})`);
    };

    // --- OPENAI HANDLER ---
    const tryOpenAI = async (messages) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAIKey.trim()}` },
        body: JSON.stringify({ model: requestedModel, messages })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OpenAI Error ${res.status}`);
      return data.choices[0].message.content;
    };

    // --- CLAUDE HANDLER ---
    const tryClaude = async (system, messages) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey.trim(), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: requestedModel, system, messages, max_tokens: 4096 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Claude Error ${res.status}`);
      return data.content[0].text;
    };

    let reply = "";
    if (isGemini) {
      const geminiHistory = history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      geminiHistory.push({ role: 'user', parts: [{ text: message }] });
      const result = await tryGemini(geminiHistory);
      reply = result.data;
    } else if (isOpenAI) {
      const openaiHistory = [{ role: 'system', content: systemPrompt }, ...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: message }];
      reply = await tryOpenAI(openaiHistory);
    } else if (isClaude) {
      const claudeHistory = history.map(m => ({ role: m.role, content: m.content }));
      claudeHistory.push({ role: 'user', content: message });
      reply = await tryClaude(systemPrompt, claudeHistory);
    }

    return NextResponse.json({ success: true, text: reply }, { status: 200 });

  } catch (error) {
    console.error("LỖI API CHAT:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
