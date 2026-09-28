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
