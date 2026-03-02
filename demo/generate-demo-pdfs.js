import { spawn } from 'child_process';

const child = spawn('node', ['src/utils/generateDemoPdfs.js'], {
  cwd: new URL('../backend/', import.meta.url).pathname,
  stdio: 'inherit'
});

child.on('exit', (code) => process.exit(code || 0));
