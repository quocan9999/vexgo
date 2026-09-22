import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'build', '--workspace=@vexgo/api'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
await import('./seed.mjs');
