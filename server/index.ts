import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { db } from "./db.js";
import { extractedAccounts, shareLinks } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

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
    const { deviceId, fullName, accountNumber, referralCode, senderName } = req.body;
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

QUY TẮC BẮT BUỘC:
1. Nếu ảnh là biên lai chuyển tiền có cả "Từ tài khoản" và "Tới tài khoản": LUÔN lấy thông tin từ phần "Tới tài khoản" (người nhận). fullName = tên người nhận, accountNumber = số tài khoản người nhận.
2. senderName CHỈ được lấy từ dòng "Nội dung" hoặc "Lời nhắn" hoặc "Nội dung chuyển tiền". Nếu không có dòng này thì senderName = "".
3. TUYỆT ĐỐI KHÔNG copy fullName sang senderName.
4. Số tài khoản: lấy NGUYÊN VĂN nội dung hiển thị tại vị trí ô số tài khoản (kể cả chữ tiếng Việt như "Số Ngẫu Nhiên"). Chỉ loại bỏ dấu cách thừa giữa các ký tự, KHÔNG được lọc bỏ chữ cái, KHÔNG được dịch, KHÔNG được thay thế.
5. Nếu không tìm thấy thông tin, trả về mảng rỗng.

Trả về JSON theo format:
{
  "results": [{"fullName": "...", "accountNumber": "...", "referralCode": "...", "senderName": "..."}]
}`;

    const callAI = async () => {
      const timeoutMs = 45000;
      return await Promise.race([
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: "Hãy phân tích ảnh này và trích xuất tên đăng nhập, số tài khoản ngân hàng và mã giới thiệu. Trả về kết quả dưới dạng JSON." },
                { inlineData: { mimeType, data: base64Data } },
              ],
            },
          ],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            temperature: 0.1,
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("AI request timeout")), timeoutMs)),
      ]) as any;
    };

    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await callAI();
        const content = response.text || "";
        if (!content) {
          lastErr = new Error("empty response");
          continue;
        }

        let parsedResult;
        try {
          parsedResult = JSON.parse(content);
        } catch {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { results: [] };
        }

        return res.json(parsedResult);
      } catch (aiError: any) {
        lastErr = aiError;
        const msg = String(aiError?.message || "");
        const isRetryable =
          msg.includes("timeout") ||
          msg.includes("429") ||
          msg.toLowerCase().includes("rate") ||
          msg.includes("500") ||
          msg.includes("503") ||
          msg.toLowerCase().includes("unavailable");
        console.error(`AI attempt ${attempt + 1} failed:`, msg);
        if (!isRetryable) break;
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    const finalMsg = String(lastErr?.message || "");
    if (finalMsg.includes("429") || finalMsg.toLowerCase().includes("rate")) {
      return res.status(429).json({ error: "Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau." });
    }
    if (finalMsg.includes("timeout")) {
      return res.status(504).json({ error: "AI phản hồi quá lâu, vui lòng thử lại" });
    }
    return res.status(500).json({ error: "Lỗi khi phân tích ảnh" });
  } catch (error) {
    console.error("analyze-image error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
