import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
const live = process.argv.includes('--live');
if (process.argv.slice(2).some((arg) => arg !== '--live'))
  throw new Error('Only --live is accepted');
if (
  live &&
  (!process.env.CLOUDINARY_API_SECRET ||
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY)
)
  throw new Error('Live configuration required');
const temp = await mkdtemp(join(tmpdir(), 'vexgo-media-test-'));
const envFile = join(temp, 'mysql.env');
const password = randomBytes(32).toString('hex');
let container;

async function run(program, args, options = {}) {
  return (
    await exec(program, args, {
      windowsHide: true,
      timeout: 120_000,
      ...options,
    })
  ).stdout.trim();
}
async function node(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  if (code !== 0) throw new Error('Isolated test command failed');
}
try {
  await writeFile(
    envFile,
    `MYSQL_ROOT_PASSWORD=${password}\nMYSQL_DATABASE=vexgo_media_cloudinary_test\nMYSQL_USER=vexgo_media_test\nMYSQL_PASSWORD=${password}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  if (process.platform === 'win32') {
    const sid = (await run('whoami', ['/user', '/fo', 'csv', '/nh'])).match(
      /S-1-5-[0-9-]+/,
    )?.[0];
    if (!sid) throw new Error('Cannot protect private test config');
    await run('icacls', [envFile, '/inheritance:r', '/grant:r', `*${sid}:(F)`]);
  }
  container = await run('docker', [
    'run',
    '--detach',
    '--name',
    `vexgo-media-test-${randomUUID()}`,
    '--publish',
    '127.0.0.1::3306',
    '--env-file',
    envFile,
    'mysql:8.4',
    '--event-scheduler=OFF',
  ]);
  if (!/^[a-f0-9]{64}$/.test(container))
    throw new Error('Unexpected container identity');
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      await run('docker', [
        'exec',
        container,
        'sh',
        '-c',
        'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=TCP --host=127.0.0.1 --user=root --execute "SELECT 1"',
      ]);
      ready = true;
      break;
    } catch {
      await delay(1000);
    }
  }
  if (!ready) throw new Error('Isolated MySQL startup failed');
  const info = JSON.parse(await run('docker', ['inspect', container]))[0];
  const port = info.NetworkSettings.Ports['3306/tcp'][0].HostPort;
  const url = `mysql://vexgo_media_test:${password}@127.0.0.1:${port}/vexgo_media_cloudinary_test`;
  const env = {
    ...process.env,
    DATABASE_URL: url,
    MIGRATION_URL: url,
    SHADOW_DATABASE_URL: url.replace(
      '/vexgo_media_cloudinary_test',
      '/vexgo_media_shadow_test',
    ),
    MEDIA_TEST_DATABASE_URL: url,
    MEDIA_LIVE_CLOUDINARY: live ? '1' : '0',
    CLOUDINARY_ENVIRONMENT: 'test',
    SMS_PROVIDER: 'console',
  };
  console.log('ISOLATED_MEDIA_DATABASE_CREATED');
  await node(
    [join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    root,
    env,
  );
  await node(
    [
      join(root, 'node_modules/vitest/vitest.mjs'),
      'run',
      'test/integration/media/media-mysql.spec.ts',
    ],
    join(root, 'apps/api'),
    env,
  );
} catch {
  // Do not log exec errors that could contain environment/credentials.
  console.error('ISOLATED_MEDIA_TEST_FAILED');
  process.exitCode = 1;
} finally {
  if (container && /^[a-f0-9]{64}$/.test(container)) {
    await run('docker', ['rm', '--force', '--volumes', container]);
    console.log('ISOLATED_MEDIA_DATABASE_REMOVED');
  }
  await rm(envFile, { force: true });
  await rmdir(temp);
}
