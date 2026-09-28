import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
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

import { execSync } from 'child_process';

test('independence check: @vexgo/web must not reference the old apps/frontend', () => {
  try {
    // We check for "apps/frontend" or "@vexgo/frontend" or "../../../apps/frontend"
    // rg will exit 0 if it finds something, and 1 if it doesn't.
    const output = execSync('grep -r -i "apps/frontend|@vexgo/frontend|\\.\\./\\.\\./\\.\\./apps/frontend" apps/web/src apps/web/package.json', { encoding: 'utf-8' });
    assert.fail(`Found references to the old frontend app in the migrated web app:\n${output}`);
  } catch (error) {
    // If rg exits with 1, it means no matches found, which is what we want.
    assert.equal(error.status, 1, 'Expected grep to return 1 (no matches found). If it returned 2, rg might be missing or there was an error.');
  }
});
