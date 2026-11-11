import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtemp,
  writeFile,
  readdir,
  readFile,
  rm,
  mkdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { restoreArgs } from './vexgo-backup.mjs';
import { inside } from './archive.mjs';

const exec = promisify(execFile);
const cli = resolve('scripts/backup/vexgo-backup.mjs');
const shell =
  'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=TCP --host=127.0.0.1 --user=root --batch --raw --skip-column-names "$MYSQL_DATABASE"';

async function sql(container, input) {
  const child = spawn('docker', ['exec', '-i', container, 'sh', '-c', shell], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(stdout.trim())
        : reject(new Error(`fixture SQL failed: ${stderr}`)),
    );
  });
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  return done;
}

async function command(args) {
  const { stdout } = await exec(process.execPath, [cli, ...args], {
    timeout: 180_000,
    windowsHide: true,
  });
  return stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

test(
  'real MySQL: encrypt, restore data/Unicode/FK/view/routine/event, mirror and retain only complete packages',
  {
    skip: process.env.VEXGO_BACKUP_DOCKER_TEST !== '1',
    timeout: 240_000,
  },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'vexgo-backup-docker-'));
    const envFile = join(root, 'fixture.env');
    const key = join(root, 'backup.key');
    const out = join(root, 'backups');
    const mirror = join(root, 'mirror');
    const containers = [];
    t.after(async () => {
      for (const container of containers)
        await exec('docker', ['rm', '--force', '--volumes', container], {
          windowsHide: true,
        });
      assert.ok(inside(tmpdir(), root));
      await rm(root, { recursive: true });
    });
    await writeFile(
      envFile,
      `MYSQL_ROOT_PASSWORD=${randomBytes(32).toString('hex')}\nMYSQL_DATABASE=vexgo_fixture\n`,
      { mode: 0o600 },
    );
    const image = JSON.parse(
      (await exec('docker', ['image', 'inspect', 'mysql:8.4'])).stdout,
    )[0].Id;
    const source = (
      await exec(
        'docker',
        restoreArgs(`vexgo-restore-${randomUUID()}`, image, envFile),
      )
    ).stdout.trim();
    containers.push(source);
    let ready = false;
    for (let i = 0; i < 90; i++) {
      try {
        await sql(source, 'SELECT 1;');
        ready = true;
        break;
      } catch {
        await delay(1000);
      }
    }
    assert.ok(ready, 'fixture MySQL initialized');
    await sql(
      source,
      `
    ALTER DATABASE vexgo_fixture CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE TABLE _prisma_migrations (migration_name VARCHAR(100), checksum VARCHAR(64), finished_at DATETIME, rolled_back_at DATETIME);
    INSERT INTO _prisma_migrations VALUES ('fixture_initial', REPEAT('a',64), '2026-11-03 00:00:00', NULL);
    CREATE TABLE parent (id INT PRIMARY KEY, value VARCHAR(100) CHARACTER SET utf8mb4);
    CREATE TABLE child (id INT PRIMARY KEY, parent_id INT, FOREIGN KEY(parent_id) REFERENCES parent(id));
    INSERT INTO parent VALUES(1,'Đà Lạt 🎒'); INSERT INTO child VALUES(2,1);
    CREATE VIEW parent_view AS SELECT id,value FROM parent;
    CREATE PROCEDURE fixture_count() SELECT COUNT(*) FROM parent;
    CREATE EVENT fixture_event ON SCHEDULE EVERY 1 HOUR DO INSERT INTO parent VALUES(99,'must not execute');
  `,
    );
    await command(['keygen', '--key', key]);
    const backupEvents = await command([
      'backup',
      '--source',
      source,
      '--out',
      out,
      '--key',
      key,
      '--mirror',
      mirror,
      '--keep',
      '1',
    ]);
    const directory = backupEvents.find(
      (event) => event.event === 'BACKUP_VERIFIED',
    ).directory;
    assert.ok(backupEvents.some((event) => event.event === 'MIRROR_VERIFIED'));
    await command([
      'verify',
      '--backup',
      join(mirror, directory.split(/[\\/]/).at(-1)),
      '--key',
      key,
    ]);
    const restoreEvents = await command([
      'restore-test',
      '--backup',
      directory,
      '--key',
      key,
    ]);
    const restored = restoreEvents.find(
      (event) => event.event === 'RESTORE_DATABASE_VERIFIED',
    );
    containers.push(restored.container);
    const report = JSON.parse(await readFile(restored.report, 'utf8'));
    assert.equal(report.tables, 4);
    assert.equal(report.totalRows, 4); // migration + parent + child + view result
    assert.equal(
      await sql(restored.container, 'SELECT value FROM parent;'),
      'Đà Lạt 🎒',
    );
    assert.equal(await sql(restored.container, 'CALL fixture_count();'), '1');
    assert.equal(
      await sql(restored.container, 'SELECT @@event_scheduler;'),
      'OFF',
    );
    assert.equal(
      await sql(restored.container, 'SELECT @@collation_database;'),
      'utf8mb4_unicode_ci',
    );
    await assert.rejects(
      sql(restored.container, 'INSERT INTO child VALUES (3,999);'),
      /fixture SQL failed/,
    );
    assert.equal(
      await sql(source, 'SELECT COUNT(*) FROM parent;'),
      '1',
      'source data unchanged',
    );
    const restoreInfo = JSON.parse(
      (await exec('docker', ['inspect', restored.container])).stdout,
    )[0];
    assert.equal(restoreInfo.HostConfig.NetworkMode, 'none');
    assert.deepEqual(restoreInfo.HostConfig.PortBindings, {});
    const second = await command([
      'backup',
      '--source',
      source,
      '--out',
      out,
      '--key',
      key,
      '--keep',
      '1',
    ]);
    assert.equal(
      second.filter((event) => event.event === 'RETENTION_REMOVED').length,
      1,
    );
    assert.equal((await readdir(out)).length, 1);
    assert.equal(
      (await readdir(mirror)).length,
      1,
      'main retention does not delete the second copy',
    );
    const latestId = (await readdir(out))[0];
    const partial = join(out, `.partial-${latestId}`);
    await mkdir(partial);
    await writeFile(join(out, 'operator-note.txt'), 'must remain');
    const third = await command([
      'backup',
      '--source',
      source,
      '--out',
      out,
      '--key',
      key,
      '--keep',
      '1',
    ]);
    assert.equal(
      third.filter((event) => event.event === 'RETENTION_REMOVED').length,
      1,
    );
    assert.ok(
      (await readdir(out)).includes(`.partial-${latestId}`),
      'partial directories never pruned',
    );
    assert.equal(
      await readFile(join(out, 'operator-note.txt'), 'utf8'),
      'must remain',
    );
    const wrongKey = join(root, 'wrong.key');
    await command(['keygen', '--key', wrongKey]);
    const finalDirectory = third.find(
      (event) => event.event === 'BACKUP_VERIFIED',
    ).directory;
    const containerIds = (await exec('docker', ['ps', '--quiet'])).stdout;
    await assert.rejects(
      command(['restore-test', '--backup', finalDirectory, '--key', wrongKey]),
    );
    assert.equal(
      (await exec('docker', ['ps', '--quiet'])).stdout,
      containerIds,
      'wrong key rejected before creating a restore container',
    );
    const blockedMirror = join(root, 'not-a-directory');
    await writeFile(blockedMirror, 'block mirror');
    await assert.rejects(
      command([
        'backup',
        '--source',
        source,
        '--out',
        out,
        '--key',
        key,
        '--keep',
        '1',
        '--mirror',
        blockedMirror,
      ]),
    );
    assert.equal(
      (await readdir(out)).filter((name) => name.startsWith('vexgo-backup-'))
        .length,
      2,
      'mirror failure preserves both primary copies and skips retention',
    );
  },
);
