# Feature 07 — Quản lý phiếu đặt vé & vé (Admin nhà xe)

**Trạng thái:** Worktree và database riêng đã xác minh; Phase 01–02 hoàn tất. Phase 03–05 chưa triển khai.

**Branch:** `feature/admin-bookings-tickets`

**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`

**Bắt buộc:** Tiếp tục trong worktree và MySQL riêng, không dùng database/volume gốc.

## Cấu trúc tài liệu

```text
docs/feature-07-pdv-ve-admin/
├── README.md
├── ENVIRONMENT_WORKTREE.md
├── spec/
│   ├── MASTER_SPEC.md
│   ├── PHASE_01_RBAC_BACKEND_FOUNDATION.md
│   ├── PHASE_02_ADMIN_READ_APIS.md
│   ├── PHASE_03_ADMIN_LIST_UI.md
│   ├── PHASE_04_ADMIN_DETAIL_HISTORY_UI.md
│   └── PHASE_05_INTEGRATION_ACCEPTANCE.md
└── handoff/
    ├── IMPLEMENTATION_PLAN.md
    ├── ENVIRONMENT_HANDOFF.md
    ├── HANDOFF_TEMPLATE.md
    ├── PHASE_01_HANDOFF.md
    └── PHASE_02_HANDOFF.md
```

Toàn bộ tài liệu, báo cáo kiểm thử và handoff Feature 07 chỉ đặt dưới thư mục này.

## Trình tự

1. Đọc `AGENTS.md`, hướng dẫn app liên quan, `ENVIRONMENT_WORKTREE.md` và handoff gần nhất.
2. Kiểm tra worktree/branch, Docker project `vexgo_feature07`, `.env` riêng và URLs trước thao tác database.
3. Đọc `spec/MASTER_SPEC.md` và spec của phase hiện tại.
4. Thực hiện đúng phase, chạy targeted tests, tự review diff, commit local và ghi handoff.
5. Không push, mở PR hoặc merge trong quá trình này. Phase 05 kết thúc bằng handoff cuối.

> Phase 01 bổ sung RBAC permission foundation và rollout dữ liệu tối thiểu. Phase 02 cung cấp sáu Admin GET APIs; UI thuộc Phase 03–04.
