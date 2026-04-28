import { GoogleGenAI } from "@google/genai";

export type ProviderErrorCode =
  | "RATE_LIMIT"
  | "AUTH"
  | "TIMEOUT"
  | "SERVER_ERROR"
  | "BAD_REQUEST"
  | "EMPTY"
  | "UNKNOWN";

export class ProviderError extends Error {
  code: ProviderErrorCode;
  status?: number;
  constructor(code: ProviderErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface ProviderInput {
  base64: string;
  mimeType: string;
  systemPrompt: string;
  userText: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** Override base URL (used by Replit's Gemini integration proxy). */
  baseUrl?: string;
}

export interface ProviderDef {
  id: string;
  label: string;
  description: string;
  signupUrl: string;
  models: string[];
  defaultModel: string;
  call: (input: ProviderInput) => Promise<{ text: string }>;
}

const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new ProviderError("TIMEOUT", `Request timeout after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
};

function classifyGeminiError(msg: string): ProviderErrorCode {
  if (msg.includes("429") || /rate.?limit|quota|resource.?exhausted/i.test(msg)) {
    return "RATE_LIMIT";
  }
  if (msg.includes("401") || msg.includes("403") || /unauthorized|invalid.*key|api.?key/i.test(msg)) {
    return "AUTH";
  }
  if (msg.includes("500") || msg.includes("503") || /unavailable|server.?error|internal/i.test(msg)) {
    return "SERVER_ERROR";
  }
  if (msg.includes("400")) return "BAD_REQUEST";
  return "UNKNOWN";
}

async function callGeminiViaFetch(input: ProviderInput): Promise<{ text: string }> {
  const base = (input.baseUrl || "").replace(/\/$/, "");
  const url = `${base}/models/${input.model}:generateContent?key=${encodeURIComponent(input.apiKey)}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: input.userText },
          { inlineData: { mimeType: input.mimeType, data: input.base64 } },
        ],
      },
    ],
    systemInstruction: { parts: [{ text: input.systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      temperature: 0.1,
    },
  };
  let res: Response;
  try {
    res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      input.timeoutMs,
    );
  } catch (err: any) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError("UNKNOWN", String(err?.message || err));
  }
  if (!res.ok) {
    const txt = (await res.text().catch(() => "")).slice(0, 400);
    const status = res.status;
    if (status === 429) throw new ProviderError("RATE_LIMIT", `429: ${txt}`, 429);
    if (status === 401 || status === 403)
      throw new ProviderError("AUTH", `${status}: ${txt}`, status);
    if (status >= 500)
      throw new ProviderError("SERVER_ERROR", `${status}: ${txt}`, status);
    if (status === 400) throw new ProviderError("BAD_REQUEST", `400: ${txt}`, 400);
    throw new ProviderError("UNKNOWN", `${status}: ${txt}`, status);
  }
  const json: any = await res.json().catch(() => null);
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
  if (!text) throw new ProviderError("EMPTY", "Gemini returned empty response");
  return { text };
}

async function callGemini(input: ProviderInput): Promise<{ text: string }> {
  // When a baseUrl is supplied (e.g. Replit's Gemini proxy), the SDK ignores
  // it if an apiKey is also passed. Use direct fetch for that case so the
  // proxy receives the request.
  if (input.baseUrl) {
    return callGeminiViaFetch(input);
  }

  const client = new GoogleGenAI({ apiKey: input.apiKey });
  try {
    const response: any = await withTimeout(
      client.models.generateContent({
        model: input.model,
        contents: [
          {
            role: "user",
            parts: [
              { text: input.userText },
              { inlineData: { mimeType: input.mimeType, data: input.base64 } },
            ],
          },
        ],
        config: {
          systemInstruction: input.systemPrompt,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          temperature: 0.1,
        },
      }),
      input.timeoutMs,
    );
    const text = response?.text || "";
    if (!text) throw new ProviderError("EMPTY", "Gemini returned empty response");
    return { text };
  } catch (err: any) {
    if (err instanceof ProviderError) throw err;
    const msg = String(err?.message || err);
    throw new ProviderError(classifyGeminiError(msg), msg);
  }
}

function makeOpenAICompatCall(
  baseUrl: string,
  extraHeaders: Record<string, string> = {},
) {
  return async function (input: ProviderInput): Promise<{ text: string }> {
    const dataUrl = `data:${input.mimeType};base64,${input.base64}`;
    const body = {
      model: input.model,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { role: "system", content: input.systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: input.userText },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    };
    let res: Response;
    try {
      res = await withTimeout(
        fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.apiKey}`,
            ...extraHeaders,
          },
          body: JSON.stringify(body),
        }),
        input.timeoutMs,
      );
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError("UNKNOWN", String(err?.message || err));
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const status = res.status;
      const trimmed = txt.slice(0, 400);
      if (status === 429) throw new ProviderError("RATE_LIMIT", `429: ${trimmed}`, 429);
      if (status === 401 || status === 403)
        throw new ProviderError("AUTH", `${status}: ${trimmed}`, status);
      if (status >= 500)
        throw new ProviderError("SERVER_ERROR", `${status}: ${trimmed}`, status);
      if (status === 400) throw new ProviderError("BAD_REQUEST", `400: ${trimmed}`, 400);
      throw new ProviderError("UNKNOWN", `${status}: ${trimmed}`, status);
    }

    const json: any = await res.json().catch(() => null);
    const choice = json?.choices?.[0]?.message;
    const content = choice?.content;
    if (typeof content === "string" && content.trim()) {
      return { text: content };
    }
    if (Array.isArray(content)) {
      const textPart = content.find((c: any) => c?.type === "text" && c?.text);
      if (textPart?.text) return { text: textPart.text };
    }
    throw new ProviderError("EMPTY", "No content in response");
  };
}

export const PROVIDERS: Record<string, ProviderDef> = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    description:
      "Free: ~15 yêu cầu/phút, ~1000/ngày. Đọc ảnh & hiểu tiếng Việt rất tốt — nên đặt ưu tiên đầu.",
    signupUrl: "https://aistudio.google.com/apikey",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
    defaultModel: "gemini-2.5-flash",
    call: callGemini,
  },
  groq: {
    id: "groq",
    label: "Groq",
    description:
      "Cực nhanh (300+ tokens/s). Free: ~1000 yêu cầu/ngày. Hỗ trợ Llama 4 / Llama 3.2 Vision.",
    signupUrl: "https://console.groq.com/keys",
    models: [
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "llama-3.2-11b-vision-preview",
      "llama-3.2-90b-vision-preview",
    ],
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    call: makeOpenAICompatCall("https://api.groq.com/openai/v1"),
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    description:
      "Cổng tổng hợp nhiều model miễn phí (Llama 4, Gemma 3, Qwen-VL). 20 RPM, 50/ngày (1000 nếu nạp $10).",
    signupUrl: "https://openrouter.ai/keys",
    models: [
      "meta-llama/llama-4-maverick:free",
      "meta-llama/llama-4-scout:free",
      "google/gemma-3-27b-it:free",
      "qwen/qwen2.5-vl-72b-instruct:free",
      "qwen/qwen-2-vl-72b-instruct:free",
    ],
    defaultModel: "meta-llama/llama-4-scout:free",
    call: makeOpenAICompatCall("https://openrouter.ai/api/v1", {
      "HTTP-Referer": "https://replit.com",
      "X-Title": "Bank Transaction Analyzer",
    }),
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI",
    description:
      "Free hào phóng (1B token/tháng). Pixtral đọc ảnh tốt. Giới hạn ~1 yêu cầu/giây.",
    signupUrl: "https://console.mistral.ai/api-keys",
    models: ["pixtral-12b-2409", "pixtral-large-latest"],
    defaultModel: "pixtral-12b-2409",
    call: makeOpenAICompatCall("https://api.mistral.ai/v1"),
  },
};

export const PROVIDER_PUBLIC_INFO = Object.values(PROVIDERS).map((p) => ({
  id: p.id,
  label: p.label,
  description: p.description,
  signupUrl: p.signupUrl,
  models: p.models,
  defaultModel: p.defaultModel,
}));
