import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing image with Lovable AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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

Ví dụ 1 - Ảnh mã QR ngân hàng:
{"fullName": "NGUYEN VAN A", "accountNumber": "1234567890", "referralCode": "", "senderName": ""}

Ví dụ 2 - Biên lai chuyển tiền từ NGUYEN VAN SANG tới TRAN THI PHEL, nội dung "ck":
{"fullName": "TRAN THI PHEL", "accountNumber": "10003464382", "referralCode": "", "senderName": ""}
(Lưu ý: "ck" không phải tên người nên senderName = "")

Ví dụ 3 - Biên lai có nội dung "Duong Hoang Long chuyen tien":
{"fullName": "NGUYEN VAN A", "accountNumber": "1234567890", "referralCode": "", "senderName": "Duong Hoang Long"}

Trả về JSON theo format:
{
  "results": [...]
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Hãy phân tích ảnh này và trích xuất tên đăng nhập, số tài khoản ngân hàng và mã giới thiệu. Trả về kết quả dưới dạng JSON."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Cần nạp thêm credits để sử dụng AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Lỗi khi phân tích ảnh" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response received");
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Không nhận được phản hồi từ AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON from AI response
    let parsedResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        parsedResult = { results: [] };
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      parsedResult = { results: [] };
    }

    console.log("Extracted results:", parsedResult);

    return new Response(
      JSON.stringify(parsedResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
