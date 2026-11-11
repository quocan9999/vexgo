import { readFile } from 'node:fs/promises';
import { createFarePriceTestContext } from './fare-price-test-context.js';
import { afterEach, describe, expect, it } from 'vitest';

const migrationSqlUrl = new URL(
  '../../../../../prisma/migrations/20260928100000_normalize_legacy_fare_price_status/migration.sql',
  import.meta.url,
);

describe('legacy fare price status migration', () => {
  let closeContext: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeContext?.();
    closeContext = undefined;
  });

  it('maps DANG_AP_DUNG to HOAT_DONG and preserves supported statuses', async () => {
    const context = await createFarePriceTestContext();
    closeContext = context.close;
    const migrationSql = await readFile(migrationSqlUrl, 'utf8');
    let migratedStatuses: string[] = [];

    await context.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRawUnsafe(
          'CREATE TEMPORARY TABLE `BangGia` (`bangGiaId` INT NOT NULL AUTO_INCREMENT, `trangThai` VARCHAR(30) NOT NULL, PRIMARY KEY (`bangGiaId`))',
        );
        try {
          await transaction.$executeRawUnsafe(
            "INSERT INTO `BangGia` (`trangThai`) VALUES ('DANG_AP_DUNG'), ('TAM_NGUNG')",
          );
          await transaction.$executeRawUnsafe(migrationSql);

          const records = await transaction.$queryRawUnsafe<
            Array<{ trangThai: string }>
          >('SELECT `trangThai` FROM `BangGia` ORDER BY `bangGiaId` ASC');
          migratedStatuses = records.map(({ trangThai }) => trangThai);
        } finally {
          await transaction.$executeRawUnsafe(
            'DROP TEMPORARY TABLE IF EXISTS `BangGia`',
          );
        }
      },
      { timeout: 15000 },
    );

    expect(migratedStatuses).toEqual(['HOAT_DONG', 'TAM_NGUNG']);
  }, 20000);
});
