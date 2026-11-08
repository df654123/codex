// SPDX-License-Identifier: GPL-3.0-or-later
// Class4 2026-11-08: read-only refresh, bounded retries, immutable identity boundary.
export function createScopedReader({ getScope, read, write, onState, isVisible }) {
  let running = false;
  let stopped = false;
  let suspendedScope = '';
  let nextAttempt = 0;
  let failures = 0;
  let lastScope = '';
  return {
    async refresh() {
      const scope = getScope();
      if (!scope?.key || running || stopped || !isVisible()) return;
      if (lastScope !== scope.key) {
        failures = 0;
        nextAttempt = 0;
        lastScope = scope.key;
      }
      if (suspendedScope === scope.key || Date.now() < nextAttempt) return;
      running = true;
      try {
        const result = await read(scope);
        if (stopped || getScope()?.key !== scope.key) return;
        write(result);
        failures = 0;
        nextAttempt = 0;
        onState({ ok: true, receivedAt: Date.now() });
      } catch (error) {
        if (stopped || getScope()?.key !== scope.key) return;
        const status = Number(error?.response?.status || error?.statusCode || error?.status || 0);
        if ([401, 403, 429].includes(status)) suspendedScope = scope.key;
        failures += 1;
        nextAttempt = Date.now() + Math.min(60000, 5000 * 2 ** Math.min(failures, 4));
        onState({ ok: false, status });
      } finally {
        running = false;
      }
    },
    stop() { stopped = true; },
  };
}
