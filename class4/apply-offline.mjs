// Deploy-safe patcher for the score outbox and offline fallback.
import fs from 'node:fs/promises';
import path from 'node:path';
export async function applyOffline(root) {
  for (const name of ['app/utils/class4-offline-queue.mjs', 'public/offline.html']) {
    const content = await fs.readFile(new URL('./overrides/' + name, import.meta.url), 'utf8');
    const destination = path.join(root, name);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content);
  }
  const nuxtFile = path.join(root, 'nuxt.config.ts');
  let nuxt = await fs.readFile(nuxtFile, 'utf8');
  if (nuxt.split('navigateFallback: null').length !== 2)
    throw new Error('PWA navigation baseline changed');
  nuxt = nuxt.replace('navigateFallback: null', "navigateFallback: '/offline.html'");
  await fs.writeFile(nuxtFile, nuxt);
  const file = path.join(root, 'app/pages/admin/scores.vue');
  let source = await fs.readFile(file, 'utf8');
  const once = (from, to) => {
    if (source.split(from).length !== 2) throw new Error('Score offline patch anchor not unique');
    source = source.replace(from, to);
  };
  once("import { createScopedReader } from '~/utils/class4-live-refresh.mjs'",
    "import { createScopedReader } from '~/utils/class4-live-refresh.mjs'\nimport { putPending, listPending, removePending } from '~/utils/class4-offline-queue.mjs'");
  const fragment = await fs.readFile(new URL('./offline-ui-fragment.txt', import.meta.url), 'utf8');
  once('const showTemplateModal = ref(false)', 'const showTemplateModal = ref(false)\n' + fragment);
  once('  submitting.value = true\n  operationResult.value = null\n  try {',
    '  submitting.value = true\n  operationResult.value = null\n  let queuedLocally = false\n  try {');
  once('    const intent = await scoreIntentFor(payload)',
    '    const intent = await scoreIntentFor(payload)\n    const scope = offlineScope()\n    if (offlineConsent.value && scope) {\n      await putPending({ id: intent.operationId, scope, payload })\n      queuedLocally = true\n      offlinePendingCount.value = (await listPending(scope)).length\n    }');
  once('      localStorage.removeItem(intent.storageKey)',
    '      localStorage.removeItem(intent.storageKey)\n      if (queuedLocally) {\n        try { await removePending(intent.operationId) } catch {}\n        offlinePendingCount.value = (await listPending(offlineScope())).length\n      }');
  once("} catch (err) { operationResult.value = { success: false, message: err.data?.message || '操作失败' } }",
    "} catch (err) {\n    operationResult.value = queuedLocally ? { success: false, message: '已存本机，尚未云端确认；联网并登录相同账号后补传。' } : { success: false, message: err?.data?.message || '操作失败，本机未确认保存' }\n  }");
  const title = '<h2 class="text-sm font-bold text-slate-100 mb-4">积分操作</h2>';
  once(title, title + '\n            <label class="block text-xs text-amber-200 mb-3"><input type="checkbox" v-model="offlineConsent" @change="changeOfflineConsent" aria-label="在个人设备开启本机待传暂存" /> 在个人设备开启本机待传暂存（公共设备请勿开启）</label>\n            <p v-if="offlinePendingCount" class="text-xs text-amber-200 mb-3" role="status">本机待传 {{ offlinePendingCount }} 条；尚未确认云端同步</p>\n            <p v-if="offlineStatus" class="text-xs text-slate-300 mb-3">{{ offlineStatus }}</p>\n            <button v-if="offlinePendingCount" class="btn btn-secondary mb-3" @click="flushOfflineScores">立即补传</button>');
  await fs.writeFile(file, source);
}
