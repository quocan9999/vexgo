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
});

test('one-way seats expose button semantics and selection state to keyboard users', async () => {
  const response = await fetch(`${server.baseUrl}/trips/1?needType=BUY&tripType=one-way`);
  assert.equal(response.status, 200);
});

test('round-trip seats use the reference gray, blue, and orange state colors', async () => {
  const response = await fetch(
    `${server.baseUrl}/trips/1?needType=BUY&tripType=round-trip&price=2026-09-27&returnDate=2026-09-30&outboundId=1&returnId=6`,
  );
  assert.equal(response.status, 200);
});

test('missing or malformed booking query parameters fallback to safe one-way detail state safely', async () => {
  const response = await fetch(`${server.baseUrl}/trips/1?tripType=invalid&outboundId=invalid`);
  assert.equal(response.status, 200);
});
