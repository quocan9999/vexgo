import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
    assert.ok(
      html.toLowerCase().includes(screen.marker.toLowerCase()),
      `Expected to find "${screen.marker}" on ${screen.path}`,
    );
  });
}

const authScreens = [
  { path: '/login', marker: 'Đăng nhập tài khoản' },
  { path: '/auth/login', marker: 'Đăng nhập tài khoản' },
  { path: '/register', marker: 'Đăng ký tài khoản' },
  { path: '/auth/register', marker: 'Đăng ký tài khoản' },
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
    assert.ok(
      html.toLowerCase().includes(screen.marker.toLowerCase()),
      `Expected to find "${screen.marker}" on ${screen.path}`,
    );
  });
}

for (const accountRoute of [
  '/account/profile',
  '/account/tickets',
  '/account/profile/password',
]) {
  test(`${accountRoute} marks its canonical sidebar link as the current page`, async () => {
    const response = await fetch(`${server.baseUrl}${accountRoute}`);
    const html = await response.text();
    const linkTag = html.match(
      new RegExp(
        `<a[^>]*href="${accountRoute.replaceAll('/', '\\/')}"[^>]*>`,
        'i',
      ),
    )?.[0];

    assert.equal(response.status, 200);
    assert.ok(linkTag, `Expected sidebar link for ${accountRoute}`);
    assert.match(linkTag, /aria-current="page"/i);
  });
}

for (const [legacyRoute, canonicalRoute] of [
  ['/profile', '/account/profile'],
  ['/my-posts', '/account/tickets'],
  ['/profile/password', '/account/profile/password'],
]) {
  test(`${legacyRoute} keeps the matching canonical sidebar link active`, async () => {
    const response = await fetch(`${server.baseUrl}${legacyRoute}`);
    const html = await response.text();
    const linkTag = html.match(
      new RegExp(
        `<a[^>]*href="${canonicalRoute.replaceAll('/', '\\/')}"[^>]*>`,
        'i',
      ),
    )?.[0];

    assert.equal(response.status, 200);
    assert.ok(linkTag, `Expected sidebar link for ${canonicalRoute}`);
    assert.match(linkTag, /aria-current="page"/i);
  });
}

test('the customer application keeps VexGo metadata', async () => {
  const response = await fetch(server.baseUrl);
  const html = await response.text();

  assert.match(html, /<title>[^<]*VexGo[^<]*<\/title>/i);
  assert.doesNotMatch(html, /<title>[^<]*BusWay[^<]*<\/title>/i);
});

test('mobile menu trigger exposes its closed state and controlled drawer', async () => {
  const response = await fetch(server.baseUrl);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    html,
    /<button[^>]*aria-label="Mở menu"[^>]*aria-expanded="false"[^>]*aria-controls="customer-mobile-menu"[^>]*>/i,
  );
});

test('customer-facing source does not regress to the retired BusWay brand', () => {
  const sourceRoot = path.resolve(import.meta.dirname, '../../src');
  const matches = [];

  function scan(target) {
    for (const entry of readdirSync(target, { withFileTypes: true })) {
      const entryPath = path.join(target, entry.name);
      if (entry.isDirectory()) {
        scan(entryPath);
      } else if (
        /\.(?:ts|tsx)$/.test(entry.name) &&
        /busway/i.test(readFileSync(entryPath, 'utf8'))
      ) {
        matches.push(entryPath);
      }
    }
  }

  scan(sourceRoot);
  assert.deepEqual(
    matches,
    [],
    `Found retired BusWay branding:\n${matches.join('\n')}`,
  );
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
    assert.ok(
      html.toLowerCase().includes(screen.marker.toLowerCase()),
      `Expected to find "${screen.marker}" on ${screen.path}`,
    );
  });
}

test('trip booking renders the real seat map returned for that trip', async () => {
  const response = await fetch(`${server.baseUrl}/trips/1`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Z99 còn trống/i);
  assert.match(html, /Z98 đã bán/i);
  assert.doesNotMatch(html, /B04 đang chọn/i);
});

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
    assert.ok(
      html.toLowerCase().includes(screen.marker.toLowerCase()),
      `Expected to find "${screen.marker}" on ${screen.path}`,
    );
  });
}

const forbiddenFrontendReference =
  /apps[\\/]frontend|@vexgo[\\/]frontend|(?:\.\.[\\/]){3}apps[\\/]frontend/i;

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
      if (forbiddenFrontendReference.test(readFileSync(target, 'utf8')))
        matches.push(target);
    } else {
      scan(target);
    }
  }

  return matches;
}

test('independence scanner detects a forbidden apps/frontend reference', () => {
  const fixtureRoot = mkdtempSync(
    path.join(tmpdir(), 'vexgo-web-independence-'),
  );
  const fixtureFile = path.join(fixtureRoot, 'forbidden-reference.ts');

  try {
    writeFileSync(
      fixtureFile,
      "export const sourceApp = '../../../apps/frontend';\n",
    );
    assert.deepEqual(findForbiddenFrontendReferences([fixtureRoot]), [
      fixtureFile,
    ]);
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

  assert.deepEqual(
    matches,
    [],
    `Found references to the old frontend app:\n${matches.join('\n')}`,
  );
});
