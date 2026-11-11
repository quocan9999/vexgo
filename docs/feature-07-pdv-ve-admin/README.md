# Feature 07 — Quản lý phiếu đặt vé & vé (Admin nhà xe)

**Trạng thái:** P01–P05 hoàn tất, READY trong phạm vi Admin read-only. Xem `handoff/FINAL_HANDOFF.md` để biết tests, môi trường và commit SHA.

**Branch:** `feature/admin-bookings-tickets`

**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`

**Bắt buộc:** Tiếp tục trong worktree và MySQL riêng; không dùng database/volume gốc.

## Cấu trúc

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
    ├── PHASE_02_HANDOFF.md
    ├── PHASE_03_HANDOFF.md
    ├── PHASE_04_HANDOFF.md
    ├── PHASE_05_HANDOFF.md
    └── FINAL_HANDOFF.md
```

## Môi trường

- Docker Compose project: `vexgo_feature07`.
- MySQL host port 3307; app DB `vexgo_feature07`; shadow DB `vexgo_feature07_shadow`; test DB `vexgo_feature07_test`.
- API port 4001; Admin port 3002. Dev server dùng CLI bind `127.0.0.1` để origin khớp environment.
- Customer Web không cần chạy cho Feature 07.
- Repo gốc giữ nguyên `develop`; không dùng seed/reset/drop.

## Trình tự và phạm vi

P01 permission foundation → P02 sáu GET APIs → P03 hai tab danh sách → P04 booking/ticket detail và history → P05 integration acceptance.

Feature Admin chỉ đọc dữ liệu. Không triển khai Customer cancellation/timeline, soát vé, refund writer hoặc shipment mutation. History chỉ hiển thị từ các bản ghi hiện có.

## Kết quả

Unit/component tests, API DB integration, lint/typecheck/build, Prisma status/generate và browser smoke đều PASS. Browser smoke dùng fixture tạm trong test DB riêng và đã cleanup. Xem handoff từng phase để biết kết quả chi tiết.
