(function () {
  'use strict';
  const C = window.CurriculumCore, D = window.ENGLISH_CURRICULUM;
  if (!C || !D || !window.GRAMMAR_BANK) return;
  const $ = id => document.getElementById(id), esc = escapeHtml;
  const storageKey = 'englishCurriculumStateV30';
  const units = new Map(D.units.map(u => [u.id, u]));
  const books = new Map(D.books.map(b => [b.id, b]));
  const topics = new Map(GRAMMAR_BANK.topics.map(t => [t.id, t]));
  const names = {vocabulary:'词汇', grammar:'语法', reading:'阅读', listening:'听力', writing:'写作', speaking:'口语'};
  let state;
  try { state = C.normalize(JSON.parse(safeStore.get(storageKey, '{}'))); }
  catch { state = C.normalize({}); }
  if (!units.has(state.selectedUnit)) state.selectedUnit = D.units[0].id;
  state.selectedBook = units.get(state.selectedUnit).bookId;
  let saving = false, switching = false, currentQuiz = null, notifyingCurriculum = false;
  const unsavedQuizKeys = new Set();
  let libraryBook = state.selectedBook, libraryQuery = '';
  const unit = () => units.get(state.selectedUnit);
  const book = () => books.get(unit().bookId);
  const copy = x => JSON.parse(JSON.stringify(x));
  const selected = (a, b) => a === b ? ' selected' : '';
  const checked = x => x ? ' checked' : '';
  const paragraph = text => text.split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
  const unitLabel = u => `${books.get(u.bookId).title} · Unit ${u.number}`;
  const topicTitle = id => topics.get(id)?.title || id;
  const bookOptions = (value, all = false) => (all ? `<option value="all"${selected(value,'all')}>全部六册</option>` : '') + D.books.map(b => `<option value="${b.id}"${selected(value,b.id)}>${esc(b.title)}${b.id === '9b' ? '（旧版参考）' : ''}</option>`).join('');
  const action = (label, name, value = '', css = 'outline-btn') => `<button type="button" class="${css}" data-caction="${name}" data-value="${esc(value)}">${label}</button>`;

  function save() {
    if (saving || window.restoringSnapshot) return !window.learningStorageFailed;
    saving = true;
    const ok = safeStore.set(storageKey, JSON.stringify(state));
    saving = false;
    return ok;
  }
  function remember() { C.rememberPlan(state, saved); }
  function tasksForDay(date, id) {
    if (saved._date === date && saved._unit === id) return {...saved};
    return C.tasksFor(state, date, id);
  }
  function ensureDay() {
    if (switching || window.restoringSnapshot) return;
    const day = EnglishCore.dayKey();
    if (saved._date === day && saved._unit === unit().id) return;
    const dayChanged=saved._date!==day;
    switching = true; LearningApp.captureDay(); remember();
    saved = C.tasksFor(state, day, unit().id);
    if(dayChanged){$('reflection').value=LearningApp.snapshot().days[day]?.reflection||'';safeStore.set('englishReflection',$('reflection').value);updateHomeDateAndGreeting();}
    save(); safeStore.set('englishGrowthTasks', JSON.stringify(saved));
    LearningApp.syncTasks();
    switching = false; refresh();
  }
  function markTask(name) { LearningApp.setTask(name); remember(); save(); }
  function selectUnit(id, view) {
    if (!units.has(id)) return;
    if (id !== state.selectedUnit) {
      if (LearningApp.isRecording()) { showToast('请先结束当前录音，再切换单元。'); return; }
      stopEverything(); remember(); switching = true;
      state.selectedUnit = id; state.selectedBook = units.get(id).bookId;
      if (libraryBook !== 'all') libraryBook = state.selectedBook;
      saved = C.tasksFor(state, EnglishCore.dayKey(), id);
      currentQuiz = null;
      save(); safeStore.set('englishGrowthTasks', JSON.stringify(saved));
      LearningApp.syncTasks(); switching = false;
      renderCourse(); renderReading(); renderAssessment(); renderSpeaking();
    }
    refresh();
    if (view) openView(view);
  }
  function selectBook(id) {
    const first = D.units.find(u => u.bookId === id);
    if (first) selectUnit(first.id);
  }
  function legacyView(id) {
    const view = $(id), old = document.createElement('div');
    old.className = 'cx-legacy'; old.hidden = true; old.style.display = 'none';
    while (view.firstChild) old.append(view.firstChild);
    view.append(old);
    const root = document.createElement('div'); root.id = 'cx-' + id; root.className = 'cx-view'; view.append(root);
    return root;
  }
  function scopeHeader(label, title, description) {
    return `<div class="cx-heading"><div><span class="cx-kicker">${label}</span><h2>${esc(title)}</h2><p>${esc(description)}</p></div><span class="cx-scope">${esc(unitLabel(unit()))}</span></div>`;
  }
  function editionDetails(b = book()) {
    return `<details class="cx-edition"><summary><span>${esc(b.editionLabel)}</span> · 版本与内容说明</summary><p>${esc(b.editionNote)}</p><p>站内为按单元主题编写的学习目标、核心词汇精选、语法讲解及原创练习。教材课文、完整词表和课后原题请查阅正版教材；本页不等同于整册教材原文。</p><div class="cx-actions"><a class="outline-btn" href="${esc(b.officialUrl)}" target="_blank" rel="noopener noreferrer">出版社教材与配套资源 ↗</a><a href="https://basic.smartedu.cn/elecEdu" target="_blank" rel="noopener noreferrer">国家中小学智慧教育平台 ↗</a></div><p class="cx-small">内容整理：${esc(D.updatedAt)}。各校使用册次与印次请以学校发放的教材为准。</p></details>`;
  }
  function renderHomePicker() {
    const u = unit();
    $('cxHomePicker').innerHTML = `<div class="cx-picker-copy"><span class="cx-kicker">YOUR LEARNING PATH</span><strong>从你正在学的单元出发</strong><small>六册教材主题 · ${D.units.length} 篇原创阅读</small></div><label>选择教材<select id="cxHomeBook">${bookOptions(u.bookId)}</select></label><label class="cx-unit-select">选择单元<select id="cxHomeUnit">${D.units.filter(x => x.bookId === u.bookId).map(x => `<option value="${x.id}"${selected(x.id,u.id)}>Unit ${x.number} · ${esc(x.title)}</option>`).join('')}</select></label>${action('进入本单元 →','course','','primary-btn')}`;
  }
  function renderTextbookGuide() {
    const u=unit(), b=book();
    return `<section class="cx-textbook-guide" aria-labelledby="cxTextbookTitle"><div><span class="cx-kicker">TEXTBOOK & COMPANION READING</span><h3 id="cxTextbookTitle">教材课文原文，从这里查阅</h3><p>对照 ${esc(b.title)} · Unit ${u.number}「${esc(u.title)}」，在出版社电子教材中选择与你的实书一致的版本与页码。本站下方的短语、句型和配套短文为原创学习材料。</p></div><div class="cx-actions"><a class="primary-btn" href="https://edu.yilin.com/index.php/Category/index?nav_id=14" target="_blank" rel="noopener noreferrer">打开出版社电子教材 ↗</a><a class="outline-btn" href="https://basic.smartedu.cn/elecEdu" target="_blank" rel="noopener noreferrer">国家平台教材入口 ↗</a></div><details><summary>先读本单元原创配套短文：${esc(u.reading.title)}</summary><div class="cx-prose" lang="en">${paragraph(u.reading.text)}</div><div class="cx-actions">${action('▶ 朗读配套短文','read-audio')}${action('阅读理解 →','exercise','reading')}</div><details><summary>中文大意</summary><p>${esc(u.reading.summary)}</p></details></details><p class="cx-small">正版教材为站外资源，需要联网；站内原创材料和重点表达随离线版保存。</p></section>`;
  }
  function renderLanguageFocus() {
    const focus=window.LANGUAGE_FOCUS?.units.find(x=>x.unitId===unit().id);
    if(!focus) return '';
    return `<section class="cx-section" id="cxLanguageFocus"><div class="cx-section-head"><div><span class="cx-kicker">EXPRESSIONS TO KEEP</span><h3>重点短语与句型</h3><p>围绕本单元主题整理的原创配套表达。先理解，再遮住英语，试着用自己的话说出来。</p></div>${action('去背本单元单词 →','word-study')}</div><h4 class="cx-focus-subtitle">常用短语 · ${focus.phrases.length} 组</h4><div class="cx-focus-grid">${focus.phrases.map((p,i)=>`<article class="cx-focus-card"><span class="cx-kicker">PHRASE ${i+1}</span><p>${esc(p.meaning)}</p><details><summary>回想英语，再展开核对</summary><h4 lang="en">${esc(p.phrase)}</h4><p lang="en">${esc(p.example)}</p><p class="cx-small">${esc(p.translation)}</p>${action('▶ 朗读例句','phrase-audio',String(i),'quiet-btn')}</details></article>`).join('')}</div><h4 class="cx-focus-subtitle">核心句型 · ${focus.patterns.length} 组</h4><div class="cx-pattern-list">${focus.patterns.map((p,i)=>`<article class="cx-focus-card"><span class="cx-kicker">PATTERN ${i+1}</span><h4 lang="en">${esc(p.pattern)}</h4><p>${esc(p.meaning)}</p><details><summary>查看例句与使用方法</summary><p lang="en">${esc(p.example)}</p><p>${esc(p.translation)}</p><p class="cx-focus-tip">${esc(p.tip)}</p>${action('▶ 朗读例句','pattern-audio',String(i),'quiet-btn')}</details></article>`).join('')}</div><p class="cx-small">${esc(window.LANGUAGE_FOCUS.origin)} 不作为完整教材重点清单；可与老师课堂笔记对照补充。</p></section>`;
  }
  function renderCourse() {
    const u = unit(), b = book();
    const semester = b.id.endsWith('a') ? 'a' : 'b';
    $('cx-course').innerHTML = scopeHeader('TEXTBOOK COMPANION', '译林同步课堂', '选好年级和学期，再用一个单元串起词汇、语法、阅读与表达。') +
      `<nav class="cx-actions cx-course-shortcuts" aria-label="本单元学习入口">${action('课文原文入口','focus-textbook')}${action('重点短语与句型','focus-expressions','','primary-btn')}${action('背本单元单词','word-study')}${action('语法讲解','focus-grammar')}</nav>` +
      `<section class="cx-catalog"><div class="cx-catalog-controls"><div class="cx-segment" aria-label="选择年级">${[7,8,9].map(g => `<button type="button" data-caction="book" data-value="${g}${semester}" aria-pressed="${String(Number(b.grade) === g)}">${['','','','','','','','七','八','九'][g]}年级</button>`).join('')}</div><div class="cx-segment" aria-label="选择学期">${['a','b'].map(s => `<button type="button" data-caction="book" data-value="${b.grade}${s}" aria-pressed="${String(semester === s)}">${s === 'a' ? '上册' : '下册'}</button>`).join('')}</div><span class="cx-small">${esc(b.editionLabel)}</span></div><div class="cx-unit-grid">${D.units.filter(x => x.bookId === b.id).map(x => `<button type="button" class="cx-unit-button" data-caction="unit" data-value="${x.id}" aria-pressed="${String(x.id === u.id)}"><span>UNIT ${String(x.number).padStart(2,'0')}<small data-unit-progress="${x.id}">${C.progress(state,x).done}/6 环节</small></span><strong>${esc(x.title)}</strong><small>${esc(x.theme)}</small></button>`).join('')}</div></section>` +
      `<section class="cx-unit-hero"><div><span class="cx-kicker">${esc(unitLabel(u))}</span><h2>${esc(u.title)}</h2><p>${esc(u.theme)}</p><ul>${u.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div><div class="cx-unit-status"><strong id="cxUnitPercent">${C.progress(state,u).percent}%</strong><span id="cxUnitDone">${C.progress(state,u).done} / 6 环节已完成</span><small>记录学习活动的完成情况</small>${action('查看本单元练习','exercise','vocabulary','primary-btn')}</div></section>` +
      `<div class="cx-milestones" id="cxMilestones"></div>` +
      renderTextbookGuide() +
      `<section class="cx-section" id="cxVocabulary"><div class="cx-section-head"><div><span class="cx-kicker">01 · WORDS IN CONTEXT</span><h3>主题核心词汇</h3><p>本单元精选 ${u.vocabulary.length} 个词。读例句、回想中文，再进行词义练习。</p></div><div class="cx-actions">${action('背本单元单词 →','word-study','','primary-btn')}${action('词义练习 →','exercise','vocabulary')}</div></div><div class="cx-word-grid">${u.vocabulary.map((w,i) => `<article class="cx-word"><div><h4 lang="en">${esc(w.word)}</h4><button type="button" class="cx-audio" data-caction="word-audio" data-value="${i}" aria-label="朗读 ${esc(w.word)}">▶</button></div><details><summary>回想词义，再展开</summary><p>${esc(w.meaning)}</p></details><p lang="en">${esc(w.example)}</p><label><input type="checkbox" data-cword="${esc(w.word)}"${checked(state.words[u.id]?.includes(w.word))}> 我已复习</label></article>`).join('')}</div></section>` +
      renderLanguageFocus() +
      `<section class="cx-section" id="cxGrammar"><div class="cx-section-head"><div><span class="cx-kicker">02 · NOTICE THE PATTERN</span><h3>语法小课堂</h3><p>${u.grammarNote ? esc(u.grammarNote) : '先理解规则和例句，再完成每个知识点的 5 道练习。'}</p></div></div><div class="cx-grammar-grid">${u.grammarKeys.map(id => { const t = topics.get(id); return t ? `<article class="cx-grammar"><h4>${esc(t.title)}</h4>${t.rules.map(r => `<div class="cx-rule"><strong>${esc(r.label)}</strong><p>${esc(r.explanation)}</p><blockquote lang="en">${esc(r.example)}<small lang="zh-CN">${esc(r.translation)}</small></blockquote></div>`).join('')}<p class="cx-pitfall"><strong>容易混淆：</strong>${esc(t.pitfall)}</p>${action('练习这个知识点 · 5 题','grammar',id)}</article>` : ''; }).join('')}</div></section>` +
      `<section class="cx-section"><div class="cx-section-head"><div><span class="cx-kicker">03 · READ, SPEAK & WRITE</span><h3>把所学用起来</h3><p>与这个单元一起更新的课外阅读和表达任务。</p></div></div><div class="cx-linked-grid"><article class="cx-linked cx-linked-reading"><span>📖 原创课外阅读</span><h4 lang="en">${esc(u.reading.title)}</h4><p>${esc(u.reading.summary)}</p><small>${C.wordCount(u.reading.text)} 词 · ${esc(u.reading.level)} · 5 道理解题</small>${action('打开这篇阅读 →','reading','','primary-btn')}</article><article class="cx-linked"><span>🎧 情境听说</span><h4 lang="en">${esc(u.dialogue.title)}</h4><p>听一段完整对话，练习回答三个开放问题，再录音回听。</p><small>6 轮对话 · 5 道听力题</small>${action('进入听说练习 →','speaking')}</article><article class="cx-linked"><span>✍️ 主题写作</span><h4>用英语表达你的想法</h4><p>${esc(u.writing.prompt)}</p><small>写作提纲 · 原创范文 · 自查清单</small>${action('开始写作 →','exercise','writing')}</article></div></section>` + editionDetails(b);
  }
  function renderReading() {
    $('cx-reading').innerHTML = scopeHeader('READ BEYOND THE TEXTBOOK', '课外阅读', '每个单元一篇原创短文。先读懂内容，再带着证据回答问题。') +
      `<div class="cl-promo"><p><strong>也想读一整本书？</strong><br>连云港第一学期推荐书目已加入，含《柳林风声》分段导读。</p><button type="button" class="outline-btn" data-classic-open="">打开连云港书架</button></div>` +
      `<section class="cx-reading-library"><div class="cx-library-controls"><label>教材范围<select id="cxLibraryBook">${bookOptions(libraryBook,true)}</select></label><label class="cx-search">搜索阅读<input type="search" id="cxLibrarySearch" value="${esc(libraryQuery)}" placeholder="输入标题、主题或单元名称"></label><span id="cxLibraryCount" class="cx-small"></span></div><div id="cxReadingList" class="cx-reading-list"></div></section><div id="cxArticle"></div><details class="cx-edition"><summary>更多正版阅读资源</summary><p>站内短文均为原创配套。还可以在出版社“津津有味·悦读吧”栏目查找分级读物与相关资源。具体分级和适读书目请参照出版社说明。</p><a href="https://edu.yilin.com/index.php/Category/index?cat_id=170&amp;dt_type1=2&amp;nav_id=5" target="_blank" rel="noopener noreferrer">前往译林英语教育网 ↗</a></details>`;
    renderReadingList(); renderArticle();
  }
  function renderReadingList() {
    const q = libraryQuery.trim().toLowerCase();
    const filtered = D.units.filter(u => (libraryBook === 'all' || u.bookId === libraryBook) && (!q || [u.title,u.theme,u.reading.title,u.reading.summary,unitLabel(u)].join(' ').toLowerCase().includes(q)));
    $('cxLibraryCount').textContent = `${filtered.length} 篇 / 全站 ${D.units.length} 篇`;
    $('cxReadingList').innerHTML = filtered.length ? filtered.map(u => `<button type="button" class="cx-reading-card" data-caction="article" data-value="${u.id}" aria-pressed="${String(u.id === unit().id)}"><span>${esc(unitLabel(u))}${C.progress(state,u).complete.reading ? ' · 已练习 ✓' : ''}</span><strong lang="en">${esc(u.reading.title)}</strong><small>${esc(u.theme)} · ${C.wordCount(u.reading.text)} 词 · ${esc(u.reading.level)}</small></button>`).join('') : '<p class="empty-state">没有找到相关短文。试试更短的关键词，或切换到“全部六册”。</p>';
  }
  function renderArticle() {
    const u = unit(), r = u.reading;
    $('cxArticle').innerHTML = `<article class="cx-article"><header><span class="cx-kicker">${esc(unitLabel(u))} · ORIGINAL READING</span><h2 lang="en" tabindex="-1" id="cxArticleTitle">${esc(r.title)}</h2><div class="cx-article-meta"><span>${esc(r.level)}</span><span>${C.wordCount(r.text)} 个英文词</span><span>约 ${Math.max(2,Math.ceil(C.wordCount(r.text)/70))} 分钟</span></div><div class="cx-actions">${action('▶ 朗读短文','read-audio')}${action('完成 5 道理解题 →','exercise','reading','primary-btn')}</div></header><div class="cx-prose" lang="en">${paragraph(r.text)}</div><details class="cx-reading-summary"><summary>读后核对：中文大意</summary><p>${esc(r.summary)}</p></details><div class="cx-reading-tip"><strong>读完再想一想</strong><p>找到人物的决定或行动，用文中的细节说明你的判断。推断题也需要原文证据。</p>${action('开始阅读理解','exercise','reading','primary-btn')}</div></article>`;
  }
  function questionsFor(u, kind, variant) {
    if (kind === 'grammar') return (topics.get(variant) || topics.get(u.grammarKeys[0])).questions;
    if (kind === 'reading') return u.reading.questions;
    if (kind === 'listening') return u.dialogue.questions;
    const offset = variant === 'set2' ? 3 : 0;
    return Array.from({length:5}, (_,i) => {
      const index = (i + offset) % u.vocabulary.length, w = u.vocabulary[index];
      const distractors = u.vocabulary.filter(x => x.meaning !== w.meaning).slice(0,3).map(x => x.meaning);
      const correctIndex = (index + u.number) % 4, options = [...distractors]; options.splice(correctIndex,0,w.meaning);
      return {prompt:`在例句 “${w.example}” 中，${w.word} 的意思是？`,options,correctIndex,explanation:`${w.word} 在这里表示“${w.meaning}”。例句：${w.example}`,skill:'语境词义'};
    });
  }
  function quizDescriptor(kind, variant) {
    const u = unit();
    const contentId = kind === 'grammar' ? (u.grammarKeys.includes(variant) ? variant : u.grammarKeys[0]) : kind === 'vocabulary' ? (variant === 'set2' ? 'set2' : 'set1') : 'main';
    return {unitId:u.id,kind,variant:contentId,key:C.quizKey(u.id,kind,contentId)};
  }
  function quizRevision(kind, variant) {
    const revision = kind === 'grammar' ? topics.get(variant)?.revision : kind === 'vocabulary' ? unit().vocabularyRevision : 1;
    return Number.isSafeInteger(revision) && revision > 0 ? revision : 1;
  }
  function ensureQuizDraft(descriptor, force = false) {
    const revision = quizRevision(descriptor.kind,descriptor.variant), existing = state.quizDrafts[descriptor.key];
    const previousRevision = Number.isSafeInteger(existing?.contentRevision) && existing.contentRevision > 0 ? existing.contentRevision : 1;
    const updated = !!existing && previousRevision !== revision;
    if (force || !existing || updated) {
      // Answers belong to the questions actually seen. Keep the previous draft
      // in backups and retain all submitted attempts when a question group changes.
      if (updated) state.quizDrafts[descriptor.key+'::revision-'+previousRevision] = copy(existing);
      unsavedQuizKeys.delete(descriptor.key);
      state.quizDrafts[descriptor.key] = {id:uid('unit-practice'),answers:[],assisted:false,submitted:false,
        ...(revision > 1 ? {contentRevision:revision} : {}),...(updated ? {contentUpdated:true} : {})};
    }
    return state.quizDrafts[descriptor.key];
  }
  function renderAssessment() {
    const u = unit(), scores = C.latest(state,u.id);
    $('cx-assessment').innerHTML = scopeHeader('PRACTISE & UNDERSTAND', '本单元练习', `${u.title} · 作答后即时核对答案，草稿与记录按单元保存。`) +
      `<div class="cx-practice-cards">${['vocabulary','grammar','reading','listening','writing'].map((kind,i) => `<article class="cx-practice-card"><span class="cx-kicker">0${i+1} · ${['WORDS','GRAMMAR','READING','LISTENING','WRITING'][i]}</span><h3>${names[kind]}${kind === 'writing' ? '与自查' : '练习'}</h3><p>${({vocabulary:'两组词义练习，覆盖本单元 8 个精选词。',grammar:`${u.grammarKeys.length} 个语法知识点，每个知识点 5 题。`,reading:`${u.reading.title} · 5 道理解题。`,listening:'6 轮原创情境对话，5 道理解题。',writing:'主题提纲、自动保存草稿和原创范文。'})[kind]}</p><small data-score-kind="${kind}">${scores[kind] ? '最近独立作答 '+scores[kind].correct+'/5' : kind === 'writing' && state.writing[u.id]?.savedAt ? '已保存写作自查' : '可以从这里开始'}</small>${action(kind === 'writing' ? '打开写作' : '开始练习','exercise',kind)}</article>`).join('')}</div><div class="exercise-workspace cx-workspace" id="cxQuizWorkspace" hidden></div>`;
    if (currentQuiz?.unitId === u.id) renderQuiz();
  }
  function openExercise(kind, variant) {
    if (!['vocabulary','grammar','reading','listening','writing'].includes(kind)) return;
    currentQuiz = quizDescriptor(kind,variant);
    if (kind !== 'writing') ensureQuizDraft(currentQuiz);
    if(kind === 'listening' && $('speaking').classList.contains('active')) markListeningAssisted();
    save(); openView('assessment'); renderQuiz();
    $('cxQuizWorkspace').scrollIntoView({block:'start',behavior:'instant'});
    $('cxQuizTitle').focus({preventScroll:true});
  }
  function retryExercise(kind, variant) {
    if (!['vocabulary','grammar','reading','listening'].includes(kind)) return;
    const descriptor = quizDescriptor(kind,variant);
    ensureQuizDraft(descriptor,true);
    openExercise(kind,variant);
  }
  function nextActivity() { return C.nextActivity(state,unit()); }
  function activityLabel(activity) {
    if (activity.kind === 'complete') return '本单元已完成 · 查看学习记录 →';
    const detail = activity.kind === 'vocabulary' ? (activity.variant === 'set2' ? '词汇第 2 组' : '词汇第 1 组') : activity.kind === 'grammar' ? topicTitle(activity.variant || unit().grammarKeys[0]) : names[activity.kind];
    return '下一步：'+detail+' →';
  }
  function nextActivityButton() { return action(esc(activityLabel(nextActivity())),'next','','primary-btn'); }
  function openActivity(activity) {
    ensureDay();
    const next = typeof activity === 'string' ? {kind:activity} : activity || nextActivity();
    if (next.kind === 'complete') { openView('growth'); return; }
    if (next.kind === 'reading') { openReading(); return; }
    if (next.kind === 'speaking') { openView('speaking'); $('cxSpeakingContent').scrollIntoView({block:'start',behavior:'instant'}); return; }
    openExercise(next.kind,next.variant);
  }
  function openTask(task) {
    ensureDay();
    if (task === 'review') { openView('today'); $('reflection').focus(); return; }
    if (task === 'reading') { openReading(); return; }
    if (task === 'speaking') { openActivity({kind:C.progress(state,unit()).complete.listening ? 'speaking' : 'listening'}); return; }
    const kind = {vocab:'vocabulary',lesson:'grammar'}[task];
    if (!kind) return;
    const next = C.nextActivity(state,unit(),kind);
    if (next.kind !== 'complete') { openActivity(next); return; }
    if (kind === 'vocabulary') openWords();
    else openExercise('grammar',unit().grammarKeys[0]);
  }
  function renderQuiz() {
    if (!currentQuiz) return;
    const u = unit(), {kind,variant,key} = currentQuiz, root = $('cxQuizWorkspace');
    root.hidden = false;
    const heading = `<div class="exercise-header"><div><span class="cx-kicker">${esc(unitLabel(u))}</span><h3 tabindex="-1" id="cxQuizTitle">${names[kind]}${kind === 'writing' ? '与自查' : '练习'} · ${esc(kind === 'grammar' ? topicTitle(variant) : u.title)}</h3></div>${action('收起练习','close-quiz','','quiet-btn')}</div>`;
    if (kind === 'writing') { renderWriting(heading); return; }
    const d = state.quizDrafts[key], qs = questionsFor(u,kind,variant);
    const waitingToSave = unsavedQuizKeys.has(key);
    const selector = kind === 'grammar' ? `<label class="cx-topic-picker">练习知识点<select id="cxGrammarTopic">${u.grammarKeys.map(id => `<option value="${id}"${selected(variant,id)}>${esc(topicTitle(id))}</option>`).join('')}</select></label>` : kind === 'vocabulary' ? `<div class="cx-actions">${action('第 1 组 · 词 1—5','vocab-set','set1',variant === 'set1' ? 'primary-btn' : 'outline-btn')}${action('第 2 组 · 词 4—8','vocab-set','set2',variant === 'set2' ? 'primary-btn' : 'outline-btn')}</div>` : '';
    let material = '';
    if (kind === 'reading') material = `<details class="exercise-material" open><summary lang="en">${esc(u.reading.title)}</summary><div class="cx-prose compact" lang="en">${paragraph(u.reading.text)}</div></details>`;
    if (kind === 'listening') material = `<div class="exercise-material"><div class="cx-actions">${action('▶ 播放对话','listen')}${action(d.showTranscript ? '收起文本' : '查看听力文本','transcript')}</div><p class="cx-small">使用设备英语语音。${d.assisted ? '本次已查看文本，按文本辅助练习记录。' : '先听后答；查看文本会标记为辅助练习。'}</p>${d.showTranscript ? `<div class="cx-dialogue">${u.dialogue.turns.map(t => `<p><strong>${esc(t.speaker)}</strong><span lang="en">${esc(t.text)}</span></p>`).join('')}</div>` : ''}</div>`;
    const updateNotice = d.contentUpdated && !d.submitted ? '<p class="cx-pitfall" role="status">这组题目已更新，已为本版开启空白草稿。之前的练习成绩仍保留在成长档案中，旧草稿保留在整站备份中。</p>' : '';
    root.innerHTML = heading + updateNotice + selector + material + `<form id="cxQuizForm">${qs.map((q,i) => `<fieldset class="quiz-question ${d.submitted ? d.answers[i] === q.correctIndex ? 'is-correct' : 'is-wrong' : ''}"><legend><span class="question-index">${String(i+1).padStart(2,'0')}</span>${esc(q.prompt)}</legend><div class="quiz-options">${q.options.map((o,j) => `<label class="quiz-option ${d.submitted && j === q.correctIndex ? 'correct-option' : ''}"><input type="radio" name="cxq${i}" value="${j}" data-cquestion="${i}"${checked(d.answers[i] === j)}${d.submitted ? ' disabled' : ''}><span class="option-letter">${'ABCD'[j]}</span><span>${esc(o)}</span></label>`).join('')}</div>${d.submitted ? `<p class="answer-explanation"><strong>${d.answers[i] === q.correctIndex ? '✓ 回答正确' : '再看一看'} · 参考答案 ${'ABCD'[q.correctIndex]}</strong><br>${esc(q.explanation)}</p>` : ''}</fieldset>`).join('')}<div class="quiz-bottom"><p id="cxQuizStatus" role="status">${d.submitted ? `本次答对 ${C.score(qs,d.answers).correct} / 5 题${d.assisted ? ' · 文本辅助练习' : ''}` : `已选择 ${d.answers.filter(Number.isInteger).length} / 5 题 · 草稿自动保存`}</p>${action(waitingToSave ? '重试保存本次结果' : d.submitted ? '再练一次' : '提交并查看解析',waitingToSave ? 'submit' : d.submitted ? 'retry' : 'submit','','primary-btn')}${d.submitted && !waitingToSave ? nextActivityButton() : ''}</div></form>`;
  }
  function submitQuiz() {
    const {kind,key,variant} = currentQuiz, u = unit(), d = state.quizDrafts[key];
    if (d.submitted && !unsavedQuizKeys.has(key)) return;
    const qs = questionsFor(u,kind,variant);
    let result;
    try { result = C.score(qs,d.answers); }
    catch { $('cxQuizStatus').textContent = '请先完成全部 5 道题。'; $('cxQuizForm').querySelectorAll('fieldset')[[0,1,2,3,4].find(i => !Number.isInteger(d.answers[i]))]?.scrollIntoView({block:'center',behavior:'instant'}); return; }
    const a = state.attempts.find(x => x.id === d.id) || {id:d.id,key,unitId:u.id,kind,variant,at:new Date().toISOString(),answers:d.answers.slice(),correct:result.correct,total:5,assisted:kind === 'listening' && !!d.assisted,mistakes:result.mistakes.map(i => ({prompt:qs[i].prompt,chosen:qs[i].options[d.answers[i]],answer:qs[i].options[qs[i].correctIndex],explanation:qs[i].explanation}))};
    d.submitted = true;
    state.attempts = state.attempts.filter(x => x.id !== a.id).concat(a).slice(-3000);
    const ok = save();
    if (ok) unsavedQuizKeys.delete(key); else unsavedQuizKeys.add(key);
    renderQuiz();
    if (ok) { const task = {vocabulary:'vocab',grammar:'lesson',reading:'reading'}[kind]; if (task && C.progress(state,u).complete[kind]) markTask(task); }
    refresh(); $('cxQuizStatus').textContent += ok ? ' · 已保存' : ' · 暂未保存，请先备份记录';
  }
  const writingChecks = ['回应了题目要求，内容完整','用具体例子或细节支持想法','句子顺序清楚，连接自然','检查了时态、主谓和拼写','检查了首字母、标点与分段'];
  function renderWriting(heading) {
    const u = unit(), w = state.writing[u.id] || {text:'',checks:[]};
    $('cxQuizWorkspace').innerHTML = heading + `<div class="cx-writing-brief"><h4>写作任务</h4><p>${esc(u.writing.prompt)}</p><ol>${u.writing.outline.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div><label class="writing-label" for="cxWritingDraft">我的草稿 <span>自动保存到当前单元</span></label><textarea class="writing-area" id="cxWritingDraft" rows="9" maxlength="6000" placeholder="先把想法写下来，再检查语言。">${esc(w.text)}</textarea><p id="cxWritingCount" class="writing-counter">${C.wordCount(w.text)} 个英文词</p><div class="writing-checklist">${writingChecks.map((x,i) => `<label><input type="checkbox" data-cwriting-check="${i}"${checked(w.checks[i])}><span>${x}</span></label>`).join('')}</div><details class="model-answer"><summary>完成初稿后，再看原创参考表达</summary><div class="cx-prose compact" lang="en">${paragraph(u.writing.model)}</div></details><p class="cx-small">自查用于记录修改过程，不生成自动作文评分。</p>${action('保存写作与自查','save-writing','','primary-btn')}<p id="cxWritingStatus" role="status">${w.savedAt ? '上次自查保存于 '+new Date(w.savedAt).toLocaleString('zh-CN') : ''}</p><div class="cx-actions" id="cxWritingNext">${w.savedAt ? nextActivityButton() : ''}</div>`;
  }
  function saveWriting() {
    const id = unit().id, w = state.writing[id];
    if (!w?.text.trim()) { $('cxWritingStatus').textContent = '请先写下你的英文草稿。'; return; }
    if (!w.checks.every(Boolean) || w.checks.filter(Boolean).length < 5) { $('cxWritingStatus').textContent = '草稿已保留。请逐项检查并勾选 5 项后，再保存本次自查。'; return; }
    w.savedAt = new Date().toISOString();
    const ok = save(); refresh();
    $('cxWritingStatus').textContent = ok ? '写作与 5 项自查已保存到本单元。' : '暂未保存，请先导出备份，再重试保存。';
    $('cxWritingNext').innerHTML = ok ? nextActivityButton() : '';
  }
  function renderSpeaking() {
    const u = unit();
    $('cxSpeakingContent').innerHTML = scopeHeader('LISTEN, SPEAK & GROW', u.dialogue.title, '先听完整对话，再分角色跟读，最后尝试用自己的话回答。') + `<div class="cx-actions">${action('▶ 朗读完整对话','dialogue-audio','','primary-btn')}${action('做 5 道听力题','exercise','listening')}</div><div class="cx-speaking-grid"><section class="cx-speaking-dialogue"><h3>情境对话</h3><div class="cx-dialogue">${u.dialogue.turns.map((t,i) => `<p><strong>${esc(t.speaker)}</strong><span lang="en">${esc(t.text)}</span><button class="cx-audio" type="button" data-caction="line-audio" data-value="${i}" aria-label="朗读第 ${i+1} 句">▶</button></p>`).join('')}</div></section><section class="cx-speaking-prompts"><span class="cx-kicker">YOUR TURN</span><h3>换成你的故事</h3><p>每题试着回答 2—3 句，可以先说观点，再补充原因或例子。</p><ol>${u.speakingPrompts.map(q => `<li lang="en">${esc(q)}</li>`).join('')}</ol><p class="cx-small">设备没有英语语音时，可看文本跟读；录音需要麦克风权限。</p></section></div>`;
    const checks = state.speaking[u.id]?.checks || [];
    document.querySelectorAll('[data-speech-check]').forEach((box,i) => { box.checked = !!checks[i]; });
    const hasRecording=$('recordedAudio').dataset.unitId===u.id&&!!$('recordedAudio').getAttribute('src');
    $('recordedAudio').hidden=!hasRecording;$('downloadRecording').hidden=!hasRecording;
    $('recordingStatus').textContent = state.speaking[u.id]?.savedAt ? '本单元已保存一次口语自查。可以再次练习并更新。' : '准备好后点击“开始录音”，或直接对着问题开口练习。';
    $('cxSpeakingNext').innerHTML = state.speaking[u.id]?.savedAt ? nextActivityButton() : '';
    if ($('speaking').classList.contains('active')) markListeningAssisted();
  }
  function completeSpeaking() {
    const checks = [...document.querySelectorAll('[data-speech-check]')].map(b => b.checked);
    if (!checks.every(Boolean)) { $('recordingStatus').textContent = '请先完成并勾选三项自查，再保存。'; return; }
    state.speaking[unit().id] = {checks,savedAt:new Date().toISOString()};
    const ok = save(); if (ok) markTask('speaking'); refresh();
    $('recordingStatus').textContent = ok ? '本单元口语自查已保存。录音如需保留，请下载到自己的设备。' : '本次自查暂未保存，请先备份记录，再重试。';
    $('cxSpeakingNext').innerHTML = ok ? nextActivityButton() : '';
  }
  function markListeningAssisted() {
    const key=C.quizKey(unit().id,'listening','main');
    // Keep text exposure with the pending attempt even when a learner visits
    // the dialogue before opening the listening exercise from another page.
    const d=state.quizDrafts[key] || (state.quizDrafts[key]={id:uid('unit-practice'),answers:[],assisted:false,submitted:false});
    if(!d.submitted && !d.assisted){d.assisted=true;save();}
  }
  function onView(id) { if(id === 'speaking') markListeningAssisted(); }
  function scoreRows(scores) {
    return ['vocabulary','grammar','reading','listening'].map(kind => { const a = scores[kind]; return `<div class="score-row"><span>${names[kind]}</span><div class="score-track"><i style="width:${a ? a.correct/5*100 : 0}%"></i></div><strong>${a ? a.correct+' / 5' : '未练习'}</strong></div>`; }).join('');
  }
  function refresh() {
    if (window.restoringSnapshot || !$('cxHomePicker')) return;
    const u = unit(), b = book(), p = C.progress(state,u), scores = C.latest(state,u.id);
    renderHomePicker();
    document.querySelector('.welcome-copy > p').innerHTML = `当前单元：<strong>${esc(unitLabel(u))} · ${esc(u.title)}</strong><br>围绕“${esc(u.theme)}”，完成词汇、语法、阅读与表达。`;
    document.querySelector('.continue-top h3').textContent = `Unit ${u.number} · ${u.title}`;
    document.querySelector('.continue-top p').textContent = b.title+' · '+u.theme;
    document.querySelector('.unit-book').textContent = b.id.toUpperCase();
    document.querySelector('.goal-chips').innerHTML = u.goals.map(g => `<span>${esc(g)}</span>`).join('');
    document.querySelector('.course-percent').textContent = p.percent+'%';
    document.querySelector('.course-line span').style.width = p.percent+'%';
    document.querySelector('.continue-footer > span').textContent = `${p.done} / 6 学习环节已完成 · 按单元累计`;
    document.querySelector('.coach-question strong').textContent = u.speakingPrompts[0];
    const readingRec=document.querySelector('.recommend-item[data-go="reading"]');readingRec.querySelector('b').textContent=u.reading.title;readingRec.querySelector('small').textContent=u.reading.level+' · '+C.wordCount(u.reading.text)+'词 · 5道理解题';
    document.querySelector('.recommend-item[data-go="speaking"] b').textContent=u.dialogue.title;
    const taskText = {vocab:`复习 ${u.vocabulary.length} 个主题词`,lesson:'练习 '+u.grammarKeys.map(topicTitle).join('、'),reading:u.reading.title,speaking:u.dialogue.title,review:'记录今天最难的一点'};
    document.querySelectorAll('.home-task').forEach(row => { row.querySelector('small').textContent = taskText[row.querySelector('input').dataset.homeTask]; });
    document.querySelectorAll('#taskList .task').forEach(row => { row.querySelector('span').textContent = taskText[row.querySelector('input').dataset.task]; });
    document.querySelector('#today .unit-banner h2').textContent = '今日任务 · '+b.title+' U'+u.number;
    document.querySelector('#today .unit-banner p').textContent = `${u.title} · 任务随单元切换，每个单元分别保存。`;
    if ($('cxUnitPercent')) $('cxUnitPercent').textContent = p.percent+'%';
    if ($('cxUnitDone')) $('cxUnitDone').textContent = p.done+' / 6 环节已完成';
    document.querySelectorAll('[data-unit-progress]').forEach(el => { el.textContent = C.progress(state,units.get(el.dataset.unitProgress)).done+'/6 环节'; });
    if ($('cxMilestones')) $('cxMilestones').innerHTML = ['vocabulary','grammar','reading','listening','speaking','writing'].map(k => `<span class="${p.complete[k] ? 'done' : ''}">${p.complete[k] ? '✓' : '○'} ${names[k]}</span>`).join('');
    document.querySelector('.ability-card h3').textContent = '本单元练习记录';
    document.querySelector('.ability-list').innerHTML = scoreRows(scores);
    document.querySelector('.ability-note').textContent = '各项最近一次独立作答。语法按最近知识点展示；文本辅助听力单独保留，不计入独立听力成绩。';
    const old = LearningApp.snapshot(), stats = EnglishCore.summary(old,learningSessions());
    const dates = new Set(learningSessions().map(EnglishCore.sessionDate));
    Object.entries(old.days).forEach(([d,r]) => { if (Object.values(r.tasks || {}).some(v => v === true)) dates.add(d); });
    old.attempts.forEach(a => dates.add(EnglishCore.dayKey(a.at)));
    old.speaking.concat(old.writing).forEach(a => dates.add(EnglishCore.dayKey(a.at)));
    state.attempts.forEach(a => dates.add(EnglishCore.dayKey(a.at)));
    Object.values(state.speaking).concat(Object.values(state.writing)).forEach(r => { if (r.savedAt) dates.add(EnglishCore.dayKey(r.savedAt)); });
    Object.entries(state.dailyPlans).forEach(([d,us]) => { if (Object.values(us).some(t => Object.values(t).some(v => v === true))) dates.add(d); });
    let streak = 0, day = new Date(EnglishCore.dayKey()+'T04:00:00Z');
    if (!dates.has(EnglishCore.dayKey(day))) day.setUTCDate(day.getUTCDate()-1);
    while (dates.has(EnglishCore.dayKey(day))) { streak++; day.setUTCDate(day.getUTCDate()-1); }
    const readingCount = stats.reading + new Set(state.attempts.filter(a => a.kind === 'reading').map(a => a.unitId)).size;
    const speakingCount = stats.speaking + Object.values(state.speaking).filter(r => r.savedAt).length;
    const totalAttempts = old.attempts.length+state.attempts.length;
    const metrics = [['连续学习',streak+'天','按留下记录的日期计算'],['完成练习',totalAttempts+'组','含所有单元与历史记录'],['累计阅读',readingCount+'篇','完成理解题后计入'],['口语自查',speakingCount+'条','新内容按不同单元计入']];
    document.querySelectorAll('.home-metric').forEach((el,i) => { el.querySelector('small').textContent = metrics[i][0]; el.querySelector('strong').textContent = metrics[i][1]; el.querySelector('em').textContent = metrics[i][2]; });
    document.querySelector('.growth-up').textContent = state.attempts.filter(a => a.unitId === u.id).length+' 组本单元练习';
    $('homeContinue').textContent = p.done ? '继续本单元学习' : '开始本单元学习';
    const completed = D.units.filter(x => C.progress(state,x).done === 6).length;
    $('growthStats').innerHTML = [['累计学习',dates.size+'天'],['已保存学习时间',formatDuration(stats.durationMs)],['完成练习',totalAttempts+'组'],['完成全部环节',completed+' / '+D.units.length+' 单元']].map(([label,value]) => `<div class="stat"><small>${label}</small><strong>${value}</strong></div>`).join('');
    $('realScores').innerHTML = `<p class="cx-small">${esc(unitLabel(u))} · ${esc(u.title)}</p>${scoreRows(scores)}<p class="cx-small">写作与口语采用自查，不生成自动评分。</p>`;
    const latest = new Map(); state.attempts.filter(a => a.unitId === u.id).forEach(a => latest.set(a.key,a));
    const mistakes = [...latest.values()].flatMap(a => (a.mistakes || []).map(m => ({...m,kind:a.kind,variant:a.variant,assisted:a.assisted})));
    $('mistakeList').innerHTML = `<p class="cx-small">当前单元各组最近一次练习 · ${mistakes.length} 道待复习错题</p>` + (mistakes.length ? mistakes.map(m => `<details class="record-item mistake"><summary><span class="record-tag">${names[m.kind]}${m.assisted ? ' · 辅助' : ''}</span>${esc(m.prompt)}</summary><p>你的选择：${esc(m.chosen)}</p><p><strong>参考答案：${esc(m.answer)}</strong></p><p>${esc(m.explanation)}</p><button class="outline-btn" type="button" data-caction="mistake" data-kind="${m.kind}" data-value="${esc(m.variant || '')}">重新练习这组题</button></details>`).join('') : '<div class="empty-state">'+(latest.size ? '本单元最近各组练习暂时没有错题。可以换一个知识点继续练习。' : '完成一组练习后，会在这里保留错题与解析。')+'</div>');
    $('realAdvice').innerHTML = `<p class="quote">${mistakes.length ? '从一道错题开始，读懂解析，再用自己的话解释一次。' : '沿着当前单元继续，完成下一项阅读或表达练习。'}</p>${mistakes.length ? `<button type="button" class="outline-btn" data-caction="mistake" data-kind="${mistakes[0].kind}" data-value="${esc(mistakes[0].variant || '')}">重新练习这组错题</button>` : nextActivityButton()}`;
    const newRecords = state.attempts.slice(-10).reverse();
    $('cxPracticeHistory').innerHTML = `<div class="cx-section-head"><div><h3>单元练习足迹</h3><p>最近 10 组练习 · 切换单元后仍保留。</p></div></div>` + (newRecords.length ? newRecords.map(a => `<article class="cx-history-row"><div><strong>${esc(units.has(a.unitId) ? unitLabel(units.get(a.unitId)) : a.unitId)} · ${names[a.kind]}</strong><small>${new Date(a.at).toLocaleString('zh-CN')}${a.assisted ? ' · 文本辅助' : ''}</small></div><span>${a.correct} / 5</span>${action('回到单元','history-unit',a.unitId)}</article>`).join('') : '<p class="empty-state">从任意单元完成第一组练习，这里就会留下记录。</p>');
    $('cxLegacyHistory').innerHTML = `<summary>更新前的学习记录 · ${old.attempts.length} 组练习</summary><p>原先自我介绍主题的练习、口语、写作和学习会话仍保留，并包含在整站备份中。</p>${old.attempts.slice(-5).reverse().map(a => `<p>${esc(EnglishCore.dayKey(a.at))} · ${names[a.kind]} ${a.correct}/5${a.assisted ? ' · 文本辅助' : ''}</p>`).join('')}`;
    if(learningSessions().length)$('learningHistory').innerHTML=learningSessions().slice(0,12).map(r=>`<article class="record-item"><div class="record-head"><strong>${esc(EnglishCore.sessionDate(r))}</strong><span>${esc(formatDuration(r.durationMs))}</span></div>${r.unitId&&units.has(r.unitId)?`<p>起始单元：${esc(unitLabel(units.get(r.unitId)))}</p>`:''}<p>${esc(r.mood||'已完成学习')} · 起始任务完成 ${Number(r.taskCompletion)||0}%</p>${r.childNote?`<blockquote>${esc(r.childNote)}</blockquote>`:''}</article>`).join('');
    document.querySelectorAll('[data-score-kind]').forEach(el => { const k = el.dataset.scoreKind; el.textContent = scores[k] ? '最近独立作答 '+scores[k].correct+'/5' : k === 'writing' && state.writing[u.id]?.savedAt ? '已保存写作自查' : '可以从这里开始'; });
    const badgeStates = [dates.size>0,readingCount>0,speakingCount>0,streak>=7];
    document.querySelectorAll('#realBadges .badge-card').forEach((el,i) => { el.classList.toggle('earned',badgeStates[i]); el.classList.toggle('locked',!badgeStates[i]); el.querySelector('small').textContent = badgeStates[i] ? '已点亮' : '待点亮'; });
    const monday = new Date(EnglishCore.dayKey()+'T04:00:00Z'); monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
    document.querySelectorAll('.week-day').forEach((el,i) => { const d = new Date(monday); d.setUTCDate(d.getUTCDate()+i); const key = EnglishCore.dayKey(d), done = dates.has(key); el.classList.toggle('done',done); el.querySelector('small').textContent = done ? '有记录' : key === EnglishCore.dayKey() ? '今天' : key > EnglishCore.dayKey() ? '待学习' : '无记录'; });
    document.querySelector('#aiPanel small').textContent = window.Classics && $('classics')?.classList.contains('active') ? Classics.label() : `${b.title} U${u.number} · 单元知识提示`;
    document.querySelectorAll('[data-caction="next"]').forEach(button => { button.textContent = activityLabel(nextActivity()); });
    if (!notifyingCurriculum) {
      notifyingCurriculum = true;
      try { document.dispatchEvent(new CustomEvent('curriculum:updated',{detail:{unitId:u.id}})); }
      finally { notifyingCurriculum = false; }
    }
  }
  function reply(query) {
    if(window.Classics && $('classics')?.classList.contains('active'))return esc(Classics.reply(query));
    const u = unit(), q = query.trim().toLowerCase();
    const hasTerm = value => {
      const term = value.trim().toLowerCase();
      if (!term) return false;
      if (!/[a-z]/.test(term)) return q.includes(term);
      return new RegExp('(^|[^a-z])' + term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '($|[^a-z])','i').test(q);
    };
    const word = u.vocabulary.find(w => hasTerm(w.word) || q.includes(w.meaning));
    if (word && (q === word.word.toLowerCase() || q === word.meaning || /意思|含义|\b(?:mean|meaning|define)\b/.test(q))) return esc(`${word.word}：${word.meaning}。例句：${word.example}`);
    if (/阅读|短文/.test(q) || hasTerm('read') || hasTerm('reading')) return esc(`这篇原创阅读是 ${u.reading.title}。${u.reading.summary} 读完后可以完成 5 道理解题，再回到原文核对依据。`);
    if (/写作|作文|写一段/.test(q) || hasTerm('write') || hasTerm('writing')) return esc(u.writing.prompt+' 可以按这三步组织：'+u.writing.outline.join('；'));
    const t = u.grammarKeys.map(id => topics.get(id)).find(t => q.includes(t.title.toLowerCase()) || t.title.toLowerCase().split(/[ /、（）()]+/).some(w => w.length >= 2 && hasTerm(w)));
    const genericGrammar = /^(?:请|帮我|介绍|讲解|解释|学习|看看|复习|一下|本单元|当前单元|这个单元|的|\s)*(?:语法|语法规则|规则)(?:是什么|有哪些|一下|[？?。！!\s])*$/i.test(q) || /^(?:explain\s+)?grammar(?:\s+please)?[?.!\s]*$/.test(q);
    const beQuestion = u.grammarKeys.includes('be_present') && /为什么|怎么/.test(q) && /用|搭配|动词/.test(q) && ['am','is','are'].some(hasTerm);
    if (t || genericGrammar || beQuestion) { const topic = t || topics.get(u.grammarKeys[0]); return esc(topic.title+'：'+topic.rules.map(r => r.explanation+' 例如 '+r.example).join(' ')); }
    if (word && hasTerm(word.word)) return esc(`${word.word}：${word.meaning}。例句：${word.example}`);
    return esc(`当前单元是 ${u.title}。可以问本单元词汇（如 ${u.vocabulary[0].word}）、语法、阅读大意或写作提纲。这里根据已整理的单元知识提供提示；更开放的问题可以记下来请教老师。`);
  }
  function openReading() { libraryBook = unit().bookId; libraryQuery = ''; renderReading(); openView('reading'); $('cxArticle').scrollIntoView({block:'start',behavior:'instant'}); }
  function openWords() { openView('course'); $('cxVocabulary').scrollIntoView({block:'start',behavior:'instant'}); }
  function markWordReviewed(word, unitId) {
    const u=unit();
    if((unitId && unitId!==u.id) || !u.vocabulary.some(w=>w.word===word)) return false;
    const words=state.words[u.id] || (state.words[u.id]=[]);
    if(!words.includes(word)) words.push(word);
    const ok=save();
    if(ok && words.length===u.vocabulary.length) markTask('vocab');
    refresh(); return ok;
  }
  function continueLearning() { ensureDay(); if (!activeLearningSession) startLearningSession(); openActivity(); }

  // Keep existing recordings, backup controls and learning timers; mount the expanded curriculum around them.
  const recordButton = $('recordButton'), selfcheck = document.querySelector('.speaking-selfcheck');
  ['course','reading','assessment','speaking'].forEach(legacyView);
  $('cx-speaking').innerHTML = '<div id="cxSpeakingContent"></div>';
  selfcheck.classList.add('cx-recording'); selfcheck.prepend(recordButton); $('cx-speaking').append(selfcheck);
  selfcheck.querySelector('h4').textContent = '听一听自己的表达';
  selfcheck.querySelector('p').textContent = '练习回答本单元的问题。录音后回放，检查意思、句子与清晰度。录音可在刷新前下载；这里不自动评发音分数。';
  const speakingNext = document.createElement('div'); speakingNext.id = 'cxSpeakingNext'; speakingNext.className = 'cx-actions'; $('recordingStatus').after(speakingNext);
  ['我回应了本单元的问题','我用完整句补充了原因或细节','我听了回放或向他人展示'].forEach((text,i) => { const label = selfcheck.querySelectorAll('.speak-checks label')[i], input = label.querySelector('input'); label.textContent = ''; label.appendChild(input); label.appendChild(document.createTextNode(text)); });
  const picker = document.createElement('section'); picker.id = 'cxHomePicker'; picker.className = 'cx-home-picker'; $('home').prepend(picker);
  const practiceHistory = document.createElement('section'); practiceHistory.id = 'cxPracticeHistory'; $('learningHistory').after(practiceHistory);
  const legacyHistory = document.createElement('details'); legacyHistory.id = 'cxLegacyHistory'; legacyHistory.className = 'cx-edition'; practiceHistory.after(legacyHistory);
  document.querySelector('.coach-question button').onclick = () => speakText(unit().speakingPrompts[0]);
  document.querySelector('.coach-quick button').onclick = () => showToast('先说一个观点，再用 because 给出理由。也可以到本单元写作页参考表达提纲。');
  const taskLabels = {vocab:'进入词汇 →',lesson:'练习语法 →',reading:'进入阅读 →',speaking:'开始听说 →',review:'填写感受 →'};
  document.querySelectorAll('.home-task').forEach(row => {
    const task = row.querySelector('input').dataset.homeTask, button = document.createElement('button');
    button.type = 'button'; button.className = 'task-entry'; button.textContent = taskLabels[task];
    button.addEventListener('click',event => { event.preventDefault(); event.stopPropagation(); openTask(task); });
    row.querySelector('span').append(button);
  });
  window.Curriculum = {unit,selectUnit,selectBook,refresh,ensureDay,onView,openExercise,retryExercise,openActivity,openTask,nextActivity,openWords,markWordReviewed,continueLearning,completeSpeaking,tasksForDay,reply,progress:() => C.progress(state,unit()),snapshot:() => { remember(); return copy(state); }};
  if (saved._date === EnglishCore.dayKey() && !saved._unit) saved._unit = '7a-u1';
  remember(); saved = C.tasksFor(state,EnglishCore.dayKey(),unit().id); save();
  safeStore.set('englishGrowthTasks',JSON.stringify(saved));
  renderCourse(); renderReading(); renderAssessment(); renderSpeaking(); LearningApp.render();
  onView(document.querySelector('.view.active')?.id);
  $('aiLog').innerHTML = `<div class="ai-msg">${reply('帮助')}</div>`;

  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-caction]'); if (!btn) return;
    const v = btn.dataset.value, a = btn.dataset.caction;
    if (a === 'book') selectBook(v);
    if (a === 'unit') selectUnit(v);
    if (a === 'course') openView('course');
    if (['focus-textbook','focus-expressions','focus-grammar'].includes(a)) {
      const target=$({'focus-textbook':'cxTextbookTitle','focus-expressions':'cxLanguageFocus','focus-grammar':'cxGrammar'}[a]);
      if(target) { target.setAttribute('tabindex','-1'); target.scrollIntoView({block:'start',behavior:'instant'}); target.focus({preventScroll:true}); }
    }
    if (a === 'word-study') openView('words');
    if (a === 'phrase-audio' || a === 'pattern-audio') {
      const focus=window.LANGUAGE_FOCUS?.units.find(x=>x.unitId===unit().id);
      const item=focus?.[a==='phrase-audio'?'phrases':'patterns'][Number(v)];
      if(item) speakText(item.example);
    }
    if (a === 'history-unit') selectUnit(v,'course');
    if (a === 'article') { selectUnit(v,'reading'); renderReadingList(); renderArticle(); $('cxArticle').scrollIntoView({block:'start',behavior:'instant'}); $('cxArticleTitle').focus({preventScroll:true}); }
    if (a === 'reading') openReading();
    if (a === 'speaking') openView('speaking');
    if (a === 'exercise') openExercise(v);
    if (a === 'grammar') openExercise('grammar',v);
    if (a === 'mistake') retryExercise(btn.dataset.kind,v);
    if (a === 'next') openActivity();
    if (a === 'vocab-set') openExercise('vocabulary',v);
    if (a === 'close-quiz') { $('cxQuizWorkspace').hidden = true; currentQuiz = null; }
    if (a === 'submit') submitQuiz();
    if (a === 'retry') retryExercise(currentQuiz.kind,currentQuiz.variant);
    if (a === 'save-writing') saveWriting();
    if (a === 'word-audio') speakText(unit().vocabulary[Number(v)].word+'. '+unit().vocabulary[Number(v)].example);
    if (a === 'line-audio') speakText(unit().dialogue.turns[Number(v)].text);
    if (a === 'read-audio') speakText(unit().reading.text);
    if (a === 'dialogue-audio') speakText(unit().dialogue.turns.map(t => t.text).join(' '));
    if (a === 'transcript') { const d = state.quizDrafts[currentQuiz.key]; d.showTranscript = !d.showTranscript; if (d.showTranscript && !d.submitted) d.assisted = true; save(); renderQuiz(); }
    if (a === 'listen') {
      const quizKey = currentQuiz.key, d = state.quizDrafts[quizKey];
      if (!selectedVoice()) { d.showTranscript = true; if (!d.submitted) d.assisted = true; save(); renderQuiz(); showToast('当前设备没有英语语音，已展开文本，按辅助练习记录。'); }
      else playNaturalSequence(unit().dialogue.turns.map(t => t.text),unit().dialogue.title+' · 本机朗读',1,() => {
        if (state.quizDrafts[quizKey] !== d) return false;
        d.showTranscript = true; if (!d.submitted) d.assisted = true; save();
        if (currentQuiz && currentQuiz.key === quizKey) renderQuiz();
      });
    }
  });
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.id === 'cxHomeBook') selectBook(el.value);
    if (el.id === 'cxHomeUnit') selectUnit(el.value);
    if (el.id === 'cxLibraryBook') { libraryBook = el.value; renderReadingList(); }
    if (el.id === 'cxGrammarTopic') openExercise('grammar',el.value);
    if (el.dataset.cword !== undefined) { const id = unit().id; state.words[id] = (state.words[id] || []).filter(w => w !== el.dataset.cword); if (el.checked) state.words[id].push(el.dataset.cword); const ok = save(); if (ok && state.words[id].length === unit().vocabulary.length) markTask('vocab'); refresh(); }
    if (el.dataset.cquestion !== undefined && currentQuiz) { const d = state.quizDrafts[currentQuiz.key]; if (d.submitted) return; d.answers[Number(el.dataset.cquestion)] = Number(el.value); const ok = save(); $('cxQuizStatus').textContent = `已选择 ${d.answers.filter(Number.isInteger).length} / 5 题`+(ok ? ' · 草稿已保存' : ' · 暂未保存'); }
    if (el.dataset.cwritingCheck !== undefined) {
      const id = unit().id, w = state.writing[id] || (state.writing[id] = {text:$('cxWritingDraft').value,checks:[]});
      const wasComplete = !!w.savedAt;
      w.checks[Number(el.dataset.cwritingCheck)] = el.checked;
      if (!el.checked) {
        delete w.savedAt;
        $('cxWritingNext').innerHTML = '';
        $('cxWritingStatus').textContent = '请完成 5 项自查后，再保存本次写作。';
      }
      const ok = save();
      if (!ok) $('cxWritingStatus').textContent = '本次自查暂未保存，请保留此页并导出备份。';
      if (wasComplete && !w.savedAt) refresh();
    }
    if (el.hasAttribute('data-speech-check')) {
      const old = state.speaking[unit().id] || {}, checks = [...document.querySelectorAll('[data-speech-check]')].map(b => b.checked);
      const next = {...old,checks};
      if (checks.length !== 3 || !checks.every(Boolean)) {
        delete next.savedAt;
        $('cxSpeakingNext').innerHTML = '';
        $('recordingStatus').textContent = '请完成并勾选三项自查，再保存本次口语练习。';
      }
      state.speaking[unit().id] = next;
      const ok = save();
      if (!ok) $('recordingStatus').textContent = '本次自查暂未保存，请保留此页并导出备份。';
      if (old.savedAt && !next.savedAt) refresh();
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'cxLibrarySearch') { libraryQuery = event.target.value; renderReadingList(); }
    if (event.target.id === 'cxWritingDraft') {
      const id = unit().id, w = state.writing[id] || (state.writing[id] = {text:'',checks:[]}), wasComplete = !!w.savedAt;
      if (w.text !== event.target.value) {
        w.text = event.target.value; w.checks = []; delete w.savedAt;
        document.querySelectorAll('[data-cwriting-check]').forEach(box => { box.checked = false; });
        $('cxWritingNext').innerHTML = '';
        $('cxWritingStatus').textContent = '草稿已修改，请对当前内容重新完成 5 项自查。';
      }
      const ok = save();
      $('cxWritingCount').textContent = C.wordCount(w.text)+' 个英文词 · '+(ok ? '草稿已保存' : '暂未保存，请保留此页并导出备份');
      if (wasComplete && !w.savedAt) refresh();
    }
  });
  window.addEventListener('learning:stored', e => { if (saving || switching || window.restoringSnapshot) return; if (e.detail.key === 'englishGrowthTasks') { remember(); save(); refresh(); } });
  function receiveCurriculumStorage(e) {
    if (e.key !== storageKey || window.restoringSnapshot) return;
    try {
      const next = C.normalize(JSON.parse(e.newValue || '{}'));
      if (LearningApp.isRecording?.()) {
        const current = state, id = unit().id, otherSelection = next.selectedUnit;
        next.selectedUnit = id; next.selectedBook = unit().bookId;
        // Keep incoming additions in memory for the next normal save without
        // replacing the unit, live draft objects or self-checks used by recording.
        next.attempts = [...new Map([...current.attempts,...next.attempts].map(attempt => [attempt.id,attempt])).values()]
          .sort((a,b) => Date.parse(a.at)-Date.parse(b.at)).slice(-3000);
        for (const field of ['writing','speaking','words']) {
          next[field] = {...current[field],...next[field]};
          if (current[field][id] !== undefined) next[field][id] = current[field][id];
        }
        next.quizDrafts = {...current.quizDrafts,...next.quizDrafts};
        for (const [key,draft] of Object.entries(current.quizDrafts)) {
          if (key.startsWith(id+'::') || unsavedQuizKeys.has(key)) next.quizDrafts[key] = draft;
        }
        next.dailyPlans = Object.fromEntries([...new Set([...Object.keys(current.dailyPlans),...Object.keys(next.dailyPlans)])]
          .map(day => [day,{...current.dailyPlans[day],...next.dailyPlans[day]}]));
        C.rememberPlan(next,saved);
        state = next;
        if (otherSelection !== id) showToast('已接收其他页面的学习记录。录音期间保持本页单元，结束后可手动切换。');
        return;
      }
      if (!units.has(next.selectedUnit)) {
        // An older open tab keeps records for newly added units without writing its selection back.
        next.selectedUnit = state.selectedUnit;
        next.selectedBook = unit().bookId;
        showToast('其他页面已使用新单元。刷新此页可载入最新目录。');
      }
      state = next;
      saved = C.tasksFor(state,EnglishCore.dayKey(),unit().id);
      currentQuiz = null;
      if(libraryBook !== 'all') libraryBook = state.selectedBook;
      renderCourse(); renderReading(); renderAssessment(); renderSpeaking(); LearningApp.render();
    } catch {}
  }
  window.addEventListener('storage', receiveCurriculumStorage);
})();
