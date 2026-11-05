(function () {
  'use strict';
  const root = document.getElementById('examPathRoot');
  if (!root || window.ExamPath) return;
  root.className = 'ep-view';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button = (label, action, kind = '', primary = false) => `<button type="button" class="${primary ? 'primary-btn' : 'outline-btn'}" data-ep-action="${action}"${kind ? ` data-ep-kind="${kind}"` : ''}>${label}</button>`;
  const link = (label, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
  const names = {vocabulary:'词汇',grammar:'语法',reading:'阅读',listening:'听力',speaking:'口语',writing:'写作'};
  const status = (progress, kind) => `<span class="ep-status${progress.complete[kind] ? ' is-done' : ''}" data-ep-progress="${kind}">${progress.complete[kind] ? '已完成' : '待练习'} · ${names[kind]}</span>`;

  function sourceReadings() {
    return `<section class="ep-section" aria-labelledby="epReadingTitle">
      <div class="ep-section-head"><span class="ep-kicker">READ THE WORLD</span><h3 id="epReadingTitle">带着问题，读真实世界</h3><p>历史报道改写 · 不是实时新闻。以下为依据原始来源编写的英语学习短文，不是原文节选；读后自答再展开核对，不计入单元进度。</p></div>
      <div class="ep-reading-grid">
        <details class="ep-source-reading"><summary><span class="ep-reading-tag">科学 · 找到信息依据</span><strong lang="en">A Signal from Near the Sun</strong><span>NASA · 报道发布 2024-12-27</span><span class="ep-expand">展开短文与提问 ↓</span></summary><div class="ep-reading-body">
          <p class="ep-source-meta">事件日期：2024-12-24。距离为飞越时距太阳表面约 380 万英里。</p>
          <p lang="en" class="ep-english">On 24 December 2024, NASA’s Parker Solar Probe flew closer to the Sun than any spacecraft before it. It passed about 3.8 million miles above the Sun’s surface. A later signal showed that it was working well. Scientists use its measurements to learn more about the Sun and the solar wind.</p>
          <div class="ep-question"><strong>先自己回答</strong><p lang="en">What did the later signal tell scientists?</p><details><summary>展开参考答案与依据</summary><p lang="en">It was working well.</p><p>依据第三句的 <span lang="en">“working well”</span>。注意区分飞越事件发生的时间与报道发布时间。</p></details></div>
          <p class="ep-source-link">${link('核对 NASA 原始报道', 'https://science.nasa.gov/blogs/parker-solar-probe/2024/12/27/nasas-parker-solar-probe-reports-successful-closest-approach-to-sun/')}</p>
        </div></details>
        <details class="ep-source-reading"><summary><span class="ep-reading-tag">生活 · 辨清数据年份</span><strong lang="en">Small Changes, Less Food Waste</strong><span>UNEP · 报道发布 2024-03-27</span><span class="ep-expand">展开短文与提问 ↓</span></summary><div class="ep-reading-body">
          <p class="ep-source-meta">报告发布于 2024 年，文中估算对应 2022 年；最后三句为本站教学建议。</p>
          <p lang="en" class="ep-english">A UN report published in 2024 looked at food waste around the world. It estimated that households wasted more than one billion meals a day in 2022. We can start with small changes at home. Before shopping, check what food is already there. At dinner, take a little first and get more if needed.</p>
          <div class="ep-question"><strong>先自己回答</strong><p lang="en">Which year does the estimate describe?</p><details><summary>展开参考答案与依据</summary><p lang="en">2022.</p><p>依据第二句的 <span lang="en">“in 2022”</span>，不能把报道年份当成数据年份。</p></details></div>
          <p class="ep-source-link">${link('核对 UNEP 原始报道', 'https://www.unep.org/en/news-and-stories/press-release/world-squanders-over-1-billion-meals-day-un-report')}</p>
        </div></details>
      </div><div class="ep-transfer"><div><strong>再多走一步：一个观点，两个理由</strong><p>选一个话题，先口头说明你的想法，再写出理由与具体例子。可借用本单元写作的提纲与自查清单；打开后仍保留当前单元主题。</p></div>${button('打开本单元写作 →','exercise','writing')}</div>
    </section>`;
  }

  function examSources() {
    return `<details class="ep-evidence" id="epExamSources"><summary><span class="ep-kicker">WHY THESE SKILLS</span><strong>课程与考试依据</strong><span>看清年份、地区与适用范围</span></summary><div class="ep-evidence-body">
      <p>本站以初中单元学习为主。下列文件用于说明训练方向，不代表本站覆盖全部考试题型，也不用于预测试题。</p>
      <div class="ep-evidence-grid">
        <article><span>义务教育 · 2022-04-21</span><h4>从真实情境中运用英语</h4><p>2022 年义务教育课程方案和课程标准强调核心素养与情境中的语言运用。本站将词汇、语法、理解与表达放回单元主题中练习。</p>${link('教育部课程方案与课程标准通知', 'https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html')}</article>
        <article><span>南京 · 2026-04-27</span><h4>2026 中考英语：120 分，含听说</h4><p>南京当年政策规定英语总分 120 分，其中包括听力口语考试。听懂信息与作出回应都应持续练习。</p>${link('南京市教育局 2026 年中招政策', 'https://edu.nanjing.gov.cn/njsjyj/202604/t20260427_5830812.html')}</article>
        <article><span>苏州 · 2026-04-08</span><h4>2026 中考英语：笔试 100＋听说 30</h4><p>苏州当年政策规定英语笔试 100 分，听力与口语自动化考试 30 分。与南京的计分方式不同。</p>${link('苏州市政府 2026 年中考信息', 'https://www.suzhou.gov.cn/szsrmzf/mszx/202604/391700005d894ee2a83178d413702b38.shtml')}</article>
        <article><span>高考能力衔接 · 2026-06-09</span><h4>理解信息，也说清观点和理由</h4><p>2026 年高考英语全国卷专家解读涉及真实、多元情境中的理解与表达。初中可先练主旨概括、依据细节作推断，以及观点与理由的组织。</p>${link('中国教育报：教育考试院专家解读', 'https://paper.jyb.cn/zgjyb/h5/html5/2026-06/09/content_144741_19604051.htm')}</article>
      </div><p class="ep-policy-note">各地考试安排有差异。南京、苏州的 2026 年政策仅适用于对应地区和年份，不能据此推断江苏其他城市或 2027 年安排；请以当地教育部门当年公布的文件为准。</p>
    </div></details>`;
  }

  function render() {
    const app = window.Curriculum, data = window.ENGLISH_CURRICULUM, core = window.CurriculumCore;
    if (!app || !data || !core) { root.innerHTML = '<p role="status">当前课程资料未能载入，请刷新页面后重试。</p>'; return; }
    const unit = app.unit(), book = data.books.find(item => item.id === unit.bookId);
    const progress = core.progress(app.snapshot(), unit);
    const unitLabel = `${book ? book.title : ''} · Unit ${unit.number}`;
    const cards = [
      {id:'words',number:'01',english:'WORDS IN CONTEXT',title:'语境词义',body:'先读例句，猜测词义，再回到情境核对。把新词用进自己的句子。',check:'我能根据上下文解释词义。',state:status(progress,'vocabulary'),actions:button('学本单元词汇 →','words')+button('词义练习','exercise','vocabulary')},
      {id:'grammar',number:'02',english:'PATTERNS IN USE',title:'语法运用',body:'观察规则和例句，比较容易混淆的表达，再说明为什么这样用。',check:'我能选择合适结构，并说出依据。',state:status(progress,'grammar'),actions:button('语法讲解 →','grammar')+button('语法练习','exercise','grammar')},
      {id:'reading',number:'03',english:'READ & REASON',title:'信息定位与推断',body:'先找主旨和细节，再用原文证据支持推断；把“文中说的”和“我推出来的”分开。',check:'我能指出答案所依据的句子。',state:status(progress,'reading'),actions:button('读本单元短文 →','reading')+button('阅读理解','exercise','reading')},
      {id:'listening',number:'04',english:'LISTEN & RESPOND',title:'听取与回应',body:'先听取关键信息，再用完整句回应。录音后回听，检查意思、理由与清晰度。',check:'我能回应问题，并补充一个细节。',state:status(progress,'listening')+status(progress,'speaking'),actions:button('听力练习 →','exercise','listening')+button('口语与回听','speaking')},
      {id:'writing',number:'05',english:'A VIEW WITH REASONS',title:'观点表达与写作',body:'明确写给谁、为什么写。用观点、理由与例子组织段落，完成后逐项自查。',check:'我能用理由和例子支持一个观点。',state:status(progress,'writing'),actions:button('写作与自查 →','exercise','writing')},
      {id:'culture',number:'06',english:'LANGUAGE & THE WORLD',title:'真实语境与文化',body:'从故事、科学和日常生活中认识不同经验。核对来源与时间，比较观点，尊重差异。',check:'我能区分事实、观点与自己的建议。',state:'<span class="ep-status ep-extra">拓展阅读 · 不计入六环节</span>',actions:button('打开阅读书架 →','classics')+button('本单元阅读','reading')}
    ];
    root.innerHTML = `<header class="ep-heading"><div><span class="ep-kicker">YOUR NEXT STEP</span><h2>知道学什么，也知道怎么练</h2><p>以初中译林单元学习为主，把日常积累连成理解与表达的能力。高考能力衔接作为长线方向，先把眼前一个单元学扎实。</p></div><span class="ep-scope">能力训练导引</span></header>
      <section class="ep-hero" aria-labelledby="epUnitTitle"><div class="ep-hero-copy"><span class="ep-kicker">从当前单元出发 · ${esc(unitLabel)}</span><h3 id="epUnitTitle" lang="en">${esc(unit.title)}</h3><p>${esc(unit.theme)}</p><span class="ep-edition">${esc(book ? book.editionLabel : '')}</span><div class="ep-actions">${button('继续下一环节 →','continue','',true)}${button('选择其他单元','course')}</div></div><div class="ep-progress"><span>当前单元的活动记录</span><strong>${progress.done} <small>/ 6</small></strong><div class="ep-progress-track" role="progressbar" aria-label="当前单元已完成活动" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${progress.done}"><span style="width:${progress.percent}%"></span></div><div class="ep-milestones">${Object.keys(names).map(kind => status(progress,kind)).join('')}</div></div></section>
      <p class="ep-honesty"><strong>完成不等于掌握。</strong>这里记录已做过的学习活动，不是能力评分。隔一段时间独立重做、解释答案依据，并在新情境中运用，才能判断自己是否学会。</p>
      <section class="ep-section" aria-labelledby="epAbilitiesTitle"><div class="ep-section-head"><span class="ep-kicker">SIX ABILITIES, ONE UNIT</span><h3 id="epAbilitiesTitle">把一个单元，练成六种能力</h3><p>选择你现在最需要的一项。所有练习仍使用当前单元，答案解析、错题和草稿沿用原有记录。</p></div><div class="ep-ability-grid">${cards.map(card => `<article class="ep-ability-card" data-exam-card="${card.id}"><div class="ep-card-top"><span class="ep-card-number">${card.number}</span><span class="ep-kicker">${card.english}</span></div><h4>${card.title}</h4><p>${card.body}</p><div class="ep-card-status">${card.state}</div><p class="ep-selfcheck"><span>练完问自己</span>${card.check}</p><div class="ep-card-actions">${card.actions}</div></article>`).join('')}</div></section>
      <section class="ep-section ep-route" aria-labelledby="epRouteTitle"><div class="ep-section-head"><span class="ep-kicker">A COMPLETE LEARNING LOOP</span><h3 id="epRouteTitle">从学习到复盘，走完这一小步</h3><p>从“继续下一环节”开始会记录本次学习；练习后看解析，再用自己的表达检验理解。</p></div><ol class="ep-flow">
        <li><span>01</span><h4>选单元</h4><p>对照学校正在使用的教材，确定本次主题。</p>${button('选择单元','course')}</li>
        <li><span>02</span><h4>学习</h4><p>看词汇例句，读懂语法与主题内容。</p>${button('学习词汇','words')}</li>
        <li><span>03</span><h4>练习与解析</h4><p>进入下一未完成环节，作答后核对依据。</p>${button('继续练习','continue')}</li>
        <li><span>04</span><h4>错题</h4><p>看清错误原因，重新练习对应的一组题。</p>${button('回看错题','mistakes')}</li>
        <li><span>05</span><h4>表达自查</h4><p>用完整句说清观点，再检查写作草稿。</p>${button('写作自查','exercise','writing')}</li>
        <li><span>06</span><h4>保存复盘</h4><p>结束进行中的学习并自评，回看成长记录。</p>${button('结束并自评','review')}${button('成长档案','growth')}</li>
      </ol><div class="ep-backup"><p>练习、错题与表达记录继续保存在本站。需要换设备或保留副本时，可导出整站备份。</p>${button('备份学习记录','backup')}</div></section>
      ${sourceReadings()}${examSources()}`;
  }

  function openAndFocus(view, id) {
    window.openView(view);
    const target = document.getElementById(id);
    if (target) { target.setAttribute('tabindex','-1'); target.scrollIntoView({block:'start',behavior:'instant'}); target.focus({preventScroll:true}); }
  }
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-ep-action]');
    if (!target || !root.contains(target)) return;
    const app = window.Curriculum, action = target.dataset.epAction;
    if (action === 'continue') app.continueLearning();
    if (action === 'words') app.openWords();
    if (action === 'grammar') { window.openView('course'); const heading = document.getElementById('cxGrammar'); if (heading) heading.scrollIntoView({block:'start',behavior:'instant'}); }
    if (action === 'exercise' && ['vocabulary','grammar','reading','listening','writing'].includes(target.dataset.epKind)) app.openExercise(target.dataset.epKind);
    if (action === 'reading') {
      if (typeof app.openTask === 'function') app.openTask('reading');
      else app.selectUnit(app.unit().id,'reading');
    }
    if (['course','speaking','classics','growth'].includes(action)) window.openView(action);
    if (action === 'mistakes') openAndFocus('growth','mistakeList');
    if (action === 'review' && typeof window.requestFinishLearningSession === 'function') window.requestFinishLearningSession();
    if (action === 'backup' && typeof window.exportSiteSnapshot === 'function') window.exportSiteSnapshot();
  });
  const previousOpenView = window.openView;
  if (typeof previousOpenView === 'function') window.openView = function (...args) {
    const result = previousOpenView.apply(this,args);
    if (args[0] === 'exam') render();
    return result;
  };
  window.ExamPath = {refresh:render};
  render();
})();
