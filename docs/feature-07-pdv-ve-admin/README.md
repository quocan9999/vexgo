# Feature 07 — Quản lý phiếu đặt vé & vé (Admin nhà xe)

**Trạng thái:** Thiết kế nghiệp vụ đã duyệt; chưa triển khai.  
**Branch dự kiến:** `feature/admin-bookings-tickets`  
**Bắt buộc:** Làm việc trên Git worktree và MySQL độc lập, không dùng lại database gốc.

## Cấu trúc tài liệu

```text
docs/feature-07-pdv-ve-admin/
├── README.md
├── ENVIRONMENT_WORKTREE.md
├── spec/
│   ├── MASTER_SPEC.md
│   └── PHASE_01_RBAC_BACKEND_FOUNDATION.md
└── handoff/
    └── HANDOFF_TEMPLATE.md
```

Tất cả tài liệu, spec của Phase 2–5, báo cáo kiểm thử và handoff chỉ đặt dưới thư mục này. Ví dụ:

- `spec/PHASE_02_ADMIN_READ_APIS.md`
- `spec/PHASE_03_ADMIN_LIST_UI.md`
- `spec/PHASE_04_ADMIN_DETAIL_HISTORY_UI.md`
- `spec/PHASE_05_INTEGRATION_ACCEPTANCE.md`
- `handoff/PHASE_01_HANDOFF.md`, ...

## Trình tự

1. Đọc `AGENTS.md`, các hướng dẫn app liên quan và `ENVIRONMENT_WORKTREE.md`.
2. **Chuẩn bị và xác minh worktree + Docker project + DB + `.env` riêng trước mọi migration/seed.** Không chuyển sang coding nếu chưa xác nhận isolation.
3. Đọc `spec/MASTER_SPEC.md` và spec của phase hiện tại.
4. Implement từng phase, chạy targeted tests, tự review diff, commit local và ghi handoff.
5. Trước phase kế tiếp đọc handoff trước đó. Không tự push hoặc mở PR khi chưa được giao; PR cuối cùng vào `develop` sau Phase 5.

> Tài liệu này là một gói để đưa vào repo/worktree. Chưa tạo worktree, database hay sửa code thật trong repo của người dùng.
