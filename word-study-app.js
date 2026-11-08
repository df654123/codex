(function () {
  'use strict';
  const C = window.WordStudyCore, D = window.ENGLISH_CURRICULUM, curriculum = window.Curriculum;
  const root = document.getElementById('wordStudyRoot');
  if (!root || !C || !D?.units?.length || !curriculum) return;
  const $ = id => document.getElementById(id), esc = escapeHtml;
  const storageKey = 'englishWordStudyV35', books = new Map(D.books.map(book => [book.id, book]));
  const units = new Map(D.units.map(unit => [unit.id, unit]));
  const dirtyKeys = new Set();
  let state, mode = 'cards', filter = 'all', round = null, saveFailed = false, notice = '', saving = false;
  try { state = C.normalize(JSON.parse(safeStore.get(storageKey, '{}'))); }
  catch { state = C.normalize({}); notice = '已跳过损坏的本地记录，可以继续学习。'; }
  const unit = () => curriculum.unit();
  const button = (label, action, value = '', css = 'outline-btn', disabled = false) => `<button type="button" class="${css}" data-ws-action="${action}" data-value="${esc(value)}"${disabled ? ' disabled' : ''}>${esc(label)}</button>`;
  const selected = (value, current) => value === current ? ' selected' : '';
  function startRound() {
    const current = unit();
    round = {unitId:current.id,queue:C.filterWords(state,current,filter).filter(i=>mode!=='spelling'||!current.vocabulary[i].recognitionOnly),cursor:0,card:null};
    if (round.queue.length) round.card = C.createCard(current.id, round.queue[0]);
  }
  function syncUnit() {
    if (!round || round.unitId !== unit().id) { startRound(); notice = ''; return true; }
    if (round.card && (round.card.rated || round.card.checked) && !state.records[C.key(round.card.unitId,round.card.index)]) {
      round.card = C.createCard(round.card.unitId,round.card.index);
      return true;
    }
    return false;
  }
  function preserveInput() {
    if (round?.unitId === unit().id && mode === 'spelling' && round.card && !round.card.checked) {
      const input = $('wsSpellingInput');
      if (input) round.card.input = input.value;
    }
  }
  function latestStored(fallback) {
    for (const raw of [safeStore.get(storageKey,null),fallback]) {
      if (typeof raw !== 'string') continue;
      try { const incoming = JSON.parse(raw); C.validate(incoming); return C.normalize(incoming); }
      catch {}
    }
    return fallback === null ? C.normalize({}) : null;
  }
  function mergeDirty(latest) {
    for (const recordKey of dirtyKeys) if (state.records[recordKey]) latest.records[recordKey] = {...state.records[recordKey]};
    return latest;
  }
  function save(recordKey) {
    dirtyKeys.add(recordKey);
    if (window.restoringSnapshot) return false;
    state = mergeDirty(latestStored() || C.normalize(state));
    saving = true;
    const ok = safeStore.set(storageKey, JSON.stringify(state));
    saving = false;
    saveFailed = !ok;
    if (ok) dirtyKeys.clear();
    return ok;
  }
  function saveReview(card) {
    const ok = save(C.key(card.unitId, card.index));
    if (ok && typeof curriculum.markWordReviewed === 'function') curriculum.markWordReviewed(unit().vocabulary[card.index].word, card.unitId);
  }
  function renderStats(current) {
    const stats = C.stats(state,current);
    return `<section class="ws-stats" aria-label="本单元学习统计"><article><span>记忆卡已自评</span><strong>${stats.reviewed} <small>/ ${stats.total}</small></strong></article><article><span>生词与待加强</span><strong>${stats.needsWork}<small> 个</small></strong></article><article><span>今天待复习</span><strong>${stats.due}<small> 个</small></strong></article><article><span>拼写答对 / 已检查</span><strong>${stats.spellingCorrect} <small>/ ${stats.spellingCorrect+stats.spellingWrong}</small></strong></article></section>
      <div class="ws-progress-copy"><span>本单元记忆卡自评覆盖 ${stats.reviewed}/${stats.total}</span><strong>${stats.percent}%</strong></div><div class="ws-progress" role="progressbar" aria-label="本单元记忆卡自评覆盖" aria-valuemin="0" aria-valuemax="${stats.total}" aria-valuenow="${stats.reviewed}"><span style="width:${stats.percent}%"></span></div><p class="ws-fine-print">口头自评：记住 ${stats.oralRemembered} 次 · 再学 ${stats.oralHard} 次；拼写：答对 ${stats.spellingCorrect} 次 · 待订正 ${stats.spellingWrong} 次。活动记录与拼写分开统计，不代表已经掌握。</p>`;
  }
  function renderCard(current) {
    const card = round.card;
    if (!round.queue.length) return `<section class="ws-empty"><span class="ws-empty-symbol" aria-hidden="true">✓</span><h3>${filter === 'due' ? '本单元暂时没有到期词' : '当前筛选没有待学词'}</h3><p>可以切回全部词，继续练习本单元的教材词汇与主题拓展。</p>${button('查看全部词','filter','all','primary-btn')}</section>`;
    if (!card) return `<section class="ws-empty"><span class="ws-empty-symbol" aria-hidden="true">✓</span><h3>这一轮练完了</h3><p>已走完本轮 ${round.queue.length} 个词。换一种方式再练，或按到期计划回来复习。</p><div class="ws-actions">${button('再练一轮','restart','','primary-btn')}${button(mode === 'cards' ? '试试拼写' : '回到记忆卡','mode',mode === 'cards' ? 'spelling' : 'cards')}${filter !== 'all' ? button('查看全部词','filter','all') : ''}</div></section>`;
    const word = current.vocabulary[card.index], record = state.records[C.key(current.id,card.index)];
    const eyebrow = `<div class="ws-card-top"><span class="cx-kicker">${mode === 'cards' ? 'RECALL THE MEANING' : 'SPELL FROM MEMORY'}</span><span>本轮 ${round.cursor+1} / ${round.queue.length}</span></div>`;
    if (mode === 'cards') return `<article class="ws-card">${eyebrow}<div class="ws-prompt"><p>先回想词义，再揭晓核对</p><h3 id="wsWordTitle" lang="en" tabindex="-1">${esc(word.word)}</h3><span class="cx-kicker">${word.category === 'in_text_expression' ? '课内复现' : word.category === 'extension' ? '站内拓展' : word.category === 'textbook_phrase' ? '参照词表·短语' : word.category === 'textbook_word' ? '参照词表·单词' : '站内精选'}</span>${button('▶ 朗读单词','audio','','ws-audio')}</div>
      ${card.revealed ? `<div class="ws-answer" aria-live="polite"><p class="ws-meaning">${esc(word.partOfSpeech||'')} ${esc(word.meaning)}</p><p lang="en">${esc(word.example)}</p>${button('▶ 朗读例句','example-audio','','ws-audio')}</div>` : '<div class="ws-answer-placeholder"><span aria-hidden="true">?</span><p>词义和例句已收起，给自己几秒回想。</p></div>'}
      <div class="ws-card-footer">${card.rated ? `<p class="ws-feedback" role="status">${card.rating === 'remembered' ? '已记下本次“记住”自评' : '已加入待加强词'} · 下次复习：${record.due}${record.due === C.dayKey() ? '（今天）' : ''}</p><div class="ws-actions">${button(round.cursor+1 === round.queue.length ? '下一词 · 完成本轮' : '下一词 →','next','','primary-btn')}</div>` : `<div class="ws-actions">${!card.revealed ? button('揭晓词义与例句','reveal','','primary-btn') : ''}${button('再学一次','hard','','outline-btn',!card.revealed)}${button('我记住了','remembered','','primary-btn',!card.revealed)}</div><p class="ws-fine-print">${card.revealed ? '如实自评，选择后再进入下一词。' : '请先揭晓，再评价本次记忆情况。'}</p>`}</div></article>`;
    return `<article class="ws-card">${eyebrow}<div class="ws-prompt ws-spelling-prompt"><p>根据中文，写出本单元的英语单词或短语</p><h3 id="wsWordTitle" tabindex="-1">${esc(word.meaning)}</h3></div><form id="wsSpellingForm" class="ws-spelling-form"><label for="wsSpellingInput">我的拼写</label><input id="wsSpellingInput" name="spelling" type="text" value="${esc(card.input)}" maxlength="160" lang="en" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="输入英文后检查"${card.checked ? ' readonly' : ''} aria-describedby="wsSpellingHint"><p id="wsSpellingHint" class="ws-fine-print">忽略首尾空格、大小写、连续空格及 sth/sb 的缩写点；部分英美拼写变体会说明。每题只记录第一次有效检查。</p>${!card.checked ? button('检查拼写','check','','primary-btn') : ''}</form>
      ${card.checked ? `<div class="ws-answer ws-spelling-result ${card.result.correct ? 'is-correct' : 'needs-work'}" role="status"><strong>${card.result.correct ? '✓ 本次拼写正确' : '再看一遍，留意字母顺序'}</strong><p>你的拼写：<span lang="en">${esc(card.result.input)}</span></p><p>${esc(card.result.note||'')}</p><p>正确写法：<strong lang="en">${esc(word.word)}</strong> · ${esc(word.partOfSpeech||'')} ${esc(word.meaning)}</p><p lang="en">${esc(word.example)}</p>${button('▶ 朗读单词与例句','example-audio','','ws-audio')}<p class="ws-fine-print">拼写结果已单独记录；复习日期由记忆卡自评安排。</p></div><div class="ws-card-footer ws-actions">${button(round.cursor+1 === round.queue.length ? '下一词 · 完成本轮' : '下一词 →','next','','primary-btn')}</div>` : ''}</article>`;
  }
  function render() {
    const current = unit();
    if (!current || !units.has(current.id)) return;
    const currentBook = books.get(current.bookId);
    root.innerHTML = `<header class="ws-heading"><div><span class="cx-kicker">A LITTLE PRACTICE, EVERY DAY</span><h2>背单词</h2><p>先回想，再核对。让每次复习都有迹可循。</p></div><span class="ws-scope">${esc(currentBook.shortLabel || currentBook.title)} · Unit ${current.number}</span></header>
      <div class="ws-selectors"><label for="wsBook">选择教材<select id="wsBook">${D.books.map(book => `<option value="${esc(book.id)}"${selected(book.id,current.bookId)}>${esc(book.shortLabel || book.title)}</option>`).join('')}</select></label><label class="ws-unit-select" for="wsUnit">选择单元<select id="wsUnit">${D.units.filter(other => other.bookId === current.bookId).map(other => `<option value="${esc(other.id)}"${selected(other.id,current.id)}>Unit ${other.number} · ${esc(other.title)}</option>`).join('')}</select></label></div>
      <div class="ws-unit-copy"><p>${esc(current.vocabularyAlignment?.note||'本单元仍为站内精选，非完整教材词表。')}</p><h3>Unit ${current.number} · ${esc(current.title)}</h3><p>${current.vocabularyAlignment ? `参照词表新词/短语 ${current.vocabulary.filter(w=>w.category==='textbook_word'||w.category==='textbook_phrase').length} 项 · 复现/拓展 ${current.vocabulary.filter(w=>['extension','in_text_expression'].includes(w.category)).length} 项` : `本站精选 ${current.vocabulary.length} 项 · 教材完整词表尚待核验`}。音标未核验的词条不会显示猜测音标。</p></div>${renderStats(current)}
      <div class="ws-toolbar"><div class="ws-segments ws-modes" aria-label="选择背词方式">${[['cards','记忆卡'],['spelling','中文提示拼写']].map(([value,label]) => `<button type="button" data-ws-action="mode" data-value="${value}" aria-pressed="${mode === value}">${label}</button>`).join('')}</div><div class="ws-segments ws-filters" aria-label="筛选单词">${[['all','全部词'],['new','生词 / 待加强'],['due','到期复习']].map(([value,label]) => `<button type="button" data-ws-action="filter" data-value="${value}" aria-pressed="${filter === value}">${label}</button>`).join('')}</div></div>
      ${saveFailed ? '<p class="ws-warning" role="alert">背词记录暂未保存到浏览器，已保留在当前页面内存中。请保留此页，使用整站“备份记录”导出后再关闭。</p>' : ''}${notice ? `<p class="ws-notice" role="status">${esc(notice)}</p>` : ''}<div id="wsCardArea">${renderCard(current)}</div>
      <details class="ws-plan"><summary>复习计划与记录说明</summary><p>复习日期按北京时间计算。初次接触的词和“再学一次”的词当天待复习；初次记住后安排在 1 天后复习，到期后记住再进阶，依次安排在 3、7、14 天后复习，之后保持 14 天间隔。未到期的再次“记住”只增加练习次数，保留原复习日期。“再学一次”会重新从当天开始。</p><p>“生词 / 待加强”包括尚未记过、只练过拼写，或最近自评需要再学的词。拼写检查单独计数，不会自动提升记忆级别。</p><p>朗读使用当前设备的英语语音。设备没有可用语音时，可揭晓后对照英文和例句自行朗读。学习记录保存在当前浏览器，清除浏览器数据前请先备份。</p></details>`;
  }
  function refresh() { preserveInput(); syncUnit(); render(); }
  function next() {
    if (!round.card || (mode === 'cards' ? !round.card.rated : !round.card.checked)) return;
    round.cursor++;
    round.card = round.cursor < round.queue.length ? C.createCard(round.unitId,round.queue[round.cursor]) : null;
    notice = ''; render();
    $('wsWordTitle')?.focus({preventScroll:true});
  }
  function check() {
    if (syncUnit()) { render(); return; }
    if (mode !== 'spelling' || !round.card || round.card.checked) return;
    const input = $('wsSpellingInput')?.value || '';
    const result = C.checkSpelling(state,round.card,input,unit().vocabulary[round.card.index].word);
    if (!result) { notice = '先写出你的拼写，再检查答案。'; render(); $('wsSpellingInput')?.focus(); return; }
    notice = ''; saveReview(round.card); render();
  }
  function audio(example) {
    if (!round.card) return;
    const word = unit().vocabulary[round.card.index];
    if (example && !(mode === 'cards' ? round.card.revealed : round.card.checked)) return;
    if (typeof selectedVoice === 'function' && !selectedVoice()) {
      notice = '当前设备没有可用英语语音。请核对答案后，对照英文与例句自行朗读。';
    } else if (typeof speakText === 'function') {
      speakText(word.word + (example ? '. ' + word.example : ''));
      notice = '已请求设备英语朗读；如未听到声音，可对照答案文本自行朗读。';
    } else notice = '当前设备无法朗读。请核对答案后，对照英文与例句自行朗读。';
    preserveInput(); render();
  }
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-ws-action]');
    if (!target || !root.contains(target)) return;
    const action = target.dataset.wsAction, value = target.dataset.value;
    if (syncUnit()) { render(); return; }
    if (action === 'mode' && ['cards','spelling'].includes(value)) { if (mode !== value) {mode = value; startRound(); notice = ''; } render(); return; }
    if (action === 'filter' && ['all','new','due'].includes(value)) { filter = value; startRound(); notice = ''; render(); return; }
    if (action === 'restart') { startRound(); notice = ''; render(); return; }
    if (action === 'next') { next(); return; }
    if (action === 'check') { check(); return; }
    if (action === 'audio' || action === 'example-audio') { audio(action === 'example-audio'); return; }
    if (mode !== 'cards' || !round.card) return;
    if (action === 'reveal') { C.reveal(round.card); render(); }
    if (['remembered','hard'].includes(action) && C.evaluate(state,round.card,action)) { saveReview(round.card); notice = ''; render(); }
  });
  root.addEventListener('change', event => {
    const target = event.target;
    if (target.id === 'wsBook') {
      const nextUnit = D.units.find(other => other.bookId === target.value);
      if (nextUnit) curriculum.selectUnit(nextUnit.id);
      refresh();
    }
    if (target.id === 'wsUnit' && units.has(target.value)) { curriculum.selectUnit(target.value); refresh(); }
  });
  root.addEventListener('input', event => {
    if (event.target.id === 'wsSpellingInput' && round?.card && !round.card.checked && round.unitId === unit().id) round.card.input = event.target.value;
  });
  root.addEventListener('submit', event => {
    if (event.target.id !== 'wsSpellingForm') return;
    event.preventDefault(); check();
  });
  window.addEventListener('storage', event => {
    if (window.restoringSnapshot || saving) return;
    if (event.key === 'englishCurriculumStateV30') { refresh(); return; }
    if (event.key !== storageKey) return;
    try {
      const nextState = latestStored(event.newValue);
      if (!nextState) throw Error('Invalid word-study storage');
      state = mergeDirty(nextState);
      notice = dirtyKeys.size ? '其他页面的记录已更新；本页尚未保存的背词记录仍保留，请及时备份。' : '已同步其他页面的背词记录。';
      refresh();
    } catch { notice = '其他页面传来的背词记录不完整，已保留本页记录。'; render(); }
  });
  const previousOpenView = window.openView;
  if (typeof previousOpenView === 'function') window.openView = function (...args) {
    const result = previousOpenView.apply(this,args);
    if (args[0] === 'words') refresh();
    return result;
  };
  window.addEventListener('focus', () => { if ($('words')?.classList.contains('active')) refresh(); });
  window.WordStudy = {snapshot:() => C.normalize(state),refresh};
  syncUnit(); render();
})();
