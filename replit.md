# Vietnamese Bank Transaction Screenshot Analyzer

Web app phân tích ảnh chụp màn hình giao dịch ngân hàng tiếng Việt bằng AI để trích xuất:
fullName, accountNumber, referralCode, senderName, imageTime.

## Stack
- Vite + React + TypeScript + shadcn/ui + Tailwind
- Express (cùng port 5000 qua Vite middleware/proxy; dev: 3000)
- Drizzle + PostgreSQL (Replit DB)
- AI: Google Gemini (mặc định Replit integration), Groq, OpenRouter, Mistral

## Tính năng chính
- Upload nhiều ảnh, gọi AI trích xuất thông tin
- Lưu theo `device_id`; share link để chia sẻ giữa thiết bị
- Import/Export Excel; thêm tay; lưu ảnh gốc vào IndexedDB
- Phát hiện trùng lặp (full_name + account_number)
- Cấu hình mã giới thiệu chuẩn + bật/tắt cảnh báo
- Per-sender folders (đồng bộ qua custom event giữa các hook instance)
- Đánh dấu (tick) hàng có account_number quan trọng (localStorage)

## Multi-AI Provider Failover (Task #1)
- Người dùng có thể thêm nhiều API key (Gemini, Groq, OpenRouter, Mistral) trong dialog "AI Providers".
- Mỗi entry có: provider, key, model, nhãn tuỳ ý, công tắc bật/tắt, nút kiểm tra (Test), reorder bằng mũi tên.
- Cấu hình lưu ở `localStorage` key `ai_providers_config`, sync qua custom event `ai-providers-changed`.
- Backend `POST /api/analyze-image` nhận body `{ imageBase64, providers: [{providerId, apiKey, model, keyLabel?}] }` và thử lần lượt theo thứ tự. Tự chuyển sang provider tiếp theo khi gặp `RATE_LIMIT | TIMEOUT | SERVER_ERROR | AUTH | EMPTY | UNKNOWN`. Dừng (trả 400) khi gặp `BAD_REQUEST` (lỗi đầu vào).
- Trả thêm `providerUsed` và `failovers[]` để frontend hiển thị badge và toast "Đã chuyển sang ...".
- Khi không có provider nào (chuỗi rỗng), fallback dùng env-based Gemini (`AI_INTEGRATIONS_GEMINI_API_KEY` + proxy `AI_INTEGRATIONS_GEMINI_BASE_URL`). Vì SDK `@google/genai` bỏ qua `httpOptions.baseUrl` khi có apiKey constructor → adapter dùng direct fetch khi `baseUrl` được truyền.
- Endpoint phụ: `GET /api/providers` (metadata cho UI), `POST /api/test-provider` (probe ảnh 1×1).

## File chính
- `server/aiProviders.ts` — registry & adapters (Gemini direct + OpenAI-compatible cho Groq/OpenRouter/Mistral)
- `server/index.ts` — endpoints `/api/analyze-image`, `/api/providers`, `/api/test-provider`, ngoài ra accounts & share links
- `src/hooks/useAIProviders.ts` — hook + helper `getActiveProviderConfigs()`
- `src/components/AIProviderSettings.tsx` — dialog cấu hình
- `src/hooks/useImageAnalyzer.ts` — gửi providers vào request, xử lý providerUsed & failover toast
- `src/components/ProcessingStatus.tsx` — badge "đang dùng provider X"
- `src/pages/Index.tsx` — nút AIProviderSettings + bảng tài khoản

## Dev
- Workflow `Start application` chạy `npm run dev` (concurrently tsx watch + vite)
- Build: `npm run build` → `dist/public` (frontend) + `dist/server` (backend ESM)
- DB: `npm run db:push` (Drizzle Kit)

## Ràng buộc
- KHÔNG sửa `package.json`, `vite.config.ts`, `server/vite.ts`, `drizzle.config.ts`
- UI/toast tiếng Việt
- Test ID prefix theo convention `{action}-{target}` / `{type}-{content}`
