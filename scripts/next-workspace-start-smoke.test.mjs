import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  access,
  cp,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const availableApps = ['admin', 'web'];
const requestedApp = process.env.VEXGO_NEXT_START_SMOKE_APP;
const appsToTest = requestedApp ? [requestedApp] : availableApps;

assert.ok(
  appsToTest.every((app) => availableApps.includes(app)),
  `VEXGO_NEXT_START_SMOKE_APP must be one of: ${availableApps.join(', ')}`,
);

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

async function createIsolatedWorkspace(app) {
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), 'vexgo-next-start-smoke-'),
  );
  const sourceApp = join(repositoryRoot, 'apps', app);
  const temporaryApp = join(temporaryRoot, 'apps', app);
  const nextBuild = join(sourceApp, '.next');

  try {
    await readFile(join(nextBuild, 'BUILD_ID'), 'utf8');
    await mkdir(dirname(temporaryApp), { recursive: true });
    await cp(sourceApp, temporaryApp, {
      recursive: true,
      filter(sourcePath) {
        const pathParts = relative(sourceApp, sourcePath)
          .split(sep)
          .map((part) => part.toLowerCase());
        return !pathParts.some(
          (part) =>
            part === '.next' ||
            part === 'node_modules' ||
            part.startsWith('.env'),
        );
      },
    });
    await cp(nextBuild, join(temporaryApp, '.next'), { recursive: true });
    await writeFile(
      join(temporaryRoot, 'package.json'),
      JSON.stringify({ private: true, workspaces: ['apps/*'] }, null, 2),
    );
    await mkdir(join(temporaryRoot, 'scripts'), { recursive: true });
    await copyFile(
      join(repositoryRoot, 'scripts', 'run-next-workspace.mjs'),
      join(temporaryRoot, 'scripts', 'run-next-workspace.mjs'),
    );
    await symlink(
      join(repositoryRoot, 'node_modules'),
      join(temporaryRoot, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    assert.equal(
      await fileExists(join(temporaryApp, '.env.local')),
      false,
      'the isolated app must not contain .env.local',
    );

    return { temporaryRoot, temporaryApp };
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    if (error.code === 'ENOENT' && error.path?.includes('.next')) {
      throw new Error(
        `Build apps/${app} before running the production start smoke test.`,
        { cause: error },
      );
    }
    throw error;
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function findNpmCli() {
  const nodeDirectory = dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(
      nodeDirectory,
      '..',
      'lib',
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js',
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolvedCandidate = resolve(candidate);
    if (await fileExists(resolvedCandidate)) return resolvedCandidate;
  }

  throw new Error(
    'Could not locate npm-cli.js to run the workspace start command.',
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestStatus(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
  await response.body?.cancel();
  return response.status;
}

async function waitUntilReady(url, child, getOutput) {
  const deadline = Date.now() + 90_000;
  let lastStatus;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `npm run start exited before Next.js became ready.\n${getOutput()}`,
      );
    }

    try {
      lastStatus = await requestStatus(url);
      if (lastStatus === 200) return;
    } catch {
      // The production server is still binding its port.
    }

    await delay(250);
  }

  throw new Error(
    `Timed out waiting for HTTP 200 from ${url}; last status: ${lastStatus ?? 'unavailable'}.\n${getOutput()}`,
  );
}

async function waitForPortToClose(url) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    try {
      await requestStatus(url);
    } catch {
      return true;
    }
    await delay(200);
  }

  return false;
}

async function stopWorkspaceProcess(child, closePromise, url) {
  if (child.exitCode === null && child.signalCode === null) {
    if (process.platform === 'win32') {
      const result = spawnSync(
        'taskkill.exe',
        ['/PID', String(child.pid), '/T', '/F'],
        { encoding: 'utf8', windowsHide: true },
      );
      assert.equal(
        result.status,
        0,
        `Could not stop the npm workspace process tree: ${result.stderr}`,
      );
    } else {
      process.kill(-child.pid, 'SIGINT');
    }
  }

  const close = await Promise.race([
    closePromise,
    delay(15_000).then(() => null),
  ]);
  assert.ok(close, 'npm run start process should exit after shutdown');
  assert.equal(
    await waitForPortToClose(url),
    true,
    `the server should stop listening after npm run start exits (${url})`,
  );
  return close;
}

for (const app of appsToTest) {
  test(
    `${app} production npm workspace start serves HTTP without .env.local`,
    { timeout: 120_000 },
    async () => {
      let temporaryRoot;
      try {
        const isolatedWorkspace = await createIsolatedWorkspace(app);
        temporaryRoot = isolatedWorkspace.temporaryRoot;
        const packageJson = JSON.parse(
          await readFile(
            join(isolatedWorkspace.temporaryApp, 'package.json'),
            'utf8',
          ),
        );
        assert.match(
          packageJson.scripts.start,
          /\.\.\/\.\.\/scripts\/run-next-workspace\.mjs\s+start$/,
          'the smoke test must execute the existing Next workspace launcher',
        );

        const port = await reservePort();
        const url = `http://127.0.0.1:${port}/`;
        const output = [];
        const npmCli = await findNpmCli();
        const child = spawn(
          process.execPath,
          [npmCli, 'run', 'start', `--workspace=@vexgo/${app}`],
          {
            cwd: temporaryRoot,
            detached: process.platform !== 'win32',
            env: {
              ...process.env,
              NODE_ENV: 'production',
              NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4002/api/v1',
              NEXT_TELEMETRY_DISABLED: '1',
              PORT: String(port),
            },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          },
        );
        const getOutput = () => output.join('').slice(-16_000);
        child.stdout.on('data', (chunk) => output.push(chunk.toString()));
        child.stderr.on('data', (chunk) => output.push(chunk.toString()));
        const closePromise = new Promise((resolve) => {
          child.once('close', (code, signal) => resolve({ code, signal }));
        });

        try {
          await waitUntilReady(url, child, getOutput);
          assert.equal(await requestStatus(url), 200);
        } finally {
          await stopWorkspaceProcess(child, closePromise, url);
        }
      } finally {
        if (temporaryRoot) {
          await rm(temporaryRoot, { recursive: true, force: true });
        }
      }
    },
  );
}
