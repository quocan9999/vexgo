import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

test('seat selector shows both floors without the floor filter controls', async () => {
  const response = await fetch(`${baseUrl}/posts/1?needType=BUY&tripType=one-way`);
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.doesNotMatch(html, />Tất cả</);
  assert.match(html, />Tầng dưới</);
  assert.match(html, />Tầng trên</);
});
