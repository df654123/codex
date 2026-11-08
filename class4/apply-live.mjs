// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
export async function prepareLiveChanges(root) {
  const name = 'app/pages/admin/scores.vue';
  const bytes = await fs.readFile(path.join(root, name));
  const expected = 'b51eb7a53b4f60734e1372fdcd13965df6ed60ec208b8d6fbebb794236dc2f9a';
  if (createHash('sha256').update(bytes).digest('hex') !== expected)
    throw new Error('Score page baseline mismatch; live refresh not applied');
  const fragment = await fs.readFile(new URL('./live-ui-fragment.txt', import.meta.url), 'utf8');
  const module = await fs.readFile(new URL('./overlay/app/utils/class4-live-refresh.mjs', import.meta.url), 'utf8');
  let source = bytes.toString('utf8');
  function once(from, to) {
    if (source.split(from).length !== 2) throw new Error('Live-refresh anchor mismatch');
    source = source.replace(from, to);
  }
  once("import { formatTime } from '~/utils/format'",
    "import { formatTime } from '~/utils/format'\nimport { createScopedReader } from '~/utils/class4-live-refresh.mjs'");
  once('</script>', fragment + '\n</script>');
  const heading = '<p class="text-sm text-slate-500">单选或多选用户，批量加减分</p>';
  once(heading, heading + '\n          <p class="mt-2 text-xs text-slate-400" role="status">{{ liveMessage }}</p>');
  return { [name]: source, 'app/utils/class4-live-refresh.mjs': module };
}
