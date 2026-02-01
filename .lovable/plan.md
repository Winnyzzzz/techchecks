

# 📸 Ứng dụng Trích xuất Họ tên & Số tài khoản từ Ảnh

## Tổng quan
Xây dựng một ứng dụng web cho phép tải lên nhiều ảnh cùng lúc, sử dụng AI (Lovable AI với khả năng phân tích hình ảnh) để nhận diện và trích xuất thông tin họ tên, số tài khoản ngân hàng từ các ảnh chụp màn hình giao dịch hoặc biên lai.

---

## 🎯 Tính năng chính

### 1. Tải ảnh hàng loạt
- Kéo thả nhiều ảnh cùng lúc hoặc click để chọn file
- Hỗ trợ định dạng: JPG, PNG, WEBP
- Hiển thị preview ảnh trước khi xử lý
- Thanh tiến trình khi đang phân tích

### 2. Phân tích AI tự động
- Sử dụng Lovable AI (Google Gemini) để đọc và nhận diện văn bản trong ảnh
- Tự động trích xuất:
  - **Họ và tên** người nhận/gửi
  - **Số tài khoản** ngân hàng
- Cho phép sửa lại nếu AI nhận sai

### 3. Quản lý danh sách
- Bảng danh sách với các cột: STT, Họ tên, Số tài khoản, Trạng thái
- Thêm/sửa/xóa từng mục thủ công
- Tìm kiếm và lọc trong danh sách

### 4. Lưu trữ dữ liệu
- Dữ liệu được lưu trên cloud (Lovable Cloud)
- Reload trang không mất dữ liệu
- Không cần đăng nhập (dữ liệu theo thiết bị)

### 5. Xuất dữ liệu
- Xuất ra file Excel (.xlsx) hoặc CSV
- Copy toàn bộ danh sách vào clipboard

---

## 🖥️ Giao diện người dùng

### Trang chính (1 trang duy nhất)
- **Header**: Tên ứng dụng + nút xuất file
- **Vùng tải ảnh**: Khu vực kéo thả với hướng dẫn rõ ràng
- **Khu vực xử lý**: Hiển thị ảnh đang được AI phân tích
- **Bảng kết quả**: Danh sách họ tên và số tài khoản đã trích xuất

### Thiết kế
- Giao diện đơn giản, sáng, tập trung vào chức năng
- Responsive cho cả desktop và mobile
- Thông báo rõ ràng khi có lỗi hoặc thành công

---

## 🔧 Công nghệ sử dụng

| Thành phần | Công nghệ |
|------------|-----------|
| Frontend | React + TypeScript + Tailwind CSS |
| AI phân tích ảnh | Lovable AI (Google Gemini với vision) |
| Backend | Lovable Cloud (Edge Functions) |
| Database | Lovable Cloud |
| Xuất Excel | Thư viện xlsx |

---

## 📋 Luồng hoạt động

1. Người dùng kéo thả hoặc chọn nhiều ảnh
2. Ảnh được upload lên storage tạm
3. Từng ảnh được gửi đến AI để phân tích
4. AI trả về họ tên và số tài khoản
5. Kết quả hiển thị trong bảng, người dùng có thể chỉnh sửa
6. Dữ liệu tự động lưu vào database
7. Người dùng có thể xuất ra Excel khi cần

