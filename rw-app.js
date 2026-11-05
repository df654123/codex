(function readWriteWorkbook() {
  'use strict';
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const lines = value => Array.isArray(value) ? value : (value == null ? [] : [value]);
  const plain = value => lines(value).join('\n');
  const lineMarkup = value => lines(value).map(v => `<p>${esc(v)}</p>`).join('');
  const words = value => (String(value).match(/[a-z0-9]+(?:['’\-][a-z0-9]+)*/gi) || []).length;
  const bookNames = {'7a':'七年级上册','7b':'七年级下册','8a':'八年级上册','8b':'八年级下册','9a':'九年级上册','9b':'九年级下册'};
  const checks = [
    ['任务','我写清了对象和目的，回应了三个要点。'],
    ['细节','我补充了具体事例、原因或行动。'],
    ['连贯','我安排了段落顺序，句子之间衔接自然。'],
    ['语言','我检查了时态、主谓一致、拼写和标点。']
  ];
  const label = n => String.fromCharCode(65 + n);
  const preferenceKey = 'rwWorkbookPackV1';
  const pending = new Map();
  let selected = '', activeId = '', mode = 'read', mounted = null, invalidId = '';
  try { selected = window.sessionStorage.getItem(preferenceKey) || ''; } catch {}
  const packs = () => Array.isArray(window.RW_PACKS) ? window.RW_PACKS : [];
  const pack = () => packs().find(p => p.id === activeId);
  const store = () => window.RWStore;
  const bookOf = p => p.unitId.split('-')[0];
  const bookTitle = p => bookOf(p) === '9b' ? '九年级下册（旧版主题参考）' : (bookNames[bookOf(p)] || bookOf(p));
  const unitTitle = p => {
    const unit = window.ENGLISH_CURRICULUM?.units?.find(u => u.id === p.unitId);
    return unit ? `Unit ${unit.number} · ${unit.title}` : 'Unit '+p.unitId.split('-u').pop();
  };
  const shortLimit = p => Number.parseInt(p.short.limit,10) || 5;
  const rangeText = w => Array.isArray(w.range) ? w.range.join('–')+' 词' : String(w.range || '');
  function focus(id) {
    const item = el(id);
    if (item) { item.focus({preventScroll:true}); item.scrollIntoView({block:'center',behavior:'instant'}); }
  }
  function choose(id) {
    if (!packs().some(p => p.id === id)) return false;
    if (activeId !== id) mode = 'read';
    selected = id;
    try { window.sessionStorage.setItem(preferenceKey,id); } catch {}
    return true;
  }
  function saveStatus(message, failed) {
    const status = el('rwSaveStatus'), retry = el('rwRetry');
    if (status && status.textContent !== message) status.textContent = message;
    if (retry) retry.hidden = !failed;
  }
  function save(patch) {
    const expected = {...store().get(activeId),...patch};
    let result;
    try { result = store().update(activeId,patch); } catch {}
    if (result?.saved) {
      pending.delete(activeId);
      const merged = syncMergedFields(expected,store().get(activeId));
      saveStatus(merged ? '已保存，另一页的改动也已同步。' : '已保存到本设备',false);
      return merged;
    } else {
      const firstFailure = !pending.has(activeId);
      pending.set(activeId,{patch,message:result?.message});
      const message = result?.message || '未能永久保存，请重试或导出作品。';
      saveStatus(message,true);
      if (firstFailure) window.showToast?.(message);
    }
    return false;
  }
  // A successful write can bring in edits from another tab. Reconcile only the
  // controls whose committed value differs from the local edit. The active
  // editor already shows its input and keeps its selection and undo history.
  function syncMergedFields(expected,actual) {
    const changed = key => Array.isArray(actual[key]) ? actual[key].some((v,i)=>v!==expected[key][i]) : actual[key]!==expected[key];
    function setValue(id,value) { const node=el(id); if (node && node.value!==value) node.value=value; }
    if (mode === 'write') {
      const keys=['plan','draft','revision','note'].filter(changed);
      if (!keys.length && !changed('checks')) return false;
      for (const key of keys) {
        setValue('rw-'+key,actual[key]);
        if (key==='draft'||key==='revision') el('rwCount-'+key).textContent=words(actual[key])+' 个英文词';
      }
      if (changed('draft')||changed('revision')) el('rwCopy').hidden=!actual.draft.trim()||!!actual.revision;
      if (changed('draft')||changed('checks')) checks.forEach((_,i)=>{
        const c=el('rwCheck'+i); if(c.checked!==actual.checks[i])c.checked=actual.checks[i]; c.disabled=!actual.draft.trim();
      });
      return true;
    }
    if (!['choices','short','gaps','reviewed'].some(changed)) return false;
    const p=pack();
    if (changed('choices')) p.questions.forEach((q,i)=>q.options.forEach((_,j)=>{
      const c=el(`rwChoice${i}-${j}`), checked=actual.choices[i]===j; if(c.checked!==checked)c.checked=checked;
    }));
    if (changed('gaps')&&p.gap) actual.gaps.forEach((value,i)=>setValue('rwGap'+i,value==null?'':String(value)));
    if (changed('short')) {
      setValue('rwShort',actual.short);
      const n=words(actual.short),limit=shortLimit(p);
      el('rwShortCount').textContent=`${n} / ${limit} 词${n>limit?' · 请精简':''}`;
    }
    clearInvalid();syncReading();
    el('rwReadNotice').textContent=actual.reviewed ? '已同步另一页的作答与核对结果。' : '另一页的作答已同步，请检查答案后再核对。';
    return true;
  }
  function button(action, text, style = 'secondary', attrs = '') {
    return `<button type="button" class="rw-btn rw-${style}" data-rw-action="${action}" ${attrs}>${text}</button>`;
  }
  function header(p) {
    return `<header class="rw-front">
      <div><p class="rw-overline"><span aria-hidden="true"></span>READING &amp; WRITING</p>
      <h2>读写练习册</h2><p class="rw-lead">读一篇文章，找出答案的依据，再把自己的想法写给真正的读者。</p></div>
      <div class="rw-select"><label for="rwPack">选择册别与题组</label>
        <select id="rwPack" data-rw-selector="pack">${packs().map(x => `<option value="${esc(x.id)}"${x.id === p.id ? ' selected' : ''}>${esc(bookTitle(x)+' · '+x.title)}</option>`).join('')}</select>
        <small>${esc(bookTitle(p)+' · '+unitTitle(p))}</small></div></header>
      <nav class="rw-mode" aria-label="本套练习">
       <button type="button" data-rw-action="read" aria-pressed="${mode === 'read'}"><span>01</span> 阅读作答</button>
       <button type="button" data-rw-action="write" aria-pressed="${mode === 'write'}"><span>02</span> 写作工坊</button>
      </nav>`;
  }
  function passage(p) {
    return `<div class="rw-prose" lang="en">${p.paragraphs.map((para,i) => `<p><span class="rw-num" aria-label="第 ${i+1} 段">${String(i+1).padStart(2,'0')}</span>${esc(para)}</p>`).join('')}</div>`;
  }
  function questions(p, s) {
    return p.questions.map((q,i) => `<fieldset class="rw-question"><legend><span class="rw-tag">${String(i+1).padStart(2,'0')} / ${esc(q.skill)}</span><strong lang="en">${esc(q.prompt)}</strong></legend>
      <div class="rw-options">${q.options.map((o,j) => `<label class="rw-option"><input type="radio" name="rwChoice${i}" id="rwChoice${i}-${j}" data-rw-choice="${i}" value="${j}"${s.choices[i] === j ? ' checked' : ''}><b aria-hidden="true">${label(j)}</b><span lang="en">${esc(o)}</span></label>`).join('')}</div></fieldset>`).join('');
  }
  function gaps(p, s) {
    const g = p.gap;
    if (!g) return '';
    return `<section class="rw-card"><p class="rw-overline">TEXT RESTORATION</p><h3>把五个句子放回原文</h3>
      <p class="rw-hint">先通读全文，再从 A–G 中为每个空选一句。每句只用一次，有两句多余。</p>
      <ol class="rw-bank" aria-label="候选句">${g.options.map((o,i) => `<li><b>${label(i)}</b><span lang="en">${esc(o)}</span></li>`).join('')}</ol>
      <div class="rw-cloze">${g.segments.map((seg,i) => `<p lang="en">${esc(seg)}</p>`+(i < g.answers.length ?
        `<div class="rw-gap"><label for="rwGap${i}">第 ${i+1} 空</label><select id="rwGap${i}" data-rw-gap="${i}"><option value="">选择候选句</option>${g.options.map((o,j) => `<option value="${j}"${s.gaps[i] === j ? ' selected' : ''}>${label(j)}. ${esc(o)}</option>`).join('')}</select></div>` : '')).join('')}</div></section>`;
  }
  function feedback(p,s) {
    if (!s.reviewed) return '';
    const choiceScore = p.questions.filter((q,i) => q.answer === s.choices[i]).length;
    const gapScore = p.gap ? p.gap.answers.filter((a,i) => a === s.gaps[i]).length : 0;
    const total = p.questions.length + (p.gap?.answers.length || 0);
    function result(i,answer,chosen,title,evidence,why) {
      const right = answer === chosen;
      return `<div class="rw-correction"><strong class="${right?'rw-good':'rw-missed'}">${title} ${i+1} · ${right ? '答对' : '待订正'}</strong>
        <p>${chosen == null ? '尚未选择' : '你选了 '+label(chosen)}；参考答案 ${label(answer)}。</p>${evidence ? `<blockquote>${esc(plain(evidence))}</blockquote>`:''}
        <p>${esc(plain(why))}</p></div>`;
    }
    return `<div class="rw-result"><p class="rw-overline">READING FEEDBACK</p><h3 id="rwResultTitle" tabindex="-1">客观题答对 ${choiceScore+gapScore} / ${total}</h3>
      <p>阅读选择 ${choiceScore} / ${p.questions.length}${p.gap ? ` · 句子还原 ${gapScore} / ${p.gap.answers.length}` : ''}。英文简答请自己比对，不计入这个分数。</p>
      ${p.questions.map((q,i) => result(i,q.answer,s.choices[i],'选择题',q.evidence,q.why)).join('')}
      ${p.gap ? p.gap.answers.map((a,i) => result(i,a,s.gaps[i],'还原题',p.gap.options[a],p.gap.why[i])).join('') : ''}
      <div class="rw-correction"><strong>英文简答 · 自行比对</strong><p>我的答案：<span lang="en">${esc(s.short)}</span></p><p>参考表达：<span lang="en">${esc(plain(p.short.sample))}</span></p>
      <blockquote>${esc(plain(p.short.evidence))}</blockquote><p>${esc(plain(p.short.note))}</p></div>
      ${button('write','带着阅读发现去写作 →','primary')}</div>`;
  }
  function answered(p,s) {
    const n = s.choices.filter(x => x != null).length + (s.short.trim() ? 1 : 0) + (p.gap ? s.gaps.filter(x => x != null).length : 0);
    return `已作答 ${n} / ${p.questions.length+1+(p.gap?.answers.length || 0)} 项`;
  }
  function reading(p,s) {
    const limit = shortLimit(p);
    return `<div class="rw-reading">
      <article class="rw-card rw-paper"><p class="rw-overline">READING TEXT <span class="rw-genre">${esc(p.genre)}</span></p>
       <h3 id="rwHeading" tabindex="-1">${esc(p.title)}</h3><p class="rw-story-title" lang="en">${esc(p.englishTitle)}</p>${passage(p)}
       <p class="rw-margin-note">读完后，试着指出：哪一句话支持我的选择？</p></article>
      <section class="rw-card"><p class="rw-overline">COMPREHENSION</p><h3>读懂这篇文章</h3>
       ${questions(p,s)}
       <div class="rw-short"><label for="rwShort"><span class="rw-tag">04 / 英文简答</span><strong lang="en">${esc(p.short.prompt)}</strong></label>
       <p id="rwShortHint" class="rw-hint">用不超过 ${limit} 个英文词作答。带连字符或撇号的词按一个词计。</p>
       <input type="text" id="rwShort" data-rw-field="short" lang="en" maxlength="500" value="${esc(s.short)}" aria-describedby="rwShortHint rwShortCount">
       <small id="rwShortCount">${words(s.short)} / ${limit} 词</small></div></section></div>
      ${gaps(p,s)}
      <div class="rw-submit"><div><strong id="rwAnswered">${answered(p,s)}</strong><p id="rwReadNotice" role="status">${s.reviewed ? '已核对。修改作答后可以再次核对。':'完成本套阅读作答，再核对答案与依据。'}</p></div>
      ${button('review',s.reviewed?'再次核对':'核对阅读答案 →','primary','id="rwReview"')}</div>
      <div id="rwFeedback">${feedback(p,s)}</div>`;
  }
  function writing(p,s) {
    const w = p.writing;
    function field(key,caption,description,rows) {
      return `<label class="rw-field-label" for="rw-${key}">${caption}</label><p class="rw-hint" id="rwHint-${key}">${description}</p>
        <textarea id="rw-${key}" data-rw-field="${key}" rows="${rows}" maxlength="20000" aria-describedby="rwHint-${key}"${key === 'draft' || key === 'revision' ? ' lang="en"' : ''}>\n${esc(s[key])}</textarea>
        ${key==='draft'||key==='revision' ? `<small id="rwCount-${key}">${words(s[key])} 个英文词</small>`:''}`;
    }
    return `<section class="rw-card rw-brief"><p class="rw-overline">WRITING BRIEF</p><h3 id="rwHeading" tabindex="-1">${esc(p.title)} · 写作任务</h3>
      <div class="rw-facts"><span>文体 <strong>${esc(w.genre)}</strong></span><span>读者 <strong>${esc(w.audience)}</strong></span><span>建议篇幅 <strong>${esc(rangeText(w))}</strong></span></div>
      <p class="rw-prompt">${esc(plain(w.prompt))}</p><h4>写作要点</h4>
      <ol class="rw-points">${lines(w.points).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
      <details><summary>回看阅读材料：${esc(p.englishTitle)}</summary>${passage(p)}</details></section>
      <section class="rw-card"><p class="rw-overline">01 / PLAN</p>
       ${field('plan','列提纲','先记下每个要点的关键词，再决定用哪个具体事例。',3)}
       <details><summary>需要起笔提示？查看表达支架</summary>${lineMarkup(w.frames)}</details></section>
      <section class="rw-card"><p class="rw-overline">02 / FIRST DRAFT</p>
       ${field('draft','写初稿','按提纲给这位读者写一篇英文短文。',7)}</section>
      <section class="rw-card"><p class="rw-overline">03 / CHECK</p><h3>逐项自查初稿</h3>
       <p class="rw-hint">每核实一项，勾选一项。改动初稿后，需要重新核对。</p>
       <div class="rw-checks">${checks.map((x,i) => `<label><input type="checkbox" data-rw-check="${i}" id="rwCheck${i}"${s.checks[i]?' checked':''}${!s.draft.trim()?' disabled':''}><span><strong>${x[0]}</strong>${x[1]}</span></label>`).join('')}</div>
       <details><summary>对照一篇参考范文与修改建议</summary><p class="rw-hint">范文只是一种写法。比较它如何回应要点，再决定自己的修改；自查与参考建议不等于作文评分。</p>
       <div class="rw-model" lang="en">${lineMarkup(w.sample)}</div><h4>对照看看</h4>${lineMarkup(w.feedback)}</details>
       ${w.reviseExample ? `<details><summary>看一处怎样改</summary><div class="rw-example"><h4>原句</h4><p lang="en">${esc(w.reviseExample.before)}</p><h4>改写</h4><p lang="en">${esc(w.reviseExample.after)}</p><h4>为什么这样改</h4><p>${esc(w.reviseExample.why)}</p></div></details>`:''}</section>
      <section class="rw-card"><p class="rw-overline">04 / REVISE</p>
       ${button('copy-draft','把初稿复制到空白修改区','secondary',`id="rwCopy"${!s.draft.trim() || s.revision ? ' hidden':''}`)}
       ${field('revision','保留初稿，另写修改稿','可直接写，也可从初稿复制后修改。两个版本分别保存。',7)}
       ${field('note','记录一次修改','我改了哪一句？它为什么更适合这位读者？',3)}</section>`;
  }
  function render() {
    const root = el('rwRoot');
    if (!root) return;
    if (root !== mounted) {
      mounted = root; root.addEventListener('input',onInput); root.addEventListener('change',onChange); root.addEventListener('click',onClick);
    }
    const all = packs(), currentBook = window.Curriculum?.unit?.()?.bookId;
    const p = all.find(x=>x.id === selected) || all.find(x=>bookOf(x) === currentBook) || all[0];
    if (!p || !store()) { root.textContent = '读写材料未加载，请重新打开本页。'; return; }
    if (activeId !== p.id) mode = 'read';
    activeId = p.id; invalidId = '';
    const s = store().get(activeId);
    root.innerHTML = header(p)+`<div class="rw-work">${mode==='write' ? writing(p,s) : reading(p,s)}</div>
      <footer class="rw-footer"><div><strong>我的读写作品</strong><p>导出本套阅读作答、写作两稿和修改反思。</p><small id="rwSaveStatus" role="status">本设备自动保存</small></div>
      <div class="rw-tools">${button('retry','重试保存','secondary','id="rwRetry" hidden')}${button('export','导出本套作品 ↓')}</div></footer>`;
    if (pending.has(activeId)) saveStatus('本套有内容未能永久保存。请重试或导出作品。',true);
  }
  function syncReading() {
    const p = pack(), s = store().get(activeId), area = el('rwFeedback');
    if (area) area.innerHTML = feedback(p,s);
    const count = el('rwAnswered'); if (count) count.textContent = answered(p,s);
    const action = el('rwReview'); if (action) action.textContent = s.reviewed ? '再次核对':'核对阅读答案 →';
  }
  function answerChange(patch, wasReviewed) {
    clearInvalid();
    if (save({...patch,reviewed:false})) return;
    if (wasReviewed) {
      syncReading(); el('rwReadNotice').textContent = '作答已修改，请重新核对。';
    } else {
      el('rwAnswered').textContent = answered(pack(),store().get(activeId));
      el('rwReadNotice').textContent = '完成本套阅读作答，再核对答案与依据。';
    }
  }
  function onInput(event) {
    const target = event.target, key = target.dataset.rwField;
    if (!['short','plan','draft','revision','note'].includes(key)) return;
    const s = store().get(activeId);
    if (key === 'short') {
      answerChange({short:target.value},s.reviewed);
      const count = words(target.value), limit = shortLimit(pack());
      el('rwShortCount').textContent = `${count} / ${limit} 词${count>limit?' · 请精简':''}`;
      return;
    }
    const patch = {[key]:target.value};
    if (key === 'draft' && s.checks.some(Boolean)) patch.checks = checks.map(()=>false);
    save(patch);
    if (key === 'draft' || key === 'revision') {
      el('rwCount-'+key).textContent = `${words(target.value)} 个英文词`;
      const next = store().get(activeId);
      el('rwCopy').hidden = !next.draft.trim() || !!next.revision;
      if (key==='draft') checks.forEach((_,i) => {
        const c = el('rwCheck'+i); c.disabled = !next.draft.trim(); c.checked = next.checks[i];
      });
    }
  }
  function onChange(event) {
    const t = event.target, d = t.dataset;
    if (d.rwSelector === 'pack') { if (choose(t.value)) { render(); focus('rwPack'); } return; }
    const s = store().get(activeId);
    for (const [attr,key] of [['rwChoice','choices'],['rwGap','gaps'],['rwCheck','checks']]) {
      if (d[attr] === undefined) continue;
      const i = Number(d[attr]), list = s[key].slice();
      if (!Number.isInteger(i) || i < 0 || i>=list.length) return;
      list[i] = key==='checks' ? t.checked : (t.value==='' ? null : Number(t.value));
      if (key==='checks') save({checks:list}); else answerChange({[key]:list},s.reviewed);
      return;
    }
  }
  function clearInvalid() {
    if (!invalidId) return;
    const old=el(invalidId);
    if (old) { old.removeAttribute('aria-invalid'); old.removeAttribute('aria-errormessage'); }
    el('rwFieldError')?.remove?.(); invalidId='';
  }
  function review() {
    const p = pack(), s = store().get(activeId);
    clearInvalid();
    function invalid(id,text) {
      const field=el(id);
      invalidId=id; field.setAttribute('aria-invalid','true');
      const slot=field.closest?.('.rw-question,.rw-short,.rw-gap');
      if (slot) {
        const hint=document.createElement('p');hint.id='rwFieldError';hint.textContent=text;
        slot.append(hint);field.setAttribute('aria-errormessage',hint.id);
      }
      el('rwReadNotice').textContent=text;focus(id);
    }
    for (let i=0;i<p.questions.length;i++) if (s.choices[i]==null) return invalid(`rwChoice${i}-0`,`请先完成第 ${i+1} 道选择题。`);
    const n = words(s.short), max = shortLimit(p);
    if (!n || /\p{Script=Han}/u.test(s.short) || n>max) return invalid('rwShort',`请用 1 至 ${max} 个英文词回答简答题，再核对。`);
    if (p.gap) {
      const used = new Set();
      for (let i=0;i<p.gap.answers.length;i++) {
        if (s.gaps[i]==null) return invalid('rwGap'+i,`请完成句子还原第 ${i+1} 空。`);
        if (used.has(s.gaps[i])) return invalid('rwGap'+i,`第 ${i+1} 空重复使用了候选句。每句话只能使用一次。`);
        used.add(s.gaps[i]);
      }
    }
    save({reviewed:true});
    if (!store().get(activeId).reviewed) {
      render(); el('rwReadNotice').textContent='答案已发生变化，请先检查本页作答，再重新核对。'; focus('rwReview'); return;
    }
    syncReading();
    el('rwReadNotice').textContent = '已核对。修改作答后可以再次核对。'; focus('rwResultTitle');
  }
  function exportWork() {
    const p=pack(), s=store().get(activeId), w=p.writing;
    const answer=(options,n)=>n==null ? '（未作答）' : `${label(n)}. ${options[n]}`;
    const out=[`${bookTitle(p)} · ${p.title}`,unitTitle(p),'','一、阅读作答',p.englishTitle,...p.paragraphs,'',
      ...p.questions.flatMap((q,i)=>[`${i+1}. ${q.prompt}`,`我的选择：${answer(q.options,s.choices[i])}`,...(s.reviewed?[`参考答案：${answer(q.options,q.answer)}`,`依据：${plain(q.evidence)}`,plain(q.why)]:[]),'']),
      p.short.prompt,`英文简答：${s.short || '（未作答）'}`,...(s.reviewed ? [`参考表达（自行比对）：${plain(p.short.sample)}`,plain(p.short.evidence),plain(p.short.note)]:[]),
      ...(p.gap ? ['','句子还原',...p.gap.answers.map((a,i)=>`第 ${i+1} 空：${answer(p.gap.options,s.gaps[i])}${s.reviewed ? `；参考：${answer(p.gap.options,a)}。${plain(p.gap.why[i])}`:''}`)] : []),
      '','二、写作任务',`文体：${w.genre}｜读者：${w.audience}｜篇幅：${rangeText(w)}`,plain(w.prompt),...lines(w.points),
      '','提纲',s.plan||'（待写）','','初稿',s.draft||'（待写）','','我的自查',...checks.map((x,i)=>`${s.checks[i]?'☑':'☐'} ${x[0]}：${x[1]}`),
      '','修改稿',s.revision||'（待写）','','修改反思',s.note||'（待写）'];
    if (typeof window.downloadText === 'function') {
      try { window.downloadText(`读写练习册_${p.id}.txt`,'\ufeff'+out.join('\n'),'text/plain;charset=utf-8'); }
      catch { saveStatus('未能导出，请重试。',pending.has(activeId)); }
    } else saveStatus('此页面暂时无法下载作品。',pending.has(activeId));
  }
  function onClick(e) {
    const t = e.target.closest('[data-rw-action]');
    if (!t || !mounted.contains(t)) return;
    const a = t.dataset.rwAction;
    if (a==='read' || a==='write') { mode=a; render(); focus('rwHeading'); }
    else if (a==='review') review();
    else if (a==='retry' && pending.has(activeId)) save(pending.get(activeId).patch);
    else if (a==='export') exportWork();
    else if (a==='copy-draft') {
      const s=store().get(activeId);
      if (!s.draft.trim() || s.revision) return;
      save({revision:s.draft}); el('rw-revision').value=s.draft; el('rwCount-revision').textContent=words(s.draft)+' 个英文词'; el('rwCopy').hidden=true; focus('rw-revision');
    }
  }
  function open(id, section = 'reading') {
    if (id != null) { if (!choose(id)) return false; activeId = id; }
    mode = section === 'writing' ? 'write' : 'read';
    if (typeof window.openView==='function') window.openView('readwrite'); else render();
    return true;
  }
  window.RWApp={render,open};
})();

