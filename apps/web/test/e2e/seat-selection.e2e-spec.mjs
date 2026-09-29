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

test('seat selector shows both floors without the floor filter controls', async () => {
  const response = await fetch(`${server.baseUrl}/trips/1?needType=BUY&tripType=one-way`);
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.ok(!html.includes('>Tất cả<'), 'Should not contain >Tất cả< filter');
  assert.ok(html.includes('>Tầng dưới<'), 'Should contain >Tầng dưới<');
  assert.ok(html.includes('>Tầng trên<'), 'Should contain >Tầng trên<');
});

test('one-way seats expose button semantics and selection state to keyboard users', async () => {
  const response = await fetch(`${server.baseUrl}/trips/1?needType=BUY&tripType=one-way`);
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<button[^>]*aria-label="A12 còn trống"[^>]*aria-pressed="false"[^>]*>/i);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="A01 đã bán"[^>]*>/i);
});

test('round-trip seats use the reference gray, blue, and orange state colors', async () => {
  const response = await fetch(
    `${server.baseUrl}/trips/1?needType=BUY&tripType=round-trip&price=2026-09-27&returnDate=2026-09-30&outboundId=1&returnId=6`,
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.ok(html.includes('fill-slate-200'), 'Should have gray fill');
  assert.ok(html.includes('stroke-slate-300'), 'Should have gray stroke');
  assert.ok(html.includes('fill-sky-100'), 'Should have blue fill');
  assert.ok(html.includes('stroke-sky-300'), 'Should have blue stroke');
  assert.ok(html.includes('fill-[#F5A623]'), 'Should have orange fill');
  assert.ok(html.includes('stroke-[#D98A12]'), 'Should have orange stroke');
});

test('missing or malformed booking query parameters fallback to safe one-way detail state safely', async () => {
  // Pass invalid tripType or missing query params
  const response = await fetch(`${server.baseUrl}/trips/1?tripType=invalid&outboundId=invalid`);
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.ok(html.includes('>Tầng dưới<'), 'Should fallback to one-way and render floors safely');
});
