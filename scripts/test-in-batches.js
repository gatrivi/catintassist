const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BATCH_SIZE = Math.max(1, Number(process.env.CAT_TEST_BATCH_SIZE) || 8);
const extraArgs = process.argv.slice(2);

function findTests(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) findTests(fullPath, found);
    else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) found.push(fullPath);
  }
  return found;
}

const tests = findTests(SRC).sort();
const reactScripts = require.resolve('react-scripts/bin/react-scripts.js');

for (let start = 0; start < tests.length; start += BATCH_SIZE) {
  const batch = tests.slice(start, start + BATCH_SIZE);
  const number = Math.floor(start / BATCH_SIZE) + 1;
  const total = Math.ceil(tests.length / BATCH_SIZE);
  console.log(`\n[tests] batch ${number}/${total} (${batch.length} files)`);
  const result = spawnSync(
    process.execPath,
    [reactScripts, 'test', '--watchAll=false', '--runInBand', '--runTestsByPath', ...batch, ...extraArgs],
    { cwd: ROOT, env: { ...process.env, CI: 'true' }, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`\n[tests] passed ${tests.length} files in fresh-memory batches`);
