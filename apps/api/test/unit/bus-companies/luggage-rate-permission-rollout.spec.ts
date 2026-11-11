import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL(
  '../../../../../prisma/migrations/20261110010000_add_luggage_rate_permissions/migration.sql',
  import.meta.url,
);

describe('luggage-rate permission migration', () => {
  it('seeds luggage-rate:read and luggage-rate:update for NHA_XE_ADMIN defaults and existing NHA_XE_ADMIN overrides only', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(
      /INSERT IGNORE INTO `Quyen` \(`tenQuyen`, `moTa`\)[\s\S]*\('luggage-rate:read', 'Xem cấu hình cước hành lý nhà xe\.'\)[\s\S]*\('luggage-rate:update', 'Cập nhật cấu hình cước hành lý nhà xe\.'\)/,
    );
    expect(sql).toMatch(
      /INSERT IGNORE INTO `VaiTroQuyen` \(`vaiTroId`, `quyenId`\)[\s\S]*FROM `VaiTro` AS role[\s\S]*JOIN `Quyen` AS permission[\s\S]*permission\.`tenQuyen` IN \('luggage-rate:read', 'luggage-rate:update'\)[\s\S]*WHERE role\.`tenVaiTro` = 'NHA_XE_ADMIN';/,
    );
    expect(sql).toMatch(
      /INSERT IGNORE INTO `CauHinhQuyenVaiTroNhaXeChiTiet` \(`nhaXeId`, `vaiTroId`, `quyenId`\)[\s\S]*FROM `CauHinhQuyenVaiTroNhaXe` AS config[\s\S]*JOIN `VaiTro` AS role ON role\.`vaiTroId` = config\.`vaiTroId`[\s\S]*JOIN `Quyen` AS permission[\s\S]*permission\.`tenQuyen` IN \('luggage-rate:read', 'luggage-rate:update'\)[\s\S]*WHERE role\.`tenVaiTro` = 'NHA_XE_ADMIN';/,
    );
    expect(sql).not.toMatch(/SUPER_ADMIN|NHAN_VIEN_|KHACH_HANG/);
    expect(sql).not.toMatch(/INSERT[^\n]*INTO `CauHinhQuyenVaiTroNhaXe`\b/);
  });
});
