import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const workspaceRequire = createRequire(resolve(process.cwd(), 'package.json'));
const nextCliPath = workspaceRequire.resolve('next/dist/bin/next');
const nextProcess = spawn(
  process.execPath,
  [nextCliPath, ...process.argv.slice(2)],
  {
    env: process.env,
    stdio: 'inherit',
  },
);

nextProcess.on('error', (error) => {
  console.error('Không thể khởi động Next.js:', error);
  process.exitCode = 1;
});

nextProcess.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
