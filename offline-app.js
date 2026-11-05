/* Prepare offline only after learning startup; no registration in portable HTML. */
(function () {
  'use strict';
  if (document.querySelector('meta[name="distribution"][content="offline"]')) return;
  const $ = id => document.getElementById(id);
  const status = $('offlineStatus'), detail = $('offlineDetail'), saveButton = $('offlineSave'), updateButton = $('offlineUpdate');
  if (!status || !saveButton) return;
  const scope = new URL('./', location.href);
  const workerURL = new URL('sw.js', scope).href;
  const supported = !!window.isSecureContext && 'serviceWorker' in navigator && 'MessageChannel' in window;
  // The worker allows four minutes for a complete, progressing core download.
  const SAVE_TIMEOUT = 270000, VERIFY_TIMEOUT = 45000;
  let registration = null, busy = false, current = null, updateNote = '', requestNumber = 0, installPrompt = null, retryNeeded = false;
  let startupChecked = false, learningReady = !!window.LearningStartupReady, automaticAttempted = false;
  const observed = new WeakSet();

  function render() {
    saveButton.disabled = busy || !supported;
    updateButton.disabled = busy;
    updateButton.hidden = !registration;
    saveButton.textContent = busy ? '正在核对与保存…' : retryNeeded ? '重新保存离线课程' : current && current.ready ? '核对离线课程' : '保存课程到本机';
    const shortcut = $('offlineShortcut');
    if (shortcut) shortcut.textContent = busy ? '正在准备离线…' : status.dataset.state === 'ready' ? '已可离线学习' : retryNeeded ? '离线保存需重试' : '离线学习';
    $('offlineNetwork').textContent = navigator.onLine === false ? '设备当前未联网；已保存的课程仍可学习。' : '课程、阅读和练习在本机运行，不调用 GPT。';
  }

  function deadline(operation, timeout, errorText) {
    let timer;
    return Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(errorText)), timeout);
    })]).finally(() => clearTimeout(timer));
  }

  function message(worker, type, timeout) {
    return new Promise((resolve, reject) => {
      if (!worker) {reject(Error('离线课程尚未准备'));return;}
      const channel = new MessageChannel();
      const timer = setTimeout(() => {channel.port1.close();reject(Error('核对超时，请重试'));}, timeout || 10000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);channel.port1.close();
        if (event.data && event.data.ok) resolve(event.data.status);
        else reject(Error(event.data && event.data.error || '保存未完成，请重试'));
      };
      try {worker.postMessage({type}, [channel.port2]);}
      catch (error) {clearTimeout(timer);channel.port1.close();reject(error);}
    });
  }

  function owned(worker) {return worker && worker.scriptURL === workerURL;}

  async function refresh() {
    const number = ++requestNumber;
    const controller = navigator.serviceWorker.controller;
    const target = owned(controller) ? controller : registration && owned(registration.active) ? registration.active : null;
    let saved = null, waiting = null;
    try {
      if (target) saved = await message(target, 'OFFLINE_STATUS');
      if (registration && owned(registration.waiting)) waiting = await message(registration.waiting, 'OFFLINE_STATUS');
    } catch (error) {if (number !== requestNumber) return;throw error;}
    if (number !== requestNumber) return;
    current = saved;
    if (saved && saved.ready && owned(controller) && navigator.serviceWorker.controller === controller) {
      status.textContent = '已保存，可离线学习';
      status.dataset.state = 'ready';
      detail.textContent = 'V' + saved.version + ' · ' + (saved.bytes / 1048576).toFixed(1) + ' MB · 六册课程与全部书架导读已齐备。请用当前浏览器或当前主屏幕入口打开。';
      if (saved.downloads && saved.downloads.total) detail.textContent += saved.downloads.ready
        ? '独立学习文件已缓存，可以离线下载。'
        : '独立学习文件尚未缓存，首次下载需联网；不影响本站离线学习。';
    } else if (saved && saved.ready) {
      status.textContent = '课程已保存，入口待确认';
      status.dataset.state = 'pending';
      detail.textContent = '结束当前学习后，关闭学习站再打开，确认显示“已保存，可离线学习”后再断网。';
    } else {
      status.textContent = saved ? '离线课程需要重新保存' : '尚未保存离线课程';
      status.dataset.state = 'pending';
      detail.textContent = '课程加载完成后会自动准备完整离线课程，也可以点击下方按钮保存；确认完成后可以在当前入口断网学习。';
    }
    $('offlineUpdateNote').textContent = waiting && waiting.ready
      ? '新版 V' + waiting.version + ' 已准备。结束学习并保存记录后，关闭所有学习站窗口，再重新打开。'
      : updateNote;
    render();
  }

  function observe(reg) {
    if (observed.has(reg)) return;
    observed.add(reg);
    const watch = worker => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'redundant') updateNote = '本次保存或更新未完成；已保存的旧课程可以继续使用。';
        if (['installed', 'activated', 'redundant'].includes(worker.state)) refresh().catch(showError);
      });
    };
    watch(reg.installing);
    reg.addEventListener('updatefound', () => {watch(reg.installing);});
  }

  function waitForInstall(reg) {
    const worker = reg.installing;
    if (!worker) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = () => {
        if (['installed', 'activated'].includes(worker.state)) {clearTimeout(timer);worker.removeEventListener('statechange', finish);resolve();}
        else if (worker.state === 'redundant') {clearTimeout(timer);worker.removeEventListener('statechange', finish);reject(Error('课程没有保存完整，请联网后重试'));}
      };
      const timer = setTimeout(() => {worker.removeEventListener('statechange', finish);reject(Error('保存尚未完成，请稍后核对离线状态'));}, SAVE_TIMEOUT);
      worker.addEventListener('statechange', finish);finish();
    });
  }

  function showError(error) {
    retryNeeded = true;
    updateNote = error && error.message || '保存未完成，请联网后重试。';
    $('offlineUpdateNote').textContent = updateNote;
    const previouslySaved = current && current.ready;
    current = null;
    status.textContent = previouslySaved ? '离线状态待确认' : '离线保存尚未完成';
    status.dataset.state = 'pending';
    detail.textContent = '本次未能确认离线课程是否完整。当前页面可以继续学习；请重新核对，确认“已保存，可离线学习”后再断网，或使用下方独立学习包。';
    render();
  }

  async function prepare(automatic = false) {
    if (busy || !supported) return;
    busy = true;retryNeeded = false;updateNote = '';status.textContent = '正在保存完整课程…';status.dataset.state = 'pending';render();
    detail.textContent = '弱网保存可能需要几分钟，请保持本页打开。核心课程保存完成即可离线学习，独立下载文件会在需要时另行获取。';
    try {
      const controller = navigator.serviceWorker.controller;
      const target = owned(controller) ? controller : registration && owned(registration.active) ? registration.active : null;
      if (!automatic && target) {
        // A manual recheck reads and hashes this device's cached bytes first;
        // complete offline courses never require a network registration to verify.
        const available = await message(target, 'OFFLINE_STATUS');
        if (available.canVerify) {
          const checked = await message(target, 'OFFLINE_VERIFY', VERIFY_TIMEOUT);
          updateNote = checked.ready ? '本机课程内容核对完成。' : '发现缺失或损坏的课程资源，请联网重新保存。';
          await refresh();
          if (checked.ready || navigator.onLine === false) {
            if (checked.ready && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
            return;
          }
        } else {
          updateNote = '当前离线入口使用旧版，尚未进行内容核对；请联网后检查课程更新。';
          await refresh();
          if (navigator.onLine === false) return;
        }
      }
      registration = await deadline(navigator.serviceWorker.register(workerURL, {scope: scope.href, updateViaCache: 'none'}), 15000, '离线入口连接超时，请点击重新保存');
      observe(registration);
      await waitForInstall(registration);
      if (owned(registration.active) && !registration.waiting) {
        const saved = await message(registration.active, 'OFFLINE_STATUS');
        if (!saved.ready) await message(registration.active, 'OFFLINE_REPAIR', SAVE_TIMEOUT);
      }
      await refresh();
      if (!automatic && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (error) {showError(error);}
    finally {busy = false;render();}
  }

  async function checkUpdate() {
    if (busy || !registration) return;
    busy = true;updateNote = '正在检查课程更新…';$('offlineUpdateNote').textContent = updateNote;render();
    try {
      await deadline(registration.update(), 15000, '检查更新超时，请稍后重试');await waitForInstall(registration);
      updateNote = '已检查更新。';await refresh().catch(showError);
    } catch (_) {updateNote = '暂时无法检查更新。已保存的离线课程仍可使用，联网后再试。';$('offlineUpdateNote').textContent = updateNote;}
    finally {busy = false;render();}
  }

  function prepareAutomatically() {
    if (!startupChecked || !learningReady || automaticAttempted || busy || navigator.onLine === false || (current && current.ready)) return;
    automaticAttempted = true;
    return prepare(true);
  }

  saveButton.addEventListener('click', () => prepare(false));
  updateButton.addEventListener('click', checkUpdate);
  ['online', 'offline'].forEach(type => window.addEventListener(type, () => {render();return prepareAutomatically();}));
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || navigator.onLine !== false) return;
    let url;try {url = new URL(anchor.href, location.href);} catch (_) {return;}
    if (url.protocol.startsWith('http') && url.origin !== location.origin) {
      event.preventDefault();showToast('这个站外资源需要联网；本站的导读与练习可以继续学习。');
    }
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();installPrompt = event;$('offlineInstall').hidden = false;
  });
  $('offlineInstall').addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;installPrompt = null;$('offlineInstall').hidden = true;
    try {await prompt.prompt();} catch (_) {}
  });
  window.addEventListener('appinstalled', () => {$('offlineInstall').hidden = true;});
  if (!supported) {
    status.textContent = '当前浏览器暂不支持保存离线入口';
    detail.textContent = '仍可直接学习。手机可换用支持的 HTTPS 浏览器入口；电脑可使用下方独立学习文件。学校局域网可使用完整包。';
    render();return;
  }
  window.addEventListener('learning:ready', () => {learningReady = true;return prepareAutomatically();});
  navigator.serviceWorker.addEventListener('controllerchange', () => {refresh().catch(showError);});
  navigator.serviceWorker.getRegistration(scope.href).then(reg => {
    if (reg && [reg.active, reg.waiting, reg.installing].some(owned)) {registration = reg;observe(reg);}
    return refresh();
  }).catch(showError).finally(() => {startupChecked = true;return prepareAutomatically();});
  render();
})();
