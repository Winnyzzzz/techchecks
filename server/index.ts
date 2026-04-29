import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db.js";
import { extractedAccounts } from "../shared/schema.js";
import { eq, desc, and } from "drizzle-orm";
import {
  PROVIDERS,
  PROVIDER_PUBLIC_INFO,
  ProviderError,
  checkAvailability,
  recordRequest,
  setCooldown,
  clearCooldown,
} from "./aiProviders.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3000;

const cleanDataset = (v: unknown): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || "default";
};

app.get("/api/accounts/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const dataset = cleanDataset(req.query.dataset);
    const accounts = await db
      .select()
      .from(extractedAccounts)
      .where(
        and(
          eq(extractedAccounts.device_id, deviceId),
          eq(extractedAccounts.dataset, dataset),
        ),
      )
      .orderBy(desc(extractedAccounts.created_at));
    res.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const { deviceId, dataset, fullName, accountNumber, referralCode, senderName, imageTime, folder } = req.body;
    if (!deviceId || !fullName || !accountNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const [account] = await db
      .insert(extractedAccounts)
      .values({
        device_id: deviceId,
        dataset: cleanDataset(dataset),
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
    const dataset = cleanDataset(req.query.dataset);
    await db
      .delete(extractedAccounts)
      .where(
        and(
          eq(extractedAccounts.device_id, deviceId),
          eq(extractedAccounts.dataset, dataset),
        ),
      );
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing accounts:", error);
    res.status(500).json({ error: "Failed to clear accounts" });
  }
});

// Distinct dataset names that have at least 1 account on this device
app.get("/api/datasets/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const rows = await db
      .selectDistinct({ dataset: extractedAccounts.dataset })
      .from(extractedAccounts)
      .where(eq(extractedAccounts.device_id, deviceId));
    res.json(rows.map(r => r.dataset).filter(Boolean));
  } catch (error) {
    console.error("Error listing datasets:", error);
    res.status(500).json({ error: "Failed to list datasets" });
  }
});

// Rename or merge a dataset for a device (moves all rows from `from` -> `to`)
app.patch("/api/datasets/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const rawFrom = typeof req.body?.from === "string" ? req.body.from.trim() : "";
    const rawTo = typeof req.body?.to === "string" ? req.body.to.trim() : "";
    if (!rawFrom || !rawTo) {
      return res.status(400).json({ error: "from/to bắt buộc và không được rỗng" });
    }
    if (rawFrom === "default") {
      return res.status(400).json({ error: 'Không thể đổi tên tập "default"' });
    }
    if (rawFrom === rawTo) return res.json({ success: true, moved: 0 });
    const moved = await db
      .update(extractedAccounts)
      .set({ dataset: rawTo, updated_at: new Date() })
      .where(
        and(
          eq(extractedAccounts.device_id, deviceId),
          eq(extractedAccounts.dataset, rawFrom),
        ),
      )
      .returning({ id: extractedAccounts.id });
    res.json({ success: true, moved: moved.length });
  } catch (error) {
    console.error("Error renaming dataset:", error);
    res.status(500).json({ error: "Failed to rename dataset" });
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
6. **GIỮ NGUYÊN CHÍNH TẢ — KHÔNG TỰ Ý THÊM/BỚT DẤU TIẾNG VIỆT**: Với cả fullName và senderName, copy CHÍNH XÁC ký tự hiển thị trong ảnh. Nếu ảnh ghi "NGUYEN VAN A" (không dấu), trả về "NGUYEN VAN A" — TUYỆT ĐỐI không được "sửa" thành "NGUYỄN VĂN A". Nếu ảnh ghi "Tran thi B" (chữ thường), trả về đúng "Tran thi B". Giữ nguyên hoa/thường, có dấu/không dấu, có khoảng cách thừa hay không — đúng như hiển thị. Đây là quy tắc quan trọng nhất, vi phạm sẽ làm hỏng dữ liệu của người dùng.

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

    if (chain.length === 0) {
      return res.status(400).json({
        error:
          "Chưa cấu hình API key nào. Hãy mở 'AI Providers' để thêm — khuyên dùng Mistral.",
      });
    }

    type AttemptInfo = {
      providerId: string;
      label: string;
      keyLabel?: string;
      model: string;
      error: string;
      code: string;
    };
    const attempts: AttemptInfo[] = [];
    const skipped: { providerId: string; label: string; keyLabel?: string; model: string; reason: string; retryAfterMs?: number }[] = [];

    // Build effective chain: drop providers currently on cooldown OR exceeding
    // their per-minute free-tier quota. If ALL providers are blocked, fall
    // back to the original chain anyway so the user still gets an answer
    // (cooldown might have just elapsed by the time we send).
    const filtered: ChainEntry[] = [];
    for (const p of chain) {
      const def = PROVIDERS[p.providerId];
      const avail = checkAvailability(p.providerId, p.apiKey, def?.freeRpm);
      if (avail.available) {
        filtered.push(p);
      } else {
        skipped.push({
          providerId: p.providerId,
          label: p.label,
          keyLabel: p.keyLabel,
          model: p.model,
          reason: avail.reason || "đang nghỉ",
          retryAfterMs: avail.retryAfterMs,
        });
      }
    }
    const effectiveChain = filtered.length > 0 ? filtered : chain;
    if (filtered.length === 0 && skipped.length > 0) {
      console.warn(
        `All ${chain.length} providers are throttled — trying anyway. Skipped:`,
        skipped.map((s) => `${s.label}(${Math.round((s.retryAfterMs || 0) / 1000)}s: ${s.reason})`).join(", "),
      );
    }

    for (const p of effectiveChain) {
      const def = PROVIDERS[p.providerId];
      // Record the attempt timestamp BEFORE calling so concurrent requests
      // see this provider as one slot closer to its RPM limit.
      recordRequest(p.providerId, p.apiKey);
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

        // Successful call → clear any stale cooldown (provider is healthy again).
        clearCooldown(p.providerId, p.apiKey);

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
          skipped,
        });
      } catch (err: any) {
        const code: string = err instanceof ProviderError ? err.code : "UNKNOWN";
        const msg = String(err?.message || err).slice(0, 400);
        const retryAfterMs = err instanceof ProviderError ? err.retryAfterMs : undefined;
        console.error(`Provider ${p.label} (${p.model}) failed [${code}]: ${msg}`);
        attempts.push({
          providerId: p.providerId,
          label: p.label,
          keyLabel: p.keyLabel,
          model: p.model,
          error: msg,
          code,
        });

        // Set cooldown so future requests skip this provider for a while.
        if (code === "RATE_LIMIT") {
          setCooldown(p.providerId, p.apiKey, retryAfterMs ?? 60_000, "Rate limit (429)");
        } else if (code === "AUTH") {
          setCooldown(p.providerId, p.apiKey, 5 * 60_000, "API key bị từ chối (401/403)");
        } else if (code === "SERVER_ERROR") {
          setCooldown(p.providerId, p.apiKey, retryAfterMs ?? 30_000, "Server provider lỗi (5xx)");
        } else if (code === "TIMEOUT") {
          setCooldown(p.providerId, p.apiKey, 15_000, "Provider timeout");
        }
        // BAD_REQUEST / EMPTY / UNKNOWN: don't cool down — likely tied to this
        // specific request, not the provider's health.
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
