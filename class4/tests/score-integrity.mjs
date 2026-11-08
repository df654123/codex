// SPDX-License-Identifier: GPL-3.0-or-later
// Real SQLite/Drizzle regression tests; no production records or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(process.env.CLASSFIRE_ROOT || process.argv[2] || '.');
const require = createRequire(path.join(root, 'package.json'));
const { createClient } = await import(pathToFileURL(path.join(root, 'node_modules/@libsql/client/lib-esm/node.js')).href);
const { drizzle } = await import(pathToFileURL(path.join(root, 'node_modules/drizzle-orm/libsql/index.js')).href);
globalThis.createError = o => Object.assign(new Error(o.message), o);
const source = await fs.readFile(path.join(root, 'server/utils/score-service.ts'), 'utf8');
const adapted = source.replace("'../database/schema.school'", "'../database/schema.school.ts'");
const temporaryModule = path.join(root, 'server/utils/.class4-score-service-test.mts');
await fs.writeFile(temporaryModule, adapted);
const { applyScoreChanges, revokeScoreLog } = await import(pathToFileURL(temporaryModule).href);
process.on('exit', () => { try { require('node:fs').unlinkSync(temporaryModule); } catch {} });
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'class4-score-'));
  const client = createClient({ url: 'file:' + path.join(dir, 'test.db') });
  t.after(async () => { client.close(); await fs.rm(dir, { recursive: true, force: true }); });
  await client.executeMultiple(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, class_id INTEGER, username TEXT NOT NULL,
      password_hash TEXT NOT NULL, actual_name TEXT, email TEXT, email_bound_at TEXT,
      disabled INTEGER NOT NULL DEFAULT 0, must_change_password INTEGER NOT NULL DEFAULT 0,
      total_score INTEGER NOT NULL DEFAULT 0, add_score INTEGER NOT NULL DEFAULT 0,
      deduct_score INTEGER NOT NULL DEFAULT 0, score_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE score_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      username TEXT NOT NULL, score_change INTEGER NOT NULL,
      description TEXT, created_at TEXT NOT NULL
    );
    INSERT INTO users(id,class_id,username,password_hash,actual_name,created_at)
      VALUES (1,1,'test01','unused','测试甲','2026-11-08'),
             (2,2,'test02','unused','测试乙','2026-11-08');
  `);
  const db = drizzle(client);
  const scope = { isClassAllowed: id => id === 1, isGradeAllowed: () => true };
  const state = async () => ({
    users: (await client.execute('SELECT id,total_score,add_score,deduct_score,score_count FROM users ORDER BY id')).rows.map(r => ({...r})),
    logs: (await client.execute('SELECT * FROM score_logs ORDER BY id')).rows.map(r => ({...r})),
  });
  return { client, db, scope, state };
}
test('successful score and aggregates are consistent', async t => {
  const f = await fixture(t);
  const r = await applyScoreChanges({ ...f, items: [{ userId: 1, scoreChange: 3 }] });
  assert.equal(r.successCount, 1);
  const s = await f.state();
  assert.equal(s.logs.length, 1);
  assert.equal(s.users[0].total_score, 3);
  assert.equal(s.users[0].score_count, 1);
});
test('failed aggregate update rolls back inserted log', async t => {
  const f = await fixture(t);
  await f.client.execute("CREATE TRIGGER break_update BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT, 'forced storage failure'); END");
  await assert.rejects(applyScoreChanges({ ...f, items: [{ userId: 1, scoreChange: 3 }] }));
  const s = await f.state();
  assert.equal(s.logs.length, 0, 'no orphan score log may survive a failed total update');
  assert.equal(s.users[0].total_score, 0);
});
test('failed revoke rolls back log deletion', async t => {
  const f = await fixture(t);
  const r = await applyScoreChanges({ ...f, items: [{ userId: 1, scoreChange: 3 }] });
  await f.client.execute("CREATE TRIGGER break_update BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT, 'forced storage failure'); END");
  await assert.rejects(revokeScoreLog({ ...f, logId: r.details[0].logId }));
  const s = await f.state();
  assert.equal(s.logs.length, 1, 'failed revoke must retain original log');
  assert.equal(s.users[0].total_score, 3);
});
test('cross-class write is rejected without changes', async t => {
  const f = await fixture(t);
  const r = await applyScoreChanges({ ...f, items: [{ userId: 2, scoreChange: 3 }] });
  assert.equal(r.failedCount, 1);
  const s = await f.state();
  assert.equal(s.logs.length, 0);
  assert.equal(s.users[1].total_score, 0);
});
test('revoke applies once; second revoke cannot change aggregates', async t => {
  const f = await fixture(t);
  const r = await applyScoreChanges({ ...f, items: [{ userId: 1, scoreChange: -2 }] });
  await revokeScoreLog({ ...f, logId: r.details[0].logId });
  await assert.rejects(revokeScoreLog({ ...f, logId: r.details[0].logId }));
  const s = await f.state();
  assert.equal(s.logs.length, 0);
  assert.equal(s.users[0].total_score, 0);
  assert.equal(s.users[0].deduct_score, 0);
  assert.equal(s.users[0].score_count, 0);
});
test('out of range and non-integer values do not create records', async t => {
  const f = await fixture(t);
  const r = await applyScoreChanges({ ...f, items: [
    { userId: 1, scoreChange: 10001 },
    { userId: 1, scoreChange: 0.5 },
    { userId: 1, scoreChange: Infinity },
  ] });
  assert.equal(r.failedCount, 3);
  assert.equal((await f.state()).logs.length, 0);
});
