import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Synthetic SQLite tests; no student or production data.
const root = path.resolve(process.env.CLASSFIRE_ROOT || process.argv[2] || 'upstream');
const { createClient } = await import(pathToFileURL(path.join(root, 'node_modules/@libsql/client/lib-esm/node.js')).href);
const { dumpDb, restoreDb } = await import(pathToFileURL(path.join(root, 'server/utils/backup.ts')).href);
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'class4-safe-restore-'));
  const client = createClient({url: 'file:' + path.join(dir, 'test.db')});
  t.after(async () => { client.close(); await fs.rm(dir, {recursive:true,force:true}); });
  await client.execute('CREATE TABLE students(id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
  await client.execute("INSERT INTO students VALUES(1,'Synthetic original')");
  return client;
}
test('valid restore replaces changed synthetic data', async t => {
  const client = await fixture(t);
  const backup = await dumpDb(client);
  await client.execute("UPDATE students SET name='Mutated' WHERE id=1");
  await restoreDb(client, backup);
  assert.equal((await client.execute('SELECT name FROM students WHERE id=1')).rows[0].name,'Synthetic original');
});
test('invalid row triggers full rollback without losing original', async t => {
  const client = await fixture(t);
  await assert.rejects(restoreDb(client,[{table:'students',columns:['id','name'],rows:[{id:2,name:'New'},{id:3,name:null}]}]));
  const data = (await client.execute('SELECT id,name FROM students')).rows;
  assert.equal(data.length,1);
  assert.equal(data[0].id,1);
  assert.equal(data[0].name,'Synthetic original');
});
test('untrusted table name rejected before any deletion', async t => {
  const client = await fixture(t);
  await assert.rejects(restoreDb(client,[{table:'students; DROP TABLE students',columns:['id'],rows:[]}]));
  assert.equal((await client.execute('SELECT COUNT(*) AS n FROM students')).rows[0].n,1);
});
