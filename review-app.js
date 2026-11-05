(function () {
  'use strict';
  const C = window.WordMemoryCore, D = window.ENGLISH_CURRICULUM, curriculum = window.Curriculum;
  const root = document.getElementById('wordMemoryRoot');
  if (!root || !C || !D || !curriculum) return;
  const KEY = 'englishWordMemoryV40', NEW_LIMIT = 5, ROUND_LIMIT = 20;
  const $ = id => document.getElementById(id), esc = window.escapeHtml;
  const catalog = C.catalog(D), books = new Map(D.books.map(b => [b.id,b]));
  let state, notice = '', failed = false, blockedRaw = '', busy = false;
  let panel = 'review', mode = 'meaning', scope = 'all', round = null, shownUnit = '';
  let custom = {word:'',meaning:'',example:'',unitId:''}, importText = '', importPreview = null;
  const now = () => new Date();
  const unit = () => curriculum.unit();
  const uid = () => 'review-' + (window.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const button = (label,action,value='',css='outline-btn',disabled=false) => `<button type="button" class="${css}" data-wm-action="${action}" data-wm-value="${esc(value)}"${disabled?' disabled':''}>${label}</button>`;
  const selected = (a,b) => a === b ? ' selected' : '';
  const date = value => new Date(value).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'});
  const currentScope = () => scope === 'unit' ? unit().id : null;

  const raw = safeStore.get(KEY,null);
  try { state = C.normalize(raw ? JSON.parse(raw) : null); }
  catch { state=C.createState();blockedRaw=raw||'';failed=true;notice='原有词汇积累记录暂时无法读取。先导出异常原记录；本页可以练习，新的记录暂保留在内存中。'; }

  function stored() {
    const value=safeStore.get(KEY,null);
    if (!value) return C.createState();
    return C.normalize(JSON.parse(value));
  }
  async function coordinateWrite(operation) {
    let started=false;
    const run=()=>{started=true;return operation();};
    try {
      const locks=window.navigator?.locks;
      if(typeof locks?.request==='function') return await locks.request(KEY+':write',{mode:'exclusive'},run);
      return run();
    } catch(error) {
      // Some file origins expose the API but reject access. Only fall back if
      // the callback never ran; retrying an accepted operation could duplicate it.
      if(started)throw error;
      return run();
    }
  }
  function persist() {
    if (window.restoringSnapshot || blockedRaw) { failed=true;return false; }
    try {
      state=C.merge(state,stored());
      const ok=safeStore.set(KEY,JSON.stringify(state));
      failed=!ok;
      return ok;
    } catch (error) {
      failed=true;notice='记录尚未写入浏览器：'+error.message+'。请先备份，保留此页面。';return false;
    }
  }
  function save() { return coordinateWrite(persist); }
  function newAllowanceReached(id,kind,time=now()) {
    if(state.cards[id].schedulers[kind].reps>0)return false;
    // Match Core.queue's Beijing calendar and first actual review per mode.
    // Queue membership alone is insufficient: due cards can fill a round.
    const day=value=>new Date(new Date(value).getTime()+8*60*60*1000).toISOString().slice(0,10);
    const today=day(time),seen=new Set();let used=0;
    for(const log of state.logs) {
      if(log.mode!==kind||seen.has(log.cardId))continue;
      seen.add(log.cardId);
      if(day(log.at)===today&&++used>=NEW_LIMIT)return true;
    }
    return false;
  }
  function syncPractice() {
    const p=round?.practice;if(!p)return;
    p.blocked=!p.rated&&newAllowanceReached(p.id,round.mode);
    if(p.rated)p.due=state.cards[p.id].schedulers[round.mode].due;
  }
  function updateSummary() {
    const meaning=C.stats(state,now(),'meaning'), spelling=C.stats(state,now(),'spelling');
    const home=$('memoryHomeDue'), today=$('memoryTodayDue'), growth=$('memoryGrowthSummary');
    if (home) home.textContent=`我的词库 ${meaning.total} 词 · 词义到期 ${meaning.due} 词 · 拼写到期 ${spelling.due} 词。先复习到期词，再少量学新词。`;
    if (today) today.textContent=`词义到期 ${meaning.due} 词 · 拼写到期 ${spelling.due} 词`;
    if (growth) growth.textContent=`已纳入词库 ${meaning.total} 词；词义练过 ${meaning.reviewedWords} 词，拼写练过 ${spelling.reviewedWords} 词。今天词义 ${meaning.reviewedToday} 次、拼写 ${spelling.reviewedToday} 次，记录可导出核对。`;
  }
  function startRound() {
    const ids=C.queue(state,{unitId:currentScope(),now:now(),mode,limit:ROUND_LIMIT,newLimit:NEW_LIMIT});
    round={ids,index:0,mode,unitId:currentScope(),practice:null};
    nextCard();
  }
  function nextCard() {
    const id=round?.ids[round.index];
    round.practice=id&&state.cards[id]?{id,eventId:uid(),input:'',revealed:false,correct:null,rated:false,due:null}:null;
  }
  function readyRound() {
    if (!round || round.mode!==mode || round.unitId!==currentScope()) startRound();
    syncPractice();
  }
  function syncUnit() {
    const id=unit().id;
    if (shownUnit!==id) { shownUnit=id;if(scope==='unit')round=null; }
  }
  function warning() {
    return `${failed?`<div class="wm-warning" role="alert"><strong>这些新记录尚未保存到浏览器。</strong><p>请保留此页面，先点顶部“备份记录”导出。不要先关闭或刷新页面。</p>${blockedRaw?button('导出异常原记录','recovery') : button('重试保存','save')}</div>`:''}${notice?`<p class="wm-notice" role="status">${esc(notice)}</p>`:''}`;
  }
  function statsHtml() {
    const s=C.stats(state,now(),mode);
    return `<div class="wm-stats" aria-label="当前练习方式的词汇记录"><article><span>我的词库</span><strong>${s.total}<small> 词条</small></strong></article><article><span>${mode==='meaning'?'词义':'拼写'}已到期</span><strong>${s.due}<small> 词</small></strong></article><article><span>今天已练</span><strong>${s.reviewedToday}<small> 次</small></strong></article><article><span>本方式尚未练</span><strong>${s.new}<small> 词</small></strong></article></div>`;
  }
  function reviewHtml() {
    readyRound();
    const p=round.practice;
    const controls=`<div class="wm-controls"><div class="wm-segments" aria-label="复习方式">${[['meaning','回想词义'],['spelling','中文提示拼写']].map(([v,l])=>`<button type="button" data-wm-action="mode" data-wm-value="${v}" aria-pressed="${mode===v}">${l}</button>`).join('')}</div><label>复习范围<select id="wmScope"><option value="all"${selected(scope,'all')}>所有已加入的单元与生词</option><option value="unit"${selected(scope,'unit')}>只看当前单元</option></select></label></div>`;
    if (!p) {
      const hasCards=Object.keys(state.cards).length>0;
      return controls+`<section class="wm-empty"><span class="wm-empty-icon" aria-hidden="true">🌱</span><h3>${round.ids.length?'这一轮练完了':'现在没有需要立即练习的词'}</h3><p>${hasCards?'已到期的旧词优先；每种方式每天最多新学 5 个词。短期复习到时后，可以再检查队列。':'从当前单元加入几个词，或把课本和阅读里遇到的生词加进来。'}</p><div class="wm-actions">${button(hasCards?'重新检查到期词':'加入本单元精选词',''+(hasCards?'restart':'enroll-unit'),'','primary-btn')}${button('看看本单元词库','panel','library')}${button('去学以致用','literacy')}</div><p class="wm-muted">完整精选词库为 ${catalog.length} 条单元词条，不是教材或课标完整词表；也不把练习次数当成掌握词数。</p></section>`;
    }
    const w=state.cards[p.id];
    const answer= p.revealed ? `<section class="wm-answer" aria-label="答案与语境"><strong>${esc(w.meaning)}</strong><p lang="en">${esc(w.example||'为这个词补充自己的生活例句，会更容易记住它。')}</p><div class="wm-actions">${button('朗读单词','audio','word','wm-link')}${w.example?button('朗读例句','audio','example','wm-link'):''}${w.unitId?button('读本单元短文','read',w.unitId,'wm-link'):''}</div></section>` : '<div class="wm-concealed">词义和例句暂时收起。给自己几秒，先独立回想。</div>';
    let task;
    if(mode==='meaning') {
      task=`<p class="wm-task-hint">看英文，回想它在句子中的意思</p><h3 id="wmCardTitle" tabindex="-1" lang="en">${esc(w.word)}</h3><label for="wmRecallInput">我的回忆 <span>可写中文关键词，也可先口头说出</span></label><input id="wmRecallInput" type="text" maxlength="300" value="${esc(p.input)}" placeholder="先回想，再查看答案"${p.revealed?' readonly':''}>${answer}${!p.revealed?button('我已回想，查看答案','reveal','','primary-btn'):''}`;
    } else {
      task=`<p class="wm-task-hint">根据中文，独立写出英语单词或短语</p><h3 id="wmCardTitle" tabindex="-1">${esc(w.meaning)}</h3><form id="wmSpellingForm"><label for="wmSpellingInput">我的第一次拼写</label><input id="wmSpellingInput" type="text" maxlength="160" lang="en" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(p.input)}" placeholder="写完后再检查"${p.revealed?' readonly':''}>${!p.revealed?'<button type="submit" class="primary-btn">检查拼写</button>':''}</form>${p.revealed?`<div class="wm-spelling-result ${p.correct?'is-correct':'needs-work'}" role="status"><strong>${p.correct?'本次第一次拼写正确':'这一次还没写对，先看清正确写法'}</strong><p>正确写法：<b lang="en">${esc(w.word)}</b></p><p>你的输入：<span lang="en">${esc(p.input)}</span></p><small>只记录第一次检查。看答案后的订正不覆盖这次结果。</small></div>`:''}${answer}`;
    }
    const blocked=p.blocked?`<p class="wm-notice" role="status">今天本方式的新词额度已用完，当前输入已保留。明天可以继续新词，也可以先检查已到期的词。</p>${button('检查已到期词','restart')}`:'';
    const feedback = p.rated ? `<div id="wmReviewResult" class="wm-recorded" role="status"><strong>${failed?'本次结果保留在页面内存中':'本次结果已保存'}</strong><span>本方式下次复习：${date(p.due)}（北京时间）</span></div>${button(round.index+1===round.ids.length?'完成本轮':'下一词 →','next','','primary-btn')}` : p.revealed ? (mode==='meaning'?`<p class="wm-rating-note">按看答案前的第一次回忆选择。猜中、看过后才想起，请选“还没想起”。这是自评记录。</p><div class="wm-actions wm-rating">${button('还没想起 · 再学','rate','1','outline-btn',busy||p.blocked)}${button('自己想起了','rate','3','primary-btn',busy||p.blocked)}</div>`:`${button('记录第一次结果并安排复习','rate',p.correct?'3':'1','primary-btn',busy||p.blocked)}`) : '';
    return controls+`<article class="wm-practice"><div class="wm-practice-top"><span>${mode==='meaning'?'RECALL THE MEANING':'SPELL FROM MEMORY'}</span><span>本轮 ${round.index+1} / ${round.ids.length}</span></div>${task}<div class="wm-practice-footer">${blocked}${feedback}</div></article><p class="wm-muted">词义和拼写有各自的复习日期。计划随真实反馈调整；它不代表听说读写已经全部掌握。</p>`;
  }
  function libraryHtml() {
    const u=unit(), list=catalog.filter(w=>w.unitId===u.id);
    return `<section class="wm-library"><div class="wm-section-heading"><div><h3>Unit ${u.number} · ${esc(u.title)}</h3><p>精选 ${list.length} 个主题词，放在例句里理解，再加入长期复习。</p></div>${button('加入本单元全部精选词','enroll-unit','','primary-btn')}</div><div class="wm-word-grid">${list.map(w=>`<article class="wm-word"><div><h4 lang="en">${esc(w.word)}</h4><span>${esc(w.meaning)}</span></div><p lang="en">${esc(w.example)}</p>${button(state.cards[w.id]?'已在我的词库':'加入复习','enroll',w.id,state.cards[w.id]?'wm-added':'outline-btn',!!state.cards[w.id])}</article>`).join('')}</div><div class="wm-context-link"><p>先读本单元语篇，再用两三个词完成自己的表达。</p><div class="wm-actions">${button('读本单元短文','read',u.id)}${button('完成主题任务','literacy','','primary-btn')}</div></div></section>`;
  }
  function customHtml() {
    const own=Object.values(state.cards).filter(w=>w.origin==='custom');
    return `<section class="wm-custom"><div class="wm-section-heading"><div><h3>把课本和生活里的生词留下来</h3><p>只填真实词义，尽量加上你看到的原句。加入后按词义、拼写分别复习。</p></div></div><form id="wmCustomForm" class="wm-custom-form"><label for="wmCustomWord">英语单词或短语<input id="wmCustomWord" required maxlength="160" autocomplete="off" autocapitalize="none" spellcheck="false" lang="en" value="${esc(custom.word)}" placeholder="例如：take part in"></label><label for="wmCustomMeaning">在这里的中文意思<input id="wmCustomMeaning" required maxlength="300" value="${esc(custom.meaning)}" placeholder="例如：参加"></label><label class="wm-wide" for="wmCustomExample">例句 <span>可暂时留空</span><input id="wmCustomExample" maxlength="1000" lang="en" value="${esc(custom.example)}" placeholder="写下课本、阅读或自己生活中的句子"></label><label for="wmCustomUnit">归属单元<select id="wmCustomUnit"><option value=""${selected(custom.unitId,'')}>课外积累，不绑定单元</option>${D.units.map(u=>`<option value="${u.id}"${selected(custom.unitId,u.id)}>${esc(books.get(u.bookId).shortLabel||books.get(u.bookId).title)} · ${u.number} ${esc(u.title)}</option>`).join('')}</select></label><div class="wm-custom-submit"><button type="submit" class="primary-btn">加入我的生词本</button></div></form><details class="wm-import"><summary>从表格批量加入生词</summary><p>从表格复制三列：英文、中文、例句；列之间用 Tab 分隔，每行一个词，最多 200 行。也可下载模板填写。先预览，确认后才加入。</p>${button('下载三列模板','template','','wm-link')}<label for="wmImportText">粘贴词表<textarea id="wmImportText" rows="5" maxlength="250000" placeholder="英文　[Tab]　中文　[Tab]　例句">${esc(importText)}</textarea></label>${button('检查并预览','preview-import')}${importPreview?`<div class="wm-import-preview"><strong>将检查加入 ${importPreview.length} 行</strong><ul>${importPreview.slice(0,5).map(w=>`<li><b lang="en">${esc(w.word)}</b> — ${esc(w.meaning)}</li>`).join('')}</ul><p>同词同义的重复条目会沿用已有记录；整批检查通过后才提交。</p>${button('确认加入这些词','commit-import','','primary-btn')}</div>`:''}</details><div class="wm-section-heading"><h3>已加入的自建词 <small>${own.length} 条</small></h3>${button('导出我的词表','export-words','','wm-link',!Object.keys(state.cards).length)}</div><div class="wm-own-list">${own.length?own.slice(-40).reverse().map(w=>`<article><strong lang="en">${esc(w.word)}</strong><span>${esc(w.meaning)}</span><p lang="en">${esc(w.example||'尚未添加例句')}</p></article>`).join(''):'<p class="wm-muted">这里还没有自建词。上方加入后会保存在本机词库中。</p>'}</div></section>`;
  }
  function historyHtml() {
    const logs=state.logs.slice(-20).reverse();
    return `<section class="wm-history"><div class="wm-section-heading"><div><h3>每一次练习，都有具体记录</h3><p>最近 20 次；完整复习日志与算法版本包含在整站备份中。</p></div>${button('导出我的词表','export-words','','outline-btn')}</div>${logs.length?`<ol>${logs.map(log=>`<li><div><strong lang="en">${esc(state.cards[log.cardId]?.word||'词条')}</strong><span>${log.mode==='meaning'?'词义自评':'第一次拼写'} · ${log.rating===1?'需要再学':'本次回忆成功'}</span></div><time>${date(log.at)}</time></li>`).join('')}</ol>`:'<p class="wm-muted">还没有实际提交的复习记录。加入词库不算已经学会，第一次回忆后记录才会出现在这里。</p>'}</section>`;
  }
  function render() {
    syncUnit();
    const b=books.get(unit().bookId);
    root.innerHTML=`<header class="wm-heading"><div><span class="cx-kicker">REMEMBER, REVISIT, USE</span><h2>词汇积累</h2><p>先回忆，再核对；隔几天，还能自己想起来。</p></div><span class="wm-book-label">${esc(b.shortLabel||b.title)} · Unit ${unit().number}</span></header>${statsHtml()}<nav class="wm-tabs" aria-label="词汇积累功能">${[['review','今日复习'],['library','本单元词库'],['custom','我的生词本'],['history','学习记录']].map(([v,l])=>`<button type="button" data-wm-action="panel" data-wm-value="${v}" aria-pressed="${panel===v}">${l}</button>`).join('')}</nav>${warning()}${panel==='review'?reviewHtml():panel==='library'?libraryHtml():panel==='custom'?customHtml():historyHtml()}<details class="wm-about"><summary>复习方法、课标范围与记录说明</summary><p>词义回忆与拼写分别安排，每种方式每天最多新学 ${NEW_LIMIT} 个词，每轮最多 ${ROUND_LIMIT} 个。到期的已学词优先。忘记后需要再学，下一次日期由本机运行的开源 ts-fsrs 5.4.2（FSRS-6）计算；固定目标参数是学习安排，不是个人记忆保证，也不是课标规定的算法。</p><p>课标三级约 1600 词是七至九年级学段累计要求，包含二级 505 词。本站 ${catalog.length} 条单元精选词不是完整课标或教材词表；可把实书中的词补入生词本。目标是围绕主题理解和运用，浏览、加入、复习次数都不等于已掌握词数。</p><p>旧版练习记录保留在下方；新引擎从启用当天起记录真实反馈，不补造过去的复习时间。数据保存在当前浏览器；换设备、网址或离线文件前，请导出整站备份，到新入口恢复。没有账号或云端自动同步。</p><p>开源代码：<a href="https://github.com/open-spaced-repetition/ts-fsrs" target="_blank" rel="noopener noreferrer">ts-fsrs（MIT）</a>；借鉴 <a href="https://github.com/RealKai42/qwerty-learner" target="_blank" rel="noopener noreferrer">Qwerty Learner</a> 的拼写反馈及 <a href="https://luteorg.github.io/lute-manual/" target="_blank" rel="noopener noreferrer">Lute</a> 的语境学习思路，交互由本站实现。</p></details>`;
    updateSummary();
  }
  async function enroll(words) {
    const next=C.normalize(state), result=C.addWords(next,words,now());
    state=next;round=null;const ok=await save();
    notice=`${result.added?`加入 ${result.added} 个词`:'这些词已经在词库里'}${result.existing?`，${result.existing} 个沿用原记录`:''}。${ok?'加入词库还不算完成回忆，请从今日复习开始。':'请先导出备份，暂不要关闭页面。'}`;
    render();
  }
  function reveal() {
    const p=round?.practice;if(!p||p.revealed)return;
    p.input=($('wmRecallInput')?.value||p.input).trim();p.revealed=true;notice='';render();
  }
  function check() {
    const p=round?.practice;if(!p||p.revealed||mode!=='spelling')return;
    p.input=($('wmSpellingInput')?.value||p.input).trim();
    if(!p.input){notice='先写下你的第一次拼写，再检查。';render();$('wmSpellingInput')?.focus();return;}
    p.correct=C.checkSpelling(p.input,state.cards[p.id].word);p.revealed=true;notice='';render();
  }
  async function rate(rating) {
    const p=round?.practice;if(!p||!p.revealed||p.rated||busy)return;
    const reviewMode=mode;
    busy=true;render();
    try {
      await coordinateWrite(()=>{
        if(!blockedRaw)state=C.merge(state,stored());
        const time=now();
        if(newAllowanceReached(p.id,reviewMode,time)){p.blocked=true;return;}
        const actual=reviewMode==='spelling'?(p.correct?3:1):rating;
        const result=C.review(state,p.id,actual,time,{eventId:p.eventId,mode:reviewMode,answer:p.input,...(reviewMode==='spelling'?{correct:p.correct}:{})});
        p.rated=true;notice='';
        const ok=persist(),w=state.cards[p.id];
        p.due=w.schedulers[reviewMode].due;
        if(result.applied&&ok&&w.unitId)curriculum.markWordReviewed(w.word,w.unitId);
      });
    }catch(error){notice=error.message;}
    busy=false;render();
  }
  async function addCustom() {
    const next=C.normalize(state);
    try {
      const before=Object.keys(next.cards).length;
      C.addCustom(next,{...custom,unitId:custom.unitId||null},now());state=next;const ok=await save();round=null;
      notice=Object.keys(state.cards).length>before?'生词已加入复习计划。':'相同词义的词已存在，沿用原来的复习记录。';
      if(!ok)notice+=' 当前未写入浏览器，请先备份。';
      custom={word:'',meaning:'',example:'',unitId:custom.unitId};render();
    }catch(error){notice=error.message;render();}
  }
  async function commitImport() {
    if(!importPreview)return;
    try {
      const next=C.normalize(state), before=Object.keys(next.cards).length, time=now();
      for(const word of importPreview)C.addCustom(next,{...word,unitId:null},time);
      state=next;const ok=await save();round=null;notice=`这批词表新增 ${Object.keys(state.cards).length-before} 词，其余同词同义条目沿用原记录。${ok?'':'请先备份，当前未写入浏览器。'}`;
      importPreview=null;importText='';render();
    }catch(error){notice='整批未加入：'+error.message;render();}
  }
  function speak(example) {
    const p=round?.practice;if(!p||!p.revealed)return;
    const w=state.cards[p.id], text=example==='example'?w.example:w.word;
    if(!text)return;
    if(typeof selectedVoice==='function'&&!selectedVoice()){notice='本机没有可用的英语语音，可以对照文字朗读；也可到“发音校准”检查本机语音。';render();return;}
    if(typeof speakText==='function')speakText(text,'word-memory-'+p.id,example==='example'?'例句':'单词');
  }
  function exportWords() {
    const cell=x=>{let s=String(x||'').replace(/[\t\r\n]+/g,' ');return /^[=+@-]/.test(s)?"'"+s:s;};
    const rows=[['英文','中文','例句','来源'],...Object.values(state.cards).map(w=>[w.word,w.meaning,w.example,w.unitId||'自建词'])];
    downloadText('我的英语词表.tsv','\ufeff'+rows.map(row=>row.map(cell).join('\t')).join('\n'),'text/tab-separated-values;charset=utf-8');
    notice='词表已生成；它只含词汇内容。要迁移复习日期与作品，请使用顶部“备份记录”。';render();
  }
  function refresh(){if(busy)return;syncUnit();render();}
  document.addEventListener('input',event=>{
    const id=event.target.id;
    if(['wmRecallInput','wmSpellingInput'].includes(id)&&round?.practice&&!round.practice.revealed)round.practice.input=event.target.value;
    const field={wmCustomWord:'word',wmCustomMeaning:'meaning',wmCustomExample:'example'}[id];
    if(field)custom[field]=event.target.value;
    if(id==='wmImportText'){importText=event.target.value;importPreview=null;const box=root.querySelector('.wm-import-preview');if(box)box.remove();}
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='wmScope'){scope=event.target.value;round=null;notice='';render();}
    if(event.target.id==='wmCustomUnit')custom.unitId=event.target.value;
  });
  document.addEventListener('submit',async event=>{
    if(event.target.id==='wmSpellingForm'){event.preventDefault();check();}
    if(event.target.id==='wmCustomForm'){event.preventDefault();await addCustom();}
  });
  document.addEventListener('click',async event=>{
    const target=event.target.closest('[data-wm-action]');if(!target||target.disabled)return;
    const action=target.dataset.wmAction,value=target.dataset.wmValue;
    if(action==='panel'){panel=value;notice='';render();}
    else if(action==='mode'){mode=value;round=null;notice='';render();}
    else if(action==='restart'){round=null;notice='';render();}
    else if(action==='reveal')reveal();
    else if(action==='rate')await rate(Number(value));
    else if(action==='next'&&round?.practice?.rated){round.index++;nextCard();notice='';render();$('wmCardTitle')?.focus({preventScroll:true});}
    else if(action==='enroll-unit')await enroll(catalog.filter(w=>w.unitId===unit().id));
    else if(action==='enroll'){const word=catalog.find(w=>w.id===value);if(word)await enroll([word]);}
    else if(action==='save'){const ok=await save();notice=ok?'当前词汇积累记录已写入浏览器。':'仍未写入，请保留页面并先备份。';render();}
    else if(action==='recovery')downloadText('词汇积累_异常原记录.json',blockedRaw,'application/json;charset=utf-8');
    else if(action==='audio')speak(value);
    else if(action==='literacy')window.openView('literacy');
    else if(action==='read'){curriculum.selectUnit(value);if(unit().id===value)curriculum.openActivity({kind:'reading'});}
    else if(action==='preview-import'){try{importPreview=C.parseImport(importText);notice='词表格式已检查，请核对后确认加入。';}catch(error){importPreview=null;notice=error.message;}render();root.querySelector('.wm-import').open=true;}
    else if(action==='commit-import')await commitImport();
    else if(action==='template')downloadText('生词导入模板.tsv','\ufeffriver\t河流\tThere is a river near our school.\ntake part in\t参加\tI take part in the reading club.\n','text/tab-separated-values;charset=utf-8');
    else if(action==='export-words')exportWords();
  });
  document.addEventListener('curriculum:updated',refresh);
  window.addEventListener('storage',async event=>{
    if(event.key!==KEY||window.restoringSnapshot||blockedRaw)return;
    try {
      // newValue can contain a write that a later tab has already overwritten.
      // Preserve it before reading latest storage, including while a lock waits.
      state=C.merge(state,C.normalize(event.newValue?JSON.parse(event.newValue):null));
      const latest=stored();state=C.merge(state,latest);
      render();
      if(JSON.stringify(state)!==JSON.stringify(latest)){await save();render();}
    } catch(error){notice='其他页面的词汇记录未能合并：'+error.message;failed=true;render();}
  });
  const previousOpenView=window.openView;
  window.openView=function(...args){const result=previousOpenView.apply(this,args);if(args[0]==='words')refresh();return result;};
  window.addEventListener('focus',()=>{if($('words')?.classList.contains('active'))refresh();});
  window.WordMemory={snapshot:()=>C.normalize(state),refresh,open:()=>window.openView('words')};
  if(!blockedRaw&&!state.migratedLegacy){try{C.migrateLegacy(state,window.WordStudy?.snapshot(),D,now());save().then(refresh);}catch(error){notice='旧记录已保留；词汇计划可以从本单元重新加入。'+error.message;}}
  render();
})();
