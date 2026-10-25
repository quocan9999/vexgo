import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry } from '../../../src/lib/fetch-with-retry.ts';

afterEach(() => mock.restoreAll());

test('route reads retain the cancellation signal through a transient network retry', async () => {
  const controller = new AbortController();
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.signal, controller.signal);
    calls += 1;
    if (calls === 1) throw new TypeError('network unavailable');
    return new Response('ok');
  });
  const result = await fetchWithRetry(
    'https://example.test/routes',
    { signal: controller.signal },
    2,
    0,
  );
  assert.equal(await result.text(), 'ok');
  assert.equal(calls, 2);
});

test('a temporary gateway error retries but a client error does not', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response('', { status: calls === 1 ? 503 : 400 });
  });
  const result = await fetchWithRetry(
    'https://example.test/routes',
    undefined,
    2,
    0,
  );
  assert.equal(result.status, 400);
  assert.equal(calls, 2);
});

test('an already aborted route request never reaches fetch', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchMock = mock.method(
    globalThis,
    'fetch',
    async () => new Response('unexpected'),
  );
  await assert.rejects(
    fetchWithRetry('https://example.test/routes', {
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('cancelling during backoff stops immediately and never starts another attempt', async () => {
  const controller = new AbortController();
  const fetchMock = mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 503 }),
  );
  const pending = fetchWithRetry(
    'https://example.test/routes',
    { signal: controller.signal },
    2,
    60_000,
  );
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('a fetch AbortError is propagated without retry even without an attached signal', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new DOMException('cancelled', 'AbortError');
  });
  await assert.rejects(
    fetchWithRetry('https://example.test/routes', undefined, 2, 0),
    { name: 'AbortError' },
  );
  assert.equal(fetchMock.mock.callCount(), 1);
});
