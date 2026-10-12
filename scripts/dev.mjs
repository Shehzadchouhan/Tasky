import { spawn } from 'node:child_process';

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error('Run this script with "npm run dev" so npm can locate its CLI.');
  process.exit(1);
}

let stopping = false;
const processes = [];

const stop = (exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;

  for (const child of processes) {
    if (child && child.exitCode === null) child.kill();
  }
};

for (const directory of ['server', 'client']) {
  const child = spawn(
    process.execPath,
    [npmCli, '--prefix', directory, 'run', 'dev'],
    { stdio: 'inherit' }
  );
  processes.push(child);

  child.on('error', (error) => {
    console.error(`[${directory}] Failed to start:`, error);
    stop(1);
  });

  child.on('close', (code) => {
    if (!stopping) {
      if (code !== 0) {
        console.error(`[${directory}] Dev server exited with code ${code ?? 'unknown'}.`);
      }
      stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
