(function () {
  'use strict';
  const C = window.LiteracyCore, D = window.ENGLISH_LITERACY, curriculum = window.Curriculum;
  const $ = id => document.getElementById(id), host = $('literacyRoot');
  if (!C || !D?.tasks || !curriculum || !host) return;
  const esc = escapeHtml, key = 'englishLiteracyV40', copy = value => JSON.parse(JSON.stringify(value));
  const tasks = new Map(D.tasks.map(t => [t.unitId,t]));
  const units = new Map((window.ENGLISH_CURRICULUM?.units || []).map(u => [u.id,u]));
  const books = new Map((window.ENGLISH_CURRICULUM?.books || []).map(b => [b.id,b]));
  const labels = {evidence:'文本证据与推断',expression:'面向受众的表达作品',comparison:'文化／观点比较',reflection:'调整与学习反思'};
  const dirty = new Set();
  let state = C.createState(), renderedId = '', saving = false, notice = '', loadNotice = '';
  let recoveryRaw = null, exportedRecovery = null;
  const edits = {}, conflicts = new Map();
  function protectOriginal(raw) {
    if (recoveryRaw !== raw) { recoveryRaw = raw; exportedRecovery = null; }
    loadNotice = '旧记录无法完整读取，已暂停自动写入以保留原始内容。';
  }
  const initialRaw = safeStore.get(key,null);
  if (initialRaw !== null) {
    try {
      const parsed = JSON.parse(initialRaw);
      try { C.validate(parsed); } catch { protectOriginal(initialRaw); }
      state = C.normalize(parsed);
    } catch { protectOriginal(initialRaw); }
  }
  let baseline = copy(state);
  const current = () => curriculum.unit();
  const task = () => tasks.get(current()?.id);
  const now = () => new Date().toISOString();
  const date = iso => iso ? new Date(iso).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京时间）' : '尚未提交';
  const unitLabel = u => `${books.get(u?.bookId)?.title || u?.bookId || ''} · Unit ${u?.number || ''} · ${u?.title || ''}`;
  const draft = id => state.records[id] || {fields:Object.fromEntries(C.fields.map(k=>[k,''])),checks:Object.fromEntries(C.fields.map(k=>[k,false])),submittedAt:null,lastSubmission:null};
  const button = (text,action,value='',css='outline-btn') => `<button type="button" class="${css}" data-lit-action="${action}" data-unit-id="${esc(renderedId)}" data-value="${esc(value)}">${esc(text)}</button>`;

  function markEdit(id,field) {
    if (!edits[id]) edits[id] = {};
    if (!edits[id][field]) edits[id][field] = {text:draft(id).fields[field],check:draft(id).checks[field]};
  }
  function trackPending() {
    dirty.clear();
    for (const [id,r] of Object.entries(state.records)) if (JSON.stringify(r)!==JSON.stringify(baseline.records[id])) dirty.add(id);
    for (const conflict of conflicts.values()) dirty.add(conflict.unitId);
  }
  function receiveSaved(fallback,previousRaw) {
    // A competing write may have removed a unit carried by event.newValue.
    // Merge the event first, then the currently stored snapshot, instead of
    // choosing one. The same baseline is used for both three-way merges so the
    // second read cannot erase a contribution recovered from the event.
    const observed = safeStore.get(key,null), before = copy(baseline);
    let eventBefore = before;
    if (previousRaw === null) eventBefore = C.createState();
    else if (typeof previousRaw === 'string') {
      try { const parsed=JSON.parse(previousRaw);C.validate(parsed);eventBefore=C.normalize(parsed); } catch { /* An unreadable old event cannot be a trustworthy baseline. */ }
    }
    for (const [raw,isStored] of [[fallback,false],[observed,true]]) {
      if (raw === null || raw === undefined) { if (isStored) baseline=C.createState(); continue; }
      let incoming;
      try {
        incoming = JSON.parse(raw); C.validate(incoming);
        const merged = C.reconcile(state,incoming,isStored?before:eventBefore,edits);
        state = merged.state;
        for (const conflict of merged.conflicts) {
          const name=conflict.unitId+':'+conflict.field;
          // Reconcile already excludes unchanged baseline fields. A genuine
          // further edit, including a clear, must update the offered variant.
          conflicts.set(name,conflict);
        }
        if (isStored) baseline = C.normalize(incoming);
        if (isStored && recoveryRaw !== null && raw !== recoveryRaw) {
          recoveryRaw = null; exportedRecovery = null; loadNotice = '';
        }
      } catch {
        if (isStored) {
          protectOriginal(raw);
          if (incoming) state = C.merge(state,C.normalize(incoming),dirty);
        }
      }
    }
    trackPending();
  }
  function persist(approvedOriginal = null) {
    if (window.restoringSnapshot || saving) return false;
    receiveSaved();
    if (recoveryRaw !== null && approvedOriginal !== recoveryRaw) { syncStatus(); return false; }
    if (conflicts.size) { syncStatus(); return false; }
    if (!dirty.size && recoveryRaw === null) { syncStatus(); return true; }
    saving = true;
    let ok = false;
    try { ok = safeStore.set(key,JSON.stringify(state)) === true; } catch { ok = false; }
    finally { saving = false; }
    if (ok) { baseline=copy(state); dirty.clear(); loadNotice = ''; recoveryRaw = null; exportedRecovery = null; }
    syncStatus();
    return ok;
  }
  function snapshotHTML(r) {
    if (!r.lastSubmission) return '<p class="lit-muted">提交后，这里会保留最近一次提交的内容，供下一次修改时对照。</p>';
    return `<details class="lit-snapshot"><summary>查看最近提交快照 · ${esc(date(r.lastSubmission.submittedAt))}</summary>${C.fields.map(field => `<h4>${labels[field]}</h4><p class="lit-preserve">${esc(r.lastSubmission.fields[field])}</p>`).join('')}<p class="lit-muted">这是当时的作品与自查快照，没有自动评分。</p></details>`;
  }
  function archiveHTML() {
    const records = Object.entries(state.records).filter(([,r]) => r.lastSubmission || C.fields.some(k => r.fields[k].trim())).sort((a,b) => b[1].updatedAt.localeCompare(a[1].updatedAt));
    if (!records.length) return '<p class="lit-muted">写下第一条依据或一句表达，就会在这里留下本单元草稿。</p>';
    return `<ul class="lit-archive-list">${records.map(([id,r]) => `<li><div><strong>${esc(tasks.get(id)?.title || id)}</strong><small>${esc(unitLabel(units.get(id)))}</small><span class="lit-record-state">${dirty.has(id)?'本页有未保存内容':r.submittedAt?'已提交作品记录':r.lastSubmission?'修订中':'草稿'} · ${esc(date(r.submittedAt || r.updatedAt))}</span></div>${button(id===renderedId?'当前单元':'继续这个单元','open-unit',id)}</li>`).join('')}</ul>`;
  }
  function recoveryHTML() {
    if (recoveryRaw === null) return '';
    return `<div class="lit-recovery"><h4>先保护原始记录</h4><p>有些旧内容无法完整读取，自动保存已暂停。当前草稿仍可导出。请先下载原始记录并确认文件已保留，再选择恢复保存。</p><p>恢复后会写入可恢复记录和本页草稿；无法读取的部分仍保留在原始下载文件中。</p><div class="lit-actions">${button('下载原始记录','export-recovery')}${button('恢复保存当前可用记录','recover')}</div>${exportedRecovery===recoveryRaw?'<p>已发起原始文件下载，请确认文件已保留后再恢复。</p>':''}</div>`;
  }
  function conflictHTML() {
    if (!conflicts.size) return '';
    return `<div class="lit-recovery"><h4>同一栏出现了两份修改</h4><p>两版内容都已保留在本页，自动保存已暂停。请对照后选择；也可先导出本单元记录，保存两版文字。关闭页面会丢失尚未保存的本页版本。</p>${[...conflicts.entries()].map(([name,c])=>`<section><h4>${esc(tasks.get(c.unitId)?.title || c.unitId)} · ${labels[c.field]}</h4><p><strong>本页内容</strong></p><p class="lit-preserve">${esc(draft(c.unitId).fields[c.field]) || '（空白）'}</p><p><strong>另一页内容</strong></p><p class="lit-preserve">${esc(c.remote) || '（空白）'}</p><div class="lit-actions">${button('保留本页内容，替换另一版','conflict-local',name)}${button('采用另一页内容，替换本页','conflict-remote',name)}</div></section>`).join('')}</div>`;
  }
  function syncStatus() {
    const r = draft(renderedId), saveStatus = $('lit-save-status'), submission = $('lit-submission-status');
    if (saveStatus) {
      saveStatus.textContent = recoveryRaw !== null ? '旧记录无法完整读取，原始内容已保护：暂未保存新输入，请先下载原始记录，并导出当前草稿。' : conflicts.size ? '同一栏有两份修改冲突，暂未保存；请对照并选择，或先导出本单元记录保留两版。' : dirty.size ? '暂未保存：内容仍在本页，请重试保存或立即导出；关闭页面可能丢失。' : loadNotice || (state.records[renderedId] ? '草稿已自动保存到当前浏览器。' : '输入后自动保存到当前浏览器；建议定期导出。');
      saveStatus.dataset.state = dirty.size || recoveryRaw !== null || conflicts.size ? 'error' : 'saved';
    }
    if (submission) submission.textContent = dirty.size && r.submittedAt ? '这份作品仅在当前页面，尚未成功保存。' : r.submittedAt ? `作品记录提交时间：${date(r.submittedAt)}` : r.lastSubmission ? '内容或自查已修改，请重新检查后提交；上一版仍可对照。' : '完成四项内容与自查后，可提交一份作品记录。';
    const message = $('lit-message'); if (message) message.textContent = notice;
    const count = $('lit-word-count'); if (count) count.textContent = `${C.wordCount(r.fields.expression)} 个英文词 · 建议仅作安排参考，可以从短句开始。`;
    for (const field of C.fields) {
      const check = $('lit-check-'+field); if (check) check.checked = r.checks[field];
      const input = $('lit-'+field); if (input && input.value !== r.fields[field]) input.value = r.fields[field];
    }
    const previous = $('lit-previous'); if (previous) previous.innerHTML = snapshotHTML(r);
    const archive = $('lit-archive'); if (archive) archive.innerHTML = archiveHTML();
    const recovery = $('lit-recovery'); if (recovery) recovery.innerHTML = recoveryHTML()+conflictHTML();
  }
  function inputHTML(field,prompt,help='') {
    const value = draft(renderedId).fields[field];
    return `<div class="lit-field"><label for="lit-${field}">${labels[field]}</label><p id="lit-help-${field}" class="lit-field-prompt">${esc(prompt)}</p>${help}<textarea id="lit-${field}" rows="${field==='expression'?7:4}" maxlength="20000" data-lit-field="${field}" data-unit-id="${esc(renderedId)}" aria-describedby="lit-help-${field}" placeholder="可以先写简短句子，再补充理由与细节。">${esc(value)}</textarea></div>`;
  }
  function refresh() {
    if (window.restoringSnapshot) return;
    const u = current(), t = task();
    if (!u || !t) { host.innerHTML = '<div class="lit-panel"><h2>学以致用</h2><p>当前单元尚未配置主题任务，请从课程目录选择已开放单元。</p></div>'; return; }
    receiveSaved(); renderedId = u.id;
    const r = draft(u.id);
    host.innerHTML = `<div class="lit-shell">
      <header class="lit-heading"><div><span class="lit-kicker">USE ENGLISH · LEAVE A TRACE</span><h2>学以致用</h2><p>${esc(unitLabel(u))}</p></div><span class="lit-evidence-note">活动与自查记录，不是素养测评分数</span></header>
      <section class="lit-brief"><span class="lit-kicker">本单元主题任务</span><h3>${esc(t.title)}</h3><p><strong>说给谁听／写给谁看：</strong>${esc(t.audience)}</p><p>${esc(t.task)}</p><div class="lit-evidence-tags" aria-label="这项任务可以留下的学习证据"><span>语言能力 · 表达作品</span><span>文化意识 · 尊重差异</span><span>思维品质 · 依据与理由</span><span>学习能力 · 调整与反思</span></div><p class="lit-muted">这些标签说明练习方向；保存作品不等于已达到某个素养等级。</p></section>
      <div class="lit-layout"><div class="lit-work">
      <section class="lit-panel" aria-labelledby="lit-stage-one"><div class="lit-stage"><span>01</span><div><small>学习理解</small><h3 id="lit-stage-one">读懂材料，找到依据</h3></div></div><p>回到原创短文《${esc(u.reading?.title || '')}》，区分作者写明的内容与你的推断。</p><div class="lit-actions">${button('打开本单元阅读','reading')}${button('打开本单元词汇','words')}</div>${inputHTML('evidence',t.readingPrompt)}</section>
      <section class="lit-panel" aria-labelledby="lit-stage-two"><div class="lit-stage"><span>02</span><div><small>应用实践</small><h3 id="lit-stage-two">为具体的人表达</h3></div></div><p class="lit-word-hints">可尝试用 <strong>${t.targetWords.map(esc).join(' / ')}</strong>，也可以按意思调整或替换；不按关键词出现次数打分。</p><p class="lit-muted">本年级可参考约 ${t.wordRange.min}—${t.wordRange.max} 个英文词，起步短句也可以保存和提交，没有词数硬门槛。</p><details class="lit-starters"><summary>需要起步句架？</summary>${t.starters.map(s=>`<p lang="en">${esc(s)}</p>`).join('')}<p class="lit-muted">请按你的想法补充或修改，不必照抄。</p></details>${inputHTML('expression',t.task)}<p id="lit-word-count" class="lit-muted"></p>${button('参考本单元写作活动','writing')}${inputHTML('comparison',t.culturePrompt)}</section>
      <section class="lit-panel" aria-labelledby="lit-stage-three"><div class="lit-stage"><span>03</span><div><small>迁移创新</small><h3 id="lit-stage-three">条件变了，怎样调整？</h3></div></div><p class="lit-transfer">${esc(t.transferPrompt)}</p>${inputHTML('reflection',t.reflectionPrompt,'<p class="lit-muted">在这一栏同时写：调整后的做法与理由，以及你准备改进的学习方法。可先用中文整理，再尝试英文。</p>')}</section>
      <section class="lit-panel lit-submit" aria-labelledby="lit-check-title"><h3 id="lit-check-title">对照作品，逐项自查</h3><p>自查是你对本次作品的检查，不是系统评分。修改相关内容后，需要重新确认。</p><div class="lit-checks">${t.rubric.map(item=>`<label><input type="checkbox" id="lit-check-${item.id}" data-lit-check="${item.id}" data-unit-id="${esc(renderedId)}"${r.checks[item.id]?' checked':''}><span>${esc(item.label)}</span></label>`).join('')}</div><div class="lit-actions">${button('提交作品记录','submit','','primary-btn')}${button('导出本单元记录','export')}${button('重试保存','retry')}</div><p id="lit-save-status" class="lit-save-status" role="status" aria-live="polite"></p><p id="lit-submission-status" class="lit-muted"></p><p id="lit-message" class="lit-message" role="status" aria-live="polite"></p><div id="lit-recovery">${recoveryHTML()}</div><div id="lit-previous">${snapshotHTML(r)}</div></section>
      </div><aside class="lit-panel lit-portfolio" aria-labelledby="lit-archive-title"><span class="lit-kicker">MY PRACTICE PORTFOLIO</span><h3 id="lit-archive-title">我的实践档案</h3><p class="lit-muted">各单元草稿、提交与修订保存在当前浏览器。可随时回来继续，也可导出给老师或家人讨论。</p><div id="lit-archive">${archiveHTML()}</div></aside></div>
      <p class="lit-source-note">站内原创主题拓展任务，依据现有单元材料设计；不替代正版教材。参考《义务教育英语课程标准（2022年版）》的主题学习、学习活动观与形成性评价建议。</p></div>`;
    syncStatus();
  }
  function validTarget(target) {
    if (window.restoringSnapshot) return false;
    if (!target?.dataset || target.dataset.unitId !== renderedId || current()?.id !== renderedId) { refresh(); return false; }
    return true;
  }
  function exportCurrent() {
    const u = current(), t = task(), r = draft(u.id);
    const lines = ['# 学以致用 · '+t.title,'',unitLabel(u),'','活动与自查记录，不是素养测评分数。',
      '受众：'+t.audience,'任务：'+t.task,'建议词汇：'+t.targetWords.join(' / ')+'（可自行调整）',
      '记录状态：'+(dirty.has(u.id)?'本页有未保存内容':r.submittedAt?'已提交作品记录':'草稿／修订中'),
      '提交时间：'+date(r.submittedAt),''];
    for (const field of C.fields) lines.push('## '+labels[field],r.fields[field] || '（尚未填写）','');
    lines.push('## 本次自查',...t.rubric.map(item=>`- [${r.checks[item.id]?'x':' '}] ${item.label}`),'');
    if (r.lastSubmission) { lines.push('## 最近一次提交快照',date(r.lastSubmission.submittedAt),''); for (const field of C.fields) lines.push('### '+labels[field],r.lastSubmission.fields[field],''); }
    for (const c of conflicts.values()) if (c.unitId===u.id) lines.push('## 尚未解决的两版修改 · '+labels[c.field],'### 本页内容',r.fields[c.field],'### 另一页内容',c.remote,'');
    lines.push('自查反映学习者对作品的检查；此记录不自动评定核心素养或语言能力等级。');
    downloadText(`学以致用_${u.id}_${new Date().toISOString().slice(0,10)}.md`,lines.join('\n'),'text/markdown;charset=utf-8');
  }
  host.addEventListener('input',event => {
    const target = event.target, field = target?.dataset?.litField;
    if (!C.fields.includes(field) || !validTarget(target)) return;
    try {
      if (draft(renderedId).fields[field] !== target.value) markEdit(renderedId,field);
      if (C.updateField(state,renderedId,field,target.value,now())) { dirty.add(renderedId); notice = ''; persist(); }
      syncStatus();
    } catch (error) { notice = error.message; syncStatus(); }
  });
  host.addEventListener('change',event => {
    const target = event.target, field = target?.dataset?.litCheck;
    if (!C.fields.includes(field) || !validTarget(target)) return;
    if (draft(renderedId).checks[field] !== !!target.checked) markEdit(renderedId,field);
    if (C.setCheck(state,renderedId,field,!!target.checked,now())) { dirty.add(renderedId); notice = ''; persist(); }
    syncStatus();
  });
  host.addEventListener('click',event => {
    const target = event.target?.closest?.('[data-lit-action]');
    if (!target || !host.contains(target) || !validTarget(target)) return;
    event.preventDefault();
    const action = target.dataset.litAction;
    if (action === 'open-unit') { open(target.dataset.value); return; }
    if (action === 'reading') { curriculum.openActivity({kind:'reading'}); return; }
    if (action === 'words') { curriculum.openWords(); return; }
    if (action === 'writing') { curriculum.openExercise('writing'); return; }
    if (action === 'export') { exportCurrent(); return; }
    if (action === 'conflict-local' || action === 'conflict-remote') {
      const name=target.dataset.value, conflict=conflicts.get(name);
      if (!conflict) return;
      const id=conflict.unitId, field=conflict.field, chosen=action==='conflict-local'?draft(id).fields[field]:conflict.remote;
      if (!edits[id]) edits[id]={};
      // Explicit resolution makes the remote variant the new comparison base.
      edits[id][field]={text:conflict.remote,check:conflict.remoteCheck};
      C.updateField(state,id,field,chosen,now()); C.setCheck(state,id,field,false,now());
      state.records[id].submittedAt=null; conflicts.delete(name); dirty.add(id);
      notice=persist()?'所选内容已保存，请重新自查。':'所选内容已保留；请先解决其余冲突或导出记录。';
      syncStatus(); return;
    }
    if (action === 'export-recovery') {
      receiveSaved();
      if (recoveryRaw !== null) {
        try {
          downloadText(`学以致用_原始记录_${new Date().toISOString().slice(0,10)}.txt`,recoveryRaw,'text/plain;charset=utf-8');
          exportedRecovery = recoveryRaw; notice = '已发起原始记录下载。请确认文件已保留，再选择恢复保存。';
        } catch { notice = '原始记录下载未能启动，仍保留在浏览器中；请勿清除网站数据。'; }
      }
      syncStatus(); return;
    }
    if (action === 'recover') {
      receiveSaved();
      if (recoveryRaw !== null && exportedRecovery !== recoveryRaw) notice = '请先下载并保留原始记录，再恢复保存。';
      else notice = persist(recoveryRaw) ? '可恢复记录与当前草稿已保存。原始下载文件请继续保留。' : '恢复保存未成功，原始记录仍受保护，请导出当前草稿。';
      syncStatus(); return;
    }
    if (action === 'retry') { notice = persist() ? '当前记录已保存。' : '保存仍未成功，请先导出本单元记录。'; syncStatus(); return; }
    if (action === 'submit') {
      try {
        receiveSaved();
        if (conflicts.size) throw Error('请先处理两份修改的冲突，再对照当前作品自查和提交。');
        C.submit(state,renderedId,now()); dirty.add(renderedId);
        notice = persist() ? '作品与自查已记录，可以继续修改并对照上一版。' : '作品尚未保存成功，请保留本页并导出记录。';
      } catch (error) { notice = error.message; }
      syncStatus();
    }
  });
  function open(id) {
    if (id && tasks.has(id) && current()?.id !== id) curriculum.selectUnit(id);
    window.openView('literacy'); refresh();
  }
  window.Literacy = {
    snapshot:()=>copy(state),refresh,open,
    conflictEvidence:()=>[...conflicts.values()].map(c=>({unitId:c.unitId,field:c.field,local:draft(c.unitId).fields[c.field],remote:c.remote,base:c.base}))
  };
  document.addEventListener('curriculum:updated',refresh);
  window.addEventListener('storage',event => {
    if (event.key !== key || saving || window.restoringSnapshot) return;
    receiveSaved(event.newValue,event.oldValue);
    if (dirty.size && !conflicts.size && recoveryRaw === null) persist();
    refresh();
  });
  const previousOpenView = window.openView;
  if (typeof previousOpenView === 'function') window.openView = function (...args) {
    const result = previousOpenView.apply(this,args);
    if (args[0] === 'literacy') refresh();
    return result;
  };
  refresh();
})();
