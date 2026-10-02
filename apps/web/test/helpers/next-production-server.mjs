import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitUntilReady(baseUrl, child, output) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Next.js exited before becoming ready.\n${output.join('')}`,
      );
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) return;
    } catch {
      // The server has not bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Timed out waiting for Next.js at ${baseUrl}.\n${output.join('')}`,
  );
}

async function startMockApi() {
  const server = createServer((request, response) => {
    const seatsMatch = request.url?.match(/^\/api\/v1\/trips\/(\d+)\/seats$/);
    if (seatsMatch) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          data: [
            {
              tripSeatId: 901,
              seatNumber: 'Z99',
              position: 'Tầng dưới',
              status: 'TRONG',
            },
            {
              tripSeatId: 902,
              seatNumber: 'Z98',
              position: 'Tầng dưới',
              status: 'DA_DAT',
            },
            {
              tripSeatId: 903,
              seatNumber: 'B04',
              position: 'Tầng trên',
              status: 'TRONG',
            },
          ],
        }),
      );
      return;
    }

    const match = request.url?.match(/^\/api\/v1\/trips\/(\d+)$/);
    if (!match) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Not found',
        }),
      );
      return;
    }

    const id = Number(match[1]);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        data: {
          id,
          code: `CX-${id}`,
          status: 'CHUA_KHOI_HANH',
          busCompany: {
            id: 3,
            name: 'Nhà xe kiểm thử',
            logo: null,
            rating: null,
            reviewsCount: null,
          },
          route: {
            id: 8,
            code: 'SG-DL',
            origin: 'TP.HCM',
            destination: 'Đà Lạt',
            distance: null,
            durationMinutes: null,
          },
          departureTime: '2026-10-15T22:00:00.000Z',
          arrivalTime: null,
          vehicle: {
            id: 4,
            typeId: 2,
            type: 'Giường nằm',
            licensePlate: '51B-12345',
            capacity: 34,
            amenities: [],
          },
          price: 300000,
          availableSeats: 12,
        },
      }),
    );
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}/api/v1`,
    stop: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

export async function startNextProductionServer() {
  const mockApi = await startMockApi();
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextBin = require.resolve('next/dist/bin/next');
  const output = [];
  const child = spawn(
    process.execPath,
    [nextBin, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: webRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VEXGO_API_URL: mockApi.baseUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (chunk) => output.push(chunk.toString()));
  child.stderr.on('data', (chunk) => output.push(chunk.toString()));

  await waitUntilReady(baseUrl, child, output);

  return {
    baseUrl,
    async stop() {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await new Promise((resolve) => {
          child.once('exit', resolve);
          setTimeout(() => {
            if (child.exitCode === null) child.kill('SIGKILL');
            resolve();
          }, 5_000).unref();
        });
      }
      await mockApi.stop();
    },
  };
}
