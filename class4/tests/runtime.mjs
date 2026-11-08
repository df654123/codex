// SPDX-License-Identifier: GPL-3.0-or-later
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(process.argv[2] || 'upstream');
const here = path.dirname(fileURLToPath(import.meta.url));
const commands = [
  ['node', ['--test', path.join(here, 'live-refresh.mjs')]],
  ['node', ['--experimental-strip-types', '--test', path.join(here, 'score-integrity.mjs')]],
  ['python3', [path.join(here, 'http-access.py')]],
];
for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    stdio: 'inherit', env: { ...process.env, CLASSFIRE_ROOT: root, CLASSFIRE_RUNTIME: root },
  });
  if (result.error || result.status !== 0) {
    console.error('Required integration check failed:', command);
    process.exit(result.status || 1);
  }
}
console.log('6 refresh, 6 SQLite and 5 HTTP checks passed. Not production acceptance.');
