import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const apps = ['admin', 'web'];
const envProbe =
  'process.stdout.write(JSON.stringify({port: process.env.PORT, apiUrl: process.env.NEXT_PUBLIC_API_URL}))';

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'vexgo-next-start-'));
  const temporaryRoot = resolve(tmpdir());

  assert.ok(
    directory.startsWith(`${temporaryRoot}${sep}`),
    'test directory must be a direct child of the OS temporary directory',
  );

  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

for (const app of apps) {
  test(`${app} production start allows an absent .env.local`, async () => {
    const packageJson = JSON.parse(
      await readFile(join(repositoryRoot, 'apps', app, 'package.json'), 'utf8'),
    );

    assert.match(packageJson.scripts.start, /--env-file-if-exists=\.env\.local/);
    assert.doesNotMatch(packageJson.scripts.start, /--env-file=\.env\.local/);
    assert.match(packageJson.scripts.dev, /--env-file=\.env\.local/);
  });
}

test('optional env-file loading preserves variables injected by the deployment', async () => {
  await withTemporaryDirectory((cwd) => {
    const result = spawnSync(
      process.execPath,
      ['--env-file-if-exists=.env.local', '-e', envProbe],
      {
        cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          PORT: '4510',
          NEXT_PUBLIC_API_URL: 'https://deployment.example/api/v1',
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      port: '4510',
      apiUrl: 'https://deployment.example/api/v1',
    });
  });
});

test('optional env-file loading still reads local settings when the file exists', async () => {
  await withTemporaryDirectory(async (cwd) => {
    await writeFile(
      join(cwd, '.env.local'),
      'PORT=3000\nNEXT_PUBLIC_API_URL=http://localhost:4000/api/v1\n',
      'utf8',
    );

    const inheritedEnvironment = { ...process.env, PORT: '4511' };
    delete inheritedEnvironment.NEXT_PUBLIC_API_URL;

    const result = spawnSync(
      process.execPath,
      ['--env-file-if-exists=.env.local', '-e', envProbe],
      { cwd, encoding: 'utf8', env: inheritedEnvironment },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      port: '4511',
      apiUrl: 'http://localhost:4000/api/v1',
    });
  });
});
