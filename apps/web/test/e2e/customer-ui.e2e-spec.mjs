import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startNextProductionServer } from '../helpers/next-production-server.mjs';

let server;

before(async () => {
  server = await startNextProductionServer();
});

after(async () => {
  await server?.stop();
});

const publicScreens = [
  { path: '/', marker: 'Chất lượng là danh dự' },
  { path: '/about', marker: 'Giá Trị Nền Tảng' },
  { path: '/contact', marker: 'Thông Tin Liên Hệ' },
  { path: '/donate', marker: 'Thông Tin Thanh Toán Chuyển Khoản' },
];

for (const screen of publicScreens) {
  test(`${screen.path} renders the migrated public screen`, async () => {
    const response = await fetch(`${server.baseUrl}${screen.path}`);
    const html = await response.text();

    assert.equal(response.status, 200, `Expected 200 for ${screen.path}`);
    assert.ok(html.toLowerCase().includes(screen.marker.toLowerCase()), `Expected to find "${screen.marker}" on ${screen.path}`);
  });
}

const authScreens = [
  { path: '/login', marker: 'Tài khoản mẫu (Demo)' },
  { path: '/auth/login', marker: 'Tài khoản mẫu (Demo)' },
  { path: '/register', marker: 'Tạo tài khoản mới' },
  { path: '/auth/register', marker: 'Tạo tài khoản mới' },
  { path: '/profile', marker: 'Thông tin tài khoản' },
  { path: '/account/profile', marker: 'Thông tin tài khoản' },
  { path: '/profile/password', marker: 'Đặt lại mật khẩu' },
  { path: '/account/profile/password', marker: 'Đặt lại mật khẩu' },
  { path: '/my-posts', marker: 'Lịch sử mua vé' },
  { path: '/account/tickets', marker: 'Lịch sử mua vé' },
  { path: '/loyalty', marker: 'Hạng hiện tại' },
  { path: '/account/loyalty', marker: 'Hạng hiện tại' },
];

for (const screen of authScreens) {
  test(`${screen.path} renders the migrated auth/account screen`, async () => {
    const response = await fetch(`${server.baseUrl}${screen.path}`);
    const html = await response.text();

    assert.equal(response.status, 200, `Expected 200 for ${screen.path}`);
    assert.ok(html.toLowerCase().includes(screen.marker.toLowerCase()), `Expected to find "${screen.marker}" on ${screen.path}`);
  });
}

test('the customer application keeps VexGo metadata', async () => {
  const response = await fetch(server.baseUrl);
  const html = await response.text();

  assert.match(html, /<title>[^<]*VexGo[^<]*<\/title>/i);
  assert.doesNotMatch(html, /<title>[^<]*BusWay[^<]*<\/title>/i);
});

const postScreens = [
  { path: '/posts', marker: 'Tìm chuyến' },
  { path: '/posts/1', marker: 'Giá vé lượt đi' },
  { path: '/post-property/create', marker: 'Tìm chuyến' },
  { path: '/trips', marker: 'Tìm chuyến' },
  { path: '/trips/1', marker: 'Giá vé lượt đi' },
];

for (const screen of postScreens) {
  test(`${screen.path} renders the migrated post/trip screen`, async () => {
    const response = await fetch(`${server.baseUrl}${screen.path}`);
    const html = await response.text();

    assert.equal(response.status, 200, `Expected 200 for ${screen.path}`);
    assert.ok(html.toLowerCase().includes(screen.marker.toLowerCase()), `Expected to find "${screen.marker}" on ${screen.path}`);
  });
}

const serviceScreens = [
  { path: '/tra-cuu-ve', marker: 'TRA CỨU THÔNG TIN ĐẶT VÉ' },
  { path: '/cancel-ticket', marker: 'Hủy Vé' },
  { path: '/invoice/123', marker: 'VÉ ĐIỆN TỬ' },
  { path: '/payment', marker: 'Tổng thanh toán' },
  { path: '/send-freight', marker: 'Gửi hàng theo nhà xe' },
  { path: '/tickets/lookup', marker: 'TRA CỨU THÔNG TIN ĐẶT VÉ' },
  { path: '/tickets/123/cancel', marker: 'Hủy Vé' },
  { path: '/invoices/123', marker: 'VÉ ĐIỆN TỬ' },
  { path: '/payments/bank-transfer', marker: 'Tổng thanh toán' },
  { path: '/shipments/new', marker: 'Gửi hàng theo nhà xe' },
];

for (const screen of serviceScreens) {
  test(`${screen.path} renders the migrated service screen`, async () => {
    const response = await fetch(`${server.baseUrl}${screen.path}`);
    const html = await response.text();

    assert.equal(response.status, 200, `Expected 200 for ${screen.path}`);
    assert.ok(html.toLowerCase().includes(screen.marker.toLowerCase()), `Expected to find "${screen.marker}" on ${screen.path}`);
  });
}

const forbiddenFrontendReference = /apps[\\/]frontend|@vexgo[\\/]frontend|(?:\.\.[\\/]){3}apps[\\/]frontend/i;

function findForbiddenFrontendReferences(targets) {
  const matches = [];

  function scan(target) {
    const entries = readdirSync(target, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(target, entry.name);
      if (entry.isDirectory()) {
        scan(entryPath);
        continue;
      }

      const content = readFileSync(entryPath, 'utf8');
      if (forbiddenFrontendReference.test(content)) matches.push(entryPath);
    }
  }

  for (const target of targets) {
    if (target.endsWith('package.json')) {
      if (forbiddenFrontendReference.test(readFileSync(target, 'utf8'))) matches.push(target);
    } else {
      scan(target);
    }
  }

  return matches;
}

test('independence scanner detects a forbidden apps/frontend reference', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'vexgo-web-independence-'));
  const fixtureFile = path.join(fixtureRoot, 'forbidden-reference.ts');

  try {
    writeFileSync(fixtureFile, "export const sourceApp = '../../../apps/frontend';\n");
    assert.deepEqual(findForbiddenFrontendReferences([fixtureRoot]), [fixtureFile]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('independence check: @vexgo/web must not reference the old apps/frontend', () => {
  const webRoot = path.resolve(import.meta.dirname, '../..');
  const matches = findForbiddenFrontendReferences([
    path.join(webRoot, 'src'),
    path.join(webRoot, 'package.json'),
  ]);

  assert.deepEqual(matches, [], `Found references to the old frontend app:\n${matches.join('\n')}`);
});
