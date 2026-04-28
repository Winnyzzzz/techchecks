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
- Mỗi entry có: provider, key, model, nhãn tuỳ ý, công tắc bật/tắt, nút kiểm tra (Test). Sắp xếp ưu tiên bằng **kéo-thả** (`@dnd-kit/sortable`, `PointerSensor` + `KeyboardSensor` cho a11y).
- Cấu hình lưu ở `localStorage` key `ai_providers_config`, sync qua custom event `ai-providers-changed`.
- Backend `POST /api/analyze-image` nhận body `{ imageBase64, providers: [{providerId, apiKey, model, keyLabel?}] }` và thử lần lượt theo thứ tự. **Failover policy: chuyển sang provider tiếp theo trên MỌI mã lỗi** (`RATE_LIMIT | TIMEOUT | SERVER_ERROR | AUTH | BAD_REQUEST | EMPTY | UNKNOWN`). Mục đích: 1 key sai/1 model trả 400 không chặn cả chuỗi. Chỉ khi tất cả provider đều fail mới trả lỗi tổng hợp (HTTP 429 nếu phần lớn là rate-limit, 504 nếu timeout, 502 cho các trường hợp khác).
- Trả thêm `providerUsed` và `failovers[]` để frontend hiển thị badge và toast "Đã chuyển sang ...".
- Khi không có provider nào (chuỗi rỗng), fallback dùng env-based Gemini (`AI_INTEGRATIONS_GEMINI_API_KEY` + proxy `AI_INTEGRATIONS_GEMINI_BASE_URL`). Vì SDK `@google/genai` bỏ qua `httpOptions.baseUrl` khi có apiKey constructor → adapter dùng direct fetch khi `baseUrl` được truyền.
- Endpoint phụ: `GET /api/providers` (metadata cho UI), `POST /api/test-provider` (probe ảnh 1×1).
- Prompt rule #6 trong `server/index.ts` cấm AI tự thêm/bớt dấu tiếng Việt vào fullName/senderName (ví dụ Mistral hay "sửa" "NGUYEN VAN A" thành "NGUYỄN VĂN A" — đã chặn).
- Danh sách model OpenRouter free được lấy từ thực tế (Apr 2026): Gemma 3/4, Nemotron, Baidu Qianfan OCR. Llama-4 free đã bị OpenRouter gỡ — không còn dùng được.

### Cooldown & Throttling (server/aiProviders.ts)
Server giữ một map in-memory theo `(providerId + 12 ký tự đầu của apiKey)` ghi nhận sức khoẻ provider:
- **Reactive cooldown**: khi provider trả 429/5xx, đọc header `Retry-After` (giây hoặc HTTP-date, cap 1s–5min). Lưu cooldown để các request sau **bỏ qua provider này** đến khi hết hạn. AUTH (401/403) cooldown 5 phút (key sai).
- **Proactive RPM throttle**: mỗi provider có hint `freeRpm` (Gemini 15, Groq 30, OpenRouter 20, Mistral 60). Trước mỗi call, đếm số request trong cửa sổ 60s — nếu đã bằng `freeRpm` → bỏ qua provider, đợi đến khi slot cũ nhất hết hạn.
- Nếu **toàn bộ chain** bị bỏ qua → vẫn thử nguyên chain (an toàn hơn là từ chối hoàn toàn).
- Response trả thêm `skipped[]` cho frontend hiển thị "Đang nghỉ: X còn 45s".
- Helpers: `checkAvailability`, `recordRequest`, `setCooldown`, `clearCooldown` (gọi sau khi success để xoá cooldown cũ).

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
