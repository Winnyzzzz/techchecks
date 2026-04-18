import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db";
import { extractedAccounts, shareLinks } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

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
      .where(eq(extractedAccounts.deviceId, deviceId))
      .orderBy(desc(extractedAccounts.createdAt));
    res.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const { deviceId, fullName, accountNumber, referralCode, senderName } = req.body;
    const [account] = await db
      .insert(extractedAccounts)
      .values({
        deviceId,
        fullName,
        accountNumber: accountNumber.replace(/\s/g, ""),
        referralCode: referralCode || "",
        senderName: senderName || "",
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
        fullName,
        accountNumber: accountNumber.replace(/\s/g, ""),
        referralCode,
        senderName,
        updatedAt: new Date(),
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
    await db.delete(extractedAccounts).where(eq(extractedAccounts.deviceId, deviceId));
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
      .where(eq(shareLinks.deviceId, deviceId));
    res.json(link || null);
  } catch (error) {
    console.error("Error fetching share link:", error);
    res.status(500).json({ error: "Failed to fetch share link" });
  }
});

app.post("/api/share-links", async (req, res) => {
  try {
    const { deviceId, shareCode } = req.body;
    const [link] = await db
      .insert(shareLinks)
      .values({ deviceId, shareCode })
      .returning();
    res.json(link);
  } catch (error: any) {
    if (error?.code === "23505") {
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
      .where(eq(shareLinks.shareCode, shareCode.toUpperCase()));
    res.json(link ? { deviceId: link.deviceId } : null);
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

    const AI_API_KEY = process.env.AI_API_KEY;
    if (!AI_API_KEY) {
      console.error("AI_API_KEY is not configured");
      return res.status(500).json({ error: "AI service not configured" });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Bạn là một AI chuyên trích xuất thông tin từ ảnh chụp màn hình giao dịch ngân hàng, biên lai, mã QR, hoặc các tài liệu tài chính.

Nhiệm vụ của bạn:
1. Phân tích hình ảnh được cung cấp
2. Trích xuất các thông tin sau:
   - fullName: tên tài khoản người nhận tiền
   - accountNumber: số tài khoản người nhận (loại bỏ tất cả dấu cách)
   - referralCode: mã giới thiệu (nếu có, nếu không thì "")
   - senderName: tên lấy từ dòng "Nội dung"/"Lời nhắn"/"Nội dung chuyển tiền" (nếu có)

QUY TẮC BẮT BUỘC:
1. Nếu ảnh là biên lai chuyển tiền có cả "Từ tài khoản" và "Tới tài khoản": LUÔN lấy thông tin từ phần "Tới tài khoản" (người nhận). fullName = tên người nhận, accountNumber = số tài khoản người nhận.
2. senderName CHỈ được lấy từ dòng "Nội dung" hoặc "Lời nhắn" hoặc "Nội dung chuyển tiền". Nếu không có dòng này thì senderName = "".
3. TUYỆT ĐỐI KHÔNG copy fullName sang senderName.
4. Số tài khoản: loại bỏ tất cả dấu cách, chỉ giữ lại số.
5. Nếu không tìm thấy thông tin, trả về mảng rỗng.

Trả về JSON theo format:
{
  "results": [...]
}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Hãy phân tích ảnh này và trích xuất tên đăng nhập, số tài khoản ngân hàng và mã giới thiệu. Trả về kết quả dưới dạng JSON.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return res.status(429).json({ error: "Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau." });
      }
      if (response.status === 402) {
        return res.status(402).json({ error: "Cần nạp thêm credits để sử dụng AI." });
      }
      return res.status(500).json({ error: "Lỗi khi phân tích ảnh" });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: "Không nhận được phản hồi từ AI" });
    }

    let parsedResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        parsedResult = { results: [] };
      }
    } catch {
      parsedResult = { results: [] };
    }

    res.json(parsedResult);
  } catch (error) {
    console.error("analyze-image error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../dist/public")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../dist/public/index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
