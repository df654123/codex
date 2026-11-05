(function () {
  'use strict';
  const data = window.ENGLISH_CURRICULUM, curriculum = window.Curriculum;
  const main = document.getElementById('mainContent');
  if (!main || !data?.units?.length || !curriculum?.progress) return;
  const esc = window.escapeHtml;
  const books = new Map(data.books.map(book => [book.id, book]));
  const topics = new Map((window.GRAMMAR_BANK?.topics || []).map(topic => [topic.id, topic]));
  const studyViews = new Set(['today','exam','course','words','reading','speaking','assessment','growth','literacy']);
  const stages = [
    ['vocabulary','词汇','words'], ['grammar','语法','grammar'], ['reading','阅读','reading'],
    ['listening','听力','listening'], ['speaking','口语','speaking'], ['writing','写作','writing']
  ];
  const statusLabels = {'edition-checked':'所列版本目录已核','resource-crosschecked':'新版配套资源交叉核对','legacy-reference':'旧版四单元复习'};
  const expanded = new Set(['sections']);
  let currentUnitId = '', updating = false;
  const bar = document.createElement('section');
  bar.id = 'textbookNavigator';
  bar.className = 'ta-navigator';
  bar.setAttribute('aria-label','当前教材与单元学习路线');
  bar.innerHTML = `<div class="ta-nav-heading"><span class="cx-kicker">YOUR UNIT, STEP BY STEP</span><span id="taProgress" class="ta-progress-copy" role="status"></span></div>
    <div class="ta-selectors"><label for="taBook">正在学习的教材<select id="taBook">${data.books.map(book => `<option value="${esc(book.id)}">${esc(book.shortLabel || book.title)}</option>`).join('')}</select></label><label for="taUnit" class="ta-unit-selector">当前单元<select id="taUnit"></select></label><button type="button" data-ta-action="alignment" class="ta-reference-button">教材对照与页码 <span aria-hidden="true">↗</span></button></div>
    <nav class="ta-stages" aria-label="本单元六个学习环节">${stages.map(([kind,label,action],index) => `<button type="button" data-ta-action="${action}" data-ta-stage="${kind}"><span class="ta-stage-icon" aria-hidden="true">${index + 1}</span><span>${label}</span><small class="ta-stage-status">待完成</small></button>`).join('')}</nav>
    <div class="ta-nav-footer"><span id="taBookStatus" class="ta-book-status"></span><button type="button" id="taNext" class="primary-btn" data-ta-action="next"></button></div>`;
  main.prepend(bar);
  const $ = id => document.getElementById(id);
  const button = (label,action,value = '',css = 'ta-link') => `<button type="button" class="${css}" data-ta-action="${esc(action)}" data-ta-value="${esc(value)}">${esc(label)}</button>`;
  const link = (label,url) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  const activeView = () => document.querySelector('main .view.active')?.id || '';

  function nextLabel(next) {
    if (next.kind === 'complete') return '六个环节已完成 · 看学习记录 →';
    const label = next.kind === 'grammar' ? topics.get(next.variant)?.title || '语法练习'
      : next.kind === 'vocabulary' ? `词汇第 ${next.variant === 'set2' ? '2' : '1'} 组`
      : stages.find(([kind]) => kind === next.kind)?.[1] || '本单元';
    return `继续下一步：${label} →`;
  }

  function sectionCompanion(section) {
    const descriptions = {
      welcome:['看教材图片与导入问题，联系自己的生活经验。', [['预习主题词汇','words']]],
      reading:['先读教材课文，再用同主题的新短文练习理解与表达。', [['读原创配套短文','reading']]],
      grammar:['对照教材规则与例句，完成本单元对应知识点练习。', [['看讲解与练习','grammar']]],
      pronunciation:[`按教材练习${section.topicZh || '本单元语音'}；站内校准中心可检查设备英语语音。`, [['打开发音校准','pronunciation']]],
      integration:['先完成教材综合活动，再用站内原创情境练听、说、写，并把主题知识用于新的任务。', [['听力','listening'],['口语','speaking'],['写作','writing'],['学以致用','literacy']]],
      assessment:['先做教材自评，再到成长档案查看实际练习记录与错题。', [['看记录与错题','growth']]],
      furtherStudy:['按教材线索继续查读，再选站内书目开展拓展阅读。', [['打开拓展书目','classics']]],
      workbook:['在实书完成本单元练习；需要巩固时可加做站内原创题。', [['打开配套练习','practice']]]
    };
    return descriptions[section.id] || ['按教材栏目学习，再完成本单元配套活动。', [['看本单元','course']]];
  }

  function sectionGuide(reference) {
    if (!reference.sections?.length) return `<div class="ta-no-pages"><strong>按单元主题与语法学习</strong><p>这册尚未取得可逐页核验的栏目页码。请先找到实书中的同名单元，再使用下方的语法范围与站内配套入口。</p><div class="ta-inline-actions">${button('本单元语法','grammar')}${button('原创阅读','reading')}${button('听力练习','listening')}${button('主题写作','writing')}</div></div>`;
    return `<details class="ta-detail" data-ta-details="sections"${expanded.has('sections') ? ' open' : ''}><summary>教材栏目与学习入口 <span>${reference.sections.length} 个栏目 · 所列印次页码参考</span></summary><p class="ta-detail-note">先找到教材中的栏目，再进入对应的站内配套活动。下列页码是书上印刷页码；Workbook 位于书后附录。</p><div class="ta-section-grid">${reference.sections.map(section => {
      const [description,actions] = sectionCompanion(section);
      return `<article class="ta-section-card"><div class="ta-section-top"><span>${esc(section.labelZh)}</span><span class="ta-page">${section.location === 'appendix' ? '附录 ' : ''}P${esc(section.pageLabel)}</span></div><h4 lang="en">${esc(section.label)}</h4><p>${esc(description)}</p><div class="ta-inline-actions">${actions.map(([label,action]) => button(label,action)).join('')}</div></article>`;
    }).join('')}</div></details>`;
  }

  function bookTable(book,unit) {
    return `<details class="ta-detail" data-ta-details="book"${expanded.has('book') ? ' open' : ''}><summary>整册单元与语法对照 <span>${data.units.filter(row => row.bookId === book.id).length} 个单元 · 点标题切换</span></summary><div class="ta-table-wrap"><table class="ta-table"><caption>${esc(book.shortLabel || book.title)} · 教材范围与站内练习</caption><thead><tr><th scope="col">单元</th><th scope="col">教材语法范围</th><th scope="col">站内配套练习</th></tr></thead><tbody>${data.units.filter(row => row.bookId === book.id).map(row => `<tr${row.id === unit.id ? ' class="is-current"' : ''}><th scope="row"><button type="button" class="ta-unit-link" data-ta-action="unit" data-ta-value="${esc(row.id)}" aria-pressed="${row.id === unit.id}"><span>UNIT ${String(row.number).padStart(2,'0')}${row.id === unit.id ? ' · 当前' : ''}</span><strong lang="en">${esc(row.title)}</strong></button></th><td>${esc(row.textbook?.grammarScope || '请对照教材本单元语法页')}${row.textbook?.grammarPages?.length ? `<small>Grammar · P${row.textbook.grammarPages.join('–')}</small>` : ''}</td><td><div class="ta-topic-links">${row.grammarKeys.map(topicId => button(topics.get(topicId)?.title || topicId,'topic',`${row.id}|${topicId}`)).join('')}</div></td></tr>`).join('')}</tbody></table></div><p class="ta-detail-note">配套题为本站原创，部分知识点会分组巩固。完成记录表示已参与练习，掌握情况请结合答题结果、错题订正和老师反馈判断。</p></details>`;
  }

  function renderGuide(unit,book) {
    const course = $('cx-course'), catalog = course?.querySelector('.cx-catalog');
    if (!catalog) return;
    let guide = $('textbookAlignment');
    if (guide?.dataset.unitId === unit.id) return;
    if (!guide) {
      guide = document.createElement('section');
      guide.id = 'textbookAlignment'; guide.className = 'ta-alignment';
      guide.setAttribute('aria-labelledby','taAlignmentTitle');
      catalog.insertAdjacentElement('afterend',guide);
    }
    const reference = unit.textbook || {};
    guide.dataset.unitId = unit.id;
    guide.innerHTML = `<header class="ta-alignment-heading"><div><span class="cx-kicker">TEXTBOOK → PRACTICE</span><h3 id="taAlignmentTitle" tabindex="-1">对照教材，学好这一单元</h3><p>${esc(book.shortLabel || book.title)} · Unit ${unit.number} <span lang="en">${esc(unit.title)}</span>${reference.unitStartPage ? ` · 单元介绍 P${reference.unitStartPage}` : ''}</p></div><span class="ta-status-badge ${reference.status === 'legacy-reference' ? 'is-reference' : ''}">${esc(statusLabels[reference.status] || '版本待核')}</span></header>
      <div class="ta-edition-note"><strong>对照依据：${esc(reference.referenceEdition || book.editionLabel)}</strong><p>${esc(book.editionNote)}</p></div>
      <div class="ta-current-grammar"><span>本单元教材语法</span><strong>${esc(reference.grammarScope || '请查看实书中的语法栏目')}</strong>${button('去学这一单元的语法 →','grammar')}</div>
      ${sectionGuide(reference)}${bookTable(book,unit)}
      <details class="ta-detail ta-sources" data-ta-details="sources"${expanded.has('sources') ? ' open' : ''}><summary>教材版本、资料来源与使用说明</summary><p>${esc(book.alignmentSummary || book.editionNote)} 站内提供主题词汇精选、原创短文和练习；课文原文、完整词表与课后原题请查阅正版教材。</p><div class="ta-source-links">${link('出版社教材与配套资源',book.officialUrl)}${link('国家中小学智慧教育平台','https://basic.smartedu.cn/elecEdu')}${book.referenceUrl ? link('本册目录及版权页核验来源（第三方扫描）',book.referenceUrl) : ''}${(data.textbookSources || []).map(source => link(source.label,source.url)).join('')}</div><p class="ta-detail-note">最近核对：${esc(data.updatedAt)}。栏目到站内活动的衔接为本站学习建议，不代表教材规定的课时安排。联网可查阅来源；本页对照资料和原创配套内容随离线版保存。</p></details>`;
    const shortcuts = course.querySelector('.cx-course-shortcuts');
    if (shortcuts && !shortcuts.querySelector('[data-ta-action="alignment"]')) shortcuts.insertAdjacentHTML('afterbegin',button('教材对照与页码','alignment','','outline-btn'));
  }

  function refresh() {
    if (updating) return;
    updating = true;
    try {
      const unit = curriculum.unit(), book = books.get(unit.bookId), progress = curriculum.progress(), view = activeView();
      const changed = currentUnitId !== unit.id;
      if (changed) {
        currentUnitId = unit.id;
        $('taBook').value = book.id;
        $('taUnit').innerHTML = data.units.filter(row => row.bookId === book.id).map(row => `<option value="${esc(row.id)}"${row.id === unit.id ? ' selected' : ''}>Unit ${row.number} · ${esc(row.title)}</option>`).join('');
        if (view === 'words') window.WordStudy?.refresh();
        if (view === 'exam') window.ExamPath?.refresh();
      } else {
        $('taBook').value = book.id;
        $('taUnit').value = unit.id;
      }
      const host = studyViews.has(view) ? $(view) : main;
      if (host && bar.parentElement !== host) host.prepend(bar);
      bar.hidden = !studyViews.has(view);
      $('taProgress').textContent = `${progress.done} / 6 环节已完成`;
      $('taBookStatus').textContent = statusLabels[book.alignmentStatus] || book.editionLabel;
      $('taBookStatus').classList.toggle('is-reference',book.alignmentStatus === 'legacy-reference');
      $('taNext').textContent = nextLabel(curriculum.nextActivity());
      const viewKind = {words:'vocabulary',reading:'reading',speaking:'speaking'}[view];
      bar.querySelectorAll('[data-ta-stage]').forEach((element,index) => {
        const complete = !!progress.complete[element.dataset.taStage];
        element.classList.toggle('is-done',complete);
        element.querySelector('.ta-stage-icon').textContent = complete ? '✓' : String(index + 1);
        element.querySelector('.ta-stage-status').textContent = complete ? '已完成' : '待完成';
        if (viewKind === element.dataset.taStage) element.setAttribute('aria-current','step');
        else element.removeAttribute('aria-current');
      });
      renderGuide(unit,book);
    } finally { updating = false; }
  }

  function focusSection(id) {
    window.openView('course');
    const element = $(id);
    if (!element) return;
    element.scrollIntoView({block:'start',behavior:'instant'});
    const heading = element.querySelector('h3') || element;
    heading.setAttribute('tabindex','-1'); heading.focus({preventScroll:true});
  }

  document.addEventListener('change',event => {
    if (event.target.id === 'taBook') {
      const first = data.units.find(unit => unit.bookId === event.target.value);
      if (first) curriculum.selectUnit(first.id);
      refresh();
    }
    if (event.target.id === 'taUnit') { curriculum.selectUnit(event.target.value); refresh(); }
  });
  document.addEventListener('click',event => {
    const target = event.target.closest('[data-ta-action]');
    if (!target) return;
    const action = target.dataset.taAction, value = target.dataset.taValue;
    if (action === 'alignment') focusSection('textbookAlignment');
    else if (action === 'grammar') focusSection('cxGrammar');
    else if (action === 'next') curriculum.openActivity(curriculum.nextActivity());
    else if (action === 'unit') {
      curriculum.selectUnit(value); focusSection('textbookAlignment');
    } else if (action === 'topic') {
      const [id,topic] = (value || '').split('|');
      if (!data.units.some(unit => unit.id === id && unit.grammarKeys.includes(topic))) return;
      curriculum.selectUnit(id);
      if (curriculum.unit().id === id) curriculum.openExercise('grammar',topic);
    } else if (action === 'words') window.openView('words');
    else if (action === 'practice') window.openView('assessment');
    else if (action === 'pronunciation') window.openPronunciationLab();
    else if (['reading','listening','speaking','writing'].includes(action)) curriculum.openActivity({kind:action});
    else if (['growth','classics','course','literacy'].includes(action)) window.openView(action);
  });
  document.addEventListener('toggle',event => {
    const key = event.target.dataset?.taDetails;
    if (!key) return;
    if (event.target.open) expanded.add(key); else expanded.delete(key);
  },true);
  document.addEventListener('curriculum:updated',refresh);
  const previousOpenView = window.openView;
  window.openView = function (...args) {
    const result = previousOpenView.apply(this,args);
    refresh(); return result;
  };
  window.TextbookAlignment = {refresh};
  refresh();
})();
