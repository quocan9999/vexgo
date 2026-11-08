---
description: "Quy ước viết Git Commit Message chuẩn Conventional Commits bằng tiếng Việt có dấu và cấu trúc giãn dòng"
always_on: true
---

# Quy ước Commit Message (Git Commit Convention)

Mọi commit trong repository VexGo MUST tuân thủ nghiêm ngặt các quy định sau:

## 1. Chuẩn Conventional Commits
- Cú pháp bắt buộc: `<type>(<scope>): <tiêu đề>`
- **Type:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`, `style`.
- **Scope:** Tên workspace (`admin`, `web`, `api`) hoặc tên module/feature cụ thể (`bus-companies`, `shipments`, `rbac`, v.v.).

## 2. Tiếng Việt có dấu (UTF-8)
- Cả **Header** lẫn **Body** MUST viết bằng tiếng Việt CÓ DẤU chuẩn xác UTF-8, câu từ rõ ràng, đúng chính tả tiếng Việt.
- **TUYỆT ĐỐI KHÔNG** viết commit bằng tiếng Việt không dấu.

## 3. Cấu trúc và Quy định dòng trống (Spacing)
- **Giữa Header và Body:** BẮT BUỘC có **duy nhất 1 dòng trống**.
- **Body:** Bao gồm các bullet liên tiếp mô tả chi tiết các thay đổi. Mỗi bullet bắt đầu bằng đúng 4 dấu cách rồi đến `- ` (`    - `).
- **Giữa các bullet trong Body:** BẮT BUỘC **KHÔNG ĐƯỢC CÓ DÒNG TRỐNG** (các bullet phải đứng liền kề nhau liên tục).

### Ví dụ chuẩn:
```text
feat(admin): đa ngôn ngữ hóa toàn diện Phase 5 hệ thống rbac dịch vụ và hàng hóa

    - Đa ngôn ngữ hóa nhà xe và tài khoản quản trị (form tạo/sửa, dialog phân vai trò và validation).
    - Đa ngôn ngữ hóa hệ thống phân quyền RBAC (phạm vi nền tảng/nhà xe, ma trận quyền và phân bổ vai trò).
    - Đa ngôn ngữ hóa báo cáo doanh thu, đánh giá và kênh chat hỗ trợ khách hàng.
    - Đa ngôn ngữ hóa layout quản trị tối cao và bảng điều khiển tổng quan.
    - Đa ngôn ngữ hóa toàn diện phân hệ quản lý và vận chuyển hàng hóa, kiện hàng.
    - Bổ sung đối xứng và đầy đủ 100% translation keys trong vi.json và en.json cho 8 namespaces.
    - Tích hợp bộ kiểm thử tự động Three-layer Zero-Hardcoded-Vi Assertion tại phase5-system-logistics-zero-vi.spec.tsx đạt 83/83 tests PASS.
```
