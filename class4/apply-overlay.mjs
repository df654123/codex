// SPDX-License-Identifier: GPL-3.0-or-later
// Class4 integration, 2026-11-08. Refuse to patch a different upstream baseline.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prepareLiveChanges } from './apply-live.mjs';
const root = path.resolve(process.argv[2] || 'upstream');
const hashes = {
  'nuxt.config.ts': '3748e33a79d9489fc393d5f486f2266f16d6e04c5b37c169cebe91a0b6fd83f2',
  'server/api/stats/overview.get.ts': 'b45db2b04e1bd61f75dc28df426ecddf7316780f3e5e26d7ebfd604f24df9166',
  'server/utils/auth.ts': 'd0ee6fb85650431fcbcb4673292f7d9a0b28db2e39f64a8e8e7b16e46c5e3ee8',
  'server/utils/score-service.ts': '04e7d1e0f92387600dd2e4551092f9779108202a000432e6e4ded8b9856b69cd',
};
const originals = {};
for (const [name, expected] of Object.entries(hashes)) {
  const bytes = await fs.readFile(path.join(root, name));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) {
    throw new Error(`Baseline mismatch; no files changed: ${name}`);
  }
  originals[name] = bytes.toString('utf8');
}
function once(source, from, to) {
  if (source.split(from).length !== 2) throw new Error('Ambiguous source anchor');
  return source.replace(from, to);
}
const changes = { ...originals, ...await prepareLiveChanges(root) };
changes['nuxt.config.ts'] = once(originals['nuxt.config.ts'],
  "viewport: 'width=500, initial-scale=1'", "viewport: 'width=device-width, initial-scale=1'");
changes['server/utils/auth.ts'] = once(originals['server/utils/auth.ts'],
  '    .where(eq(admins.id, (session.data as any).adminId as number))\n    .get()\n\n  return admin\n}',
  '    .where(eq(admins.id, (session.data as any).adminId as number))\n    .get()\n\n  // Class4 2026-11-08: revocation applies to already-issued sessions.\n  return admin?.disabled === 1 ? null : admin\n}');
const scoreName = 'server/utils/score-service.ts';
let score = originals[scoreName];
const begin = score.indexOf('    const inserted = await db\n');
const end = score.indexOf('\n    successCount++', begin);
if (begin < 0 || end < begin) throw new Error('Score transaction anchors missing');
const block = score.slice(begin, end).trimEnd().replaceAll('await db\n', 'await tx\n');
score = score.slice(0, begin) +
  '    // Class4 2026-11-08: one transaction for ledger and all aggregates.\n' +
  '    const inserted = await db.transaction(async (tx: any) => {\n' +
  block.split('\n').map(line => '  ' + line).join('\n') +
  '\n      return inserted\n    })\n' + score.slice(end);
const revokeBegin = score.indexOf('  const log = await db.select().from(scoreLogs)');
const revokeEnd = score.lastIndexOf('\n}');
if (revokeBegin < 0 || revokeEnd < revokeBegin) throw new Error('Revoke anchors missing');
const revoke = score.slice(revokeBegin, revokeEnd).replaceAll('await db', 'await tx');
score = score.slice(0, revokeBegin) +
  '  // Class4 2026-11-08: deletion and reversal commit together.\n' +
  '  return db.transaction(async (tx: any) => {\n' +
  revoke.split('\n').map(line => '  ' + line).join('\n') +
  '\n  })' + score.slice(revokeEnd);
changes[scoreName] = score;
changes['server/api/stats/overview.get.ts'] = `// SPDX-License-Identifier: GPL-3.0-or-later
// Class4 2026-11-08: statistics use the same class boundary as the roster.
import { useSchoolDb, getSchoolRawClient } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest, resolveSchoolScope } from '../../utils/auth'
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)
  const scope = await resolveSchoolScope(admin, db)
  const allowed = Array.from(scope.classIdSet || [])
  if (!scope.schoolWide && allowed.length === 0)
    return { avgScore: 0, maxScore: 0, minScore: 0, ranking: [] }
  const args = scope.schoolWide ? [] : allowed
  const where = scope.schoolWide ? '' : 'WHERE u.class_id IN (' + allowed.map(() => '?').join(',') + ')'
  const grouped = 'SELECT u.id, u.username, COALESCE(SUM(sl.score_change),0) AS totalScore, '
    + 'COALESCE(SUM(CASE WHEN sl.score_change>0 THEN sl.score_change ELSE 0 END),0) AS addScore, '
    + 'COALESCE(SUM(CASE WHEN sl.score_change<0 THEN sl.score_change ELSE 0 END),0) AS deductScore '
    + 'FROM users u LEFT JOIN score_logs sl ON u.id=sl.user_id ' + where + ' GROUP BY u.id'
  const summary = await client.execute({
    sql: 'SELECT COALESCE(AVG(totalScore),0) AS avgScore, COALESCE(MAX(totalScore),0) AS maxScore, '
      + 'COALESCE(MIN(totalScore),0) AS minScore FROM (' + grouped + ')', args,
  })
  const ranked = await client.execute({ sql: grouped + ' ORDER BY totalScore DESC,u.id ASC LIMIT 20', args })
  const row = summary.rows[0]
  return {
    avgScore: Math.round(Number(row?.avgScore || 0)*10)/10,
    maxScore: Number(row?.maxScore || 0), minScore: Number(row?.minScore || 0),
    ranking: ranked.rows.map(r => ({ id: Number(r.id), username: String(r.username),
      totalScore: Number(r.totalScore), addScore: Number(r.addScore), deductScore: Number(r.deductScore) })),
  }
})
`;
for (const [name, content] of Object.entries(changes)) await fs.writeFile(path.join(root, name), content);
// Apply the source-reviewed authorization and daily-date corrections.
for (const name of ['server/api/admin/export.get.ts','server/api/stats/records.get.ts',
  'server/api/student/logs.get.ts','server/utils/auth.ts']) {
  const content = await fs.readFile(new URL('./overrides/' + name, import.meta.url), 'utf8');
  await fs.writeFile(path.join(root, name), content);
}
// Refuse partial per-database restores and inconsistent deployment configuration.
for (const name of ['server/utils/backup.ts','docker-compose.yml']) {
  const content = await fs.readFile(new URL('./overrides/' + name, import.meta.url), 'utf8');
  await fs.writeFile(path.join(root, name), content);
}
// Class4: stable teacher operations and atomic idempotency receipts.
for (const name of ['server/api/scores/add.post.ts', 'server/utils/teacher-score-intent.ts']) {
  const content = await fs.readFile(new URL('./overrides/' + name, import.meta.url), 'utf8');
  await fs.writeFile(path.join(root, name), content);
}
const scoresPagePath = path.join(root, 'app/pages/admin/scores.vue');
let scoresPage = await fs.readFile(scoresPagePath, 'utf8');
const startMarker = 'async function submitScores() {';
if (scoresPage.split(startMarker).length !== 2) throw new Error('Score UI anchor mismatch');
scoresPage = scoresPage.replace(startMarker, `
async function scoreIntentFor(body: any) {
  const actor = currentUser.value?.id || 'anonymous'
  const school = currentUser.value?.role === 'super_admin' ? filterSchoolId.value : currentUser.value?.schoolId
  const storageKey = 'class4:score-intent:' + actor + ':' + school
  const raw = JSON.stringify(body)
  const encoded = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const fingerprint = [...new Uint8Array(encoded)].map(b => b.toString(16).padStart(2, '0')).join('')
  let previous: any = null
  try { previous = JSON.parse(localStorage.getItem(storageKey) || 'null') } catch {}
  const operationId = previous?.fingerprint === fingerprint ? previous.operationId : crypto.randomUUID()
  localStorage.setItem(storageKey, JSON.stringify({ fingerprint, operationId }))
  return { operationId, storageKey }
}
` + startMarker);
const target = `    const data = await $fetch('/api/scores/add', {
      method: 'POST',
      body: {
        users: selectedUsers.value.map(u => ({
          username: u.username,
          score_change: scoreChange.value,
        })),
        description: description.value,
      },
      query,
    })`;
if(scoresPage.split(target).length!==2)throw new Error('Score submit anchor mismatch');
scoresPage=scoresPage.replace(target,`    const payload = {
      users: selectedUsers.value.map(u => ({
        username: u.username, score_change: scoreChange.value,
      })),
      description: description.value,
    }
    const intent = await scoreIntentFor(payload)
    const data = await $fetch('/api/scores/add', {
      method: 'POST',
      body: { ...payload, operationId: intent.operationId },
      query,
    })`);
const successMarker="    if (data.success) {
      operationResult.value";
if(scoresPage.split(successMarker).length!==2)throw new Error('Score success anchor mismatch');
scoresPage=scoresPage.replace(successMarker,"    if (data.success) {
      localStorage.removeItem(intent.storageKey)
      operationResult.value");
await fs.writeFile(scoresPagePath,scoresPage);
console.log('Applied verified source fixes and scoped live refresh; no business records modified.');
