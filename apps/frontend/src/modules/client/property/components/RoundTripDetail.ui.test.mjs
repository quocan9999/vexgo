import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

test('round-trip seats use the reference gray, blue, and orange state colors', async () => {
  const response = await fetch(
    `${baseUrl}/posts/1?needType=BUY&tripType=round-trip&price=2026-09-27&returnDate=2026-09-30&outboundId=1&returnId=6`,
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /fill-slate-200 stroke-slate-300/);
  assert.match(html, /fill-sky-100 stroke-sky-300/);
  assert.match(html, /fill-\[#F5A623\] stroke-\[#D98A12\]/);
});
