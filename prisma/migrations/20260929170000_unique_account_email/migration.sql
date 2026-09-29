-- Email login requires an unambiguous account lookup.
-- Preflight existing databases for duplicates using LOWER(TRIM(email)) before deploying.
CREATE UNIQUE INDEX `TaiKhoan_email_key` ON `TaiKhoan`(`email`);
