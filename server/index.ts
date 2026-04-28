import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db.js";
import { extractedAccounts, shareLinks } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import { PROVIDERS, PROVIDER_PUBLIC_INFO, ProviderError } from "./aiProviders.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3000;

app.get("/api/accounts/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const accounts = await db
      .select()
      .from(extractedAccounts)
      .where(eq(extractedAccounts.device_id, deviceId))
      .orderBy(desc(extractedAccounts.created_at));
    res.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const { deviceId, fullName, accountNumber, referralCode, senderName, imageTime, folder } = req.body;
    if (!deviceId || !fullName || !accountNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const [account] = await db
      .insert(extractedAccounts)
      .values({
        device_id: deviceId,
        full_name: fullName,
        account_number: String(accountNumber).replace(/\s/g, ""),
        referral_code: referralCode || "",
        sender_name: senderName || "",
        status: "verified",
        image_time: imageTime || "",
        folder: (folder || "").trim(),
      })
      .returning();
    res.json(account);
  } catch (error) {
    console.error("Error adding account:", error);
    res.status(500).json({ error: "Failed to add account" });
  }
});

app.patch("/api/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, accountNumber, referralCode, senderName } = req.body;
    const [account] = await db
      .update(extractedAccounts)
      .set({
        full_name: fullName,
        account_number: String(accountNumber).replace(/\s/g, ""),
        referral_code: referralCode,
        sender_name: senderName,
        updated_at: new Date(),
      })
      .where(eq(extractedAccounts.id, id))
      .returning();
    res.json(account);
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(500).json({ error: "Failed to update account" });
  }
});

app.delete("/api/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(extractedAccounts).where(eq(extractedAccounts.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

app.delete("/api/accounts/device/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    await db.delete(extractedAccounts).where(eq(extractedAccounts.device_id, deviceId));
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing accounts:", error);
    res.status(500).json({ error: "Failed to clear accounts" });
  }
});

app.get("/api/share-links/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.device_id, deviceId));
    res.json(link || null);
  } catch (error) {
    console.error("Error fetching share link:", error);
    res.status(500).json({ error: "Failed to fetch share link" });
  }
});

app.post("/api/share-links", async (req, res) => {
  try {
    const { deviceId, shareCode } = req.body;
    if (!deviceId || !shareCode) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const [link] = await db
      .insert(shareLinks)
      .values({ device_id: deviceId, share_code: shareCode })
      .returning();
    res.json(link);
  } catch (error: any) {
    if (error?.code === "23505") {
      // Detect whether duplicate is on share_code (retryable) or device_id
      const detail = String(error?.detail || "");
      const isDeviceDup = detail.includes("device_id");
      if (isDeviceDup) {
        // Return existing link for this device
        const [existing] = await db
          .select()
          .from(shareLinks)
          .where(eq(shareLinks.device_id, req.body.deviceId));
        if (existing) return res.json(existing);
      }
      res.status(409).json({ error: "Duplicate share code", code: "23505" });
    } else {
      console.error("Error creating share link:", error);
      res.status(500).json({ error: "Failed to create share link" });
    }
  }
});

app.get("/api/share-links/code/:shareCode", async (req, res) => {
  try {
    const { shareCode } = req.params;
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.share_code, shareCode.toUpperCase()));
    res.json(link ? { deviceId: link.device_id } : null);
  } catch (error) {
    console.error("Error looking up share code:", error);
    res.status(500).json({ error: "Failed to look up share code" });
  }
});

app.post("/api/analyze-image", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Strip data URL prefix if present
    let base64Data = imageBase64;
    let mimeType = "image/jpeg";
    const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Data = dataUrlMatch[2];
    }

    const systemPrompt = `Bạn là một AI chuyên trích xuất thông tin từ ảnh chụp màn hình giao dịch ngân hàng, biên lai, mã QR, hoặc các tài liệu tài chính.

Nhiệm vụ của bạn:
1. Phân tích hình ảnh được cung cấp
2. Trích xuất các thông tin sau:
   - fullName: tên tài khoản người nhận tiền
   - accountNumber: nội dung hiển thị tại ô "Số tài khoản" / "STK" / "Tới tài khoản" — LẤY NGUYÊN VĂN những gì hiển thị, kể cả khi đó là chuỗi chữ tiếng Việt như "Số Ngẫu Nhiên", "Số ngẫu nhiên", một alias như "vidi.username", hay chuỗi chữ-số bất kỳ. Chỉ loại bỏ dấu cách thừa, KHÔNG bỏ chữ cái, KHÔNG dịch, KHÔNG suy đoán.
   - referralCode: mã giới thiệu (nếu có, nếu không thì "")
   - senderName: tên lấy từ dòng "Nội dung"/"Lời nhắn"/"Nội dung chuyển tiền" (nếu có)
   - imageTime: GIỜ hiển thị trên thanh trạng thái phía trên cùng của ảnh chụp màn hình điện thoại (ví dụ "10:57", "9:30", "21:05"). Đây thường là góc trên BÊN TRÁI (iPhone) hoặc BÊN PHẢI (Android) của ảnh, nằm cạnh icon sóng/wifi/pin. Trả về nguyên văn dạng "HH:MM" (24h hoặc có chữ AM/PM nếu có). Nếu không thấy giờ trên thanh trạng thái, trả "".

QUY TẮC BẮT BUỘC:
1. Nếu ảnh là biên lai chuyển tiền có cả "Từ tài khoản" và "Tới tài khoản": LUÔN lấy thông tin từ phần "Tới tài khoản" (người nhận). fullName = tên người nhận, accountNumber = số tài khoản người nhận.
2. senderName CHỈ được lấy từ dòng "Nội dung" hoặc "Lời nhắn" hoặc "Nội dung chuyển tiền". Nếu không có dòng này thì senderName = "".
3. TUYỆT ĐỐI KHÔNG copy fullName sang senderName.
4. Số tài khoản: lấy NGUYÊN VĂN nội dung hiển thị tại vị trí ô số tài khoản (kể cả chữ tiếng Việt như "Số Ngẫu Nhiên"). Chỉ loại bỏ dấu cách thừa giữa các ký tự, KHÔNG được lọc bỏ chữ cái, KHÔNG được dịch, KHÔNG được thay thế.
5. Nếu không tìm thấy thông tin, trả về mảng rỗng.

Trả về JSON theo format:
{
  "results": [{"fullName": "...", "accountNumber": "...", "referralCode": "...", "senderName": "...", "imageTime": "..."}]
}`;

    const userText = "Hãy phân tích ảnh này và trích xuất tên đăng nhập, số tài khoản ngân hàng và mã giới thiệu. Trả về kết quả dưới dạng JSON.";

    type ChainEntry = {
      providerId: string;
      apiKey: string;
      model: string;
      label: string;
      keyLabel?: string;
      baseUrl?: string;
    };
    const chain: ChainEntry[] = [];

    const clientProviders = Array.isArray(req.body?.providers) ? req.body.providers : [];
    for (const p of clientProviders) {
      if (!p || typeof p !== "object") continue;
      const def = PROVIDERS[String(p.providerId || "")];
      if (!def) continue;
      const apiKey = String(p.apiKey || "").trim();
      if (!apiKey) continue;
      chain.push({
        providerId: def.id,
        apiKey,
        model: String(p.model || def.defaultModel),
        label: def.label,
        keyLabel: typeof p.keyLabel === "string" && p.keyLabel.trim() ? p.keyLabel.trim() : undefined,
      });
    }

    if (chain.length === 0 && process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
      chain.push({
        providerId: "gemini",
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        model: "gemini-2.5-flash",
        label: "Google Gemini (mặc định)",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      });
    }

    if (chain.length === 0) {
      return res.status(400).json({
        error: "Chưa cấu hình API key nào. Hãy mở 'AI Providers' để thêm.",
      });
    }

    const attempts: { providerId: string; label: string; keyLabel?: string; model: string; error: string; code: string }[] = [];

    for (const p of chain) {
      const def = PROVIDERS[p.providerId];
      try {
        const { text } = await def.call({
          base64: base64Data,
          mimeType,
          systemPrompt,
          userText,
          apiKey: p.apiKey,
          model: p.model,
          timeoutMs: 45000,
          baseUrl: p.baseUrl,
        });

        let parsedResult: any;
        try {
          parsedResult = JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { results: [] };
        }

        return res.json({
          ...parsedResult,
          providerUsed: {
            providerId: p.providerId,
            label: p.label,
            model: p.model,
            keyLabel: p.keyLabel,
          },
          failovers: attempts,
        });
      } catch (err: any) {
        const code: string = err instanceof ProviderError ? err.code : "UNKNOWN";
        const msg = String(err?.message || err).slice(0, 400);
        console.error(`Provider ${p.label} (${p.model}) failed [${code}]: ${msg}`);
        attempts.push({
          providerId: p.providerId,
          label: p.label,
          keyLabel: p.keyLabel,
          model: p.model,
          error: msg,
          code,
        });
        // Always try the next provider — a 400 from one provider may simply
        // mean an unsupported model / image format / request schema for that
        // provider, while the next provider could still succeed.
      }
    }

    // Choose the most actionable HTTP status from the chain.
    const codes = attempts.map((a) => a.code);
    const allRateLimit = codes.length > 0 && codes.every((c) => c === "RATE_LIMIT");
    const allTimeout = codes.length > 0 && codes.every((c) => c === "TIMEOUT");
    const httpStatus = allRateLimit ? 429 : allTimeout ? 504 : 502;
    return res.status(httpStatus).json({
      error:
        chain.length > 1
          ? `Tất cả ${chain.length} nhà cung cấp đều thất bại. Hãy kiểm tra API key/model hoặc thêm provider khác.`
          : `${attempts[0]?.label || "AI"} thất bại: ${attempts[0]?.error || "lỗi không xác định"}`,
      code: codes[codes.length - 1] || "UNKNOWN",
      failovers: attempts,
    });
  } catch (error) {
    console.error("analyze-image error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/providers", (_req, res) => {
  res.json(PROVIDER_PUBLIC_INFO);
});

app.post("/api/test-provider", async (req, res) => {
  try {
    const { providerId, apiKey, model } = req.body || {};
    if (!providerId || !apiKey) {
      return res.status(400).json({ ok: false, error: "Thiếu providerId hoặc apiKey" });
    }
    const def = PROVIDERS[String(providerId)];
    if (!def) {
      return res.status(400).json({ ok: false, error: `Provider không hợp lệ: ${providerId}` });
    }

    // Tiny 1x1 white PNG used as a probe image
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    try {
      await def.call({
        base64: tinyPng,
        mimeType: "image/png",
        systemPrompt: "Trả về duy nhất JSON: {\"ok\":true}",
        userText: "ping",
        apiKey: String(apiKey),
        model: String(model || def.defaultModel),
        timeoutMs: 20000,
      });
      return res.json({
        ok: true,
        provider: def.label,
        model: model || def.defaultModel,
      });
    } catch (err: any) {
      const code: string = err instanceof ProviderError ? err.code : "UNKNOWN";
      return res.json({
        ok: false,
        provider: def.label,
        code,
        error: String(err?.message || err).slice(0, 400),
      });
    }
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const publicDir = path.join(__dirname, "../public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.use((_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
