// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.env.CLASSFIRE_ROOT || '.');
const modulePath = path.join(root, 'app/utils/class4-live-refresh.mjs');
let createScopedReader;
try { ({ createScopedReader } = await import(pathToFileURL(modulePath).href)); } catch {}
function setup(overrides = {}) {
  assert.equal(typeof createScopedReader, 'function', 'Missing scoped live-refresh coordinator');
  let scope = { key: 'teacherA-school1-class4' };
  const writes = [], states = [];
  const reader = createScopedReader({
    getScope: () => scope,
    isVisible: () => true,
    read: async () => ({ students: ['synthetic'] }),
    write: result => writes.push(result),
    onState: state => states.push(state),
    ...overrides,
  });
  return { reader, writes, states, changeScope: next => { scope = next; } };
}
test('successful read updates records without touching form data', async () => {
  const f = setup();
  await f.reader.refresh();
  assert.deepEqual(f.writes, [{ students: ['synthetic'] }]);
  assert.equal(f.states.at(-1).ok, true);
});
test('late response cannot cross changed teacher or class scope', async () => {
  let release;
  const f = setup({ read: () => new Promise(resolve => { release = resolve; }) });
  const pending = f.reader.refresh();
  f.changeScope({ key: 'teacherB-school2-class1' });
  release({ students: ['private-to-A'] });
  await pending;
  assert.equal(f.writes.length, 0);
});
test('overlapping refresh does not duplicate requests', async () => {
  let release, calls = 0;
  const f = setup({ read: () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  const pending = f.reader.refresh();
  await f.reader.refresh();
  assert.equal(calls, 1);
  release({ students: [] });
  await pending;
});
test('background tab does not poll', async () => {
  let calls = 0;
  const f = setup({ isVisible: () => false, read: async () => { calls++; return {}; } });
  await f.reader.refresh();
  assert.equal(calls, 0);
});
test('permission denial suspends repeated automatic calls', async () => {
  let calls = 0;
  const f = setup({ read: async () => { calls++; throw { status: 403 }; } });
  await f.reader.refresh();
  await f.reader.refresh();
  assert.equal(calls, 1);
  assert.equal(f.states.at(-1).status, 403);
  assert.equal(f.writes.length, 0);
});
test('stopped reader cannot apply an in-flight response', async () => {
  let release;
  const f = setup({ read: () => new Promise(resolve => { release = resolve; }) });
  const pending = f.reader.refresh();
  f.reader.stop(); release({ students: ['old'] });
  await pending;
  assert.equal(f.writes.length, 0);
});
