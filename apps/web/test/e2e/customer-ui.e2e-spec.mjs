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

    assert.equal(response.status, 200);
    assert.match(html, new RegExp(screen.marker, 'i'));
  });
}

test('the customer application keeps VexGo metadata', async () => {
  const response = await fetch(server.baseUrl);
  const html = await response.text();

  assert.match(html, /<title>[^<]*VexGo[^<]*<\/title>/i);
  assert.doesNotMatch(html, /<title>[^<]*BusWay[^<]*<\/title>/i);
});
