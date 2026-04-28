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
  /** Hint from server (Retry-After header) telling us how long to back off, in ms. */
  retryAfterMs?: number;
  constructor(
    code: ProviderErrorCode,
    message: string,
    status?: number,
    retryAfterMs?: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Parse `Retry-After` header. Accepts either an integer number of seconds
 * (RFC 7231) or an HTTP-date. Returns ms, capped between 1s and 5min.
 */
export function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const trimmed = headerValue.trim();
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.max(seconds * 1000, 1000), 5 * 60_000);
  }
  const date = new Date(trimmed);
  const time = date.getTime();
  if (Number.isFinite(time)) {
    const diff = time - Date.now();
    return Math.min(Math.max(diff, 1000), 5 * 60_000);
  }
  return undefined;
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
  /** Best-effort hint of free-tier requests per minute. Used for proactive throttling. */
  freeRpm?: number;
  call: (input: ProviderInput) => Promise<{ text: string }>;
}

// ---------- Provider Health Tracking ----------
// Tracks per-(provider+keyPrefix) state so we can:
// 1. SKIP a provider that just returned 429 until its cooldown elapses (reactive).
// 2. SKIP a provider that's about to exceed its known free-tier RPM (proactive).
// In-memory only — keys are hashed by prefix so we never log/store the full key.

interface HealthEntry {
  cooldownUntil: number;
  cooldownReason: string;
  /** Timestamps (ms) of the last successful/attempted requests, sliding 60s window. */
  recentTimestamps: number[];
}

const health = new Map<string, HealthEntry>();

function healthKey(providerId: string, apiKey: string): string {
  return `${providerId}:${apiKey.slice(0, 12)}`;
}

function getOrInit(providerId: string, apiKey: string): HealthEntry {
  const k = healthKey(providerId, apiKey);
  let entry = health.get(k);
  if (!entry) {
    entry = { cooldownUntil: 0, cooldownReason: "", recentTimestamps: [] };
    health.set(k, entry);
  }
  return entry;
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  retryAfterMs?: number;
}

export function checkAvailability(
  providerId: string,
  apiKey: string,
  freeRpm?: number,
): AvailabilityResult {
  const entry = health.get(healthKey(providerId, apiKey));
  const now = Date.now();
  if (entry?.cooldownUntil && entry.cooldownUntil > now) {
    return {
      available: false,
      reason: entry.cooldownReason || "đang nghỉ",
      retryAfterMs: entry.cooldownUntil - now,
    };
  }
  if (freeRpm && entry) {
    entry.recentTimestamps = entry.recentTimestamps.filter((t) => t > now - 60_000);
    if (entry.recentTimestamps.length >= freeRpm) {
      const oldest = entry.recentTimestamps[0];
      const waitMs = Math.max(1000, oldest + 60_000 - now);
      return {
        available: false,
        reason: `Đã đạt ~${freeRpm} req/phút (giới hạn miễn phí)`,
        retryAfterMs: waitMs,
      };
    }
  }
  return { available: true };
}

export function recordRequest(providerId: string, apiKey: string): void {
  const entry = getOrInit(providerId, apiKey);
  const now = Date.now();
  entry.recentTimestamps.push(now);
  // Cap memory: keep only last 200 entries per key.
  if (entry.recentTimestamps.length > 200) {
    entry.recentTimestamps = entry.recentTimestamps.slice(-200);
  }
}

export function setCooldown(
  providerId: string,
  apiKey: string,
  durationMs: number,
  reason: string,
): void {
  const entry = getOrInit(providerId, apiKey);
  entry.cooldownUntil = Date.now() + Math.max(1000, Math.min(durationMs, 5 * 60_000));
  entry.cooldownReason = reason;
}

export function clearCooldown(providerId: string, apiKey: string): void {
  const entry = health.get(healthKey(providerId, apiKey));
  if (entry) {
    entry.cooldownUntil = 0;
    entry.cooldownReason = "";
  }
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
    const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
    if (status === 429)
      throw new ProviderError("RATE_LIMIT", `429: ${txt}`, 429, retryAfter);
    if (status === 401 || status === 403)
      throw new ProviderError("AUTH", `${status}: ${txt}`, status);
    if (status >= 500)
      throw new ProviderError("SERVER_ERROR", `${status}: ${txt}`, status, retryAfter);
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
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      if (status === 429)
        throw new ProviderError("RATE_LIMIT", `429: ${trimmed}`, 429, retryAfter);
      if (status === 401 || status === 403)
        throw new ProviderError("AUTH", `${status}: ${trimmed}`, status);
      if (status >= 500)
        throw new ProviderError("SERVER_ERROR", `${status}: ${trimmed}`, status, retryAfter);
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
    freeRpm: 15,
    call: callGemini,
  },
  groq: {
    id: "groq",
    label: "Groq",
    description:
      "Cực nhanh (300+ tokens/s). Free: ~30 yêu cầu/phút, ~1000/ngày. Hỗ trợ Llama 4 / Llama 3.2 Vision.",
    signupUrl: "https://console.groq.com/keys",
    models: [
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "llama-3.2-11b-vision-preview",
      "llama-3.2-90b-vision-preview",
    ],
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    freeRpm: 30,
    call: makeOpenAICompatCall("https://api.groq.com/openai/v1"),
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    description:
      "Cổng tổng hợp nhiều model miễn phí (Gemma, Nemotron, OCR). 20 RPM, 50/ngày (1000 nếu nạp $10). Khuyến nghị model OCR cho ảnh ngân hàng.",
    signupUrl: "https://openrouter.ai/keys",
    models: [
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
      "google/gemma-3-27b-it:free",
      "google/gemma-3-12b-it:free",
      "google/gemma-3-4b-it:free",
      "baidu/qianfan-ocr-fast:free",
      "nvidia/nemotron-nano-12b-v2-vl:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    ],
    defaultModel: "google/gemma-3-27b-it:free",
    freeRpm: 20,
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
    freeRpm: 60,
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
